'use client'

import React, { useState, useEffect } from 'react'
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Check,
  Search,
  Filter,
  Upload,
  Calendar,
  Layers,
  Banknote
} from 'lucide-react'
import { CredImpactoParcela } from '@/types/credimpacto'
import { formatBrl } from '@/lib/credimpacto/engine'
import { toast } from 'sonner'

interface ConciliacaoFolhaTabProps {
  onRefresh: () => void
}

interface ParcelaFolhaItem extends CredImpactoParcela {
  colaboradorNome: string
  colaboradorCpf: string
  colaboradorMatricula?: string
  codigoOperacao: string
}

export function ConciliacaoFolhaTab({ onRefresh }: ConciliacaoFolhaTabProps) {
  const hoje = new Date()
  const defaultComp = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  const [competencia, setCompetencia] = useState(defaultComp)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [isLoading, setIsLoading] = useState(true)
  const [folhaData, setFolhaData] = useState<{
    totalPrevisto: number
    totalDescontado: number
    totalPendente: number
    quantidadeParcelas: number
    quantidadePagas: number
    quantidadeColaboradores: number
    parcelas: ParcelaFolhaItem[]
  } | null>(null)

  // Modal de Baixa Individual
  const [individualModalParcela, setIndividualModalParcela] = useState<ParcelaFolhaItem | null>(null)
  const [baixaValor, setBaixaValor] = useState<number>(0)
  const [baixaMetodo, setBaixaMetodo] = useState<'folha_pagamento' | 'pix' | 'transferencia' | 'dinheiro'>('folha_pagamento')
  const [baixaData, setBaixaData] = useState(new Date().toISOString().split('T')[0])
  const [baixaComprovanteUrl, setBaixaComprovanteUrl] = useState('')
  const [baixaObservacao, setBaixaObservacao] = useState('')
  const [isSubmittingBaixa, setIsSubmittingBaixa] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Modal de Estorno de Baixa
  const [estornoModalParcela, setEstornoModalParcela] = useState<ParcelaFolhaItem | null>(null)
  const [estornoJustificativa, setEstornoJustificativa] = useState('')
  const [isSubmittingEstorno, setIsSubmittingEstorno] = useState(false)

  // Modal de Baixa em Lote
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [loteCodigo, setLoteCodigo] = useState(`FOLHA-${defaultComp}`)
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false)

  const fetchFolha = async () => {
    setIsLoading(true)
    try {
      const url = competencia ? `/api/credimpacto/folha?competencia=${competencia}` : '/api/credimpacto/folha'
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar dados da folha')
      setFolhaData(data)
    } catch (err: any) {
      toast.error(err.message || 'Falha ao buscar folha')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchFolha()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competencia])

  // Abertura do modal de baixa individual
  const handleOpenIndividualModal = (parcela: ParcelaFolhaItem) => {
    setIndividualModalParcela(parcela)
    setBaixaValor(parcela.valorTotal)
    setBaixaMetodo('folha_pagamento')
    setBaixaData(new Date().toISOString().split('T')[0])
    setBaixaComprovanteUrl('')
    setBaixaObservacao(`Desconto comprovado em contracheque ref. ${parcela.competencia}`)
  }

  const handleConfirmIndividualBaixa = async () => {
    if (!individualModalParcela) return
    setIsSubmittingBaixa(true)
    try {
      const res = await fetch('/api/credimpacto/folha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelaId: individualModalParcela.id,
          valorPago: baixaValor,
          metodoPagamento: baixaMetodo,
          dataPagamento: baixaData,
          comprovanteUrl: baixaComprovanteUrl,
          observacao: baixaObservacao
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao confirmar desconto')

      toast.success(`Desconto da parcela ${individualModalParcela.numero} confirmado com sucesso!`)
      setIndividualModalParcela(null)
      fetchFolha()
      onRefresh()
    } catch (err: any) {
      toast.error(err.message || 'Falha na confirmação do desconto')
    } finally {
      setIsSubmittingBaixa(false)
    }
  }

  // Abertura do modal de estorno
  const handleOpenEstornoModal = (parcela: ParcelaFolhaItem) => {
    setEstornoModalParcela(parcela)
    setEstornoJustificativa('')
  }

  const handleConfirmEstorno = async () => {
    if (!estornoModalParcela) return
    if (!estornoJustificativa.trim() || estornoJustificativa.trim().length < 5) {
      toast.error('Informe uma justificativa de pelo menos 5 caracteres para o estorno.')
      return
    }

    setIsSubmittingEstorno(true)
    try {
      const res = await fetch('/api/credimpacto/folha', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelaId: estornoModalParcela.id,
          justificativa: estornoJustificativa
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao estornar parcela')

      toast.success(`Baixa da parcela ${estornoModalParcela.numero} estornada. Saldo devedor restaurado.`)
      setEstornoModalParcela(null)
      fetchFolha()
      onRefresh()
    } catch (err: any) {
      toast.error(err.message || 'Falha no estorno')
    } finally {
      setIsSubmittingEstorno(false)
    }
  }

  // Confirmação de baixa em lote
  const handleConfirmBatchBaixa = async () => {
    const pendentes = (folhaData?.parcelas || []).filter(
      (p) => p.status === 'prevista' || p.status === 'exportada_folha'
    )
    if (pendentes.length === 0) {
      toast.error('Não existem parcelas pendentes para baixa nesta competência.')
      return
    }

    setIsSubmittingBatch(true)
    try {
      const res = await fetch('/api/credimpacto/folha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parcelaIds: pendentes.map((p) => p.id),
          metodoPagamento: 'folha_pagamento',
          loteFolhaId: loteCodigo,
          observacao: `Conciliação em lote da folha de pagamento - Lote ${loteCodigo}`
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao processar baixa em lote')

      toast.success(`${data.processadas} parcelas conciliadas em lote com sucesso!`)
      setShowBatchModal(false)
      fetchFolha()
      onRefresh()
    } catch (err: any) {
      toast.error(err.message || 'Falha na baixa em lote')
    } finally {
      setIsSubmittingBatch(false)
    }
  }

  // Upload de comprovante
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('pasta', 'contracheques')

      const res = await fetch('/api/credimpacto/comprovante', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro no upload')

      setBaixaComprovanteUrl(data.url)
      toast.success('Comprovante anexado!')
    } catch (err: any) {
      toast.error(err.message || 'Erro no upload')
    } finally {
      setIsUploading(false)
    }
  }

  const handleExport = (formato: 'xlsx' | 'csv') => {
    const url = `/api/credimpacto/folha/exportar?competencia=${competencia}&formato=${formato}`
    window.open(url, '_blank')
  }

  // Filtragem local das parcelas exibidas
  const parcelasFiltradas = (folhaData?.parcelas || []).filter((p) => {
    const q = searchTerm.toLowerCase().trim()
    const matchSearch =
      !q ||
      p.colaboradorNome.toLowerCase().includes(q) ||
      p.colaboradorCpf.includes(q) ||
      p.codigoOperacao.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'todos' ? true : p.status === statusFilter
    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      {/* SELETOR DE COMPETÊNCIA E AÇÕES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <Calendar size={20} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
              Competência da Folha de Pagamento
            </label>
            <input
              type="month"
              value={competencia}
              onChange={(e) => setCompetencia(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap justify-end">
          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition-all"
          >
            <Download size={14} />
            <span>Exportar Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all"
          >
            <Download size={14} />
            <span>CSV</span>
          </button>

          <button
            onClick={() => setShowBatchModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-sm shadow-cyan-600/20 transition-all active:scale-95"
          >
            <Layers size={14} />
            <span>Baixa em Lote da Folha</span>
          </button>
        </div>
      </div>

      {/* DASHBOARD DA COMPETÊNCIA */}
      {/* DASHBOARD DA COMPETÊNCIA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Previsto para Desconto</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
            {formatBrl(folhaData?.totalPrevisto || 0)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {folhaData?.quantidadeParcelas || 0} parcelas agendadas
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Desconto Confirmado</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatBrl(folhaData?.totalDescontado || 0)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {folhaData?.quantidadePagas || 0} parcelas baixadas
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Pendente de Baixa</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={16} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatBrl(folhaData?.totalPendente || 0)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Aguardando conciliação
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider">Colaboradores</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <Banknote size={16} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
            {folhaData?.quantidadeColaboradores || 0}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Nesta competência
          </div>
        </div>
      </div>

      {/* FILTROS DA LISTA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar por colaborador, CPF ou operação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={14} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
          >
            <option value="todos">Todos os Status</option>
            <option value="prevista">Previstas (Pendentes)</option>
            <option value="descontada">Descontadas em Folha</option>
            <option value="paga_avulso">Pagas Avulso (PIX/TED)</option>
            <option value="atrasada">Atrasadas</option>
          </select>
        </div>
      </div>

      {/* TABELA DE PARCELAS DA FOLHA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Operação</th>
                <th className="py-3 px-4 text-center">Parcela</th>
                <th className="py-3 px-4 text-right">Amortização</th>
                <th className="py-3 px-4 text-right">Juros</th>
                <th className="py-3 px-4 text-right">Valor Desconto</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono">
              {parcelasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                    Nenhuma parcela prevista para desconto nesta competência.
                  </td>
                </tr>
              ) : (
                parcelasFiltradas.map((p) => {
                  const isPaid = p.status === 'descontada' || p.status === 'paga_avulso'

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-sans">
                        <div className="font-bold text-slate-900 dark:text-white">{p.colaboradorNome}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          Matrícula: {p.colaboradorMatricula || 'N/A'} • CPF: {p.colaboradorCpf}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-700 dark:text-slate-300">
                        {p.codigoOperacao}
                      </td>

                      <td className="py-3 px-4 text-center text-slate-700 dark:text-slate-300">
                        {p.numero}
                      </td>

                      <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">
                        {formatBrl(p.valorAmortizacao)}
                      </td>

                      <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400">
                        {formatBrl(p.valorJuros)}
                      </td>

                      <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-white">
                        {formatBrl(p.valorTotal)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full font-sans border ${
                            isPaid
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                              : p.status === 'atrasada'
                              ? 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
                              : 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
                          }`}
                        >
                          {p.status === 'descontada'
                            ? 'Descontado'
                            : p.status === 'paga_avulso'
                            ? 'Pago Avulso'
                            : p.status === 'prevista'
                            ? 'Prevista'
                            : p.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isPaid ? (
                            <button
                              onClick={() => handleOpenIndividualModal(p)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shadow-sm shadow-emerald-600/20 flex items-center gap-1 transition-all"
                              title="Confirmar Desconto em Folha"
                            >
                              <Check size={12} />
                              <span>Baixar</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenEstornoModal(p)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/40 dark:text-slate-400 dark:hover:text-rose-400 transition-all"
                              title="Estornar Baixa com Justificativa"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* MOBILE CARDS LIST */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {parcelasFiltradas.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              Nenhuma parcela prevista para desconto nesta competência.
            </div>
          ) : (
            parcelasFiltradas.map((p) => {
              const isPaid = p.status === 'descontada' || p.status === 'paga_avulso'

              return (
                <div key={p.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">{p.codigoOperacao}</span>
                      <span className="text-[10px] text-slate-500 ml-1.5 font-mono">Parcela {p.numero}</span>
                    </div>
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                          : p.status === 'atrasada'
                          ? 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
                          : 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40'
                      }`}
                    >
                      {p.status === 'descontada' ? 'Descontado' : p.status === 'prevista' ? 'Prevista' : p.status}
                    </span>
                  </div>

                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-sm">{p.colaboradorNome}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">CPF: {p.colaboradorCpf}</div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center font-mono">
                    <div>
                      <div className="text-[9px] uppercase font-sans text-slate-400 font-semibold">Desconto</div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{formatBrl(p.valorTotal)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-sans text-slate-400 font-semibold">Principal</div>
                      <div className="font-bold text-slate-700 dark:text-slate-300 text-xs mt-0.5">{formatBrl(p.valorAmortizacao)}</div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-sans text-slate-400 font-semibold">Juros</div>
                      <div className="font-bold text-slate-500 dark:text-slate-400 text-xs mt-0.5">{formatBrl(p.valorJuros)}</div>
                    </div>
                  </div>

                  <div className="pt-1">
                    {!isPaid ? (
                      <button
                        onClick={() => handleOpenIndividualModal(p)}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20 active:scale-98 transition-all"
                      >
                        <Check size={14} />
                        <span>Confirmar Baixa em Folha</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenEstornoModal(p)}
                        className="w-full py-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <RotateCcw size={14} />
                        <span>Estornar Baixa</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* MODAL DE BAIXA INDIVIDUAL */}
      {individualModalParcela && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                Confirmar Desconto da Parcela
              </h3>
              <button onClick={() => setIndividualModalParcela(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">✕</button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between font-sans">
                <span className="text-slate-500 dark:text-slate-400">Colaborador:</span>
                <span className="font-bold text-slate-900 dark:text-white">{individualModalParcela.colaboradorNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Operação / Parcela:</span>
                <span className="text-cyan-700 dark:text-cyan-300 font-bold">{individualModalParcela.codigoOperacao} • Parcela {individualModalParcela.numero}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Competência:</span>
                <span className="text-slate-700 dark:text-slate-300">{individualModalParcela.competencia}</span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Valor Previsto:</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatBrl(individualModalParcela.valorTotal)}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Valor Efetivamente Descontado / Pago (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={baixaValor}
                  onChange={(e) => setBaixaValor(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Forma de Liquidação
                  </label>
                  <select
                    value={baixaMetodo}
                    onChange={(e: any) => setBaixaMetodo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                  >
                    <option value="folha_pagamento">Desconto em Folha</option>
                    <option value="pix">PIX Avulso</option>
                    <option value="transferencia">Transferência Bancária</option>
                    <option value="dinheiro">Dinheiro em Espécie</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Data do Desconto
                  </label>
                  <input
                    type="date"
                    value={baixaData}
                    onChange={(e) => setBaixaData(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Anexar Comprovante / Contracheque (Opcional)
                </label>
                <label className="cursor-pointer flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 text-slate-700 dark:text-slate-300 transition-all">
                  <Upload size={14} />
                  <span>{isUploading ? 'Enviando...' : 'Carregar Comprovante'}</span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
                {baixaComprovanteUrl && (
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-mono font-medium">
                    <CheckCircle2 size={12} /> Comprovante vinculado
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Observações da Conciliação
                </label>
                <input
                  type="text"
                  value={baixaObservacao}
                  onChange={(e) => setBaixaObservacao(e.target.value)}
                  placeholder="Número do recibo, contracheque ou detalhe..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIndividualModalParcela(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmittingBaixa}
                onClick={handleConfirmIndividualBaixa}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 disabled:opacity-50 transition-colors"
              >
                {isSubmittingBaixa ? 'Registrando...' : 'Confirmar Desconto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ESTORNO */}
      {estornoModalParcela && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                <RotateCcw size={18} />
                Estornar Baixa Financeira
              </h3>
              <button onClick={() => setEstornoModalParcela(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">✕</button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              O estorno reverterá a parcela <strong>{estornoModalParcela.numero}</strong> para a situação de <strong>prevista</strong> e restaurará o saldo devedor do colaborador <strong>{estornoModalParcela.colaboradorNome}</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-rose-600 dark:text-rose-400">
                Justificativa Obrigatória do Estorno (Auditoria)
              </label>
              <textarea
                rows={3}
                required
                value={estornoJustificativa}
                onChange={(e) => setEstornoJustificativa(e.target.value)}
                placeholder="Explique o motivo do estorno (ex: folha de pagamento reprocessada, duplicidade, retificação)..."
                className="w-full bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEstornoModalParcela(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isSubmittingEstorno || estornoJustificativa.trim().length < 5}
                onClick={handleConfirmEstorno}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm shadow-rose-600/20 disabled:opacity-50 transition-colors"
              >
                {isSubmittingEstorno ? 'Estornando...' : 'Confirmar Estorno'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE BAIXA EM LOTE DA FOLHA */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers size={18} className="text-cyan-600 dark:text-cyan-400" />
                Conciliação em Lote da Folha
              </h3>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">✕</button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Esta ação confirmará em lote o desconto de todas as parcelas pendentes da competência <strong>{competencia}</strong>.
            </p>

            <div className="bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-800/40 rounded-xl p-3.5 text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-sans">Competência:</span>
                <span className="font-bold text-slate-900 dark:text-white">{competencia}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-sans">Parcelas a Baixar:</span>
                <span className="text-cyan-700 dark:text-cyan-300 font-bold">
                  {(folhaData?.parcelas || []).filter((p) => p.status === 'prevista' || p.status === 'exportada_folha').length} parcelas
                </span>
              </div>
              <div className="flex justify-between font-bold pt-1 border-t border-cyan-200/60 dark:border-cyan-800/40">
                <span className="text-slate-600 dark:text-slate-400 font-sans">Total a Conciliar:</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatBrl(folhaData?.totalPendente || 0)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Identificador / Código do Lote da Folha
              </label>
              <input
                type="text"
                value={loteCodigo}
                onChange={(e) => setLoteCodigo(e.target.value)}
                placeholder="Ex: FOLHA-2026-10"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmittingBatch || (folhaData?.totalPendente || 0) <= 0}
                onClick={handleConfirmBatchBaixa}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-sm shadow-cyan-600/20 disabled:opacity-50 transition-colors"
              >
                {isSubmittingBatch ? 'Processando lote...' : 'Confirmar Baixa do Lote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
