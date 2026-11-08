'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  X,
  Check,
  Search,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  ExternalLink,
} from 'lucide-react'
import type { ConfigCaixa, ConfigPlanoContas, ConfigCentroCusto, ConfigTipoDocumento } from '@/lib/dataContext'
import {
  type FornecedorEscolar,
  resolvePlanoContasEscolares,
} from '@/app/(app)/financeiro/pagar/types'
import {
  type UnifiedMovimentacaoItem,
  type ComposicaoPagamentoItem,
  type RateioCentroCustoItem,
  formatCurrencyBRL,
  formatDateBR,
  getLocalISODate,
  normalizeText,
  extractCentrosCustoOptions,
} from '../types'
import { formatCurrencyInput, handleCurrencyInputChange, parseCurrencyNumeric } from '@/lib/utils'

interface NovaMovimentacaoModalProps {
  open: boolean
  editingItem: UnifiedMovimentacaoItem | null
  prefillData?: {
    tipoOperacao?: 'Pagamento' | 'Recebimento'
    valor?: number
    descricao?: string
  } | null
  selectedCaixa: ConfigCaixa
  saldoAtualCaixa: number
  totalRegistrosCaixa: number
  fornecedores: FornecedorEscolar[]
  planoContas: ConfigPlanoContas[]
  centrosCusto: ConfigCentroCusto[]
  tiposDocumento: ConfigTipoDocumento[]
  metodosPagamento: string[]
  saving: boolean
  onSave: (payload: any) => Promise<void>
  onClose: () => void
}

interface PlanoContaOptionItem {
  id: string
  codigo: string
  descricao: string
  label: string
  tipo: 'analitico' | 'sintetico' | 'detalhe'
  grupoConta: 'receitas' | 'despesas' | 'investimentos'
}

export function NovaMovimentacaoModal({
  open,
  editingItem,
  prefillData = null,
  selectedCaixa,
  saldoAtualCaixa,
  totalRegistrosCaixa,
  fornecedores,
  planoContas,
  centrosCusto,
  tiposDocumento,
  metodosPagamento,
  saving,
  onSave,
  onClose,
}: NovaMovimentacaoModalProps) {
  const hojeISO = getLocalISODate()

  const [codigoLcto, setCodigoLcto] = useState<number>(0)
  const [dataLcto, setDataLcto] = useState<string>(hojeISO)
  const [tipoOperacao, setTipoOperacao] = useState<'Pagamento' | 'Recebimento'>('Pagamento')
  const [fornecedorId, setFornecedorId] = useState<string>('1')
  const [fornecedorNome, setFornecedorNome] = useState<string>('Diversos')
  const [descricao, setDescricao] = useState<string>('')
  const [valorStr, setValorStr] = useState<string>('')
  const [contaPlanoLabel, setContaPlanoLabel] = useState<string>('')
  const [contaPlanoId, setContaPlanoId] = useState<string>('')
  const [centroCusto, setCentroCusto] = useState<string>('')
  const [tipoDocumento, setTipoDocumento] = useState<string>('')
  const [numeroDocumento, setNumeroDocumento] = useState<string>('')
  const [emissaoDocto, setEmissaoDocto] = useState<string>(hojeISO)
  const [compensadoBanco, setCompensadoBanco] = useState<'Sim' | 'Não'>('Sim')
  const [tipoRecurso, setTipoRecurso] = useState<string>('PIX')
  const [observacao, setObservacao] = useState<string>('')
  const [formError, setFormError] = useState<string>('')

  const [showComposicao, setShowComposicao] = useState<boolean>(false)
  const [descontoStr, setDescontoStr] = useState<string>('0')
  const [jurosStr, setJurosStr] = useState<string>('0')
  const [multaStr, setMultaStr] = useState<string>('0')
  const [composicaoItens, setComposicaoItens] = useState<ComposicaoPagamentoItem[]>([])
  const [rateioItens, setRateioItens] = useState<RateioCentroCustoItem[]>([])

  const [pickerOpen, setPickerOpen] = useState<'fornecedor' | 'contaPlano' | null>(null)
  const [pickerSearch, setPickerSearch] = useState<string>('')
  const [pickerGrupoFiltro, setPickerGrupoFiltro] = useState<'todos' | 'despesas' | 'receitas' | 'investimentos'>('todos')

  // Converte diretamente de `cfgPlanoContas` (/configuracoes/financeiro/plano-contas)
  const todosPlanos = useMemo<PlanoContaOptionItem[]>(() => {
    const resolved = resolvePlanoContasEscolares(planoContas, 'todos', false)
    return resolved.map((p) => {
      const cod = String(p.codPlano || '').trim()
      const label = cod ? `${cod} • ${p.descricao}` : p.descricao
      return {
        id: p.id,
        codigo: cod,
        descricao: p.descricao,
        label,
        tipo: p.tipo,
        grupoConta: p.grupoConta,
      }
    })
  }, [planoContas])

  const planosDespesas = useMemo(
    () => todosPlanos.filter((p) => p.grupoConta === 'despesas' || p.grupoConta === 'investimentos'),
    [todosPlanos]
  )

  const planosReceitas = useMemo(
    () => todosPlanos.filter((p) => p.grupoConta === 'receitas'),
    [todosPlanos]
  )

  // Opções exibidas no select principal filtradas pela natureza da operação (Despesa vs Receita)
  const planosOptions = useMemo<PlanoContaOptionItem[]>(() => {
    if (tipoOperacao === 'Recebimento') {
      return planosReceitas.length > 0 ? planosReceitas : todosPlanos
    }
    return planosDespesas.length > 0 ? planosDespesas : todosPlanos
  }, [tipoOperacao, planosReceitas, planosDespesas, todosPlanos])

  const getDefaultPlanoForOperacao = useCallback(
    (op: 'Pagamento' | 'Recebimento'): { id: string; label: string } => {
      const pool =
        op === 'Recebimento'
          ? planosReceitas.length > 0
            ? planosReceitas
            : todosPlanos
          : planosDespesas.length > 0
            ? planosDespesas
            : todosPlanos
      // Prioriza contas analíticas ou de detalhe (que recebem lançamentos diretos)
      const analitica = pool.find((p) => p.tipo === 'analitico' || p.tipo === 'detalhe')
      const chosen = analitica || pool[0]
      if (chosen) {
        return { id: chosen.id, label: chosen.label }
      }
      return { id: '', label: '' }
    },
    [planosReceitas, planosDespesas, todosPlanos]
  )

  const centrosOptions = useMemo(() => {
    return extractCentrosCustoOptions(centrosCusto)
  }, [centrosCusto])

  // Tipos de documento carregados diretamente de `/configuracoes/financeiro/tipo-documentos` (`cfgTiposDocumento`)
  const tiposDoctoOptions = useMemo(() => {
    const set = new Set<string>()
    for (const t of tiposDocumento || []) {
      if (!t || (t as any).situacao === 'inativo') continue
      const nome = String(t.nome || t.descricao || (t as any).sigla || '').trim()
      if (nome) set.add(nome)
    }
    return Array.from(set)
  }, [tiposDocumento])

  const recursosOptions = useMemo(() => {
    const base = [
      'PIX',
      'Dinheiro',
      'Boleto Bancário',
      'Transferência / TED',
      'Cartão de Débito',
      'Cartão de Crédito',
      'Débito Automático',
      'Cheque',
    ]
    for (const m of metodosPagamento || []) {
      if (m && !base.includes(m)) base.push(m)
    }
    return base
  }, [metodosPagamento])

  useEffect(() => {
    if (!open) return
    setFormError('')
    if (editingItem) {
      setCodigoLcto(editingItem.codigoLcto)
      setDataLcto(editingItem.dataLcto || hojeISO)
      setTipoOperacao(editingItem.tipoOperacao)
      setFornecedorId(editingItem.fornecedorId || '1')
      setFornecedorNome(editingItem.fornecedorNome || 'Diversos')
      setDescricao(editingItem.descricao || '')
      setValorStr(String(editingItem.valorLiquido ?? editingItem.valor ?? ''))
      const matched =
        todosPlanos.find(
          (p) =>
            p.id === editingItem.contaPlanoId ||
            p.label === editingItem.contaPlanoLabel ||
            p.codigo === editingItem.contaPlanoCodigo
        ) || null
      setContaPlanoId(matched?.id || editingItem.contaPlanoId || '')
      setContaPlanoLabel(matched?.label || editingItem.contaPlanoLabel || '')
      setCentroCusto(
        editingItem.centroCusto && centrosOptions.includes(editingItem.centroCusto)
          ? editingItem.centroCusto
          : ''
      )
      setTipoDocumento(
        editingItem.tipoDocumento && tiposDoctoOptions.includes(editingItem.tipoDocumento)
          ? editingItem.tipoDocumento
          : ''
      )
      setNumeroDocumento(editingItem.numeroDocumento || '')
      setEmissaoDocto(editingItem.emissaoDocto || editingItem.dataLcto || hojeISO)
      setCompensadoBanco(editingItem.compensadoBanco || 'Sim')
      setTipoRecurso(editingItem.tipoRecurso || 'PIX')
      setObservacao(editingItem.observacao || '')
      setDescontoStr(String(editingItem.desconto || 0))
      setJurosStr(String(editingItem.juros || 0))
      setMultaStr(String(editingItem.multa || 0))
      setComposicaoItens(editingItem.composicaoPagamento || [])
      setRateioItens(editingItem.rateio || [])
      setShowComposicao(
        Boolean(
          (editingItem.composicaoPagamento && editingItem.composicaoPagamento.length > 0) ||
            editingItem.desconto > 0 ||
            editingItem.juros > 0 ||
            editingItem.multa > 0
        )
      )
    } else {
      const initTipo = prefillData?.tipoOperacao || 'Pagamento'
      setCodigoLcto(0)
      setDataLcto(hojeISO)
      setTipoOperacao(initTipo)
      setFornecedorId('1')
      setFornecedorNome('Diversos')
      setDescricao(prefillData?.descricao || '')
      setValorStr(prefillData?.valor && prefillData.valor > 0 ? prefillData.valor.toFixed(2) : '')
      setContaPlanoId('')
      setContaPlanoLabel('')
      setCentroCusto('')
      setTipoDocumento('')
      setNumeroDocumento('')
      setEmissaoDocto(hojeISO)
      setCompensadoBanco('Sim')
      setTipoRecurso('PIX')
      setObservacao('')
      setDescontoStr('0')
      setJurosStr('0')
      setMultaStr('0')
      setComposicaoItens([])
      setRateioItens([])
      setShowComposicao(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingItem, prefillData, hojeISO])

  if (!open) return null

  const valorBruto = Math.max(0, Number(String(valorStr).replace(',', '.')) || 0)
  const descontoNum = Math.max(0, Number(String(descontoStr).replace(',', '.')) || 0)
  const jurosNum = Math.max(0, Number(String(jurosStr).replace(',', '.')) || 0)
  const multaNum = Math.max(0, Number(String(multaStr).replace(',', '.')) || 0)
  const valorLiquidoCalculado = Math.max(0, Math.round((valorBruto - descontoNum + jurosNum + multaNum) * 100) / 100)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!descricao.trim()) {
      setFormError('Informe a Descrição do Lançamento.')
      return
    }
    if (valorBruto <= 0) {
      setFormError('Informe um Valor Positivo (R$) maior que R$ 0,00.')
      return
    }
    if (!dataLcto) {
      setFormError('Informe a Data do Movimento.')
      return
    }
    if (!contaPlanoLabel.trim()) {
      setFormError('Selecione obrigatoriamente a Conta Plano (Plano de Contas).')
      return
    }
    setFormError('')

    await onSave({
      id: editingItem?.id,
      sourceId: editingItem?.sourceId,
      isAutomaticOrigin: editingItem?.isAutomaticOrigin || false,
      categoriaOrigem: editingItem?.categoriaOrigem || 'mov_receita',
      codigoLcto: codigoLcto > 0 ? codigoLcto : undefined,
      caixaId: selectedCaixa.id,
      caixaCodigo: selectedCaixa.codigo,
      caixaDescricao: selectedCaixa.descricao,
      dataLcto,
      emissaoDocto: emissaoDocto || dataLcto,
      tipoOperacao,
      tipoTransacao: editingItem?.tipoTransacao || 'Normal',
      fornecedorId,
      fornecedorNome,
      descricao: descricao.trim(),
      valor: valorBruto,
      desconto: descontoNum,
      juros: jurosNum,
      multa: multaNum,
      valorLiquido: valorLiquidoCalculado,
      contaPlanoId,
      contaPlanoLabel,
      centroCusto,
      rateio: rateioItens,
      tipoDocumento,
      numeroDocumento,
      tipoRecurso,
      composicaoPagamento: composicaoItens,
      compensadoBanco,
      observacao,
    })
  }

  const addComposicaoItem = () => {
    const somaAtual = composicaoItens.reduce((acc, i) => acc + (Number(i.valor) || 0), 0)
    const restante = Math.max(0, Math.round((valorLiquidoCalculado - somaAtual) * 100) / 100)
    setComposicaoItens((prev) => [
      ...prev,
      {
        id: `comp-${Date.now()}-${prev.length}`,
        tipoRecurso: prev.length === 0 ? tipoRecurso : 'Dinheiro',
        valor: restante,
        documentoRef: numeroDocumento || '',
        compensado: compensadoBanco === 'Sim',
      },
    ])
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="nova-movimentacao-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(15, 23, 42, 0.62)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 960,
          maxHeight: '92vh',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.4)',
          border: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Luxury Dark Header — Título 100% Branco */}
        <div
          style={{
            padding: '16px 24px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background:
                  tipoOperacao === 'Recebimento' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(244, 63, 94, 0.2)',
                border:
                  tipoOperacao === 'Recebimento'
                    ? '1px solid rgba(74, 222, 128, 0.45)'
                    : '1px solid rgba(251, 113, 133, 0.45)',
                color: tipoOperacao === 'Recebimento' ? '#4ade80' : '#fb7185',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {tipoOperacao === 'Recebimento' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2
                  id="nova-movimentacao-title"
                  style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 800,
                    color: '#ffffff',
                  }}
                >
                  {editingItem ? `Editar Lançamento — #${editingItem.codigoLcto}` : 'Novo Lançamento no Caixa'}
                </h2>
                {editingItem?.isAutomaticOrigin && (
                  <span
                    style={{
                      padding: '2px 9px',
                      borderRadius: 999,
                      fontSize: 10.5,
                      fontWeight: 700,
                      background: 'rgba(251, 191, 36, 0.2)',
                      color: '#fde68a',
                      border: '1px solid rgba(251, 191, 36, 0.4)',
                    }}
                  >
                    Vínculo Automático ({editingItem.categoriaOrigem === 'compromisso' ? 'Contas a Pagar' : 'Contas a Receber'})
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#cbd5e1', marginTop: 2 }}>
                Caixa {selectedCaixa.codigo} - {selectedCaixa.descricao} • Saldo Disponível:{' '}
                <strong style={{ color: '#ffffff' }}>{formatCurrencyBRL(saldoAtualCaixa)}</strong> ({totalRegistrosCaixa}{' '}
                registros)
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSubmit}
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {formError && (
            <div
              role="alert"
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#dc2626',
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              ⚠ {formError}
            </div>
          )}

          {/* Seletor Visual de Natureza: Saída (Pagamento) vs Entrada (Recebimento) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              disabled={Boolean(editingItem?.isAutomaticOrigin)}
              onClick={() => {
                setTipoOperacao('Pagamento')
                const currentObj = todosPlanos.find(
                  (p) => p.id === contaPlanoId || p.label === contaPlanoLabel
                )
                if (currentObj && currentObj.grupoConta === 'receitas') {
                  setContaPlanoId('')
                  setContaPlanoLabel('')
                }
              }}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: tipoOperacao === 'Pagamento' ? '2px solid #e11d48' : '1px solid #cbd5e1',
                background: tipoOperacao === 'Pagamento' ? '#fff1f2' : '#f8fafc',
                color: tipoOperacao === 'Pagamento' ? '#be123c' : '#475569',
                fontSize: 13,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: editingItem?.isAutomaticOrigin ? 'not-allowed' : 'pointer',
              }}
            >
              <ArrowUpRight size={16} />
              <span>Saída / Pagamento (Despesa ou Sangria)</span>
            </button>

            <button
              type="button"
              disabled={Boolean(editingItem?.isAutomaticOrigin)}
              onClick={() => {
                setTipoOperacao('Recebimento')
                const currentObj = todosPlanos.find(
                  (p) => p.id === contaPlanoId || p.label === contaPlanoLabel
                )
                if (currentObj && currentObj.grupoConta !== 'receitas') {
                  setContaPlanoId('')
                  setContaPlanoLabel('')
                }
              }}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: tipoOperacao === 'Recebimento' ? '2px solid #10b981' : '1px solid #cbd5e1',
                background: tipoOperacao === 'Recebimento' ? '#ecfdf5' : '#f8fafc',
                color: tipoOperacao === 'Recebimento' ? '#047857' : '#475569',
                fontSize: 13,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: editingItem?.isAutomaticOrigin ? 'not-allowed' : 'pointer',
              }}
            >
              <ArrowDownLeft size={16} />
              <span>Entrada / Recebimento (Receita ou Suprimento)</span>
            </button>
          </div>

          {/* Row 1: Descrição + Valor + Data Lcto */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 190px 160px', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Descrição do Lançamento *
              </label>
              <input
                type="text"
                required
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Ex: Pagamento de serviço de manutenção, Suprimento de troco..."
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid #94a3b8',
                  background: '#ffffff',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Valor Positivo (R$) *
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                disabled={Boolean(editingItem?.isAutomaticOrigin)}
                value={formatCurrencyInput(valorStr)}
                onChange={(e) => setValorStr(handleCurrencyInputChange(e.target.value))}
                placeholder="R$ 0,00"
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid #94a3b8',
                  background: editingItem?.isAutomaticOrigin ? '#f1f5f9' : '#ffffff',
                  fontSize: 14.5,
                  fontWeight: 800,
                  color: '#0f172a',
                  textAlign: 'right',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Data Movimento *
              </label>
              <input
                type="date"
                required
                value={dataLcto}
                onChange={(e) => setDataLcto(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              />
            </div>
          </div>

          {/* Row 2: Favorecido/Fornecedor + Plano de Contas + Centro de Custo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Fornecedor / Favorecido
              </label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  value={`${fornecedorId}|||${fornecedorNome}`}
                  onChange={(e) => {
                    const [idPart, namePart] = e.target.value.split('|||')
                    setFornecedorId(idPart || '1')
                    setFornecedorNome(namePart || 'Diversos')
                  }}
                  style={{
                    flex: 1,
                    height: 38,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#0f172a',
                    minWidth: 0,
                  }}
                >
                  <option value="1|||Diversos">1 - Diversos / Avulso</option>
                  {fornecedores.map((f, idx) => (
                    <option key={f.id} value={`${idx + 2}|||${f.nomeFantasia || f.nome}`}>
                      {idx + 2} - {f.nomeFantasia || f.nome}
                    </option>
                  ))}
                  {fornecedorNome !== 'Diversos' &&
                    !fornecedores.some((f) => (f.nomeFantasia || f.nome) === fornecedorNome) && (
                      <option value={`${fornecedorId}|||${fornecedorNome}`}>{fornecedorNome}</option>
                    )}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch('')
                    setPickerOpen('fornecedor')
                  }}
                  title="Pesquisar ou digitar favorecido"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Search size={15} />
                </button>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  Conta Plano ({tipoOperacao === 'Recebimento' ? 'Receitas' : 'Despesas'}) *
                </label>
                <Link
                  href="/configuracoes/financeiro/plano-contas"
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: '#0284c7',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  title="Gerenciar Plano de Contas em Configurações Financeiras"
                >
                  <span>Config. Plano</span>
                  <ExternalLink size={10} />
                </Link>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  required
                  value={contaPlanoLabel}
                  onChange={(e) => {
                    const val = e.target.value
                    setContaPlanoLabel(val)
                    const found = todosPlanos.find((p) => p.label === val)
                    setContaPlanoId(found?.id || (val ? val.split(' • ')[0] || val : ''))
                    if (formError) setFormError('')
                  }}
                  style={{
                    flex: 1,
                    height: 38,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: contaPlanoLabel ? '#0f172a' : '#64748b',
                    minWidth: 0,
                  }}
                >
                  <option value="">
                    {planosOptions.length === 0
                      ? 'Nenhuma conta cadastrada em Plano de Contas'
                      : 'Selecione a conta do plano...'}
                  </option>
                  {planosOptions.map((p) => (
                    <option key={p.id} value={p.label}>
                      {p.label} {p.tipo === 'sintetico' ? '(Sintético)' : ''}
                    </option>
                  ))}
                  {!planosOptions.some((p) => p.label === contaPlanoLabel) && contaPlanoLabel && (
                    <option value={contaPlanoLabel}>{contaPlanoLabel}</option>
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setPickerSearch('')
                    setPickerGrupoFiltro(tipoOperacao === 'Recebimento' ? 'receitas' : 'despesas')
                    setPickerOpen('contaPlano')
                  }}
                  title="Buscar no Plano de Contas (/configuracoes/financeiro/plano-contas)"
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <Search size={15} />
                </button>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  Centro de Custo
                </label>
                <Link
                  href="/configuracoes/financeiro/centro-custo"
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: '#0284c7',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  title="Gerenciar Centros de Custo em Configurações Financeiras"
                >
                  <span>Config. Centro</span>
                  <ExternalLink size={10} />
                </Link>
              </div>
              <select
                value={centroCusto}
                onChange={(e) => setCentroCusto(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#0f172a',
                }}
              >
                <option value="">
                  {centrosOptions.length === 0
                    ? 'Nenhum centro cadastrado (/configuracoes/financeiro/centro-custo)'
                    : 'Sem centro de custo'}
                </option>
                {centrosOptions.map((cc) => (
                  <option key={cc} value={cc}>
                    {cc}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Forma Pagto/Recurso + Tipo Documento + Nº Docto + Emissão + Conciliado */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.1fr 1fr 130px 145px 155px',
              gap: 12,
              alignItems: 'end',
            }}
          >
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Forma Pagto / Recurso
              </label>
              <select
                value={tipoRecurso}
                onChange={(e) => setTipoRecurso(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                {recursosOptions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                  Tipo de Documento
                </label>
                <Link
                  href="/configuracoes/financeiro/tipo-documentos"
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: '#0284c7',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                  title="Gerenciar Tipos de Documentos em Configurações Financeiras"
                >
                  <span>Config. Docto</span>
                  <ExternalLink size={10} />
                </Link>
              </div>
              <select
                value={tipoDocumento}
                onChange={(e) => setTipoDocumento(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 12.5,
                  color: tipoDocumento ? '#0f172a' : '#64748b',
                }}
              >
                <option value="">
                  {tiposDoctoOptions.length === 0
                    ? 'Nenhum tipo cadastrado (/configuracoes/financeiro/tipo-documentos)'
                    : 'Sem documento / Selecione...'}
                </option>
                {tiposDoctoOptions.map((td) => (
                  <option key={td} value={td}>
                    {td}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Nº Documento
              </label>
              <input
                type="text"
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                placeholder="Ex: NF-6447"
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 12.5,
                  color: '#0f172a',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Emissão Docto
              </label>
              <input
                type="date"
                value={emissaoDocto}
                onChange={(e) => setEmissaoDocto(e.target.value)}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 12.5,
                  color: '#0f172a',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
                Compensado Banco
              </label>
              <select
                value={compensadoBanco}
                onChange={(e) => setCompensadoBanco(e.target.value as 'Sim' | 'Não')}
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 10px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: compensadoBanco === 'Sim' ? '#ecfdf5' : '#fffbeb',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: compensadoBanco === 'Sim' ? '#047857' : '#b45309',
                }}
              >
                <option value="Sim">Sim (Conciliado)</option>
                <option value="Não">Não (Em Trânsito)</option>
              </select>
            </div>
          </div>

          {/* Observação */}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: 4 }}>
              Observações / Histórico Complementar
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Informações adicionais, chave PIX, autenticação bancária ou justificativa..."
              style={{
                width: '100%',
                height: 38,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: 12.5,
                color: '#0f172a',
              }}
            />
          </div>

          {/* Composição do Pagamento (Opcional) */}
          <div
            style={{
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setShowComposicao((v) => !v)}
              style={{
                width: '100%',
                padding: '10px 16px',
                border: 'none',
                background: '#f1f5f9',
                color: '#0284c7',
                fontSize: 13,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {showComposicao ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <span>Composição do Pagamento, Descontos/Encargos e Pagamento Misto (Opcional)</span>
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                Valor Líquido: <strong>{formatCurrencyBRL(valorLiquidoCalculado)}</strong>
              </span>
            </button>

            {showComposicao && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 12,
                    paddingBottom: 12,
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Desconto (-) R$
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatCurrencyInput(descontoStr, false)}
                      onChange={(e) => setDescontoStr(handleCurrencyInputChange(e.target.value, false))}
                      style={{
                        width: '100%',
                        height: 34,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: 12.5,
                        textAlign: 'right',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Juros (+) R$
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatCurrencyInput(jurosStr, false)}
                      onChange={(e) => setJurosStr(handleCurrencyInputChange(e.target.value, false))}
                      style={{
                        width: '100%',
                        height: 34,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: 12.5,
                        textAlign: 'right',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                      Multa (+) R$
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={formatCurrencyInput(multaStr, false)}
                      onChange={(e) => setMultaStr(handleCurrencyInputChange(e.target.value, false))}
                      style={{
                        width: '100%',
                        height: 34,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: 12.5,
                        textAlign: 'right',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#0284c7', marginBottom: 4 }}>
                      Valor Líquido Final
                    </label>
                    <div
                      style={{
                        height: 34,
                        padding: '0 12px',
                        borderRadius: 6,
                        border: '1px solid #bae6fd',
                        background: '#f0f9ff',
                        color: '#0369a1',
                        fontSize: 13.5,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                      }}
                    >
                      {formatCurrencyBRL(valorLiquidoCalculado)}
                    </div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                      Múltiplas Formas de Pagamento (Ex: Parte em Dinheiro + Parte em PIX)
                    </span>
                    <button
                      type="button"
                      onClick={addComposicaoItem}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 6,
                        border: '1px solid #0284c7',
                        background: '#ffffff',
                        color: '#0284c7',
                        fontSize: 11.5,
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={13} />
                      <span>Adicionar Meio de Pagamento</span>
                    </button>
                  </div>

                  {composicaoItens.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 160px 1fr auto',
                        gap: 8,
                        alignItems: 'center',
                        marginTop: 6,
                      }}
                    >
                      <select
                        value={item.tipoRecurso}
                        onChange={(e) => {
                          const val = e.target.value
                          setComposicaoItens((prev) => prev.map((x, i) => (i === idx ? { ...x, tipoRecurso: val } : x)))
                        }}
                        style={{
                          height: 32,
                          padding: '0 8px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: 12,
                        }}
                      >
                        {recursosOptions.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        inputMode="numeric"
                        value={formatCurrencyInput(item.valor, false)}
                        onChange={(e) => {
                          const v = parseCurrencyNumeric(handleCurrencyInputChange(e.target.value, false))
                          setComposicaoItens((prev) => prev.map((x, i) => (i === idx ? { ...x, valor: v } : x)))
                        }}
                        placeholder="R$ 0,00"
                        style={{
                          height: 32,
                          padding: '0 8px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: 12,
                          textAlign: 'right',
                        }}
                      />

                      <input
                        type="text"
                        value={item.documentoRef || ''}
                        onChange={(e) => {
                          const v = e.target.value
                          setComposicaoItens((prev) => prev.map((x, i) => (i === idx ? { ...x, documentoRef: v } : x)))
                        }}
                        placeholder="Nº Cheque / NSU / Autenticação..."
                        style={{
                          height: 32,
                          padding: '0 8px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: 12,
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => setComposicaoItens((prev) => prev.filter((_, i) => i !== idx))}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          border: '1px solid #fecaca',
                          background: '#fef2f2',
                          color: '#dc2626',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              paddingTop: 12,
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 10,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                height: 38,
                padding: '0 18px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                height: 38,
                padding: '0 22px',
                borderRadius: 8,
                border: 'none',
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.22)',
              }}
            >
              <Check size={16} />
              <span>{saving ? 'Gravando...' : 'Gravar Lançamento no Caixa'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Sub-modal de Pesquisa */}
      {pickerOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 560,
              maxHeight: '78vh',
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #cbd5e1',
              boxShadow: '0 20px 50px rgba(15, 23, 42, 0.35)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '14px 18px',
                background: '#0f172a',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff' }}>
                {pickerOpen === 'fornecedor'
                  ? 'Pesquisar ou Informar Fornecedor / Favorecido'
                  : 'Selecionar Conta do Plano de Contas (Config. Financeiro)'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {pickerOpen === 'contaPlano' && (
                  <Link
                    href="/configuracoes/financeiro/plano-contas"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: '#38bdf8',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <span>Gerenciar Plano</span>
                    <ExternalLink size={12} />
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setPickerOpen(null)}
                  style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="text"
                autoFocus
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder={
                  pickerOpen === 'contaPlano'
                    ? 'Buscar por código (ex: 00.01, 01.01) ou descrição da conta...'
                    : 'Digite para filtrar ou adicionar favorecido...'
                }
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                }}
              />
              {pickerOpen === 'contaPlano' && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(
                    [
                      {
                        id: 'despesas',
                        label: `📉 Despesas (${todosPlanos.filter((p) => p.grupoConta === 'despesas').length})`,
                      },
                      {
                        id: 'receitas',
                        label: `📈 Receitas (${todosPlanos.filter((p) => p.grupoConta === 'receitas').length})`,
                      },
                      {
                        id: 'investimentos',
                        label: `🪙 Investimentos (${todosPlanos.filter((p) => p.grupoConta === 'investimentos').length})`,
                      },
                      { id: 'todos', label: `Todas (${todosPlanos.length})` },
                    ] as const
                  ).map((tab) => {
                    const active = pickerGrupoFiltro === tab.id
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setPickerGrupoFiltro(tab.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: active ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          background: active ? '#eff6ff' : '#f8fafc',
                          color: active ? '#1d4ed8' : '#475569',
                          fontSize: 11.5,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {tab.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div style={{ padding: 12, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {pickerOpen === 'fornecedor' && (
                <>
                  {pickerSearch.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setFornecedorId('AVULSO')
                        setFornecedorNome(pickerSearch.trim())
                        setPickerOpen(null)
                      }}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 8,
                        border: '1px dashed #0284c7',
                        background: '#f0f9ff',
                        color: '#0369a1',
                        fontSize: 12.5,
                        fontWeight: 700,
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      + Usar favorecido personalizado: &ldquo;{pickerSearch.trim()}&rdquo;
                    </button>
                  )}
                  {[
                    { id: '1', nome: 'Diversos', doc: '' },
                    ...fornecedores.map((f, i) => ({
                      id: String(i + 2),
                      nome: f.nomeFantasia || f.nome,
                      doc: f.documento,
                    })),
                  ]
                    .filter((x) => !pickerSearch || normalizeText(x.nome).includes(normalizeText(pickerSearch)))
                    .map((item) => (
                      <button
                        key={item.id + item.nome}
                        type="button"
                        onClick={() => {
                          setFornecedorId(item.id)
                          setFornecedorNome(item.nome)
                          setPickerOpen(null)
                        }}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: '#0f172a',
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                        }}
                      >
                        <span>
                          {item.id} - {item.nome}
                        </span>
                        {item.doc && <span style={{ color: '#64748b', fontSize: 11 }}>{item.doc}</span>}
                      </button>
                    ))}
                </>
              )}

              {pickerOpen === 'contaPlano' && (
                <>
                  {todosPlanos
                    .filter((p) => {
                      if (pickerGrupoFiltro !== 'todos' && p.grupoConta !== pickerGrupoFiltro) return false
                      if (!pickerSearch) return true
                      return (
                        normalizeText(p.label).includes(normalizeText(pickerSearch)) ||
                        normalizeText(p.codigo).includes(normalizeText(pickerSearch))
                      )
                    })
                    .map((p) => {
                      const depth = p.codigo ? Math.max(0, p.codigo.split('.').length - 1) : 0
                      const isRec = p.grupoConta === 'receitas'
                      const isInv = p.grupoConta === 'investimentos'
                      const tipoLabel =
                        p.tipo === 'sintetico' ? 'Sintético' : p.tipo === 'detalhe' ? 'Detalhe' : 'Analítico'
                      const isSelected = contaPlanoId === p.id || contaPlanoLabel === p.label
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setContaPlanoId(p.id)
                            setContaPlanoLabel(p.label)
                            setPickerOpen(null)
                          }}
                          style={{
                            padding: '9px 12px',
                            paddingLeft: 12 + depth * 14,
                            borderRadius: 8,
                            border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            fontSize: 12.5,
                            fontWeight: p.tipo === 'sintetico' ? 800 : 600,
                            color: '#0f172a',
                            textAlign: 'left',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            {p.codigo && (
                              <code
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 800,
                                  padding: '2px 6px',
                                  borderRadius: 5,
                                  background: isRec ? '#dcfce7' : isInv ? '#dbeafe' : '#fee2e2',
                                  color: isRec ? '#166534' : isInv ? '#1d4ed8' : '#991b1b',
                                  flexShrink: 0,
                                }}
                              >
                                {p.codigo}
                              </code>
                            )}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.descricao}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 5,
                                background: p.tipo === 'sintetico' ? '#f3e8ff' : '#e0f2fe',
                                color: p.tipo === 'sintetico' ? '#7e22ce' : '#0369a1',
                              }}
                            >
                              {tipoLabel}
                            </span>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '2px 7px',
                                borderRadius: 999,
                                background: isRec ? '#dcfce7' : isInv ? '#dbeafe' : '#fee2e2',
                                color: isRec ? '#166534' : isInv ? '#1d4ed8' : '#991b1b',
                              }}
                            >
                              {isRec ? 'Receita' : isInv ? 'Investimento' : 'Despesa'}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  {todosPlanos.filter((p) => {
                    if (pickerGrupoFiltro !== 'todos' && p.grupoConta !== pickerGrupoFiltro) return false
                    if (!pickerSearch) return true
                    return (
                      normalizeText(p.label).includes(normalizeText(pickerSearch)) ||
                      normalizeText(p.codigo).includes(normalizeText(pickerSearch))
                    )
                  }).length === 0 && (
                    <div
                      style={{
                        padding: 20,
                        textAlign: 'center',
                        color: '#64748b',
                        fontSize: 12.5,
                      }}
                    >
                      Nenhuma conta encontrada neste filtro.{' '}
                      <Link
                        href="/configuracoes/financeiro/plano-contas"
                        style={{ color: '#0284c7', fontWeight: 700 }}
                      >
                        Abrir Plano de Contas
                      </Link>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
