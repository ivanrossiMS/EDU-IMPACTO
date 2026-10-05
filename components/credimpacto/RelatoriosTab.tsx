'use client'

import React, { useState, useMemo } from 'react'
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  DollarSign,
  PieChart,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Building2,
  Percent
} from 'lucide-react'
import { CredImpactoEmprestimo } from '@/types/credimpacto'
import { formatBrl, METODOS_LABELS } from '@/lib/credimpacto/engine'
import { toast } from 'sonner'

interface RelatoriosTabProps {
  emprestimos: CredImpactoEmprestimo[]
  onOpenDetails: (loan: CredImpactoEmprestimo) => void
}

export function RelatoriosTab({
  emprestimos,
  onOpenDetails
}: RelatoriosTabProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())

  // Métricas Consolidadas - apenas operações formalizadas e liberadas
  const concedidos = useMemo(() => emprestimos.filter((e) => ['ativo', 'quitado'].includes(e.status)), [emprestimos])
  const totalOperacoes = concedidos.length
  const totalPrincipalConcedido = concedidos.reduce((acc, e) => acc + (e.valorAprovado || 0), 0)
  const totalSaldoDevedorGeral = emprestimos.filter((e) => e.status === 'ativo').reduce((acc, e) => acc + (e.saldoDevedorAtual || 0), 0)
  
  // Total de juros projetados e total de juros já pagos (apenas de operações concedidas)
  let totalJurosProjetados = 0
  let totalJurosRecebidos = 0
  let totalPrincipalAmortizado = 0

  for (const emp of concedidos) {
    for (const p of emp.parcelas || []) {
      totalJurosProjetados += p.valorJuros || 0
      if (p.status === 'descontada' || p.status === 'paga_avulso') {
        totalJurosRecebidos += p.valorJuros || 0
        totalPrincipalAmortizado += p.valorAmortizacao || 0
      }
    }
  }

  // Agrupamento por Método de Cálculo (apenas concedidos)
  const distribuicaoPorMetodo = useMemo(() => {
    const acc: Record<string, { count: number; volume: number }> = {}
    for (const emp of concedidos) {
      const met = emp.metodoCalculo || 'JUROS_SIMPLES_SALDO'
      if (!acc[met]) acc[met] = { count: 0, volume: 0 }
      acc[met].count += 1
      acc[met].volume += emp.valorAprovado || 0
    }
    return Object.entries(acc).map(([key, data]) => ({
      metodo: key,
      label: (METODOS_LABELS as any)[key]?.nome || key,
      count: data.count,
      volume: data.volume
    }))
  }, [concedidos])

  // Agrupamento por Status
  const distribuicaoPorStatus = useMemo(() => {
    const acc: Record<string, { count: number; volume: number }> = {}
    for (const emp of emprestimos) {
      const st = emp.status
      if (!acc[st]) acc[st] = { count: 0, volume: 0 }
      acc[st].count += 1
      acc[st].volume += emp.valorAprovado || 0
    }
    return Object.entries(acc).map(([status, data]) => ({
      status,
      count: data.count,
      volume: data.volume
    }))
  }, [emprestimos])

  // Exportar Extrato Contábil Geral
  const handleExportContabil = () => {
    if (emprestimos.length === 0) {
      toast.error('Nenhum empréstimo para exportar.')
      return
    }

    const headers = [
      'Código Operação',
      'Data Concessão',
      'Colaborador',
      'CPF',
      'Matrícula',
      'Status',
      'Valor Principal (R$)',
      'Taxa Mensal (%)',
      'Método de Cálculo',
      'Qtd Parcelas',
      'Saldo Devedor (R$)',
      'Total Amortizado (R$)'
    ]

    const rows = emprestimos.map((e) => [
      e.codigoOperacao,
      new Date(e.createdAt).toLocaleDateString('pt-BR'),
      `"${e.colaboradorNome}"`,
      e.colaboradorCpf,
      e.colaboradorMatricula || '',
      e.status,
      e.valorAprovado.toFixed(2),
      e.taxaMensal.toFixed(2),
      `"${(METODOS_LABELS as any)[e.metodoCalculo]?.nome || e.metodoCalculo}"`,
      e.quantidadeParcelas,
      e.saldoDevedorAtual.toFixed(2),
      (e.valorAprovado - e.saldoDevedorAtual).toFixed(2)
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `credimpacto_extrato_contabil_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Extrato contábil exportado com sucesso!')
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO DO RELATÓRIO COM EXPORTAÇÃO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 size={18} className="text-emerald-600" />
            <span>Extratos Contábeis & DRE de Empréstimos</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Consolidado executivo para contabilidade, demonstrativo de receitas financeiras (juros) e controle patrimonial.
          </p>
        </div>

        <button
          onClick={handleExportContabil}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
        >
          <Download size={15} />
          <span>Exportar Extrato Completo</span>
        </button>
      </div>

      {/* CARDS DE INDICADORES PRINCIPAIS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Capital Concedido Total
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white font-mono">
            {formatBrl(totalPrincipalConcedido)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {totalOperacoes} operações na carteira
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Principal em Aberto
          </div>
          <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatBrl(totalSaldoDevedorGeral)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Amortizado: {formatBrl(totalPrincipalAmortizado)}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Juros Auferidos (Recebidos)
          </div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatBrl(totalJurosRecebidos)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Receita financeira realizada
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            Juros Futuros a Realizar
          </div>
          <div className="text-xl font-black text-cyan-600 dark:text-cyan-400 font-mono">
            {formatBrl(Math.max(0, totalJurosProjetados - totalJurosRecebidos))}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Projeção total: {formatBrl(totalJurosProjetados)}
          </div>
        </div>
      </div>

      {/* DISTRIBUIÇÃO POR MÉTODO E STATUS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Distribuição por Modalidade de Juros */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Percent size={15} className="text-emerald-600" />
              <span>Modalidades de Cálculo Adotadas</span>
            </h3>
          </div>

          <div className="space-y-3">
            {distribuicaoPorMetodo.map((m) => {
              const perc = totalPrincipalConcedido > 0 ? (m.volume / totalPrincipalConcedido) * 100 : 0
              return (
                <div key={m.metodo} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-800 dark:text-slate-200">{m.label}</span>
                    <span className="font-mono text-slate-900 dark:text-white">
                      {formatBrl(m.volume)} ({m.count} contratos)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                      style={{ width: `${Math.min(100, Math.max(5, perc))}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Distribuição por Status das Operações */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <PieChart size={15} className="text-teal-600" />
              <span>Situação Geral da Carteira</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {distribuicaoPorStatus.map((s) => (
              <div key={s.status} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {s.status.replace(/_/g, ' ')}
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                  {s.count} <span className="text-[10px] font-normal text-slate-400">contratos</span>
                </div>
                <div className="text-[11px] font-bold text-emerald-600 font-mono">
                  {formatBrl(s.volume)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
