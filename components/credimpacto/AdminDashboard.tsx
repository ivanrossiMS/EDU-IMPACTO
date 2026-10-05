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
  Trash2
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

  // Cálculos de KPIs Globais
  const ativos = emprestimos.filter((e) => ['ativo', 'aguardando_liberacao', 'aguardando_assinatura'].includes(e.status))
  const totalEmprestadoAtivo = ativos.reduce((acc, e) => acc + (e.valorAprovado || 0), 0)
  const totalSaldoAReceber = ativos.reduce((acc, e) => acc + (e.saldoDevedorAtual || 0), 0)
  const totalLiquidadoGeral = emprestimos.filter((e) => e.status === 'quitado').reduce((acc, e) => acc + (e.valorAprovado || 0), 0)

  // Competência Atual
  const hoje = new Date()
  const compAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  // Parcelas do Mês
  let parcelasMesPrevistas = 0
  let parcelasMesRecebidas = 0
  let parcelasEmAtraso = 0

  for (const emp of emprestimos) {
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
        return { label: 'Nova Solicitação', bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' }
      case 'em_analise':
        return { label: 'Em Análise', bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' }
      case 'contraproposta':
        return { label: 'Contraproposta', bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20' }
      case 'aguardando_assinatura':
        return { label: 'Aguardando Assinatura', bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' }
      case 'aguardando_liberacao':
        return { label: 'Aguardando Liberação', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20' }
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
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm shadow-slate-200/50 dark:shadow-none relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Ativos Concedidos</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Banknote size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
            {formatBrl(totalEmprestadoAtivo)}
          </div>
          <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mt-1">{ativos.length} contratos ativos</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm shadow-slate-200/50 dark:shadow-none relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Saldo a Receber</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <TrendingUp size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatBrl(totalSaldoAReceber)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Principal em aberto</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm shadow-slate-200/50 dark:shadow-none relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Parcelas do Mês</span>
            <div className="w-7 h-7 rounded-lg bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Clock size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-cyan-700 dark:text-cyan-400 font-mono">
            {formatBrl(parcelasMesPrevistas)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Ref: {compAtual}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm shadow-slate-200/50 dark:shadow-none relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Recebido Efetivo</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatBrl(parcelasMesRecebidas)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Confirmado em folha</div>
        </div>

        <div className="col-span-2 lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm shadow-slate-200/50 dark:shadow-none relative overflow-hidden transition-all hover:shadow-md">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Atrasos / Alertas</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertTriangle size={15} />
            </div>
          </div>
          <div className={`text-lg sm:text-xl font-black font-mono ${parcelasEmAtraso > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
            {parcelasEmAtraso}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {parcelasEmAtraso > 0 ? 'Pendência de conciliação' : '100% regular'}
          </div>
        </div>
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
            <option value="todos">Todos os Status</option>
            <option value="solicitado">Novas Solicitações</option>
            <option value="aguardando_assinatura">Aguardando Assinatura</option>
            <option value="aguardando_liberacao">Aguardando Liberação TED</option>
            <option value="ativo">Ativos em Folha</option>
            <option value="quitado">Quitados</option>
            <option value="contraproposta">Em Contraproposta</option>
            <option value="recusado">Recusados</option>
            <option value="cancelado">Cancelados</option>
          </select>
        </div>
      </div>

      {/* TABELA DE OPERAÇÕES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Operação</th>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4 text-right">Valor Concedido</th>
                <th className="py-3 px-4 text-center">Parcelas</th>
                <th className="py-3 px-4 text-right">Saldo Devedor</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
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

                  return (
                    <tr key={loan.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        <div>{loan.codigoOperacao}</div>
                        <div className="text-[10px] text-slate-400 font-sans font-normal">
                          {new Date(loan.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{loan.colaboradorNome}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {loan.colaboradorCargo || 'Colaborador'} • CPF: {loan.colaboradorCpf}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        {formatBrl(loan.valorAprovado)}
                        <div className="text-[10px] text-slate-400 font-sans font-normal">
                          {loan.taxaMensal}% a.m.
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {loan.quantidadeParcelas}x
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatBrl(loan.saldoDevedorAtual)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${badge.bg}`}>
                          {badge.label}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Ação 1: Analisar */}
                          {isPendingAnalysis && (
                            <button
                              onClick={() => handleOpenAnalysisModal(loan)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 transition-all"
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
                              className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 transition-all"
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

        {/* LISTAGEM EM CARDS PARA DISPOSITIVOS MÓVEIS */}
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

                  <div className="flex items-center gap-2 pt-1">
                    {isPendingAnalysis && (
                      <button
                        onClick={() => handleOpenAnalysisModal(loan)}
                        className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
                      >
                        <span>Analisar</span>
                      </button>
                    )}
                    {isPendingDisbursement && (
                      <button
                        onClick={() => {
                          setDisbursingLoan(loan)
                          setComprovanteUrl(loan.comprovanteLiberacaoUrl || '')
                        }}
                        className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all"
                      >
                        <Banknote size={14} />
                        <span>Liberar</span>
                      </button>
                    )}
                    <button
                      onClick={() => onOpenDetails(loan)}
                      className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Eye size={14} />
                      <span>Detalhes</span>
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

            <div className="bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200/80 dark:border-cyan-800/40 rounded-xl p-3.5 text-xs font-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-sans">Favorecido:</span>
                <span className="font-bold text-slate-900 dark:text-white">{disbursingLoan.colaboradorNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400 font-sans">Valor a Liberar:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatBrl(disbursingLoan.valorAprovado)}</span>
              </div>
              {disbursingLoan.dadosBancarios?.chavePix && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-sans">Chave PIX:</span>
                  <span className="text-cyan-700 dark:text-cyan-300 font-bold">{disbursingLoan.dadosBancarios.chavePix}</span>
                </div>
              )}
              {disbursingLoan.dadosBancarios?.banco && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400 font-sans">Banco / Ag / Conta:</span>
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

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDisbursingLoan(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isSubmittingDisbursement}
                onClick={handleConfirmDisbursement}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white shadow-sm shadow-cyan-600/30 disabled:opacity-50 transition-colors"
              >
                {isSubmittingDisbursement ? 'Confirmando...' : 'Confirmar Liberação e Ativar'}
              </button>
            </div>
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
    </div>
  )
}
