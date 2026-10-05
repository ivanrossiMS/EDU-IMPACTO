'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Send,
  HelpCircle,
  Building,
  Info,
  Calendar,
  DollarSign,
  UserCheck
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
  // Parâmetros da Simulação
  const [valor, setValor] = useState<number>(3000)
  const [parcelas, setParcelas] = useState<number>(10)
  const [taxa, setTaxa] = useState<number>(config.taxaMensalPadrao || 1.5)
  const [metodo, setMetodo] = useState<MetodoCalculo>(config.metodoCalculoPadrao || 'JUROS_SIMPLES_SALDO')
  
  // Se admin conceder para um colaborador específico
  const [targetColaboradorId, setTargetColaboradorId] = useState<string>('')

  // Campo de CPF (obrigatório para contrato e sincronizado com o cadastro)
  const [cpfInput, setCpfInput] = useState<string>(currentUserCpf ? formatCpfMask(currentUserCpf) : '')
  
  // Detalhes da solicitação
  const [justificativa, setJustificativa] = useState('')
  const [finalidade, setFinalidade] = useState('Despesas Pessoais / Emergência')
  const [showMemoria, setShowMemoria] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)

  // Sincroniza CPF inicial do usuário logado se chegar após carregamento
  useEffect(() => {
    if (currentUserCpf && !cpfInput) {
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

  // Sincroniza taxa e método caso a configuração inicial mude
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
      } else {
        setCpfInput('')
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
    if (valor < config.valorMinimoEmprestimo || valor > config.valorMaximoEmprestimo) {
      toast.error(`Valor deve estar entre ${formatBrl(config.valorMinimoEmprestimo)} e ${formatBrl(config.valorMaximoEmprestimo)}.`)
      return
    }
    if (parcelas < config.prazoMinimoParcelas || parcelas > config.prazoMaximoParcelas) {
      toast.error(`Prazo deve estar entre ${config.prazoMinimoParcelas} e ${config.prazoMaximoParcelas} parcelas.`)
      return
    }
    if (isAdminOrFinance && viewMode === 'admin' && !targetColaboradorId) {
      toast.error('Selecione o colaborador beneficiário para prosseguir com a concessão.')
      return
    }

    const cleanCpfDigits = (cpfInput || '').replace(/\D/g, '')
    if (cleanCpfDigits.length > 0 && cleanCpfDigits.length !== 11) {
      toast.error('O CPF informado deve conter 11 dígitos, ou pode ser deixado em branco para preenchimento no momento do aceite.')
      return
    }

    setShowConfirmationModal(true)
  }

  const handleSubmitRequest = async () => {
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
        dadosBancarios,
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
      if (onRequestSubmitted) onRequestSubmitted()
    } catch (err: any) {
      toast.error(err.message || 'Falha ao enviar proposta.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* SIMULADOR CARD PRINCIPAL */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator size={18} className="text-emerald-600 dark:text-emerald-400" />
              Simulador Financeiro de Empréstimo
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ajuste as condições desejadas e visualize a composição exata das parcelas e juros.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Taxa Aplicada:</span>
            <div className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{taxa.toFixed(2)}% a.m.</div>
          </div>
        </div>

        {/* SELETOR DE COLABORADOR E CAMPO DE CPF */}
        {isAdminOrFinance && viewMode === 'admin' ? (
          <div className="mb-6 p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/40">
            <label className="block text-xs font-bold text-blue-900 dark:text-blue-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Building size={14} className="text-blue-600 dark:text-blue-400" />
              <span>Cadastrar Empréstimo em Nome de Colaborador (Iniciado pela Escola)</span>
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <select
                  value={targetColaboradorId}
                  onChange={(e) => setTargetColaboradorId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-950 border border-blue-200 dark:border-blue-800/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                >
                  <option value="">Selecione um colaborador da lista...</option>
                  {colaboradoresList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.cargo ? `— ${c.cargo}` : ''} {c.unidade ? `(${c.unidade})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="text"
                  placeholder="CPF (000.000.000-00)"
                  maxLength={14}
                  value={cpfInput}
                  onChange={(e) => setCpfInput(formatCpfMask(e.target.value))}
                  className="w-full bg-white dark:bg-slate-950 border border-blue-200 dark:border-blue-800/60 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>
            {selectedColaborador && (
              <p className="text-[11px] text-blue-700 dark:text-blue-300 mt-2 font-medium">
                Unidade: <strong>{selectedColaborador.unidade || 'Não informada'}</strong> • Cargo: <strong>{selectedColaborador.cargo || 'Colaborador'}</strong>
                {!selectedColaborador.cpf && ' • (CPF não cadastrado: preencha para salvar no cadastro funcional)'}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* NOME E UNIDADE DO COLABORADOR */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <UserCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Colaborador Solicitante</span>
                </label>
                <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-semibold shadow-sm">
                  <div>{currentUserName || 'Meu Usuário'}</div>
                  <div className="text-[11px] font-normal text-slate-500 dark:text-slate-400 mt-0.5">
                    {currentUserCargo || 'Colaborador'}
                    {currentUserUnidade ? ` • Unidade: ${currentUserUnidade}` : ''}
                  </div>
                </div>
              </div>

              {/* CAMPO DE CPF COM MÁSCARA E SALVAMENTO NO CADASTRO */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span>CPF do Colaborador</span>
                    <span className="text-[10px] text-slate-400 font-normal lowercase">(opcional agora)</span>
                  </span>
                  {currentUserCpf ? (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold lowercase">
                      cadastrado
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal lowercase">
                      ou preencha no aceite
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  maxLength={14}
                  value={cpfInput}
                  onChange={(e) => setCpfInput(formatCpfMask(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 shadow-sm"
                />
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  {currentUserCpf
                    ? 'CPF obtido do seu cadastro funcional e vinculado ao contrato.'
                    : 'Pode ser preenchido agora ou no momento do aceite/assinatura digital.'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* COLUNA ESQUERDA: CONTROLES INTERATIVOS */}
          <div className="space-y-6">
            {/* VALOR DO EMPRÉSTIMO */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Valor Desejado
                </label>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatBrl(valor)}
                </div>
              </div>
              <input
                type="range"
                min={config.valorMinimoEmprestimo || 200}
                max={config.valorMaximoEmprestimo || 25000}
                step={100}
                value={valor}
                onChange={(e) => setValor(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
                <span>Min: {formatBrl(config.valorMinimoEmprestimo || 200)}</span>
                <span>Max: {formatBrl(config.valorMaximoEmprestimo || 25000)}</span>
              </div>
            </div>

            {/* QUANTIDADE DE PARCELAS */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Quantidade de Parcelas
                </label>
                <div className="text-lg font-black text-cyan-600 dark:text-cyan-400 font-mono">
                  {parcelas}x mensais
                </div>
              </div>
              <input
                type="range"
                min={config.prazoMinimoParcelas || 1}
                max={config.prazoMaximoParcelas || 24}
                step={1}
                value={parcelas}
                onChange={(e) => setParcelas(Number(e.target.value))}
                className="w-full accent-cyan-600 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
                <span>Min: {config.prazoMinimoParcelas || 1}x</span>
                <span>Max: {config.prazoMaximoParcelas || 24}x</span>
              </div>
            </div>

            {/* MÉTODO DE CÁLCULO */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Método de Cálculo e Amortização
              </label>
              <select
                value={metodo}
                onChange={(e) => setMetodo(e.target.value as MetodoCalculo)}
                disabled={!isAdminOrFinance && config.metodosPermitidos?.length <= 1}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-75"
              >
                {config.metodosPermitidos.map((m) => (
                  <option key={m} value={m}>
                    {METODOS_LABELS[m]?.nome || m}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 italic">
                {METODOS_LABELS[metodo]?.descricao}
              </p>
            </div>

            {/* TAXA MENSAL (APENAS EDITÁVEL POR ADMIN EM CONCESSÃO PELA ESCOLA) */}
            {isAdminOrFinance && viewMode === 'admin' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Taxa de Juros Mensal (% a.m.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="15"
                  value={taxa}
                  onChange={(e) => setTaxa(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            )}
          </div>

          {/* COLUNA DIREITA: CARDS DE RESUMO E RESULTADO */}
          <div className="flex flex-col justify-between space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">
                  {metodo === 'JUROS_SIMPLES_SALDO' ? '1ª Parcela (Maior)' : 'Valor da Parcela'}
                </span>
                <div className="text-xl font-black text-slate-900 dark:text-white font-mono mt-1">
                  {formatBrl(simulacao.valorPrimeiraParcela)}
                </div>
                {metodo === 'JUROS_SIMPLES_SALDO' && simulacao.valorPrimeiraParcela !== simulacao.valorUltimaParcela && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Última parcela: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{formatBrl(simulacao.valorUltimaParcela)}</strong>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4">
                <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Total de Juros</span>
                <div className="text-xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                  {formatBrl(simulacao.totalJuros)}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Custo efetivo total do mútuo
                </div>
              </div>

              <div className="col-span-2 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 dark:from-emerald-950/40 dark:via-teal-950/30 dark:to-slate-900 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300">
                      Total Geral a Pagar
                    </span>
                    <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
                      {formatBrl(simulacao.totalAPagar)}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-600 dark:text-slate-400">
                    <div>{parcelas} parcelas em folha</div>
                    <div className="font-semibold text-slate-700 dark:text-slate-300">Quinto dia útil de cada mês</div>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTÃO DE CONFIRMAÇÃO */}
            <button
              onClick={handleOpenModal}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-sm shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              <Send size={16} />
              <span>
                {isAdminOrFinance && viewMode === 'admin' && targetColaboradorId
                  ? 'Avançar com a Concessão do Empréstimo'
                  : 'Solicitar Empréstimo com Estas Condições'}
              </span>
            </button>
            <p className="text-[10px] text-center text-slate-400 dark:text-slate-500">
              * A simulação não constitui aprovação automática. As condições finais estão sujeitas a análise de margem e assinatura digital do contrato.
            </p>
          </div>
        </div>

        {/* MEMÓRIA DE CÁLCULO DETALHADA (EXPANSÍVEL) */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setShowMemoria(!showMemoria)}
            className="flex items-center justify-between w-full text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <span className="flex items-center gap-2">
              <Info size={14} className="text-cyan-600 dark:text-cyan-400" />
              Ver Memória de Cálculo e Cronograma Mês a Mês ({parcelas} parcelas)
            </span>
            {showMemoria ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showMemoria && (
            <div className="mt-4 space-y-4 animate-in fade-in duration-200">
              {/* ITENS DA MEMÓRIA */}
              <div className="bg-slate-50 dark:bg-slate-950/60 rounded-xl p-4 border border-slate-200/80 dark:border-slate-800 space-y-2 text-xs">
                <div className="font-bold text-cyan-800 dark:text-cyan-300 uppercase tracking-wider text-[11px] mb-2">
                  Memória de Cálculo Passo a Passo:
                </div>
                {simulacao.memoriaCalculo.itens.map((item, idx) => (
                  <div key={idx} className="flex flex-col border-b border-slate-200/60 dark:border-slate-800/80 pb-2 last:border-none">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{item.etapa}:</span>
                    <span className="text-slate-600 dark:text-slate-400 text-[11px]">{item.descricao}</span>
                    {item.formula && (
                      <code className="text-[10px] text-cyan-700 dark:text-cyan-400 font-mono mt-0.5">
                        Fórmula: {item.formula}
                      </code>
                    )}
                  </div>
                ))}
              </div>

              {/* TABELA DE CRONOGRAMA */}
              <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 text-center">Nº</th>
                      <th className="py-2.5 px-3">Competência</th>
                      <th className="py-2.5 px-3">Vencimento</th>
                      <th className="py-2.5 px-3 text-right">Amortização</th>
                      <th className="py-2.5 px-3 text-right">Juros</th>
                      <th className="py-2.5 px-3 text-right">Total Parcela</th>
                      <th className="py-2.5 px-3 text-right">Saldo Devedor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 font-mono text-[11px]">
                    {simulacao.parcelas.map((p) => (
                      <tr key={p.numero} className="hover:bg-slate-50/70 dark:hover:bg-white/5 transition-colors">
                        <td className="py-2 px-3 text-center font-bold text-slate-700 dark:text-slate-300">{p.numero}</td>
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300">{p.competencia}</td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                          {new Date(p.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-200">{formatBrl(p.valorAmortizacao)}</td>
                        <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-400">{formatBrl(p.valorJuros)}</td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">{formatBrl(p.valorTotal)}</td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-cyan-400">{formatBrl(p.saldoDevedorApos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

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
                  {isAdminOrFinance && viewMode === 'admin' && selectedColaborador
                    ? `${selectedColaborador.nome} (${selectedColaborador.cargo || 'Colaborador'})`
                    : `${currentUserName || 'Meu Usuário'} ${currentUserCargo ? `(${currentUserCargo})` : ''}`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-sans">CPF do Contrato:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                  {cpfInput || 'Não informado'}
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
                <span className="text-slate-500 dark:text-slate-400 font-sans">Taxa / Método:</span>
                <span className="text-cyan-700 dark:text-cyan-300 font-bold">{taxa}% a.m. • {METODOS_LABELS[metodo]?.nome}</span>
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

              {/* DADOS BANCÁRIOS PARA LIBERAÇÃO */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Building size={14} className="text-emerald-600 dark:text-emerald-400" />
                  Dados Bancários para Crédito do Valor (PIX ou Conta)
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <input
                      type="text"
                      placeholder="Chave PIX (CPF, E-mail, Celular)"
                      value={dadosBancarios.chavePix}
                      onChange={(e) => setDadosBancarios({ ...dadosBancarios, chavePix: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Nome do Banco (ex: Nubank, BB)"
                      value={dadosBancarios.banco}
                      onChange={(e) => setDadosBancarios({ ...dadosBancarios, banco: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Agência"
                      value={dadosBancarios.agencia}
                      onChange={(e) => setDadosBancarios({ ...dadosBancarios, agencia: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Conta com dígito"
                      value={dadosBancarios.conta}
                      onChange={(e) => setDadosBancarios({ ...dadosBancarios, conta: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
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
    </div>
  )
}
