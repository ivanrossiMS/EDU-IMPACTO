'use client'

import React, { useState } from 'react'
import {
  Wallet,
  Clock,
  CheckCircle2,
  FileCheck2,
  AlertCircle,
  HelpCircle,
  Eye,
  HandCoins,
  ChevronRight,
  TrendingDown,
  Sparkles,
  Download
} from 'lucide-react'
import { CredImpactoEmprestimo, CredImpactoParcela } from '@/types/credimpacto'
import { formatBrl } from '@/lib/credimpacto/engine'
import { toast } from 'sonner'

interface ColaboradorDashboardProps {
  emprestimos: CredImpactoEmprestimo[]
  onOpenDetails: (loan: CredImpactoEmprestimo) => void
  onOpenSignModal: (loan: CredImpactoEmprestimo) => void
  onOpenPayoffModal: (loan: CredImpactoEmprestimo) => void
  onRefresh: () => void
}

export function ColaboradorDashboard({
  emprestimos,
  onOpenDetails,
  onOpenSignModal,
  onOpenPayoffModal,
  onRefresh
}: ColaboradorDashboardProps) {
  const [selectedLoanForContra, setSelectedLoanForContra] = useState<CredImpactoEmprestimo | null>(null)
  const [isAnsweringContra, setIsAnsweringContra] = useState(false)

  // Cálculos consolidados para o colaborador
  const emprestimosAtivos = emprestimos.filter((e) => ['ativo', 'aguardando_liberacao', 'aguardando_assinatura'].includes(e.status))
  const saldoDevedorTotal = emprestimosAtivos.reduce((acc, e) => acc + (e.saldoDevedorAtual || 0), 0)
  const totalAmortizadoGeral = emprestimos.reduce((acc, e) => acc + (e.totalAmortizado || 0), 0)

  // Encontra a próxima parcela prevista a vencer entre todos os empréstimos ativos
  let proximaParcela: (CredImpactoParcela & { codigoOperacao: string }) | null = null
  for (const emp of emprestimosAtivos) {
    for (const p of emp.parcelas || []) {
      if (p.status === 'prevista' || p.status === 'exportada_folha') {
        if (!proximaParcela || p.dataVencimento < proximaParcela.dataVencimento) {
          proximaParcela = { ...p, codigoOperacao: emp.codigoOperacao }
        }
      }
    }
  }

  const handleResponderContraproposta = async (loanId: string, aceitou: boolean) => {
    setIsAnsweringContra(true)
    try {
      const res = await fetch(`/api/credimpacto/emprestimos/${loanId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'responder_contraproposta',
          aceitou
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao processar resposta')

      toast.success(
        aceitou
          ? 'Contraproposta aceita! O contrato foi gerado para sua assinatura digital.'
          : 'Contraproposta recusada. Operação cancelada.'
      )
      setSelectedLoanForContra(null)
      onRefresh()
    } catch (err: any) {
      toast.error(err.message || 'Falha ao responder contraproposta')
    } finally {
      setIsAnsweringContra(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'solicitado':
      case 'em_analise':
        return { label: 'Em Análise', bg: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40' }
      case 'contraproposta':
        return { label: 'Contraproposta', bg: 'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40' }
      case 'aguardando_assinatura':
        return { label: 'Aguardando Assinatura', bg: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40' }
      case 'aguardando_liberacao':
        return { label: 'Aguardando Liberação', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200/80 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800/40' }
      case 'ativo':
        return { label: 'Ativo em Folha', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40' }
      case 'quitado':
        return { label: 'Quitado', bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' }
      case 'recusado':
        return { label: 'Não Aprovado', bg: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40' }
      case 'cancelado':
        return { label: 'Cancelado', bg: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' }
      default:
        return { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200' }
    }
  }

  return (
    <div className="space-y-6">
      {/* KPI CARDS DO COLABORADOR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Meu Saldo Devedor</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <Wallet size={16} />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
            {formatBrl(saldoDevedorTotal)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {emprestimosAtivos.length} {emprestimosAtivos.length === 1 ? 'operação ativa' : 'operações ativas'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-4.5 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider">Próxima Parcela</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400">
              <Clock size={16} />
            </div>
          </div>
          <div className="text-lg sm:text-2xl font-black text-cyan-600 dark:text-cyan-400 font-mono">
            {proximaParcela ? formatBrl(proximaParcela.valorTotal) : 'R$ 0,00'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 truncate font-medium">
            {proximaParcela
              ? `Vence ${new Date(proximaParcela.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')} (${proximaParcela.competencia})`
              : 'Nenhum desconto agendado'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4.5 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Amortizado</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <TrendingDown size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatBrl(totalAmortizadoGeral)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Principal já descontado e abatido
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4.5 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Histórico</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <FileCheck2 size={16} />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {emprestimos.length}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {emprestimos.filter((e) => e.status === 'quitado').length} operações quitadas
          </div>
        </div>
      </div>

      {/* LISTA DE EMPRÉSTIMOS DO COLABORADOR */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <span>Minhas Operações de Empréstimo</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-normal">({emprestimos.length})</span>
        </h3>

        {emprestimos.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-500 dark:text-slate-400 space-y-3 shadow-sm">
            <Wallet size={40} className="mx-auto text-slate-400 dark:text-slate-600" />
            <div className="text-base font-bold text-slate-900 dark:text-white">Você ainda não possui solicitações de empréstimo.</div>
            <p className="text-xs max-w-md mx-auto text-slate-600 dark:text-slate-400">
              Utilize a aba &quot;Simular & Solicitar&quot; para simular os valores desejados, conferir o cronograma e enviar sua proposta à escola.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {emprestimos.map((loan) => {
              const badge = getStatusBadge(loan.status)
              const percentAmortizado = loan.valorAprovado > 0
                ? Math.min(100, Math.round(((loan.totalAmortizado || 0) / loan.valorAprovado) * 100))
                : 0

              const parcelasPagas = (loan.parcelas || []).filter((p) => p.status === 'descontada' || p.status === 'paga_avulso').length
              const totalParcelas = loan.quantidadeParcelas

              return (
                <div
                  key={loan.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-mono font-bold text-slate-700 dark:text-slate-200 text-xs">
                        {loan.codigoOperacao.split('-')[2] || 'CRED'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                            {loan.codigoOperacao}
                          </span>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Solicitado em {new Date(loan.createdAt).toLocaleDateString('pt-BR')} • {loan.quantidadeParcelas} parcelas de {formatBrl(loan.parcelas?.[0]?.valorTotal || 0)}
                        </div>
                      </div>
                    </div>

                    {/* BOTÕES DE AÇÃO RÁPIDA CONTEXTUAIS */}
                    <div className="w-full sm:w-auto flex items-center gap-2 flex-wrap">
                      {loan.status === 'aguardando_assinatura' && (
                        <button
                          onClick={() => onOpenSignModal(loan)}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm shadow-blue-600/30 transition-all active:scale-98"
                        >
                          <FileCheck2 size={15} />
                          <span>Assinar Contrato</span>
                        </button>
                      )}

                      {loan.status === 'contraproposta' && (
                        <button
                          onClick={() => setSelectedLoanForContra(loan)}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-sm shadow-purple-600/30 transition-all active:scale-98"
                        >
                          <Sparkles size={15} />
                          <span>Ver Contraproposta</span>
                        </button>
                      )}

                      {loan.status === 'ativo' && (
                        <button
                          onClick={() => onOpenPayoffModal(loan)}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-300 text-xs font-semibold transition-all active:scale-98"
                        >
                          <HandCoins size={14} />
                          <span>Quitação Antecipada</span>
                        </button>
                      )}

                      <button
                        onClick={() => onOpenDetails(loan)}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all active:scale-98"
                      >
                        <Eye size={14} />
                        <span>Detalhes</span>
                      </button>
                    </div>
                  </div>

                  {/* CARDS COM DETALHES DE VALORES */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-sans font-semibold">Valor Concedido</span>
                      <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{formatBrl(loan.valorAprovado)}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-sans font-semibold">Saldo Restante</span>
                      <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{formatBrl(loan.saldoDevedorAtual)}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-sans font-semibold">Parcelas Pagas</span>
                      <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{parcelasPagas} / {totalParcelas}</div>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl p-3">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-sans font-semibold">Juros Contratados</span>
                      <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">{formatBrl(loan.totalJuros)}</div>
                    </div>
                  </div>

                  {/* BARRA DE PROGRESSO DE AMORTIZAÇÃO */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 font-medium">
                      <span>Progresso da Quitação do Principal</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-200">{percentAmortizado}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
                        style={{ width: `${percentAmortizado}%` }}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL DE RESPOSTA À CONTRAPROPOSTA */}
      {selectedLoanForContra && selectedLoanForContra.contraproposta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles size={18} className="text-purple-600 dark:text-purple-400" />
                Contraproposta da Escola
              </h3>
              <button
                onClick={() => setSelectedLoanForContra(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              O setor financeiro avaliou sua margem salarial e apresentou uma condição ajustada para aprovação do empréstimo:
            </p>

            <div className="bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 rounded-xl p-4 text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-sans">Valor Proposto:</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatBrl(selectedLoanForContra.contraproposta.valorProposto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-sans">Quantidade de Parcelas:</span>
                <span className="text-slate-900 dark:text-white font-medium">{selectedLoanForContra.contraproposta.quantidadeParcelas}x mensais</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-sans">Taxa:</span>
                <span className="text-cyan-700 dark:text-cyan-300 font-bold">{selectedLoanForContra.contraproposta.taxaMensal}% a.m.</span>
              </div>
              <div className="pt-2 border-t border-purple-200 dark:border-purple-800/40 text-slate-700 dark:text-slate-300 font-sans text-[11px]">
                <strong className="text-purple-900 dark:text-purple-200">Justificativa da Escola:</strong> {selectedLoanForContra.contraproposta.motivo}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Caso aceite, o contrato será emitido imediatamente para sua assinatura digital. Caso recuse, a proposta será cancelada sem qualquer cobrança.
            </p>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                disabled={isAnsweringContra}
                onClick={() => handleResponderContraproposta(selectedLoanForContra.id, false)}
                className="px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300 text-xs font-semibold transition-colors"
              >
                Recusar Contraproposta
              </button>
              <button
                disabled={isAnsweringContra}
                onClick={() => handleResponderContraproposta(selectedLoanForContra.id, true)}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-sm shadow-purple-600/20 transition-colors"
              >
                {isAnsweringContra ? 'Processando...' : 'Aceitar Nova Condição'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
