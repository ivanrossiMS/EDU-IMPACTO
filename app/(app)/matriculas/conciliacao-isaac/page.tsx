'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useData } from '@/lib/dataContext'
import * as XLSX from 'xlsx'
import type {
  ProdutoCategoria,
  MesAuditItem,
  ProdutoAlunoAudit,
  ParcelaConciliacaoDTO,
  ConciliacaoStatus,
  AlunoConciliacaoItem,
} from '@/app/api/isaac/conciliacao/route'
import {
  ShieldCheck, Search, RefreshCw, FileSpreadsheet, Printer,
  Users, CheckCircle2, AlertTriangle, Eye, Layers, Calendar,
  ArrowUpRight, Copy, Check, ExternalLink, Package,
  HelpCircle, FileText, UserCheck, UserX, AlertOctagon,
  SlidersHorizontal, Building2, X, Filter, CheckSquare
} from 'lucide-react'

// ─── Response Shape of GET /api/isaac/conciliacao ────────────────────────────

interface ResumoTurmaItem {
  turmaNome: string
  serieNome: string
  segmentoNome: string
  turnoNome: string
  totalErp: number
  totalNoIsaac: number
  totalConciliados: number
  totalSemIsaac: number
  totalForaIsaac: number
  totalComFaltantes: number
  totalInadimplentes: number
  taxaConciliacaoPct: number
  valorContratadoCentavos: number
  valorPagoCentavos: number
  valorAbertoCentavos: number
  valorVencidoCentavos: number
  valorContratadoFormatado: string
  valorPagoFormatado: string
  valorAbertoFormatado: string
  valorVencidoFormatado: string
}

interface ConciliacaoApiResponse {
  ano: string
  isaacConnected: boolean
  isaacError: string | null
  meta: {
    cacheAgeSeconds: number
    processingTimeMs: number
    totalRawInstallmentsInIsaac: number
    fetchedAt: string
  }
  kpis: {
    ano: string
    totalAlunosIsaac: number
    totalMatriculadosErp: number
    totalConciliados: number
    totalApenasErp: number
    totalApenasErpForaIsaac: number
    totalApenasErpPendentes: number
    totalApenasIsaac: number
    totalSomenteIsaacSemErp?: number
    totalInativoErpComIsaac?: number
    totalComDivergenciaId: number
    totalComFaltantes12ComMat: number
    totalComFaltantes12Estrito: number
    totalComFaltantes11FevDez: number
    totalGradeCompleta12ComMat: number
    totalAdimplentesIsaac: number
    totalInadimplentesIsaac: number
    totalParcelasAnoIsaac: number
    taxaConciliacaoPct: number
    volumeTotalContratadoFormatado: string
    volumeTotalPagoFormatado: string
    volumeTotalAbertoFormatado: string
    volumeTotalVencidoFormatado: string
    volumeTotalContratadoCentavos: number
    volumeTotalPagoCentavos: number
    volumeTotalAbertoCentavos: number
    volumeTotalVencidoCentavos: number
  }
  resumoPorTurma: ResumoTurmaItem[]
  alunos: AlunoConciliacaoItem[]
  error?: string
}

type RegraAuditoria = 'COM_MATRICULA' | 'ESTRITO_12' | 'FEV_DEZ_11'
type ActiveTab = 'ALUNOS_AUDITORIA' | 'CONCILIACAO_ERP' | 'TURMAS_RESUMO'

interface MissingParcelaItem {
  num: number // 1..12 (mês ou número da parcela)
  sigla: string // JAN..DEZ ou 1ª..12ª
  nomeMes: string // Janeiro..Dezembro
  labelCurto: string // ex: "FEV (2ª Parc.)" ou "Parcela 3/6"
  tipo: 'NAO_GERADA' | 'CANCELADA'
  detalheCancelada?: string
}

const MESES_CURTOS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
const MESES_NOMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const formatDateBR = (dateStr: string | null | undefined) => {
  if (!dateStr) return '—'
  const clean = dateStr.split('T')[0]
  const parts = clean.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return dateStr
}

const shortProductName = (prod: ProdutoAlunoAudit) => {
  if (prod.categoria === 'MENSALIDADE') {
    if (/\b(integral|intermedi[aá]rio)\b/i.test(prod.nome)) return 'Mensalidade • Integral'
    return 'Mensalidade'
  }
  if (prod.categoria === 'MATRICULA') {
    if (/\b(integral|intermedi[aá]rio)\b/i.test(prod.nome)) return 'Matrícula • Integral'
    if (/entrada/i.test(prod.nome)) return 'Entrada / Matrícula'
    return 'Matrícula / Remat.'
  }
  if (prod.categoria === 'INTEGRAL') {
    if (/mensalidade/i.test(prod.nome)) return 'Mensalidade • Integral'
    return 'Período Integral'
  }
  if (prod.categoria === 'MATERIAL') return 'Material Didático'
  return prod.nome.length > 26 ? prod.nome.slice(0, 24) + '…' : prod.nome
}

const getCategoryBadgeStyle = (categoria: ProdutoCategoria) => {
  if (categoria === 'MENSALIDADE') return { bg: '#eef2ff', color: '#4338ca', border: '#c7d2fe', label: 'Mensalidade' }
  if (categoria === 'MATRICULA') return { bg: '#f3e8ff', color: '#6b21a8', border: '#e9d5ff', label: 'Matrícula' }
  if (categoria === 'INTEGRAL') return { bg: '#fef3c7', color: '#92400e', border: '#fde68a', label: 'Integral' }
  if (categoria === 'MATERIAL') return { bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc', label: 'Material' }
  return { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1', label: 'Outros' }
}

export default function ConciliacaoIsaacPage() {
  const { cfgCalendarioLetivo = [] } = useData()

  const anoPadrao = useMemo(() => {
    const vigente = cfgCalendarioLetivo?.find((c: any) => c.isVigente)?.ano
    return vigente ? String(vigente) : '2026'
  }, [cfgCalendarioLetivo])

  const anosDisponiveis = useMemo(() => {
    const base = new Set<string>(['2027', '2026', '2025', '2024'])
    cfgCalendarioLetivo?.forEach((c: any) => {
      if (c?.ano) base.add(String(c.ano))
    })
    return Array.from(base).sort((a, b) => Number(b) - Number(a))
  }, [cfgCalendarioLetivo])

  const [anoSelecionado, setAnoSelecionado] = useState<string>('2026')
  const [regraAuditoria, setRegraAuditoria] = useState<RegraAuditoria>('COM_MATRICULA')
  const [activeTab, setActiveTab] = useState<ActiveTab>('ALUNOS_AUDITORIA')

  // General Filters
  const [busca, setBusca] = useState('')
  const [filtroTurma, setFiltroTurma] = useState<string>('TODAS')
  const [filtroConciliacao, setFiltroConciliacao] = useState<string>('TODOS')
  const [filtroStatusFinanceiro, setFiltroStatusFinanceiro] = useState<string>('TODOS')
  const [apenasDivergenciaId, setApenasDivergenciaId] = useState<boolean>(false)

  // Product & Missing Installments Filters
  const [filtroCategoriaProduto, setFiltroCategoriaProduto] = useState<string>('TODOS')
  const [apenasComFaltantes, setApenasComFaltantes] = useState<boolean>(false)
  const [filtroMesesFaltantes, setFiltroMesesFaltantes] = useState<number[]>([])
  const [selecaoMultiplaMeses, setSelecaoMultiplaMeses] = useState<boolean>(false)
  const [modoMesesFaltantes, setModoMesesFaltantes] = useState<'QUALQUER' | 'TODOS'>('QUALQUER')
  const [filtroTipoFalta, setFiltroTipoFalta] = useState<'TODAS' | 'NAO_GERADA' | 'CANCELADA'>('TODAS')

  // Exclusive Focus Mode: When true (default), ONLY shows the selected product and ONLY the selected missing installment(s)
  const [modoFocoExclusivo, setModoFocoExclusivo] = useState<boolean>(true)

  // Data state
  const [data, setData] = useState<ConciliacaoApiResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Modal state (native <dialog>)
  const [selectedAlunoKey, setSelectedAlunoKey] = useState<string | null>(null)
  const [modalProductFilter, setModalProductFilter] = useState<string>('TODOS')
  const [modalStatusFilter, setModalStatusFilter] = useState<string>('TODOS')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    if (anoPadrao && !data) {
      setAnoSelecionado(anoPadrao)
    }
  }, [anoPadrao, data])

  const fetchConciliacao = useCallback(async (ano: string, forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const res = await fetch(
        `/api/isaac/conciliacao?ano=${encodeURIComponent(ano)}${forceRefresh ? '&refresh=true' : ''}`,
        { cache: 'no-store' }
      )
      const json: ConciliacaoApiResponse = await res.json()
      if (!res.ok || json.error) {
        throw new Error(json.error || `Falha ao carregar conciliação (${res.status})`)
      }
      setData(json)
    } catch (err: any) {
      setError(err?.message || 'Erro inesperado ao consultar API do Isaac.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchConciliacao(anoSelecionado, false)
  }, [anoSelecionado, fetchConciliacao])

  // Check if a product matches a product filter (category or specific product name "NOME:...")
  const prodMatchesFilter = useCallback((prod: ProdutoAlunoAudit, filtroProd: string): boolean => {
    if (filtroProd === 'TODOS' || filtroProd === 'SEM_MENSALIDADE' || filtroProd === 'SEM_MATRICULA') return true
    if (filtroProd.startsWith('NOME:')) {
      return prod.nome === filtroProd.slice(5)
    }
    if (filtroProd === 'INTEGRAL') {
      return prod.categoria === 'INTEGRAL' || /\b(integral|intermedi[aá]rio)\b/i.test(prod.nome)
    }
    return prod.categoria === filtroProd
  }, [])

  // Missing month numbers (1..12) for a specific product according to selected RegraAuditoria
  const getFaltantesMesesNumsProduto = useCallback((prod: ProdutoAlunoAudit): number[] => {
    if (prod.categoria === 'MENSALIDADE' || prod.categoria === 'INTEGRAL') {
      const meses =
        regraAuditoria === 'COM_MATRICULA'
          ? prod.mesesFaltantesComMatricula
          : regraAuditoria === 'ESTRITO_12'
          ? prod.mesesFaltantes12Estrito
          : prod.mesesFaltantes11FevDez
      return meses || []
    }
    // For MATRICULA / MATERIAL / OUTROS: combine canceled months without replacement + sequence numbers (1..12)
    const nums = new Set<number>(prod.mesesCanceladosSemSubstituta || [])
    ;(prod.numerosParcelasFaltantes || []).forEach(seqStr => {
      const n = parseInt(String(seqStr).split('/')[0], 10)
      if (n >= 1 && n <= 12) nums.add(n)
    })
    return Array.from(nums).sort((a, b) => a - b)
  }, [regraAuditoria])

  // Missing month/installment numbers (1..12) filtered by fault type (TODAS / NAO_GERADA / CANCELADA)
  const getFaltantesMesesNumsPorTipo = useCallback(
    (prod: ProdutoAlunoAudit, tipoFalta: 'TODAS' | 'NAO_GERADA' | 'CANCELADA' = 'TODAS'): number[] => {
      const baseNums = getFaltantesMesesNumsProduto(prod)
      const canceledSet = new Set(prod.mesesCanceladosSemSubstituta || [])
      if (tipoFalta === 'TODAS') return baseNums
      if (tipoFalta === 'CANCELADA') {
        return baseNums.filter(m => canceledSet.has(m))
      }
      // NAO_GERADA
      return baseNums.filter(m => !canceledSet.has(m))
    },
    [getFaltantesMesesNumsProduto]
  )

  // Detailed structured missing installments for a product (optionally filtered to only selected months/installments)
  const getDetalhesParcelasFaltantesProduto = useCallback(
    (
      prod: ProdutoAlunoAudit,
      alunoParcelas: ParcelaConciliacaoDTO[],
      apenasMesesSelecionados: boolean
    ): MissingParcelaItem[] => {
      const canceledSet = new Set(prod.mesesCanceladosSemSubstituta || [])
      const missingNums = getFaltantesMesesNumsPorTipo(prod, filtroTipoFalta)

      // Also check if user clicked specific month(s) on non-monthly product
      const numsSet = new Set<number>(missingNums)
      if (
        filtroMesesFaltantes.length > 0 &&
        prod.categoria !== 'MENSALIDADE' &&
        prod.categoria !== 'INTEGRAL'
      ) {
        filtroMesesFaltantes.forEach(m => {
          const cell = prod.mesesGrid?.[m - 1]
          if (!cell) return
          if (filtroTipoFalta === 'TODAS' && cell.quantidadeAtivas === 0) numsSet.add(m)
          else if (filtroTipoFalta === 'NAO_GERADA' && cell.status === 'MISSING') numsSet.add(m)
          else if (filtroTipoFalta === 'CANCELADA' && cell.status === 'CANCELED_ONLY') numsSet.add(m)
        })
      }

      let finalNums = Array.from(numsSet).sort((a, b) => a - b)
      if (apenasMesesSelecionados && filtroMesesFaltantes.length > 0) {
        finalNums = finalNums.filter(n => filtroMesesFaltantes.includes(n))
      }

      // Map sequence strings like "3/6" by their numerator
      const seqMap = new Map<number, string>()
      ;(prod.numerosParcelasFaltantes || []).forEach(s => {
        const n = parseInt(String(s).split('/')[0], 10)
        if (!isNaN(n)) seqMap.set(n, s)
      })

      return finalNums.map(num => {
        const isCanceled = canceledSet.has(num) || prod.mesesGrid?.[num - 1]?.status === 'CANCELED_ONLY'
        const sigla = MESES_CURTOS[num - 1] || `${num}ª`
        const nomeMes = MESES_NOMES[num - 1] || `Parcela ${num}`
        const seqLabel = seqMap.get(num)

        // Find canceled installment detail if any
        let detalheCancelada: string | undefined
        if (isCanceled) {
          const cancParc = (alunoParcelas || []).find(
            p =>
              p.produtoKey === prod.key &&
              p.status === 'CANCELED' &&
              (p.mesCompetencia === num || p.numeroParcela === num)
          )
          if (cancParc) {
            detalheCancelada = `Venc: ${formatDateBR(cancParc.vencimento)} • ${cancParc.valorEfetivoFormatado}`
          }
        }

        const isMonthly = prod.categoria === 'MENSALIDADE' || prod.categoria === 'INTEGRAL'
        const labelCurto = seqLabel
          ? `Parcela ${seqLabel} (${sigla})`
          : isMonthly
          ? `${sigla}/${anoSelecionado.slice(-2)} (${num}ª Parc.)`
          : `${sigla}/${anoSelecionado.slice(-2)}`

        return {
          num,
          sigla,
          nomeMes,
          labelCurto,
          tipo: isCanceled ? 'CANCELADA' : 'NAO_GERADA',
          detalheCancelada,
        }
      })
    },
    [getFaltantesMesesNumsPorTipo, filtroTipoFalta, filtroMesesFaltantes, anoSelecionado]
  )

  // Missing items as short strings for Excel export & badges
  const getFaltantesProduto = useCallback((prod: ProdutoAlunoAudit): string[] => {
    if (prod.categoria !== 'MENSALIDADE' && prod.categoria !== 'INTEGRAL') {
      if (prod.numerosParcelasFaltantes?.length > 0 && filtroTipoFalta !== 'CANCELADA') {
        return prod.numerosParcelasFaltantes
      }
      if (filtroTipoFalta === 'NAO_GERADA') return []
      return (prod.mesesCanceladosSemSubstituta || []).map(m => MESES_CURTOS[m - 1] || `Mês ${m}`)
    }
    const meses = getFaltantesMesesNumsPorTipo(prod, filtroTipoFalta)
    return meses.map(m => MESES_CURTOS[m - 1] || `Mês ${m}`)
  }, [getFaltantesMesesNumsPorTipo, filtroTipoFalta])

  // Check if a specific product has missing installments matching the current month & fault type filters
  const produtoPossuiFaltaNoFiltro = useCallback(
    (prod: ProdutoAlunoAudit): boolean => {
      const missingMonths = getFaltantesMesesNumsPorTipo(prod, filtroTipoFalta)
      const hasSeqMissing =
        filtroTipoFalta !== 'CANCELADA' && (prod.numerosParcelasFaltantes?.length || 0) > 0

      if (filtroMesesFaltantes.length > 0) {
        const missingSet = new Set(missingMonths)
        if (prod.categoria !== 'MENSALIDADE' && prod.categoria !== 'INTEGRAL') {
          filtroMesesFaltantes.forEach(m => {
            const cell = prod.mesesGrid?.[m - 1]
            if (!cell) return
            if (filtroTipoFalta === 'TODAS' && cell.quantidadeAtivas === 0) missingSet.add(m)
            else if (filtroTipoFalta === 'NAO_GERADA' && cell.status === 'MISSING') missingSet.add(m)
            else if (filtroTipoFalta === 'CANCELADA' && cell.status === 'CANCELED_ONLY') missingSet.add(m)
          })
        }
        if (modoMesesFaltantes === 'TODOS') {
          return filtroMesesFaltantes.every(m => missingSet.has(m))
        }
        return filtroMesesFaltantes.some(m => missingSet.has(m))
      }

      return missingMonths.length > 0 || hasSeqMissing
    },
    [getFaltantesMesesNumsPorTipo, filtroTipoFalta, filtroMesesFaltantes, modoMesesFaltantes]
  )

  // Check if a student has missing installments under current RegraAuditoria, Product filter, Month filter & Fault Type
  const alunoPossuiFaltantes = useCallback((aluno: AlunoConciliacaoItem): boolean => {
    if (!aluno.possuiParcelasAtivasIsaac) return false
    if (filtroCategoriaProduto === 'SEM_MENSALIDADE') return !aluno.temMensalidade
    if (filtroCategoriaProduto === 'SEM_MATRICULA') return !aluno.temMatricula

    const prodsToInspect =
      filtroCategoriaProduto !== 'TODOS'
        ? (aluno.produtos || []).filter(p => prodMatchesFilter(p, filtroCategoriaProduto))
        : aluno.produtos || []

    if (filtroCategoriaProduto === 'TODOS' && !aluno.temMensalidade && filtroTipoFalta !== 'CANCELADA') {
      if (filtroMesesFaltantes.length === 0) return true
    }

    if (prodsToInspect.length === 0) return false
    return prodsToInspect.some(prod => produtoPossuiFaltaNoFiltro(prod))
  }, [
    filtroCategoriaProduto,
    filtroTipoFalta,
    filtroMesesFaltantes,
    prodMatchesFilter,
    produtoPossuiFaltaNoFiltro,
  ])

  // Determine which products of a student should be displayed in the row according to active filters & Focus Mode
  const getProdutosVisiveisAluno = useCallback(
    (aluno: AlunoConciliacaoItem): ProdutoAlunoAudit[] => {
      const todosProds = aluno.produtos || []
      if (!modoFocoExclusivo) return todosProds

      let filtrados = todosProds
      // 1. If a specific product category or product name is selected, ONLY return matching product(s)
      if (
        filtroCategoriaProduto !== 'TODOS' &&
        filtroCategoriaProduto !== 'SEM_MENSALIDADE' &&
        filtroCategoriaProduto !== 'SEM_MATRICULA'
      ) {
        filtrados = filtrados.filter(p => prodMatchesFilter(p, filtroCategoriaProduto))
      }

      // 2. If filtering by missing installments or specific missing month(s), ONLY return products that have the missing installment
      if (apenasComFaltantes || filtroMesesFaltantes.length > 0) {
        const comFalta = filtrados.filter(p => produtoPossuiFaltaNoFiltro(p))
        if (comFalta.length > 0) return comFalta
      }

      return filtrados
    },
    [
      modoFocoExclusivo,
      filtroCategoriaProduto,
      apenasComFaltantes,
      filtroMesesFaltantes,
      prodMatchesFilter,
      produtoPossuiFaltaNoFiltro,
    ]
  )

  const getMesesMensalidadeFaltantesAluno = useCallback((aluno: AlunoConciliacaoItem): string[] => {
    const prodMens = (aluno.produtos || []).find(p => p.categoria === 'MENSALIDADE')
    if (!prodMens) return []
    return getFaltantesProduto(prodMens)
  }, [getFaltantesProduto])

  // Available classes for filter dropdown
  const turmasLista = useMemo(() => {
    if (!data?.alunos) return []
    const set = new Set<string>()
    data.alunos.forEach(a => {
      const t = a?.turmaNome || 'Sem Turma'
      if (t) set.add(t)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [data])

  // Available specific product names in Isaac with student counts
  const produtosEspecificosLista = useMemo(() => {
    if (!data?.alunos) return []
    const map = new Map<string, { nome: string; categoria: ProdutoCategoria; count: number }>()
    data.alunos.forEach(a => {
      if (!a?.possuiParcelasAtivasIsaac) return
      const seenInStudent = new Set<string>()
      ;(a.produtos || []).forEach(p => {
        if (!p.nome || seenInStudent.has(p.nome)) return
        seenInStudent.add(p.nome)
        const curr = map.get(p.nome)
        if (curr) curr.count++
        else map.set(p.nome, { nome: p.nome, categoria: p.categoria, count: 1 })
      })
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [data])

  // Count how many students are missing each month/installment (1..12) for the currently selected product & fault type
  const contagemFaltantesPorMes = useMemo(() => {
    const counts: Record<number, number> = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0, 11: 0, 12: 0,
    }
    if (!data?.alunos) return counts

    data.alunos.forEach(aluno => {
      if (!aluno?.possuiParcelasAtivasIsaac) return
      if (filtroTurma !== 'TODAS' && (aluno.turmaNome || 'Sem Turma') !== filtroTurma) return
      if (filtroConciliacao !== 'TODOS') {
        const isForaIsaac = aluno.negociacao?.modalidadeIsaac === 'fora_isaac'
        if (filtroConciliacao === 'APENAS_ERP_PENDENTE' && (aluno.conciliacaoStatus !== 'APENAS_ERP' || isForaIsaac)) return
        else if (filtroConciliacao === 'APENAS_ERP_FORA_ISAAC' && (aluno.conciliacaoStatus !== 'APENAS_ERP' || !isForaIsaac)) return
        else if (filtroConciliacao === 'APENAS_ISAAC_OU_INATIVO' && aluno.conciliacaoStatus !== 'APENAS_ISAAC' && aluno.conciliacaoStatus !== 'INATIVO_COM_ISAAC') return
        else if (
          filtroConciliacao !== 'APENAS_ERP_PENDENTE' &&
          filtroConciliacao !== 'APENAS_ERP_FORA_ISAAC' &&
          filtroConciliacao !== 'APENAS_ISAAC_OU_INATIVO' &&
          aluno.conciliacaoStatus !== filtroConciliacao
        ) return
      }

      const prods =
        filtroCategoriaProduto !== 'TODOS' &&
        filtroCategoriaProduto !== 'SEM_MENSALIDADE' &&
        filtroCategoriaProduto !== 'SEM_MATRICULA'
          ? (aluno.produtos || []).filter(p => prodMatchesFilter(p, filtroCategoriaProduto))
          : (aluno.produtos || []).filter(p => p.categoria === 'MENSALIDADE' || p.categoria === 'INTEGRAL')

      const missingForStudent = new Set<number>()
      prods.forEach(prod => {
        const mNums = getFaltantesMesesNumsPorTipo(prod, filtroTipoFalta)
        mNums.forEach(m => missingForStudent.add(m))
        if (
          filtroCategoriaProduto !== 'TODOS' &&
          prod.categoria !== 'MENSALIDADE' &&
          prod.categoria !== 'INTEGRAL'
        ) {
          for (let m = 1; m <= 12; m++) {
            const cell = prod.mesesGrid?.[m - 1]
            if (!cell) continue
            if (filtroTipoFalta === 'TODAS' && cell.quantidadeAtivas === 0) missingForStudent.add(m)
            else if (filtroTipoFalta === 'NAO_GERADA' && cell.status === 'MISSING') missingForStudent.add(m)
            else if (filtroTipoFalta === 'CANCELADA' && cell.status === 'CANCELED_ONLY') missingForStudent.add(m)
          }
        }
      })

      missingForStudent.forEach(m => {
        if (counts[m] !== undefined) counts[m]++
      })
    })
    return counts
  }, [
    data,
    filtroTurma,
    filtroConciliacao,
    filtroCategoriaProduto,
    filtroTipoFalta,
    prodMatchesFilter,
    getFaltantesMesesNumsPorTipo,
  ])

  // Filtered students list
  const alunosFiltrados = useMemo(() => {
    if (!data?.alunos) return []
    const q = busca.trim().toLowerCase()

    return data.alunos.filter(aluno => {
      if (!aluno) return false

      // Tab specific base filter
      if (activeTab === 'ALUNOS_AUDITORIA' && filtroConciliacao === 'TODOS' && !aluno.possuiParcelasAtivasIsaac) {
        return false
      }

      // Turma filter
      if (filtroTurma !== 'TODAS') {
        const t = aluno.turmaNome || 'Sem Turma'
        if (t !== filtroTurma) return false
      }

      // Conciliação filter
      if (filtroConciliacao !== 'TODOS') {
        const isForaIsaac = aluno.negociacao?.modalidadeIsaac === 'fora_isaac'
        if (filtroConciliacao === 'APENAS_ERP_PENDENTE') {
          if (aluno.conciliacaoStatus !== 'APENAS_ERP' || isForaIsaac) return false
        } else if (filtroConciliacao === 'APENAS_ERP_FORA_ISAAC') {
          if (aluno.conciliacaoStatus !== 'APENAS_ERP' || !isForaIsaac) return false
        } else if (filtroConciliacao === 'APENAS_ISAAC_OU_INATIVO') {
          if (
            aluno.conciliacaoStatus !== 'APENAS_ISAAC' &&
            aluno.conciliacaoStatus !== 'INATIVO_COM_ISAAC'
          ) {
            return false
          }
        } else if (aluno.conciliacaoStatus !== filtroConciliacao) {
          return false
        }
      }

      // Status financeiro filter (ignorar se estiver filtrando alunos sem Isaac)
      if (filtroStatusFinanceiro !== 'TODOS' && !filtroConciliacao.startsWith('APENAS_ERP')) {
        if (filtroStatusFinanceiro === 'INADIMPLENTE') {
          if (!aluno.possuiParcelasAtivasIsaac || aluno.isAdimplenteIsaac) return false
        } else if (filtroStatusFinanceiro === 'EM_DIA') {
          if (!aluno.possuiParcelasAtivasIsaac || !aluno.isAdimplenteIsaac) return false
        } else if (filtroStatusFinanceiro === 'QUITADO') {
          if (
            !aluno.possuiParcelasAtivasIsaac ||
            aluno.totalParcelasAbertas > 0 ||
            aluno.totalParcelasVencidas > 0 ||
            aluno.totalParcelasPagas === 0
          ) {
            return false
          }
        }
      }

      // Categoria / Nome de produto filter (ignorar se estiver filtrando alunos sem Isaac)
      if (filtroCategoriaProduto !== 'TODOS' && !filtroConciliacao.startsWith('APENAS_ERP')) {
        if (filtroCategoriaProduto === 'SEM_MENSALIDADE') {
          if (!aluno.possuiParcelasAtivasIsaac || aluno.temMensalidade) return false
        } else if (filtroCategoriaProduto === 'SEM_MATRICULA') {
          if (!aluno.possuiParcelasAtivasIsaac || aluno.temMatricula) return false
        } else {
          const temProd = (aluno.produtos || []).some(p => prodMatchesFilter(p, filtroCategoriaProduto))
          if (!temProd) return false
        }
      }

      // Apenas com parcelas faltantes (ignorar se estiver filtrando alunos sem Isaac)
      if (
        !filtroConciliacao.startsWith('APENAS_ERP') &&
        (apenasComFaltantes || filtroMesesFaltantes.length > 0) &&
        !alunoPossuiFaltantes(aluno)
      ) {
        return false
      }

      // Apenas divergência de ID
      if (apenasDivergenciaId && !aluno.alertaDivergenciaId) return false

      // Search query
      if (q) {
        const matchNome = aluno.nome?.toLowerCase().includes(q)
        const matchId =
          aluno.erpId?.toLowerCase().includes(q) ||
          aluno.erpMatricula?.toLowerCase().includes(q) ||
          aluno.isaacStudentId?.toLowerCase().includes(q) ||
          aluno.isaacExternalId?.toLowerCase().includes(q)
        const matchResp =
          aluno.responsavelNome?.toLowerCase().includes(q) ||
          aluno.responsavelCpf?.toLowerCase().includes(q)
        const matchTurma =
          aluno.turmaNome?.toLowerCase().includes(q) ||
          aluno.serieNome?.toLowerCase().includes(q)
        if (!matchNome && !matchId && !matchResp && !matchTurma) return false
      }

      return true
    })
  }, [
    data,
    activeTab,
    busca,
    filtroTurma,
    filtroConciliacao,
    filtroStatusFinanceiro,
    filtroCategoriaProduto,
    apenasComFaltantes,
    filtroMesesFaltantes,
    apenasDivergenciaId,
    alunoPossuiFaltantes,
    prodMatchesFilter,
  ])

  const selectedAluno = useMemo(() => {
    if (!selectedAlunoKey || !data?.alunos) return null
    return data.alunos.find(a => a.key === selectedAlunoKey) || null
  }, [selectedAlunoKey, data])

  // Open / close native <dialog> modal, pre-selecting the filtered product if active
  const openStudentModal = (alunoKey: string) => {
    setSelectedAlunoKey(alunoKey)
    const alunoObj = data?.alunos?.find(a => a.key === alunoKey)
    if (
      alunoObj &&
      filtroCategoriaProduto !== 'TODOS' &&
      filtroCategoriaProduto !== 'SEM_MENSALIDADE' &&
      filtroCategoriaProduto !== 'SEM_MATRICULA'
    ) {
      const matchedProd = (alunoObj.produtos || []).find(p => prodMatchesFilter(p, filtroCategoriaProduto))
      setModalProductFilter(matchedProd ? matchedProd.key : 'TODOS')
    } else {
      setModalProductFilter('TODOS')
    }
    setModalStatusFilter('TODOS')
    requestAnimationFrame(() => {
      if (dialogRef.current && !dialogRef.current.open) {
        dialogRef.current.showModal()
      }
    })
  }

  const closeStudentModal = () => {
    if (dialogRef.current && dialogRef.current.open) {
      dialogRef.current.close()
    }
    setSelectedAlunoKey(null)
  }

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const limparTodosFiltros = () => {
    setBusca('')
    setFiltroTurma('TODAS')
    setFiltroConciliacao('TODOS')
    setFiltroStatusFinanceiro('TODOS')
    setFiltroCategoriaProduto('TODOS')
    setApenasComFaltantes(false)
    setFiltroMesesFaltantes([])
    setFiltroTipoFalta('TODAS')
    setApenasDivergenciaId(false)
  }

  const possuiFiltroAtivo =
    Boolean(busca) ||
    filtroTurma !== 'TODAS' ||
    filtroConciliacao !== 'TODOS' ||
    filtroStatusFinanceiro !== 'TODOS' ||
    filtroCategoriaProduto !== 'TODOS' ||
    apenasComFaltantes ||
    filtroMesesFaltantes.length > 0 ||
    filtroTipoFalta !== 'TODAS' ||
    apenasDivergenciaId

  const estaEmModoFocoParcelaFaltante =
    modoFocoExclusivo && (apenasComFaltantes || filtroMesesFaltantes.length > 0)

  const nomeProdutoFiltroAtivo = useMemo(() => {
    if (filtroCategoriaProduto === 'TODOS') return 'Todos os Produtos'
    if (filtroCategoriaProduto === 'MENSALIDADE') return 'Mensalidade'
    if (filtroCategoriaProduto === 'MATRICULA') return 'Matrícula / Entrada'
    if (filtroCategoriaProduto === 'INTEGRAL') return 'Período Integral'
    if (filtroCategoriaProduto === 'MATERIAL') return 'Material Didático'
    if (filtroCategoriaProduto === 'OUTROS') return 'Outros Produtos / Taxas'
    if (filtroCategoriaProduto === 'SEM_MENSALIDADE') return 'Sem Mensalidade no Isaac'
    if (filtroCategoriaProduto === 'SEM_MATRICULA') return 'Sem Matrícula no Isaac'
    if (filtroCategoriaProduto.startsWith('NOME:')) return filtroCategoriaProduto.slice(5)
    return filtroCategoriaProduto
  }, [filtroCategoriaProduto])

  // ─── Multi-Sheet Excel Export (.xlsx) ───────────────────────────────────────
  const exportarExcelCompleto = () => {
    if (!data) return
    const wb = XLSX.utils.book_new()

    // Aba 1: Auditoria de Produtos (respeitando o Modo Foco se ativo)
    const rowsProdutos: Record<string, any>[] = []
    alunosFiltrados.forEach(a => {
      if (!a.possuiParcelasAtivasIsaac) return
      const prods = getProdutosVisiveisAluno(a)
      prods.forEach(p => {
        const faltantesDetalhes = getDetalhesParcelasFaltantesProduto(
          p,
          a.parcelas || [],
          modoFocoExclusivo && filtroMesesFaltantes.length > 0
        )
        const faltantesLabels = faltantesDetalhes.map(f => f.labelCurto)
        const row: Record<string, any> = {
          'Ano Letivo': data.ano,
          'Aluno': a.nome,
          'ID ERP': a.erpId || '—',
          'ID Isaac': a.isaacExternalId || a.isaacStudentId || '—',
          'Turma': a.turmaNome || '—',
          'Responsável Financeiro': a.responsavelNome || '—',
          'CPF Responsável': a.responsavelCpf || '—',
          'Categoria Produto': p.categoria,
          'Nome do Produto': p.nome,
          'Parcelas Ativas': p.parcelasAtivas,
          'Parcelas Esperadas': p.parcelasEsperadasPadrao,
          'Possui Faltantes?': faltantesLabels.length > 0 ? 'SIM' : 'NÃO',
          'Parcelas Faltantes (Filtro Atual)': faltantesLabels.join(', ') || 'Completo',
          'Valor Contratado Produto (R$)': Number((p.valorContratadoCentavos / 100).toFixed(2)),
          'Valor Pago Produto (R$)': Number((p.valorPagoCentavos / 100).toFixed(2)),
          'Valor Vencido Produto (R$)': Number((p.valorVencidoCentavos / 100).toFixed(2)),
        }
        if (!estaEmModoFocoParcelaFaltante) {
          ;(p.mesesGrid || []).forEach(mg => {
            row[mg.sigla] =
              mg.status === 'PAID'
                ? 'PAGO'
                : mg.status === 'OVERDUE'
                ? 'VENCIDO'
                : mg.status === 'OPEN'
                ? 'A VENCER'
                : mg.status === 'COVERED_BY_ENROLLMENT'
                ? 'MATRÍCULA'
                : mg.status === 'CANCELED_ONLY'
                ? 'CANCELADO S/ SUBST.'
                : 'FALTANTE'
          })
        }
        rowsProdutos.push(row)
      })
    })
    const wsProdutos = XLSX.utils.json_to_sheet(rowsProdutos)
    XLSX.utils.book_append_sheet(wb, wsProdutos, 'Auditoria por Produto')

    // Aba 2: Conciliação Geral
    const rowsConciliacao = alunosFiltrados.map(a => {
      const faltantesMeses = getMesesMensalidadeFaltantesAluno(a)
      const isForaIsaac = a.negociacao?.modalidadeIsaac === 'fora_isaac'
      return {
        'Ano Letivo': data.ano,
        'Status Conciliação':
          a.conciliacaoStatus === 'CONCILIADO'
            ? 'Conciliado (ERP + Isaac)'
            : a.conciliacaoStatus === 'APENAS_ERP'
            ? isForaIsaac
              ? 'Apenas ERP (Negociação Fora do Isaac)'
              : 'Apenas ERP (Pendente Lançamento Isaac)'
            : a.conciliacaoStatus === 'APENAS_ISAAC'
            ? 'Apenas no Isaac (Sem Matrícula Ativa no Ano)'
            : 'Inativo no ERP com Cobrança Isaac',
        'Nome do Aluno': a.nome,
        'ID Gestão Escolar': a.erpId || '—',
        'ID Aluno Isaac': a.isaacExternalId || a.isaacStudentId || '—',
        'Turma': a.turmaNome || '—',
        'Situação ERP': a.statusErp || '—',
        'Responsável Financeiro': a.responsavelNome || '—',
        'CPF Responsável': a.responsavelCpf || '—',
        'Parcelas Ativas Isaac': a.totalParcelasAtivas,
        'Meses Mensalidade Faltantes': faltantesMeses.join(', ') || 'Completo',
        'Valor Contratado Ativo (R$)': Number((a.valorTotalContratadoCentavos / 100).toFixed(2)),
        'Valor Pago (R$)': Number((a.valorTotalPagoCentavos / 100).toFixed(2)),
        'Valor Vencido (R$)': Number((a.valorTotalVencidoCentavos / 100).toFixed(2)),
      }
    })
    const wsConciliacao = XLSX.utils.json_to_sheet(rowsConciliacao)
    XLSX.utils.book_append_sheet(wb, wsConciliacao, 'Conciliacao Geral')

    // Aba 3: Resumo por Turma
    const rowsTurmas = (data.resumoPorTurma || []).map(t => ({
      'Turma': t.turmaNome,
      'Série': t.serieNome || '—',
      'Segmento': t.segmentoNome || '—',
      'Total Alunos ERP': t.totalErp,
      'Conciliados (ERP + Isaac)': t.totalConciliados,
      'Na Gestão • Sem Isaac': t.totalSemIsaac,
      'Fora do Isaac': t.totalForaIsaac,
      'Com Parcelas Faltantes': t.totalComFaltantes,
      'Inadimplentes': t.totalInadimplentes,
      'Taxa Conciliação (%)': t.taxaConciliacaoPct,
      'Valor Contratado Isaac (R$)': Number((t.valorContratadoCentavos / 100).toFixed(2)),
      'Valor Pago Isaac (R$)': Number((t.valorPagoCentavos / 100).toFixed(2)),
    }))
    const wsTurmas = XLSX.utils.json_to_sheet(rowsTurmas)
    XLSX.utils.book_append_sheet(wb, wsTurmas, 'Resumo por Turma')

    XLSX.writeFile(wb, `Conciliacao_ISAAC_${data.ano}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // Export single student's installments to Excel
  const exportarAlunoExcel = (aluno: AlunoConciliacaoItem) => {
    const wb = XLSX.utils.book_new()
    const rows = (aluno.parcelas || []).map(p => ({
      'ID Parcela': p.id,
      'Categoria': p.produtoCategoria,
      'Produto': p.produtoNome,
      'Descrição': p.descricao,
      'Parcela':
        p.numeroParcela && p.totalParcelasDeclarado
          ? `${p.numeroParcela}/${p.totalParcelasDeclarado}`
          : '—',
      'Mês': p.mesSigla || '—',
      'Vencimento': formatDateBR(p.vencimento),
      'Status':
        p.status === 'PAID'
          ? 'PAGO'
          : p.status === 'OVERDUE'
          ? 'VENCIDO'
          : p.status === 'OPEN'
          ? 'A VENCER'
          : p.status,
      'Valor Efetivo (R$)': Number((p.valorEfetivoCentavos / 100).toFixed(2)),
      'Valor Pago (R$)': Number((p.valorPagoCentavos / 100).toFixed(2)),
      'Data Pagamento': formatDateBR(p.dataPagamento),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Parcelas do Aluno')
    const safeName = (aluno.nome || 'Aluno')
      .replace(/[^a-zA-Z0-9_\- ]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 35)
    XLSX.writeFile(wb, `Dossie_Isaac_${anoSelecionado}_${safeName}.xlsx`)
  }

  const totalAlunosComFaltantesRegra = useMemo(() => {
    if (!data?.kpis) return 0
    if (regraAuditoria === 'COM_MATRICULA') return data.kpis.totalComFaltantes12ComMat
    if (regraAuditoria === 'ESTRITO_12') return data.kpis.totalComFaltantes12Estrito
    return data.kpis.totalComFaltantes11FevDez
  }, [data, regraAuditoria])

  // Render badge for Conciliação status
  const renderConciliacaoBadge = (aluno: AlunoConciliacaoItem) => {
    if (aluno.conciliacaoStatus === 'CONCILIADO') {
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 999,
              background: '#ecfdf5',
              color: '#047857',
              border: '1px solid #a7f3d0',
              fontSize: 11,
              fontWeight: 700,
              width: 'fit-content',
            }}
          >
            <CheckCircle2 size={12} aria-hidden="true" /> Conciliado
          </span>
          {aluno.alertaDivergenciaId && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 7px',
                borderRadius: 999,
                background: '#fffbeb',
                color: '#b45309',
                border: '1px solid #fde68a',
                fontSize: 10,
                fontWeight: 700,
                width: 'fit-content',
              }}
            >
              <AlertTriangle size={10} aria-hidden="true" /> Nome (ID ≠)
            </span>
          )}
        </div>
      )
    }

    if (aluno.conciliacaoStatus === 'APENAS_ERP') {
      if (aluno.negociacao?.modalidadeIsaac === 'fora_isaac') {
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 999,
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              fontSize: 11,
              fontWeight: 700,
              width: 'fit-content',
            }}
          >
            <Building2 size={12} aria-hidden="true" /> Fora do Isaac
          </span>
        )
      }
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 999,
            background: '#fff1f2',
            color: '#be123c',
            border: '1px solid #fecdd3',
            fontSize: 11,
            fontWeight: 700,
            width: 'fit-content',
          }}
        >
          <UserX size={12} aria-hidden="true" /> Sem Isaac
        </span>
      )
    }

    if (aluno.conciliacaoStatus === 'INATIVO_COM_ISAAC') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 999,
            background: '#fef3c7',
            color: '#92400e',
            border: '1px solid #fde68a',
            fontSize: 11,
            fontWeight: 700,
            width: 'fit-content',
          }}
        >
          <AlertOctagon size={12} aria-hidden="true" /> Inativo c/ Isaac
        </span>
      )
    }

    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          borderRadius: 999,
          background: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe',
          fontSize: 11,
          fontWeight: 700,
          width: 'fit-content',
        }}
      >
        <HelpCircle size={12} aria-hidden="true" /> Só no Isaac
      </span>
    )
  }

  // Render a single compact square ("quadradinho pequeno" like Image 2)
  const renderQuadradinhoBox = (opts: {
    key: string | number
    topLabel: string
    bottomLabel: string
    variant: 'PAID' | 'OPEN' | 'OVERDUE' | 'CANCELED_ONLY' | 'MISSING' | 'EMPTY'
    title: string
    fixedWidth?: boolean
  }) => {
    let bg = '#f8fafc'
    let border = '#e2e8f0'
    let color = '#94a3b8'

    if (opts.variant === 'PAID') {
      bg = '#dcfce7'
      border = '#86efac'
      color = '#15803d'
    } else if (opts.variant === 'OVERDUE') {
      bg = '#ffe4e6'
      border = '#fda4af'
      color = '#be123c'
    } else if (opts.variant === 'OPEN') {
      bg = '#e0e7ff'
      border = '#a5b4fc'
      color = '#3730a3'
    } else if (opts.variant === 'CANCELED_ONLY') {
      bg = '#fef3c7'
      border = '#fcd34d'
      color = '#b45309'
    } else if (opts.variant === 'MISSING') {
      bg = '#fff1f2'
      border = '#fda4af'
      color = '#e11d48'
    }

    return (
      <div
        key={opts.key}
        title={opts.title}
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: opts.fixedWidth ? 40 : '100%',
          minWidth: opts.fixedWidth ? 40 : 0,
          height: 35,
          padding: '3px 2px',
          borderRadius: 7,
          background: bg,
          border: `1px solid ${border}`,
          color,
          lineHeight: 1.15,
          userSelect: 'none',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: '-0.01em' }}>{opts.topLabel}</span>
        <span style={{ fontSize: 8, fontWeight: 700, marginTop: 1 }}>{opts.bottomLabel}</span>
      </div>
    )
  }

  // Render installments always as compact little squares ("quadradinho pequeno igual imagem2")
  const renderMesesGridLimpo = (
    mesesGrid: MesAuditItem[],
    categoria: ProdutoCategoria,
    prod: ProdutoAlunoAudit,
    alunoParcelas: ParcelaConciliacaoDTO[]
  ) => {
    const isMonthlyProduct = categoria === 'MENSALIDADE' || categoria === 'INTEGRAL'
    if (!isMonthlyProduct) {
      const parcsProd = (alunoParcelas || [])
        .filter(p => p.produtoKey === prod.key && p.status !== 'CANCELED')
        .sort((a, b) => (a.numeroParcela || a.mesCompetencia || 0) - (b.numeroParcela || b.mesCompetencia || 0))
      const faltas = getDetalhesParcelasFaltantesProduto(prod, alunoParcelas, false)

      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {parcsProd.map((parc, idx) => {
            const isPaid = parc.status === 'PAID'
            const isOverdue = parc.status === 'OVERDUE'
            const topLabel =
              parc.mesSigla ||
              (parc.numeroParcela && parc.totalParcelasDeclarado
                ? `${parc.numeroParcela}/${parc.totalParcelasDeclarado}`
                : `${idx + 1}ª`)
            return renderQuadradinhoBox({
              key: parc.id,
              topLabel,
              bottomLabel: isPaid ? 'Pago' : isOverdue ? 'Venc' : 'Aberto',
              variant: isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : 'OPEN',
              title: `${parc.descricao} — Venc: ${formatDateBR(parc.vencimento)} (${parc.valorEfetivoFormatado})`,
              fixedWidth: true,
            })
          })}
          {faltas.map(f => {
            const topLabel = f.num >= 1 && f.num <= 12 ? MESES_CURTOS[f.num - 1] : `${f.num}ª`
            return renderQuadradinhoBox({
              key: `missing-${f.num}`,
              topLabel,
              bottomLabel: f.tipo === 'CANCELADA' ? 'Canc' : 'Falta',
              variant: f.tipo === 'CANCELADA' ? 'CANCELED_ONLY' : 'MISSING',
              title: `${prod.nome} — ${f.labelCurto}: ${
                f.tipo === 'CANCELADA' ? 'Parcela cancelada sem substituta' : 'Parcela faltante (não gerada)'
              }${f.detalheCancelada ? ` (${f.detalheCancelada})` : ''}`,
              fixedWidth: true,
            })
          })}
        </div>
      )
    }

    const missingSet = new Set<number>(getFaltantesMesesNumsProduto(prod))

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
          gap: 3.5,
          width: '100%',
        }}
      >
        {(mesesGrid || []).map(mg => {
          const isMissingInProd = missingSet.has(mg.mes)

          let variant: 'PAID' | 'OPEN' | 'OVERDUE' | 'CANCELED_ONLY' | 'MISSING' | 'EMPTY' = 'EMPTY'
          let statusSymbol = '—'
          let statusLabel = `${mg.nome} (${prod.nome}): Sem cobrança neste mês`

          if (mg.status === 'PAID') {
            variant = 'PAID'
            statusSymbol = 'Pago'
            statusLabel = `${mg.nome} (${prod.nome}): PAGO (${mg.valorFormatado})`
          } else if (mg.status === 'OVERDUE') {
            variant = 'OVERDUE'
            statusSymbol = 'Venc'
            statusLabel = `${mg.nome} (${prod.nome}): VENCIDO (${mg.valorFormatado})`
          } else if (mg.status === 'OPEN' || mg.status === 'RENEGOTIATED') {
            variant = 'OPEN'
            statusSymbol = 'Aberto'
            statusLabel = `${mg.nome} (${prod.nome}): A VENCER (${mg.valorFormatado})`
          } else if (mg.status === 'CANCELED_ONLY') {
            variant = 'CANCELED_ONLY'
            statusSymbol = 'Canc'
            statusLabel = `${mg.nome} (${prod.nome}): Parcela cancelada sem substituta ativa!`
          } else if (isMissingInProd) {
            variant = 'MISSING'
            statusSymbol = 'Falta'
            statusLabel = `${mg.nome} (${prod.nome}): PARCELA FALTANTE!`
          }

          return renderQuadradinhoBox({
            key: mg.mes,
            topLabel: mg.sigla,
            bottomLabel: statusSymbol,
            variant,
            title: statusLabel,
            fixedWidth: false,
          })
        })}
      </div>
    )
  }

  // Handle clicking on a month/installment (1..12) in the selector
  const handleSelectMesFaltante = (mesNum: number) => {
    setApenasComFaltantes(true)
    if (selecaoMultiplaMeses) {
      setFiltroMesesFaltantes(prev =>
        prev.includes(mesNum) ? prev.filter(m => m !== mesNum) : [...prev, mesNum]
      )
    } else {
      // Single-click direct selection: clicking a month isolates ONLY that month; clicking again returns to all missing
      setFiltroMesesFaltantes(prev => (prev.length === 1 && prev[0] === mesNum ? [] : [mesNum]))
    }
  }

  return (
    <div
      className="conciliacao-isaac-light-root"
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        color: '#0f172a',
        padding: '20px 20px 56px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        maxWidth: '100%',
        overflowX: 'hidden',
      }}
    >
      <style>{`
        .conciliacao-isaac-light-root select {
          width: auto;
        }
        .visually-hidden:where(:not(:focus-within, :active)) {
          position: absolute !important;
          clip-path: inset(50%) !important;
          overflow: hidden !important;
          width: 1px !important;
          height: 1px !important;
          margin: -1px !important;
          padding: 0 !important;
          border: 0 !important;
          white-space: nowrap !important;
        }
        .isaac-general-filter-row {
          display: grid;
          grid-template-columns: minmax(220px, 1.8fr) repeat(3, minmax(150px, 1fr)) auto;
          gap: 10px;
          align-items: end;
        }
        @media (max-width: 1100px) {
          .isaac-general-filter-row {
            grid-template-columns: repeat(2, minmax(160px, 1fr));
          }
        }
        @media (max-width: 680px) {
          .isaac-general-filter-row {
            grid-template-columns: 1fr;
          }
        }
        .isaac-filter-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .isaac-filter-label {
          font-size: 10.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #475569;
          padding-left: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .isaac-filter-control {
          width: 100% !important;
          height: 38px;
          padding: 0 11px;
          border-radius: 10px;
          border: 1px solid #cbd5e1;
          background-color: #f8fafc;
          color: #0f172a;
          font-size: 12.5px;
          font-weight: 600;
          transition: all 0.15s ease;
        }
        .isaac-filter-control:hover {
          border-color: #94a3b8;
          background-color: #ffffff;
        }
        .isaac-filter-control:focus-visible,
        .conciliacao-isaac-light-root button:focus-visible,
        .conciliacao-isaac-light-root select:focus-visible {
          outline: 2px solid #4f46e5;
          outline-offset: 2px;
        }

        /* Responsive Table Container (modern-web-guidance: responsive-table) */
        .isaac-table-container {
          container-type: inline-size;
          container-name: isaacTable;
          width: 100%;
          overflow-x: hidden;
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 20px -4px rgba(15, 23, 42, 0.04);
        }
        .isaac-table-container:focus-visible {
          outline: 2px solid #4f46e5;
          outline-offset: 2px;
        }
        .isaac-luxury-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
          text-align: left;
        }
        .isaac-luxury-table th {
          background: #f8fafc;
          color: #475569;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 12px 12px;
          border-bottom: 1px solid #e2e8f0;
          position: sticky;
          inset-block-start: 0;
          z-index: 2;
          white-space: normal !important;
        }
        .isaac-luxury-table td {
          padding: 12px 12px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          font-size: 12.5px;
          color: #1e293b;
          transition: background-color 0.15s ease;
          white-space: normal !important;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }
        .isaac-luxury-table tbody tr:hover td {
          background-color: #f8fafc;
        }
        .isaac-luxury-table tbody tr:last-child td {
          border-bottom: none;
        }

        .isaac-isolated-card {
          content-visibility: auto;
          contain-intrinsic-size: auto 76px;
        }

        @container isaacTable (max-width: 820px) {
          .hide-on-narrow-container {
            display: none;
          }
        }

        dialog.isaac-native-dialog:modal {
          overscroll-behavior: contain;
          border: 1px solid #e2e8f0;
          border-radius: 22px;
          padding: 0;
          width: min(1140px, 96vw);
          max-height: 90vh;
          background: #ffffff;
          color: #0f172a;
          box-shadow: 0 25px 60px -15px rgba(15, 23, 42, 0.25);
          margin: auto;
        }
        dialog.isaac-native-dialog::backdrop {
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          overflow: hidden;
          overscroll-behavior: contain;
        }

        @keyframes isaacSpin {
          100% { transform: rotate(360deg); }
        }
        .isaac-spin {
          animation: isaacSpin 1s linear infinite;
        }

        @media print {
          body * {
            visibility: hidden;
          }
          .conciliacao-isaac-light-root,
          .conciliacao-isaac-light-root * {
            visibility: visible;
          }
          .no-print {
            display: none !important;
          }
          .conciliacao-isaac-light-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: #ffffff !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header
        style={{
          background: '#ffffff',
          borderRadius: 18,
          border: '1px solid #e2e8f0',
          padding: '16px 20px',
          boxShadow: '0 4px 16px -6px rgba(15, 23, 42, 0.05)',
          marginBottom: 14,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0,
            }}
          >
            <ShieldCheck size={22} aria-hidden="true" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: '#eef2ff',
                  color: '#4f46e5',
                }}
              >
                Gestão Escolar × Isaac
              </span>
              {data?.meta?.fetchedAt && (
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                  Atualizado às{' '}
                  {new Date(data.meta.fetchedAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </div>
            <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#0f172a' }}>
              Conciliação & Auditoria de Parcelas ISAAC
            </h1>
          </div>
        </div>

        {/* Year selector, Sync & Export */}
        <div className="no-print" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
          <div
            role="group"
            aria-label="Selecionar Ano Letivo"
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f1f5f9',
              padding: 3,
              borderRadius: 10,
              border: '1px solid #e2e8f0',
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#475569',
                padding: '0 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Calendar size={13} color="#4f46e5" aria-hidden="true" /> Ano:
            </span>
            {anosDisponiveis.map(ano => {
              const active = ano === anoSelecionado
              return (
                <button
                  key={ano}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAnoSelecionado(ano)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 7,
                    border: active ? '1px solid #c7d2fe' : '1px solid transparent',
                    background: active ? '#ffffff' : 'transparent',
                    color: active ? '#4f46e5' : '#475569',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  {ano}
                </button>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => fetchConciliacao(anoSelecionado, true)}
            disabled={loading || refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 12px',
              borderRadius: 9,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: 12,
              fontWeight: 700,
              cursor: loading || refreshing ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={13} className={refreshing ? 'isaac-spin' : ''} color="#4f46e5" aria-hidden="true" />
            {refreshing ? 'Sincronizando...' : 'Sincronizar'}
          </button>

          <button
            type="button"
            onClick={exportarExcelCompleto}
            disabled={!data || loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 13px',
              borderRadius: 9,
              border: '1px solid #a7f3d0',
              background: '#ecfdf5',
              color: '#065f46',
              fontSize: 12,
              fontWeight: 800,
              cursor: !data || loading ? 'not-allowed' : 'pointer',
            }}
          >
            <FileSpreadsheet size={14} aria-hidden="true" />
            Exportar Excel
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={!data || loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '7px 11px',
              borderRadius: 9,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#475569',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <Printer size={13} aria-hidden="true" />
            Imprimir
          </button>
        </div>
      </header>

      {/* ── Error Banner ────────────────────────────────────────────────────── */}
      {(error || data?.isaacError) && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            borderRadius: 12,
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            color: '#be123c',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={17} aria-hidden="true" />
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{error || data?.isaacError}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchConciliacao(anoSelecionado, true)}
            style={{
              padding: '5px 11px',
              borderRadius: 8,
              border: '1px solid #fda4af',
              background: '#ffffff',
              color: '#be123c',
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Summary KPI Cards (Quick Filter Triggers) ───────────────────────── */}
      <div
        className="no-print"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        {/* Card 1: Total no Isaac */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('ALUNOS_AUDITORIA')
            setFiltroConciliacao('TODOS')
            setApenasComFaltantes(false)
            setFiltroMesesFaltantes([])
          }}
          style={{
            textAlign: 'left',
            background: '#ffffff',
            borderRadius: 14,
            padding: '12px 15px',
            border:
              activeTab === 'ALUNOS_AUDITORIA' &&
              filtroConciliacao === 'TODOS' &&
              !apenasComFaltantes &&
              filtroMesesFaltantes.length === 0
                ? '2px solid #4f46e5'
                : '1px solid #e2e8f0',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Alunos no Isaac ({anoSelecionado})
            </span>
            <Users size={15} color="#4f46e5" aria-hidden="true" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#0f172a' }}>
            {loading ? '...' : data?.kpis.totalAlunosIsaac ?? 0}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            <b style={{ color: '#4f46e5' }}>{data?.kpis.totalParcelasAnoIsaac ?? 0}</b> parcelas ativas
          </div>
        </button>

        {/* Card 2: Com Parcelas Faltantes (Highlight) */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('ALUNOS_AUDITORIA')
            setFiltroConciliacao('TODOS')
            setApenasComFaltantes(true)
            setModoFocoExclusivo(true)
          }}
          style={{
            textAlign: 'left',
            background: apenasComFaltantes || filtroMesesFaltantes.length > 0 ? '#fff1f2' : '#ffffff',
            borderRadius: 14,
            padding: '12px 15px',
            border:
              apenasComFaltantes || filtroMesesFaltantes.length > 0
                ? '2px solid #e11d48'
                : '1px solid #fecdd3',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#be123c', textTransform: 'uppercase' }}>
              Com Parcelas Faltantes
            </span>
            <AlertTriangle size={15} color="#e11d48" aria-hidden="true" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#be123c' }}>
            {loading ? '...' : totalAlunosComFaltantesRegra}
          </div>
          <div style={{ fontSize: 11, color: '#9f1239', marginTop: 2, fontWeight: 600 }}>
            Clique para filtrar faltantes
          </div>
        </button>

        {/* Card 3: Conciliados ERP + Isaac */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('ALUNOS_AUDITORIA')
            setFiltroConciliacao('CONCILIADO')
            setApenasComFaltantes(false)
            setFiltroMesesFaltantes([])
          }}
          style={{
            textAlign: 'left',
            background: '#ffffff',
            borderRadius: 14,
            padding: '12px 15px',
            border: filtroConciliacao === 'CONCILIADO' ? '2px solid #10b981' : '1px solid #e2e8f0',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Conciliados (ERP + Isaac)
            </span>
            <UserCheck size={15} color="#059669" aria-hidden="true" />
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#047857' }}>
              {loading ? '...' : data?.kpis.totalConciliados ?? 0}
            </span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#059669', background: '#d1fae5', padding: '1px 6px', borderRadius: 999 }}>
              {data?.kpis.taxaConciliacaoPct ?? 0}%
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            De {data?.kpis.totalMatriculadosErp ?? 0} na Gestão
          </div>
        </button>

        {/* Card 4: Na Gestão • Sem Isaac */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('CONCILIACAO_ERP')
            setFiltroConciliacao('APENAS_ERP')
            setFiltroCategoriaProduto('TODOS')
            setFiltroStatusFinanceiro('TODOS')
            setApenasComFaltantes(false)
            setFiltroMesesFaltantes([])
          }}
          style={{
            textAlign: 'left',
            background: filtroConciliacao.startsWith('APENAS_ERP') ? '#fffbeb' : '#ffffff',
            borderRadius: 14,
            padding: '12px 15px',
            border: filtroConciliacao.startsWith('APENAS_ERP') ? '2px solid #f59e0b' : '1px solid #e2e8f0',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Na Gestão • Sem Isaac
            </span>
            <UserX size={15} color="#d97706" aria-hidden="true" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#b45309' }}>
            {loading ? '...' : data?.kpis.totalApenasErp ?? 0}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            <b style={{ color: '#be123c' }}>{data?.kpis.totalApenasErpPendentes ?? 0} pend.</b> •{' '}
            {data?.kpis.totalApenasErpForaIsaac ?? 0} fora Isaac
          </div>
        </button>

        {/* Card 5: Só no Isaac / Inativos ERP */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('CONCILIACAO_ERP')
            setFiltroConciliacao('APENAS_ISAAC_OU_INATIVO')
            setApenasComFaltantes(false)
            setFiltroMesesFaltantes([])
          }}
          style={{
            textAlign: 'left',
            background: '#ffffff',
            borderRadius: 14,
            padding: '12px 15px',
            border:
              filtroConciliacao === 'APENAS_ISAAC_OU_INATIVO' ||
              filtroConciliacao === 'APENAS_ISAAC' ||
              filtroConciliacao === 'INATIVO_COM_ISAAC'
                ? '2px solid #2563eb'
                : '1px solid #e2e8f0',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Só no Isaac / Inativos
            </span>
            <HelpCircle size={15} color="#2563eb" aria-hidden="true" />
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#1d4ed8' }}>
            {loading ? '...' : data?.kpis.totalApenasIsaac ?? 0}
          </div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            <b>{data?.kpis.totalSomenteIsaacSemErp ?? 0}</b> sem ERP •{' '}
            <b>{data?.kpis.totalInativoErpComIsaac ?? 0}</b> inativos
          </div>
        </button>
      </div>

      {/* ── Simplified Navigation Tabs (3 Clear Views) ──────────────────────── */}
      <nav
        aria-label="Visões da Conciliação"
        className="no-print"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            background: '#ffffff',
            padding: 5,
            borderRadius: 12,
            border: '1px solid #e2e8f0',
          }}
        >
          {[
            {
              id: 'ALUNOS_AUDITORIA' as ActiveTab,
              label: 'Alunos & Auditoria de Parcelas',
              icon: <Package size={14} aria-hidden="true" />,
              badge: data?.kpis.totalAlunosIsaac ?? 0,
            },
            {
              id: 'CONCILIACAO_ERP' as ActiveTab,
              label: 'Conciliação Gestão × Isaac (Todos os Alunos)',
              icon: <ShieldCheck size={14} aria-hidden="true" />,
              badge: data?.alunos?.length ?? 0,
            },
            {
              id: 'TURMAS_RESUMO' as ActiveTab,
              label: 'Resumo por Turma',
              icon: <Layers size={14} aria-hidden="true" />,
              badge: data?.resumoPorTurma?.length ?? 0,
            },
          ].map(tab => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '8px 14px',
                  borderRadius: 9,
                  border: active ? '1px solid #4f46e5' : '1px solid transparent',
                  background: active ? '#4f46e5' : 'transparent',
                  color: active ? '#ffffff' : '#475569',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  style={{
                    padding: '1px 7px',
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: 800,
                    background: active ? 'rgba(255,255,255,0.22)' : '#f1f5f9',
                    color: active ? '#ffffff' : '#475569',
                  }}
                >
                  {tab.badge}
                </span>
              </button>
            )
          })}
        </div>

        {/* Volume Summary Pill */}
        {data?.kpis && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: '#ffffff',
              padding: '7px 14px',
              borderRadius: 11,
              border: '1px solid #e2e8f0',
              fontSize: 11.5,
              color: '#475569',
            }}
          >
            <span>
              Contratado: <b style={{ color: '#0f172a' }}>{data.kpis.volumeTotalContratadoFormatado}</b>
            </span>
            <span>•</span>
            <span>
              Pago: <b style={{ color: '#047857' }}>{data.kpis.volumeTotalPagoFormatado}</b>
            </span>
            <span>•</span>
            <span>
              Vencido: <b style={{ color: '#be123c' }}>{data.kpis.volumeTotalVencidoFormatado}</b>
            </span>
          </div>
        )}
      </nav>

      {/* ── Organized 2-Step Filter Panel (For Student & Product Views) ──────── */}
      {activeTab !== 'TURMAS_RESUMO' && (
        <section
          aria-label="Filtros de Pesquisa e Auditoria de Parcelas"
          className="no-print"
          style={{
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            padding: '16px',
            marginBottom: 14,
            boxShadow: '0 2px 12px rgba(15, 23, 42, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* BLOCK 1: General Student Filters (Search, Class, Reconciliation, Financial Status) */}
          <div className="isaac-general-filter-row">
            {/* Search Input */}
            <div className="isaac-filter-field">
              <label htmlFor="isaac-search-input" className="isaac-filter-label">
                Busca Rápida de Aluno
              </label>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search
                  size={14}
                  color="#94a3b8"
                  aria-hidden="true"
                  style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                />
                <input
                  id="isaac-search-input"
                  name="busca"
                  type="text"
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  placeholder="Nome, ID ERP, ID Isaac, responsável, CPF..."
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="isaac-filter-control"
                  style={{ paddingLeft: 32, paddingRight: busca ? 28 : 11 }}
                />
                {busca && (
                  <button
                    type="button"
                    onClick={() => setBusca('')}
                    aria-label="Limpar busca"
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      border: 'none',
                      background: 'transparent',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            {/* Class Filter */}
            <div className="isaac-filter-field">
              <label htmlFor="isaac-turma-select" className="isaac-filter-label">
                Turma / Série
              </label>
              <select
                id="isaac-turma-select"
                name="turma"
                value={filtroTurma}
                onChange={e => setFiltroTurma(e.target.value)}
                className="isaac-filter-control"
                style={{
                  cursor: 'pointer',
                  borderColor: filtroTurma !== 'TODAS' ? '#6366f1' : undefined,
                  backgroundColor: filtroTurma !== 'TODAS' ? '#eef2ff' : undefined,
                }}
              >
                <option value="TODAS">Todas as Turmas ({turmasLista.length})</option>
                {turmasLista.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Reconciliation Status Filter */}
            <div className="isaac-filter-field">
              <label htmlFor="isaac-vinculo-select" className="isaac-filter-label">
                Vínculo Gestão × Isaac
              </label>
              <select
                id="isaac-vinculo-select"
                name="vinculo"
                value={filtroConciliacao}
                onChange={e => {
                  const val = e.target.value
                  setFiltroConciliacao(val)
                  if (val.startsWith('APENAS_ERP')) {
                    setFiltroCategoriaProduto('TODOS')
                    setFiltroStatusFinanceiro('TODOS')
                    setApenasComFaltantes(false)
                    setFiltroMesesFaltantes([])
                  }
                }}
                className="isaac-filter-control"
                style={{
                  cursor: 'pointer',
                  borderColor: filtroConciliacao !== 'TODOS' ? '#6366f1' : undefined,
                  backgroundColor: filtroConciliacao !== 'TODOS' ? '#eef2ff' : undefined,
                }}
              >
                <option value="TODOS">Todos os Vínculos</option>
                <option value="CONCILIADO">✓ Conciliados (ERP + Isaac) ({data?.kpis.totalConciliados ?? 0})</option>
                <option value="APENAS_ERP">⚠ Na Gestão • Sem Isaac ({data?.kpis.totalApenasErp ?? 0})</option>
                <option value="APENAS_ERP_PENDENTE">🚨 Na Gestão • Pendente Lançar ({data?.kpis.totalApenasErpPendentes ?? 0})</option>
                <option value="APENAS_ERP_FORA_ISAAC">🏢 Na Gestão • Fora do Isaac ({data?.kpis.totalApenasErpForaIsaac ?? 0})</option>
                <option value="APENAS_ISAAC_OU_INATIVO">🔵 Só no Isaac + Inativos ERP ({data?.kpis.totalApenasIsaac ?? 0})</option>
                <option value="APENAS_ISAAC">❓ Somente no Isaac • Sem ERP ({data?.kpis.totalSomenteIsaacSemErp ?? 0})</option>
                <option value="INATIVO_COM_ISAAC">⛔ Inativo no ERP c/ Isaac ({data?.kpis.totalInativoErpComIsaac ?? 0})</option>
              </select>
            </div>

            {/* Financial Status Filter */}
            <div className="isaac-filter-field">
              <label htmlFor="isaac-situacao-select" className="isaac-filter-label">
                Situação Financeira
              </label>
              <select
                id="isaac-situacao-select"
                name="situacao"
                value={filtroStatusFinanceiro}
                onChange={e => setFiltroStatusFinanceiro(e.target.value)}
                className="isaac-filter-control"
                style={{
                  cursor: 'pointer',
                  borderColor: filtroStatusFinanceiro !== 'TODOS' ? '#6366f1' : undefined,
                  backgroundColor: filtroStatusFinanceiro !== 'TODOS' ? '#eef2ff' : undefined,
                }}
              >
                <option value="TODOS">Todas as Situações</option>
                <option value="EM_DIA">Adimplentes (Em Dia)</option>
                <option value="INADIMPLENTE">Inadimplentes (Com Atraso)</option>
                <option value="QUITADO">100% Quitados no Ano</option>
              </select>
            </div>

            {/* Clear All Filters Button */}
            <div style={{ display: 'flex', alignItems: 'center', height: 38 }}>
              {possuiFiltroAtivo && (
                <button
                  type="button"
                  onClick={limparTodosFiltros}
                  style={{
                    height: 38,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: '1px solid #fecdd3',
                    background: '#fff1f2',
                    color: '#be123c',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <X size={14} aria-hidden="true" />
                  Limpar Filtros ({alunosFiltrados.length})
                </button>
              )}
            </div>
          </div>

          {/* BLOCK 2: Dedicated Sub-Filter for "Na Gestão • Sem Isaac" OR Unified Product & Missing Installment Selector */}
          {filtroConciliacao.startsWith('APENAS_ERP') ? (
            <div
              style={{
                background: '#fffbeb',
                borderRadius: 14,
                border: '1px solid #fde68a',
                padding: '12px 14px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <UserX size={16} color="#d97706" aria-hidden="true" />
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#92400e' }}>
                  Alunos cadastrados no ERP sem cobranças ativas no Isaac em {anoSelecionado}:
                </span>
                {[
                  {
                    id: 'APENAS_ERP',
                    label: `Todos no ERP sem Isaac (${data?.kpis.totalApenasErp ?? 0})`,
                  },
                  {
                    id: 'APENAS_ERP_PENDENTE',
                    label: `Pendentes de Lançar no Isaac (${data?.kpis.totalApenasErpPendentes ?? 0})`,
                  },
                  {
                    id: 'APENAS_ERP_FORA_ISAAC',
                    label: `Negociação Fora do Isaac (${data?.kpis.totalApenasErpForaIsaac ?? 0})`,
                  },
                ].map(opt => {
                  const active = filtroConciliacao === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setFiltroConciliacao(opt.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: active ? '1.5px solid #d97706' : '1px solid #fcd34d',
                        background: active ? '#d97706' : '#ffffff',
                        color: active ? '#ffffff' : '#92400e',
                        fontSize: 11.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('ALUNOS_AUDITORIA')
                  setFiltroConciliacao('TODOS')
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Voltar p/ Auditoria de Produtos no Isaac
              </button>
            </div>
          ) : (
          <div
            style={{
              background: '#f8fafc',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Row 1: Product Pills + Missing Installments Quick Controls */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              {/* Product Pills */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    color: '#475569',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    marginRight: 2,
                  }}
                >
                  Produto:
                </span>
                {[
                  { id: 'TODOS', label: 'Todos' },
                  { id: 'MENSALIDADE', label: 'Mensalidade' },
                  { id: 'MATRICULA', label: 'Matrícula' },
                  { id: 'INTEGRAL', label: 'Integral' },
                  { id: 'MATERIAL', label: 'Material' },
                  { id: 'SEM_MENSALIDADE', label: 'Sem Mensalidade' },
                ].map(item => {
                  const active = filtroCategoriaProduto === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setFiltroCategoriaProduto(item.id)
                        if (item.id !== 'TODOS') {
                          setModoFocoExclusivo(true)
                        }
                      }}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 7,
                        border: active ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                        background: active ? '#4f46e5' : '#ffffff',
                        color: active ? '#ffffff' : '#334155',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        transition: 'all 0.12s ease',
                      }}
                    >
                      {item.label}
                    </button>
                  )
                })}

                {produtosEspecificosLista.length > 0 && (
                  <select
                    aria-label="Selecionar produto específico pelo nome no Isaac"
                    value={filtroCategoriaProduto.startsWith('NOME:') ? filtroCategoriaProduto : ''}
                    onChange={e => {
                      if (e.target.value) {
                        setFiltroCategoriaProduto(e.target.value)
                        setModoFocoExclusivo(true)
                      } else {
                        setFiltroCategoriaProduto('TODOS')
                      }
                    }}
                    style={{
                      height: 29,
                      padding: '0 8px',
                      borderRadius: 7,
                      border: filtroCategoriaProduto.startsWith('NOME:')
                        ? '1.5px solid #4f46e5'
                        : '1px solid #cbd5e1',
                      background: filtroCategoriaProduto.startsWith('NOME:') ? '#eef2ff' : '#ffffff',
                      color: filtroCategoriaProduto.startsWith('NOME:') ? '#3730a3' : '#475569',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      maxWidth: 195,
                    }}
                  >
                    <option value="">Outros produtos...</option>
                    {produtosEspecificosLista.map(p => (
                      <option key={p.nome} value={`NOME:${p.nome}`}>
                        {p.nome} ({p.count})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Right Controls: All vs Missing + Fault Type + Rule */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <div
                  role="group"
                  aria-label="Filtro de parcelas"
                  style={{
                    display: 'inline-flex',
                    background: '#ffffff',
                    padding: 2,
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <button
                    type="button"
                    aria-pressed={!apenasComFaltantes && filtroMesesFaltantes.length === 0}
                    onClick={() => {
                      setApenasComFaltantes(false)
                      setFiltroMesesFaltantes([])
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background:
                        !apenasComFaltantes && filtroMesesFaltantes.length === 0 ? '#4f46e5' : 'transparent',
                      color:
                        !apenasComFaltantes && filtroMesesFaltantes.length === 0 ? '#ffffff' : '#475569',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Todas Parcelas
                  </button>
                  <button
                    type="button"
                    aria-pressed={apenasComFaltantes || filtroMesesFaltantes.length > 0}
                    onClick={() => {
                      setApenasComFaltantes(true)
                      setModoFocoExclusivo(true)
                    }}
                    style={{
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: 'none',
                      background:
                        apenasComFaltantes || filtroMesesFaltantes.length > 0 ? '#e11d48' : 'transparent',
                      color:
                        apenasComFaltantes || filtroMesesFaltantes.length > 0 ? '#ffffff' : '#be123c',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    Só Faltantes
                  </button>
                </div>

                {/* Fault Type */}
                <div
                  role="group"
                  aria-label="Tipo de falta"
                  style={{
                    display: 'inline-flex',
                    background: '#ffffff',
                    padding: 2,
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  {[
                    { id: 'TODAS' as const, label: 'Falta + Canc' },
                    { id: 'NAO_GERADA' as const, label: 'Só Falta' },
                    { id: 'CANCELADA' as const, label: 'Só Canc' },
                  ].map(tp => {
                    const active = filtroTipoFalta === tp.id
                    return (
                      <button
                        key={tp.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setFiltroTipoFalta(tp.id)
                          if (tp.id !== 'TODAS') setApenasComFaltantes(true)
                        }}
                        style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          border: 'none',
                          background: active ? '#f1f5f9' : 'transparent',
                          color: active ? '#0f172a' : '#64748b',
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {tp.label}
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  aria-pressed={selecaoMultiplaMeses}
                  onClick={() => setSelecaoMultiplaMeses(v => !v)}
                  title="Selecionar vários meses ao mesmo tempo"
                  style={{
                    padding: '4px 8px',
                    borderRadius: 7,
                    border: selecaoMultiplaMeses ? '1px solid #6366f1' : '1px solid #cbd5e1',
                    background: selecaoMultiplaMeses ? '#eef2ff' : '#ffffff',
                    color: selecaoMultiplaMeses ? '#4338ca' : '#475569',
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {selecaoMultiplaMeses ? 'Multi-mês: ON' : 'Multi-mês'}
                </button>

                {(filtroCategoriaProduto === 'TODOS' || filtroCategoriaProduto === 'MENSALIDADE') && (
                  <select
                    aria-label="Regra de auditoria de mensalidades"
                    value={regraAuditoria}
                    onChange={e => setRegraAuditoria(e.target.value as RegraAuditoria)}
                    style={{
                      height: 28,
                      padding: '0 7px',
                      borderRadius: 7,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#334155',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    <option value="COM_MATRICULA">FEV–DEZ + Mat.</option>
                    <option value="FEV_DEZ_11">11m (FEV–DEZ)</option>
                    <option value="ESTRITO_12">12m (JAN–DEZ)</option>
                  </select>
                )}
              </div>
            </div>

            {/* Row 2: Compact Month Mini-Squares Selector (JAN .. DEZ) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(86px, 1.1fr) repeat(12, minmax(0, 1fr))',
                gap: 5,
              }}
            >
              <button
                type="button"
                aria-pressed={apenasComFaltantes && filtroMesesFaltantes.length === 0}
                onClick={() => {
                  setApenasComFaltantes(true)
                  setFiltroMesesFaltantes([])
                  setModoFocoExclusivo(true)
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 38,
                  padding: '3px 4px',
                  borderRadius: 8,
                  border:
                    apenasComFaltantes && filtroMesesFaltantes.length === 0
                      ? '1.5px solid #e11d48'
                      : '1px solid #cbd5e1',
                  background:
                    apenasComFaltantes && filtroMesesFaltantes.length === 0 ? '#ffe4e6' : '#ffffff',
                  color:
                    apenasComFaltantes && filtroMesesFaltantes.length === 0 ? '#9f1239' : '#475569',
                  cursor: 'pointer',
                  lineHeight: 1.1,
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 800 }}>Qualquer</span>
                <span style={{ fontSize: 8.5, fontWeight: 700, color: '#be123c', marginTop: 1 }}>
                  Faltante
                </span>
              </button>

              {MESES_CURTOS.map((sigla, idx) => {
                const mesNum = idx + 1
                const isSelected = filtroMesesFaltantes.includes(mesNum)
                const qtdAlunosFaltando = contagemFaltantesPorMes[mesNum] || 0

                return (
                  <button
                    key={mesNum}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectMesFaltante(mesNum)}
                    title={`Filtrar falta em ${MESES_NOMES[idx]} (${qtdAlunosFaltando} alunos)`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: 38,
                      padding: '3px 2px',
                      borderRadius: 8,
                      border: isSelected
                        ? '1.5px solid #e11d48'
                        : qtdAlunosFaltando > 0
                        ? '1px solid #fda4af'
                        : '1px solid #e2e8f0',
                      background: isSelected
                        ? '#e11d48'
                        : qtdAlunosFaltando > 0
                        ? '#fff1f2'
                        : '#ffffff',
                      color: isSelected
                        ? '#ffffff'
                        : qtdAlunosFaltando > 0
                        ? '#9f1239'
                        : '#94a3b8',
                      cursor: 'pointer',
                      lineHeight: 1.1,
                      minWidth: 0,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 800 }}>{sigla}</span>
                    <span
                      style={{
                        fontSize: 8.5,
                        fontWeight: 700,
                        marginTop: 1,
                        color: isSelected
                          ? '#ffffff'
                          : qtdAlunosFaltando > 0
                          ? '#be123c'
                          : '#94a3b8',
                      }}
                    >
                      {qtdAlunosFaltando} al.
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
          )}
        </section>
      )}

      {/* ── Sleek Single Status & Visual Legend Bar ─────────────────────────── */}
      {!loading && activeTab !== 'TURMAS_RESUMO' && (
        <div
          className="no-print"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            padding: '7px 14px',
            marginBottom: 8,
            borderRadius: 10,
            background: '#ffffff',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
              Exibindo <b style={{ color: '#4f46e5' }}>{alunosFiltrados.length}</b> registros em{' '}
              <b>{anoSelecionado}</b>
              {filtroCategoriaProduto !== 'TODOS' && (
                <>
                  {' '}• <b style={{ color: '#3730a3' }}>{nomeProdutoFiltroAtivo}</b>
                </>
              )}
              {filtroMesesFaltantes.length > 0 ? (
                <>
                  {' '}• Falta em:{' '}
                  <b style={{ color: '#be123c' }}>
                    {filtroMesesFaltantes
                      .slice()
                      .sort((a, b) => a - b)
                      .map(m => MESES_CURTOS[m - 1])
                      .join(', ')}
                  </b>
                </>
              ) : apenasComFaltantes ? (
                <>
                  {' '}• <b style={{ color: '#be123c' }}>Somente com Faltantes</b>
                </>
              ) : null}
            </span>

            {(filtroCategoriaProduto !== 'TODOS' ||
              apenasComFaltantes ||
              filtroMesesFaltantes.length > 0) &&
              !filtroConciliacao.startsWith('APENAS_ERP') && (
                <button
                  type="button"
                  aria-pressed={modoFocoExclusivo}
                  onClick={() => setModoFocoExclusivo(v => !v)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '3px 9px',
                    borderRadius: 6,
                    border: modoFocoExclusivo ? '1px solid #4f46e5' : '1px solid #cbd5e1',
                    background: modoFocoExclusivo ? '#eef2ff' : '#f8fafc',
                    color: modoFocoExclusivo ? '#4338ca' : '#475569',
                    fontSize: 10.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <CheckCircle2 size={11} aria-hidden="true" />
                  {modoFocoExclusivo ? 'Foco Exclusivo: ON' : 'Foco Exclusivo: OFF'}
                </button>
              )}
          </div>

          {/* Mini-Square Visual Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, fontSize: 10.5, fontWeight: 700, color: '#64748b' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#dcfce7', border: '1px solid #86efac' }} />
              Pago
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#e0e7ff', border: '1px solid #a5b4fc' }} />
              Aberto
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#ffe4e6', border: '1px solid #fda4af' }} />
              Venc
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#fef3c7', border: '1px solid #fcd34d' }} />
              Canc
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#fff1f2', border: '1px solid #fda4af' }} />
              Falta
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#f8fafc', border: '1px solid #cbd5e1' }} />
              — Sem Cobrança
            </span>
          </div>
        </div>
      )}

      {/* ── Loading Skeleton ────────────────────────────────────────────────── */}
      {loading && (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 18,
            border: '1px solid #e2e8f0',
            padding: '56px 24px',
            textAlign: 'center',
          }}
        >
          <RefreshCw size={32} color="#4f46e5" className="isaac-spin" style={{ marginBottom: 12 }} aria-hidden="true" />
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
            Consultando e conciliando base do Isaac ({anoSelecionado})...
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Organizando produtos contratados e auditando parcelas por aluno.
          </div>
        </div>
      )}

      {/* ── MAIN TABLE: Students, Products & Focused Missing Installments ─────── */}
      {!loading && (activeTab === 'ALUNOS_AUDITORIA' || activeTab === 'CONCILIACAO_ERP') && (
        <div
          className="isaac-table-container"
          tabIndex={0}
          role="region"
          aria-labelledby="isaac-main-table-caption"
        >
          <table className="isaac-luxury-table">
            <caption id="isaac-main-table-caption" className="visually-hidden">
              Tabela de conciliação e auditoria de parcelas do Isaac ({anoSelecionado})
            </caption>
            <colgroup>
              <col style={{ width: '21%' }} />
              <col style={{ width: '15%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '31%' }} />
              <col className="hide-on-narrow-container" style={{ width: '9%' }} />
              <col style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Aluno & Identificação</th>
                <th scope="col">Turma & Conciliação</th>
                <th scope="col">
                  {modoFocoExclusivo && filtroCategoriaProduto !== 'TODOS'
                    ? `Produto (${nomeProdutoFiltroAtivo})`
                    : 'Produtos no Isaac'}
                </th>
                <th scope="col">
                  {estaEmModoFocoParcelaFaltante
                    ? filtroMesesFaltantes.length > 0
                      ? `Parcela Faltante (${filtroMesesFaltantes.map(m => MESES_CURTOS[m - 1]).join(', ')})`
                      : `Parcelas Faltantes`
                    : 'Grade de Parcelas (JAN–DEZ)'}
                </th>
                <th scope="col" className="hide-on-narrow-container">
                  {modoFocoExclusivo &&
                  (filtroCategoriaProduto !== 'TODOS' || apenasComFaltantes || filtroMesesFaltantes.length > 0)
                    ? 'Valor Produto'
                    : `Financeiro (${anoSelecionado})`}
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {alunosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                    Nenhum aluno encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                alunosFiltrados.map(aluno => {
                  const prodsVisiveis = getProdutosVisiveisAluno(aluno)

                  // Calculate financial totals for visible products when in Focus Mode
                  const usarSomaProdutosVisiveis =
                    modoFocoExclusivo &&
                    prodsVisiveis.length > 0 &&
                    (filtroCategoriaProduto !== 'TODOS' ||
                      apenasComFaltantes ||
                      filtroMesesFaltantes.length > 0)

                  const valorContratadoExibido = usarSomaProdutosVisiveis
                    ? prodsVisiveis.reduce((acc, p) => acc + p.valorContratadoCentavos, 0)
                    : aluno.valorTotalContratadoCentavos
                  const valorPagoExibido = usarSomaProdutosVisiveis
                    ? prodsVisiveis.reduce((acc, p) => acc + p.valorPagoCentavos, 0)
                    : aluno.valorTotalPagoCentavos
                  const valorVencidoExibido = usarSomaProdutosVisiveis
                    ? prodsVisiveis.reduce((acc, p) => acc + p.valorVencidoCentavos, 0)
                    : aluno.valorTotalVencidoCentavos

                  const formatBRL = (centavos: number) =>
                    (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

                  return (
                    <tr key={aluno.key} className="isaac-isolated-card">
                      {/* Col 1: Student & Guardian */}
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 12.5, lineHeight: 1.25 }}>
                          {aluno.nome}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 3, fontSize: 10 }}>
                          {aluno.erpId && (
                            <span style={{ background: '#f1f5f9', color: '#475569', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                              ERP: {aluno.erpId}
                            </span>
                          )}
                          {aluno.isaacExternalId && (
                            <span style={{ background: '#eef2ff', color: '#4338ca', padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                              Isaac: {aluno.isaacExternalId}
                            </span>
                          )}
                        </div>
                        <div
                          title={aluno.responsavelNome || ''}
                          style={{
                            fontSize: 10.5,
                            color: '#64748b',
                            marginTop: 3,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          Resp.: <b style={{ color: '#334155' }}>{aluno.responsavelNome || '—'}</b>
                        </div>
                      </td>

                      {/* Col 2: Turma + Conciliação Status */}
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 800, color: '#1e293b', fontSize: 11.5, lineHeight: 1.2 }}>
                          {aluno.turmaNome || 'Sem Turma'}
                        </div>
                        <div style={{ fontSize: 10, color: '#64748b', marginTop: 2, marginBottom: 4 }}>
                          {aluno.estaNoErp
                            ? `${aluno.statusErp} • ${aluno.segmentoNome || aluno.serieNome}`
                            : 'Apenas base Isaac'}
                        </div>
                        {renderConciliacaoBadge(aluno)}
                      </td>

                      {/* Col 3 & Col 4 Paired 1-to-1: Compact Single-Line Product + Mini-Square Installments ("quadradinho pequeno") */}
                      <td colSpan={2} style={{ padding: '8px 12px' }}>
                        {!aluno.possuiParcelasAtivasIsaac ? (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(0, 36.7%) minmax(0, 63.3%)',
                              gap: 10,
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  padding: '4px 9px',
                                  borderRadius: 7,
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  background: aluno.possuiApenasCanceladasIsaac
                                    ? '#fef3c7'
                                    : aluno.negociacao?.modalidadeIsaac === 'fora_isaac'
                                    ? '#f1f5f9'
                                    : '#fff1f2',
                                  color: aluno.possuiApenasCanceladasIsaac
                                    ? '#b45309'
                                    : aluno.negociacao?.modalidadeIsaac === 'fora_isaac'
                                    ? '#475569'
                                    : '#be123c',
                                  border: aluno.possuiApenasCanceladasIsaac
                                    ? '1px solid #fcd34d'
                                    : aluno.negociacao?.modalidadeIsaac === 'fora_isaac'
                                    ? '1px solid #cbd5e1'
                                    : '1px solid #fecdd3',
                                }}
                              >
                                {aluno.possuiApenasCanceladasIsaac
                                  ? `Todas canceladas (${aluno.totalParcelasCanceladas})`
                                  : aluno.negociacao?.modalidadeIsaac === 'fora_isaac'
                                  ? 'Pagamento Fora do Isaac'
                                  : `Sem cobranças no Isaac (${anoSelecionado})`}
                              </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: 11, color: '#334155', fontWeight: 700 }}>
                                {aluno.resumoAuditoriaParcelas}
                              </span>
                              {aluno.negociacao?.resumoValores && (
                                <span style={{ fontSize: 10, color: '#64748b' }}>
                                  Negociação ({aluno.negociacao.protocolo}): {aluno.negociacao.resumoValores}
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (filtroCategoriaProduto === 'SEM_MENSALIDADE' && !aluno.temMensalidade) ||
                          (filtroCategoriaProduto === 'SEM_MATRICULA' && !aluno.temMatricula) ? (
                          <div
                            style={{
                              padding: '6px 10px',
                              borderRadius: 8,
                              background: '#fff1f2',
                              border: '1px solid #fecdd3',
                              color: '#be123c',
                              fontSize: 11.5,
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <AlertTriangle size={13} aria-hidden="true" />
                            <span>
                              {filtroCategoriaProduto === 'SEM_MENSALIDADE'
                                ? 'Sem Mensalidade lançada no Isaac'
                                : 'Sem Matrícula lançada no Isaac'}
                            </span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {prodsVisiveis.map((prod, idx) => {
                              const catBadge = getCategoryBadgeStyle(prod.categoria)
                              const faltasDetalhadas = getDetalhesParcelasFaltantesProduto(
                                prod,
                                aluno.parcelas || [],
                                modoFocoExclusivo && filtroMesesFaltantes.length > 0
                              )
                              const todasFaltasProd = getDetalhesParcelasFaltantesProduto(
                                prod,
                                aluno.parcelas || [],
                                false
                              )
                              const qtdOutrasFaltasOcultas = Math.max(
                                0,
                                todasFaltasProd.length - faltasDetalhadas.length
                              )

                              return (
                                <div
                                  key={prod.key}
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 36.7%) minmax(0, 63.3%)',
                                    gap: 10,
                                    alignItems: 'center',
                                    paddingBottom: idx < prodsVisiveis.length - 1 ? 6 : 0,
                                    borderBottom:
                                      idx < prodsVisiveis.length - 1 ? '1px dashed #f1f5f9' : 'none',
                                  }}
                                >
                                  {/* Col 3: Clean Single-Line Product Pill */}
                                  <div
                                    title={prod.nome}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 6,
                                      height: 35,
                                      padding: '0 9px',
                                      borderRadius: 8,
                                      background: '#f8fafc',
                                      border: '1px solid #e2e8f0',
                                      minWidth: 0,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1 }}>
                                      <span
                                        style={{
                                          fontSize: 9,
                                          fontWeight: 800,
                                          padding: '1px 5px',
                                          borderRadius: 4,
                                          background: catBadge.bg,
                                          color: catBadge.color,
                                          border: `1px solid ${catBadge.border}`,
                                          textTransform: 'uppercase',
                                          flexShrink: 0,
                                        }}
                                      >
                                        {catBadge.label}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 11.5,
                                          fontWeight: 700,
                                          color: '#0f172a',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {shortProductName(prod)}
                                      </span>
                                    </div>

                                    <span
                                      title={`${prod.parcelasAtivas} parcelas ativas de ${prod.parcelasEsperadasPadrao} esperadas`}
                                      style={{
                                        padding: '2px 6px',
                                        borderRadius: 5,
                                        background: todasFaltasProd.length > 0 ? '#fef3c7' : '#dcfce7',
                                        color: todasFaltasProd.length > 0 ? '#92400e' : '#15803d',
                                        fontSize: 10,
                                        fontWeight: 800,
                                        flexShrink: 0,
                                      }}
                                    >
                                      {prod.parcelasAtivas}/{prod.parcelasEsperadasPadrao}
                                    </span>
                                  </div>

                                  {/* Col 4: Installment Mini-Squares ("quadradinho pequeno igual imagem2") */}
                                  <div style={{ minWidth: 0 }}>
                                    {estaEmModoFocoParcelaFaltante ? (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                                        {faltasDetalhadas.map(itemFalta => {
                                          const topLabel =
                                            itemFalta.num >= 1 && itemFalta.num <= 12
                                              ? MESES_CURTOS[itemFalta.num - 1]
                                              : `${itemFalta.num}ª`
                                          return renderQuadradinhoBox({
                                            key: itemFalta.num,
                                            topLabel,
                                            bottomLabel: itemFalta.tipo === 'CANCELADA' ? 'Canc' : 'Falta',
                                            variant: itemFalta.tipo === 'CANCELADA' ? 'CANCELED_ONLY' : 'MISSING',
                                            title: `${prod.nome} — ${itemFalta.labelCurto}: ${
                                              itemFalta.tipo === 'CANCELADA'
                                                ? 'Cancelada s/ Substituta'
                                                : 'Não Gerada (Faltante)'
                                            }${itemFalta.detalheCancelada ? ` (${itemFalta.detalheCancelada})` : ''}`,
                                            fixedWidth: true,
                                          })
                                        })}

                                        {qtdOutrasFaltasOcultas > 0 && (
                                          <span
                                            title={`Este produto possui mais ${qtdOutrasFaltasOcultas} parcela(s) faltante(s) em outros meses`}
                                            style={{
                                              fontSize: 10,
                                              fontWeight: 700,
                                              color: '#64748b',
                                              background: '#f1f5f9',
                                              padding: '2px 6px',
                                              borderRadius: 6,
                                            }}
                                          >
                                            +{qtdOutrasFaltasOcultas}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      renderMesesGridLimpo(
                                        prod.mesesGrid,
                                        prod.categoria,
                                        prod,
                                        aluno.parcelas || []
                                      )
                                    )}
                                  </div>
                                </div>
                              )
                            })}

                            {!aluno.temMensalidade &&
                              (filtroCategoriaProduto === 'TODOS' ||
                                filtroCategoriaProduto === 'MENSALIDADE') && (
                                <div
                                  style={{
                                    padding: '4px 8px',
                                    borderRadius: 6,
                                    background: '#fff1f2',
                                    border: '1px solid #fecdd3',
                                    color: '#be123c',
                                    fontSize: 10.5,
                                    fontWeight: 800,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    width: 'fit-content',
                                  }}
                                >
                                  <AlertTriangle size={11} aria-hidden="true" />
                                  <span>Sem Mensalidade ativa no Isaac</span>
                                </div>
                              )}
                          </div>
                        )}
                      </td>

                      {/* Col 5: Financial Summary */}
                      <td className="hide-on-narrow-container" style={{ padding: '10px 10px' }}>
                        {aluno.possuiParcelasAtivasIsaac ? (
                          <div style={{ lineHeight: 1.25 }}>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 12 }}>
                              {formatBRL(valorContratadoExibido)}
                            </div>
                            <div style={{ fontSize: 10, color: '#047857', fontWeight: 700, marginTop: 2 }}>
                              Pago: {formatBRL(valorPagoExibido)}
                            </div>
                            {valorVencidoExibido > 0 && (
                              <div style={{ fontSize: 10, color: '#be123c', fontWeight: 700 }}>
                                Venc: {formatBRL(valorVencidoExibido)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 10.5, color: '#94a3b8' }}>
                            {aluno.negociacao?.resumoValores || '—'}
                          </span>
                        )}
                      </td>

                      {/* Col 6: Action Button */}
                      <td style={{ textAlign: 'right', padding: '10px 12px' }}>
                        <button
                          type="button"
                          onClick={() => openStudentModal(aluno.key)}
                          aria-label={`Ver dossiê e parcelas de ${aluno.nome}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            height: 32,
                            padding: '0 10px',
                            borderRadius: 8,
                            border: '1px solid #c7d2fe',
                            background: '#eef2ff',
                            color: '#4338ca',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                            width: '100%',
                          }}
                        >
                          <Eye size={12} aria-hidden="true" />
                          <span>Ver</span>
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 3: Executive Summary by Class ───────────────────────────────── */}
      {!loading && activeTab === 'TURMAS_RESUMO' && (
        <div
          className="isaac-table-container"
          tabIndex={0}
          role="region"
          aria-labelledby="isaac-turmas-table-caption"
        >
          <table className="isaac-luxury-table">
            <caption id="isaac-turmas-table-caption" className="visually-hidden">
              Resumo de conciliação e auditoria por turma ({anoSelecionado})
            </caption>
            <colgroup>
              <col style={{ width: '22%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '12%' }} />
              <col style={{ width: '9%' }} />
              <col style={{ width: '13%' }} />
              <col style={{ width: '9%' }} />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Turma & Segmento</th>
                <th scope="col">Alunos ERP</th>
                <th scope="col">Conciliados</th>
                <th scope="col">Sem Isaac / Fora</th>
                <th scope="col">C/ Faltantes</th>
                <th scope="col">Inadimp.</th>
                <th scope="col">Contratado / Pago</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Ação
                </th>
              </tr>
            </thead>
            <tbody>
              {(data?.resumoPorTurma || []).map(t => (
                <tr key={t.turmaNome}>
                  <td>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 12.5 }}>{t.turmaNome}</div>
                    <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 500 }}>
                      {t.segmentoNome || t.serieNome || '—'}
                    </div>
                  </td>
                  <td style={{ fontWeight: 800 }}>{t.totalErp}</td>
                  <td>
                    <span
                      style={{
                        padding: '3px 7px',
                        borderRadius: 999,
                        background: '#ecfdf5',
                        color: '#047857',
                        fontWeight: 800,
                        fontSize: 11,
                      }}
                    >
                      {t.totalConciliados} ({t.taxaConciliacaoPct}%)
                    </span>
                  </td>
                  <td>
                    {t.totalSemIsaac > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ color: '#be123c', fontWeight: 800, fontSize: 11 }}>
                          {t.totalSemIsaac} sem Isaac
                        </span>
                        {t.totalForaIsaac > 0 && (
                          <span style={{ color: '#64748b', fontSize: 10 }}>
                            ({t.totalForaIsaac} fora Isaac)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>0</span>
                    )}
                  </td>
                  <td>
                    {t.totalComFaltantes > 0 ? (
                      <span
                        style={{
                          padding: '2px 7px',
                          borderRadius: 999,
                          background: '#fff1f2',
                          color: '#be123c',
                          fontWeight: 800,
                          fontSize: 11,
                        }}
                      >
                        {t.totalComFaltantes} aluno(s)
                      </span>
                    ) : (
                      <span style={{ color: '#059669', fontWeight: 700, fontSize: 11 }}>✓ 0</span>
                    )}
                  </td>
                  <td>
                    {t.totalInadimplentes > 0 ? (
                      <span style={{ color: '#be123c', fontWeight: 800 }}>{t.totalInadimplentes}</span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>0</span>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 11.5 }}>
                      {t.valorContratadoFormatado}
                    </div>
                    <div style={{ fontWeight: 700, color: '#059669', fontSize: 10.5 }}>
                      Pago: {t.valorPagoFormatado}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroTurma(t.turmaNome)
                        setActiveTab('ALUNOS_AUDITORIA')
                      }}
                      style={{
                        padding: '6px 9px',
                        borderRadius: 8,
                        border: '1px solid #c7d2fe',
                        background: '#eef2ff',
                        color: '#4338ca',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Filtrar →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── NATIVE <dialog> MODAL: Student Installment & Product Dossier ──────── */}
      <dialog
        ref={dialogRef}
        className="isaac-native-dialog"
        aria-labelledby="isaac-modal-student-title"
        onClose={() => setSelectedAlunoKey(null)}
        onClick={e => {
          if (e.target === dialogRef.current) closeStudentModal()
        }}
      >
        {selectedAluno && (
          <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
            {/* Modal Sticky Header */}
            <div
              style={{
                padding: '16px 22px',
                background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: '#4f46e5',
                      color: '#ffffff',
                      textTransform: 'uppercase',
                    }}
                  >
                    Dossiê Ano Letivo {anoSelecionado}
                  </span>
                  {renderConciliacaoBadge(selectedAluno)}
                </div>
                <h2
                  id="isaac-modal-student-title"
                  style={{ margin: 0, fontSize: 19, fontWeight: 900, color: '#0f172a' }}
                >
                  {selectedAluno.nome}
                </h2>
                <div
                  style={{
                    fontSize: 11.5,
                    color: '#475569',
                    marginTop: 3,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <span>
                    Turma: <b>{selectedAluno.turmaNome || '—'}</b>
                  </span>
                  <span>
                    ID Gestão: <b>{selectedAluno.erpId || '—'}</b>
                  </span>
                  <span>
                    ID Isaac: <b>{selectedAluno.isaacExternalId || selectedAluno.isaacStudentId || '—'}</b>
                  </span>
                  <span>
                    Responsável: <b>{selectedAluno.responsavelNome || '—'}</b> (
                    {selectedAluno.responsavelCpf || '—'})
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedAluno.estaNoIsaac && (
                  <button
                    type="button"
                    onClick={() => exportarAlunoExcel(selectedAluno)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '7px 12px',
                      borderRadius: 9,
                      border: '1px solid #a7f3d0',
                      background: '#ecfdf5',
                      color: '#065f46',
                      fontSize: 11.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    <FileSpreadsheet size={14} aria-hidden="true" /> Exportar Parcelas (.xlsx)
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeStudentModal}
                  aria-label="Fechar modal"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ padding: '18px 22px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Product Filter Pills inside Modal */}
              {(selectedAluno.produtos || []).length > 1 && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 14,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                    Filtrar Produto no Dossiê:
                  </span>
                  <button
                    type="button"
                    aria-pressed={modalProductFilter === 'TODOS'}
                    onClick={() => setModalProductFilter('TODOS')}
                    style={{
                      padding: '5px 11px',
                      borderRadius: 8,
                      border: modalProductFilter === 'TODOS' ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                      background: modalProductFilter === 'TODOS' ? '#4f46e5' : '#ffffff',
                      color: modalProductFilter === 'TODOS' ? '#ffffff' : '#334155',
                      fontSize: 11.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Todos os Produtos ({(selectedAluno.produtos || []).length})
                  </button>
                  {(selectedAluno.produtos || []).map(p => {
                    const active = modalProductFilter === p.key
                    return (
                      <button
                        key={p.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setModalProductFilter(p.key)}
                        style={{
                          padding: '5px 11px',
                          borderRadius: 8,
                          border: active ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                          background: active ? '#4f46e5' : '#ffffff',
                          color: active ? '#ffffff' : '#334155',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {shortProductName(p)} ({p.parcelasAtivas}/{p.parcelasEsperadasPadrao})
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Section 1: Missing Installments Audit per Product */}
              <div style={{ marginBottom: 18 }}>
                <h3
                  style={{
                    margin: '0 0 8px',
                    fontSize: 13.5,
                    fontWeight: 800,
                    color: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <Package size={15} color="#4f46e5" aria-hidden="true" />
                  Auditoria do(s) Produto(s)
                </h3>

                {(selectedAluno.produtos || []).length === 0 ? (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: 12.5,
                      color: '#64748b',
                    }}
                  >
                    Este aluno não possui parcelas lançadas no Isaac para o ano de referência {anoSelecionado}.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(selectedAluno.produtos || [])
                      .filter(p => modalProductFilter === 'TODOS' || p.key === modalProductFilter)
                      .map(prod => {
                        const faltantes = getFaltantesProduto(prod)
                        return (
                          <div
                            key={prod.key}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 12,
                              background: faltantes.length > 0 ? '#fffef7' : '#f8fafc',
                              border: faltantes.length > 0 ? '1px solid #fcd34d' : '1px solid #e2e8f0',
                              display: 'grid',
                              gridTemplateColumns: '1.1fr 2fr 0.9fr',
                              alignItems: 'center',
                              gap: 12,
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 800, fontSize: 12.5, color: '#0f172a' }}>
                                {prod.nome}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                Ativas: <b>{prod.parcelasAtivas}/{prod.parcelasEsperadasPadrao}</b> • Total:{' '}
                                <b>{prod.valorContratadoFormatado}</b>
                              </div>
                            </div>

                            <div style={{ minWidth: 0 }}>
                              {renderMesesGridLimpo(
                                prod.mesesGrid,
                                prod.categoria,
                                prod,
                                selectedAluno.parcelas || []
                              )}
                            </div>

                            <div style={{ textAlign: 'right', minWidth: 0 }}>
                              {faltantes.length > 0 ? (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '4px 8px',
                                    borderRadius: 7,
                                    background: '#fff1f2',
                                    border: '1px solid #fecdd3',
                                    color: '#be123c',
                                    fontSize: 11,
                                    fontWeight: 800,
                                  }}
                                >
                                  <AlertTriangle size={12} aria-hidden="true" />
                                  Faltam: {faltantes.join(', ')}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '4px 8px',
                                    borderRadius: 999,
                                    background: '#ecfdf5',
                                    color: '#047857',
                                    fontSize: 11,
                                    fontWeight: 800,
                                  }}
                                >
                                  <CheckCircle2 size={12} aria-hidden="true" /> Completo
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>

              {/* Section 2: Installments List */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      fontWeight: 800,
                      color: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    <FileText size={15} color="#4f46e5" aria-hidden="true" />
                    Parcelas Lançadas no Isaac
                  </h3>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      aria-label="Filtrar status da parcela no modal"
                      value={modalStatusFilter}
                      onChange={e => setModalStatusFilter(e.target.value)}
                      style={{
                        padding: '5px 9px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 11.5,
                        fontWeight: 600,
                      }}
                    >
                      <option value="TODOS">Todos os Status</option>
                      <option value="PAID">Pagas</option>
                      <option value="OPEN">A Vencer</option>
                      <option value="OVERDUE">Vencidas</option>
                      <option value="CANCELED">Canceladas</option>
                    </select>
                  </div>
                </div>

                <div className="isaac-table-container" tabIndex={0}>
                  <table className="isaac-luxury-table">
                    <caption className="visually-hidden">Parcelas individuais do aluno</caption>
                    <colgroup>
                      <col style={{ width: '9%' }} />
                      <col style={{ width: '25%' }} />
                      <col style={{ width: '7%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '14%' }} />
                      <col style={{ width: '10%' }} />
                      <col style={{ width: '15%' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th scope="col">Mês</th>
                        <th scope="col">Produto & Descrição</th>
                        <th scope="col">Parc.</th>
                        <th scope="col">Vencimento</th>
                        <th scope="col">Status</th>
                        <th scope="col">Valor</th>
                        <th scope="col">Pagamento</th>
                        <th scope="col" style={{ textAlign: 'right' }}>
                          Links / Pix
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedAluno.parcelas || [])
                        .filter(
                          p =>
                            modalProductFilter === 'TODOS' ||
                            p.produtoKey === modalProductFilter ||
                            p.produtoCategoria === modalProductFilter
                        )
                        .filter(p => modalStatusFilter === 'TODOS' || p.status === modalStatusFilter)
                        .map(parc => (
                          <tr
                            key={parc.id}
                            style={{
                              opacity: parc.status === 'CANCELED' ? 0.55 : 1,
                            }}
                          >
                            <td style={{ fontWeight: 800, color: '#4f46e5', fontSize: 11.5 }}>
                              {parc.mesSigla || '—'}/{parc.anoReferencia.slice(-2)}
                            </td>
                            <td>
                              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 11.5 }}>
                                {parc.produtoNome}
                              </div>
                              {parc.descricao && parc.descricao !== parc.produtoNome && (
                                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 1 }}>
                                  {parc.descricao}
                                </div>
                              )}
                            </td>
                            <td style={{ fontWeight: 700, fontSize: 11 }}>
                              {parc.numeroParcela && parc.totalParcelasDeclarado
                                ? `${parc.numeroParcela}/${parc.totalParcelasDeclarado}`
                                : '—'}
                            </td>
                            <td style={{ fontWeight: 600, fontSize: 11 }}>{formatDateBR(parc.vencimento)}</td>
                            <td>
                              {parc.status === 'PAID' && (
                                <span
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: 999,
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    fontSize: 10,
                                    fontWeight: 800,
                                  }}
                                >
                                  PAGO
                                </span>
                              )}
                              {parc.status === 'OPEN' && (
                                <span
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: 999,
                                    background: '#e0e7ff',
                                    color: '#3730a3',
                                    fontSize: 10,
                                    fontWeight: 800,
                                  }}
                                >
                                  A VENCER
                                </span>
                              )}
                              {parc.status === 'OVERDUE' && (
                                <span
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: 999,
                                    background: '#ffe4e6',
                                    color: '#be123c',
                                    fontSize: 10,
                                    fontWeight: 800,
                                  }}
                                >
                                  VENCIDO
                                </span>
                              )}
                              {parc.status === 'CANCELED' && (
                                <span
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: 999,
                                    background: '#f1f5f9',
                                    color: '#64748b',
                                    fontSize: 10,
                                    fontWeight: 800,
                                  }}
                                >
                                  CANCELADO
                                </span>
                              )}
                              {(parc.status === 'RENEGOTIATED' || parc.status === 'AGGLUTINATED') && (
                                <span
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: 999,
                                    background: '#f3e8ff',
                                    color: '#6b21a8',
                                    fontSize: 10,
                                    fontWeight: 800,
                                  }}
                                >
                                  RENEGOC.
                                </span>
                              )}
                            </td>
                            <td>
                              <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 11.5 }}>
                                {parc.status === 'PAID'
                                  ? parc.valorPagoFormatado || parc.valorEfetivoFormatado
                                  : parc.valorEfetivoFormatado}
                              </div>
                              {parc.descontoCentavos > 0 && (
                                <div style={{ fontSize: 10, color: '#059669' }}>
                                  Desc: -{parc.descontoFormatado}
                                </div>
                              )}
                            </td>
                            <td style={{ fontSize: 11, color: '#475569' }}>
                              {parc.dataPagamento ? formatDateBR(parc.dataPagamento) : '—'}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 }}>
                                {parc.pixCode && parc.status !== 'PAID' && parc.status !== 'CANCELED' && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(parc.pixCode!, parc.id)}
                                    style={{
                                      padding: '3px 6px',
                                      borderRadius: 5,
                                      border: '1px solid #a7f3d0',
                                      background: '#ecfdf5',
                                      color: '#047857',
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                  >
                                    {copiedId === parc.id ? (
                                      <Check size={11} aria-hidden="true" />
                                    ) : (
                                      <Copy size={11} aria-hidden="true" />
                                    )}
                                    Pix
                                  </button>
                                )}
                                {parc.boletoUrl && (
                                  <a
                                    href={parc.boletoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      padding: '3px 6px',
                                      borderRadius: 5,
                                      border: '1px solid #cbd5e1',
                                      background: '#ffffff',
                                      color: '#334155',
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      textDecoration: 'none',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                  >
                                    Boleto <ExternalLink size={10} aria-hidden="true" />
                                  </a>
                                )}
                                {parc.checkoutUrl && (
                                  <a
                                    href={parc.checkoutUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                      padding: '3px 6px',
                                      borderRadius: 5,
                                      border: '1px solid #c7d2fe',
                                      background: '#eef2ff',
                                      color: '#4338ca',
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      textDecoration: 'none',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                    }}
                                  >
                                    Fatura <ArrowUpRight size={10} aria-hidden="true" />
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}
