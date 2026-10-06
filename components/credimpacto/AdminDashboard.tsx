'use client'

import React, { useState, useMemo } from 'react'
import {
  Banknote,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  Check,
  X,
  Sparkles,
  ArrowRight,
  Upload,
  Calendar,
  UserX,
  FileText,
  Trash2,
  Copy,
  DollarSign,
  CreditCard,
  Pencil,
  Building
} from 'lucide-react'
import { CredImpactoEmprestimo, StatusEmprestimo } from '@/types/credimpacto'
import { formatBrl, METODOS_LABELS } from '@/lib/credimpacto/engine'
import { toast } from 'sonner'

interface AdminDashboardProps {
  emprestimos: CredImpactoEmprestimo[]
  onOpenDetails: (loan: CredImpactoEmprestimo) => void
  onRefresh: () => void
  viewModeTab?: 'dashboard' | 'emprestimos' | 'analise' | 'liberacoes'
}

export function AdminDashboard({
  emprestimos,
  onOpenDetails,
  onRefresh,
  viewModeTab = 'dashboard'
}: AdminDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(
    viewModeTab === 'analise'
      ? 'solicitado'
      : viewModeTab === 'liberacoes'
      ? 'aguardando_liberacao'
      : 'todos'
  )

  React.useEffect(() => {
    if (viewModeTab === 'analise') {
      setStatusFilter('solicitado')
    } else if (viewModeTab === 'liberacoes') {
      setStatusFilter('aguardando_liberacao')
    } else {
      setStatusFilter('todos')
    }
  }, [viewModeTab])

  // Modais de Ação Administrativa
  const [analyzingLoan, setAnalyzingLoan] = useState<CredImpactoEmprestimo | null>(null)
  const [analysisDecision, setAnalysisDecision] = useState<'aprovar' | 'recusar' | 'contraproposta'>('aprovar')
  const [motivoRecusa, setMotivoRecusa] = useState('')
  const [contraValor, setContraValor] = useState<number>(0)
  const [contraParcelas, setContraParcelas] = useState<number>(0)
  const [contraMotivo, setContraMotivo] = useState('')
  const [isSubmittingAnalysis, setIsSubmittingAnalysis] = useState(false)

  // Modal de Liberação de Recursos
  const [disbursingLoan, setDisbursingLoan] = useState<CredImpactoEmprestimo | null>(null)
  const [comprovanteUrl, setComprovanteUrl] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmittingDisbursement, setIsSubmittingDisbursement] = useState(false)

  // Modal de Exclusão de Empréstimo
  const [loanToDelete, setLoanToDelete] = useState<CredImpactoEmprestimo | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Modal de Edição de Chave PIX (Liberações TED)
  const [editingPixLoan, setEditingPixLoan] = useState<CredImpactoEmprestimo | null>(null)
  const [editingPixKey, setEditingPixKey] = useState('')
  const [editingPixType, setEditingPixType] = useState<'cpf' | 'email' | 'telefone' | 'aleatoria'>('cpf')
  const [isSavingPix, setIsSavingPix] = useState(false)

  const handleOpenEditPix = (loan: CredImpactoEmprestimo) => {
    setEditingPixLoan(loan)
    const existing = loan.dadosBancarios?.chavePix || ''
    const isPlaceholder = existing.toLowerCase().includes('definir')
    setEditingPixKey(isPlaceholder ? '' : existing)
    setEditingPixType((loan.dadosBancarios?.tipoChavePix as any) || 'cpf')
  }

  const handleSavePix = async () => {
    if (!editingPixLoan) return
    const clean = editingPixKey.trim()
    if (!clean || clean.toLowerCase().includes('definir')) {
      toast.error('Informe uma Chave PIX válida.')
      return
    }
    setIsSavingPix(true)
    try {
      const res = await fetch(`/api/credimpacto/emprestimos/${editingPixLoan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'atualizar_dados_bancarios',
          dadosBancarios: {
            ...(editingPixLoan.dadosBancarios || { tipoConta: 'corrente' }),
            chavePix: clean,
            tipoChavePix: editingPixType
          }
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar PIX')
      toast.success(`Chave PIX da operação ${editingPixLoan.codigoOperacao} atualizada com sucesso!`)

      // Se estiver com o modal de liberação aberto para este empréstimo, atualiza nele também
      if (disbursingLoan && disbursingLoan.id === editingPixLoan.id) {
        setDisbursingLoan({
          ...disbursingLoan,
          dadosBancarios: {
            ...(disbursingLoan.dadosBancarios || { tipoConta: 'corrente' }),
            chavePix: clean,
            tipoChavePix: editingPixType
          }
        })
      }

      setEditingPixLoan(null)
      onRefresh()
    } catch (err: any) {
      toast.error(err.message || 'Falha ao salvar Chave PIX')
    } finally {
      setIsSavingPix(false)
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copiado!`)
  }

  const handleDeleteLoan = async () => {
    if (!loanToDelete) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/credimpacto/emprestimos?id=${loanToDelete.id}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir empréstimo')
      toast.success(`Empréstimo ${loanToDelete.codigoOperacao} excluído com sucesso!`)
      setLoanToDelete(null)
      onRefresh()
    } catch (err: any) {
      toast.error(err.message || 'Falha ao excluir operação.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Cálculos de KPIs Globais - APENAS empréstimos efetivamente ativos
  const ativos = emprestimos.filter((e) => e.status === 'ativo')
  const totalEmprestadoAtivo = ativos.reduce((acc, e) => acc + (e.valorAprovado || 0), 0)
  const totalSaldoAReceber = ativos.reduce((acc, e) => acc + (e.saldoDevedorAtual || 0), 0)
  const totalLiquidadoGeral = emprestimos.filter((e) => e.status === 'quitado').reduce((acc, e) => acc + (e.valorAprovado || 0), 0)

  // Empréstimos elegíveis para acompanhamento de parcelas (apenas ativos)
  const emprestimosConcedidos = ativos

  // Métricas específicas de Liberações TED
  const pendentesLiberacao = emprestimos.filter((e) => e.status === 'aguardando_liberacao')
  const totalALiberar = pendentesLiberacao.reduce((acc, e) => acc + (e.valorAprovado || 0), 0)

  // Métricas específicas de Análise
  const pendentesAnalise = emprestimos.filter((e) => e.status === 'solicitado' || e.status === 'em_analise')
  const totalSolicitadoAnalise = pendentesAnalise.reduce((acc, e) => acc + (e.valorSolicitado || 0), 0)
  const emContraproposta = emprestimos.filter((e) => e.status === 'contraproposta')
  const aguardandoAssinatura = emprestimos.filter((e) => e.status === 'aguardando_assinatura')

  // Competência Atual
  const hoje = new Date()
  const compAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  // Parcelas do Mês (apenas de empréstimos ativos)
  let parcelasMesPrevistas = 0
  let parcelasMesRecebidas = 0
  let parcelasEmAtraso = 0

  for (const emp of ativos) {
    for (const p of emp.parcelas || []) {
      if (p.competencia === compAtual) {
        parcelasMesPrevistas += p.valorTotal
        if (p.status === 'descontada' || p.status === 'paga_avulso') {
          parcelasMesRecebidas += p.valorPago || p.valorTotal
        }
      }
      if (p.status === 'atrasada') {
        parcelasEmAtraso += 1
      }
    }
  }

  // Filtragem da Lista
  const filteredEmprestimos = useMemo(() => {
    return emprestimos.filter((loan) => {
      const q = searchTerm.toLowerCase().trim()
      const matchSearch =
        !q ||
        loan.colaboradorNome.toLowerCase().includes(q) ||
        loan.colaboradorCpf.includes(q) ||
        loan.codigoOperacao.toLowerCase().includes(q) ||
        (loan.colaboradorMatricula && loan.colaboradorMatricula.toLowerCase().includes(q))

      const matchStatus = statusFilter === 'todos' ? true : loan.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [emprestimos, searchTerm, statusFilter])

  // Abertura do Modal de Análise
  const handleOpenAnalysisModal = (loan: CredImpactoEmprestimo) => {
    setAnalyzingLoan(loan)
    setAnalysisDecision('aprovar')
    setMotivoRecusa('')
    setContraValor(loan.valorSolicitado)
    setContraParcelas(loan.quantidadeParcelas)
    setContraMotivo('Ajuste para compatibilidade com o teto de desconto em folha.')
  }

  const handleConfirmAnalysis = async () => {
    if (!analyzingLoan) return
    setIsSubmittingAnalysis(true)
    try {
      const payload: any = {
        acao: 'analisar',
        decisao: analysisDecision
      }

      if (analysisDecision === 'recusar') {
        if (!motivoRecusa.trim()) {
          toast.error('Informe o motivo da recusa.')
          setIsSubmittingAnalysis(false)
          return
        }
        payload.motivoRecusa = motivoRecusa
      }

      if (analysisDecision === 'contraproposta') {
        if (!contraValor || contraValor <= 0) {
          toast.error('Informe o valor proposto na contraproposta.')
          setIsSubmittingAnalysis(false)
          return
        }
        payload.contraproposta = {
          valorProposto: contraValor,
          quantidadeParcelas: contraParcelas,
          taxaMensal: analyzingLoan.taxaMensal,
          metodoCalculo: analyzingLoan.metodoCalculo,
          motivo: contraMotivo
        }
      }

      const res = await fetch(`/api/credimpacto/emprestimos/${analyzingLoan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao processar análise')

      toast.success(
        analysisDecision === 'aprovar'
          ? `Empréstimo ${data.codigoOperacao} aprovado! Contrato disponibilizado para assinatura do colaborador.`
          : analysisDecision === 'recusar'
          ? `Solicitação ${data.codigoOperacao} recusada.`
          : `Contraproposta enviada ao colaborador ${analyzingLoan.colaboradorNome}.`
      )

      setAnalyzingLoan(null)
      onRefresh()
    } catch (err: any) {
      toast.error(err.message || 'Falha ao analisar proposta')
    } finally {
      setIsSubmittingAnalysis(false)
    }
  }

  // Upload do Comprovante de Liberação
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('pasta', 'liberacoes')

      const res = await fetch('/api/credimpacto/comprovante', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro no upload')

      setComprovanteUrl(data.url)
      toast.success('Comprovante anexado com sucesso!')
    } catch (err: any) {
      toast.error(err.message || 'Falha no upload do comprovante')
    } finally {
      setIsUploading(false)
    }
  }

  // Confirmação de Liberação
  const handleConfirmDisbursement = async () => {
    if (!disbursingLoan) return

    const cleanPix = disbursingLoan.dadosBancarios?.chavePix?.trim()
    if (!cleanPix || cleanPix.toLowerCase().includes('definir')) {
      toast.error('É obrigatório definir uma Chave PIX válida antes de confirmar a liberação dos recursos.')
      return
    }

    setIsSubmittingDisbursement(true)
    try {
      const res = await fetch(`/api/credimpacto/emprestimos/${disbursingLoan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'liberar',
          comprovanteLiberacaoUrl: comprovanteUrl
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao registrar liberação')

      toast.success(`Liberação de recursos confirmada! O empréstimo ${data.codigoOperacao} está ativo.`)
      setDisbursingLoan(null)
      setComprovanteUrl('')
      onRefresh()
    } catch (err: any) {
      toast.error(err.message || 'Falha ao liberar recursos')
    } finally {
      setIsSubmittingDisbursement(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'solicitado':
        return { label: 'Solicitado', bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' }
      case 'em_analise':
        return { label: 'Em Análise', bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' }
      case 'contraproposta':
        return { label: 'Contraproposta', bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20' }
      case 'aguardando_assinatura':
        return { label: 'Ag. Assinatura', bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' }
      case 'aguardando_liberacao':
        return { label: 'Ag. Liberação', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20' }
      case 'ativo':
        return { label: 'Ativo', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' }
      case 'quitado':
        return { label: 'Quitado', bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' }
      case 'recusado':
        return { label: 'Recusado', bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' }
      case 'cancelado':
        return { label: 'Cancelado', bg: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:border-slate-700/50' }
      default:
        return { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-white dark:border-white/20' }
    }
  }

  return (
    <div className="space-y-6">
      {viewModeTab === 'analise' && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-amber-900 dark:text-amber-300 text-xs">
          <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm">Fila de Aprovação de Crédito</div>
            <div className="text-amber-800/80 dark:text-amber-400/80 mt-0.5">
              Analise as solicitações de empréstimo enviadas pelos colaboradores. É possível aprovar as condições requeridas, emitir uma contraproposta de valor/parcelas ou recusar formalmente com justificativa registrada.
            </div>
          </div>
        </div>
      )}

      {viewModeTab === 'liberacoes' && (
        <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-start gap-3 text-cyan-900 dark:text-cyan-300 text-xs">
          <Banknote className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-sm">Liberação de Recursos (Tesouraria & TED)</div>
            <div className="text-cyan-800/80 dark:text-cyan-400/80 mt-0.5">
              Operações com contrato e autorização já assinados digitalmente pelo colaborador. Efetue a transferência bancária e anexe o comprovante TED/Pix para ativar o empréstimo e iniciar o ciclo de desconto em folha.
            </div>
          </div>
        </div>
      )}

      {/* KPI DASHBOARD CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {viewModeTab === 'liberacoes' ? (
          <>
            <div className="bg-gradient-to-br from-cyan-50 via-sky-50/30 to-white dark:from-cyan-950/40 dark:via-slate-900 dark:to-slate-900 border border-cyan-200/90 dark:border-cyan-800/70 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 to-blue-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate text-cyan-900/80 dark:text-cyan-300">Aguardando TED</span>
                <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0">
                  <Clock size={15} />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-cyan-700 dark:text-cyan-400 font-mono truncate">
                {pendentesLiberacao.length}
              </div>
              <div className="text-[11px] font-semibold text-cyan-700 dark:text-cyan-400 mt-1 truncate">Contratos assinados</div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 via-teal-50/30 to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/90 dark:border-emerald-800/70 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate text-emerald-900/80 dark:text-emerald-300">Volume a Transferir</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <Banknote size={15} />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono truncate">
                {formatBrl(totalALiberar)}
              </div>
              <div className="text-[11px] font-semibold text-emerald-800/80 dark:text-emerald-400/80 mt-1 truncate">Total a pagar via TED/PIX</div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 via-indigo-50/30 to-white dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900 border border-blue-200/90 dark:border-blue-800/70 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate text-blue-900/80 dark:text-blue-300">Liberados / Ativos</span>
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={15} />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-blue-700 dark:text-blue-400 font-mono truncate">
                {ativos.length}
              </div>
              <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 mt-1 truncate">Recursos já liberados</div>
            </div>

            <div className="bg-gradient-to-br from-purple-50 via-violet-50/30 to-white dark:from-purple-950/40 dark:via-slate-900 dark:to-slate-900 border border-purple-200/90 dark:border-purple-800/70 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <div className="h-1.5 w-full bg-gradient-to-r from-purple-500 to-violet-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate text-purple-900/80 dark:text-purple-300">Carteira Concedida</span>
                <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 flex items-center justify-center shrink-0">
                  <TrendingUp size={15} />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-purple-700 dark:text-purple-400 font-mono truncate">
                {formatBrl(totalEmprestadoAtivo)}
              </div>
              <div className="text-[11px] font-semibold text-purple-800/80 dark:text-purple-400/80 mt-1 truncate">Ativos em folha</div>
            </div>

            <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-teal-50 via-emerald-50/30 to-white dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-900 border border-teal-200/90 dark:border-teal-800/70 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 to-emerald-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate text-teal-900/80 dark:text-teal-300">Saldo a Receber</span>
                <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                  <DollarSign size={15} />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-teal-700 dark:text-teal-400 font-mono truncate">
                {formatBrl(totalSaldoAReceber)}
              </div>
              <div className="text-[11px] font-semibold text-teal-800/80 dark:text-teal-400/80 mt-1 truncate">Principal restante</div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50/30 to-white dark:from-blue-950/40 dark:via-slate-900 dark:to-slate-900 border border-blue-200/90 dark:border-blue-800/70 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate text-blue-900/80 dark:text-blue-300">Ativos Concedidos</span>
                <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Banknote size={15} />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-blue-700 dark:text-blue-400 font-mono truncate">
                {formatBrl(totalEmprestadoAtivo)}
              </div>
              <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 mt-1 truncate">
                {ativos.length} {ativos.length === 1 ? 'contrato ativo' : 'contratos ativos'}
              </div>
            </div>

            <div className="bg-gradient-to-br from-emerald-50 via-teal-50/30 to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/90 dark:border-emerald-800/70 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate text-emerald-900/80 dark:text-emerald-300">Saldo a Receber</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                  <TrendingUp size={15} />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono truncate">
                {formatBrl(totalSaldoAReceber)}
              </div>
              <div className="text-[11px] font-semibold text-emerald-800/80 dark:text-emerald-400/80 mt-1 truncate">Principal em aberto</div>
            </div>

            <div className="bg-gradient-to-br from-cyan-50 via-sky-50/30 to-white dark:from-cyan-950/40 dark:via-slate-900 dark:to-slate-900 border border-cyan-200/90 dark:border-cyan-800/70 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 to-blue-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate text-cyan-900/80 dark:text-cyan-300">Parcelas do Mês</span>
                <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 flex items-center justify-center shrink-0">
                  <Clock size={15} />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-cyan-700 dark:text-cyan-400 font-mono truncate">
                {formatBrl(parcelasMesPrevistas)}
              </div>
              <div className="text-[11px] font-semibold text-cyan-800/80 dark:text-cyan-400/80 mt-1 truncate">Ref: {compAtual}</div>
            </div>

            <div className="bg-gradient-to-br from-teal-50 via-emerald-50/30 to-white dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-900 border border-teal-200/90 dark:border-teal-800/70 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <div className="h-1.5 w-full bg-gradient-to-r from-teal-500 to-emerald-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate text-teal-900/80 dark:text-teal-300">Recebido Efetivo</span>
                <div className="w-7 h-7 rounded-lg bg-teal-100 dark:bg-teal-950 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={15} />
                </div>
              </div>
              <div className="text-lg sm:text-xl font-black text-teal-700 dark:text-teal-400 font-mono truncate">
                {formatBrl(parcelasMesRecebidas)}
              </div>
              <div className="text-[11px] font-semibold text-teal-800/80 dark:text-teal-400/80 mt-1 truncate">Confirmado em folha</div>
            </div>

            <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-amber-50 via-rose-50/30 to-white dark:from-amber-950/40 dark:via-slate-900 dark:to-slate-900 border border-amber-200/90 dark:border-amber-800/70 rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
              <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-rose-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider truncate text-amber-900/80 dark:text-amber-300">Atrasos / Alertas</span>
                <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <AlertTriangle size={15} />
                </div>
              </div>
              <div className={`text-lg sm:text-xl font-black font-mono truncate ${parcelasEmAtraso > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-200'}`}>
                {parcelasEmAtraso}
              </div>
              <div className="text-[11px] font-semibold text-amber-800/80 dark:text-amber-400/80 mt-1 truncate">
                {parcelasEmAtraso > 0 ? 'Pendência de conciliação' : '100% regular'}
              </div>
            </div>
          </>
        )}
      </div>

      {/* FILTROS E BUSCA */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por colaborador, CPF, matrícula ou código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl pl-10 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={14} className="text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium transition-all"
          >
            {viewModeTab === 'liberacoes' ? (
              <>
                <option value="aguardando_liberacao">Aguardando Liberação TED (Pendentes)</option>
                <option value="ativo">Já Liberados (Ativos)</option>
                <option value="todos">Todos os Status</option>
              </>
            ) : viewModeTab === 'analise' ? (
              <>
                <option value="solicitado">Aguardando Análise (Novas)</option>
                <option value="contraproposta">Em Contraproposta</option>
                <option value="aguardando_assinatura">Aguardando Assinatura</option>
                <option value="todos">Todos os Status</option>
              </>
            ) : (
              <>
                <option value="todos">Todos os Status</option>
                <option value="solicitado">Novas Solicitações</option>
                <option value="aguardando_assinatura">Aguardando Assinatura</option>
                <option value="aguardando_liberacao">Aguardando Liberação TED</option>
                <option value="ativo">Ativos em Folha</option>
                <option value="quitado">Quitados</option>
                <option value="contraproposta">Em Contraproposta</option>
                <option value="recusado">Recusados</option>
                <option value="cancelado">Cancelados</option>
              </>
            )}
          </select>
        </div>
      </div>

      {/* TABELA DE OPERAÇÕES (DESKTOP: hidden md:block para não duplicar no mobile) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              {viewModeTab === 'liberacoes' ? (
                <tr>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap w-[130px]">Operação</th>
                  <th className="py-2.5 px-3 text-left min-w-[170px]">Colaborador</th>
                  <th className="py-2.5 px-3 text-left min-w-[200px]">Dados Bancários / Chave PIX</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap w-[150px]">Valor a Liberar</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap w-[70px]">Prazo</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap w-[120px]">Status</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap w-[140px]">Ações</th>
                </tr>
              ) : (
                <tr>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap w-[130px]">Operação</th>
                  <th className="py-2.5 px-4 text-left min-w-[200px]">Colaborador</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap w-[160px]">Valor Concedido</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap w-[80px]">Parcelas</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap w-[160px]">Saldo Devedor</th>
                  <th className="py-2.5 px-2 text-center whitespace-nowrap w-[120px]">Status</th>
                  <th className="py-2.5 px-3 text-center whitespace-nowrap w-[130px]">Ações</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredEmprestimos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    Nenhuma operação encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredEmprestimos.map((loan) => {
                  const badge = getStatusBadge(loan.status)
                  const isPendingAnalysis = loan.status === 'solicitado' || loan.status === 'em_analise'
                  const isPendingDisbursement = loan.status === 'aguardando_liberacao'

                  if (viewModeTab === 'liberacoes') {
                    return (
                      <tr key={loan.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          <div className="text-xs">{loan.codigoOperacao}</div>
                          <div className="text-[10px] text-slate-400 font-sans font-normal">
                            {new Date(loan.createdAt).toLocaleDateString('pt-BR')}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-left min-w-[170px] max-w-[220px]">
                          <div className="font-bold text-slate-900 dark:text-white truncate" title={loan.colaboradorNome}>
                            {loan.colaboradorNome}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {loan.colaboradorCargo || 'Colaborador'} • CPF: {loan.colaboradorCpf}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-left min-w-[200px]">
                          {loan.dadosBancarios?.chavePix && !loan.dadosBancarios.chavePix.toLowerCase().includes('definir') ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 font-mono">
                                {loan.dadosBancarios.tipoChavePix ? loan.dadosBancarios.tipoChavePix.toUpperCase() : 'PIX'}
                              </span>
                              <span className="font-mono text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[130px]" title={loan.dadosBancarios.chavePix}>
                                {loan.dadosBancarios.chavePix}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(loan.dadosBancarios!.chavePix!, 'Chave PIX')}
                                className="text-slate-400 hover:text-cyan-600 transition-colors p-0.5"
                                title="Copiar Chave PIX"
                              >
                                <Copy size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditPix(loan)}
                                className="text-slate-400 hover:text-emerald-600 transition-colors p-0.5"
                                title="Editar Chave PIX"
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-mono">
                                PENDENTE
                              </span>
                              <span className="font-mono text-xs text-amber-700 dark:text-amber-400 truncate max-w-[110px]" title="A definir pelo colaborador">
                                {loan.dadosBancarios?.chavePix || 'A definir'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenEditPix(loan)}
                                className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-0.5"
                                title="Definir Chave PIX agora"
                              >
                                <Pencil size={11} />
                                <span>Definir</span>
                              </button>
                            </div>
                          )}
                          {loan.dadosBancarios?.banco && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                              {loan.dadosBancarios.banco} • Ag: {loan.dadosBancarios.agencia} • Cc: {loan.dadosBancarios.conta}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          <div className="text-xs">{formatBrl(loan.valorAprovado)}</div>
                          <div className="text-[10px] text-slate-400 font-sans font-normal">
                            TED / Transferência
                          </div>
                        </td>

                        <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {loan.quantidadeParcelas}x
                        </td>

                        <td className="py-2.5 px-2 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center">
                            <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.bg}`}>
                              {badge.label}
                            </span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {isPendingDisbursement ? (
                              <button
                                onClick={() => {
                                  setDisbursingLoan(loan)
                                  setComprovanteUrl(loan.comprovanteLiberacaoUrl || '')
                                }}
                                className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1.5 transition-all"
                                title="Registrar Liberação Financeira"
                              >
                                <Banknote size={13} />
                                <span>Liberar TED</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mr-1">
                                <CheckCircle2 size={12} /> Liberado
                              </span>
                            )}

                            <button
                              onClick={() => onOpenDetails(loan)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
                              title="Ver Detalhes"
                            >
                              <Eye size={14} />
                            </button>

                            <button
                              onClick={() => setLoanToDelete(loan)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 transition-all"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  }

                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div className="text-xs">{loan.codigoOperacao}</div>
                        <div className="text-[10px] text-slate-400 font-sans font-normal">
                          {new Date(loan.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-left min-w-[200px] max-w-[260px]">
                        <div className="font-bold text-slate-900 dark:text-white truncate" title={loan.colaboradorNome}>
                          {loan.colaboradorNome}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {loan.colaboradorCargo || 'Colaborador'} • CPF: {loan.colaboradorCpf}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        <div>{formatBrl(loan.valorAprovado || loan.valorSolicitado)}</div>
                        <div className="text-[10px] text-slate-400 font-sans font-normal">
                          {loan.taxaMensal}% a.m.
                        </div>
                      </td>

                      <td className="py-2.5 px-2 text-center font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {loan.quantidadeParcelas}x
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        {formatBrl(loan.saldoDevedorAtual)}
                      </td>

                      <td className="py-2.5 px-2 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Ação 1: Analisar */}
                          {isPendingAnalysis && (
                            <button
                              onClick={() => handleOpenAnalysisModal(loan)}
                              className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 transition-all"
                              title="Analisar Proposta"
                            >
                              <span>Analisar</span>
                            </button>
                          )}

                          {/* Ação 2: Liberar Recursos */}
                          {isPendingDisbursement && (
                            <button
                              onClick={() => {
                                setDisbursingLoan(loan)
                                setComprovanteUrl(loan.comprovanteLiberacaoUrl || '')
                              }}
                              className="px-2 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 transition-all"
                              title="Registrar Liberação Financeira"
                            >
                              <Banknote size={12} />
                              <span>Liberar</span>
                            </button>
                          )}

                          {/* Ação 3: Ver Detalhes */}
                          <button
                            onClick={() => onOpenDetails(loan)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-all"
                            title="Ver Detalhes e Parcelas"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Ação 4: Excluir */}
                          <button
                            onClick={() => setLoanToDelete(loan)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 transition-all"
                            title="Excluir Empréstimo"
                          >
                            <Trash2 size={14} />
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

        {/* LISTAGEM EM CARDS PARA DISPOSITIVOS MÓVEIS (ÚNICA VISÃO NO MOBILE) */}
        <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
          {filteredEmprestimos.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              Nenhuma operação encontrada com os filtros selecionados.
            </div>
          ) : (
            filteredEmprestimos.map((loan) => {
              const badge = getStatusBadge(loan.status)
              const isPendingAnalysis = loan.status === 'solicitado' || loan.status === 'em_analise'
              const isPendingDisbursement = loan.status === 'aguardando_liberacao'

              return (
                <div key={loan.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">{loan.codigoOperacao}</span>
                      <span className="text-[10px] text-slate-400 font-sans ml-2">{new Date(loan.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div>
                    <div className="font-bold text-slate-900 dark:text-white text-sm">{loan.colaboradorNome}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {loan.colaboradorCargo || 'Colaborador'} • CPF: {loan.colaboradorCpf || 'Não informado'}
                    </div>
                  </div>

                  {/* SE FOR LIBERAÇÃO TED: Card específico com PIX e dados bancários */}
                  {(viewModeTab === 'liberacoes' || isPendingDisbursement) && (
                    <div className="bg-cyan-50/60 dark:bg-cyan-950/20 p-3 rounded-xl border border-cyan-200/60 dark:border-cyan-800/40 text-xs space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] uppercase font-bold text-cyan-800 dark:text-cyan-300">Valor a Transferir</span>
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatBrl(loan.valorAprovado)}
                        </span>
                      </div>

                      {loan.dadosBancarios?.chavePix ? (
                        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-cyan-200/60 dark:border-cyan-800/40">
                          <div className="truncate mr-2">
                            <span className="text-[9px] uppercase font-bold text-cyan-600 dark:text-cyan-400 mr-1.5 font-mono">PIX:</span>
                            <span className="font-mono text-xs text-slate-900 dark:text-white">{loan.dadosBancarios.chavePix}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(loan.dadosBancarios!.chavePix!, 'Chave PIX')}
                            className="text-slate-400 hover:text-cyan-600 p-1 transition-colors shrink-0"
                            title="Copiar PIX"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded-lg border border-cyan-200/60 dark:border-cyan-800/40">
                          <div className="truncate mr-2">
                            <span className="text-[9px] uppercase font-bold text-slate-500 mr-1.5 font-mono">PIX (CPF):</span>
                            <span className="font-mono text-xs text-slate-900 dark:text-white">{loan.colaboradorCpf}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(loan.colaboradorCpf, 'CPF')}
                            className="text-slate-400 hover:text-cyan-600 p-1 transition-colors shrink-0"
                            title="Copiar CPF"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                      )}

                      {loan.dadosBancarios?.banco && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-300">
                          <strong>Banco:</strong> {loan.dadosBancarios.banco} • <strong>Ag:</strong> {loan.dadosBancarios.agencia} • <strong>Cc:</strong> {loan.dadosBancarios.conta}
                        </div>
                      )}
                    </div>
                  )}

                  {/* SE FOR ANÁLISE PENDENTE: Card de proposta solicitada */}
                  {isPendingAnalysis && viewModeTab !== 'liberacoes' && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2 bg-amber-50/60 dark:bg-amber-950/20 p-2.5 rounded-xl border border-amber-200/60 dark:border-amber-900/30 text-center font-mono">
                        <div>
                          <div className="text-[9px] uppercase font-sans text-amber-700 dark:text-amber-400 font-semibold">Valor Solicitado</div>
                          <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{formatBrl(loan.valorSolicitado)}</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase font-sans text-amber-700 dark:text-amber-400 font-semibold">Prazo Desejado</div>
                          <div className="font-bold text-slate-700 dark:text-slate-300 text-xs mt-0.5">{loan.quantidadeParcelas}x parcelas</div>
                        </div>
                      </div>
                      {loan.justificativaSolicitacao && (
                        <div className="text-[11px] text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-2 rounded-lg">
                          &ldquo;{loan.justificativaSolicitacao}&rdquo;
                        </div>
                      )}
                    </div>
                  )}

                  {/* SE FOR CONTRATO ATIVO/QUITADO: Grid tradicional com 3 colunas */}
                  {!isPendingAnalysis && !isPendingDisbursement && viewModeTab !== 'liberacoes' && (
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center font-mono">
                      <div>
                        <div className="text-[9px] uppercase font-sans text-slate-400 font-semibold">Concedido</div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs mt-0.5">{formatBrl(loan.valorAprovado)}</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-sans text-slate-400 font-semibold">Parcelas</div>
                        <div className="font-bold text-slate-700 dark:text-slate-300 text-xs mt-0.5">{loan.quantidadeParcelas}x</div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase font-sans text-slate-400 font-semibold">Saldo Devedor</div>
                        <div className="font-bold text-emerald-600 dark:text-emerald-400 text-xs mt-0.5">{formatBrl(loan.saldoDevedorAtual)}</div>
                      </div>
                    </div>
                  )}

                  {/* AÇÕES MOBILE */}
                  <div className="flex flex-col gap-2 pt-1">
                    {isPendingAnalysis && (
                      <button
                        onClick={() => handleOpenAnalysisModal(loan)}
                        className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
                      >
                        <span>Analisar Proposta de Crédito</span>
                      </button>
                    )}

                    {isPendingDisbursement && (
                      <button
                        onClick={() => {
                          setDisbursingLoan(loan)
                          setComprovanteUrl(loan.comprovanteLiberacaoUrl || '')
                        }}
                        className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
                      >
                        <Banknote size={15} />
                        <span>Liberar TED & Anexar Comprovante</span>
                      </button>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenDetails(loan)}
                        className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                      >
                        <Eye size={14} />
                        <span>Ver Detalhes</span>
                      </button>
                      <button
                        onClick={() => setLoanToDelete(loan)}
                        className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-800/40 transition-all"
                        title="Excluir"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* MODAL DE ANÁLISE DE PROPOSTA */}
      {analyzingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Análise de Crédito: {analyzingLoan.codigoOperacao}</span>
              </h3>
              <button onClick={() => setAnalyzingLoan(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">✕</button>
            </div>

            {/* DADOS DO SOLICITANTE */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Colaborador:</span>
                <span className="font-bold text-slate-900 dark:text-white">{analyzingLoan.colaboradorNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Cargo / Matrícula:</span>
                <span className="text-slate-700 dark:text-slate-300">{analyzingLoan.colaboradorCargo || 'N/A'} • {analyzingLoan.colaboradorMatricula || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Salário Base Cadastrado:</span>
                <span className="font-mono font-medium text-slate-900 dark:text-white">{analyzingLoan.colaboradorSalarioBase ? formatBrl(analyzingLoan.colaboradorSalarioBase) : 'Não informado'}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400">Valor Solicitado:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatBrl(analyzingLoan.valorSolicitado)} em {analyzingLoan.quantidadeParcelas}x</span>
              </div>
              {analyzingLoan.justificativaSolicitacao && (
                <div className="pt-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <strong className="text-slate-700 dark:text-slate-300">Justificativa do Colaborador:</strong> {analyzingLoan.justificativaSolicitacao}
                </div>
              )}
            </div>

            {/* SELEÇÃO DA DECISÃO */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Decisão da Análise Financeira
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setAnalysisDecision('aprovar')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    analysisDecision === 'aprovar'
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm shadow-emerald-600/30'
                      : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Check size={16} />
                  <span>Aprovar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAnalysisDecision('contraproposta')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    analysisDecision === 'contraproposta'
                      ? 'bg-purple-600 text-white border-purple-500 shadow-sm shadow-purple-600/30'
                      : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Sparkles size={16} />
                  <span>Contraproposta</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAnalysisDecision('recusar')}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    analysisDecision === 'recusar'
                      ? 'bg-rose-600 text-white border-rose-500 shadow-sm shadow-rose-600/30'
                      : 'bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <X size={16} />
                  <span>Recusar</span>
                </button>
              </div>

              {/* CAMPOS ESPECÍFICOS DE RECUSA */}
              {analysisDecision === 'recusar' && (
                <div className="space-y-1.5 animate-in fade-in">
                  <label className="block text-xs font-bold text-rose-600 dark:text-rose-400">
                    Motivo Formal da Recusa (visível para o colaborador)
                  </label>
                  <textarea
                    rows={3}
                    value={motivoRecusa}
                    onChange={(e) => setMotivoRecusa(e.target.value)}
                    placeholder="Ex: Margem salarial indisponível, histórico de restrições ou período aquisitivo mínimo..."
                    className="w-full bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl p-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              )}

              {/* CAMPOS ESPECÍFICOS DE CONTRAPROPOSTA */}
              {analysisDecision === 'contraproposta' && (
                <div className="space-y-3 bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-xl p-3.5 animate-in fade-in text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-purple-900 dark:text-purple-300 mb-1">Novo Valor Proposto (R$)</label>
                      <input
                        type="number"
                        step="100"
                        value={contraValor}
                        onChange={(e) => setContraValor(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-950 border border-purple-200 dark:border-purple-800/50 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-purple-900 dark:text-purple-300 mb-1">Parcelas Propostas</label>
                      <input
                        type="number"
                        min="1"
                        max="24"
                        value={contraParcelas}
                        onChange={(e) => setContraParcelas(Number(e.target.value))}
                        className="w-full bg-white dark:bg-slate-950 border border-purple-200 dark:border-purple-800/50 rounded-xl px-3 py-2 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-purple-900 dark:text-purple-300 mb-1">Justificativa da Alteração</label>
                    <textarea
                      rows={2}
                      value={contraMotivo}
                      onChange={(e) => setContraMotivo(e.target.value)}
                      placeholder="Explicação do ajuste para o colaborador..."
                      className="w-full bg-white dark:bg-slate-950 border border-purple-200 dark:border-purple-800/50 rounded-xl p-2.5 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAnalyzingLoan(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmittingAnalysis}
                onClick={handleConfirmAnalysis}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white shadow-sm shadow-blue-600/30 disabled:opacity-50 transition-colors"
              >
                {isSubmittingAnalysis ? 'Salvando...' : 'Confirmar Decisão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE LIBERAÇÃO DE RECURSOS (DISBURSEMENT) */}
      {disbursingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Banknote size={18} className="text-cyan-600 dark:text-cyan-400" />
                Registrar Liberação de Recursos
              </h3>
              <button onClick={() => setDisbursingLoan(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">✕</button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Confirme a transferência ou PIX efetuado para o colaborador no valor líquido contratado:
            </p>

            <div className="bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-800/40 rounded-xl p-3.5 text-xs font-mono space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 font-sans">Favorecido:</span>
                <span className="font-bold text-slate-900 dark:text-white">{disbursingLoan.colaboradorNome}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 dark:text-slate-400 font-sans">Valor a Liberar:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{formatBrl(disbursingLoan.valorAprovado)}</span>
              </div>
              {disbursingLoan.dadosBancarios?.chavePix && !disbursingLoan.dadosBancarios.chavePix.toLowerCase().includes('definir') ? (
                <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border border-cyan-200/60 dark:border-cyan-800/40">
                  <span className="text-slate-600 dark:text-slate-400 font-sans text-[11px]">Chave PIX:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-cyan-700 dark:text-cyan-300 font-bold font-mono">{disbursingLoan.dadosBancarios.chavePix}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(disbursingLoan.dadosBancarios!.chavePix!, 'Chave PIX')}
                      className="text-slate-400 hover:text-cyan-600 p-1"
                      title="Copiar PIX"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditPix(disbursingLoan)}
                      className="text-slate-400 hover:text-emerald-600 p-1"
                      title="Editar Chave PIX"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 p-2.5 rounded-lg flex items-center justify-between gap-2">
                  <div>
                    <span className="text-amber-800 dark:text-amber-300 font-bold text-xs block">
                      ⚠️ Chave PIX Não Cadastrada
                    </span>
                    <span className="text-amber-700 dark:text-amber-400 text-[11px]">
                      {disbursingLoan.dadosBancarios?.chavePix || 'A definir pelo colaborador'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenEditPix(disbursingLoan)}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs flex items-center gap-1 shrink-0 transition-colors"
                  >
                    <Pencil size={12} />
                    <span>Definir PIX</span>
                  </button>
                </div>
              )}
              {disbursingLoan.dadosBancarios?.banco && (
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-600 dark:text-slate-400 font-sans">Banco / Ag / Cc:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {disbursingLoan.dadosBancarios.banco} • Ag: {disbursingLoan.dadosBancarios.agencia} • Cc: {disbursingLoan.dadosBancarios.conta}
                  </span>
                </div>
              )}
            </div>

            {/* UPLOAD DO COMPROVANTE */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Anexar Comprovante de Pagamento / PIX (PDF ou Imagem)
              </label>
              <div className="flex items-center gap-2">
                <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-300 transition-all">
                  <Upload size={14} />
                  <span>{isUploading ? 'Enviando arquivo...' : 'Escolher Comprovante'}</span>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </div>

              {comprovanteUrl && (
                <div className="flex items-center gap-2 text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-200 dark:border-emerald-800/40">
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-600" />
                  <span className="truncate font-medium">Comprovante anexado</span>
                  <a
                    href={comprovanteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-700 dark:text-cyan-300 font-bold underline ml-auto font-sans"
                  >
                    Ver
                  </a>
                </div>
              )}
            </div>

            {(() => {
              const isPixMissing = !disbursingLoan.dadosBancarios?.chavePix || disbursingLoan.dadosBancarios.chavePix.toLowerCase().includes('definir')

              return (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  {isPixMissing && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold text-right">
                      * Cadastre a Chave PIX acima para habilitar a confirmação de liberação.
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setDisbursingLoan(null)}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingDisbursement || isPixMissing}
                      onClick={handleConfirmDisbursement}
                      className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow-sm shadow-cyan-600/30 disabled:opacity-40 transition-colors"
                    >
                      {isSubmittingDisbursement ? 'Confirmando...' : 'Confirmar Liberação e Ativar'}
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {loanToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Excluir Empréstimo?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Operação {loanToDelete.codigoOperacao}</p>
              </div>
            </div>

            <div className="bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 rounded-xl p-3.5 text-xs text-rose-900 dark:text-rose-300 space-y-1">
              <p className="font-semibold">Atenção: Esta ação é definitiva e irreversível!</p>
              <p className="text-[11px] leading-relaxed text-rose-800/80 dark:text-rose-300/80">
                Todos os dados da operação, parcelas geradas, contratos e autorizações de <strong>{loanToDelete.colaboradorNome}</strong> no valor de <strong>{formatBrl(loanToDelete.valorAprovado)}</strong> serão permanentemente apagados do sistema.
              </p>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setLoanToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteLoan}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm shadow-rose-600/30 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <span>Excluindo...</span>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Confirmar Exclusão</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE CHAVE PIX */}
      {editingPixLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Building size={16} className="text-cyan-600 dark:text-cyan-400" />
                <span>Atualizar Chave PIX</span>
              </h3>
              <button
                onClick={() => setEditingPixLoan(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Operação:</span>
                <span className="font-bold text-slate-900 dark:text-white font-mono">{editingPixLoan.codigoOperacao}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Colaborador:</span>
                <span className="font-bold text-slate-900 dark:text-white">{editingPixLoan.colaboradorNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Valor Líquido:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{formatBrl(editingPixLoan.valorAprovado)}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Tipo de Chave PIX
                </label>
                <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-medium">
                  {(
                    [
                      { id: 'cpf', label: 'CPF' },
                      { id: 'telefone', label: 'Celular' },
                      { id: 'email', label: 'E-mail' },
                      { id: 'aleatoria', label: 'Aleatória' }
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setEditingPixType(t.id)
                        if (t.id === 'cpf' && (!editingPixKey || editingPixKey.includes('@') || editingPixKey.includes('('))) {
                          setEditingPixKey(editingPixLoan.colaboradorCpf || '')
                        }
                      }}
                      className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                        editingPixType === t.id
                          ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                  <span>Chave PIX de Destino</span>
                  {editingPixType === 'cpf' && editingPixLoan.colaboradorCpf && (
                    <button
                      type="button"
                      onClick={() => setEditingPixKey(editingPixLoan.colaboradorCpf || '')}
                      className="text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold hover:underline lowercase"
                    >
                      Usar CPF do Colaborador
                    </button>
                  )}
                </label>
                <input
                  type="text"
                  required
                  value={editingPixKey}
                  onChange={(e) => setEditingPixKey(e.target.value)}
                  placeholder="Informe a Chave PIX para transferência..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isSavingPix}
                onClick={() => setEditingPixLoan(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingPix || !editingPixKey.trim() || editingPixKey.toLowerCase().includes('definir')}
                onClick={handleSavePix}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-sm shadow-cyan-600/30 disabled:opacity-50 transition-all flex items-center gap-1.5"
              >
                {isSavingPix ? 'Salvando...' : 'Salvar Chave PIX'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
