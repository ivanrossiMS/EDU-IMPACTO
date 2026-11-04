'use client'

import React, { useState, useMemo } from 'react'
import {
  Receipt,
  Search,
  CheckCircle2,
  Clock,
  Download,
  DollarSign,
  ArrowUpRight,
  RotateCcw,
  Layers,
  CheckSquare,
  ExternalLink,
  X
} from 'lucide-react'
import { CredImpactoEmprestimo, CredImpactoParcela } from '@/types/credimpacto'
import { formatBrl } from '@/lib/credimpacto/engine'
import { toast } from 'sonner'
import {
  BaixaParcelasModal,
  EstornoParcelasModal,
  ParcelaComContexto
} from './BaixaParcelasModal'

interface ParcelasTabProps {
  emprestimos: CredImpactoEmprestimo[]
  onOpenDetails: (loan: CredImpactoEmprestimo) => void
  onRefresh: () => void
  isAdminOrFinance?: boolean
}

interface FlattenedParcela extends ParcelaComContexto {
  loanId: string
  codigoOperacao: string
  colaboradorNome: string
  colaboradorCpf: string
  colaboradorMatricula?: string
  loanStatus: string
  loan: CredImpactoEmprestimo
}

export function ParcelasTab({
  emprestimos,
  onOpenDetails,
  onRefresh,
  isAdminOrFinance = true
}: ParcelasTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [compFilter, setCompFilter] = useState('todas')
  const [loanFilter, setLoanFilter] = useState('ativos_e_quitados')

  // Estado de seleção múltipla e modais de baixa/estorno
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [baixaModalState, setBaixaModalState] = useState<{
    parcelasInicial: ParcelaComContexto[]
    todasParcelasContexto?: ParcelaComContexto[]
    tituloContexto?: string
  } | null>(null)
  const [estornoModalParcelas, setEstornoModalParcelas] = useState<ParcelaComContexto[] | null>(
    null
  )

  // Achatar todas as parcelas de empréstimos ativos e quitados
  const todasParcelas = useMemo(() => {
    const list: FlattenedParcela[] = []
    const emprestimosValidos = emprestimos.filter((emp) => {
      if (loanFilter === 'apenas_ativos') return emp.status === 'ativo'
      if (loanFilter === 'apenas_quitados') return emp.status === 'quitado'
      return emp.status === 'ativo' || emp.status === 'quitado'
    })

    for (const emp of emprestimosValidos) {
      if (!emp.parcelas) continue
      for (const p of emp.parcelas) {
        if (p.status === 'cancelada' && statusFilter !== 'cancelada') continue
        const resolvedId = p.id || `${emp.id}_parc_${p.numero}`
        list.push({
          ...p,
          id: resolvedId,
          emprestimoId: p.emprestimoId || emp.id,
          loanId: emp.id,
          codigoOperacao: emp.codigoOperacao || '',
          colaboradorNome: emp.colaboradorNome || 'Colaborador',
          colaboradorCpf: emp.colaboradorCpf || '',
          colaboradorMatricula: emp.colaboradorMatricula || '',
          quantidadeParcelas: emp.quantidadeParcelas,
          loanStatus: emp.status,
          loan: emp
        })
      }
    }

    return list.sort((a, b) => {
      const timeDiff =
        new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime()
      if (timeDiff !== 0) return timeDiff
      return (a.numero || 0) - (b.numero || 0)
    })
  }, [emprestimos, loanFilter, statusFilter])

  // Lista única de competências presentes nas parcelas
  const competenciasDisponiveis = useMemo(() => {
    const set = new Set<string>()
    for (const p of todasParcelas) {
      if (p.competencia) set.add(p.competencia)
    }
    return Array.from(set).sort().reverse()
  }, [todasParcelas])

  // Filtragem das parcelas
  const filteredParcelas = useMemo(() => {
    return todasParcelas.filter((p) => {
      const q = searchTerm.toLowerCase().trim()
      const matchSearch =
        !q ||
        (p.colaboradorNome || '').toLowerCase().includes(q) ||
        (p.colaboradorCpf || '').includes(q) ||
        (p.codigoOperacao || '').toLowerCase().includes(q)

      const matchStatus =
        statusFilter === 'todos'
          ? true
          : statusFilter === 'pendentes'
            ? p.status === 'prevista' || p.status === 'atrasada' || p.status === 'exportada_folha'
            : statusFilter === 'pagas'
              ? p.status === 'descontada' || p.status === 'paga_avulso'
              : p.status === statusFilter
      const matchComp = compFilter === 'todas' ? true : p.competencia === compFilter

      return matchSearch && matchStatus && matchComp
    })
  }, [todasParcelas, searchTerm, statusFilter, compFilter])

  // Parcelas pendentes e baixadas dentro do conjunto filtrado
  const pendentesFiltradas = useMemo(
    () =>
      filteredParcelas.filter(
        (p) =>
          p.status !== 'descontada' &&
          p.status !== 'paga_avulso' &&
          p.status !== 'cancelada'
      ),
    [filteredParcelas]
  )

  const selecionadasObjetos = useMemo(() => {
    const set = new Set(selectedIds)
    return filteredParcelas.filter((p) => set.has(p.id))
  }, [filteredParcelas, selectedIds])

  const selecionadasPendentes = useMemo(
    () =>
      selecionadasObjetos.filter(
        (p) =>
          p.status !== 'descontada' &&
          p.status !== 'paga_avulso' &&
          p.status !== 'cancelada'
      ),
    [selecionadasObjetos]
  )

  const selecionadasBaixadas = useMemo(
    () =>
      selecionadasObjetos.filter(
        (p) => p.status === 'descontada' || p.status === 'paga_avulso'
      ),
    [selecionadasObjetos]
  )

  // Métricas calculadas sobre o conjunto filtrado
  const totalValor = filteredParcelas.reduce((acc, p) => acc + (p.valorTotal || 0), 0)
  const totalAmortizacao = filteredParcelas.reduce(
    (acc, p) => acc + (p.valorAmortizacao || 0),
    0
  )
  const totalJuros = filteredParcelas.reduce((acc, p) => acc + (p.valorJuros || 0), 0)
  const totalRecebido = filteredParcelas
    .filter((p) => p.status === 'descontada' || p.status === 'paga_avulso')
    .reduce((acc, p) => acc + (p.valorPago || p.valorTotal || 0), 0)
  const totalPendente = pendentesFiltradas.reduce(
    (acc, p) => acc + (p.valorTotal || 0),
    0
  )

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const allPendingSelected =
    pendentesFiltradas.length > 0 &&
    pendentesFiltradas.every((p) => selectedIds.includes(p.id))

  const toggleSelectAllPending = () => {
    if (allPendingSelected) {
      const pendingSet = new Set(pendentesFiltradas.map((p) => p.id))
      setSelectedIds((prev) => prev.filter((id) => !pendingSet.has(id)))
    } else {
      const pendingIds = pendentesFiltradas.map((p) => p.id)
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pendingIds])))
    }
  }

  const handleOpenBaixaIndividual = (p: FlattenedParcela) => {
    // Também disponibiliza todas as parcelas pendentes daquele contrato para caso o usuário queira expandir para várias ou todas no modal
    const todasDoContrato = todasParcelas.filter(
      (item) =>
        item.loanId === p.loanId &&
        item.status !== 'descontada' &&
        item.status !== 'paga_avulso' &&
        item.status !== 'cancelada'
    )
    setBaixaModalState({
      parcelasInicial: [p],
      todasParcelasContexto: todasDoContrato,
      tituloContexto: `${p.codigoOperacao} • ${p.colaboradorNome}`
    })
  }

  const handleOpenBaixaSelecionadas = () => {
    if (selecionadasPendentes.length === 0) {
      toast.error('Selecione pelo menos uma parcela pendente para baixar.')
      return
    }
    setBaixaModalState({
      parcelasInicial: selecionadasPendentes,
      todasParcelasContexto: pendentesFiltradas,
      tituloContexto:
        selecionadasPendentes.length === 1
          ? `${selecionadasPendentes[0].codigoOperacao} • ${selecionadasPendentes[0].colaboradorNome}`
          : `${selecionadasPendentes.length} parcelas selecionadas no Controle de Parcelas`
    })
  }

  const handleOpenBaixaTodasFiltradas = () => {
    if (pendentesFiltradas.length === 0) {
      toast.error('Não há parcelas pendentes nos filtros atuais.')
      return
    }
    setBaixaModalState({
      parcelasInicial: pendentesFiltradas,
      todasParcelasContexto: pendentesFiltradas,
      tituloContexto:
        compFilter !== 'todas'
          ? `Todas as parcelas pendentes da competência ${compFilter}`
          : searchTerm
            ? `Todas as parcelas pendentes da busca "${searchTerm}"`
            : `Todas as ${pendentesFiltradas.length} parcelas pendentes listadas`
    })
  }

  // Exportar para CSV
  const handleExportCSV = () => {
    if (filteredParcelas.length === 0) {
      toast.error('Nenhuma parcela para exportar.')
      return
    }

    const headers = [
      'Operação',
      'Parcela',
      'Colaborador',
      'CPF',
      'Competência',
      'Vencimento',
      'Amortização (R$)',
      'Juros (R$)',
      'Valor Total (R$)',
      'Status',
      'Data Pagamento',
      'Valor Pago (R$)'
    ]

    const rows = filteredParcelas.map((p) => [
      p.codigoOperacao,
      `${p.numero}`,
      `"${p.colaboradorNome}"`,
      p.colaboradorCpf,
      p.competencia,
      p.dataVencimento,
      p.valorAmortizacao.toFixed(2),
      p.valorJuros.toFixed(2),
      p.valorTotal.toFixed(2),
      p.status,
      p.dataPagamento || '',
      p.valorPago !== undefined ? p.valorPago.toFixed(2) : ''
    ])

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute(
      'download',
      `credimpacto_parcelas_${new Date().toISOString().slice(0, 10)}.csv`
    )
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Relação de parcelas exportada com sucesso!')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'descontada':
        return {
          label: 'Descontada',
          bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
        }
      case 'paga_avulso':
        return {
          label: 'Paga Avulso',
          bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
        }
      case 'atrasada':
        return {
          label: 'Em Atraso',
          bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800'
        }
      default:
        return {
          label: 'A Vencer',
          bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
        }
    }
  }

  return (
    <div className="space-y-5">
      {/* CARDS DE RESUMO KPI DE PARCELAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">
              Total de Parcelas
            </span>
            <Receipt size={16} className="text-emerald-600 shrink-0" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono truncate">
            {formatBrl(totalValor)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {filteredParcelas.length} parcelas registradas
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">
              Efetivamente Baixado
            </span>
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono truncate">
            {formatBrl(totalRecebido)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            Folha ou pagamento avulso
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">
              Saldo Pendente
            </span>
            <Clock size={16} className="text-amber-500 shrink-0" />
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono truncate">
            {formatBrl(totalPendente)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            {pendentesFiltradas.length} parcelas a descontar
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider truncate">
              Juros Projetados
            </span>
            <DollarSign size={16} className="text-cyan-600 shrink-0" />
          </div>
          <div className="text-xl font-black text-cyan-700 dark:text-cyan-400 font-mono truncate">
            {formatBrl(totalJuros)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate">
            Amortização: {formatBrl(totalAmortizacao)}
          </div>
        </div>
      </div>

      {/* FILTROS, BUSCA E AÇÕES DE BAIXA EM LOTE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="relative w-full xl:flex-1 xl:max-w-md">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Buscar colaborador, CPF ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Filtro por Competência */}
          <select
            value={compFilter}
            onChange={(e) => setCompFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
          >
            <option value="todas">Todas Competências</option>
            {competenciasDisponiveis.map((c) => (
              <option key={c} value={c}>
                Folha {c}
              </option>
            ))}
          </select>

          {/* Filtro por Status da Parcela */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
          >
            <option value="todos">Todos Status</option>
            <option value="pendentes">Pendentes (A Vencer + Atraso)</option>
            <option value="pagas">Já Baixadas (Folha + Avulso)</option>
            <option value="prevista">A Vencer</option>
            <option value="descontada">Descontada em Folha</option>
            <option value="paga_avulso">Paga Avulso</option>
            <option value="atrasada">Em Atraso</option>
          </select>

          {/* Filtro de Contratos */}
          <select
            value={loanFilter}
            onChange={(e) => setLoanFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
          >
            <option value="ativos_e_quitados">Contratos Ativos & Quitados</option>
            <option value="apenas_ativos">Apenas Contratos Ativos</option>
            <option value="apenas_quitados">Apenas Contratos Quitados</option>
          </select>

          {/* Botão Baixar Selecionadas */}
          {isAdminOrFinance && selecionadasPendentes.length > 0 && (
            <button
              type="button"
              onClick={handleOpenBaixaSelecionadas}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-sm transition-colors shrink-0"
            >
              <CheckSquare size={14} />
              <span>
                Baixar Selecionadas ({selecionadasPendentes.length})
              </span>
            </button>
          )}

          {/* Botão Baixar Todas Pendentes */}
          {isAdminOrFinance && pendentesFiltradas.length > 0 && (
            <button
              type="button"
              onClick={handleOpenBaixaTodasFiltradas}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-extrabold transition-colors shrink-0"
              title="Dar baixa em todas as parcelas pendentes listadas no filtro atual"
            >
              <Layers size={14} />
              <span>Baixar Todas ({pendentesFiltradas.length})</span>
            </button>
          )}

          {/* Botão de Exportação CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors shrink-0"
          >
            <Download size={14} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* BARRA DE SELEÇÃO MÚLTIPLA ATIVA */}
      {isAdminOrFinance && selecionadasObjetos.length > 0 && (
        <div className="bg-emerald-950 text-white rounded-2xl px-4 py-3 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-150">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-black">
              {selecionadasObjetos.length} selecionada(s)
            </span>
            <div className="text-xs text-emerald-100">
              {selecionadasPendentes.length > 0 && (
                <span>
                  Pendentes:{' '}
                  <strong className="text-white">
                    {selecionadasPendentes.length} (
                    {formatBrl(
                      selecionadasPendentes.reduce((acc, p) => acc + (p.valorTotal || 0), 0)
                    )}
                    )
                  </strong>
                </span>
              )}
              {selecionadasBaixadas.length > 0 && (
                <span className="ml-3">
                  Já baixadas:{' '}
                  <strong className="text-amber-300">{selecionadasBaixadas.length}</strong>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
            {pendentesFiltradas.length > selecionadasPendentes.length && (
              <button
                type="button"
                onClick={() =>
                  setSelectedIds(pendentesFiltradas.map((p) => p.id))
                }
                className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-bold text-emerald-100 transition"
              >
                Selecionar todas pendentes ({pendentesFiltradas.length})
              </button>
            )}
            {selecionadasPendentes.length > 0 && (
              <button
                type="button"
                onClick={handleOpenBaixaSelecionadas}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-sm transition"
              >
                <CheckCircle2 size={14} />
                Baixar {selecionadasPendentes.length} Selecionada(s)
              </button>
            )}
            {selecionadasBaixadas.length > 0 && (
              <button
                type="button"
                onClick={() => setEstornoModalParcelas(selecionadasBaixadas)}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 font-bold text-xs flex items-center gap-1.5 transition"
              >
                <RotateCcw size={13} />
                Estornar ({selecionadasBaixadas.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition"
              title="Limpar seleção"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* TABELA DE PARCELAS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {/* DESKTOP TABLE */}
        <div
          className="hidden md:block overflow-x-auto"
          tabIndex={0}
          role="region"
          aria-label="Tabela de controle de parcelas e cronograma"
        >
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                {isAdminOrFinance && (
                  <th className="py-2.5 px-2 text-center w-8">
                    <input
                      type="checkbox"
                      checked={allPendingSelected}
                      onChange={toggleSelectAllPending}
                      disabled={pendentesFiltradas.length === 0}
                      title="Selecionar todas as parcelas pendentes visíveis"
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-40"
                    />
                  </th>
                )}
                <th className="py-2.5 px-2 text-center whitespace-nowrap">Operação</th>
                <th className="py-2.5 px-1.5 text-center whitespace-nowrap">Parc.</th>
                <th className="py-2.5 px-2">Colaborador</th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">
                  Folha / Venc.
                </th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">
                  Amortização
                </th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">Juros</th>
                <th className="py-2.5 px-2 text-right whitespace-nowrap">
                  Valor Parcela
                </th>
                <th className="py-2.5 px-2 text-center whitespace-nowrap">Status</th>
                <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
              {filteredParcelas.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdminOrFinance ? 10 : 9}
                    className="py-12 text-center text-slate-400 font-sans"
                  >
                    Nenhuma parcela encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredParcelas.map((p) => {
                  const badge = getStatusBadge(p.status)
                  const isPaid = p.status === 'descontada' || p.status === 'paga_avulso'
                  const isChecked = selectedIds.includes(p.id)

                  return (
                    <tr
                      key={p.id}
                      className={`transition-colors ${
                        isChecked
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/25'
                          : isPaid
                            ? 'bg-slate-50/40 dark:bg-slate-900/40 hover:bg-slate-50/80'
                            : 'hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      {isAdminOrFinance && (
                        <td className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectOne(p.id)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                            aria-label={`Selecionar parcela #${p.numero} de ${p.colaboradorNome}`}
                          />
                        </td>
                      )}

                      <td className="py-2 px-2 text-center font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenDetails(p.loan)}
                          className="hover:text-emerald-600 hover:underline transition"
                          title="Abrir contrato"
                        >
                          {p.codigoOperacao}
                        </button>
                      </td>

                      <td className="py-2 px-1.5 text-center font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        #{p.numero}
                      </td>

                      <td className="py-2 px-2 max-w-[190px] font-sans">
                        <div
                          className="font-bold text-slate-900 dark:text-white truncate text-xs"
                          title={p.colaboradorNome}
                        >
                          {p.colaboradorNome}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          CPF: {p.colaboradorCpf}
                        </div>
                      </td>

                      <td className="py-2 px-2 text-center font-mono whitespace-nowrap">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {p.competencia}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(p.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                        </div>
                      </td>

                      <td className="py-2 px-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatBrl(p.valorAmortizacao)}
                      </td>

                      <td className="py-2 px-2 text-right font-mono text-cyan-700 dark:text-cyan-400 whitespace-nowrap">
                        {formatBrl(p.valorJuros)}
                      </td>

                      <td className="py-2 px-2 text-right font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div>{formatBrl(p.valorTotal)}</div>
                        {isPaid && p.valorPago !== undefined && p.valorPago !== p.valorTotal && (
                          <div className="text-[9px] text-emerald-600 font-sans font-bold">
                            Pago: {formatBrl(p.valorPago)}
                          </div>
                        )}
                      </td>

                      <td className="py-2 px-2 text-center whitespace-nowrap font-sans">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <span
                            className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.bg}`}
                          >
                            {badge.label}
                          </span>
                          {isPaid && p.dataPagamento && (
                            <span className="text-[9px] text-slate-400">
                              {new Date(
                                p.dataPagamento.includes('T')
                                  ? p.dataPagamento
                                  : p.dataPagamento + 'T12:00:00'
                              ).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2 px-2.5 text-right whitespace-nowrap font-sans">
                        <div className="flex items-center justify-end gap-1">
                          {p.comprovanteUrl && (
                            <a
                              href={p.comprovanteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 border border-emerald-200 transition"
                              title="Ver comprovante da parcela"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}

                          {isAdminOrFinance && !isPaid && (
                            <button
                              type="button"
                              onClick={() => handleOpenBaixaIndividual(p)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-xs transition"
                              title="Dar baixa nesta parcela (ou escolher várias do contrato)"
                            >
                              <CheckCircle2 size={12} />
                              <span>Baixar</span>
                            </button>
                          )}

                          {isAdminOrFinance && isPaid && (
                            <button
                              type="button"
                              onClick={() => setEstornoModalParcelas([p])}
                              className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-[10px] inline-flex items-center gap-1 transition"
                              title="Estornar baixa desta parcela"
                            >
                              <RotateCcw size={11} />
                              <span>Estornar</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onOpenDetails(p.loan)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors inline-flex items-center justify-center"
                            title="Ver detalhes do empréstimo e cronograma completo"
                          >
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* LISTAGEM EM CARDS PARA DISPOSITIVOS MÓVEIS */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredParcelas.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              Nenhuma parcela encontrada para os filtros selecionados.
            </div>
          ) : (
            filteredParcelas.map((p) => {
              const badge = getStatusBadge(p.status)
              const isPaid = p.status === 'descontada' || p.status === 'paga_avulso'
              const isChecked = selectedIds.includes(p.id)

              return (
                <div
                  key={p.id}
                  className={`p-4 space-y-3 ${isChecked ? 'bg-emerald-50/50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isAdminOrFinance && (
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(p.id)}
                          className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        />
                      )}
                      <div>
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {p.codigoOperacao}
                        </span>
                        <span className="text-[10px] text-slate-500 ml-1.5 font-mono">
                          Parcela #{p.numero}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.bg}`}
                    >
                      {badge.label}
                    </span>
                  </div>

                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-sm">
                      {p.colaboradorNome}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      CPF: {p.colaboradorCpf} • Vencimento:{' '}
                      {new Date(p.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}{' '}
                      (Folha {p.competencia})
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center font-mono">
                    <div>
                      <div className="text-[9px] uppercase font-sans text-slate-400 font-semibold">
                        Amortização
                      </div>
                      <div className="font-bold text-slate-700 dark:text-slate-300 text-xs mt-0.5">
                        {formatBrl(p.valorAmortizacao)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-sans text-slate-400 font-semibold">
                        Juros
                      </div>
                      <div className="font-bold text-cyan-700 dark:text-cyan-400 text-xs mt-0.5">
                        {formatBrl(p.valorJuros)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] uppercase font-sans text-slate-400 font-semibold">
                        Valor Total
                      </div>
                      <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">
                        {formatBrl(p.valorTotal)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    {isAdminOrFinance && !isPaid && (
                      <button
                        type="button"
                        onClick={() => handleOpenBaixaIndividual(p)}
                        className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <CheckCircle2 size={14} />
                        <span>Baixar Parcela</span>
                      </button>
                    )}
                    {isAdminOrFinance && isPaid && (
                      <button
                        type="button"
                        onClick={() => setEstornoModalParcelas([p])}
                        className="flex-1 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <RotateCcw size={14} />
                        <span>Estornar</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenDetails(p.loan)}
                      className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <ArrowUpRight size={14} />
                      <span>Contrato</span>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* MODAL UNIFICADO DE BAIXA DE PARCELAS (1, VÁRIAS OU TODAS) */}
      {baixaModalState && (
        <BaixaParcelasModal
          parcelasInicial={baixaModalState.parcelasInicial}
          todasParcelasContexto={baixaModalState.todasParcelasContexto}
          tituloContexto={baixaModalState.tituloContexto}
          onClose={() => setBaixaModalState(null)}
          onSuccess={() => {
            setSelectedIds([])
            onRefresh()
          }}
        />
      )}

      {/* MODAL DE ESTORNO DE PARCELAS */}
      {estornoModalParcelas && (
        <EstornoParcelasModal
          parcelas={estornoModalParcelas}
          onClose={() => setEstornoModalParcelas(null)}
          onSuccess={() => {
            setSelectedIds([])
            onRefresh()
          }}
        />
      )}
    </div>
  )
}
