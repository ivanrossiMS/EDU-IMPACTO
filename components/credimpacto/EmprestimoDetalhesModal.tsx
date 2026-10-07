'use client'

import React, { useState } from 'react'
import {
  FileText,
  Calendar,
  Building,
  CheckCircle2,
  Clock,
  Printer,
  ShieldCheck,
  Calculator,
  History,
  FileCheck2,
  ExternalLink,
  Download,
  AlertCircle,
  Trash2
} from 'lucide-react'
import { CredImpactoEmprestimo } from '@/types/credimpacto'
import { formatBrl, METODOS_LABELS } from '@/lib/credimpacto/engine'

interface EmprestimoDetalhesModalProps {
  loan: CredImpactoEmprestimo | null
  onClose: () => void
  onOpenSignModal?: (loan: CredImpactoEmprestimo) => void
  onOpenPayoffModal?: (loan: CredImpactoEmprestimo) => void
  onDirectApprove?: (loan: CredImpactoEmprestimo) => void
  onDelete?: (loan: CredImpactoEmprestimo) => void
  isAdminOrFinance: boolean
}

export function EmprestimoDetalhesModal({
  loan,
  onClose,
  onOpenSignModal,
  onOpenPayoffModal,
  onDirectApprove,
  onDelete,
  isAdminOrFinance
}: EmprestimoDetalhesModalProps) {
  const [activeSubTab, setActiveSubTab] = useState<'resumo' | 'parcelas' | 'contrato' | 'memoria'>('resumo')

  if (!loan) return null

  const justificativaTexto =
    loan.justificativaSolicitacao ||
    (loan as any).justificativa ||
    (loan as any).observacao ||
    (loan as any).observacoes
  const finalidadeTexto = loan.finalidade || (loan as any).motivo

  const handlePrintContract = () => {
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Contrato - ${loan.codigoOperacao}</title>
            <style>
              body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #fff; color: #000; }
              @media print {
                body { padding: 0; }
                button { display: none; }
              }
            </style>
          </head>
          <body>
            ${loan.contratoConteudoHtml || '<p>Contrato em processamento...</p>'}
            <script>
              window.onload = function() { window.print(); }
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* HEADER DO MODAL */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/60 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-mono font-bold text-xs">
              {loan.codigoOperacao.split('-')[2] || 'CRED'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono">{loan.codigoOperacao}</h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {loan.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Colaborador: <strong className="text-slate-800 dark:text-slate-200">{loan.colaboradorNome}</strong> • CPF: {loan.colaboradorCpf}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isAdminOrFinance && onDirectApprove && (loan.status === 'aguardando_assinatura' || loan.status === 'solicitado') && (
              <button
                onClick={() => onDirectApprove(loan)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-all"
                title="Aprovar Diretamente (Dispensar Autorização do Colaborador)"
              >
                <CheckCircle2 size={14} />
                <span>Aprovar Direto</span>
              </button>
            )}
            {isAdminOrFinance && onDelete && (
              <button
                onClick={() => onDelete(loan)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 border border-rose-200/80 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 text-xs font-semibold transition-all"
                title="Excluir Empréstimo"
              >
                <Trash2 size={14} />
                <span className="hidden sm:inline">Excluir</span>
              </button>
            )}
            <button
              onClick={handlePrintContract}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Imprimir Contrato</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* NAVEGAÇÃO DE SUB-ABAS */}
        <div className="flex items-center gap-4 px-5 pt-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            onClick={() => setActiveSubTab('resumo')}
            className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-all ${
              activeSubTab === 'resumo'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Resumo & Financeiro
          </button>
          <button
            onClick={() => setActiveSubTab('parcelas')}
            className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-all ${
              activeSubTab === 'parcelas'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Cronograma de Parcelas ({loan.parcelas?.length || 0})
          </button>
          <button
            onClick={() => setActiveSubTab('contrato')}
            className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-all ${
              activeSubTab === 'contrato'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Contrato & Assinatura
          </button>
          <button
            onClick={() => setActiveSubTab('memoria')}
            className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-all ${
              activeSubTab === 'memoria'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Memória de Cálculo
          </button>
        </div>

        {/* CONTEÚDO SCROLLÁVEL */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* ABA 1: RESUMO */}
          {activeSubTab === 'resumo' && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* CARDS DE VALORES PRINCIPAIS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-sans font-semibold">Valor Concedido</span>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{formatBrl(loan.valorAprovado)}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-sans font-semibold">Saldo Devedor Atual</span>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{formatBrl(loan.saldoDevedorAtual)}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-sans font-semibold">Total de Juros</span>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">{formatBrl(loan.totalJuros)}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-sans font-semibold">Total a Pagar</span>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5">{formatBrl(loan.totalAPagar)}</div>
                </div>
              </div>

              {/* DETALHES CADASTRAIS E POLÍTICAS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-[11px] mb-2">
                    Condições do Mútuo:
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Quantidade de Parcelas:</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-white">{loan.quantidadeParcelas} parcelas mensais</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Taxa de Juros:</span>
                    <span className="font-mono font-bold text-cyan-700 dark:text-cyan-400">{loan.taxaMensal}% ao mês</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Método de Amortização:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold">{METODOS_LABELS[loan.metodoCalculo]?.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Origem da Proposta:</span>
                    <span className="text-slate-800 dark:text-slate-200 capitalize font-medium">{loan.criadoPorTipo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Data de Solicitação:</span>
                    <span className="text-slate-700 dark:text-slate-300">{new Date(loan.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                  {finalidadeTexto && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400 font-sans">Finalidade:</span>
                      <span className="text-slate-800 dark:text-slate-200 font-semibold">{finalidadeTexto}</span>
                    </div>
                  )}
                </div>

                {/* DADOS BANCÁRIOS E LIBERAÇÃO */}
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-[11px] mb-2 flex items-center justify-between">
                    <span>Liberação Financeira:</span>
                    {loan.comprovanteLiberacaoUrl && (
                      <a
                        href={loan.comprovanteLiberacaoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-700 dark:text-cyan-400 underline font-semibold flex items-center gap-1"
                      >
                        <ExternalLink size={12} /> Comprovante
                      </a>
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Chave PIX:</span>
                    <span className="font-mono font-medium text-slate-900 dark:text-white">{loan.dadosBancarios?.chavePix || 'Não informada'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Banco / Ag / Conta:</span>
                    <span className="font-mono text-slate-700 dark:text-slate-200">
                      {loan.dadosBancarios?.banco ? `${loan.dadosBancarios.banco} • Ag: ${loan.dadosBancarios.agencia} • Cc: ${loan.dadosBancarios.conta}` : 'Não informado'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Data da Liberação:</span>
                    <span className="text-slate-700 dark:text-slate-200">
                      {loan.dataLiberacao ? new Date(loan.dataLiberacao).toLocaleDateString('pt-BR') : 'Pendente de liberação'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Liberado por:</span>
                    <span className="text-slate-700 dark:text-slate-200">{loan.liberadoPorNome || '-'}</span>
                  </div>
                </div>
              </div>

              {/* JUSTIFICATIVA OU OBSERVAÇÕES */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-[11px] mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileText size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Justificativa ou Observações:</span>
                  </div>
                  {finalidadeTexto && (
                    <span className="text-[10.5px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80">
                      Finalidade: {finalidadeTexto}
                    </span>
                  )}
                </div>
                {justificativaTexto ? (
                  <div className="text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900/90 border border-slate-200/70 dark:border-slate-700/60 rounded-xl p-3.5 whitespace-pre-wrap leading-relaxed shadow-2xs font-normal">
                    {justificativaTexto}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 dark:text-slate-500 italic bg-white/40 dark:bg-slate-900/30 border border-dashed border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5">
                    Nenhuma justificativa ou observação informada na proposta.
                  </div>
                )}
              </div>

              {/* AVISOS CONTEXTUAIS */}
              {loan.status === 'aguardando_assinatura' && (
                <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
                      <span>{isAdminOrFinance ? 'Aprovação Direta Disponível (Administrador)' : 'Contrato Aprovado e Pronto para Assinatura'}</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                      {isAdminOrFinance
                        ? 'Como Administrador, você pode aprovar este empréstimo diretamente, dispensando a necessidade de autorização ou assinatura do colaborador.'
                        : 'Para dar continuidade à liberação dos fundos, efetue a assinatura eletrônica com aceite da autorização de desconto em folha.'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isAdminOrFinance && onDirectApprove && (
                      <button
                        onClick={() => onDirectApprove(loan)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 shadow-sm shadow-emerald-600/20 transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 size={14} />
                        <span>Aprovar Direto</span>
                      </button>
                    )}
                    {onOpenSignModal && (
                      <button
                        onClick={() => onOpenSignModal(loan)}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 shadow-sm shadow-blue-600/20 transition-colors"
                      >
                        {isAdminOrFinance ? 'Abrir Assinatura do Colaborador' : 'Aceitar e Assinar'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {loan.status === 'solicitado' && isAdminOrFinance && onDirectApprove && (
                <div className="p-4 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <Clock size={16} className="text-amber-600 dark:text-amber-400" />
                      <span>Solicitação Pendente de Análise / Aprovação</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                      Você pode aprovar este empréstimo diretamente sem exigir a assinatura prévia do colaborador.
                    </div>
                  </div>
                  <button
                    onClick={() => onDirectApprove(loan)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 shadow-sm shadow-emerald-600/20 transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 size={14} />
                    <span>Aprovar Direto</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ABA 2: CRONOGRAMA DE PARCELAS */}
          {activeSubTab === 'parcelas' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Parcelas vinculadas ao desconto em folha de pagamento no quinto dia útil:
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {(loan.parcelas || []).filter((p) => p.status === 'descontada' || p.status === 'paga_avulso').length} de {loan.quantidadeParcelas} pagas
                </span>
              </div>

              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-2 text-center w-9 whitespace-nowrap">Nº</th>
                      <th className="py-2.5 px-2 text-center whitespace-nowrap">Competência</th>
                      <th className="py-2.5 px-2 text-center whitespace-nowrap">Vencimento</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">Amortização</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">Juros</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">Total Parcela</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">Saldo Devedor</th>
                      <th className="py-2.5 px-2 text-center whitespace-nowrap">Situação</th>
                      <th className="py-2.5 px-2 text-center whitespace-nowrap w-24">Comprovante</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                    {(loan.parcelas || []).map((p) => {
                      const isPaid = p.status === 'descontada' || p.status === 'paga_avulso'

                      return (
                        <tr key={p.numero} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                          <td className="py-2 px-2 text-center font-bold text-slate-700 dark:text-slate-300 w-9">{p.numero}</td>
                          <td className="py-2 px-2 text-center text-slate-700 dark:text-slate-300 whitespace-nowrap">{p.competencia}</td>
                          <td className="py-2 px-2 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {new Date(p.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-200 whitespace-nowrap">{formatBrl(p.valorAmortizacao)}</td>
                          <td className="py-2 px-2 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatBrl(p.valorJuros)}</td>
                          <td className="py-2 px-2 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">{formatBrl(p.valorTotal)}</td>
                          <td className="py-2 px-2 text-right font-bold text-cyan-700 dark:text-cyan-400 whitespace-nowrap">{formatBrl(p.saldoDevedorApos)}</td>
                          <td className="py-2 px-2 text-center whitespace-nowrap">
                            <span
                              className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap ${
                                isPaid
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                                  : p.status === 'atrasada'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                              }`}
                            >
                              {p.status === 'descontada' ? 'Descontada' : p.status === 'paga_avulso' ? 'Paga Avulso' : p.status === 'atrasada' ? 'Em Atraso' : 'A Vencer'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center font-sans whitespace-nowrap">
                            {p.comprovanteUrl ? (
                              <a
                                href={p.comprovanteUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-cyan-700 dark:text-cyan-400 font-semibold hover:underline text-xs"
                              >
                                Ver
                              </a>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ABA 3: CONTRATO & ASSINATURA */}
          {activeSubTab === 'contrato' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className={loan.assinadoEm ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'} />
                  <span>
                    Status da Assinatura:{' '}
                    <strong className={loan.assinadoEm ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                      {loan.assinadoEm ? 'Assinado Eletronicamente' : 'Pendente de Assinatura'}
                    </strong>
                  </span>
                </div>
                {loan.codigoVerificacaoAssinatura && (
                  <div className="font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    Cód. Verificação: <code className="text-cyan-700 dark:text-cyan-400 font-bold">{loan.codigoVerificacaoAssinatura}</code>
                  </div>
                )}
              </div>

              {/* VISUALIZAÇÃO DO CONTRATO HTML */}
              <div className="bg-white rounded-xl p-6 shadow-sm text-slate-900 border border-slate-200 dark:border-slate-700 max-h-[55vh] overflow-y-auto">
                <div
                  dangerouslySetInnerHTML={{
                    __html: loan.contratoConteudoHtml || '<p>Contrato em geração...</p>'
                  }}
                />
              </div>
            </div>
          )}

          {/* ABA 4: MEMÓRIA DE CÁLCULO */}
          {activeSubTab === 'memoria' && (
            <div className="space-y-4 animate-in fade-in duration-200 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="font-bold text-cyan-800 dark:text-cyan-300 uppercase tracking-wider text-[11px]">
                  Fórmula e Parâmetros Utilizados
                </div>
                <p className="text-slate-600 dark:text-slate-300">{METODOS_LABELS[loan.metodoCalculo]?.descricao}</p>
                <code className="block bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-cyan-700 dark:text-cyan-400 text-[11px]">
                  {METODOS_LABELS[loan.metodoCalculo]?.formula}
                </code>
              </div>

              {loan.memoriaCalculo?.itens && (
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-[11px] mb-2">
                    Decomposição dos Valores:
                  </div>
                  {loan.memoriaCalculo.itens.map((item, idx) => (
                    <div key={idx} className="flex flex-col border-b border-slate-200/60 dark:border-slate-800/80 pb-2 last:border-none">
                      <span className="font-semibold text-slate-800 dark:text-slate-300">{item.etapa}:</span>
                      <span className="text-slate-600 dark:text-slate-400 text-[11px]">{item.descricao}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
