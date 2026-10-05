'use client'

import React, { useState, useMemo } from 'react'
import {
  Receipt,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Calendar,
  FileText,
  DollarSign,
  ArrowUpRight
} from 'lucide-react'
import { CredImpactoEmprestimo, CredImpactoParcela } from '@/types/credimpacto'
import { formatBrl } from '@/lib/credimpacto/engine'
import { toast } from 'sonner'

interface ParcelasTabProps {
  emprestimos: CredImpactoEmprestimo[]
  onOpenDetails: (loan: CredImpactoEmprestimo) => void
  onRefresh: () => void
}

interface FlattenedParcela extends CredImpactoParcela {
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
  onRefresh
}: ParcelasTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [compFilter, setCompFilter] = useState('todas')

  // Achatar todas as parcelas de todos os empréstimos
  const todasParcelas = useMemo(() => {
    const list: FlattenedParcela[] = []
    for (const emp of emprestimos) {
      if (!emp.parcelas) continue
      for (const p of emp.parcelas) {
        list.push({
          ...p,
          loanId: emp.id,
          codigoOperacao: emp.codigoOperacao,
          colaboradorNome: emp.colaboradorNome,
          colaboradorCpf: emp.colaboradorCpf,
          colaboradorMatricula: emp.colaboradorMatricula,
          loanStatus: emp.status,
          loan: emp
        })
      }
    }
    // Ordenar por data de vencimento crescente
    return list.sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime())
  }, [emprestimos])

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
        p.colaboradorNome.toLowerCase().includes(q) ||
        p.colaboradorCpf.includes(q) ||
        p.codigoOperacao.toLowerCase().includes(q)

      const matchStatus = statusFilter === 'todos' ? true : p.status === statusFilter
      const matchComp = compFilter === 'todas' ? true : p.competencia === compFilter

      return matchSearch && matchStatus && matchComp
    })
  }, [todasParcelas, searchTerm, statusFilter, compFilter])

  // Métricas calculadas sobre o conjunto filtrado
  const totalValor = filteredParcelas.reduce((acc, p) => acc + (p.valorTotal || 0), 0)
  const totalAmortizacao = filteredParcelas.reduce((acc, p) => acc + (p.valorAmortizacao || 0), 0)
  const totalJuros = filteredParcelas.reduce((acc, p) => acc + (p.valorJuros || 0), 0)
  const totalRecebido = filteredParcelas
    .filter((p) => p.status === 'descontada' || p.status === 'paga_avulso')
    .reduce((acc, p) => acc + (p.valorPago || p.valorTotal || 0), 0)
  const totalPendente = filteredParcelas
    .filter((p) => p.status === 'prevista' || p.status === 'atrasada')
    .reduce((acc, p) => acc + (p.valorTotal || 0), 0)

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
      'Data Pagamento'
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
      p.dataPagamento || ''
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `credimpacto_parcelas_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Relação de parcelas exportada com sucesso!')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'descontada':
        return { label: 'Descontada em Folha', bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' }
      case 'paga_avulso':
        return { label: 'Paga Avulso / TED', bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800' }
      case 'atrasada':
        return { label: 'Em Atraso', bg: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800' }
      default:
        return { label: 'Prevista / A Vencer', bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700' }
    }
  }

  return (
    <div className="space-y-6">
      {/* CARDS DE RESUMO KPI DE PARCELAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total de Parcelas</span>
            <Receipt size={16} className="text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {formatBrl(totalValor)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {filteredParcelas.length} parcelas registradas
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Efetivamente Baixado</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatBrl(totalRecebido)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Folha ou pagamento avulso
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Saldo Pendente</span>
            <Clock size={16} className="text-amber-500" />
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatBrl(totalPendente)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Parcelas futuras a descontar
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider">Juros Projetados</span>
            <DollarSign size={16} className="text-cyan-600" />
          </div>
          <div className="text-xl font-black text-cyan-700 dark:text-cyan-400 font-mono">
            {formatBrl(totalJuros)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Amortização: {formatBrl(totalAmortizacao)}
          </div>
        </div>
      </div>

      {/* FILTROS, BUSCA E EXPORTAÇÃO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar colaborador, CPF ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          {/* Filtro por Competência */}
          <select
            value={compFilter}
            onChange={(e) => setCompFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
          >
            <option value="todas">Todas Competências</option>
            {competenciasDisponiveis.map((c) => (
              <option key={c} value={c}>
                Folha {c}
              </option>
            ))}
          </select>

          {/* Filtro por Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium"
          >
            <option value="todos">Todos Status</option>
            <option value="prevista">A Vencer / Prevista</option>
            <option value="descontada">Descontada em Folha</option>
            <option value="paga_avulso">Paga Avulso</option>
            <option value="atrasada">Em Atraso</option>
          </select>

          {/* Botão de Exportação CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors ml-auto md:ml-0"
          >
            <Download size={14} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* TABELA DE PARCELAS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Operação</th>
                <th className="py-3 px-4">Parcela</th>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4 text-center">Folha / Venc.</th>
                <th className="py-3 px-4 text-right">Amortização</th>
                <th className="py-3 px-4 text-right">Juros</th>
                <th className="py-3 px-4 text-right">Valor Parcela</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredParcelas.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Nenhuma parcela encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredParcelas.map((p) => {
                  const badge = getStatusBadge(p.status)
                  return (
                    <tr key={`${p.loanId}-${p.numero}`} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {p.codigoOperacao}
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold text-slate-700 dark:text-slate-300">
                        #{p.numero}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{p.colaboradorNome}</div>
                        <div className="text-[10px] text-slate-400">CPF: {p.colaboradorCpf}</div>
                      </td>

                      <td className="py-3 px-4 text-center font-mono">
                        <div className="font-bold text-slate-800 dark:text-slate-200">{p.competencia}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(p.dataVencimento).toLocaleDateString('pt-BR')}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-700 dark:text-slate-300">
                        {formatBrl(p.valorAmortizacao)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-cyan-700 dark:text-cyan-400">
                        {formatBrl(p.valorJuros)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatBrl(p.valorTotal)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onOpenDetails(p.loan)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Ver detalhes do empréstimo"
                        >
                          <ArrowUpRight size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
