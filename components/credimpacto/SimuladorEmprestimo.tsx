'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Calculator,
  Receipt,
  Calendar,
  Wallet,
  CreditCard,
  Percent,
  User,
  Link2,
  Send,
  Pencil,
  ChevronDown,
  FileText,
  Info,
  CheckCircle2,
  X,
  Clock,
  Sparkles,
  ArrowRight,
  Building
} from 'lucide-react'
import {
  MetodoCalculo,
  CredImpactoConfig,
  DadosBancariosColaborador
} from '@/types/credimpacto'
import {
  simulateLoan,
  formatBrl,
  METODOS_LABELS
} from '@/lib/credimpacto/engine'
import { toast } from 'sonner'
import * as Slider from '@radix-ui/react-slider'

interface SimuladorEmprestimoProps {
  config: CredImpactoConfig
  userSalary?: number
  isAdminOrFinance: boolean
  viewMode?: 'admin' | 'colaborador'
  currentUserId?: string
  currentUserName?: string
  currentUserCargo?: string
  currentUserCpf?: string
  currentUserUnidade?: string
  colaboradoresList?: Array<{
    id: string
    nome: string
    cpf?: string
    cargo?: string
    salario?: number
    email?: string
    unidade?: string
  }>
  onRequestSubmitted?: () => void
}

function formatCpfMask(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

function getInitials(name: string): string {
  if (!name) return 'MA'
  const stopWords = ['de', 'da', 'do', 'das', 'dos', 'e']
  const words = name.trim().split(/\s+/).filter((w) => !stopWords.includes(w.toLowerCase()))
  if (words.length === 0) return 'MA'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + (words[1]?.[0] || words[words.length - 1][0])).toUpperCase()
}

function formatCompetenciaShort(comp: string): string {
  if (!comp) return ''
  const parts = comp.split('-')
  if (parts.length < 2) return comp
  const year = parts[0]
  const monthNum = parseInt(parts[1], 10)
  const monthNames = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ]
  const shortMonth = monthNames[monthNum - 1] || parts[1]
  return `${shortMonth}/${year}`
}

export function SimuladorEmprestimo({
  config,
  userSalary,
  isAdminOrFinance,
  viewMode = 'colaborador',
  currentUserId,
  currentUserName,
  currentUserCargo,
  currentUserCpf,
  currentUserUnidade,
  colaboradoresList = [],
  onRequestSubmitted
}: SimuladorEmprestimoProps) {
  // Parâmetros da Simulação (Inicia com R$ 1.000, 4 parcelas e Tabela Price)
  const [valor, setValor] = useState<number>(1000)
  const [parcelas, setParcelas] = useState<number>(4)
  const [taxa, setTaxa] = useState<number>(config.taxaMensalPadrao || 12)
  const [metodo, setMetodo] = useState<MetodoCalculo>(config.metodoCalculoPadrao || 'TABELA_PRICE')
  
  // Abas do cronograma inferior: 'parcelas' ou 'memoria'
  const [activeTabBottom, setActiveTabBottom] = useState<'parcelas' | 'memoria'>('parcelas')
  const [isEditingValor, setIsEditingValor] = useState(false)
  const [showMethodModal, setShowMethodModal] = useState(false)
  const [showRateModal, setShowRateModal] = useState(false)

  // Se admin conceder para um colaborador específico
  const [targetColaboradorId, setTargetColaboradorId] = useState<string>('')

  // Campo de CPF (obrigatório, exibido por completo e editável)
  const [cpfInput, setCpfInput] = useState<string>(
    currentUserCpf ? formatCpfMask(currentUserCpf) : '121.231.312-31'
  )
  
  // Detalhes da solicitação
  const [justificativa, setJustificativa] = useState('')
  const [finalidade, setFinalidade] = useState('Despesas Pessoais / Emergência')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [successData, setSuccessData] = useState<{
    codigoOperacao: string
    valor: number
    parcelas: number
    isConcessaoPelaEscola: boolean
  } | null>(null)

  const handleCloseSuccessModal = () => {
    setShowSuccessModal(false)
    if (onRequestSubmitted) {
      onRequestSubmitted()
    }
  }

  // Sincroniza CPF inicial do usuário logado se chegar após carregamento
  useEffect(() => {
    if (currentUserCpf && (!cpfInput || cpfInput === '121.231.312-31')) {
      setCpfInput(formatCpfMask(currentUserCpf))
    }
  }, [currentUserCpf])

  // Dados Bancários
  const [dadosBancarios, setDadosBancarios] = useState<DadosBancariosColaborador>({
    banco: '',
    agencia: '',
    conta: '',
    tipoConta: 'corrente',
    chavePix: '',
    tipoChavePix: 'cpf'
  })

  // Sincroniza taxa e método caso a configuração mude
  useEffect(() => {
    if (config.taxaMensalPadrao && (!isAdminOrFinance || viewMode === 'colaborador')) {
      setTaxa(config.taxaMensalPadrao)
    }
    if (config.metodoCalculoPadrao && (!isAdminOrFinance || viewMode === 'colaborador')) {
      setMetodo(config.metodoCalculoPadrao)
    }
  }, [config, isAdminOrFinance, viewMode])

  // Identifica o colaborador selecionado se for admin concedendo em nome da escola
  const selectedColaborador = useMemo(() => {
    if (!isAdminOrFinance || viewMode !== 'admin' || !targetColaboradorId) return null
    return colaboradoresList.find((c) => c.id === targetColaboradorId) || null
  }, [isAdminOrFinance, viewMode, targetColaboradorId, colaboradoresList])

  // Quando admin seleciona colaborador, sincroniza o CPF dele no campo
  useEffect(() => {
    if (selectedColaborador) {
      if (selectedColaborador.cpf) {
        setCpfInput(formatCpfMask(selectedColaborador.cpf))
      }
    }
  }, [selectedColaborador])

  const effectiveSalary = selectedColaborador?.salario || userSalary

  // Executa o cálculo da simulação em tempo real
  const simulacao = useMemo(() => {
    return simulateLoan(
      valor,
      parcelas,
      taxa,
      metodo,
      effectiveSalary,
      new Date(),
      config.diaPadraoDescontoFolha
    )
  }, [valor, parcelas, taxa, metodo, effectiveSalary, config.diaPadraoDescontoFolha])

  const handleOpenModal = () => {
    if (valor < (config.valorMinimoEmprestimo || 200) || valor > (config.valorMaximoEmprestimo || 3000)) {
      toast.error(`Valor deve estar entre ${formatBrl(config.valorMinimoEmprestimo || 200)} e ${formatBrl(config.valorMaximoEmprestimo || 3000)}.`)
      return
    }
    if (parcelas < (config.prazoMinimoParcelas || 1) || parcelas > (config.prazoMaximoParcelas || 10)) {
      toast.error(`Prazo deve estar entre ${config.prazoMinimoParcelas || 1} e ${config.prazoMaximoParcelas || 10} parcelas.`)
      return
    }
    if (isAdminOrFinance && viewMode === 'admin' && !targetColaboradorId) {
      toast.error('Selecione o colaborador beneficiário para prosseguir com a concessão.')
      return
    }

    const cleanCpfDigits = (cpfInput || '').replace(/\D/g, '')
    if (!cleanCpfDigits || cleanCpfDigits.length !== 11) {
      toast.error('O CPF é obrigatório e deve conter 11 dígitos para prosseguir com a solicitação.')
      return
    }

    // Se ainda não preencheu chave PIX, sugere o próprio CPF
    if (!dadosBancarios.chavePix) {
      setDadosBancarios((prev) => ({ ...prev, chavePix: formatCpfMask(cleanCpfDigits) }))
    }

    setShowConfirmationModal(true)
  }

  const handleSubmitRequest = async () => {
    if (!dadosBancarios.chavePix || !dadosBancarios.chavePix.trim()) {
      toast.error('Informe a Chave PIX para crédito do valor.')
      return
    }

    setIsSubmitting(true)
    try {
      const isConcessaoPelaEscola = isAdminOrFinance && viewMode === 'admin' && Boolean(targetColaboradorId)
      const formattedCpf = formatCpfMask(cpfInput)

      const payload: any = {
        valorSolicitado: valor,
        quantidadeParcelas: parcelas,
        taxaMensal: taxa,
        metodoCalculo: metodo,
        justificativaSolicitacao: justificativa,
        finalidade,
        dadosBancarios: {
          chavePix: dadosBancarios.chavePix.trim(),
          tipoConta: 'corrente'
        },
        criadoPorFinanceiro: isConcessaoPelaEscola,
        colaboradorCpf: formattedCpf
      }

      if (isConcessaoPelaEscola && selectedColaborador) {
        payload.colaboradorId = selectedColaborador.id
        payload.colaboradorNome = selectedColaborador.nome
        payload.colaboradorEmail = selectedColaborador.email
        payload.colaboradorCargo = selectedColaborador.cargo
        payload.colaboradorSalarioBase = selectedColaborador.salario
        payload.colaboradorUnidade = selectedColaborador.unidade
      }

      const res = await fetch('/api/credimpacto/emprestimos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao registrar solicitação')

      toast.success(
        isConcessaoPelaEscola
          ? `Empréstimo ${data.codigoOperacao} concedido! Aguardando aceite e assinatura do colaborador.`
          : `Solicitação ${data.codigoOperacao} enviada com sucesso para análise do financeiro!`
      )

      setShowConfirmationModal(false)
      setSuccessData({
        codigoOperacao: data.codigoOperacao || 'CRED-2026',
        valor,
        parcelas,
        isConcessaoPelaEscola
      })
      setShowSuccessModal(true)
    } catch (err: any) {
      toast.error(err.message || 'Falha ao enviar proposta.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Dados do Colaborador para exibição
  const displayCollaboratorName = selectedColaborador?.nome || currentUserName || 'Maria Auxiliadora de Araújo Honório Vilela'
  const displayCollaboratorCargo = selectedColaborador?.cargo || currentUserCargo || 'Auxiliar administrativo'
  const displayCollaboratorUnidade = selectedColaborador?.unidade || currentUserUnidade || 'Colégio Impacto'

  const minValor = config.valorMinimoEmprestimo || 200
  const maxValor = config.valorMaximoEmprestimo || 3000
  const minParcelas = config.prazoMinimoParcelas || 1
  const maxParcelas = config.prazoMaximoParcelas || 10

  // Cálculo percentual exato para preencher as barras dos sliders com cores sólidas
  const percentValor = Math.min(100, Math.max(0, ((valor - minValor) / (maxValor - minValor)) * 100))
  const percentParcelas = Math.min(100, Math.max(0, ((parcelas - minParcelas) / (maxParcelas - minParcelas)) * 100))

  return (
    <div className="space-y-6">

      {/* 1. CARD TOPO: IDENTIFICAÇÃO DO COLABORADOR & CPF (COM CABEÇALHO GRADIENTE) */}
      <div className="bg-gradient-to-r from-emerald-50/70 via-teal-50/30 to-white dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/60 dark:border-slate-800 rounded-2xl p-4 sm:px-6 sm:py-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden">
        {/* Linha gradiente decorativa superior */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

        {/* Lado Esquerdo: Avatar MA + Nome + Cargo / Colégio */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 font-bold text-sm flex items-center justify-center shrink-0 tracking-wide shadow-xs border border-emerald-200/50">
            {getInitials(displayCollaboratorName)}
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
              {displayCollaboratorName}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {displayCollaboratorCargo} • {displayCollaboratorUnidade}
            </div>
          </div>
        </div>

        {/* Lado Direito: CPF COMPLETO EDITÁVEL + Vinculado ao cadastro */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <User size={18} className="text-slate-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none mb-1">
                CPF do Colaborador
              </span>
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 focus-within:ring-2 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all shadow-2xs">
                <input
                  type="text"
                  value={cpfInput}
                  onChange={(e) => setCpfInput(formatCpfMask(e.target.value))}
                  maxLength={14}
                  placeholder="000.000.000-00"
                  className="w-32 bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 font-mono outline-none"
                  title="Clique para editar o CPF"
                />
                <Pencil size={13} className="text-slate-400 shrink-0" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Link2 size={15} className="rotate-45" />
            <span>Vinculado ao cadastro</span>
          </div>

          {/* Seletor rápido para Admin mudar de beneficiário */}
          {isAdminOrFinance && viewMode === 'admin' && (
            <select
              value={targetColaboradorId}
              onChange={(e) => setTargetColaboradorId(e.target.value)}
              className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-200 font-medium shadow-2xs"
            >
              <option value="">Trocar beneficiário...</option>
              {colaboradoresList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.cargo || 'Colaborador'})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* 2. SEÇÃO INTERMEDIÁRIA: CONFIGURE SEU EMPRÉSTIMO & RESUMO DA SIMULAÇÃO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* COLUNA ESQUERDA: CONFIGURE SEU EMPRÉSTIMO (7 colunas) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-6 relative overflow-hidden">
          <div>
            {/* CABEÇALHO COM COR GRADIENTE */}
            <div className="bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border-b border-emerald-500/15 -mx-6 -mt-6 p-5 sm:px-6 rounded-t-2xl mb-6 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                  <Calculator size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Configure seu empréstimo
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Ajuste o valor e o número de parcelas para ver sua proposta.
                  </p>
                </div>
              </div>
            </div>

            {/* 1. VALOR DESEJADO */}
            <div className="space-y-2.5 mb-6">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Valor desejado
                </span>
                <span className="text-slate-400 dark:text-slate-500 font-medium">
                  Entre {formatBrl(minValor)} e {formatBrl(maxValor)}
                </span>
              </div>

              {/* Caixa com Valor e Ícone de Lápis */}
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 flex items-center justify-between shadow-xs">
                {isEditingValor ? (
                  <input
                    type="number"
                    value={valor}
                    onChange={(e) => setValor(Number(e.target.value))}
                    onBlur={() => {
                      setIsEditingValor(false)
                      if (valor < minValor) setValor(minValor)
                      if (valor > maxValor) setValor(maxValor)
                    }}
                    autoFocus
                    className="text-xl font-black text-slate-900 dark:text-white font-mono bg-transparent outline-none w-full"
                  />
                ) : (
                  <div
                    onClick={() => setIsEditingValor(true)}
                    className="text-xl font-black text-slate-900 dark:text-white font-mono cursor-pointer"
                  >
                    {formatBrl(valor)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsEditingValor(!isEditingValor)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  title="Editar valor"
                >
                  <Pencil size={16} />
                </button>
              </div>

              {/* BARRA DE ROLAGEM COM COR VERDE PREENCHIDA (RADIX UI SLIDER) */}
              <div className="pt-2">
                <Slider.Root
                  className="relative flex items-center select-none touch-none w-full h-6 cursor-pointer"
                  value={[valor]}
                  onValueChange={([val]) => setValor(val)}
                  max={maxValor}
                  min={minValor}
                  step={50}
                >
                  <Slider.Track className="bg-slate-200 dark:bg-slate-700 relative grow rounded-full h-2.5 overflow-hidden">
                    <Slider.Range className="absolute bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 rounded-full h-full" />
                  </Slider.Track>
                  <Slider.Thumb
                    className="block w-6 h-6 bg-emerald-600 rounded-full border-[3.5px] border-white shadow-md hover:scale-110 active:scale-95 transition-transform focus:outline-none cursor-grab active:cursor-grabbing"
                    aria-label="Valor solicitado"
                  />
                </Slider.Root>
                <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-2 font-mono">
                  <span>{formatBrl(minValor)} (mínimo)</span>
                  <span>{formatBrl(maxValor)} (máximo)</span>
                </div>
              </div>
            </div>

            {/* 2. NÚMERO DE PARCELAS (EM AZUL COM COR PREENCHIDA RADIX UI) */}
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Número de parcelas
                </span>
                {/* Texto em Azul */}
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {parcelas}x mensais
                </span>
              </div>

              {/* BARRA DE ROLAGEM COM COR AZUL PREENCHIDA (RADIX UI SLIDER) */}
              <div className="pt-2">
                <Slider.Root
                  className="relative flex items-center select-none touch-none w-full h-6 cursor-pointer"
                  value={[parcelas]}
                  onValueChange={([val]) => setParcelas(val)}
                  max={maxParcelas}
                  min={minParcelas}
                  step={1}
                >
                  <Slider.Track className="bg-slate-200 dark:bg-slate-700 relative grow rounded-full h-2.5 overflow-hidden">
                    <Slider.Range className="absolute bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-500 rounded-full h-full" />
                  </Slider.Track>
                  <Slider.Thumb
                    className="block w-6 h-6 bg-blue-600 rounded-full border-[3.5px] border-white shadow-md hover:scale-110 active:scale-95 transition-transform focus:outline-none cursor-grab active:cursor-grabbing"
                    aria-label="Número de parcelas"
                  />
                </Slider.Root>
                <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 mt-2 font-mono">
                  <span>{minParcelas}x (mínimo)</span>
                  <span>{maxParcelas}x (máximo)</span>
                </div>
              </div>
            </div>
          </div>

          {/* PILLS INFERIORES: SISTEMA DE AMORTIZAÇÃO & TAXA DE JUROS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {/* Sistema de Amortização */}
            <div
              onClick={() => {
                if (isAdminOrFinance || config.metodosPermitidos?.length > 1) {
                  setShowMethodModal(true)
                }
              }}
              className="p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-100/70 transition-all"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs border border-slate-200/60 dark:border-slate-600 shrink-0">
                  <FileText size={16} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none truncate">
                    Sistema de amortização
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                    {METODOS_LABELS[metodo]?.nome || 'Tabela Price'}
                  </span>
                </div>
              </div>
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </div>

            {/* Taxa de Juros */}
            <div
              onClick={() => {
                if (isAdminOrFinance && viewMode === 'admin') {
                  setShowRateModal(true)
                }
              }}
              className={`p-3 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-3 transition-all ${
                isAdminOrFinance && viewMode === 'admin' ? 'cursor-pointer hover:bg-slate-100/70' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-center shadow-xs border border-slate-200/60 dark:border-slate-600 shrink-0">
                  <Percent size={15} />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block leading-none truncate">
                    Taxa de juros
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                    {taxa.toFixed(2).replace('.', ',')}% ao mês
                  </span>
                </div>
              </div>
              <ChevronDown size={14} className="text-slate-400 shrink-0" />
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: RESUMO DA SIMULAÇÃO (5 colunas) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between space-y-5 relative overflow-hidden">
          <div className="space-y-5">
            {/* CABEÇALHO COM COR GRADIENTE */}
            <div className="bg-gradient-to-r from-teal-500/10 via-emerald-500/5 to-transparent border-b border-emerald-500/15 -mx-6 -mt-6 p-5 sm:px-6 rounded-t-2xl mb-6 relative overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-400 to-teal-600" />
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-600/20 shrink-0">
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Resumo da simulação
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Confira os detalhes da sua proposta.
                  </p>
                </div>
              </div>
            </div>

            {/* CAIXA HERO DESTACADA EM VERDE (DESCONTO MENSAL EM FOLHA) */}
            <div className="rounded-2xl p-5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100/90 dark:border-emerald-800/40 space-y-1">
              <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                Desconto mensal em folha
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-900 dark:text-emerald-200 font-mono tracking-tight">
                {parcelas}x de {formatBrl(simulacao.valorPrimeiraParcela)}
              </div>
            </div>

            {/* ITENS DETALHADOS EM LINHA */}
            <div className="space-y-3 pt-1">
              {/* Valor solicitado */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
                  <CreditCard size={16} className="text-slate-400" />
                  <span>Valor solicitado</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                  {formatBrl(valor)}
                </span>
              </div>

              {/* Juros totais */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
                  <Percent size={16} className="text-slate-400" />
                  <span>Juros totais</span>
                </div>
                <span className="font-bold text-slate-900 dark:text-white font-mono text-sm">
                  {formatBrl(simulacao.totalJuros)}
                </span>
              </div>

              {/* Divisor */}
              <div className="border-t border-slate-100 dark:border-slate-800 my-1" />

              {/* Total a pagar */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-sm">
                  <CreditCard size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Total a pagar</span>
                </div>
                <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                  {formatBrl(simulacao.totalAPagar)}
                </span>
              </div>
            </div>
          </div>

          {/* BOTÃO E SUBTEXTO */}
          <div className="pt-2">
            <button
              onClick={handleOpenModal}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/25 flex items-center justify-center gap-2 active:scale-98 transition-all"
            >
              <Send size={15} />
              <span>Solicitar empréstimo &gt;</span>
            </button>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center font-medium mt-2">
              Sujeito à análise e assinatura do contrato.
            </p>
          </div>
        </div>
      </div>

      {/* 3. CARD INFERIOR: CRONOGRAMA DE PAGAMENTO (COM CABEÇALHO GRADIENTE) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 relative overflow-hidden">
        {/* CABEÇALHO COM COR GRADIENTE */}
        <div className="bg-gradient-to-r from-emerald-500/10 via-cyan-500/5 to-transparent border-b border-slate-100 dark:border-slate-800 -mx-6 -mt-6 p-5 sm:px-6 rounded-t-2xl mb-4 relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 shrink-0">
                <Calendar size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Cronograma de pagamento
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Veja o detalhamento de cada parcela do seu empréstimo.
                </p>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-200/80 dark:border-emerald-800/60 shrink-0 shadow-xs">
              {parcelas} parcelas
            </span>
          </div>
        </div>

        {/* Abas: Parcelas & Memória de Cálculo */}
        <div className="flex items-center gap-6 border-b border-slate-200/80 dark:border-slate-800 pt-2">
          <button
            onClick={() => setActiveTabBottom('parcelas')}
            className={`pb-2.5 text-xs font-bold transition-all relative ${
              activeTabBottom === 'parcelas'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span>Parcelas</span>
            {activeTabBottom === 'parcelas' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTabBottom('memoria')}
            className={`pb-2.5 text-xs font-bold transition-all relative ${
              activeTabBottom === 'memoria'
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span>Memória de cálculo</span>
            {activeTabBottom === 'memoria' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full" />
            )}
          </button>
        </div>

        {/* CONTEÚDO DA ABA 1: TABELA DE PARCELAS */}
        {activeTabBottom === 'parcelas' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50/80 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 font-semibold text-[11px]">
                <tr>
                  <th className="py-2.5 px-3 rounded-l-lg">Parcela</th>
                  <th className="py-2.5 px-3">Competência</th>
                  <th className="py-2.5 px-3">Vencimento</th>
                  <th className="py-2.5 px-3 text-right">Amortização</th>
                  <th className="py-2.5 px-3 text-right">Juros</th>
                  <th className="py-2.5 px-3 text-right">Valor da parcela</th>
                  <th className="py-2.5 px-3 text-right rounded-r-lg">Saldo devedor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[11px]">
                {simulacao.parcelas.map((p) => (
                  <tr key={p.numero} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300 font-sans">
                      {String(p.numero).padStart(2, '0')}
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-sans">
                      {formatCompetenciaShort(p.competencia)}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {new Date(p.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatBrl(p.valorAmortizacao)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatBrl(p.valorJuros)}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      {formatBrl(p.valorTotal)}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">
                      {formatBrl(p.saldoDevedorApos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 flex items-center gap-1.5 font-sans">
              <Info size={13} className="shrink-0 text-slate-400" />
              <span>Valores ilustrativos da simulação.</span>
            </div>
          </div>
        )}

        {/* CONTEÚDO DA ABA 2: MEMÓRIA DE CÁLCULO */}
        {activeTabBottom === 'memoria' && (
          <div className="space-y-2.5 pt-2 animate-in fade-in duration-150">
            <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider text-[11px] mb-2">
                Memória de Cálculo Passo a Passo:
              </div>
              {simulacao.memoriaCalculo.itens.map((item, idx) => (
                <div key={idx} className="flex flex-col border-b border-slate-200/60 dark:border-slate-800/80 pb-2.5 last:border-none">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{item.etapa}:</span>
                  <span className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">{item.descricao}</span>
                  {item.formula && (
                    <code className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono mt-1">
                      Fórmula: {item.formula}
                    </code>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MODAL PARA ESCOLHER MÉTODO DE AMORTIZAÇÃO (SE ADMIN OU HABILITADO) */}
      {showMethodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Sistema de Amortização
              </h3>
              <button onClick={() => setShowMethodModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            <div className="space-y-1.5">
              {(config.metodosPermitidos || ['TABELA_PRICE', 'JUROS_SIMPLES_SALDO']).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMetodo(m)
                    setShowMethodModal(false)
                  }}
                  className={`w-full text-left p-3 rounded-xl border text-xs transition-all ${
                    metodo === m
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="font-semibold">{METODOS_LABELS[m]?.nome || m}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{METODOS_LABELS[m]?.descricao}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA EDITAR TAXA DE JUROS (SE ADMIN) */}
      {showRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xs w-full p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Taxa de Juros Mensal
              </h3>
              <button onClick={() => setShowRateModal(false)} className="text-slate-400 hover:text-slate-700">
                ✕
              </button>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500 block">Percentual ao mês (% a.m.)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="25"
                value={taxa}
                onChange={(e) => setTaxa(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold font-mono text-slate-900 dark:text-white"
              />
            </div>
            <button
              onClick={() => setShowRateModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              Confirmar Taxa
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO E DADOS BANCÁRIOS */}
      {showConfirmationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />
                Confirmar Dados da Solicitação
              </h3>
              <button
                onClick={() => setShowConfirmationModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors text-sm"
              >
                ✕
              </button>
            </div>

            {/* IDENTIFICAÇÃO DO COLABORADOR */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3 border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Colaborador Titular:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {displayCollaboratorName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">CPF do Contrato:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {cpfInput || currentUserCpf || 'Não informado'}
                </span>
              </div>
            </div>

            {/* RESUMO DAS CONDIÇÕES */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200/80 dark:border-slate-700/60 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Valor Requisitado:</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatBrl(valor)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Parcelamento:</span>
                <span className="text-slate-900 dark:text-white font-medium">{parcelas}x parcelas em folha</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">
                  Taxa Mensal:
                </span>
                <span className="text-cyan-700 dark:text-cyan-300 font-bold">
                  {taxa}% a.m. • {METODOS_LABELS[metodo]?.nome}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">Total com Juros:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatBrl(simulacao.totalAPagar)}</span>
              </div>
            </div>

            {/* FINALIDADE E JUSTIFICATIVA */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Finalidade do Empréstimo
                </label>
                <select
                  value={finalidade}
                  onChange={(e) => setFinalidade(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  <option value="Despesas Pessoais / Emergência">Despesas Pessoais / Emergência</option>
                  <option value="Saúde / Tratamento Médico">Saúde / Tratamento Médico</option>
                  <option value="Educação / Cursos / Especialização">Educação / Cursos / Especialização</option>
                  <option value="Reforma Residencial">Reforma Residencial</option>
                  <option value="Quitação de Dívidas Externas">Quitação de Dívidas Externas</option>
                  <option value="Outro Motivo">Outro Motivo</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Justificativa ou Observações (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={justificativa}
                  onChange={(e) => setJustificativa(e.target.value)}
                  placeholder="Informações adicionais para a comissão de crédito..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* CHAVE PIX PARA LIBERAÇÃO DO VALOR (OBRIGATÓRIO) */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building size={14} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Chave PIX para Recebimento</span>
                  </span>
                  <span className="text-[10px] text-rose-500 font-bold lowercase">
                    * obrigatório
                  </span>
                </label>
                <input
                  type="text"
                  placeholder="Informe sua Chave PIX (CPF, Celular, E-mail ou Aleatória)"
                  value={dadosBancarios.chavePix}
                  onChange={(e) => setDadosBancarios({ ...dadosBancarios, chavePix: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono shadow-sm"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  O valor de {formatBrl(valor)} será transferido via PIX para esta chave após aprovação e assinatura digital.
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmationModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-colors"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSubmitRequest}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white shadow-sm shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? (
                  <span>Enviando proposta...</span>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Confirmar e Enviar Proposta</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SUCESSO ULTRA MODERNO: PROPOSTA ENVIADA */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-emerald-500/30 dark:border-emerald-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-500/10 dark:shadow-none overflow-hidden text-center animate-in zoom-in-95 duration-300">
            {/* Luz Ambiente Superior */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

            {/* Listra Superior Gradiente */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

            {/* Botão de Fechar */}
            <button
              onClick={handleCloseSuccessModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Fechar"
            >
              <X size={18} />
            </button>

            {/* Ícone Hero */}
            <div className="relative mx-auto mb-4 w-20 h-20 rounded-3xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-400 p-0.5 shadow-xl shadow-emerald-500/25 flex items-center justify-center">
              <div className="w-full h-full rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white">
                <CheckCircle2 size={38} className="animate-in zoom-in duration-500" />
              </div>
            </div>

            {/* Badge de Protocolo */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/60 mb-2 font-mono">
              <span>Protocolo:</span>
              <span className="font-extrabold">{successData?.codigoOperacao}</span>
            </div>

            {/* Título */}
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Proposta Enviada com Sucesso!
            </h3>

            {/* Descrição Principal */}
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
              Sua solicitação de empréstimo foi registrada no sistema com sucesso.
            </p>

            {/* Card Destacado: Status da Análise */}
            <div className="my-5 p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-left space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock size={16} />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    Análise pelo Setor Responsável
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    A sua proposta será analisada pela comissão de crédito e pelo setor responsável. Em breve você receberá o retorno com os próximos passos.
                  </div>
                </div>
              </div>

              {/* Dados da Proposta em Resumo */}
              <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-200/60 dark:border-slate-700/60 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans uppercase">Valor Solicitado</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatBrl(successData?.valor || valor)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans uppercase">Parcelamento</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{successData?.parcelas || parcelas}x em folha</span>
                </div>
              </div>
            </div>

            {/* Dica de Próximo Passo */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mb-6">
              <Sparkles size={13} className="text-emerald-500 shrink-0" />
              <span>Assim que aprovada, você receberá a via digital para assinatura.</span>
            </div>

            {/* Botão de Ação Principal */}
            <button
              onClick={handleCloseSuccessModal}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm shadow-lg shadow-emerald-600/25 transition-all transform active:scale-98 flex items-center justify-center gap-2"
            >
              <span>Entendido, Acompanhar Proposta</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
