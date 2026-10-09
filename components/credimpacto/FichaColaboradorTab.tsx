'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  User,
  Users,
  Search,
  ChevronLeft,
  ChevronRight,
  Printer,
  FileSpreadsheet,
  Share2,
  Copy,
  Wallet,
  Receipt,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Landmark,
  TrendingDown,
  Building2,
  Eye,
  FileText,
  BadgeCheck,
  Percent,
  Filter,
  ArrowRight,
  Check,
  CreditCard,
  Phone,
  Mail,
  SlidersHorizontal,
  ChevronDown,
  Sparkles
} from 'lucide-react'
import {
  CredImpactoEmprestimo,
  CredImpactoParcela,
  CredImpactoConfig
} from '@/types/credimpacto'
import { formatBrl, METODOS_LABELS, roundMoney } from '@/lib/credimpacto/engine'
import { toast } from 'sonner'

interface FichaColaboradorTabProps {
  emprestimos: CredImpactoEmprestimo[]
  colaboradoresList?: any[]
  config: CredImpactoConfig
  onOpenDetails: (loan: CredImpactoEmprestimo) => void
  onRefresh?: () => void
  initialSelectedColaboradorId?: string
}

interface ColaboradorItem {
  id: string
  allIds: string[]
  nome: string
  cpf: string
  matricula: string
  cargo: string
  unidade: string
  email: string
  telefone: string
  salario: number
  dadosBancarios?: any
  loans: CredImpactoEmprestimo[]
  activeLoans: CredImpactoEmprestimo[]
  totalTomado: number
  totalEmAnalise: number
  contratosEmAnaliseCount: number
  contratosConcedidosCount: number
  saldoDevedor: number
  totalAmortizado: number
  totalJuros: number
  hasLoans: boolean
  hasActiveLoans: boolean
  proximaParcela: (CredImpactoParcela & { codigoOperacao: string }) | null
}

function cleanCpfDigits(val?: string | null): string {
  if (!val) return ''
  const digits = val.replace(/\D/g, '')
  return digits.length === 11 && digits !== '00000000000' ? digits : ''
}

function cleanMatriculaStr(val?: string | null): string {
  if (!val) return ''
  const trimmed = val.trim().toUpperCase()
  if (trimmed === 'N/A' || trimmed === '-' || trimmed === 'SEM MATRICULA') return ''
  return trimmed
}

function cleanNomeStr(val?: string | null): string {
  if (!val) return ''
  return val
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function FichaColaboradorTab({
  emprestimos,
  colaboradoresList = [],
  config,
  onOpenDetails,
  onRefresh,
  initialSelectedColaboradorId
}: FichaColaboradorTabProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedColabId, setSelectedColabId] = useState<string>(initialSelectedColaboradorId || '')
  const [filterMode, setFilterMode] = useState<'ativos' | 'com_historico' | 'todos'>('ativos')
  const [activeTabSubView, setActiveTabSubView] = useState<'contratos' | 'cronograma' | 'pagas'>('contratos')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null)
  
  useEffect(() => {
    if (initialSelectedColaboradorId) {
      setSelectedColabId(initialSelectedColaboradorId)
    }
  }, [initialSelectedColaboradorId])

  // 1. Agregação Unificada dos Colaboradores com e sem empréstimos (Deduplicação por CPF, Matrícula, Nome e IDs)
  const colaboradoresMap = useMemo(() => {
    const items: ColaboradorItem[] = []

    // Mapas de indexação para resolução rápida e unificação estrita de registros
    const byCpf = new Map<string, ColaboradorItem>()
    const byMatricula = new Map<string, ColaboradorItem>()
    const byName = new Map<string, ColaboradorItem>()
    const byId = new Map<string, ColaboradorItem>()

    const registerIndices = (colab: ColaboradorItem, extraId?: string) => {
      const cpfD = cleanCpfDigits(colab.cpf)
      if (cpfD) byCpf.set(cpfD, colab)

      const mat = cleanMatriculaStr(colab.matricula)
      if (mat) byMatricula.set(mat, colab)

      const nome = cleanNomeStr(colab.nome)
      if (nome && nome.split(' ').length >= 2) byName.set(nome, colab)

      if (colab.id) byId.set(colab.id, colab)
      if (extraId && extraId.trim()) {
        byId.set(extraId.trim(), colab)
        if (!colab.allIds.includes(extraId.trim())) {
          colab.allIds.push(extraId.trim())
        }
      }
    }

    const findExisting = (candidate: {
      id?: string
      colaboradorId?: string
      cpf?: string
      colaboradorCpf?: string
      matricula?: string
      colaboradorMatricula?: string
      nome?: string
      colaboradorNome?: string
      email?: string
      colaboradorEmail?: string
    }): ColaboradorItem | undefined => {
      // 1. CPF (Chave única primária de qualquer trabalhador no Brasil)
      const cpfD = cleanCpfDigits(candidate.cpf || candidate.colaboradorCpf)
      if (cpfD && byCpf.has(cpfD)) return byCpf.get(cpfD)

      // 2. Matrícula institucional
      const mat = cleanMatriculaStr(candidate.matricula || candidate.colaboradorMatricula)
      if (mat && byMatricula.has(mat)) return byMatricula.get(mat)

      // 3. ID do sistema
      const id = (candidate.id || candidate.colaboradorId || '').trim()
      if (id && byId.has(id)) return byId.get(id)

      // 4. Nome completo normalizado (com ao menos duas palavras)
      const nome = cleanNomeStr(candidate.nome || candidate.colaboradorNome)
      if (nome && nome.split(' ').length >= 2 && byName.has(nome)) return byName.get(nome)

      // 5. E-mail cadastrado
      const email = (candidate.email || candidate.colaboradorEmail || '').trim().toLowerCase()
      if (email && email.includes('@')) {
        const found = items.find((c) => c.email && c.email.trim().toLowerCase() === email)
        if (found) return found
      }

      return undefined
    }

    // PASSO 1: Agrega e agrupa TODOS os empréstimos
    for (const emp of emprestimos) {
      const rawCpf = emp.colaboradorCpf || ''
      const rawNome = emp.colaboradorNome || 'Colaborador'
      const rawMat = emp.colaboradorMatricula || ''
      const rawId = emp.colaboradorId || ''

      let colab = findExisting({
        id: rawId,
        colaboradorId: rawId,
        cpf: rawCpf,
        matricula: rawMat,
        nome: rawNome,
        email: emp.colaboradorEmail
      })

      if (!colab) {
        const cpfD = cleanCpfDigits(rawCpf)
        const canonicalId = cpfD
          ? `cpf_${cpfD}`
          : rawMat
          ? `mat_${cleanMatriculaStr(rawMat)}`
          : rawId
          ? `id_${rawId}`
          : `colab_${items.length + 1}`

        colab = {
          id: canonicalId,
          allIds: rawId ? [rawId] : [],
          nome: rawNome,
          cpf: rawCpf,
          matricula: rawMat,
          cargo: emp.colaboradorCargo || 'Colaborador',
          unidade: emp.colaboradorUnidade || 'Geral',
          email: emp.colaboradorEmail || '',
          telefone: '',
          salario: emp.colaboradorSalarioBase || 0,
          dadosBancarios: emp.dadosBancarios,
          loans: [],
          activeLoans: [],
          totalTomado: 0,
          totalEmAnalise: 0,
          contratosEmAnaliseCount: 0,
          contratosConcedidosCount: 0,
          saldoDevedor: 0,
          totalAmortizado: 0,
          totalJuros: 0,
          hasLoans: true,
          hasActiveLoans: false,
          proximaParcela: null
        }
        items.push(colab)
      }

      // Adiciona o contrato sem duplicar
      if (!colab.loans.some((l) => l.id === emp.id)) {
        colab.loans.push(emp)
      }
      colab.hasLoans = true

      if (emp.status === 'ativo') {
        if (!colab.activeLoans.some((l) => l.id === emp.id)) {
          colab.activeLoans.push(emp)
        }
        colab.hasActiveLoans = true
        colab.saldoDevedor += emp.saldoDevedorAtual || 0
      }

      // 1. Contratos Concedidos / Formalizados (Ativo, Quitado, Aguardando Liberação TED, Renegociado)
      const isConcedido =
        emp.status === 'ativo' ||
        emp.status === 'quitado' ||
        emp.status === 'aguardando_liberacao' ||
        emp.status === 'renegociado'

      if (isConcedido) {
        colab.totalTomado += emp.valorAprovado || emp.valorSolicitado || 0
        colab.contratosConcedidosCount += 1
      }

      // 2. Propostas em Análise / Pendentes de Aprovação (Solicitado, Em Análise, Contraproposta, Aguardando Assinatura)
      const isEmAnalise =
        emp.status === 'solicitado' ||
        emp.status === 'em_analise' ||
        emp.status === 'contraproposta' ||
        emp.status === 'aguardando_assinatura'

      if (isEmAnalise) {
        colab.totalEmAnalise += emp.valorSolicitado || emp.valorAprovado || 0
        colab.contratosEmAnaliseCount += 1
      }

      colab.totalAmortizado += emp.totalAmortizado || 0
      colab.totalJuros += emp.totalJuros || 0

      // Atualiza dados cadastrais mais ricos
      if (emp.dadosBancarios && (!colab.dadosBancarios || !colab.dadosBancarios.chavePix)) {
        colab.dadosBancarios = emp.dadosBancarios
      }
      if (emp.colaboradorSalarioBase && (!colab.salario || colab.salario === 0)) {
        colab.salario = emp.colaboradorSalarioBase
      }
      if (emp.colaboradorCargo && (!colab.cargo || colab.cargo === 'Colaborador')) {
        colab.cargo = emp.colaboradorCargo
      }
      if (emp.colaboradorUnidade && (!colab.unidade || colab.unidade === 'Geral')) {
        colab.unidade = emp.colaboradorUnidade
      }
      if (emp.colaboradorEmail && !colab.email) {
        colab.email = emp.colaboradorEmail
      }
      if (emp.colaboradorMatricula && !colab.matricula) {
        colab.matricula = emp.colaboradorMatricula
      }
      if (emp.colaboradorCpf && !colab.cpf) {
        colab.cpf = emp.colaboradorCpf
      }

      registerIndices(colab, rawId)
    }

    // PASSO 2: Mescla dados de RH cadastrados (colaboradoresList)
    for (const f of colaboradoresList) {
      const fId = f.id || ''
      const fCpf = f.cpf || f.dados?.cpf || ''
      const fNome = f.nome || f.dados?.nome || ''
      const fMat = f.matricula || f.dados?.matricula || ''
      const fEmail = f.email || f.dados?.email || ''
      const fSal = Number(f.salario || f.dados?.salario || 0)
      const fTel = f.telefone || f.dados?.telefone || f.celular || ''

      let colab = findExisting({
        id: fId,
        colaboradorId: fId,
        cpf: fCpf,
        matricula: fMat,
        nome: fNome,
        email: fEmail
      })

      if (colab) {
        if (fSal > 0) colab.salario = fSal
        if (fTel && !colab.telefone) colab.telefone = fTel
        if (f.unidade && (!colab.unidade || colab.unidade === 'Geral')) colab.unidade = f.unidade
        if (fEmail && !colab.email) colab.email = fEmail
        if (fMat && !colab.matricula) colab.matricula = fMat
        if (fCpf && !colab.cpf) colab.cpf = fCpf
        if (f.cargo && (!colab.cargo || colab.cargo === 'Colaborador')) colab.cargo = f.cargo
        registerIndices(colab, fId)
      } else {
        const cpfD = cleanCpfDigits(fCpf)
        const canonicalId = cpfD
          ? `cpf_${cpfD}`
          : fMat
          ? `mat_${cleanMatriculaStr(fMat)}`
          : fId
          ? `id_${fId}`
          : `colab_${items.length + 1}`

        const newColab: ColaboradorItem = {
          id: canonicalId,
          allIds: fId ? [fId] : [],
          nome: fNome || 'Colaborador',
          cpf: fCpf,
          matricula: fMat,
          cargo: f.cargo || 'Colaborador',
          unidade: f.unidade || 'Geral',
          email: fEmail,
          telefone: fTel,
          salario: fSal,
          dadosBancarios: undefined,
          loans: [],
          activeLoans: [],
          totalTomado: 0,
          totalEmAnalise: 0,
          contratosEmAnaliseCount: 0,
          contratosConcedidosCount: 0,
          saldoDevedor: 0,
          totalAmortizado: 0,
          totalJuros: 0,
          hasLoans: false,
          hasActiveLoans: false,
          proximaParcela: null
        }
        items.push(newColab)
        registerIndices(newColab, fId)
      }
    }

    // PASSO 3: Ordena contratos de cada colaborador (mais recentes primeiro) e calcula próxima parcela
    for (const colab of items) {
      colab.loans.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

      for (const emp of colab.activeLoans) {
        for (const p of emp.parcelas || []) {
          if (p.status === 'prevista' || p.status === 'exportada_folha') {
            if (!colab.proximaParcela || p.dataVencimento < colab.proximaParcela.dataVencimento) {
              colab.proximaParcela = { ...p, codigoOperacao: emp.codigoOperacao }
            }
          }
        }
      }
    }

    // Ordenação alfabética por nome
    items.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    return items
  }, [emprestimos, colaboradoresList])

  // 2. Lista Filtrada para o Seletor
  const filteredColaboradores = useMemo(() => {
    return colaboradoresMap.filter((c) => {
      // Filtro de Categoria
      if (filterMode === 'ativos' && !c.hasActiveLoans) return false
      if (filterMode === 'com_historico' && !c.hasLoans) return false

      // Busca textual
      if (!searchTerm.trim()) return true
      const q = searchTerm.toLowerCase().trim()
      const qDigits = searchTerm.replace(/\D/g, '')
      return (
        c.nome.toLowerCase().includes(q) ||
        (c.cpf || '').includes(q) ||
        (qDigits.length >= 4 && cleanCpfDigits(c.cpf).includes(qDigits)) ||
        (c.matricula || '').toLowerCase().includes(q) ||
        (c.cargo || '').toLowerCase().includes(q) ||
        (c.unidade || '').toLowerCase().includes(q) ||
        c.loans.some((l) => l.codigoOperacao.toLowerCase().includes(q))
      )
    })
  }, [colaboradoresMap, filterMode, searchTerm])

  // Colaborador Ativo Selecionado (com fallback para o 1º disponível)
  const selectedColaborador = useMemo(() => {
    if (selectedColabId) {
      const searchTarget = selectedColabId.trim().toLowerCase()
      const searchCpfDigits = cleanCpfDigits(selectedColabId)

      const found = colaboradoresMap.find((c) => {
        if (c.id === selectedColabId) return true
        if (searchCpfDigits && cleanCpfDigits(c.cpf) === searchCpfDigits) return true
        if (c.allIds && c.allIds.includes(selectedColabId)) return true
        if (c.matricula && c.matricula.trim().toLowerCase() === searchTarget) return true
        if (c.nome && cleanNomeStr(c.nome) === cleanNomeStr(searchTarget)) return true
        return false
      })
      if (found) return found
    }
    // Fallback: primeiro com empréstimo ativo, depois com empréstimo geral, depois o primeiro
    const withActive = colaboradoresMap.find((c) => c.hasActiveLoans)
    if (withActive) return withActive

    const withLoans = colaboradoresMap.find((c) => c.hasLoans)
    if (withLoans) return withLoans

    return colaboradoresMap[0] || null
  }, [colaboradoresMap, selectedColabId])

  // Navegação para Anterior e Próximo Colaborador
  const currentIndex = useMemo(() => {
    if (!selectedColaborador) return -1
    return filteredColaboradores.findIndex((c) => c.id === selectedColaborador.id)
  }, [filteredColaboradores, selectedColaborador])

  const handleSelectPrev = () => {
    if (currentIndex > 0) {
      setSelectedColabId(filteredColaboradores[currentIndex - 1].id)
    }
  }

  const handleSelectNext = () => {
    if (currentIndex >= 0 && currentIndex < filteredColaboradores.length - 1) {
      setSelectedColabId(filteredColaboradores[currentIndex + 1].id)
    }
  }

  // 3. Cálculos da Ficha do Colaborador Selecionado
  const colabMetrics = useMemo(() => {
    if (!selectedColaborador) {
      return {
        salarioBase: 0,
        margemConsignavel: 0,
        parcelaMensalAtual: 0,
        margemDisponivel: 0,
        percentualMargemUsada: 0,
        totalTomado: 0,
        totalEmAnalise: 0,
        contratosEmAnaliseCount: 0,
        contratosConcedidosCount: 0,
        saldoDevedor: 0,
        totalAmortizado: 0,
        percentAmortizado: 0,
        totalJurosContratados: 0,
        contratosCount: 0,
        contratosAtivosCount: 0,
        contratosQuitadosCount: 0,
        proximaParcela: null
      }
    }

    const salarioBase = selectedColaborador.salario || 0
    // Margem Legal padrão de 30% do salário bruto/base conforme CLT e Lei 10.820/2003
    const margemConsignavel = roundMoney(salarioBase * 0.3)

    // Soma das parcelas mensais vigentes dos contratos ativos
    let parcelaMensalAtual = 0
    for (const emp of selectedColaborador.activeLoans) {
      // Pega o valor da parcela mensal típica do contrato
      const pTotal = emp.parcelas?.[0]?.valorTotal || (emp.valorAprovado / (emp.quantidadeParcelas || 1))
      parcelaMensalAtual += pTotal
    }
    parcelaMensalAtual = roundMoney(parcelaMensalAtual)

    const margemDisponivel = Math.max(0, roundMoney(margemConsignavel - parcelaMensalAtual))
    const percentualMargemUsada = margemConsignavel > 0
      ? Math.min(100, Math.round((parcelaMensalAtual / margemConsignavel) * 100))
      : 0

    const totalTomado = selectedColaborador.totalTomado
    const totalEmAnalise = selectedColaborador.totalEmAnalise
    const contratosEmAnaliseCount = selectedColaborador.contratosEmAnaliseCount
    const contratosConcedidosCount = selectedColaborador.contratosConcedidosCount
    const saldoDevedor = selectedColaborador.saldoDevedor
    const totalAmortizado = selectedColaborador.totalAmortizado
    const percentAmortizado = totalTomado > 0
      ? Math.min(100, Math.round((totalAmortizado / totalTomado) * 100))
      : 0

    const contratosCount = selectedColaborador.loans.length
    const contratosAtivosCount = selectedColaborador.activeLoans.length
    const contratosQuitadosCount = selectedColaborador.loans.filter((l) => l.status === 'quitado').length

    return {
      salarioBase,
      margemConsignavel,
      parcelaMensalAtual,
      margemDisponivel,
      percentualMargemUsada,
      totalTomado,
      totalEmAnalise,
      contratosEmAnaliseCount,
      contratosConcedidosCount,
      saldoDevedor,
      totalAmortizado,
      percentAmortizado,
      totalJurosContratados: selectedColaborador.totalJuros,
      contratosCount,
      contratosAtivosCount,
      contratosQuitadosCount,
      proximaParcela: selectedColaborador.proximaParcela
    }
  }, [selectedColaborador])

  // Todas as parcelas futuras unificadas em ordem cronológica
  const todasParcelasCronologicas = useMemo(() => {
    if (!selectedColaborador) return []
    const list: (CredImpactoParcela & { codigoOperacao: string; loanStatus: string })[] = []

    for (const emp of selectedColaborador.loans) {
      for (const p of emp.parcelas || []) {
        list.push({
          ...p,
          codigoOperacao: emp.codigoOperacao,
          loanStatus: emp.status
        })
      }
    }

    return list.sort((a, b) => new Date(a.dataVencimento).getTime() - new Date(b.dataVencimento).getTime())
  }, [selectedColaborador])

  const parcelasPagasList = useMemo(() => {
    return todasParcelasCronologicas.filter(
      (p) => p.status === 'descontada' || p.status === 'paga_avulso'
    )
  }, [todasParcelasCronologicas])

  const parcelasFuturasList = useMemo(() => {
    return todasParcelasCronologicas.filter(
      (p) => p.status === 'prevista' || p.status === 'exportada_folha' || p.status === 'atrasada'
    )
  }, [todasParcelasCronologicas])

  // 4. Funções de Exportação e Envio

  /**
   * EXPORTAÇÃO OFICIAL: Impressão / Salvar PDF em Folha Timbrada
   */
  const handlePrintOfficialSheet = () => {
    if (!selectedColaborador) {
      toast.error('Nenhum colaborador selecionado.')
      return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('O navegador bloqueou a abertura da janela de impressão. Permita pop-ups.')
      return
    }

    const dataHoje = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const htmlContratosRows = selectedColaborador.loans
      .map(
        (l) => `
        <tr>
          <td style="padding: 7px 10px; font-weight: bold; font-family: monospace; font-size: 11px; border-bottom: 1px solid #e2e8f0;">${l.codigoOperacao}</td>
          <td style="padding: 7px 10px; font-size: 11px; border-bottom: 1px solid #e2e8f0;">${new Date(l.createdAt).toLocaleDateString('pt-BR')}</td>
          <td style="padding: 7px 10px; font-size: 11px; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${l.status}</td>
          <td style="padding: 7px 10px; font-size: 11px; font-family: monospace; border-bottom: 1px solid #e2e8f0;">${formatBrl(l.valorAprovado)}</td>
          <td style="padding: 7px 10px; font-size: 11px; text-align: center; border-bottom: 1px solid #e2e8f0;">${l.quantidadeParcelas}x</td>
          <td style="padding: 7px 10px; font-size: 11px; text-align: center; border-bottom: 1px solid #e2e8f0;">${l.taxaMensal}% a.m.</td>
          <td style="padding: 7px 10px; font-size: 11px; font-family: monospace; font-weight: bold; color: #047857; border-bottom: 1px solid #e2e8f0;">${formatBrl(l.saldoDevedorAtual)}</td>
        </tr>
      `
      )
      .join('')

    const htmlParcelasFuturasRows = parcelasFuturasList
      .slice(0, 24)
      .map(
        (p) => `
        <tr>
          <td style="padding: 6px 8px; font-family: monospace; font-size: 10px; border-bottom: 1px solid #e2e8f0;">${p.codigoOperacao}</td>
          <td style="padding: 6px 8px; text-align: center; font-size: 10px; border-bottom: 1px solid #e2e8f0;">${String(p.numero).padStart(2, '0')}</td>
          <td style="padding: 6px 8px; text-align: center; font-size: 10px; border-bottom: 1px solid #e2e8f0;">${p.competencia}</td>
          <td style="padding: 6px 8px; text-align: center; font-size: 10px; border-bottom: 1px solid #e2e8f0;">${new Date(p.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 10px; border-bottom: 1px solid #e2e8f0;">${formatBrl(p.valorAmortizacao)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 10px; border-bottom: 1px solid #e2e8f0;">${formatBrl(p.valorJuros)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold; font-size: 10px; border-bottom: 1px solid #e2e8f0;">${formatBrl(p.valorTotal)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-size: 10px; border-bottom: 1px solid #e2e8f0;">${formatBrl(p.saldoDevedorApos)}</td>
          <td style="padding: 6px 8px; text-align: center; font-size: 9px; text-transform: uppercase; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${p.status === 'exportada_folha' ? 'Em Folha' : 'Prevista'}</td>
        </tr>
      `
      )
      .join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Ficha Financeira de Empréstimos - ${selectedColaborador.nome}</title>
          <style>
            @page { size: A4; margin: 15mm 15mm 15mm 15mm; }
            * { box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #0f172a;
              background: #fff;
              margin: 0;
              padding: 0;
              font-size: 12px;
              line-height: 1.4;
            }
            .header-timbrado {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #059669;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .header-brand {
              display: flex;
              align-items: center;
              gap: 10px;
            }
            .logo-badge {
              background: #059669;
              color: #fff;
              font-weight: 900;
              font-size: 14px;
              padding: 6px 12px;
              border-radius: 8px;
              letter-spacing: 1px;
            }
            .doc-title {
              font-size: 14px;
              font-weight: 800;
              text-transform: uppercase;
              color: #0f172a;
              margin: 0;
            }
            .doc-subtitle {
              font-size: 10px;
              color: #64748b;
              margin-top: 2px;
            }
            .card-section {
              background: #f8fafc;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 12px;
              margin-bottom: 14px;
            }
            .section-title {
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #047857;
              margin-bottom: 8px;
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .grid-cols-5 {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 10px;
            }
            .grid-cols-4 {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 10px;
            }
            .grid-cols-2 {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
            }
            .data-label {
              font-size: 9px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 600;
            }
            .data-value {
              font-size: 12px;
              font-weight: 700;
              color: #0f172a;
              margin-top: 2px;
            }
            .kpi-box {
              background: #fff;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 8px 10px;
              text-align: center;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
            }
            th {
              background: #f1f5f9;
              color: #475569;
              font-size: 9px;
              text-transform: uppercase;
              padding: 6px 8px;
              text-align: left;
              border-bottom: 1px solid #cbd5e1;
            }
            .signatures-block {
              margin-top: 35px;
              display: flex;
              justify-content: space-between;
              gap: 40px;
              page-break-inside: avoid;
            }
            .signature-box {
              flex: 1;
              text-align: center;
              border-top: 1px solid #0f172a;
              padding-top: 6px;
              font-size: 11px;
            }
            .legal-disclaimer {
              font-size: 9px;
              color: #64748b;
              line-height: 1.3;
              margin-top: 20px;
              text-align: justify;
              border-top: 1px dashed #cbd5e1;
              padding-top: 8px;
            }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header-timbrado">
            <div class="header-brand">
              <div class="logo-badge">IMPACTO EDU</div>
              <div>
                <h1 class="doc-title">CredImpacto • Ficha Financeira Individual</h1>
                <div class="doc-subtitle">Extrato Oficial de Empréstimos e Consignações em Folha de Pagamento</div>
              </div>
            </div>
            <div style="text-align: right; font-size: 10px; color: #64748b;">
              <div><strong>Emissão:</strong> ${dataHoje}</div>
              <div><strong>Sistema:</strong> IMPACTO EDU v1.0 PRO</div>
            </div>
          </div>

          <!-- DADOS DO COLABORADOR -->
          <div class="card-section">
            <div class="section-title">1. Identificação do Colaborador & Informações Funcionais</div>
            <div class="grid-cols-4">
              <div>
                <div class="data-label">Nome Completo</div>
                <div class="data-value">${selectedColaborador.nome}</div>
              </div>
              <div>
                <div class="data-label">CPF</div>
                <div class="data-value">${selectedColaborador.cpf || 'Não informado'}</div>
              </div>
              <div>
                <div class="data-label">Matrícula / ID</div>
                <div class="data-value">${selectedColaborador.matricula || selectedColaborador.id.slice(0, 8)}</div>
              </div>
              <div>
                <div class="data-label">Cargo / Função</div>
                <div class="data-value">${selectedColaborador.cargo}</div>
              </div>
            </div>
            <div class="grid-cols-4" style="margin-top: 10px;">
              <div>
                <div class="data-label">Unidade</div>
                <div class="data-value">${selectedColaborador.unidade || 'Matriz'}</div>
              </div>
              <div>
                <div class="data-label">Salário Base Cadastrado</div>
                <div class="data-value">${formatBrl(colabMetrics.salarioBase)}</div>
              </div>
              <div>
                <div class="data-label">Margem Consignável (30%)</div>
                <div class="data-value" style="color: #047857;">${formatBrl(colabMetrics.margemConsignavel)}</div>
              </div>
              <div>
                <div class="data-label">Margem Livre Restante</div>
                <div class="data-value" style="color: ${colabMetrics.margemDisponivel > 0 ? '#047857' : '#e11d48'};">
                  ${formatBrl(colabMetrics.margemDisponivel)}
                </div>
              </div>
            </div>
          </div>

          <!-- RESUMO FINANCEIRO CONSOLIDADO -->
          <div class="card-section">
            <div class="section-title">2. Resumo da Posição Financeira Consolidada</div>
            <div class="${colabMetrics.totalEmAnalise > 0 ? 'grid-cols-5' : 'grid-cols-4'}">
              <div class="kpi-box">
                <div class="data-label">Total Concedido</div>
                <div class="data-value" style="font-size: 14px;">${formatBrl(colabMetrics.totalTomado)}</div>
                <div style="font-size: 9px; color: #64748b; margin-top: 2px;">${colabMetrics.contratosConcedidosCount} operações concedidas</div>
              </div>
              ${
                colabMetrics.totalEmAnalise > 0
                  ? `
              <div class="kpi-box" style="border-color: #f59e0b; background: #fffbeb;">
                <div class="data-label" style="color: #b45309;">Em Análise</div>
                <div class="data-value" style="font-size: 14px; color: #d97706;">${formatBrl(colabMetrics.totalEmAnalise)}</div>
                <div style="font-size: 9px; color: #b45309; margin-top: 2px;">${colabMetrics.contratosEmAnaliseCount} proposta(s) aguardando</div>
              </div>`
                  : ''
              }
              <div class="kpi-box">
                <div class="data-label">Saldo Devedor Atual</div>
                <div class="data-value" style="font-size: 14px; color: #059669;">${formatBrl(colabMetrics.saldoDevedor)}</div>
                <div style="font-size: 9px; color: #64748b; margin-top: 2px;">${colabMetrics.contratosAtivosCount} contratos em aberto</div>
              </div>
              <div class="kpi-box">
                <div class="data-label">Total Já Amortizado</div>
                <div class="data-value" style="font-size: 14px; color: #2563eb;">${formatBrl(colabMetrics.totalAmortizado)}</div>
                <div style="font-size: 9px; color: #64748b; margin-top: 2px;">${colabMetrics.percentAmortizado}% quitado do total</div>
              </div>
              <div class="kpi-box">
                <div class="data-label">Próximo Desconto em Folha</div>
                <div class="data-value" style="font-size: 14px; color: #d97706;">
                  ${colabMetrics.proximaParcela ? formatBrl(colabMetrics.proximaParcela.valorTotal) : 'R$ 0,00'}
                </div>
                <div style="font-size: 9px; color: #64748b; margin-top: 2px;">
                  ${colabMetrics.proximaParcela ? 'Venc. ' + new Date(colabMetrics.proximaParcela.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'Nenhum agendado'}
                </div>
              </div>
            </div>
          </div>

          <!-- HISTÓRICO DE CONTRATOS -->
          <div class="card-section">
            <div class="section-title">3. Contratos de Mútuo / Empréstimos Cadastrados</div>
            ${
              selectedColaborador.loans.length === 0
                ? '<p style="font-size: 11px; color: #64748b; margin: 4px 0;">Nenhuma operação de empréstimo contratada por este colaborador.</p>'
                : `
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Data</th>
                    <th>Situação</th>
                    <th>Valor Concedido</th>
                    <th style="text-align: center;">Parcelas</th>
                    <th style="text-align: center;">Taxa</th>
                    <th>Saldo Devedor</th>
                  </tr>
                </thead>
                <tbody>
                  ${htmlContratosRows}
                </tbody>
              </table>
            `
            }
          </div>

          <!-- PRÓXIMAS PARCELAS PREVISTAS -->
          <div class="card-section">
            <div class="section-title">4. Cronograma de Descontos Futuros Agendados em Folha</div>
            ${
              parcelasFuturasList.length === 0
                ? '<p style="font-size: 11px; color: #64748b; margin: 4px 0;">Não há parcelas futuras a descontar.</p>'
                : `
              <table>
                <thead>
                  <tr>
                    <th>Operação</th>
                    <th style="text-align: center;">Nº</th>
                    <th style="text-align: center;">Competência</th>
                    <th style="text-align: center;">Vencimento</th>
                    <th style="text-align: right;">Amortização</th>
                    <th style="text-align: right;">Juros</th>
                    <th style="text-align: right;">Total Parcela</th>
                    <th style="text-align: right;">Saldo Após</th>
                    <th style="text-align: center;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${htmlParcelasFuturasRows}
                </tbody>
              </table>
            `
            }
          </div>

          <!-- TERMO E ASSINATURAS -->
          <div class="legal-disclaimer">
            Declaro para os devidos fins que as informações acima retratam com fidelidade os contratos de mútuo financeiro firmados e vigentes perante o Colégio Impacto. Os descontos das parcelas mensais são realizados diretamente em folha de pagamento na forma da autorização formal outorgada na contratação, consoante aos termos do Art. 462 da CLT.
          </div>

          <div class="signatures-block">
            <div class="signature-box">
              <strong>${selectedColaborador.nome}</strong>
              <div style="font-size: 9px; color: #64748b;">Colaborador / Mutuário<br>CPF: ${selectedColaborador.cpf || 'Não informado'}</div>
            </div>
            <div class="signature-box">
              <strong>Departamento Financeiro & Tesouraria</strong>
              <div style="font-size: 9px; color: #64748b;">Colégio Impacto • CredImpacto<br>Responsável Financeiro / RH</div>
            </div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  /**
   * EXPORTAÇÃO CSV / EXCEL FORMATADO
   */
  const handleExportCSV = () => {
    if (!selectedColaborador) return

    const sanitizedName = selectedColaborador.nome.toLowerCase().replace(/[^a-z0-9]/g, '_')
    const fileName = `ficha_financeira_${sanitizedName}_${new Date().toISOString().slice(0, 10)}.csv`

    const lines: string[] = []
    lines.push(`"COLÉGIO IMPACTO • CREDIMPACTO - FICHA FINANCEIRA INDIVIDUAL"`)
    lines.push(`"Data Emissão:";"${new Date().toLocaleString('pt-BR')}"`)
    lines.push(`""`)
    lines.push(`"DADOS DO COLABORADOR"`)
    lines.push(`"Nome:";"${selectedColaborador.nome}"`)
    lines.push(`"CPF:";"${selectedColaborador.cpf || ''}"`)
    lines.push(`"Matrícula:";"${selectedColaborador.matricula || ''}"`)
    lines.push(`"Cargo:";"${selectedColaborador.cargo}"`)
    lines.push(`"Salário Base:";"${formatBrl(colabMetrics.salarioBase)}"`)
    lines.push(`"Margem 30%:";"${formatBrl(colabMetrics.margemConsignavel)}"`)
    lines.push(`"Margem Disponível:";"${formatBrl(colabMetrics.margemDisponivel)}"`)
    lines.push(`""`)
    lines.push(`"RESUMO FINANCEIRO"`)
    lines.push(`"Total Concedido:";"${formatBrl(colabMetrics.totalTomado)}"`)
    if (colabMetrics.totalEmAnalise > 0) {
      lines.push(`"Em Análise (Aguardando Aprovação):";"${formatBrl(colabMetrics.totalEmAnalise)}"`)
      lines.push(`"Propostas em Análise:";"${colabMetrics.contratosEmAnaliseCount}"`)
    }
    lines.push(`"Saldo Devedor Atual:";"${formatBrl(colabMetrics.saldoDevedor)}"`)
    lines.push(`"Total Amortizado:";"${formatBrl(colabMetrics.totalAmortizado)}"`)
    lines.push(`"Contratos Ativos:";"${colabMetrics.contratosAtivosCount}"`)
    lines.push(`""`)
    lines.push(`"PARCELAS DE EMPRÉSTIMO DETALHADAS"`)
    lines.push(
      `"Operação";"Parcela";"Competência";"Vencimento";"Amortização (R$)";"Juros (R$)";"Valor Parcela (R$)";"Saldo Restante (R$)";"Status";"Data Pagamento"`
    )

    for (const p of todasParcelasCronologicas) {
      lines.push(
        `"${p.codigoOperacao}";"${p.numero}";"${p.competencia}";"${p.dataVencimento}";"${p.valorAmortizacao.toFixed(2)}";"${p.valorJuros.toFixed(2)}";"${p.valorTotal.toFixed(2)}";"${p.saldoDevedorApos.toFixed(2)}";"${p.status}";"${p.dataPagamento || ''}"`
      )
    }

    const csvContent = '\uFEFF' + lines.join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    toast.success('Extrato CSV baixado com sucesso!')
  }

  /**
   * COMPARTILHAR / ENVIAR NO WHATSAPP
   */
  const handleSendWhatsApp = () => {
    if (!selectedColaborador) return

    const dataHoje = new Date().toLocaleDateString('pt-BR')
    const text =
      `📄 *CREDIMPACTO • Ficha Financeira Individual*\n` +
      `👤 *Colaborador:* ${selectedColaborador.nome}\n` +
      `💼 *Cargo:* ${selectedColaborador.cargo}\n` +
      `🆔 *CPF:* ${selectedColaborador.cpf || 'Não informado'}\n\n` +
      `💰 *RESUMO FINANCEIRO:*\n` +
      `• Total Concedido: ${formatBrl(colabMetrics.totalTomado)}\n` +
      (colabMetrics.totalEmAnalise > 0
        ? `• Em Análise: ${formatBrl(colabMetrics.totalEmAnalise)} (${colabMetrics.contratosEmAnaliseCount} ${colabMetrics.contratosEmAnaliseCount === 1 ? 'proposta pendente' : 'propostas pendentes'})\n`
        : '') +
      `• Saldo Devedor Atual: ${formatBrl(colabMetrics.saldoDevedor)}\n` +
      `• Total Já Amortizado: ${formatBrl(colabMetrics.totalAmortizado)} (${colabMetrics.percentAmortizado}% quitado)\n` +
      `• Contratos Ativos: ${colabMetrics.contratosAtivosCount}\n\n` +
      (colabMetrics.proximaParcela
        ? `📅 *PRÓXIMO DESCONTO EM FOLHA:*\n` +
          `• Parcela: ${formatBrl(colabMetrics.proximaParcela.valorTotal)}\n` +
          `• Vencimento: ${new Date(colabMetrics.proximaParcela.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')} (Competência ${colabMetrics.proximaParcela.competencia})\n\n`
        : `📅 *DESCONTOS:* Nenhuma parcela pendente em aberto.\n\n`) +
      `Emitido em ${dataHoje} pelo Sistema de Gestão Financeira • Colégio Impacto.`

    const cleanPhone = (selectedColaborador.telefone || '').replace(/\D/g, '')
    const whatsappUrl = cleanPhone.length >= 10
      ? `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`

    window.open(whatsappUrl, '_blank')
  }

  /**
   * COPIAR RESUMO EM TEXTO
   */
  const handleCopySummary = () => {
    if (!selectedColaborador) return

    const dataHoje = new Date().toLocaleDateString('pt-BR')
    const text =
      `CREDIMPACTO - FICHA FINANCEIRA DO COLABORADOR\n` +
      `Colaborador: ${selectedColaborador.nome} | CPF: ${selectedColaborador.cpf || 'N/I'}\n` +
      `Cargo: ${selectedColaborador.cargo} | Unidade: ${selectedColaborador.unidade}\n\n` +
      `Total Concedido: ${formatBrl(colabMetrics.totalTomado)}\n` +
      (colabMetrics.totalEmAnalise > 0
        ? `Em Análise: ${formatBrl(colabMetrics.totalEmAnalise)} (${colabMetrics.contratosEmAnaliseCount} pendente)\n`
        : '') +
      `Saldo Devedor Atual: ${formatBrl(colabMetrics.saldoDevedor)}\n` +
      `Total Amortizado: ${formatBrl(colabMetrics.totalAmortizado)} (${colabMetrics.percentAmortizado}%)\n` +
      `Contratos Ativos: ${colabMetrics.contratosAtivosCount} | Histórico: ${colabMetrics.contratosCount}\n` +
      (colabMetrics.proximaParcela
        ? `Próxima Parcela: ${formatBrl(colabMetrics.proximaParcela.valorTotal)} (Venc. ${new Date(colabMetrics.proximaParcela.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')})\n`
        : `Sem descontos pendentes.\n`) +
      `\nEmitido em ${dataHoje} via Impacto EDU.`

    navigator.clipboard.writeText(text)
    toast.success('Resumo copiado para a área de transferência!')
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'solicitado':
      case 'em_analise':
        return { label: 'Em Análise', bg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' }
      case 'contraproposta':
        return { label: 'Contraproposta', bg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20' }
      case 'aguardando_assinatura':
        return { label: 'Ag. Assinatura', bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20' }
      case 'aguardando_liberacao':
        return { label: 'Ag. Liberação', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20' }
      case 'ativo':
        return { label: 'Ativo em Folha', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' }
      case 'quitado':
        return { label: 'Quitado', bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' }
      case 'recusado':
        return { label: 'Recusado', bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20' }
      default:
        return { label: status, bg: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/10 dark:text-white dark:border-white/20' }
    }
  }

  const getStatusCardStyles = (status: string) => {
    switch (status) {
      case 'ativo':
        return {
          headerBg: 'bg-gradient-to-r from-emerald-500/20 via-teal-500/10 to-emerald-500/5 dark:from-emerald-950/60 dark:via-teal-950/30 dark:to-slate-900/60',
          topStripe: 'bg-gradient-to-r from-emerald-500 to-teal-500',
          iconBg: 'bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60'
        }
      case 'solicitado':
      case 'em_analise':
        return {
          headerBg: 'bg-gradient-to-r from-amber-500/20 via-orange-500/10 to-amber-500/5 dark:from-amber-950/60 dark:via-orange-950/30 dark:to-slate-900/60',
          topStripe: 'bg-gradient-to-r from-amber-500 to-orange-500',
          iconBg: 'bg-amber-100/90 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60'
        }
      case 'quitado':
        return {
          headerBg: 'bg-gradient-to-r from-slate-200/60 via-slate-100/40 to-slate-50/20 dark:from-slate-800/70 dark:via-slate-800/40 dark:to-slate-900/60',
          topStripe: 'bg-gradient-to-r from-slate-400 to-slate-500',
          iconBg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
        }
      default:
        return {
          headerBg: 'bg-gradient-to-r from-blue-500/20 via-sky-500/10 to-blue-500/5 dark:from-blue-950/60 dark:via-sky-950/30 dark:to-slate-900/60',
          topStripe: 'bg-gradient-to-r from-blue-500 to-sky-500',
          iconBg: 'bg-blue-100/90 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60'
        }
    }
  }

  return (
    <div className="space-y-6">
      {/* SEÇÃO 1: BARRA DE SELEÇÃO INTELIGENTE DE COLABORADOR */}
      <div className="bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl border border-white/80 dark:border-slate-700/60 rounded-2xl p-4 sm:p-5 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08),0_8px_10px_-6px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-slate-900/5 dark:ring-white/5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Users size={18} />
              </span>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                Ficha Financeira do Colaborador
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Selecione o colaborador para visualizar o extrato analítico de contratos, cronograma de parcelas e margem consignável.
            </p>
          </div>

          {/* FILTROS RÁPIDOS DE LISTA */}
          <div className="flex items-center gap-1.5 bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-semibold self-start md:self-auto shadow-inner">
            <button
              onClick={() => setFilterMode('ativos')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterMode === 'ativos'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Com Empréstimos Ativos
            </button>
            <button
              onClick={() => setFilterMode('com_historico')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterMode === 'com_historico'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Com Histórico
            </button>
            <button
              onClick={() => setFilterMode('todos')}
              className={`px-3 py-1 rounded-lg transition-all ${
                filterMode === 'todos'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              Todos ({colaboradoresMap.length})
            </button>
          </div>
        </div>

        {/* INPUT DE BUSCA + DROPDOWN SELETOR + NAVEGAÇÃO */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 relative">
          {/* CAMPO DE SELEÇÃO E BUSCA */}
          <div className="relative flex-1">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setIsDropdownOpen(true)
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Buscar por nome, CPF ou cargo do colaborador..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs"
              />
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                title="Expandir lista de colaboradores"
              >
                <ChevronDown size={16} className={`transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {/* DROPDOWN FLUTUANTE DE COLABORADORES */}
            {isDropdownOpen && (
              <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-h-72 overflow-y-auto p-1.5 space-y-1 animate-in fade-in zoom-in-95">
                {filteredColaboradores.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Nenhum colaborador encontrado com os critérios selecionados.
                  </div>
                ) : (
                  filteredColaboradores.map((c) => {
                    const isSelected = selectedColaborador?.id === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedColabId(c.id)
                          setIsDropdownOpen(false)
                          setSearchTerm('')
                        }}
                        className={`w-full p-2.5 rounded-xl flex items-center justify-between text-left transition-all ${
                          isSelected
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 font-bold'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}>
                            {c.nome.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold truncate">{c.nome}</div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {c.cargo} • CPF: {c.cpf || 'N/I'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {c.hasActiveLoans ? (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                              {c.activeLoans.length} ativo{c.activeLoans.length > 1 ? 's' : ''}
                            </span>
                          ) : c.loans.some((l) => l.status === 'solicitado' || l.status === 'em_analise') ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                              Em análise
                            </span>
                          ) : c.loans.some((l) => l.status === 'quitado') ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              Quitado
                            </span>
                          ) : c.hasLoans ? (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {c.loans.length} op.
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Sem empréstimo</span>
                          )}
                          {isSelected && <Check size={14} className="text-emerald-600 shrink-0 ml-1" />}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* BOTÕES NAVEGADOR: ANTERIOR / PRÓXIMO */}
          <div className="flex items-center gap-1.5 shrink-0 self-center">
            <button
              onClick={handleSelectPrev}
              disabled={currentIndex <= 0}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
              title="Colaborador anterior"
            >
              <ChevronLeft size={16} />
            </button>

            <span className="text-xs font-mono font-semibold text-slate-500 dark:text-slate-400 px-1 whitespace-nowrap">
              {currentIndex >= 0 ? currentIndex + 1 : 0} de {filteredColaboradores.length}
            </span>

            <button
              onClick={handleSelectNext}
              disabled={currentIndex < 0 || currentIndex >= filteredColaboradores.length - 1}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-xs"
              title="Próximo colaborador"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* CASO NENHUM COLABORADOR ENCONTRADO */}
      {!selectedColaborador ? (
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3 shadow-md">
          <User size={40} className="mx-auto text-slate-300 dark:text-slate-600" />
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Nenhum colaborador selecionado
          </div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Utilize a barra de busca acima para selecionar um colaborador e abrir sua ficha financeira analítica.
          </p>
        </div>
      ) : (
        <>
          {/* SEÇÃO 2: FICHA CADASTRAL, FUNCIONAL & MARGEM CONSIGNÁVEL */}
          <div className="bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl border border-white/80 dark:border-slate-700/60 rounded-2xl shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08),0_8px_10px_-6px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden transition-all duration-300 hover:shadow-xl relative">
            {/* Listra superior com gradiente de identificação */}
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

            <div className="p-5 sm:p-6 space-y-6">
              {/* TOPO: PERFIL DO COLABORADOR E BOTÕES DE EXPORTAÇÃO */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800/80 pb-5">
                <div className="flex items-center gap-4">
                  {/* AVATAR COM INICIAIS */}
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-black text-lg sm:text-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0 ring-2 ring-emerald-400/30">
                    {selectedColaborador.nome.slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                        {selectedColaborador.nome}
                      </h3>
                      {selectedColaborador.hasActiveLoans ? (
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-700/60 shadow-xs">
                          {selectedColaborador.activeLoans.length} {selectedColaborador.activeLoans.length === 1 ? 'Contrato Ativo' : 'Contratos Ativos'}
                        </span>
                      ) : selectedColaborador.hasLoans ? (
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60 shadow-xs">
                          {selectedColaborador.loans.length} {selectedColaborador.loans.length === 1 ? 'Operação em Andamento' : 'Operações em Andamento'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          Sem Contratos Ativos
                        </span>
                      )}
                      {selectedColaborador.hasActiveLoans && selectedColaborador.loans.some(l => l.status === 'solicitado' || l.status === 'em_analise') && (
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/80 dark:border-amber-700/60 shadow-xs">
                          {selectedColaborador.loans.filter(l => l.status === 'solicitado' || l.status === 'em_analise').length} Em Análise
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap font-medium">
                      <span>{selectedColaborador.cargo}</span>
                      <span>•</span>
                      <span>CPF: {selectedColaborador.cpf || 'Não informado'}</span>
                      {selectedColaborador.matricula && (
                        <>
                          <span>•</span>
                          <span>Matrícula: {selectedColaborador.matricula}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>Unidade: {selectedColaborador.unidade || 'Matriz'}</span>
                    </div>
                  </div>
                </div>

                {/* BOTÕES DE EXPORTAÇÃO & ENVIO (ALTO DESTAQUE) */}
                <div className="flex items-center gap-2 flex-wrap self-start lg:self-auto">
                  {/* IMPRIMIR / PDF */}
                  <button
                    onClick={handlePrintOfficialSheet}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
                    title="Imprimir Ficha Oficial ou Salvar em PDF"
                  >
                    <Printer size={15} />
                    <span>Imprimir / Salvar PDF</span>
                  </button>

                  {/* EXPORTAR EXCEL / CSV */}
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold active:scale-95 transition-all shadow-xs"
                    title="Baixar Extrato em CSV / Excel"
                  >
                    <FileSpreadsheet size={15} />
                    <span>CSV / Excel</span>
                  </button>

                  {/* WHATSAPP */}
                  <button
                    onClick={handleSendWhatsApp}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold active:scale-95 transition-all shadow-xs"
                    title="Enviar Resumo da Ficha via WhatsApp"
                  >
                    <Share2 size={15} />
                    <span>Enviar WhatsApp</span>
                  </button>

                  {/* COPIAR RESUMO */}
                  <button
                    onClick={handleCopySummary}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all shadow-xs"
                    title="Copiar Resumo em Texto"
                  >
                    <Copy size={15} />
                  </button>
                </div>
              </div>

              {/* GRADE DE DETALHES FUNCIONAIS + MARGEM CONSIGNÁVEL */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {/* DADOS BANCÁRIOS / PIX */}
                <div className="bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <CreditCard size={12} />
                    <span>Chave PIX Cadastrada</span>
                  </div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white truncate text-xs">
                    {selectedColaborador.dadosBancarios?.chavePix || selectedColaborador.cpf || 'Não informada'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                    {selectedColaborador.dadosBancarios?.banco ? `Banco: ${selectedColaborador.dadosBancarios.banco}` : 'Padrão: CPF do colaborador'}
                  </div>
                </div>

                {/* SALÁRIO BASE */}
                <div className="bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Building2 size={12} />
                    <span>Salário Base Cadastrado</span>
                  </div>
                  <div className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                    {colabMetrics.salarioBase > 0 ? formatBrl(colabMetrics.salarioBase) : 'Não informado'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Base de cálculo de margem CLT
                  </div>
                </div>

                {/* MARGEM CONSIGNÁVEL (30%) */}
                <div className="bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <Percent size={12} />
                    <span>Margem Máxima Consignável (30%)</span>
                  </div>
                  <div className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                    {formatBrl(colabMetrics.margemConsignavel)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    Comprometimento atual: {formatBrl(colabMetrics.parcelaMensalAtual)}/mês
                  </div>
                </div>

                {/* MARGEM DISPONÍVEL LIVRE */}
                <div className="bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm p-3.5 rounded-xl border border-slate-200/60 dark:border-slate-800 space-y-1">
                  <div className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <BadgeCheck size={12} />
                    <span>Margem Livre Disponível</span>
                  </div>
                  <div className={`font-mono font-bold text-sm ${
                    colabMetrics.margemDisponivel > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {formatBrl(colabMetrics.margemDisponivel)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400">
                    {colabMetrics.percentualMargemUsada}% da margem utilizada
                  </div>
                </div>
              </div>

              {/* BARRA DE PROGRESSO DO COMPROMETIMENTO DA MARGEM */}
              {colabMetrics.margemConsignavel > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-[11px] font-medium text-slate-600 dark:text-slate-400">
                    <span>Uso da Margem Consignável (Capacidade de Desconto em Folha)</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {colabMetrics.percentualMargemUsada}% ({formatBrl(colabMetrics.parcelaMensalAtual)} de {formatBrl(colabMetrics.margemConsignavel)})
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        colabMetrics.percentualMargemUsada > 90
                          ? 'bg-rose-500'
                          : colabMetrics.percentualMargemUsada > 60
                          ? 'bg-amber-500'
                          : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      }`}
                      style={{ width: `${Math.min(100, colabMetrics.percentualMargemUsada)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SEÇÃO 3: CARDS KPIS GLASSMORPH 3D CONSOLIDADOS */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
            {/* CARD 1: TOTAL CONCEDIDO (HISTÓRICO) */}
            <div className="bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl border border-white/80 dark:border-slate-700/60 rounded-2xl p-4 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08),0_8px_10px_-6px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-slate-900/5 dark:ring-white/5 relative overflow-hidden transition-all hover:shadow-xl">
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-teal-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Total Concedido
                </span>
                <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                  <Wallet size={16} />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-slate-900 dark:text-white font-mono">
                {formatBrl(colabMetrics.totalTomado)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-semibold truncate">
                {colabMetrics.contratosConcedidosCount} {colabMetrics.contratosConcedidosCount === 1 ? 'operação concedida' : 'operações concedidas'}
              </div>
            </div>

            {/* CARD 2: EM ANÁLISE (SOLICITAÇÕES PENDENTES DE APROVAÇÃO) */}
            <div className={`bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl border rounded-2xl p-4 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08),0_8px_10px_-6px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-slate-900/5 dark:ring-white/5 relative overflow-hidden transition-all hover:shadow-xl ${
              colabMetrics.totalEmAnalise > 0
                ? 'border-amber-300/90 dark:border-amber-700/70 ring-amber-400/20'
                : 'border-white/80 dark:border-slate-700/60'
            }`}>
              <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                  <span>Em Análise</span>
                  {colabMetrics.contratosEmAnaliseCount > 0 && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  )}
                </span>
                <div className="p-1.5 sm:p-2 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300">
                  <Clock size={16} />
                </div>
              </div>
              <div className={`text-lg sm:text-2xl font-black font-mono ${
                colabMetrics.totalEmAnalise > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-400 dark:text-slate-500'
              }`}>
                {formatBrl(colabMetrics.totalEmAnalise)}
              </div>
              <div className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-1 font-semibold truncate">
                {colabMetrics.contratosEmAnaliseCount > 0
                  ? `${colabMetrics.contratosEmAnaliseCount} ${colabMetrics.contratosEmAnaliseCount === 1 ? 'proposta aguardando' : 'propostas aguardando'}`
                  : 'Nenhum pedido pendente'}
              </div>
            </div>

            {/* CARD 3: SALDO DEVEDOR ATUAL */}
            <div className="bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl border border-white/80 dark:border-slate-700/60 rounded-2xl p-4 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08),0_8px_10px_-6px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-slate-900/5 dark:ring-white/5 relative overflow-hidden transition-all hover:shadow-xl">
              <div className="h-1.5 w-full bg-gradient-to-r from-cyan-500 to-blue-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
                  Saldo Devedor Atual
                </span>
                <div className="p-1.5 sm:p-2 rounded-xl bg-cyan-100 dark:bg-cyan-950/70 text-cyan-700 dark:text-cyan-300">
                  <Receipt size={16} />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                {formatBrl(colabMetrics.saldoDevedor)}
              </div>
              <div className="text-[11px] text-cyan-800/80 dark:text-cyan-400/80 mt-1 font-semibold truncate">
                {colabMetrics.contratosAtivosCount} {colabMetrics.contratosAtivosCount === 1 ? 'contrato em aberto' : 'contratos em aberto'}
              </div>
            </div>

            {/* CARD 4: TOTAL JÁ AMORTIZADO / PAGO */}
            <div className="bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl border border-white/80 dark:border-slate-700/60 rounded-2xl p-4 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08),0_8px_10px_-6px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-slate-900/5 dark:ring-white/5 relative overflow-hidden transition-all hover:shadow-xl">
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                  Total Já Pago / Amortizado
                </span>
                <div className="p-1.5 sm:p-2 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300">
                  <TrendingDown size={16} />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
                {formatBrl(colabMetrics.totalAmortizado)}
              </div>
              <div className="text-[11px] text-blue-800/80 dark:text-blue-400/80 mt-1 font-semibold truncate">
                {colabMetrics.percentAmortizado}% amortizado do capital
              </div>
            </div>

            {/* CARD 5: PRÓXIMO DESCONTO EM FOLHA */}
            <div className="col-span-2 sm:col-span-1 md:col-span-1 bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl border border-white/80 dark:border-slate-700/60 rounded-2xl p-4 shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08),0_8px_10px_-6px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-slate-900/5 dark:ring-white/5 relative overflow-hidden transition-all hover:shadow-xl">
              <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 to-orange-500 absolute top-0 left-0" />
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Próxima Parcela em Folha
                </span>
                <div className="p-1.5 sm:p-2 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300">
                  <Clock size={16} />
                </div>
              </div>
              <div className="text-lg sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                {colabMetrics.proximaParcela ? formatBrl(colabMetrics.proximaParcela.valorTotal) : 'R$ 0,00'}
              </div>
              <div className="text-[11px] text-amber-800/80 dark:text-amber-400/80 mt-1 font-semibold truncate">
                {colabMetrics.proximaParcela
                  ? `Venc. ${new Date(colabMetrics.proximaParcela.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')} (${colabMetrics.proximaParcela.competencia})`
                  : 'Nenhum desconto agendado'}
              </div>
            </div>
          </div>

          {/* SEÇÃO 4: ABAS DE VISUALIZAÇÃO (CONTRATOS / CRONOGRAMA GERAL / PAGAS) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTabSubView('contratos')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTabSubView === 'contratos'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Contratos de Empréstimo ({selectedColaborador.loans.length})
                </button>

                <button
                  onClick={() => setActiveTabSubView('cronograma')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTabSubView === 'cronograma'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Cronograma Geral de Parcelas ({todasParcelasCronologicas.length})
                </button>

                <button
                  onClick={() => setActiveTabSubView('pagas')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    activeTabSubView === 'pagas'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Histórico de Parcelas Pagas ({parcelasPagasList.length})
                </button>
              </div>
            </div>

            {/* ABA 1: LISTA DE CONTRATOS DO COLABORADOR */}
            {activeTabSubView === 'contratos' && (
              <div className="space-y-4">
                {selectedColaborador.loans.length === 0 ? (
                  <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-2xl p-10 text-center text-slate-400 text-xs">
                    Este colaborador não possui contratos de empréstimo cadastrados.
                  </div>
                ) : (
                  selectedColaborador.loans.map((loan) => {
                    const badge = getStatusBadge(loan.status)
                    const cardStyle = getStatusCardStyles(loan.status)
                    const percentQuitado = loan.valorAprovado > 0
                      ? Math.min(100, Math.round(((loan.totalAmortizado || 0) / loan.valorAprovado) * 100))
                      : 0
                    const parcelasPagasCount = (loan.parcelas || []).filter(
                      (p) => p.status === 'descontada' || p.status === 'paga_avulso'
                    ).length
                    const isExpanded = expandedLoanId === loan.id

                    return (
                      <div
                        key={loan.id}
                        className="bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl border border-white/80 dark:border-slate-700/60 rounded-2xl shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08),0_8px_10px_-6px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden transition-all duration-300 hover:shadow-xl relative"
                      >
                        {/* Listra superior com gradiente temático */}
                        <div className={`h-1.5 w-full ${cardStyle.topStripe}`} />

                        {/* CABEÇALHO DO CONTRATO COM GRADIENTE */}
                        <div className={`p-4 sm:p-5 ${cardStyle.headerBg} border-b border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl ${cardStyle.iconBg} border flex items-center justify-center font-mono font-black text-xs shrink-0 shadow-xs`}>
                              {loan.codigoOperacao.split('-')[2] || 'CR'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                                  {loan.codigoOperacao}
                                </span>
                                <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border shadow-xs whitespace-nowrap ${badge.bg}`}>
                                  {badge.label}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Contratado em {new Date(loan.createdAt).toLocaleDateString('pt-BR')} • {loan.quantidadeParcelas}x parcelas • Taxa: {loan.taxaMensal}% a.m.
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => onOpenDetails(loan)}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
                            >
                              <Eye size={13} />
                              <span>Ver Contrato</span>
                            </button>
                            <button
                              onClick={() => setExpandedLoanId(isExpanded ? null : loan.id)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs flex items-center gap-1.5 transition-all border border-emerald-200 dark:border-emerald-800/50 shadow-xs"
                            >
                              <span>{isExpanded ? 'Recolher Parcelas' : 'Ver Parcelas'}</span>
                              <ChevronDown size={13} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {/* RESUMO DE VALORES DO CONTRATO */}
                        <div className="p-4 sm:p-5 space-y-4">
                          {(() => {
                            const isPendingAppr = loan.status === 'solicitado' || loan.status === 'em_analise' || loan.status === 'contraproposta'
                            const isPendingSignOrDisb = loan.status === 'aguardando_assinatura' || loan.status === 'aguardando_liberacao'
                            const isEffectivelyActive = loan.status === 'ativo'

                            return (
                              <>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                                  <div className="bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                    <span className="text-[10px] uppercase font-sans text-slate-400 font-semibold">
                                      {isPendingAppr ? 'Valor Solicitado' : 'Valor Concedido'}
                                    </span>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                      {formatBrl(loan.valorAprovado || loan.valorSolicitado)}
                                    </div>
                                  </div>

                                  <div className="bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                    <span className="text-[10px] uppercase font-sans text-slate-400 font-semibold">Saldo Devedor</span>
                                    <div className={`text-sm font-bold mt-0.5 ${
                                      isEffectivelyActive
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-slate-500 dark:text-slate-400'
                                    }`}>
                                      {isEffectivelyActive ? formatBrl(loan.saldoDevedorAtual) : 'R$ 0,00'}
                                    </div>
                                    {!isEffectivelyActive && (
                                      <div className="text-[9px] text-amber-600 dark:text-amber-400 font-sans mt-0.5">
                                        {isPendingAppr ? 'Em análise (não liberado)' : isPendingSignOrDisb ? 'Aguardando liberação' : 'Sem saldo devedor'}
                                      </div>
                                    )}
                                  </div>

                                  <div className="bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                    <span className="text-[10px] uppercase font-sans text-slate-400 font-semibold">Parcelas</span>
                                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                                      {isPendingAppr
                                        ? `0 / ${loan.quantidadeParcelas} (Aguardando)`
                                        : `${parcelasPagasCount} / ${loan.quantidadeParcelas}`}
                                    </div>
                                  </div>

                                  <div className="bg-slate-50/80 dark:bg-slate-800/50 backdrop-blur-sm p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                                    <span className="text-[10px] uppercase font-sans text-slate-400 font-semibold">
                                      {isPendingAppr ? 'Juros Estimados' : 'Total de Juros'}
                                    </span>
                                    <div className="text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                                      {formatBrl(loan.totalJuros)}
                                    </div>
                                  </div>
                                </div>

                                {/* BARRA DE PROGRESSO DE QUITAÇÃO DO CONTRATO */}
                                <div>
                                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1 font-medium">
                                    <span>
                                      {isPendingAppr ? 'Status da Proposta' : 'Progresso de Amortização do Capital'}
                                    </span>
                                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                                      {isPendingAppr
                                        ? 'Em Análise de Crédito'
                                        : isPendingSignOrDisb
                                        ? 'Aguardando Formalização'
                                        : `${percentQuitado}% quitado`}
                                    </span>
                                  </div>
                                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        isPendingAppr
                                          ? 'bg-amber-500'
                                          : isPendingSignOrDisb
                                          ? 'bg-cyan-500'
                                          : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                      }`}
                                      style={{ width: isPendingAppr || isPendingSignOrDisb ? '100%' : `${percentQuitado}%` }}
                                    />
                                  </div>
                                </div>
                              </>
                            )
                          })()}

                          {/* TABELA DETALHADA DE PARCELAS EXPANSÍVEL */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
                              <div className="text-xs font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-1.5">
                                <Receipt size={14} className="text-emerald-500" />
                                <span>Tabela de Parcelas • {loan.codigoOperacao}</span>
                              </div>
                              <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-y border-slate-200/80 dark:border-slate-800">
                                  <tr>
                                    <th className="py-2 px-3 text-center w-[50px]">Nº</th>
                                    <th className="py-2 px-3 text-center">Competência</th>
                                    <th className="py-2 px-3 text-center">Vencimento</th>
                                    <th className="py-2 px-3 text-right">Amortização</th>
                                    <th className="py-2 px-3 text-right">Juros</th>
                                    <th className="py-2 px-3 text-right">Total Parcela</th>
                                    <th className="py-2 px-3 text-right">Saldo Devedor</th>
                                    <th className="py-2 px-3 text-center">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                                  {(loan.parcelas || []).map((p) => {
                                    const isPaid = p.status === 'descontada' || p.status === 'paga_avulso'
                                    return (
                                      <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                                        <td className="py-2 px-3 text-center font-bold text-slate-600 dark:text-slate-400">
                                          {String(p.numero).padStart(2, '0')}
                                        </td>
                                        <td className="py-2 px-3 text-center text-slate-800 dark:text-slate-200">
                                          {p.competencia}
                                        </td>
                                        <td className="py-2 px-3 text-center text-slate-600 dark:text-slate-400 font-sans">
                                          {new Date(p.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300">
                                          {formatBrl(p.valorAmortizacao)}
                                        </td>
                                        <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400">
                                          {formatBrl(p.valorJuros)}
                                        </td>
                                        <td className="py-2 px-3 text-right font-bold text-slate-900 dark:text-white">
                                          {formatBrl(p.valorTotal)}
                                        </td>
                                        <td className="py-2 px-3 text-right text-slate-500">
                                          {formatBrl(p.saldoDevedorApos)}
                                        </td>
                                        <td className="py-2 px-3 text-center font-sans">
                                          <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                            isPaid
                                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                                              : p.status === 'exportada_folha'
                                              ? 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800'
                                              : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                          }`}>
                                            {p.status === 'descontada' ? 'Descontada' : p.status === 'paga_avulso' ? 'Paga Avulso' : p.status === 'exportada_folha' ? 'Em Folha' : 'Prevista'}
                                          </span>
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {/* ABA 2: CRONOGRAMA UNIFICADO DE TODAS AS PARCELAS */}
            {activeTabSubView === 'cronograma' && (
              <div className="bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl border border-white/80 dark:border-slate-700/60 rounded-2xl shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08),0_8px_10px_-6px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-emerald-500" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Cronograma Geral de Descontos e Parcelas (Ordem Cronológica)
                    </h4>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    Total: {todasParcelasCronologicas.length} parcelas
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 text-center">Operação</th>
                        <th className="py-2.5 px-2 text-center">Parc.</th>
                        <th className="py-2.5 px-3 text-center">Competência</th>
                        <th className="py-2.5 px-3 text-center">Vencimento</th>
                        <th className="py-2.5 px-3 text-right">Amortização</th>
                        <th className="py-2.5 px-3 text-right">Juros</th>
                        <th className="py-2.5 px-3 text-right font-black">Valor Parcela</th>
                        <th className="py-2.5 px-3 text-right">Saldo Restante</th>
                        <th className="py-2.5 px-3 text-center">Situação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                      {todasParcelasCronologicas.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                            Nenhuma parcela registrada para este colaborador.
                          </td>
                        </tr>
                      ) : (
                        todasParcelasCronologicas.map((p, idx) => {
                          const isPaid = p.status === 'descontada' || p.status === 'paga_avulso'
                          return (
                            <tr key={`${p.id}-${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">
                                {p.codigoOperacao}
                              </td>
                              <td className="py-2.5 px-2 text-center text-slate-500">
                                {String(p.numero).padStart(2, '0')}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-800 dark:text-slate-200">
                                {p.competencia}
                              </td>
                              <td className="py-2.5 px-3 text-center font-sans text-slate-600 dark:text-slate-400">
                                {new Date(p.dataVencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                                {formatBrl(p.valorAmortizacao)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
                                {formatBrl(p.valorJuros)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-slate-900 dark:text-white">
                                {formatBrl(p.valorTotal)}
                              </td>
                              <td className="py-2.5 px-3 text-right text-slate-500">
                                {formatBrl(p.saldoDevedorApos)}
                              </td>
                              <td className="py-2.5 px-3 text-center font-sans">
                                <span className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${
                                  isPaid
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                                    : p.status === 'exportada_folha'
                                    ? 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800'
                                    : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                }`}>
                                  {p.status === 'descontada' ? 'Descontada' : p.status === 'paga_avulso' ? 'Paga Avulso' : p.status === 'exportada_folha' ? 'Em Folha' : 'Prevista'}
                                </span>
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ABA 3: HISTÓRICO DE PARCELAS PAGAS */}
            {activeTabSubView === 'pagas' && (
              <div className="bg-white/90 dark:bg-slate-900/85 backdrop-blur-xl border border-white/80 dark:border-slate-700/60 rounded-2xl shadow-[0_10px_25px_-5px_rgba(15,23,42,0.08),0_8px_10px_-6px_rgba(15,23,42,0.04),inset_0_1px_1px_rgba(255,255,255,0.95)] dark:shadow-[0_12px_28px_-6px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-slate-900/5 dark:ring-white/5 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Parcelas Liquidadas e Descontadas com Sucesso
                    </h4>
                  </div>
                  <span className="text-xs text-emerald-600 font-mono font-bold">
                    Total Quitado: {formatBrl(colabMetrics.totalAmortizado)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50/80 dark:bg-slate-800/50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3 text-center">Operação</th>
                        <th className="py-2.5 px-2 text-center">Parc.</th>
                        <th className="py-2.5 px-3 text-center">Competência</th>
                        <th className="py-2.5 px-3 text-center">Data do Desconto</th>
                        <th className="py-2.5 px-3 text-right">Amortização</th>
                        <th className="py-2.5 px-3 text-right">Juros Pagos</th>
                        <th className="py-2.5 px-3 text-right font-black">Valor Descontado</th>
                        <th className="py-2.5 px-3 text-center">Comprovação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono text-[11px]">
                      {parcelasPagasList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                            Nenhuma parcela com baixa comprovada até o momento.
                          </td>
                        </tr>
                      ) : (
                        parcelasPagasList.map((p, idx) => (
                          <tr key={`${p.id}-${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 text-center font-bold text-slate-900 dark:text-white">
                              {p.codigoOperacao}
                            </td>
                            <td className="py-2.5 px-2 text-center text-slate-500">
                              {String(p.numero).padStart(2, '0')}
                            </td>
                            <td className="py-2.5 px-3 text-center text-slate-800 dark:text-slate-200">
                              {p.competencia}
                            </td>
                            <td className="py-2.5 px-3 text-center font-sans text-slate-600 dark:text-slate-400">
                              {p.dataPagamento ? new Date(p.dataPagamento).toLocaleDateString('pt-BR') : 'Conciliada'}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                              {formatBrl(p.valorAmortizacao)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-amber-600 dark:text-amber-400">
                              {formatBrl(p.valorJuros)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                              {formatBrl(p.valorPago || p.valorTotal)}
                            </td>
                            <td className="py-2.5 px-3 text-center font-sans">
                              <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                Descontada em Folha
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
