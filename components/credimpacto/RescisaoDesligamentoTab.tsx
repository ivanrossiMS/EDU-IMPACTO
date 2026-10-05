'use client'

import React, { useState, useMemo } from 'react'
import {
  UserX,
  Scale,
  AlertTriangle,
  CheckCircle2,
  FileText,
  DollarSign,
  ArrowRight,
  ShieldAlert,
  Send
} from 'lucide-react'
import { CredImpactoEmprestimo, CredImpactoConfig } from '@/types/credimpacto'
import { calculateTerminationSeverance, formatBrl } from '@/lib/credimpacto/engine'
import { toast } from 'sonner'

interface RescisaoDesligamentoTabProps {
  emprestimos: CredImpactoEmprestimo[]
  config: CredImpactoConfig
  onRefresh: () => void
}

export function RescisaoDesligamentoTab({
  emprestimos,
  config,
  onRefresh
}: RescisaoDesligamentoTabProps) {
  const [selectedLoanId, setSelectedLoanId] = useState<string>('')
  const [salarioBase, setSalarioBase] = useState<number>(3500)
  const [verbasRescisorias, setVerbasRescisorias] = useState<number>(6000)
  const [tipoRescisao, setTipoRescisao] = useState<'sem_justa_causa' | 'com_justa_causa' | 'pedido_demissao' | 'acordo_mutuo'>('sem_justa_causa')
  const [formaPagamentoRemanescente, setFormaPagamentoRemanescente] = useState<'pix_a_vista' | 'parcelamento_avulso' | 'outro'>('pix_a_vista')
  const [observacoes, setObservacoes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Empréstimos com saldo em aberto (apenas ativos)
  const emprestimosComDivida = useMemo(() => {
    return emprestimos.filter((e) => e.status === 'ativo' && e.saldoDevedorAtual > 0)
  }, [emprestimos])

  const selectedLoan = useMemo(() => {
    return emprestimosComDivida.find((e) => e.id === selectedLoanId) || null
  }, [emprestimosComDivida, selectedLoanId])

  // Atualiza salário base ao selecionar o colaborador
  const handleSelectLoan = (loanId: string) => {
    setSelectedLoanId(loanId)
    const found = emprestimosComDivida.find((e) => e.id === loanId)
    if (found?.colaboradorSalarioBase) {
      setSalarioBase(found.colaboradorSalarioBase)
    }
  }

  // Executa o cálculo da rescisão CLT
  const calculoRescisao = useMemo(() => {
    if (!selectedLoan) return null
    return calculateTerminationSeverance(
      selectedLoan.saldoDevedorAtual,
      salarioBase,
      verbasRescisorias,
      config.limiteCompensacaoRescisaoCltPercentual || 100
    )
  }, [selectedLoan, salarioBase, verbasRescisorias, config.limiteCompensacaoRescisaoCltPercentual])

  const handleHomologarRescisao = async () => {
    if (!selectedLoan || !calculoRescisao) return
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/credimpacto/rescisao', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emprestimoId: selectedLoan.id,
          valorCompensadoNoTRCT: calculoRescisao.valorCompensadoNoTRCT,
          saldoRemanescente: calculoRescisao.saldoRemanescente,
          formaPagamentoRemanescente,
          observacoes
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao homologar rescisão')

      toast.success(
        calculoRescisao.saldoRemanescente <= 0
          ? `Compensação de ${formatBrl(calculoRescisao.valorCompensadoNoTRCT)} homologada. Empréstimo 100% quitado no TRCT!`
          : `Compensado ${formatBrl(calculoRescisao.valorCompensadoNoTRCT)} no TRCT. Saldo remanescente de ${formatBrl(calculoRescisao.saldoRemanescente)} registrado para pagamento avulso.`
      )

      setSelectedLoanId('')
      onRefresh()
    } catch (err: any) {
      toast.error(err.message || 'Falha ao homologar compensação rescisória')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO INFORMATIVO */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 flex items-start gap-3.5 shadow-sm">
        <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
          <Scale size={20} />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            Módulo de Desligamento e Compensação Rescisória (CLT Art. 477)
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
            Em conformidade com o <strong>Art. 477, § 5º da CLT</strong>, qualquer retenção ou compensação no TRCT não poderá exceder o valor equivalente a <strong>1 mês de remuneração</strong> do empregado. O CredImpacto separa com exatidão o saldo devedor, a parcela legalmente compensável e a diferença que continuará devida.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLUNA ESQUERDA: PARÂMETROS DO DESLIGAMENTO */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider">
            1. Dados da Rescisão
          </h3>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">
              Selecione a Operação / Colaborador em Desligamento
            </label>
            <select
              value={selectedLoanId}
              onChange={(e) => handleSelectLoan(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              <option value="">Selecione um contrato com dívida ativa...</option>
              {emprestimosComDivida.map((loan) => (
                <option key={loan.id} value={loan.id}>
                  {loan.colaboradorNome} • {loan.codigoOperacao} (Saldo: {formatBrl(loan.saldoDevedorAtual)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">
              Motivo do Desligamento
            </label>
            <select
              value={tipoRescisao}
              onChange={(e: any) => setTipoRescisao(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            >
              <option value="sem_justa_causa">Demissão sem Justa Causa</option>
              <option value="com_justa_causa">Demissão com Justa Causa</option>
              <option value="pedido_demissao">Pedido de Demissão pelo Colaborador</option>
              <option value="acordo_mutuo">Acordo Mútuo (Art. 484-A CLT)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">
              Remuneração Mensal Base (para Teto CLT)
            </label>
            <input
              type="number"
              step="0.01"
              value={salarioBase}
              onChange={(e) => setSalarioBase(Number(e.target.value))}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-400 mb-1">
              Saldo Líquido Rescisório no TRCT (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={verbasRescisorias}
              onChange={(e) => setVerbasRescisorias(Number(e.target.value))}
              placeholder="Total líquido disponível para compensação..."
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
            />
          </div>
        </div>

        {/* COLUNA DIREITA: RESULTADO DA ANÁLISE JURÍDICA E COMPENSAÇÃO */}
        <div className="lg:col-span-2 space-y-4">
          {!calculoRescisao ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs shadow-sm">
              Selecione um colaborador à esquerda para calcular a compensação rescisória.
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              {/* OS 4 PILARES DA SEPARAÇÃO RESCISÓRIA */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans uppercase font-semibold">Saldo Total Devedor</span>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-1">
                    {formatBrl(calculoRescisao.saldoDevedorTotal)}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans uppercase font-semibold">Teto Legal (1 Salário)</span>
                  <div className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1">
                    {formatBrl(calculoRescisao.tetoCompensacaoClt)}
                  </div>
                </div>

                <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-500/30 rounded-xl p-3.5">
                  <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-sans uppercase font-semibold">Retenção no TRCT</span>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {formatBrl(calculoRescisao.valorCompensadoNoTRCT)}
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans uppercase font-semibold">Saldo Remanescente</span>
                  <div className={`text-lg font-black mt-1 ${calculoRescisao.saldoRemanescente > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                    {formatBrl(calculoRescisao.saldoRemanescente)}
                  </div>
                </div>
              </div>

              {/* PARECER JURÍDICO FORMATADO */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 text-xs space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                  <ShieldAlert size={16} className="text-purple-600 dark:text-purple-400" />
                  <span>Parecer Legal da Operação:</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {calculoRescisao.parecerJuridico}
                </p>
                {calculoRescisao.excedeTetoClt && (
                  <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 p-2.5 rounded-lg border border-amber-200 dark:border-amber-500/20">
                    O saldo devedor excede o limite de 1 salário (Art. 477 da CLT). A escola <strong>NÃO pode</strong> descontar a totalidade da dívida diretamente na rescisão, devendo emitir termo de confissão de dívida para o saldo residual de {formatBrl(calculoRescisao.saldoRemanescente)}.
                  </div>
                )}
              </div>

              {/* PLANO DE PAGAMENTO DO SALDO REMANESCENTE */}
              {calculoRescisao.saldoRemanescente > 0 && (
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 text-xs space-y-3">
                  <div className="font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider text-[11px]">
                    Acordo para Quitação do Saldo Remanescente ({formatBrl(calculoRescisao.saldoRemanescente)}):
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer">
                      <input
                        type="radio"
                        name="formaRemanescente"
                        checked={formaPagamentoRemanescente === 'pix_a_vista'}
                        onChange={() => setFormaPagamentoRemanescente('pix_a_vista')}
                        className="text-emerald-600"
                      />
                      <span className="text-slate-800 dark:text-slate-200">Quitação à Vista via PIX no Desligamento</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 cursor-pointer">
                      <input
                        type="radio"
                        name="formaRemanescente"
                        checked={formaPagamentoRemanescente === 'parcelamento_avulso'}
                        onChange={() => setFormaPagamentoRemanescente('parcelamento_avulso')}
                        className="text-emerald-600"
                      />
                      <span className="text-slate-800 dark:text-slate-200">Termo de Confissão & Parcelamento Avulso</span>
                    </label>
                  </div>
                </div>
              )}

              {/* BOTÃO DE HOMOLOGAÇÃO */}
              <div className="pt-2 flex justify-end">
                <button
                  disabled={isSubmitting}
                  onClick={handleHomologarRescisao}
                  className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm shadow-purple-600/20 flex items-center gap-2 transition-all active:scale-98 disabled:opacity-50"
                >
                  <Send size={14} />
                  <span>
                    {isSubmitting ? 'Homologando...' : 'Homologar Compensação Rescisória no Sistema'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
