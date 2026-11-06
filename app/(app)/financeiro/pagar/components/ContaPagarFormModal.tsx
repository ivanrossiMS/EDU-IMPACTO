'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  X, Plus, Trash2,
  AlertTriangle, Split, RotateCw, Search, Check,
  Edit3, BookOpen, FileText, ListOrdered
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  type ContaPagarRecord,
  type FornecedorEscolar,
  type RateioCentroCustoItem,
  type ContaPagarTipoCusto,
  type CentroCustoEscolarOption,
  type PlanoContasEscolarOption,
  CENTROS_CUSTO_ESCOLARES,
  TEMPLATES_DESPESAS_ESCOLARES,
  resolvePlanoContasEscolares,
  calcularValorLiquido,
} from '../types'

interface ContaPagarFormModalProps {
  isOpen: boolean
  onClose: () => void
  editingRecord: ContaPagarRecord | null
  fornecedores: FornecedorEscolar[]
  planoContas: any[]
  eventosFinanceiros?: any[]
  centrosCusto?: CentroCustoEscolarOption[]
  onSave: (records: Partial<ContaPagarRecord>[]) => Promise<void>
  onQuickCreateFornecedor: (forn: Partial<FornecedorEscolar>) => Promise<FornecedorEscolar | null>
}

interface ParcelaPreviewItem {
  numero: number
  total: number
  vencimento: string
  competencia: string
  valorBase: number
  valorLiquido: number
  descricao: string
}

function addMonthsISO(isoDate: string, monthsToAdd: number): string {
  const parts = (isoDate || '').split('-').map(Number)
  if (parts.length < 3 || !parts[0]) {
    const d = new Date()
    d.setMonth(d.getMonth() + monthsToAdd)
    return d.toISOString().split('T')[0]
  }
  const [y, m, day] = parts
  const targetMonthIndex = m - 1 + monthsToAdd
  const targetYear = y + Math.floor(targetMonthIndex / 12)
  const normalizedMonth = ((targetMonthIndex % 12) + 12) % 12
  const maxDayInMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate()
  const safeDay = Math.min(day, maxDayInMonth)
  return `${targetYear}-${String(normalizedMonth + 1).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
}

function addDaysISO(isoDate: string, daysToAdd: number): string {
  const parts = (isoDate || '').split('-').map(Number)
  if (parts.length < 3 || !parts[0]) {
    const d = new Date()
    d.setDate(d.getDate() + daysToAdd)
    return d.toISOString().split('T')[0]
  }
  const [y, m, day] = parts
  const dt = new Date(y, m - 1, day, 12, 0, 0)
  dt.setDate(dt.getDate() + daysToAdd)
  const ry = dt.getFullYear()
  const rm = String(dt.getMonth() + 1).padStart(2, '0')
  const rd = String(dt.getDate()).padStart(2, '0')
  return `${ry}-${rm}-${rd}`
}

const TIPO_CONTA_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  analitico: { label: 'Analítico', color: '#2563eb', bg: '#eff6ff' },
  sintetico: { label: 'Sintético', color: '#7c3aed', bg: '#f5f3ff' },
  detalhe: { label: 'Detalhe', color: '#059669', bg: '#ecfdf5' },
}

const GRUPO_CONTA_BADGE: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  despesas: { label: 'Despesas', emoji: '📉', color: '#dc2626', bg: '#fef2f2' },
  investimentos: { label: 'Investimentos', emoji: '🪙', color: '#2563eb', bg: '#eff6ff' },
  receitas: { label: 'Receitas', emoji: '📈', color: '#059669', bg: '#ecfdf5' },
}

export function ContaPagarFormModal({
  isOpen,
  onClose,
  editingRecord,
  fornecedores,
  planoContas,
  centrosCusto,
  onSave,
  onQuickCreateFornecedor,
}: ContaPagarFormModalProps) {
  const listaCentrosCusto = useMemo(
    () => (Array.isArray(centrosCusto) && centrosCusto.length > 0 ? centrosCusto : CENTROS_CUSTO_ESCOLARES),
    [centrosCusto]
  )

  const listaPlanoContas = useMemo(
    () => resolvePlanoContasEscolares(planoContas, 'todos', false),
    [planoContas]
  )

  const hojeStr = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Abas simplificadas (2 abas: 1. Dados & Parcelas | 2. Rateio de Custo)
  const [activeSection, setActiveSection] = useState<'dados' | 'rateio'>('dados')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Modais/Popovers auxiliares de busca rápida
  const [showPlanoContasModal, setShowPlanoContasModal] = useState(false)
  const [buscaPlanoContas, setBuscaPlanoContas] = useState('')
  const [filtroGrupoPlano, setFiltroGrupoPlano] = useState<'todos' | 'despesas' | 'investimentos' | 'receitas'>('todos')
  const [showFornecedorSearch, setShowFornecedorSearch] = useState(false)
  const [showTemplatesPopover, setShowTemplatesPopover] = useState(false)
  const [showPreviewParcelas, setShowPreviewParcelas] = useState(false)

  // Campos principais
  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [fornecedorNome, setFornecedorNome] = useState('')
  const [fornecedorDocumento, setFornecedorDocumento] = useState('')
  const [categoria, setCategoria] = useState<string>('')
  const [subcategoria, setSubcategoria] = useState('')
  const [centroCusto, setCentroCusto] = useState<string>('')
  const [planoContasId, setPlanoContasId] = useState('')
  const [tipoCusto, setTipoCusto] = useState<ContaPagarTipoCusto>('fixo')
  const [unidadeEmpresa, setUnidadeEmpresa] = useState('')

  // Datas e Parcelas (Vencimento Inicial, Parcela Inicial, Parcela Final, Emissão)
  const [vencimento, setVencimento] = useState(hojeStr)
  const [dataEmissao, setDataEmissao] = useState(hojeStr)
  const [parcelaInicial, setParcelaInicial] = useState<number>(1)
  const [parcelaFinal, setParcelaFinal] = useState<number>(1)
  const [regraVencimento, setRegraVencimento] = useState<'mesmo_dia' | 'cada_30_dias'>('mesmo_dia')
  const [modoValorParcela, setModoValorParcela] = useState<'repetir' | 'dividir'>('repetir')
  const [parcelasPreview, setParcelasPreview] = useState<ParcelaPreviewItem[]>([])

  // Alçada e Valores
  const [aprovacaoStatus, setAprovacaoStatus] = useState<'aprovado' | 'pendente_aprovacao' | 'rejeitado'>('aprovado')
  const [valorBase, setValorBase] = useState<string>('')
  const [desconto, setDesconto] = useState<string>('0')
  const [juros, setJuros] = useState<string>('0')
  const [multa, setMulta] = useState<string>('0')
  const [retIss, setRetIss] = useState<string>('0')
  const [retIrrf, setRetIrrf] = useState<string>('0')
  const [retInss, setRetInss] = useState<string>('0')
  const [retCsrf, setRetCsrf] = useState<string>('0')

  // Pagamento e Documentos
  const [formaPagamento, setFormaPagamento] = useState<string>('PIX')
  const [tipoDocumento, setTipoDocumento] = useState<
    'NF-e' | 'NFS-e' | 'Boleto' | 'Recibo' | 'Contrato' | 'DARF' | 'Folha' | 'Fatura' | 'Outro'
  >('NFS-e')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [notaFiscal, setNotaFiscal] = useState('')
  const [chavePix, setChavePix] = useState('')
  const [linhaDigitavel, setLinhaDigitavel] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Rateio Multi-Centro de Custo
  const [usarRateio, setUsarRateio] = useState(false)
  const [rateioList, setRateioList] = useState<RateioCentroCustoItem[]>([])

  // Quick Fornecedor inline
  const [showQuickForn, setShowQuickForn] = useState(false)
  const [qfNome, setQfNome] = useState('')
  const [qfDoc, setQfDoc] = useState('')
  const [qfPix, setQfPix] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setFormError('')
    setActiveSection('dados')
    setShowPlanoContasModal(false)
    setShowFornecedorSearch(false)
    setShowTemplatesPopover(false)
    setShowPreviewParcelas(false)
    setShowQuickForn(false)
    setBuscaPlanoContas('')

    const defaultPlano =
      listaPlanoContas.find((p) => p.grupoConta === 'despesas' && p.tipo !== 'sintetico') ||
      listaPlanoContas.find((p) => p.grupoConta === 'despesas') ||
      listaPlanoContas[0]

    if (editingRecord) {
      setCodigo(editingRecord.codigo || '')
      setDescricao(editingRecord.descricao || '')
      setFornecedorId(editingRecord.fornecedorId || '')
      setFornecedorNome(editingRecord.fornecedorNome || '')
      setFornecedorDocumento(editingRecord.fornecedorDocumento || '')

      const matchedPlano = listaPlanoContas.find(
        (p) =>
          p.id === editingRecord.planoContasId ||
          p.value === editingRecord.categoria ||
          p.label === editingRecord.categoria ||
          p.descricao === editingRecord.categoria
      )
      setCategoria(matchedPlano ? matchedPlano.value : editingRecord.categoria || defaultPlano?.value || '')
      setPlanoContasId(matchedPlano ? matchedPlano.id : editingRecord.planoContasId || defaultPlano?.id || '')

      setSubcategoria(editingRecord.subcategoria || '')
      setUnidadeEmpresa(editingRecord.subcategoria || '')
      setCentroCusto(editingRecord.centroCusto || '')
      setTipoCusto(editingRecord.tipoCusto || 'fixo')
      setVencimento(editingRecord.vencimento || hojeStr)
      setDataEmissao(editingRecord.dataEmissao || hojeStr)
      setParcelaInicial(editingRecord.parcelaAtual || 1)
      setParcelaFinal(editingRecord.totalParcelas || 1)
      setRegraVencimento(editingRecord.frequenciaRecorrencia === 'dias_30' ? 'cada_30_dias' : 'mesmo_dia')
      setAprovacaoStatus(editingRecord.aprovacaoStatus || 'aprovado')
      setValorBase(String(editingRecord.valorBase ?? editingRecord.valor ?? 0))
      setDesconto(String(editingRecord.desconto ?? 0))
      setJuros(String(editingRecord.juros ?? 0))
      setMulta(String(editingRecord.multa ?? 0))

      const det = editingRecord.detalhesRetencao
      const totalRet = Number(editingRecord.retencaoImpostos || 0)
      setRetIss(String(det?.iss ?? (totalRet > 0 && !det ? totalRet : 0)))
      setRetIrrf(String(det?.irrf ?? 0))
      setRetInss(String(det?.inss ?? 0))
      setRetCsrf(String(det?.pisCofinsCsll ?? 0))

      setFormaPagamento(
        editingRecord.formaPagamento && editingRecord.formaPagamento !== 'Carteira'
          ? editingRecord.formaPagamento
          : 'PIX'
      )
      setTipoDocumento(editingRecord.tipoDocumento || 'NFS-e')
      setNumeroDocumento(editingRecord.numeroDocumento || '')
      setNotaFiscal(editingRecord.notaFiscal || '')
      setChavePix(editingRecord.chavePix || '')
      setLinhaDigitavel(editingRecord.linhaDigitavel || '')
      setObservacoes(editingRecord.observacoes || '')

      if (editingRecord.rateio && editingRecord.rateio.length > 0) {
        setUsarRateio(true)
        setRateioList(editingRecord.rateio)
      } else {
        setUsarRateio(false)
        setRateioList([])
      }
    } else {
      const randCode = `CP-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 899))}`
      setCodigo(randCode)
      setDescricao('')
      setFornecedorId('')
      setFornecedorNome('')
      setFornecedorDocumento('')
      setCategoria(defaultPlano?.value || '')
      setPlanoContasId(defaultPlano?.id || '')
      setSubcategoria('')
      setCentroCusto('')
      setTipoCusto('fixo')
      setUnidadeEmpresa('')
      setVencimento(hojeStr)
      setDataEmissao(hojeStr)
      setParcelaInicial(1)
      setParcelaFinal(1)
      setRegraVencimento('mesmo_dia')
      setModoValorParcela('repetir')
      setAprovacaoStatus('aprovado')
      setValorBase('')
      setDesconto('0')
      setJuros('0')
      setMulta('0')
      setRetIss('0')
      setRetIrrf('0')
      setRetInss('0')
      setRetCsrf('0')
      setFormaPagamento('PIX')
      setTipoDocumento('NFS-e')
      setNumeroDocumento('')
      setNotaFiscal('')
      setChavePix('')
      setLinhaDigitavel('')
      setObservacoes('')
      setUsarRateio(false)
      setRateioList([])
    }
  }, [isOpen, editingRecord, hojeStr, listaPlanoContas, listaCentrosCusto])

  useEffect(() => {
    if (!isOpen || editingRecord) return
    if (!categoria && listaPlanoContas.length > 0) {
      const defaultPlano =
        listaPlanoContas.find((p) => p.grupoConta === 'despesas' && p.tipo !== 'sintetico') ||
        listaPlanoContas.find((p) => p.grupoConta === 'despesas') ||
        listaPlanoContas[0]
      if (defaultPlano) {
        setCategoria(defaultPlano.value)
        setPlanoContasId(defaultPlano.id)
      }
    }
  }, [isOpen, editingRecord, categoria, listaPlanoContas])

  const planoSelecionadoObj = useMemo(() => {
    return (
      listaPlanoContas.find(
        (p) =>
          (planoContasId && p.id === planoContasId) ||
          (categoria && (p.value === categoria || p.label === categoria || p.descricao === categoria))
      ) || null
    )
  }, [listaPlanoContas, planoContasId, categoria])

  const planosFiltradosModal = useMemo(() => {
    const q = buscaPlanoContas.trim().toLowerCase()
    return listaPlanoContas.filter((p) => {
      if (filtroGrupoPlano !== 'todos' && p.grupoConta !== filtroGrupoPlano) return false
      if (!q) return true
      return (
        p.codPlano.toLowerCase().includes(q) ||
        p.descricao.toLowerCase().includes(q) ||
        p.label.toLowerCase().includes(q)
      )
    })
  }, [listaPlanoContas, buscaPlanoContas, filtroGrupoPlano])

  const fornecedoresFiltrados = useMemo(() => {
    const q = fornecedorNome.trim().toLowerCase()
    if (!q) return fornecedores.slice(0, 12)
    return fornecedores
      .filter(
        (f) =>
          f.nome.toLowerCase().includes(q) ||
          (f.nomeFantasia || '').toLowerCase().includes(q) ||
          (f.documento || '').toLowerCase().includes(q)
      )
      .slice(0, 12)
  }, [fornecedores, fornecedorNome])

  const handleSelectPlanoConta = (item: PlanoContasEscolarOption) => {
    setPlanoContasId(item.id)
    setCategoria(item.value)
    if (item.grupoConta === 'investimentos') {
      setTipoCusto('investimento')
    }
    setShowPlanoContasModal(false)
    if (formError) setFormError('')
  }

  const numBase = Math.max(0, Number(String(valorBase).replace(',', '.')) || 0)
  const numDesconto = Math.max(0, Number(String(desconto).replace(',', '.')) || 0)
  const numJuros = Math.max(0, Number(String(juros).replace(',', '.')) || 0)
  const numMulta = Math.max(0, Number(String(multa).replace(',', '.')) || 0)
  const numIss = Math.max(0, Number(String(retIss).replace(',', '.')) || 0)
  const numIrrf = Math.max(0, Number(String(retIrrf).replace(',', '.')) || 0)
  const numInss = Math.max(0, Number(String(retInss).replace(',', '.')) || 0)
  const numCsrf = Math.max(0, Number(String(retCsrf).replace(',', '.')) || 0)
  const totalRetencao = Math.round((numIss + numIrrf + numInss + numCsrf) * 100) / 100

  const valorLiquidoCalculado = useMemo(
    () => calcularValorLiquido(numBase, numDesconto, numJuros, numMulta, totalRetencao),
    [numBase, numDesconto, numJuros, numMulta, totalRetencao]
  )

  const pIni = Math.max(1, Math.min(60, Number(parcelaInicial) || 1))
  const pFim = Math.max(pIni, Math.min(60, Number(parcelaFinal) || pIni))
  const qtdParcelasGeradas = Math.max(1, pFim - pIni + 1)

  // Gera preview de parcelas automaticamente quando Parcela Final > Parcela Inicial
  useEffect(() => {
    if (editingRecord || qtdParcelasGeradas <= 1) {
      setParcelasPreview([])
      return
    }
    const usarIntervalo30Dias = regraVencimento === 'cada_30_dias'
    const baseDesc = descricao.trim() || fornecedorNome.trim() || 'Despesa'

    const list: ParcelaPreviewItem[] = []
    for (let idx = 0; idx < qtdParcelasGeradas; idx++) {
      const numParcela = pIni + idx
      const venc = usarIntervalo30Dias
        ? addDaysISO(vencimento || hojeStr, idx * 30)
        : addMonthsISO(vencimento || hojeStr, idx)
      const comp = venc.slice(0, 7)
      const vBase =
        modoValorParcela === 'dividir'
          ? Math.round((numBase / qtdParcelasGeradas) * 100) / 100
          : numBase
      const vLiq =
        modoValorParcela === 'dividir'
          ? Math.round((valorLiquidoCalculado / qtdParcelasGeradas) * 100) / 100
          : valorLiquidoCalculado
      list.push({
        numero: numParcela,
        total: pFim,
        vencimento: venc,
        competencia: comp,
        valorBase: vBase,
        valorLiquido: vLiq,
        descricao: `${baseDesc} (${String(numParcela).padStart(2, '0')}/${String(pFim).padStart(2, '0')})`,
      })
    }
    setParcelasPreview(list)
  }, [
    editingRecord,
    pIni,
    pFim,
    qtdParcelasGeradas,
    regraVencimento,
    modoValorParcela,
    vencimento,
    hojeStr,
    numBase,
    valorLiquidoCalculado,
    descricao,
    fornecedorNome,
  ])

  const rateioComValores = useMemo(() => {
    return rateioList.map((item) => ({
      ...item,
      valor: Math.round(((Number(item.percentual) || 0) / 100) * valorLiquidoCalculado * 100) / 100,
    }))
  }, [rateioList, valorLiquidoCalculado])

  const somaPercentualRateio = useMemo(
    () => Math.round(rateioComValores.reduce((acc, r) => acc + (Number(r.percentual) || 0), 0) * 10) / 10,
    [rateioComValores]
  )

  const handleSelectFornecedor = (found: FornecedorEscolar) => {
    setFornecedorId(found.id)
    setFornecedorNome(found.nome)
    setFornecedorDocumento(found.documento || '')
    if (!descricao.trim()) {
      setDescricao(found.nomeFantasia || found.nome)
    }
    if (found.categoriaPadrao) {
      const matchedPlano = listaPlanoContas.find(
        (p) =>
          p.id === found.categoriaPadrao ||
          p.value === found.categoriaPadrao ||
          p.label === found.categoriaPadrao ||
          p.descricao === found.categoriaPadrao
      )
      if (matchedPlano) {
        setCategoria(matchedPlano.value)
        setPlanoContasId(matchedPlano.id)
      } else {
        setCategoria(found.categoriaPadrao)
      }
    }
    if (found.formaPagamentoPadrao && found.formaPagamentoPadrao !== 'Carteira') {
      setFormaPagamento(found.formaPagamentoPadrao)
    }
    if (found.chavePix) setChavePix(found.chavePix)
    setShowFornecedorSearch(false)
    if (formError) setFormError('')
  }

  const handleApplyTemplate = (tpl: (typeof TEMPLATES_DESPESAS_ESCOLARES)[number]) => {
    setDescricao(tpl.titulo)
    if (!fornecedorNome.trim()) {
      setFornecedorNome(tpl.titulo.split('—')[0].trim())
    }
    setCentroCusto(tpl.centroCusto)
    setTipoCusto(tpl.tipoCusto)
    setFormaPagamento(tpl.formaPagamento)
    if (!valorBase || Number(valorBase) === 0) {
      setValorBase(String(tpl.valorEstimado))
    }
    const matchedPlano = listaPlanoContas.find(
      (p) =>
        p.descricao.toLowerCase().includes(tpl.categoria.split(' ')[0].toLowerCase()) ||
        p.label.toLowerCase().includes(tpl.categoria.split(' ')[0].toLowerCase())
    )
    if (matchedPlano) {
      setCategoria(matchedPlano.value)
      setPlanoContasId(matchedPlano.id)
    } else {
      setCategoria(tpl.categoria)
    }
    setShowTemplatesPopover(false)
    if (formError) setFormError('')
  }

  const handleAplicarRateioPedagogicoPadrao = () => {
    setUsarRateio(true)
    const configuradosComPeso = listaCentrosCusto.filter(
      (c) => typeof c.pesoRateioPadrao === 'number' && c.pesoRateioPadrao > 0
    )
    if (configuradosComPeso.length > 0) {
      setRateioList(
        configuradosComPeso.map((c) => ({
          centroCusto: c.id,
          percentual: Number(c.pesoRateioPadrao || 0),
          valor: 0,
        }))
      )
    } else {
      setRateioList([
        { centroCusto: 'Educação Infantil', percentual: 20, valor: 0 },
        { centroCusto: 'Fundamental Anos Iniciais', percentual: 30, valor: 0 },
        { centroCusto: 'Fundamental Anos Finais', percentual: 30, valor: 0 },
        { centroCusto: 'Ensino Médio & Pré-Vestibular', percentual: 20, valor: 0 },
      ])
    }
  }

  const handleAddRateioRow = () => {
    const restante = Math.max(0, 100 - somaPercentualRateio)
    const used = new Set(rateioList.map((r) => r.centroCusto))
    const nextCentro =
      listaCentrosCusto.find((c) => !used.has(c.id))?.id ||
      listaCentrosCusto[0]?.id ||
      CENTROS_CUSTO_ESCOLARES[0].id
    setRateioList((prev) => [...prev, { centroCusto: nextCentro, percentual: restante, valor: 0 }])
  }

  const handleSaveQuickFornecedor = async () => {
    if (!qfNome.trim()) return
    const created = await onQuickCreateFornecedor({
      nome: qfNome.trim(),
      documento: qfDoc.trim(),
      chavePix: qfPix.trim(),
      categoriaPadrao: categoria,
      centroCustoPadrao: centroCusto,
      formaPagamentoPadrao: formaPagamento,
    })
    if (created) {
      setFornecedorId(created.id)
      setFornecedorNome(created.nome)
      setFornecedorDocumento(created.documento || '')
      if (!descricao.trim()) setDescricao(created.nome)
      if (created.chavePix) setChavePix(created.chavePix)
      setShowQuickForn(false)
      setQfNome('')
      setQfDoc('')
      setQfPix('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    const resolvedFornecedor = fornecedorNome.trim()
    const resolvedDescricao = descricao.trim() || resolvedFornecedor

    if (!resolvedFornecedor) {
      setFormError('Informe ou pesquise o Fornecedor / Credor.')
      setActiveSection('dados')
      return
    }
    if (!categoria.trim()) {
      setFormError('Selecione uma Conta Plano (Plano de Contas).')
      setActiveSection('dados')
      return
    }
    if (numBase <= 0) {
      setFormError('Informe o Valor (R$) maior que zero.')
      setActiveSection('dados')
      return
    }
    if (usarRateio && rateioComValores.length > 0 && Math.abs(somaPercentualRateio - 100) > 0.5) {
      setFormError(`A soma do rateio por Centro de Custo deve fechar em 100% (atual: ${somaPercentualRateio}%).`)
      setActiveSection('rateio')
      return
    }

    setSaving(true)
    try {
      const resolvedEmissao = dataEmissao || editingRecord?.dataEmissao || hojeStr
      const automaticCompetencia = (vencimento || hojeStr).slice(0, 7)
      const resolvedPlanoId = planoContasId || planoSelecionadoObj?.id || undefined
      const initialStatus = editingRecord?.status || 'pendente'

      const basePayload: Partial<ContaPagarRecord> = {
        id: editingRecord?.id,
        codigo: codigo.trim() || undefined,
        descricao: resolvedDescricao,
        fornecedorId: fornecedorId || undefined,
        fornecedorNome: resolvedFornecedor,
        fornecedorDocumento: fornecedorDocumento.trim() || undefined,
        categoria: categoria.trim(),
        subcategoria: subcategoria.trim() || unidadeEmpresa || undefined,
        centroCusto,
        rateio: usarRateio && rateioComValores.length > 0 ? rateioComValores : [],
        planoContasId: resolvedPlanoId,
        tipoCusto,
        prioridade: editingRecord?.prioridade || 'media',
        dataEmissao: resolvedEmissao,
        vencimento,
        competencia: automaticCompetencia,
        status: initialStatus,
        dataPagamento: editingRecord?.status === 'pago' ? editingRecord.dataPagamento : undefined,
        valorPago: editingRecord?.status === 'pago' ? editingRecord.valorPago : 0,
        aprovacaoStatus,
        valorBase: numBase,
        desconto: numDesconto,
        juros: numJuros,
        multa: numMulta,
        retencaoImpostos: totalRetencao,
        detalhesRetencao:
          totalRetencao > 0
            ? {
                iss: numIss,
                irrf: numIrrf,
                inss: numInss,
                pisCofinsCsll: numCsrf,
              }
            : undefined,
        valor: valorLiquidoCalculado,
        formaPagamento,
        caixaOrigem: editingRecord?.status === 'pago' ? editingRecord.caixaOrigem : undefined,
        tipoDocumento,
        numeroDocumento: numeroDocumento.trim() || undefined,
        notaFiscal: notaFiscal.trim() || undefined,
        chavePix: chavePix.trim() || undefined,
        linhaDigitavel: linhaDigitavel.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
        recorrente: qtdParcelasGeradas > 1,
        frequenciaRecorrencia:
          qtdParcelasGeradas > 1
            ? regraVencimento === 'cada_30_dias'
              ? 'dias_30'
              : 'mensal'
            : undefined,
      }

      if (!editingRecord && qtdParcelasGeradas > 1 && parcelasPreview.length > 1) {
        const groupId = `GRP-${Date.now().toString(36).toUpperCase()}`
        const multiplePayloads: Partial<ContaPagarRecord>[] = parcelasPreview.map((p) => ({
          ...basePayload,
          id: `CP-${Date.now().toString(36).toUpperCase()}-P${String(p.numero).padStart(2, '0')}`,
          codigo: `${codigo.trim() || 'CP'}-${String(p.numero).padStart(2, '0')}/${String(p.total).padStart(2, '0')}`,
          descricao: p.descricao,
          vencimento: p.vencimento,
          competencia: p.competencia,
          valorBase: p.valorBase,
          valor: p.valorLiquido,
          desconto: modoValorParcela === 'dividir' ? Math.round((numDesconto / qtdParcelasGeradas) * 100) / 100 : numDesconto,
          juros: modoValorParcela === 'dividir' ? Math.round((numJuros / qtdParcelasGeradas) * 100) / 100 : numJuros,
          multa: modoValorParcela === 'dividir' ? Math.round((numMulta / qtdParcelasGeradas) * 100) / 100 : numMulta,
          retencaoImpostos:
            modoValorParcela === 'dividir' ? Math.round((totalRetencao / qtdParcelasGeradas) * 100) / 100 : totalRetencao,
          status: 'pendente',
          dataPagamento: undefined,
          valorPago: 0,
          parcelaAtual: p.numero,
          totalParcelas: p.total,
          grupoParcelamentoId: groupId,
          rateio:
            usarRateio && rateioComValores.length > 0
              ? rateioComValores.map((r) => ({
                  ...r,
                  valor: Math.round(((Number(r.percentual) || 0) / 100) * p.valorLiquido * 100) / 100,
                }))
              : [],
        }))
        await onSave(multiplePayloads)
      } else {
        await onSave([
          {
            ...basePayload,
            parcelaAtual: pIni,
            totalParcelas: pFim,
          },
        ])
      }

      onClose()
    } catch (err: any) {
      setFormError(err?.message || 'Erro ao salvar lançamento financeiro.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    fontWeight: 700,
    color: '#334155',
    marginBottom: 4,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 11px',
    borderRadius: 7,
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  }

  const addonBtnStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 10px',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderLeft: 'none',
    color: '#334155',
    cursor: 'pointer',
    height: 36,
    flexShrink: 0,
  }

  const totalCompromisso =
    !editingRecord && qtdParcelasGeradas > 1 && parcelasPreview.length > 1
      ? parcelasPreview.reduce((acc, item) => acc + item.valorLiquido, 0)
      : valorLiquidoCalculado

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-conta-pagar-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 670,
          maxHeight: '94vh',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: 12,
          boxShadow: '0 24px 55px rgba(15, 23, 42, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* HEADER SIMPLIFICADO (Estilo Imagem 2 + Melhorias) */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <RotateCw size={19} color="#2563eb" style={{ flexShrink: 0 }} />
            <h2
              id="modal-conta-pagar-title"
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: '#2563eb',
                letterSpacing: '-0.01em',
              }}
            >
              {editingRecord
                ? `Editar Lançamento • ${editingRecord.codigo || editingRecord.id}`
                : 'Gerar Parcelas / Novo Lançamento'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* ABAS SIMPLIFICADAS (Apenas Dados & Parcelas e Rateio de Custo) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 6,
            padding: '8px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
          }}
        >
          {[
            {
              id: 'dados',
              label: '1. Dados & Parcelas',
              icon: <FileText size={13} />,
              badge: qtdParcelasGeradas > 1 ? `${qtdParcelasGeradas}x` : undefined,
            },
            {
              id: 'rateio',
              label: '2. Rateio de Custo',
              icon: <Split size={13} />,
              badge: usarRateio ? `${somaPercentualRateio}%` : undefined,
            },
          ].map((tab) => {
            const active = activeSection === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '7px 10px',
                  borderRadius: 8,
                  border: active ? '1px solid #93c5fd' : '1px solid transparent',
                  background: active ? '#eff6ff' : 'transparent',
                  color: active ? '#1d4ed8' : '#475569',
                  fontSize: 12,
                  fontWeight: active ? 700 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '1px 6px',
                      borderRadius: 99,
                      background: active ? '#2563eb' : '#e2e8f0',
                      color: active ? '#ffffff' : '#334155',
                    }}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* CORPO DO FORMULÁRIO */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            <div aria-live="polite">
              {formError && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    color: '#be123c',
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AlertTriangle size={15} />
                  <span>{formError}</span>
                </div>
              )}
            </div>

            {/* ABA 1: DADOS & PARCELAS (Visual idêntico à Imagem 2 com melhorias) */}
            {activeSection === 'dados' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                {/* LINHA 1: Fornecedor (Com busca integrada e botões laterais como na Imagem 2) */}
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <label htmlFor="cp-fornecedor-input" style={{ ...labelStyle, marginBottom: 0 }}>
                      Fornecedor:
                    </label>
                    {fornecedorDocumento && (
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                        CNPJ/CPF: {fornecedorDocumento}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    <input
                      id="cp-fornecedor-input"
                      name="fornecedorNome"
                      type="text"
                      required
                      value={fornecedorNome}
                      onFocus={() => setShowFornecedorSearch(true)}
                      onBlur={() => {
                        setTimeout(() => setShowFornecedorSearch(false), 180)
                      }}
                      onChange={(e) => {
                        setFornecedorNome(e.target.value)
                        setFornecedorId('')
                        setShowFornecedorSearch(true)
                        if (formError) setFormError('')
                      }}
                      placeholder="Clique/Toque Para Pesquisar ou digite o nome do fornecedor"
                      style={{
                        ...inputStyle,
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: 0,
                        background: '#f8fafc',
                        height: 36,
                      }}
                    />
                    <button
                      type="button"
                      title="Cadastrar novo fornecedor rápido"
                      onClick={() => {
                        setShowQuickForn((v) => !v)
                        setShowFornecedorSearch(false)
                      }}
                      style={addonBtnStyle}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      type="button"
                      title="Pesquisar na lista de fornecedores"
                      onClick={() => setShowFornecedorSearch((v) => !v)}
                      style={{
                        ...addonBtnStyle,
                        borderTopRightRadius: 7,
                        borderBottomRightRadius: 7,
                      }}
                    >
                      <Search size={14} />
                    </button>
                  </div>

                  {/* Dropdown de Busca de Fornecedores */}
                  {showFornecedorSearch && fornecedoresFiltrados.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 40,
                        marginTop: 4,
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: 8,
                        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.15)',
                        maxHeight: 210,
                        overflowY: 'auto',
                      }}
                    >
                      {fornecedoresFiltrados.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleSelectFornecedor(f)
                          }}
                          style={{
                            width: '100%',
                            padding: '8px 12px',
                            textAlign: 'left',
                            background: fornecedorId === f.id ? '#eff6ff' : '#ffffff',
                            border: 'none',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: 12.5,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{f.nomeFantasia || f.nome}</div>
                            {f.documento && <div style={{ fontSize: 11, color: '#64748b' }}>{f.documento}</div>}
                          </div>
                          {f.categoriaPadrao && (
                            <span
                              style={{
                                fontSize: 10.5,
                                padding: '2px 7px',
                                borderRadius: 6,
                                background: '#f1f5f9',
                                color: '#475569',
                                fontWeight: 600,
                              }}
                            >
                              {f.categoriaPadrao}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Mini painel de cadastro rápido de fornecedor */}
                  {showQuickForn && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 10,
                        borderRadius: 8,
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        display: 'grid',
                        gridTemplateColumns: '1.3fr 1fr 1fr auto',
                        gap: 8,
                        alignItems: 'end',
                      }}
                    >
                      <div>
                        <label htmlFor="qf-nome" style={{ ...labelStyle, fontSize: 11 }}>
                          Novo Fornecedor
                        </label>
                        <input
                          id="qf-nome"
                          type="text"
                          value={qfNome}
                          onChange={(e) => setQfNome(e.target.value)}
                          placeholder="Razão Social / Nome"
                          style={{ ...inputStyle, height: 32, fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <label htmlFor="qf-doc" style={{ ...labelStyle, fontSize: 11 }}>
                          CNPJ / CPF
                        </label>
                        <input
                          id="qf-doc"
                          type="text"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          value={qfDoc}
                          onChange={(e) => setQfDoc(e.target.value)}
                          placeholder="00.000.000/0001-00"
                          style={{ ...inputStyle, height: 32, fontSize: 12 }}
                        />
                      </div>
                      <div>
                        <label htmlFor="qf-pix" style={{ ...labelStyle, fontSize: 11 }}>
                          Chave PIX
                        </label>
                        <input
                          id="qf-pix"
                          type="text"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          value={qfPix}
                          onChange={(e) => setQfPix(e.target.value)}
                          placeholder="Opcional"
                          style={{ ...inputStyle, height: 32, fontSize: 12 }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveQuickFornecedor}
                        style={{
                          height: 32,
                          padding: '0 12px',
                          borderRadius: 6,
                          background: '#16a34a',
                          border: 'none',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Salvar
                      </button>
                    </div>
                  )}
                </div>

                {/* LINHA 2: Nº Documento | Tipo Doc | Vencimento Inicial | Parcela Inicial | Parcela Final */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.05fr 1.2fr 0.75fr 0.85fr', gap: 8 }}>
                  <div>
                    <label htmlFor="cp-num-doc" style={labelStyle}>
                      Nº Documento
                    </label>
                    <input
                      id="cp-num-doc"
                      name="numeroDocumento"
                      type="text"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={numeroDocumento}
                      onChange={(e) => setNumeroDocumento(e.target.value)}
                      placeholder="Ex: 1042"
                      style={{ ...inputStyle, height: 36 }}
                    />
                  </div>

                  <div>
                    <label htmlFor="cp-tipo-doc" style={labelStyle}>
                      Documento
                    </label>
                    <select
                      id="cp-tipo-doc"
                      aria-label="Tipo de Documento"
                      value={tipoDocumento}
                      onChange={(e) => setTipoDocumento(e.target.value as any)}
                      style={{ ...inputStyle, height: 36, background: '#f8fafc' }}
                    >
                      <option value="NFS-e">NFS-e</option>
                      <option value="Boleto">Boleto</option>
                      <option value="NF-e">NF-e</option>
                      <option value="Fatura">Fatura</option>
                      <option value="Recibo">Recibo</option>
                      <option value="Contrato">Contrato</option>
                      <option value="Folha">Folha</option>
                      <option value="DARF">DARF / Guia</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="cp-vencimento" style={labelStyle}>
                      Vencimento Inicial
                    </label>
                    <input
                      id="cp-vencimento"
                      name="vencimento"
                      type="date"
                      required
                      value={vencimento}
                      onChange={(e) => setVencimento(e.target.value)}
                      style={{ ...inputStyle, height: 36 }}
                    />
                  </div>

                  <div>
                    <label htmlFor="cp-parcela-ini" style={labelStyle}>
                      Parc. Inicial
                    </label>
                    <input
                      id="cp-parcela-ini"
                      name="parcelaInicial"
                      type="number"
                      min={1}
                      max={60}
                      disabled={Boolean(editingRecord)}
                      value={parcelaInicial}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(60, Number(e.target.value) || 1))
                        setParcelaInicial(v)
                        if (parcelaFinal < v) setParcelaFinal(v)
                      }}
                      style={{ ...inputStyle, height: 36 }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label htmlFor="cp-parcela-fim" style={{ ...labelStyle, marginBottom: 0, whiteSpace: 'nowrap' }}>
                        Parc. Final
                      </label>
                    </div>
                    <input
                      id="cp-parcela-fim"
                      name="parcelaFinal"
                      type="number"
                      min={parcelaInicial}
                      max={60}
                      disabled={Boolean(editingRecord)}
                      value={parcelaFinal}
                      onChange={(e) => {
                        const v = Math.max(1, Math.min(60, Number(e.target.value) || 1))
                        setParcelaFinal(v)
                      }}
                      style={{ ...inputStyle, height: 36 }}
                    />
                  </div>
                </div>

                {/* LINHA 3: Modelo de Parcelamento */}
                <fieldset
                  style={{
                    border: 'none',
                    margin: 0,
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: '#f8fafc',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Modelo de Parcelamento:</span>

                      <label
                        htmlFor="mod-30dias"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12.5,
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          id="mod-30dias"
                          type="radio"
                          name="modeloParcelamento"
                          checked={regraVencimento === 'cada_30_dias'}
                          onChange={() => setRegraVencimento('cada_30_dias')}
                          style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                        />
                        30 dias Comerciais
                      </label>

                      <label
                        htmlFor="mod-mesmodia"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12.5,
                          color: '#334155',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          id="mod-mesmodia"
                          type="radio"
                          name="modeloParcelamento"
                          checked={regraVencimento === 'mesmo_dia'}
                          onChange={() => setRegraVencimento('mesmo_dia')}
                          style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                        />
                        Mesmo dia do vencimento inicial
                      </label>
                    </div>

                    {!editingRecord && qtdParcelasGeradas > 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <select
                          aria-label="Modo de cálculo do valor das parcelas"
                          value={modoValorParcela}
                          onChange={(e) => setModoValorParcela(e.target.value as any)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: '#334155',
                          }}
                        >
                          <option value="repetir">Repetir valor em cada parcela</option>
                          <option value="dividir">Dividir valor total ({qtdParcelasGeradas}x)</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => setShowPreviewParcelas((v) => !v)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 9px',
                            borderRadius: 6,
                            border: '1px solid #93c5fd',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <ListOrdered size={13} />
                          {showPreviewParcelas ? 'Ocultar Parcelas' : `Ver ${qtdParcelasGeradas} Parcelas`}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Tabela compacta de prévia das parcelas quando expandida */}
                  {!editingRecord && qtdParcelasGeradas > 1 && showPreviewParcelas && (
                    <div
                      style={{
                        marginTop: 8,
                        borderRadius: 7,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        maxHeight: 155,
                        overflowY: 'auto',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                        <thead>
                          <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                            <th style={{ padding: '6px 10px' }}>Parc.</th>
                            <th style={{ padding: '6px 10px' }}>Descrição</th>
                            <th style={{ padding: '6px 10px' }}>Vencimento</th>
                            <th style={{ padding: '6px 10px', textAlign: 'right' }}>Valor (R$)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parcelasPreview.map((p, idx) => (
                            <tr key={p.numero} style={{ borderTop: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '5px 10px', fontWeight: 700, color: '#2563eb' }}>
                                {String(p.numero).padStart(2, '0')}/{String(p.total).padStart(2, '0')}
                              </td>
                              <td style={{ padding: '5px 10px', color: '#0f172a' }}>{p.descricao}</td>
                              <td style={{ padding: '5px 10px' }}>
                                <input
                                  aria-label={`Vencimento da parcela ${p.numero}`}
                                  type="date"
                                  value={p.vencimento}
                                  onChange={(e) => {
                                    const nv = e.target.value
                                    setParcelasPreview((prev) =>
                                      prev.map((item, i) =>
                                        i === idx ? { ...item, vencimento: nv, competencia: nv.slice(0, 7) } : item
                                      )
                                    )
                                  }}
                                  style={{
                                    padding: '2px 6px',
                                    borderRadius: 5,
                                    border: '1px solid #cbd5e1',
                                    fontSize: 11.5,
                                  }}
                                />
                              </td>
                              <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                                {formatCurrency(p.valorLiquido)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </fieldset>

                {/* LINHA 4: Conta Plano */}
                <div>
                  <label htmlFor="cp-plano-contas-btn" style={labelStyle}>
                    Conta Plano
                  </label>
                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    <button
                      id="cp-plano-contas-btn"
                      type="button"
                      onClick={() => setShowPlanoContasModal(true)}
                      style={{
                        ...inputStyle,
                        borderTopRightRadius: 0,
                        borderBottomRightRadius: 0,
                        background: '#f8fafc',
                        height: 36,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: planoSelecionadoObj || categoria ? '#0f172a' : '#64748b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {planoSelecionadoObj
                          ? planoSelecionadoObj.codPlano
                            ? `${planoSelecionadoObj.codPlano} - ${planoSelecionadoObj.descricao}`
                            : planoSelecionadoObj.descricao
                          : categoria || 'Clique/Toque Para Pesquisar no Plano de Contas...'}
                      </span>
                    </button>

                    <Link
                      href="/configuracoes/financeiro/plano-contas"
                      title="Gerenciar Plano de Contas"
                      style={{
                        ...addonBtnStyle,
                        textDecoration: 'none',
                      }}
                    >
                      <Edit3 size={14} />
                    </Link>

                    <button
                      type="button"
                      title="Pesquisar Conta Plano"
                      onClick={() => setShowPlanoContasModal(true)}
                      style={{
                        ...addonBtnStyle,
                        borderTopRightRadius: 7,
                        borderBottomRightRadius: 7,
                      }}
                    >
                      <Search size={14} />
                    </button>
                  </div>
                </div>

                {/* LINHA 5: Unidade/Empresa (sem seleção "----") & Centro de Custo (sem seleção "-----") */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: 10 }}>
                  <div>
                    <label htmlFor="cp-unidade" style={labelStyle}>
                      Unidade/Empresa
                    </label>
                    <div style={{ display: 'flex', alignItems: 'stretch' }}>
                      <select
                        id="cp-unidade"
                        value={unidadeEmpresa}
                        onChange={(e) => setUnidadeEmpresa(e.target.value)}
                        style={{
                          ...inputStyle,
                          height: 36,
                          background: '#f8fafc',
                        }}
                      >
                        <option value="">----</option>
                        <option value="Colégio Impacto — Matriz">Colégio Impacto — Matriz</option>
                        <option value="Colégio Impacto — Unidade Infantil">Colégio Impacto — Unidade Infantil</option>
                        <option value="Colégio Impacto — Ensino Médio">Colégio Impacto — Ensino Médio</option>
                        {unidadeEmpresa &&
                          ![
                            'Colégio Impacto — Matriz',
                            'Colégio Impacto — Unidade Infantil',
                            'Colégio Impacto — Ensino Médio',
                          ].includes(unidadeEmpresa) && <option value={unidadeEmpresa}>{unidadeEmpresa}</option>}
                      </select>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label htmlFor="cp-centro-custo" style={{ ...labelStyle, marginBottom: 0 }}>
                        Centro de Custo:
                      </label>
                      <Link
                        href="/configuracoes/financeiro/centro-custo"
                        style={{ fontSize: 10.5, fontWeight: 700, color: '#2563eb', textDecoration: 'none' }}
                      >
                        + Gerenciar
                      </Link>
                    </div>
                    <select
                      id="cp-centro-custo"
                      value={centroCusto}
                      onChange={(e) => setCentroCusto(e.target.value)}
                      style={{ ...inputStyle, height: 36 }}
                    >
                      <option value="">-----</option>
                      {listaCentrosCusto.map((cc) => (
                        <option key={cc.id} value={cc.id}>
                          {cc.label} ({cc.sigla})
                        </option>
                      ))}
                      {centroCusto && !listaCentrosCusto.some((cc) => cc.id === centroCusto) && (
                        <option value={centroCusto}>{centroCusto}</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* LINHA 6: Emissão | Valor (Sem o campo Carteira) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label htmlFor="cp-emissao" style={labelStyle}>
                      Emissão
                    </label>
                    <input
                      id="cp-emissao"
                      name="dataEmissao"
                      type="date"
                      value={dataEmissao}
                      onChange={(e) => setDataEmissao(e.target.value)}
                      style={{ ...inputStyle, height: 36 }}
                    />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label htmlFor="cp-valor-base" style={{ ...labelStyle, marginBottom: 0 }}>
                        Valor
                      </label>
                      {(numDesconto > 0 || numJuros > 0 || numMulta > 0 || totalRetencao > 0) && (
                        <span style={{ fontSize: 10.5, fontWeight: 800, color: '#047857' }}>
                          Líq: {formatCurrency(valorLiquidoCalculado)}
                        </span>
                      )}
                    </div>
                    <input
                      id="cp-valor-base"
                      name="valorBase"
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={valorBase}
                      onBlur={() => {
                        if (valorBase !== '' && numBase <= 0) {
                          setFormError('Informe um Valor (R$) maior que zero.')
                        }
                      }}
                      onChange={(e) => {
                        setValorBase(e.target.value)
                        if (formError) setFormError('')
                      }}
                      placeholder="0,00"
                      style={{
                        ...inputStyle,
                        height: 36,
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    />
                  </div>
                </div>

                {/* LINHA 7: Chave PIX do Favorecido | Linha Digitável / Código de Barras (Conforme Imagem 2) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 10 }}>
                  <div>
                    <label htmlFor="cp-chave-pix" style={labelStyle}>
                      Chave PIX do Favorecido
                    </label>
                    <input
                      id="cp-chave-pix"
                      type="text"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={chavePix}
                      onChange={(e) => setChavePix(e.target.value)}
                      placeholder="CNPJ, E-mail, Telefone ou Aleatória"
                      style={{ ...inputStyle, height: 36 }}
                    />
                  </div>
                  <div>
                    <label htmlFor="cp-linha-digitavel" style={labelStyle}>
                      Linha Digitável / Código de Barras
                    </label>
                    <input
                      id="cp-linha-digitavel"
                      type="text"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={linhaDigitavel}
                      onChange={(e) => setLinhaDigitavel(e.target.value)}
                      placeholder="00000.00000 00000.000000..."
                      style={{ ...inputStyle, height: 36, fontFamily: 'monospace' }}
                    />
                  </div>
                </div>

                {/* LINHA 8: Código Interno | Natureza do Custo | Alçada de Aprovação (Conforme Imagem 2) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <label htmlFor="cp-codigo" style={labelStyle}>
                      Código Interno
                    </label>
                    <input
                      id="cp-codigo"
                      type="text"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      style={{ ...inputStyle, height: 36 }}
                    />
                  </div>
                  <div>
                    <label htmlFor="cp-tipo-custo" style={labelStyle}>
                      Natureza do Custo
                    </label>
                    <select
                      id="cp-tipo-custo"
                      value={tipoCusto}
                      onChange={(e) => setTipoCusto(e.target.value as ContaPagarTipoCusto)}
                      style={{ ...inputStyle, height: 36 }}
                    >
                      <option value="fixo">Custo Fixo</option>
                      <option value="variavel">Custo Variável</option>
                      <option value="investimento">Investimento / CAPEX</option>
                      <option value="extraordinario">Extraordinário</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cp-aprovacao" style={labelStyle}>
                      Alçada de Aprovação
                    </label>
                    <select
                      id="cp-aprovacao"
                      value={aprovacaoStatus}
                      onChange={(e) => setAprovacaoStatus(e.target.value as any)}
                      style={{ ...inputStyle, height: 36 }}
                    >
                      <option value="aprovado">Aprovado para Pagamento</option>
                      <option value="pendente_aprovacao">Aguardando Diretoria</option>
                      <option value="rejeitado">Bloqueado / Revisão</option>
                    </select>
                  </div>
                </div>

                {/* LINHA 9: Observações sobre esta baixa / lançamento */}
                <div>
                  <label htmlFor="cp-observacoes" style={labelStyle}>
                    Observações sobre esta baixa / lançamento
                  </label>
                  <textarea
                    id="cp-observacoes"
                    name="observacoes"
                    rows={2}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Observações complementares, dados bancários ou justificativa..."
                    style={{ ...inputStyle, resize: 'vertical', minHeight: 54 }}
                  />
                </div>
              </div>
            )}

            {/* ABA 2: RATEIO POR CENTRO DE CUSTO (Acionada também pelo botão verde "Rateio" do rodapé) */}
            {activeSection === 'rateio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 10,
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#14532d' }}>
                      Rateio entre Centros de Custo / Segmentos
                    </div>
                    <div style={{ fontSize: 11.5, color: '#166534' }}>
                      Divida o valor líquido ({formatCurrency(valorLiquidoCalculado)}) entre múltiplos Centros de Custo.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={handleAplicarRateioPedagogicoPadrao}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 7,
                        background: '#ffffff',
                        border: '1px solid #86efac',
                        color: '#15803d',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Rateio Padrão (20/30/30/20%)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUsarRateio((v) => !v)
                        if (!usarRateio && rateioList.length === 0) {
                          const defaultCc =
                            centroCusto || listaCentrosCusto[0]?.id || CENTROS_CUSTO_ESCOLARES[0].id
                          setRateioList([{ centroCusto: defaultCc, percentual: 100, valor: valorLiquidoCalculado }])
                        }
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 7,
                        background: usarRateio ? '#fff1f2' : '#16a34a',
                        border: usarRateio ? '1px solid #fecdd3' : 'none',
                        color: usarRateio ? '#be123c' : '#ffffff',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {usarRateio ? 'Desativar Rateio' : 'Ativar Rateio'}
                    </button>
                  </div>
                </div>

                {usarRateio ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {rateioComValores.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.6fr 110px 130px 36px',
                            gap: 8,
                            alignItems: 'center',
                            padding: '8px 10px',
                            borderRadius: 8,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <select
                            aria-label={`Centro de Custo ${idx + 1}`}
                            value={item.centroCusto}
                            onChange={(e) => {
                              const val = e.target.value
                              setRateioList((prev) => prev.map((r, i) => (i === idx ? { ...r, centroCusto: val } : r)))
                            }}
                            style={inputStyle}
                          >
                            {listaCentrosCusto.map((cc) => (
                              <option key={cc.id} value={cc.id}>
                                {cc.label} ({cc.sigla})
                              </option>
                            ))}
                          </select>

                          <div style={{ position: 'relative' }}>
                            <input
                              aria-label={`Percentual ${idx + 1}`}
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={item.percentual}
                              onChange={(e) => {
                                const pct = Math.max(0, Number(e.target.value) || 0)
                                setRateioList((prev) => prev.map((r, i) => (i === idx ? { ...r, percentual: pct } : r)))
                              }}
                              style={{ ...inputStyle, paddingRight: 24 }}
                            />
                            <span
                              style={{
                                position: 'absolute',
                                right: 8,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontSize: 11,
                                color: '#64748b',
                                fontWeight: 700,
                              }}
                            >
                              %
                            </span>
                          </div>

                          <div
                            style={{
                              padding: '8px 10px',
                              borderRadius: 7,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontWeight: 700,
                              fontSize: 12.5,
                              textAlign: 'right',
                            }}
                          >
                            {formatCurrency(item.valor)}
                          </div>

                          <button
                            type="button"
                            onClick={() => setRateioList((prev) => prev.filter((_, i) => i !== idx))}
                            aria-label="Remover linha de rateio"
                            style={{
                              height: 34,
                              borderRadius: 7,
                              background: '#fff1f2',
                              border: '1px solid #fecdd3',
                              color: '#be123c',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <button
                        type="button"
                        onClick={handleAddRateioRow}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '6px 12px',
                          borderRadius: 7,
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#334155',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={13} />
                        Adicionar Centro de Custo
                      </button>

                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: Math.abs(somaPercentualRateio - 100) <= 0.5 ? '#15803d' : '#b45309',
                        }}
                      >
                        Total: {somaPercentualRateio}% ({formatCurrency(rateioComValores.reduce((a, b) => a + b.valor, 0))})
                      </span>
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      padding: 20,
                      borderRadius: 10,
                      background: '#f8fafc',
                      border: '1px dashed #cbd5e1',
                      textAlign: 'center',
                      color: '#64748b',
                      fontSize: 12.5,
                    }}
                  >
                    100% da despesa será alocada no Centro de Custo selecionado:{' '}
                    <strong style={{ color: '#0f172a' }}>{centroCusto || '-----'}</strong>.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RODAPÉ NO ESTILO DA IMAGEM 2 (Botões Rateio | Gerar Parcelas | Fechar + Resumo inteligente) */}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: 12, color: '#475569' }}>
              {qtdParcelasGeradas > 1 && !editingRecord ? (
                <span>
                  <strong>{qtdParcelasGeradas}x</strong> de{' '}
                  <strong style={{ color: '#0f172a' }}>
                    {formatCurrency(parcelasPreview[0]?.valorLiquido ?? valorLiquidoCalculado)}
                  </strong>{' '}
                  • Total:{' '}
                  <strong style={{ color: '#2563eb', fontSize: 13.5 }}>{formatCurrency(totalCompromisso)}</strong>
                </span>
              ) : (
                <span>
                  Total Líquido:{' '}
                  <strong style={{ color: '#047857', fontSize: 14 }}>
                    {formatCurrency(valorLiquidoCalculado)}
                  </strong>
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Botão Verde "Rateio" (Idêntico à Imagem 2) */}
              <button
                type="button"
                onClick={() => setActiveSection((prev) => (prev === 'rateio' ? 'dados' : 'rateio'))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 6,
                  background: '#5cb85c',
                  border: '1px solid #4cae4c',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Split size={14} />
                {usarRateio ? `Rateio (${somaPercentualRateio}%)` : 'Rateio'}
              </button>

              {/* Botão Azul "✓ Gerar Parcelas" (Idêntico à Imagem 2) */}
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 6,
                  background: '#337ab7',
                  border: '1px solid #2e6da4',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: saving ? 'wait' : 'pointer',
                }}
              >
                <Check size={15} />
                {saving
                  ? 'Salvando...'
                  : editingRecord
                    ? 'Salvar Alterações'
                    : qtdParcelasGeradas > 1
                      ? `Gerar Parcelas (${qtdParcelasGeradas}x)`
                      : 'Gerar Parcelas'}
              </button>

              {/* Botão Branco "✕ Fechar" (Idêntico à Imagem 2) */}
              <button
                type="button"
                onClick={onClose}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '8px 14px',
                  borderRadius: 6,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
                Fechar
              </button>
            </div>
          </div>
        </form>

        {/* MODAL DE BUSCA E SELEÇÃO DO PLANO DE CONTAS */}
        {showPlanoContasModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-selecionar-plano-title"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1200,
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={() => setShowPlanoContasModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 620,
                maxHeight: '80vh',
                background: '#ffffff',
                borderRadius: 14,
                border: '1px solid #cbd5e1',
                boxShadow: '0 25px 60px rgba(15, 23, 42, 0.3)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <BookOpen size={18} color="#2563eb" />
                  <h3 id="modal-selecionar-plano-title" style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                    Selecionar Conta Plano
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPlanoContasModal(false)}
                  aria-label="Fechar seleção de plano de contas"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 6,
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={15}
                    style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}
                  />
                  <input
                    type="text"
                    autoFocus
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={buscaPlanoContas}
                    onChange={(e) => setBuscaPlanoContas(e.target.value)}
                    placeholder="Buscar por código (ex: 50.01) ou descrição da conta..."
                    style={{
                      ...inputStyle,
                      paddingLeft: 34,
                      background: '#f8fafc',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(
                    [
                      { id: 'todos', label: `Todos (${listaPlanoContas.length})` },
                      { id: 'despesas', label: `📉 Despesas (${listaPlanoContas.filter((p) => p.grupoConta === 'despesas').length})` },
                      { id: 'investimentos', label: `🪙 Investimentos (${listaPlanoContas.filter((p) => p.grupoConta === 'investimentos').length})` },
                      { id: 'receitas', label: `📈 Receitas (${listaPlanoContas.filter((p) => p.grupoConta === 'receitas').length})` },
                    ] as const
                  ).map((g) => {
                    const active = filtroGrupoPlano === g.id
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setFiltroGrupoPlano(g.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: active ? 800 : 600,
                          background: active ? '#2563eb' : '#f1f5f9',
                          color: active ? '#ffffff' : '#475569',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {g.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                {planosFiltradosModal.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                    Nenhuma conta encontrada para a busca informada.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {planosFiltradosModal.map((item) => {
                      const isSelected =
                        (planoContasId && item.id === planoContasId) ||
                        (!planoContasId && categoria === item.value)
                      const depth = item.codPlano ? Math.max(0, item.codPlano.split('.').length - 1) : 0
                      const tc = TIPO_CONTA_BADGE[item.tipo] || TIPO_CONTA_BADGE.analitico
                      const gc = GRUPO_CONTA_BADGE[item.grupoConta] || GRUPO_CONTA_BADGE.despesas

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectPlanoConta(item)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            width: '100%',
                            padding: '8px 10px',
                            paddingLeft: 10 + depth * 14,
                            borderRadius: 8,
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            border: isSelected ? '1.5px solid #2563eb' : '1px solid #f1f5f9',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                            {item.codPlano && (
                              <code
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 800,
                                  color: gc.color,
                                  background: gc.bg,
                                  padding: '2px 6px',
                                  borderRadius: 5,
                                  flexShrink: 0,
                                }}
                              >
                                {item.codPlano}
                              </code>
                            )}
                            <span
                              style={{
                                fontSize: 12.5,
                                fontWeight: item.tipo === 'sintetico' ? 800 : 600,
                                color: '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {item.descricao}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: '2px 6px',
                                borderRadius: 5,
                                color: tc.color,
                                background: tc.bg,
                              }}
                            >
                              {tc.label}
                            </span>
                            {isSelected && <Check size={14} color="#2563eb" />}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
