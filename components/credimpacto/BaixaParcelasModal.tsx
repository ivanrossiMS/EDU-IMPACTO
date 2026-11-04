'use client'

import React, { useState, useMemo, useRef } from 'react'
import { CredImpactoEmprestimo, CredImpactoParcela } from '@/types/credimpacto'
import { formatBrl as formatCurrency } from '@/lib/credimpacto/engine'
import {
  CheckCircle2,
  X,
  Upload,
  FileCheck,
  Loader2,
  AlertTriangle,
  RotateCcw,
  Calendar,
  CreditCard,
  Sparkles,
  Layers,
  BadgeDollarSign,
  Percent
} from 'lucide-react'
import { toast } from 'sonner'

export interface ParcelaComContexto extends CredImpactoParcela {
  colaboradorNome?: string
  colaboradorCpf?: string
  codigoOperacao?: string
  quantidadeParcelas?: number
}

interface BaixaParcelasModalProps {
  parcelasInicial: ParcelaComContexto[]
  todasParcelasContexto?: ParcelaComContexto[]
  tituloContexto?: string
  onClose: () => void
  onSuccess: (updatedLoans?: CredImpactoEmprestimo[]) => void
}

export function BaixaParcelasModal({
  parcelasInicial,
  todasParcelasContexto,
  tituloContexto,
  onClose,
  onSuccess
}: BaixaParcelasModalProps) {
  // Lista completa de parcelas pendentes disponíveis no contexto (ou as iniciais se não houver contexto extra)
  const universoPendentes = useMemo(() => {
    const base =
      todasParcelasContexto && todasParcelasContexto.length > 0
        ? todasParcelasContexto
        : parcelasInicial
    const seen = new Set<string>()
    const list: ParcelaComContexto[] = []
    for (const p of base) {
      if (p.status === 'descontada' || p.status === 'paga_avulso' || p.status === 'cancelada') {
        continue
      }
      if (!seen.has(p.id)) {
        seen.add(p.id)
        list.push(p)
      }
    }
    // Se alguma parcela inicial não estava no universo, garante sua inclusão
    for (const p of parcelasInicial) {
      if (
        p.status !== 'descontada' &&
        p.status !== 'paga_avulso' &&
        p.status !== 'cancelada' &&
        !seen.has(p.id)
      ) {
        seen.add(p.id)
        list.push(p)
      }
    }
    return list.sort((a, b) => {
      const cmp = (a.dataVencimento || '').localeCompare(b.dataVencimento || '')
      if (cmp !== 0) return cmp
      return (a.numero || 0) - (b.numero || 0)
    })
  }, [parcelasInicial, todasParcelasContexto])

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const initIds = parcelasInicial
      .filter((p) => p.status !== 'descontada' && p.status !== 'paga_avulso' && p.status !== 'cancelada')
      .map((p) => p.id)
    return initIds.length > 0 ? initIds : universoPendentes.map((p) => p.id)
  })

  const [showSelectorList, setShowSelectorList] = useState<boolean>(
    () => parcelasInicial.length > 1 || (universoPendentes.length > 1 && parcelasInicial.length === universoPendentes.length)
  )

  const [modoValor, setModoValor] = useState<'integral' | 'sem_juros' | 'personalizado'>('integral')
  const [valorPersonalizado, setValorPersonalizado] = useState<string>('')
  const [metodoPagamento, setMetodoPagamento] = useState<
    'folha_pagamento' | 'pix' | 'transferencia' | 'dinheiro'
  >('folha_pagamento')
  const [dataPagamento, setDataPagamento] = useState<string>(
    () => new Date().toISOString().split('T')[0]
  )
  const [comprovanteUrl, setComprovanteUrl] = useState<string>('')
  const [observacao, setObservacao] = useState<string>('')
  const [uploadingFile, setUploadingFile] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parcelasSelecionadas = useMemo(() => {
    const set = new Set(selectedIds)
    return universoPendentes.filter((p) => set.has(p.id))
  }, [universoPendentes, selectedIds])

  const resumo = useMemo(() => {
    const qtd = parcelasSelecionadas.length
    const amortizacao = parcelasSelecionadas.reduce((acc, p) => acc + (p.valorAmortizacao || 0), 0)
    const juros = parcelasSelecionadas.reduce((acc, p) => acc + (p.valorJuros || 0), 0)
    const totalIntegral = parcelasSelecionadas.reduce((acc, p) => acc + (p.valorTotal || 0), 0)

    let valorFinal = totalIntegral
    if (modoValor === 'sem_juros') {
      valorFinal = amortizacao
    } else if (modoValor === 'personalizado') {
      const parsed = Number(valorPersonalizado)
      if (!Number.isNaN(parsed) && parsed > 0) {
        valorFinal = parsed
      }
    }

    const ContratosSet = new Set(
      parcelasSelecionadas.map((p) => p.codigoOperacao || p.emprestimoId).filter(Boolean)
    )
    const ColaboradoresSet = new Set(
      parcelasSelecionadas.map((p) => p.colaboradorNome || p.colaboradorCpf).filter(Boolean)
    )

    const vaiQuitarTodasContexto =
      universoPendentes.length > 0 &&
      qtd === universoPendentes.length &&
      ContratosSet.size === 1

    return {
      qtd,
      amortizacao: Math.round(amortizacao * 100) / 100,
      juros: Math.round(juros * 100) / 100,
      totalIntegral: Math.round(totalIntegral * 100) / 100,
      valorFinal: Math.round(valorFinal * 100) / 100,
      economiaJuros: Math.max(0, Math.round((totalIntegral - valorFinal) * 100) / 100),
      contratosCount: ContratosSet.size,
      colaboradoresCount: ColaboradoresSet.size,
      vaiQuitarTodasContexto
    }
  }, [parcelasSelecionadas, modoValor, valorPersonalizado, universoPendentes.length])

  const toggleParcela = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const selecionarTodas = () => {
    setSelectedIds(universoPendentes.map((p) => p.id))
  }

  const selecionarApenasIniciais = () => {
    setSelectedIds(parcelasInicial.map((p) => p.id))
  }

  const selecionarAteCompetenciaAtual = () => {
    const mesAtual = new Date().toISOString().slice(0, 7)
    const vencidasOuMes = universoPendentes
      .filter((p) => (p.competencia || '') <= mesAtual || p.status === 'atrasada')
      .map((p) => p.id)
    if (vencidasOuMes.length > 0) {
      setSelectedIds(vencidasOuMes)
    } else {
      toast.info('Nenhuma parcela com competência até o mês atual; mantendo seleção.')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const firstLoanId = parcelasSelecionadas[0]?.emprestimoId || parcelasInicial[0]?.emprestimoId || 'baixa_parcela'
      formData.append('emprestimoId', firstLoanId)

      const res = await fetch('/api/credimpacto/comprovante', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha no upload do comprovante')

      setComprovanteUrl(data.url)
      toast.success('Comprovante anexado com sucesso!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar comprovante')
    } finally {
      setUploadingFile(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleConfirmarBaixa = async () => {
    if (parcelasSelecionadas.length === 0) {
      toast.error('Selecione pelo menos uma parcela para dar baixa.')
      return
    }

    if (modoValor === 'personalizado') {
      const num = Number(valorPersonalizado)
      if (Number.isNaN(num) || num <= 0) {
        toast.error('Informe um valor personalizado válido maior que zero.')
        return
      }
    }

    setSubmitting(true)
    try {
      const payload: Record<string, any> = {
        parcelaIds: parcelasSelecionadas.map((p) => p.id),
        modoValor,
        valorPago: resumo.valorFinal,
        metodoPagamento,
        dataPagamento,
        comprovanteUrl: comprovanteUrl.trim() || undefined,
        observacao:
          observacao.trim() ||
          (parcelasSelecionadas.length > 1
            ? `Baixa de ${parcelasSelecionadas.length} parcelas (${
                modoValor === 'sem_juros' ? 'Com dispensa de juros' : 'Valor integral'
              })`
            : undefined),
        loteFolhaId:
          parcelasSelecionadas.length > 1
            ? `BAIXA-LOTE-${new Date().toISOString().slice(0, 10)}`
            : undefined
      }

      if (parcelasSelecionadas.length === 1) {
        payload.parcelaId = parcelasSelecionadas[0].id
      }

      const res = await fetch('/api/credimpacto/folha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao dar baixa nas parcelas')

      const qtdProcessadas = data.processadas || parcelasSelecionadas.length
      if (qtdProcessadas === 1) {
        const p = parcelasSelecionadas[0]
        toast.success(
          `Parcela #${p.numero} (${p.competencia}) baixada com sucesso!`
        )
      } else {
        toast.success(
          `${qtdProcessadas} parcelas baixadas com sucesso (${formatCurrency(resumo.valorFinal)})!`
        )
      }

      onSuccess(data.emprestimosAtualizados || (data.emprestimo ? [data.emprestimo] : undefined))
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar baixa')
    } finally {
      setSubmitting(false)
    }
  }

  const unicaParcela = parcelasSelecionadas.length === 1 ? parcelasSelecionadas[0] : null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-900 text-white flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-black tracking-tight">
                  {resumo.qtd <= 1
                    ? 'Dar Baixa em Parcela'
                    : resumo.qtd === universoPendentes.length && universoPendentes.length > 1
                      ? `Baixar Todas as Parcelas (${resumo.qtd})`
                      : `Baixar ${resumo.qtd} Parcelas Selecionadas`}
                </h3>
                {resumo.vaiQuitarTodasContexto && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-200 border border-amber-300/30">
                    <Sparkles className="w-3 h-3" /> Quita o Contrato
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                {tituloContexto
                  ? tituloContexto
                  : unicaParcela
                    ? `${unicaParcela.codigoOperacao || 'Operação'} • ${unicaParcela.colaboradorNome || 'Colaborador'} • Parcela #${unicaParcela.numero} (${unicaParcela.competencia})`
                    : `${resumo.qtd} parcela(s) de ${resumo.colaboradoresCount || 1} colaborador(es) • ${resumo.contratosCount || 1} contrato(s)`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Quick Scope Bar when multiple pending installments exist in context */}
          {universoPendentes.length > 1 && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Escopo da Baixa ({resumo.qtd} de {universoPendentes.length} pendentes)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {parcelasInicial.length < universoPendentes.length && (
                    <button
                      type="button"
                      onClick={selecionarApenasIniciais}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                        selectedIds.length === parcelasInicial.length &&
                        parcelasInicial.every((p) => selectedIds.includes(p.id))
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Inicial ({parcelasInicial.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={selecionarAteCompetenciaAtual}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition"
                  >
                    Vencidas / Mês Atual
                  </button>
                  <button
                    type="button"
                    onClick={selecionarTodas}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                      selectedIds.length === universoPendentes.length
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    Baixar Todas ({universoPendentes.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSelectorList((prev) => !prev)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:text-slate-900 underline"
                  >
                    {showSelectorList ? 'Ocultar lista' : 'Escolher parcelas'}
                  </button>
                </div>
              </div>

              {showSelectorList && (
                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 bg-white rounded-xl border border-slate-200">
                  {universoPendentes.map((p) => {
                    const checked = selectedIds.includes(p.id)
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center justify-between gap-3 px-3.5 py-2 text-xs cursor-pointer transition ${
                          checked ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleParcela(p.id)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="font-black text-slate-800 shrink-0">
                            #{p.numero}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-slate-700 shrink-0">
                            {p.competencia}
                          </span>
                          <span className="text-slate-600 truncate">
                            {p.colaboradorNome
                              ? `${p.colaboradorNome} (${p.codigoOperacao || ''})`
                              : `Venc: ${new Date(p.dataVencimento + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {p.valorJuros > 0 && (
                            <span className="text-[11px] text-slate-400">
                              Amort: {formatCurrency(p.valorAmortizacao)}
                            </span>
                          )}
                          <span className="font-black text-slate-900">
                            {formatCurrency(p.valorTotal)}
                          </span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Resumo Financeiro das Parcelas Selecionadas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Parcelas
              </p>
              <p className="text-lg font-black text-slate-900 mt-0.5">
                {resumo.qtd}{' '}
                <span className="text-xs font-semibold text-slate-500">
                  {resumo.qtd === 1 ? 'parcela' : 'parcelas'}
                </span>
              </p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Principal (Amort.)
              </p>
              <p className="text-base font-extrabold text-slate-800 mt-0.5">
                {formatCurrency(resumo.amortizacao)}
              </p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/70">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Juros Embutidos
              </p>
              <p className="text-base font-extrabold text-slate-700 mt-0.5">
                {formatCurrency(resumo.juros)}
              </p>
            </div>
            <div className="bg-emerald-50 rounded-2xl p-3.5 border border-emerald-200">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">
                Total a Baixar
              </p>
              <p className="text-lg font-black text-emerald-700 mt-0.5">
                {formatCurrency(resumo.valorFinal)}
              </p>
            </div>
          </div>

          {/* Modo de Valor (Integral vs Sem Juros vs Personalizado) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Modalidade de Valor da Baixa
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setModoValor('integral')
                  setValorPersonalizado(String(resumo.totalIntegral))
                }}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  modoValor === 'integral'
                    ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800">Valor Integral</span>
                  <BadgeDollarSign
                    className={`w-4 h-4 ${
                      modoValor === 'integral' ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                </div>
                <p className="text-sm font-black text-slate-900 mt-1">
                  {formatCurrency(resumo.totalIntegral)}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Amortização + Juros normais
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModoValor('sem_juros')
                  setValorPersonalizado(String(resumo.amortizacao))
                }}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  modoValor === 'sem_juros'
                    ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800">Dispensar Juros</span>
                  <Percent
                    className={`w-4 h-4 ${
                      modoValor === 'sem_juros' ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                </div>
                <p className="text-sm font-black text-emerald-700 mt-1">
                  {formatCurrency(resumo.amortizacao)}
                </p>
                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                  {resumo.juros > 0
                    ? `Desconto de ${formatCurrency(resumo.juros)}`
                    : 'Sem juros nas parcelas'}
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setModoValor('personalizado')
                  if (!valorPersonalizado) {
                    setValorPersonalizado(String(resumo.totalIntegral))
                  }
                }}
                className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
                  modoValor === 'personalizado'
                    ? 'bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800">Valor Negociado</span>
                  <CreditCard
                    className={`w-4 h-4 ${
                      modoValor === 'personalizado' ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  />
                </div>
                <p className="text-sm font-black text-slate-900 mt-1">
                  {modoValor === 'personalizado' && valorPersonalizado
                    ? formatCurrency(Number(valorPersonalizado) || 0)
                    : 'Digitar valor'}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Informar valor pago manualmente
                </p>
              </button>
            </div>

            {modoValor === 'personalizado' && (
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Valor Efetivamente Pago (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={valorPersonalizado}
                  onChange={(e) => setValorPersonalizado(e.target.value)}
                  placeholder="Ex: 500.00"
                  className="w-full px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50/20 text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}
          </div>

          {/* Método de Pagamento + Data da Baixa */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Origem / Método do Recebimento
              </label>
              <select
                value={metodoPagamento}
                onChange={(e) => setMetodoPagamento(e.target.value as any)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="folha_pagamento">Desconto em Folha de Pagamento</option>
                <option value="pix">PIX Direto / Quitação Avulsa</option>
                <option value="transferencia">Transferência Bancária (TED/DOC)</option>
                <option value="dinheiro">Espécie / Caixa Tesouraria</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Data Efetiva do Pagamento
              </label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="date"
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Comprovante de Pagamento (Opcional) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Comprovante de Baixa / Recibo (Opcional)
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile}
                className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition shrink-0 ${
                  comprovanteUrl
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                    : 'border-dashed border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {uploadingFile ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                    Enviando...
                  </>
                ) : comprovanteUrl ? (
                  <>
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                    Trocar Arquivo
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-slate-500" />
                    Anexar PDF / Imagem
                  </>
                )}
              </button>
              <input
                type="url"
                value={comprovanteUrl}
                onChange={(e) => setComprovanteUrl(e.target.value)}
                placeholder="Ou cole o link do comprovante..."
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Observação + Atalhos Rápidos */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Observações de Auditoria (Opcional)
              </label>
              <div className="flex flex-wrap gap-1">
                {[
                  'Desconto em Folha Mensal',
                  'Pagamento Antecipado PIX',
                  'Quitação Integral de Saldo'
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setObservacao(chip)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-600 transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Baixa referente à folha mensal / comprovante PIX recebido..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <span className="font-bold text-slate-800">{resumo.qtd}</span> parcela(s) • Total:{' '}
            <span className="font-black text-emerald-700 text-sm">
              {formatCurrency(resumo.valorFinal)}
            </span>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-xs hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmarBaixa}
              disabled={submitting || resumo.qtd === 0 || uploadingFile}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando Baixa...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {resumo.qtd <= 1
                    ? `Confirmar Baixa (${formatCurrency(resumo.valorFinal)})`
                    : `Baixar ${resumo.qtd} Parcelas (${formatCurrency(resumo.valorFinal)})`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface EstornoParcelasModalProps {
  parcelas: ParcelaComContexto[]
  onClose: () => void
  onSuccess: (updatedLoans?: CredImpactoEmprestimo[]) => void
}

export function EstornoParcelasModal({
  parcelas,
  onClose,
  onSuccess
}: EstornoParcelasModalProps) {
  const [justificativa, setJustificativa] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const totalEstornado = useMemo(
    () =>
      parcelas.reduce(
        (acc, p) => acc + (p.valorPago !== undefined ? p.valorPago : p.valorTotal || 0),
        0
      ),
    [parcelas]
  )

  const handleConfirmarEstorno = async () => {
    if (!justificativa || justificativa.trim().length < 5) {
      toast.error('Informe uma justificativa com pelo menos 5 caracteres para auditoria.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/credimpacto/folha', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelaId: parcelas.length === 1 ? parcelas[0].id : undefined,
          parcelaIds: parcelas.map((p) => p.id),
          justificativa: justificativa.trim()
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao estornar baixa')

      toast.success(
        parcelas.length === 1
          ? `Baixa da parcela #${parcelas[0].numero} estornada com sucesso!`
          : `${parcelas.length} parcelas estornadas com sucesso!`
      )
      onSuccess(data.emprestimosAtualizados || (data.emprestimo ? [data.emprestimo] : undefined))
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao estornar parcela')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/65 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                {parcelas.length === 1
                  ? 'Estornar Baixa de Parcela'
                  : `Estornar ${parcelas.length} Parcelas Baixadas`}
              </h3>
              <p className="text-xs text-slate-500">
                Retorna o status para A Vencer e recompõe o saldo devedor
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 text-xs space-y-1.5">
          {parcelas.length === 1 ? (
            <>
              <p className="font-bold text-slate-800">
                {parcelas[0].colaboradorNome || 'Colaborador'} •{' '}
                {parcelas[0].codigoOperacao || 'Contrato'}
              </p>
              <p className="text-slate-600">
                Parcela <span className="font-bold">#{parcelas[0].numero}</span> (
                {parcelas[0].competencia}) • Valor baixado:{' '}
                <span className="font-black text-amber-900">
                  {formatCurrency(parcelas[0].valorPago ?? parcelas[0].valorTotal)}
                </span>
              </p>
            </>
          ) : (
            <p className="text-slate-700 font-semibold">
              Estornando <span className="font-black">{parcelas.length} parcelas</span> somando{' '}
              <span className="font-black text-amber-900">{formatCurrency(totalEstornado)}</span>.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Justificativa Obrigatória para Auditoria *
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {[
              'Baixa realizada em parcela incorreta',
              'Erro operacional no lançamento',
              'Ajuste de valor / renegociação'
            ].map((motivo) => (
              <button
                key={motivo}
                type="button"
                onClick={() => setJustificativa(motivo)}
                className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-600 transition"
              >
                {motivo}
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Descreva o motivo do estorno..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmarEstorno}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/20"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            Confirmar Estorno
          </button>
        </div>
      </div>
    </div>
  )
}
