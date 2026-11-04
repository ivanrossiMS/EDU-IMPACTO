'use client'

import React, { useState, useEffect } from 'react'
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
  Trash2,
  Copy,
  MessageCircle,
  Receipt,
  Upload,
  RotateCcw,
  Layers,
  CheckSquare,
  Sparkles
} from 'lucide-react'
import { CredImpactoEmprestimo } from '@/types/credimpacto'
import { formatBrl, METODOS_LABELS } from '@/lib/credimpacto/engine'
import {
  buildCredImpactoWhatsAppMessage,
  getCredImpactoWhatsAppUrl,
  resolveColaboradorPhone
} from '@/lib/credimpacto/whatsappTemplates'
import { toast } from 'sonner'
import {
  BaixaParcelasModal,
  EstornoParcelasModal,
  ParcelaComContexto
} from './BaixaParcelasModal'

export type EmprestimoDetalhesSubTab = 'resumo' | 'parcelas' | 'contrato' | 'comprovante' | 'memoria'

interface EmprestimoDetalhesModalProps {
  loan: CredImpactoEmprestimo | null
  initialSubTab?: EmprestimoDetalhesSubTab
  onClose: () => void
  onOpenSignModal?: (loan: CredImpactoEmprestimo) => void
  onOpenPayoffModal?: (loan: CredImpactoEmprestimo) => void
  onDirectApprove?: (loan: CredImpactoEmprestimo) => void
  onDelete?: (loan: CredImpactoEmprestimo) => void
  onRefresh?: () => void
  isAdminOrFinance: boolean
}

export function EmprestimoDetalhesModal({
  loan: loanProp,
  initialSubTab = 'resumo',
  onClose,
  onOpenSignModal,
  onOpenPayoffModal,
  onDirectApprove,
  onDelete,
  onRefresh,
  isAdminOrFinance
}: EmprestimoDetalhesModalProps) {
  const [currentLoan, setCurrentLoan] = useState<CredImpactoEmprestimo | null>(loanProp)
  const [activeSubTab, setActiveSubTab] = useState<EmprestimoDetalhesSubTab>(initialSubTab)
  const [localComprovanteUrl, setLocalComprovanteUrl] = useState<string | undefined>(
    loanProp?.comprovanteLiberacaoUrl
  )
  const [isUploadingComprovante, setIsUploadingComprovante] = useState(false)
  const [selectedParcelaIds, setSelectedParcelaIds] = useState<string[]>([])
  const [baixaModalState, setBaixaModalState] = useState<{
    parcelasInicial: ParcelaComContexto[]
    todasParcelasContexto?: ParcelaComContexto[]
  } | null>(null)
  const [estornoModalParcelas, setEstornoModalParcelas] = useState<ParcelaComContexto[] | null>(
    null
  )

  useEffect(() => {
    setCurrentLoan(loanProp)
  }, [loanProp])

  useEffect(() => {
    setActiveSubTab(initialSubTab || 'resumo')
    setSelectedParcelaIds([])
  }, [loanProp?.id, initialSubTab])

  useEffect(() => {
    setLocalComprovanteUrl(loanProp?.comprovanteLiberacaoUrl)
  }, [loanProp?.id, loanProp?.comprovanteLiberacaoUrl])

  if (!currentLoan) return null
  const loan = currentLoan

  const parcelasDoContrato: ParcelaComContexto[] = (loan.parcelas || []).map((p, idx) => ({
    ...p,
    id: p.id || `${loan.id}_parc_${p.numero ?? idx + 1}`,
    emprestimoId: p.emprestimoId || loan.id,
    colaboradorNome: loan.colaboradorNome,
    colaboradorCpf: loan.colaboradorCpf,
    codigoOperacao: loan.codigoOperacao,
    quantidadeParcelas: loan.quantidadeParcelas
  }))

  const parcelasPendentesContrato = parcelasDoContrato.filter(
    (p) =>
      p.status !== 'descontada' &&
      p.status !== 'paga_avulso' &&
      p.status !== 'cancelada'
  )

  const parcelasPagasContrato = parcelasDoContrato.filter(
    (p) => p.status === 'descontada' || p.status === 'paga_avulso'
  )

  const selecionadasObjetos = parcelasDoContrato.filter((p) =>
    selectedParcelaIds.includes(p.id)
  )
  const selecionadasPendentes = selecionadasObjetos.filter(
    (p) =>
      p.status !== 'descontada' &&
      p.status !== 'paga_avulso' &&
      p.status !== 'cancelada'
  )
  const selecionadasPagas = selecionadasObjetos.filter(
    (p) => p.status === 'descontada' || p.status === 'paga_avulso'
  )
  const allPendingSelected =
    parcelasPendentesContrato.length > 0 &&
    parcelasPendentesContrato.every((p) => selectedParcelaIds.includes(p.id))

  const toggleSelectParcela = (id: string) => {
    setSelectedParcelaIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAllPending = () => {
    if (allPendingSelected) {
      const pendingSet = new Set(parcelasPendentesContrato.map((p) => p.id))
      setSelectedParcelaIds((prev) => prev.filter((id) => !pendingSet.has(id)))
    } else {
      setSelectedParcelaIds((prev) =>
        Array.from(new Set([...prev, ...parcelasPendentesContrato.map((p) => p.id)]))
      )
    }
  }

  const effectiveComprovanteUrl = localComprovanteUrl || loan.comprovanteLiberacaoUrl
  const isImageReceipt = Boolean(
    effectiveComprovanteUrl &&
      (/\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(effectiveComprovanteUrl) ||
        effectiveComprovanteUrl.startsWith('data:image/'))
  )

  const handleUploadComprovante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingComprovante(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('pasta', 'liberacoes')

      const upRes = await fetch('/api/credimpacto/comprovante', {
        method: 'POST',
        body: formData
      })
      const upData = await upRes.json()
      if (!upRes.ok) throw new Error(upData.error || 'Erro no upload do comprovante')

      const saveRes = await fetch(`/api/credimpacto/emprestimos/${loan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'atualizar_comprovante_liberacao',
          comprovanteLiberacaoUrl: upData.url
        })
      })
      const saveData = await saveRes.json()
      if (!saveRes.ok) throw new Error(saveData.error || 'Erro ao vincular comprovante ao empréstimo')

      setLocalComprovanteUrl(upData.url)
      toast.success('Comprovante de transferência anexado com sucesso!')
      onRefresh?.()
    } catch (err: any) {
      toast.error(err.message || 'Falha ao anexar comprovante de transferência')
    } finally {
      setIsUploadingComprovante(false)
      e.target.value = ''
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copiado!`)
  }

  const handleSendWhatsAppSchedule = () => {
    const phone = resolveColaboradorPhone(loan)
    const msg = buildCredImpactoWhatsAppMessage(loan, 'contrato_cronograma')
    const url = getCredImpactoWhatsAppUrl(phone, msg)
    window.open(url, '_blank', 'noopener,noreferrer')
    toast.success('Abrindo WhatsApp com os dados do contrato e cronograma!')
  }

  const handleCopyWhatsAppSchedule = () => {
    const msg = buildCredImpactoWhatsAppMessage(loan, 'contrato_cronograma')
    navigator.clipboard.writeText(msg)
    toast.success('Extrato do contrato e cronograma copiado!')
  }

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

  const isDispensaAdmin = Boolean(
    loan.aprovadoDiretoPorNome ||
    (loan.codigoVerificacaoAssinatura && loan.codigoVerificacaoAssinatura.startsWith('VAL-ADM-')) ||
    loan.assinanteDocumento === 'Autorização Administrativa'
  )
  const isSignedByColaborador = Boolean(loan.assinadoEm && !isDispensaAdmin)
  const formattedSignatureDate = loan.assinadoEm
    ? new Date(loan.assinadoEm).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : ''
  const sigBadgeLabel = isSignedByColaborador
    ? 'Contrato Assinado'
    : isDispensaAdmin
    ? 'S/ Assinatura (Admin)'
    : 'Não Assinado'
  const sigBadgeClass = isSignedByColaborador
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60'
    : isDispensaAdmin
    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60'
    : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl w-[96vw] max-w-[1080px] h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* HEADER DO MODAL */}
        <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0 bg-slate-50/60 dark:bg-slate-950/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
              {loan.codigoOperacao.split('-')[2] || 'CRED'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white font-mono">{loan.codigoOperacao}</h3>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  {loan.status}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${sigBadgeClass}`}>
                  {isSignedByColaborador ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                  <span>{sigBadgeLabel}</span>
                </span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Colaborador: <strong className="text-slate-800 dark:text-slate-200">{loan.colaboradorNome}</strong> • CPF: {loan.colaboradorCpf}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap justify-end shrink-0">
            {isAdminOrFinance && parcelasPendentesContrato.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (activeSubTab !== 'parcelas') {
                    setActiveSubTab('parcelas')
                  } else {
                    setBaixaModalState({
                      parcelasInicial:
                        selecionadasPendentes.length > 0
                          ? selecionadasPendentes
                          : parcelasPendentesContrato,
                      todasParcelasContexto: parcelasPendentesContrato
                    })
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold shadow-xs transition-all whitespace-nowrap"
                title="Dar baixa em 1, várias ou todas as parcelas deste contrato"
              >
                <CheckCircle2 size={13} />
                <span>
                  {activeSubTab === 'parcelas'
                    ? selecionadasPendentes.length > 0
                      ? `Baixar (${selecionadasPendentes.length})`
                      : `Baixar Todas (${parcelasPendentesContrato.length})`
                    : `Baixar Parcelas (${parcelasPendentesContrato.length})`}
                </span>
              </button>
            )}
            {(effectiveComprovanteUrl || isAdminOrFinance) && (
              <button
                type="button"
                onClick={() => setActiveSubTab('comprovante')}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all whitespace-nowrap ${
                  effectiveComprovanteUrl
                    ? 'bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/50 dark:hover:bg-cyan-900/50 border-cyan-200 dark:border-cyan-800/60 text-cyan-700 dark:text-cyan-300'
                    : 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/50 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300'
                }`}
                title={effectiveComprovanteUrl ? 'Ver Comprovante de Transferência' : 'Anexar Comprovante de Transferência'}
              >
                <Receipt size={13} />
                <span>{effectiveComprovanteUrl ? 'Ver Comprovante' : 'Anexar Comprovante'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleSendWhatsAppSchedule}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold transition-all whitespace-nowrap"
              title="Enviar Detalhes do Contrato e Cronograma de Parcelas pelo WhatsApp"
            >
              <MessageCircle size={13} />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={handleCopyWhatsAppSchedule}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-all whitespace-nowrap"
              title="Copiar Extrato e Cronograma em Texto"
            >
              <Copy size={13} />
              <span className="hidden sm:inline">Extrato</span>
            </button>
            <button
              onClick={handlePrintContract}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-semibold transition-all whitespace-nowrap"
              title="Imprimir Contrato"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Imprimir</span>
            </button>
            {isAdminOrFinance && onDelete && (
              <button
                onClick={() => onDelete(loan)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 border border-rose-200/80 dark:border-rose-800/40 text-rose-600 dark:text-rose-400 text-[11px] font-semibold transition-all whitespace-nowrap"
                title="Excluir Empréstimo"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Excluir</span>
              </button>
            )}
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
            onClick={() => setActiveSubTab('comprovante')}
            className={`pb-2.5 px-2 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeSubTab === 'comprovante'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Receipt size={13} />
            <span>Comprovante de Transferência</span>
            {effectiveComprovanteUrl && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" title="Comprovante anexado" />
            )}
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
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-sans font-semibold">Total de Juros ({loan.taxaMensal}% a.m.)</span>
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
                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/70 dark:border-slate-700/70">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Assinatura do Contrato:</span>
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1 ${sigBadgeClass}`}>
                      {isSignedByColaborador ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                      <span>
                        {isSignedByColaborador
                          ? `Assinado em ${formattedSignatureDate}`
                          : isDispensaAdmin
                          ? `Sem assinatura (Aprovado por ${loan.aprovadoDiretoPorNome || 'Admin'})`
                          : 'Não Assinado'}
                      </span>
                    </span>
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
                  <div className="font-bold text-slate-900 dark:text-slate-200 uppercase tracking-wider text-[11px] mb-2 flex items-center justify-between gap-2">
                    <span>Liberação Financeira:</span>
                    <div className="flex items-center gap-1.5 normal-case">
                      {effectiveComprovanteUrl ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setActiveSubTab('comprovante')}
                            className="px-2 py-0.5 rounded-md bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 font-bold text-[10px] flex items-center gap-1 transition-colors"
                            title="Visualizar comprovante de transferência"
                          >
                            <Receipt size={11} /> Ver Comprovante
                          </button>
                          <a
                            href={effectiveComprovanteUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-0.5 rounded-md bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200/80 dark:border-cyan-800/60 font-bold text-[10px] flex items-center gap-1 transition-colors"
                            title="Abrir comprovante em nova guia"
                          >
                            <ExternalLink size={11} /> Abrir
                          </a>
                        </>
                      ) : isAdminOrFinance ? (
                        <button
                          type="button"
                          onClick={() => setActiveSubTab('comprovante')}
                          className="px-2 py-0.5 rounded-md bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 font-bold text-[10px] flex items-center gap-1 transition-colors"
                        >
                          <Upload size={11} /> Anexar Comprovante
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-medium">Sem comprovante</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Chave PIX:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-medium text-slate-900 dark:text-white">
                        {loan.dadosBancarios?.chavePix || loan.colaboradorCpf || 'Não informada'}
                      </span>
                      {(loan.dadosBancarios?.chavePix || loan.colaboradorCpf) && (
                        <button
                          type="button"
                          onClick={() => copyToClipboard(loan.dadosBancarios?.chavePix || loan.colaboradorCpf, 'Chave PIX')}
                          className="px-2 py-0.5 rounded-md bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200/70 dark:border-cyan-800/60 font-bold text-[10px] flex items-center gap-1 transition-colors"
                          title="Copiar Chave PIX"
                        >
                          <Copy size={11} />
                          <span>Copiar</span>
                        </button>
                      )}
                    </div>
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
                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/70 dark:border-slate-700/70">
                    <span className="text-slate-500 dark:text-slate-400 font-sans">Comprovante de Transferência:</span>
                    {effectiveComprovanteUrl ? (
                      <button
                        type="button"
                        onClick={() => setActiveSubTab('comprovante')}
                        className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold text-[11px] flex items-center gap-1"
                      >
                        <CheckCircle2 size={12} /> Visualizar comprovante anexado
                      </button>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500 text-[11px] italic">Não anexado</span>
                    )}
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
                      <span>Contrato Aprovado e Pronto para Assinatura</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                      Para dar continuidade à liberação dos fundos, efetue a assinatura eletrônica com aceite da autorização de desconto em folha.
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
            </div>
          )}

          {/* ABA 2: CRONOGRAMA DE PARCELAS */}
          {activeSubTab === 'parcelas' && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* BARRA DE PROGRESSO E AÇÕES DE BAIXA (1, VÁRIAS OU TODAS) */}
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">
                      Parcelas vinculadas ao desconto em folha de pagamento no quinto dia útil:
                    </span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {parcelasPagasContrato.length} de {loan.quantidadeParcelas} pagas
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round(
                            (parcelasPagasContrato.length /
                              Math.max(1, loan.quantidadeParcelas)) *
                              100
                          )
                        )}%`
                      }}
                    />
                  </div>
                </div>

                {isAdminOrFinance && (
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {selecionadasPendentes.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setBaixaModalState({
                            parcelasInicial: selecionadasPendentes,
                            todasParcelasContexto: parcelasPendentesContrato
                          })
                        }
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs inline-flex items-center gap-1.5 shadow-sm transition"
                      >
                        <CheckSquare size={14} />
                        <span>
                          Baixar Selecionadas ({selecionadasPendentes.length})
                        </span>
                      </button>
                    )}

                    {parcelasPendentesContrato.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setBaixaModalState({
                            parcelasInicial: parcelasPendentesContrato,
                            todasParcelasContexto: parcelasPendentesContrato
                          })
                        }
                        className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-extrabold text-xs inline-flex items-center gap-1.5 transition"
                        title="Dar baixa em todas as parcelas pendentes deste contrato"
                      >
                        <Layers size={14} />
                        <span>
                          Baixar Todas ({parcelasPendentesContrato.length})
                        </span>
                      </button>
                    )}

                    {selecionadasPagas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setEstornoModalParcelas(selecionadasPagas)}
                        className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs inline-flex items-center gap-1.5 transition"
                      >
                        <RotateCcw size={13} />
                        <span>Estornar ({selecionadasPagas.length})</span>
                      </button>
                    )}

                    {onOpenPayoffModal && loan.status === 'ativo' && (
                      <button
                        type="button"
                        onClick={() => onOpenPayoffModal(loan)}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs inline-flex items-center gap-1.5 transition"
                        title="Abrir calculadora de quitação antecipada com recálculo de saldo"
                      >
                        <Sparkles size={13} className="text-amber-500" />
                        <span>Quitação Antecipada</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div
                className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-x-auto"
                tabIndex={0}
                role="region"
                aria-label={`Cronograma de parcelas do contrato ${loan.codigoOperacao}`}
              >
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      {isAdminOrFinance && (
                        <th className="py-2.5 px-2 text-center w-8">
                          <input
                            type="checkbox"
                            checked={allPendingSelected}
                            onChange={toggleSelectAllPending}
                            disabled={parcelasPendentesContrato.length === 0}
                            title="Selecionar todas as parcelas pendentes"
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-40"
                          />
                        </th>
                      )}
                      <th className="py-2.5 px-1.5 text-center w-9 whitespace-nowrap">Nº</th>
                      <th className="py-2.5 px-2 text-center whitespace-nowrap">Competência</th>
                      <th className="py-2.5 px-2 text-center whitespace-nowrap">Vencimento</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">Amortização</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">Juros</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">Total Parcela</th>
                      <th className="py-2.5 px-2 text-right whitespace-nowrap">Saldo Devedor</th>
                      <th className="py-2.5 px-2 text-center whitespace-nowrap">Situação</th>
                      <th className="py-2.5 px-2.5 text-right whitespace-nowrap">
                        {isAdminOrFinance ? 'Ação' : 'Comprovante'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                    {parcelasDoContrato.map((p) => {
                      const isPaid = p.status === 'descontada' || p.status === 'paga_avulso'
                      const isChecked = selectedParcelaIds.includes(p.id)

                      return (
                        <tr
                          key={p.id}
                          className={`transition-colors ${
                            isChecked
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/30'
                              : isPaid
                                ? 'bg-slate-50/40 dark:bg-slate-900/40 hover:bg-slate-50/80'
                                : 'hover:bg-slate-50/70 dark:hover:bg-white/5'
                          }`}
                        >
                          {isAdminOrFinance && (
                            <td className="py-2 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleSelectParcela(p.id)}
                                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                aria-label={`Selecionar parcela #${p.numero}`}
                              />
                            </td>
                          )}
                          <td className="py-2 px-1.5 text-center font-bold text-slate-700 dark:text-slate-300 w-9">
                            {p.numero}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {p.competencia}
                          </td>
                          <td className="py-2 px-2 text-center text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {new Date(p.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-200 whitespace-nowrap">
                            {formatBrl(p.valorAmortizacao)}
                          </td>
                          <td className="py-2 px-2 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatBrl(p.valorJuros)}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                            <div>{formatBrl(p.valorTotal)}</div>
                            {isPaid && p.valorPago !== undefined && p.valorPago !== p.valorTotal && (
                              <div className="text-[9px] text-emerald-600 font-sans font-bold">
                                Pago: {formatBrl(p.valorPago)}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-bold text-cyan-700 dark:text-cyan-400 whitespace-nowrap">
                            {formatBrl(p.saldoDevedorApos)}
                          </td>
                          <td className="py-2 px-2 text-center whitespace-nowrap font-sans">
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <span
                                className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap ${
                                  isPaid
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40'
                                    : p.status === 'atrasada'
                                      ? 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40'
                                      : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {p.status === 'descontada'
                                  ? 'Descontada'
                                  : p.status === 'paga_avulso'
                                    ? 'Paga Avulso'
                                    : p.status === 'atrasada'
                                      ? 'Em Atraso'
                                      : 'A Vencer'}
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
                          <td className="py-2 px-2.5 text-right font-sans whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                              {p.comprovanteUrl && (
                                <a
                                  href={p.comprovanteUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-2 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 font-bold text-[10px] inline-flex items-center gap-1"
                                  title="Ver comprovante da parcela"
                                >
                                  <ExternalLink size={11} />
                                  <span>Recibo</span>
                                </a>
                              )}

                              {isAdminOrFinance && !isPaid && p.status !== 'cancelada' && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setBaixaModalState({
                                      parcelasInicial: [p],
                                      todasParcelasContexto: parcelasPendentesContrato
                                    })
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow-xs transition"
                                  title="Dar baixa nesta parcela (ou selecionar várias)"
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

                              {!isAdminOrFinance && !p.comprovanteUrl && (
                                <span className="text-slate-400 text-xs">-</span>
                              )}
                            </div>
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
                  <ShieldCheck
                    size={16}
                    className={
                      isSignedByColaborador
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isDispensaAdmin
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-rose-500 dark:text-rose-400'
                    }
                  />
                  <span>
                    Status da Assinatura:{' '}
                    <strong
                      className={
                        isSignedByColaborador
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isDispensaAdmin
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }
                    >
                      {isSignedByColaborador
                        ? `Assinado Eletronicamente pelo Colaborador (${formattedSignatureDate})`
                        : isDispensaAdmin
                        ? `Não Assinado pelo Colaborador (Aprovado s/ assinatura por ${loan.aprovadoDiretoPorNome || 'Admin'})`
                        : 'Não Assinado (Pendente de Assinatura)'}
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

          {/* ABA 4: COMPROVANTE DE TRANSFERÊNCIA */}
          {activeSubTab === 'comprovante' && (
            <div className="space-y-4 animate-in fade-in duration-200 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 text-sm">
                    <Receipt size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Comprovante de Transferência (PIX / TED)</span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Valor transferido: <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatBrl(loan.valorAprovado)}</strong>
                    {loan.dataLiberacao && (
                      <>
                        {' • '}Data: <strong className="text-slate-800 dark:text-slate-200">{new Date(loan.dataLiberacao).toLocaleDateString('pt-BR')}</strong>
                      </>
                    )}
                    {loan.liberadoPorNome && (
                      <>
                        {' • '}Liberado por: <strong className="text-slate-800 dark:text-slate-200">{loan.liberadoPorNome}</strong>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {effectiveComprovanteUrl && (
                    <>
                      <a
                        href={effectiveComprovanteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors"
                      >
                        <ExternalLink size={13} />
                        <span>Abrir em Nova Guia</span>
                      </a>
                      <a
                        href={effectiveComprovanteUrl}
                        download={`comprovante-${loan.codigoOperacao}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Download size={13} />
                        <span>Baixar</span>
                      </a>
                    </>
                  )}
                  {isAdminOrFinance && (
                    <label className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors">
                      <Upload size={13} />
                      <span>
                        {isUploadingComprovante
                          ? 'Enviando...'
                          : effectiveComprovanteUrl
                          ? 'Substituir Comprovante'
                          : 'Anexar Comprovante'}
                      </span>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleUploadComprovante}
                        disabled={isUploadingComprovante}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {effectiveComprovanteUrl ? (
                <div className="bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col items-center justify-center min-h-[380px] p-3">
                  {isImageReceipt ? (
                    <img
                      src={effectiveComprovanteUrl}
                      alt={`Comprovante de transferência ${loan.codigoOperacao}`}
                      className="max-h-[58vh] w-auto object-contain rounded-lg shadow-md border border-slate-200 dark:border-slate-800 bg-white"
                    />
                  ) : (
                    <iframe
                      src={effectiveComprovanteUrl}
                      title={`Comprovante ${loan.codigoOperacao}`}
                      className="w-full h-[58vh] rounded-lg border border-slate-200 dark:border-slate-800 bg-white"
                    />
                  )}
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-200/70 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-500 dark:text-slate-400">
                    <Receipt size={24} />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Nenhum comprovante de transferência anexado a este empréstimo
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {isAdminOrFinance
                        ? 'Você pode anexar o comprovante de transferência (PDF ou imagem do PIX/TED) clicando no botão abaixo.'
                        : 'O setor financeiro ainda não disponibilizou o arquivo do comprovante de transferência para este contrato.'}
                    </p>
                  </div>
                  {isAdminOrFinance && (
                    <div className="pt-2">
                      <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-sm transition-colors">
                        <Upload size={14} />
                        <span>{isUploadingComprovante ? 'Enviando arquivo...' : 'Selecionar Arquivo (PDF ou Imagem)'}</span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={handleUploadComprovante}
                          disabled={isUploadingComprovante}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ABA 5: MEMÓRIA DE CÁLCULO */}
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

      {/* MODAL DE BAIXA DE PARCELAS DO CONTRATO */}
      {baixaModalState && (
        <BaixaParcelasModal
          parcelasInicial={baixaModalState.parcelasInicial}
          todasParcelasContexto={baixaModalState.todasParcelasContexto}
          tituloContexto={`Contrato ${loan.codigoOperacao} — ${loan.colaboradorNome}`}
          onClose={() => setBaixaModalState(null)}
          onSuccess={(updatedLoans) => {
            setSelectedParcelaIds([])
            const updatedThisLoan = updatedLoans?.find((u) => u.id === loan.id)
            if (updatedThisLoan) {
              setCurrentLoan(updatedThisLoan)
            }
            onRefresh?.()
          }}
        />
      )}

      {/* MODAL DE ESTORNO DE PARCELAS DO CONTRATO */}
      {estornoModalParcelas && (
        <EstornoParcelasModal
          parcelas={estornoModalParcelas}
          onClose={() => setEstornoModalParcelas(null)}
          onSuccess={(updatedLoans) => {
            setSelectedParcelaIds([])
            const updatedThisLoan = updatedLoans?.find((u) => u.id === loan.id)
            if (updatedThisLoan) {
              setCurrentLoan(updatedThisLoan)
            }
            onRefresh?.()
          }}
        />
      )}
    </div>
  )
}
