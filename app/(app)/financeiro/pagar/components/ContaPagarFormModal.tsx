'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  X, Plus, Trash2, Building2, DollarSign,
  AlertTriangle, Split, Repeat, Percent
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  type ContaPagarRecord,
  type FornecedorEscolar,
  type RateioCentroCustoItem,
  type ContaPagarPrioridade,
  type ContaPagarTipoCusto,
  type ContaPagarStatus,
  type CentroCustoEscolarOption,
  CATEGORIAS_ESCOLARES,
  CENTROS_CUSTO_ESCOLARES,
  FORMAS_PAGAMENTO_CONTAS_PAGAR,
  CAIXAS_BANCOS_ESCOLARES,
  calcularValorLiquido,
} from '../types'

interface ContaPagarFormModalProps {
  isOpen: boolean
  onClose: () => void
  editingRecord: ContaPagarRecord | null
  fornecedores: FornecedorEscolar[]
  planoContas: any[]
  eventosFinanceiros: any[]
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

export function ContaPagarFormModal({
  isOpen,
  onClose,
  editingRecord,
  fornecedores,
  planoContas,
  eventosFinanceiros,
  centrosCusto,
  onSave,
  onQuickCreateFornecedor,
}: ContaPagarFormModalProps) {
  const listaCentrosCusto = useMemo(
    () => (Array.isArray(centrosCusto) && centrosCusto.length > 0 ? centrosCusto : CENTROS_CUSTO_ESCOLARES),
    [centrosCusto]
  )
  const hojeStr = useMemo(() => new Date().toISOString().split('T')[0], [])
  const mesAtualStr = hojeStr.slice(0, 7)

  const [activeSection, setActiveSection] = useState<'dados' | 'financeiro' | 'rateio' | 'parcelamento'>('dados')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Campos principais
  const [codigo, setCodigo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [fornecedorNome, setFornecedorNome] = useState('')
  const [fornecedorDocumento, setFornecedorDocumento] = useState('')
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_ESCOLARES[0].id)
  const [subcategoria, setSubcategoria] = useState('')
  const [centroCusto, setCentroCusto] = useState<string>(CENTROS_CUSTO_ESCOLARES[0].id)
  const [planoContasId, setPlanoContasId] = useState('')
  const [eventoId, setEventoId] = useState('')
  const [tipoCusto, setTipoCusto] = useState<ContaPagarTipoCusto>('fixo')
  const [prioridade, setPrioridade] = useState<ContaPagarPrioridade>('media')

  // Datas e Status
  const [dataEmissao, setDataEmissao] = useState(hojeStr)
  const [vencimento, setVencimento] = useState(hojeStr)
  const [competencia, setCompetencia] = useState(mesAtualStr)
  const [status, setStatus] = useState<ContaPagarStatus>('pendente')
  const [dataPagamento, setDataPagamento] = useState(hojeStr)
  const [aprovacaoStatus, setAprovacaoStatus] = useState<'aprovado' | 'pendente_aprovacao' | 'rejeitado'>('aprovado')

  // Valores e retenções
  const [valorBase, setValorBase] = useState<string>('0')
  const [desconto, setDesconto] = useState<string>('0')
  const [juros, setJuros] = useState<string>('0')
  const [multa, setMulta] = useState<string>('0')
  const [mostrarRetencoes, setMostrarRetencoes] = useState(false)
  const [retIss, setRetIss] = useState<string>('0')
  const [retIrrf, setRetIrrf] = useState<string>('0')
  const [retInss, setRetInss] = useState<string>('0')
  const [retCsrf, setRetCsrf] = useState<string>('0')

  // Pagamento e Documentos
  const [formaPagamento, setFormaPagamento] = useState<string>('PIX')
  const [caixaOrigem, setCaixaOrigem] = useState<string>(CAIXAS_BANCOS_ESCOLARES[0])
  const [tipoDocumento, setTipoDocumento] = useState<'NF-e' | 'NFS-e' | 'Boleto' | 'Recibo' | 'Contrato' | 'DARF' | 'Folha' | 'Fatura' | 'Outro'>('NFS-e')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [notaFiscal, setNotaFiscal] = useState('')
  const [chavePix, setChavePix] = useState('')
  const [linhaDigitavel, setLinhaDigitavel] = useState('')
  const [observacoes, setObservacoes] = useState('')

  // Rateio Multi-Centro de Custo
  const [usarRateio, setUsarRateio] = useState(false)
  const [rateioList, setRateioList] = useState<RateioCentroCustoItem[]>([])

  // Parcelamento / Recorrência
  const [modoParcelamento, setModoParcelamento] = useState<'unico' | 'parcelado' | 'recorrente'>('unico')
  const [qtdParcelas, setQtdParcelas] = useState<number>(2)
  const [modoValorParcela, setModoValorParcela] = useState<'dividir' | 'repetir'>('repetir')
  const [frequenciaRecorrencia, setFrequenciaRecorrencia] = useState<'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'>('mensal')
  const [parcelasPreview, setParcelasPreview] = useState<ParcelaPreviewItem[]>([])

  // Quick Fornecedor inline
  const [showQuickForn, setShowQuickForn] = useState(false)
  const [qfNome, setQfNome] = useState('')
  const [qfDoc, setQfDoc] = useState('')
  const [qfPix, setQfPix] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setFormError('')
    setActiveSection('dados')

    if (editingRecord) {
      setCodigo(editingRecord.codigo || '')
      setDescricao(editingRecord.descricao || '')
      setFornecedorId(editingRecord.fornecedorId || '')
      setFornecedorNome(editingRecord.fornecedorNome || '')
      setFornecedorDocumento(editingRecord.fornecedorDocumento || '')
      setCategoria(editingRecord.categoria || CATEGORIAS_ESCOLARES[0].id)
      setSubcategoria(editingRecord.subcategoria || '')
      setCentroCusto(editingRecord.centroCusto || CENTROS_CUSTO_ESCOLARES[0].id)
      setPlanoContasId(editingRecord.planoContasId || '')
      setEventoId(editingRecord.eventoId || '')
      setTipoCusto(editingRecord.tipoCusto || 'fixo')
      setPrioridade(editingRecord.prioridade || 'media')
      setDataEmissao(editingRecord.dataEmissao || hojeStr)
      setVencimento(editingRecord.vencimento || hojeStr)
      setCompetencia(editingRecord.competencia || (editingRecord.vencimento || hojeStr).slice(0, 7))
      setStatus(editingRecord.status || 'pendente')
      setDataPagamento(editingRecord.dataPagamento || hojeStr)
      setAprovacaoStatus(editingRecord.aprovacaoStatus || 'aprovado')
      setValorBase(String(editingRecord.valorBase ?? editingRecord.valor ?? 0))
      setDesconto(String(editingRecord.desconto ?? 0))
      setJuros(String(editingRecord.juros ?? 0))
      setMulta(String(editingRecord.multa ?? 0))

      const det = editingRecord.detalhesRetencao
      const totalRet = Number(editingRecord.retencaoImpostos || 0)
      setMostrarRetencoes(totalRet > 0)
      setRetIss(String(det?.iss ?? (totalRet > 0 && !det ? totalRet : 0)))
      setRetIrrf(String(det?.irrf ?? 0))
      setRetInss(String(det?.inss ?? 0))
      setRetCsrf(String(det?.pisCofinsCsll ?? 0))

      setFormaPagamento(editingRecord.formaPagamento || 'PIX')
      setCaixaOrigem(editingRecord.caixaOrigem || CAIXAS_BANCOS_ESCOLARES[0])
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

      setModoParcelamento(editingRecord.recorrente ? 'recorrente' : 'unico')
      setQtdParcelas(1)
    } else {
      const randCode = `CP-${new Date().getFullYear()}-${String(Math.floor(100 + Math.random() * 899))}`
      setCodigo(randCode)
      setDescricao('')
      setFornecedorId('')
      setFornecedorNome('')
      setFornecedorDocumento('')
      setCategoria(CATEGORIAS_ESCOLARES[0].id)
      setSubcategoria('')
      setCentroCusto(CENTROS_CUSTO_ESCOLARES[0].id)
      setPlanoContasId('')
      setEventoId('')
      setTipoCusto('fixo')
      setPrioridade('media')
      setDataEmissao(hojeStr)
      setVencimento(hojeStr)
      setCompetencia(mesAtualStr)
      setStatus('pendente')
      setDataPagamento(hojeStr)
      setAprovacaoStatus('aprovado')
      setValorBase('')
      setDesconto('0')
      setJuros('0')
      setMulta('0')
      setMostrarRetencoes(false)
      setRetIss('0')
      setRetIrrf('0')
      setRetInss('0')
      setRetCsrf('0')
      setFormaPagamento('PIX')
      setCaixaOrigem(CAIXAS_BANCOS_ESCOLARES[0])
      setTipoDocumento('NFS-e')
      setNumeroDocumento('')
      setNotaFiscal('')
      setChavePix('')
      setLinhaDigitavel('')
      setObservacoes('')
      setUsarRateio(false)
      setRateioList([])
      setModoParcelamento('unico')
      setQtdParcelas(2)
      setModoValorParcela('repetir')
    }
  }, [isOpen, editingRecord, hojeStr, mesAtualStr])

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

  // Atualiza preview de parcelas quando parâmetros mudam
  useEffect(() => {
    if (modoParcelamento === 'unico' || editingRecord) {
      setParcelasPreview([])
      return
    }
    const count = Math.min(60, Math.max(2, Number(qtdParcelas) || 2))
    const stepMonths =
      frequenciaRecorrencia === 'bimestral'
        ? 2
        : frequenciaRecorrencia === 'trimestral'
          ? 3
          : frequenciaRecorrencia === 'semestral'
            ? 6
            : frequenciaRecorrencia === 'anual'
              ? 12
              : 1

    const list: ParcelaPreviewItem[] = []
    for (let i = 0; i < count; i++) {
      const venc = addMonthsISO(vencimento || hojeStr, i * stepMonths)
      const comp = venc.slice(0, 7)
      const vBase =
        modoValorParcela === 'dividir'
          ? Math.round((numBase / count) * 100) / 100
          : numBase
      const vLiq =
        modoValorParcela === 'dividir'
          ? Math.round((valorLiquidoCalculado / count) * 100) / 100
          : valorLiquidoCalculado
      list.push({
        numero: i + 1,
        total: count,
        vencimento: venc,
        competencia: comp,
        valorBase: vBase,
        valorLiquido: vLiq,
        descricao: `${descricao || 'Despesa'} (${String(i + 1).padStart(2, '0')}/${String(count).padStart(2, '0')})`,
      })
    }
    setParcelasPreview(list)
  }, [modoParcelamento, qtdParcelas, modoValorParcela, frequenciaRecorrencia, vencimento, hojeStr, numBase, valorLiquidoCalculado, descricao, editingRecord])

  // Sincroniza valores em R$ do rateio quando valorLiquido muda
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

  const handleSelectFornecedor = (id: string) => {
    setFornecedorId(id)
    const found = fornecedores.find((f) => f.id === id)
    if (found) {
      setFornecedorNome(found.nome)
      setFornecedorDocumento(found.documento || '')
      if (found.categoriaPadrao) setCategoria(found.categoriaPadrao)
      if (found.centroCustoPadrao) setCentroCusto(found.centroCustoPadrao)
      if (found.formaPagamentoPadrao) setFormaPagamento(found.formaPagamentoPadrao)
      if (found.chavePix) setChavePix(found.chavePix)
    }
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
    const nextCentro = listaCentrosCusto.find((c) => !used.has(c.id))?.id || listaCentrosCusto[0]?.id || CENTROS_CUSTO_ESCOLARES[0].id
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

    if (!descricao.trim()) {
      setFormError('Informe a descrição da despesa ou compromisso financeiro.')
      setActiveSection('dados')
      return
    }
    if (!fornecedorNome.trim()) {
      setFormError('Informe ou selecione o Fornecedor / Credor.')
      setActiveSection('dados')
      return
    }
    if (numBase <= 0) {
      setFormError('O valor bruto da despesa deve ser maior que zero.')
      setActiveSection('financeiro')
      return
    }
    if (usarRateio && rateioComValores.length > 0 && Math.abs(somaPercentualRateio - 100) > 0.5) {
      setFormError(`A soma do rateio por Centro de Custo deve ser 100% (atual: ${somaPercentualRateio}%).`)
      setActiveSection('rateio')
      return
    }

    setSaving(true)
    try {
      const basePayload: Partial<ContaPagarRecord> = {
        id: editingRecord?.id,
        codigo: codigo.trim() || undefined,
        descricao: descricao.trim(),
        fornecedorId: fornecedorId || undefined,
        fornecedorNome: fornecedorNome.trim(),
        fornecedorDocumento: fornecedorDocumento.trim() || undefined,
        categoria,
        subcategoria: subcategoria.trim() || undefined,
        centroCusto,
        rateio: usarRateio && rateioComValores.length > 0 ? rateioComValores : [],
        planoContasId: planoContasId || undefined,
        eventoId: eventoId || undefined,
        tipoCusto,
        prioridade,
        dataEmissao,
        vencimento,
        competencia: competencia || vencimento.slice(0, 7),
        status,
        dataPagamento: status === 'pago' ? dataPagamento : undefined,
        valorPago: status === 'pago' ? valorLiquidoCalculado : 0,
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
        caixaOrigem: status === 'pago' ? caixaOrigem : undefined,
        tipoDocumento,
        numeroDocumento: numeroDocumento.trim() || undefined,
        notaFiscal: notaFiscal.trim() || undefined,
        chavePix: chavePix.trim() || undefined,
        linhaDigitavel: linhaDigitavel.trim() || undefined,
        observacoes: observacoes.trim() || undefined,
        recorrente: modoParcelamento === 'recorrente',
        frequenciaRecorrencia: modoParcelamento !== 'unico' ? frequenciaRecorrencia : undefined,
      }

      if (!editingRecord && modoParcelamento !== 'unico' && parcelasPreview.length > 1) {
        const groupId = `GRP-${Date.now().toString(36).toUpperCase()}`
        const multiplePayloads: Partial<ContaPagarRecord>[] = parcelasPreview.map((p, idx) => ({
          ...basePayload,
          id: `CP-${Date.now().toString(36).toUpperCase()}-P${String(p.numero).padStart(2, '0')}`,
          codigo: `${codigo.trim() || 'CP'}-${String(p.numero).padStart(2, '0')}/${String(p.total).padStart(2, '0')}`,
          descricao: p.descricao,
          vencimento: p.vencimento,
          competencia: p.competencia,
          valorBase: p.valorBase,
          valor: p.valorLiquido,
          desconto: modoValorParcela === 'dividir' ? Math.round((numDesconto / p.total) * 100) / 100 : numDesconto,
          juros: modoValorParcela === 'dividir' ? Math.round((numJuros / p.total) * 100) / 100 : numJuros,
          multa: modoValorParcela === 'dividir' ? Math.round((numMulta / p.total) * 100) / 100 : numMulta,
          retencaoImpostos: modoValorParcela === 'dividir' ? Math.round((totalRetencao / p.total) * 100) / 100 : totalRetencao,
          status: idx === 0 ? status : 'agendado',
          dataPagamento: idx === 0 && status === 'pago' ? dataPagamento : undefined,
          valorPago: idx === 0 && status === 'pago' ? p.valorLiquido : 0,
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
        await onSave([basePayload])
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
    fontSize: 11,
    fontWeight: 700,
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    color: '#0f172a',
    fontSize: 13,
    outline: 'none',
  }

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
        backdropFilter: 'blur(6px)',
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
          maxWidth: 920,
          maxHeight: '92vh',
          background: '#ffffff',
          border: '1px solid #cbd5e1',
          borderRadius: 20,
          boxShadow: '0 25px 60px rgba(15, 23, 42, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e11d48',
              }}
            >
              <DollarSign size={20} />
            </div>
            <div>
              <h2 id="modal-conta-pagar-title" style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>
                {editingRecord ? `Editar Conta a Pagar • ${editingRecord.codigo || editingRecord.id}` : 'Novo Lançamento de Conta a Pagar'}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#475569' }}>
                Controladoria Escolar • Classificação por Categoria, Segmento Pedagógico, Retenções Fiscais e Parcelamento
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Navigation Sub-tabs */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            padding: '10px 24px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f1f5f9',
            overflowX: 'auto',
          }}
        >
          {[
            { id: 'dados', label: '1. Identificação & Classificação', icon: <Building2 size={14} /> },
            { id: 'financeiro', label: '2. Valores, Impostos & Pagamento', icon: <DollarSign size={14} /> },
            { id: 'rateio', label: `3. Rateio por Segmento (${usarRateio ? `${somaPercentualRateio}%` : 'Padrão'})`, icon: <Split size={14} /> },
            ...(!editingRecord
              ? [{ id: 'parcelamento', label: `4. Parcelamento / Recorrência (${modoParcelamento === 'unico' ? 'À Vista' : `${qtdParcelas}x`})`, icon: <Repeat size={14} /> }]
              : []),
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
                  gap: 7,
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: active ? '1px solid #38bdf8' : '1px solid transparent',
                  background: active ? '#e0f2fe' : '#ffffff',
                  color: active ? '#0369a1' : '#475569',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {formError && (
              <div
                style={{
                  marginBottom: 16,
                  padding: '12px 16px',
                  borderRadius: 12,
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  color: '#be123c',
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <AlertTriangle size={16} />
                <span>{formError}</span>
              </div>
            )}

            {/* SECTION 1: IDENTIFICAÇÃO E CLASSIFICAÇÃO ESCOLAR */}
            {activeSection === 'dados' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 14 }}>
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
                      placeholder="Ex: CP-2026-001"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="cp-descricao" style={labelStyle}>
                      Descrição da Despesa / Compromisso *
                    </label>
                    <input
                      id="cp-descricao"
                      type="text"
                      required
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Ex: Folha de Pagamento Docente, Energia Elétrica Campus, Material Didático..."
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* Seleção de Fornecedor + Quick Create */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Fornecedor / Credor Escolar
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowQuickForn((v) => !v)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '5px 10px',
                        borderRadius: 8,
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        color: '#047857',
                        fontSize: 11,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={13} />
                      {showQuickForn ? 'Fechar Cadastro Rápido' : 'Cadastrar Novo Fornecedor'}
                    </button>
                  </div>

                  {showQuickForn && (
                    <div
                      style={{
                        marginBottom: 14,
                        padding: 14,
                        borderRadius: 12,
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        display: 'grid',
                        gridTemplateColumns: '1.4fr 1fr 1fr auto',
                        gap: 10,
                        alignItems: 'end',
                      }}
                    >
                      <div>
                        <label htmlFor="qf-nome" style={labelStyle}>Razão Social / Nome</label>
                        <input
                          id="qf-nome"
                          type="text"
                          value={qfNome}
                          onChange={(e) => setQfNome(e.target.value)}
                          placeholder="Nome do fornecedor"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label htmlFor="qf-doc" style={labelStyle}>CNPJ / CPF</label>
                        <input
                          id="qf-doc"
                          type="text"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          value={qfDoc}
                          onChange={(e) => setQfDoc(e.target.value)}
                          placeholder="00.000.000/0001-00"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label htmlFor="qf-pix" style={labelStyle}>Chave PIX</label>
                        <input
                          id="qf-pix"
                          type="text"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          value={qfPix}
                          onChange={(e) => setQfPix(e.target.value)}
                          placeholder="CNPJ, E-mail ou Telefone"
                          style={inputStyle}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveQuickFornecedor}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: '#059669',
                          border: 'none',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        Salvar Credor
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr', gap: 12 }}>
                    <div>
                      <label htmlFor="cp-fornecedor-select" style={labelStyle}>
                        Selecionar da Base de Credores
                      </label>
                      <select
                        id="cp-fornecedor-select"
                        value={fornecedorId}
                        onChange={(e) => handleSelectFornecedor(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">-- Digitar manualmente ou escolher --</option>
                        {fornecedores.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.nomeFantasia || f.nome} {f.documento ? `(${f.documento})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="cp-fornecedor-nome" style={labelStyle}>
                        Nome do Fornecedor / Beneficiário *
                      </label>
                      <input
                        id="cp-fornecedor-nome"
                        type="text"
                        required
                        value={fornecedorNome}
                        onChange={(e) => setFornecedorNome(e.target.value)}
                        placeholder="Razão Social ou Nome Completo"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="cp-fornecedor-doc" style={labelStyle}>
                        CNPJ / CPF do Credor
                      </label>
                      <input
                        id="cp-fornecedor-doc"
                        type="text"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        value={fornecedorDocumento}
                        onChange={(e) => setFornecedorDocumento(e.target.value)}
                        placeholder="00.000.000/0001-00"
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                {/* Classificação Escolar: Categoria, Centro de Custo, Tipo de Custo, Prioridade */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 0.8fr 0.8fr', gap: 12 }}>
                  <div>
                    <label htmlFor="cp-categoria" style={labelStyle}>
                      Categoria de Despesa Escolar
                    </label>
                    <select
                      id="cp-categoria"
                      value={categoria}
                      onChange={(e) => setCategoria(e.target.value)}
                      style={inputStyle}
                    >
                      {CATEGORIAS_ESCOLARES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label} ({cat.grupoDre})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <label htmlFor="cp-centro-custo" style={{ ...labelStyle, marginBottom: 0 }}>
                        Centro de Custo / Segmento Principal
                      </label>
                      <Link
                        href="/configuracoes/financeiro/centro-custo"
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          color: '#0284c7',
                          textDecoration: 'none',
                        }}
                      >
                        + Gerenciar
                      </Link>
                    </div>
                    <select
                      id="cp-centro-custo"
                      value={centroCusto}
                      onChange={(e) => setCentroCusto(e.target.value)}
                      style={inputStyle}
                    >
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
                  <div>
                    <label htmlFor="cp-tipo-custo" style={labelStyle}>
                      Natureza do Custo
                    </label>
                    <select
                      id="cp-tipo-custo"
                      value={tipoCusto}
                      onChange={(e) => setTipoCusto(e.target.value as ContaPagarTipoCusto)}
                      style={inputStyle}
                    >
                      <option value="fixo">Custo Fixo</option>
                      <option value="variavel">Custo Variável</option>
                      <option value="investimento">Investimento / CAPEX</option>
                      <option value="extraordinario">Extraordinário</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cp-prioridade" style={labelStyle}>
                      Prioridade Operacional
                    </label>
                    <select
                      id="cp-prioridade"
                      value={prioridade}
                      onChange={(e) => setPrioridade(e.target.value as ContaPagarPrioridade)}
                      style={inputStyle}
                    >
                      <option value="critica">Crítica (Essencial)</option>
                      <option value="alta">Alta</option>
                      <option value="media">Média / Normal</option>
                      <option value="baixa">Baixa</option>
                    </select>
                  </div>
                </div>

                {/* Datas e Integração Contábil DRE */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div>
                    <label htmlFor="cp-data-emissao" style={labelStyle}>
                      Data de Emissão
                    </label>
                    <input
                      id="cp-data-emissao"
                      type="date"
                      value={dataEmissao}
                      onChange={(e) => setDataEmissao(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="cp-vencimento" style={labelStyle}>
                      Data de Vencimento *
                    </label>
                    <input
                      id="cp-vencimento"
                      type="date"
                      required
                      value={vencimento}
                      onChange={(e) => {
                        setVencimento(e.target.value)
                        if (e.target.value) setCompetencia(e.target.value.slice(0, 7))
                      }}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="cp-competencia" style={labelStyle}>
                      Mês de Competência (DRE)
                    </label>
                    <input
                      id="cp-competencia"
                      type="month"
                      value={competencia}
                      onChange={(e) => setCompetencia(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="cp-aprovacao" style={labelStyle}>
                      Alçada de Aprovação
                    </label>
                    <select
                      id="cp-aprovacao"
                      value={aprovacaoStatus}
                      onChange={(e) => setAprovacaoStatus(e.target.value as any)}
                      style={inputStyle}
                    >
                      <option value="aprovado">Aprovado para Pagamento</option>
                      <option value="pendente_aprovacao">Aguardando Diretoria</option>
                      <option value="rejeitado">Bloqueado / Revisão</option>
                    </select>
                  </div>
                </div>

                {/* Plano de Contas & Eventos Financeiros (Integração DRE) */}
                {(planoContas.length > 0 || eventosFinanceiros.length > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label htmlFor="cp-plano-contas" style={labelStyle}>
                        Vincular ao Plano de Contas (DRE Oficial)
                      </label>
                      <select
                        id="cp-plano-contas"
                        value={planoContasId}
                        onChange={(e) => setPlanoContasId(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">-- Automático pela Categoria --</option>
                        {planoContas.map((p: any) => (
                          <option key={p.id} value={p.id}>
                            {p.codigo ? `${p.codigo} - ` : ''}{p.nome || p.descricao}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="cp-evento-fin" style={labelStyle}>
                        Evento Financeiro Vinculado
                      </label>
                      <select
                        id="cp-evento-fin"
                        value={eventoId}
                        onChange={(e) => setEventoId(e.target.value)}
                        style={inputStyle}
                      >
                        <option value="">-- Nenhum evento específico --</option>
                        {eventosFinanceiros.map((ev: any) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.nome || ev.descricao}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SECTION 2: VALORES, RETENÇÕES FISCAIS E DADOS BANCÁRIOS/DOCUMENTOS */}
            {activeSection === 'financeiro' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Calculadora de Valor Líquido */}
                <div
                  style={{
                    padding: 18,
                    borderRadius: 16,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, alignItems: 'end' }}>
                    <div>
                      <label htmlFor="cp-valor-base" style={labelStyle}>
                        Valor Bruto (R$) *
                      </label>
                      <input
                        id="cp-valor-base"
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={valorBase}
                        onChange={(e) => setValorBase(e.target.value)}
                        placeholder="0,00"
                        style={{ ...inputStyle, fontSize: 15, fontWeight: 800, borderColor: '#38bdf8' }}
                      />
                    </div>
                    <div>
                      <label htmlFor="cp-desconto" style={labelStyle}>
                        (-) Desconto (R$)
                      </label>
                      <input
                        id="cp-desconto"
                        type="number"
                        step="0.01"
                        min="0"
                        value={desconto}
                        onChange={(e) => setDesconto(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="cp-juros" style={labelStyle}>
                        (+) Juros (R$)
                      </label>
                      <input
                        id="cp-juros"
                        type="number"
                        step="0.01"
                        min="0"
                        value={juros}
                        onChange={(e) => setJuros(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="cp-multa" style={labelStyle}>
                        (+) Multa (R$)
                      </label>
                      <input
                        id="cp-multa"
                        type="number"
                        step="0.01"
                        min="0"
                        value={multa}
                        onChange={(e) => setMulta(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 12,
                        background: '#ecfdf5',
                        border: '1px solid #a7f3d0',
                        textAlign: 'right',
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                        Valor Líquido a Pagar
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#047857', marginTop: 2 }}>
                        {formatCurrency(valorLiquidoCalculado)}
                      </div>
                    </div>
                  </div>

                  {/* Retenções Fiscais na Fonte */}
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <button
                        type="button"
                        onClick={() => setMostrarRetencoes((v) => !v)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#0369a1',
                          fontSize: 12,
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: 0,
                        }}
                      >
                        <Percent size={14} />
                        {mostrarRetencoes
                          ? 'Ocultar Retenções de Impostos na Fonte (ISS / IRRF / INSS / CSRF)'
                          : `Informar Retenções Fiscais na Fonte (ISS, IRRF, INSS, PIS/COFINS/CSLL) ${totalRetencao > 0 ? `• Retido: ${formatCurrency(totalRetencao)}` : ''}`}
                      </button>
                      {totalRetencao > 0 && (
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#b45309' }}>
                          Total Retido na Fonte: - {formatCurrency(totalRetencao)}
                        </span>
                      )}
                    </div>

                    {mostrarRetencoes && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
                        <div>
                          <label htmlFor="cp-ret-iss" style={labelStyle}>ISS Retido (R$)</label>
                          <input
                            id="cp-ret-iss"
                            type="number"
                            step="0.01"
                            min="0"
                            value={retIss}
                            onChange={(e) => setRetIss(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label htmlFor="cp-ret-irrf" style={labelStyle}>IRRF Retido (R$)</label>
                          <input
                            id="cp-ret-irrf"
                            type="number"
                            step="0.01"
                            min="0"
                            value={retIrrf}
                            onChange={(e) => setRetIrrf(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label htmlFor="cp-ret-inss" style={labelStyle}>INSS Retido 11% (R$)</label>
                          <input
                            id="cp-ret-inss"
                            type="number"
                            step="0.01"
                            min="0"
                            value={retInss}
                            onChange={(e) => setRetInss(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                        <div>
                          <label htmlFor="cp-ret-csrf" style={labelStyle}>PIS/COFINS/CSLL 4,65% (R$)</label>
                          <input
                            id="cp-ret-csrf"
                            type="number"
                            step="0.01"
                            min="0"
                            value={retCsrf}
                            onChange={(e) => setRetCsrf(e.target.value)}
                            style={inputStyle}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status, Forma de Pagamento e Documento Fiscal */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  <div>
                    <label htmlFor="cp-status" style={labelStyle}>Situação do Título</label>
                    <select
                      id="cp-status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as ContaPagarStatus)}
                      style={inputStyle}
                    >
                      <option value="pendente">Em Aberto / A Pagar</option>
                      <option value="agendado">Agendado no Banco</option>
                      <option value="pago">Já Pago / Liquidado</option>
                      <option value="vencido">Vencido</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cp-forma-pgto" style={labelStyle}>Forma de Pagamento</label>
                    <select
                      id="cp-forma-pgto"
                      value={formaPagamento}
                      onChange={(e) => setFormaPagamento(e.target.value)}
                      style={inputStyle}
                    >
                      {FORMAS_PAGAMENTO_CONTAS_PAGAR.map((fp) => (
                        <option key={fp} value={fp}>{fp}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cp-tipo-doc" style={labelStyle}>Tipo de Documento</label>
                    <select
                      id="cp-tipo-doc"
                      value={tipoDocumento}
                      onChange={(e) => setTipoDocumento(e.target.value as any)}
                      style={inputStyle}
                    >
                      <option value="NFS-e">NFS-e (Serviços)</option>
                      <option value="NF-e">NF-e (Mercadorias)</option>
                      <option value="Boleto">Boleto Bancário</option>
                      <option value="DARF">DARF / Guia Imposto</option>
                      <option value="Folha">Folha de Pagamento</option>
                      <option value="Contrato">Contrato Mensal</option>
                      <option value="Fatura">Fatura Concessionária</option>
                      <option value="Recibo">Recibo / RPA</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="cp-num-doc" style={labelStyle}>Nº Documento / NF</label>
                    <input
                      id="cp-num-doc"
                      type="text"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={numeroDocumento}
                      onChange={(e) => setNumeroDocumento(e.target.value)}
                      placeholder="Ex: NFS-e 2026/0419"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {status === 'pago' && (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1.5fr',
                      gap: 12,
                    }}
                  >
                    <div>
                      <label htmlFor="cp-data-pagto" style={labelStyle}>Data Efetiva do Pagamento</label>
                      <input
                        id="cp-data-pagto"
                        type="date"
                        value={dataPagamento}
                        onChange={(e) => setDataPagamento(e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="cp-caixa-origem" style={labelStyle}>Conta Bancária / Caixa Desembolsado</label>
                      <select
                        id="cp-caixa-origem"
                        value={caixaOrigem}
                        onChange={(e) => setCaixaOrigem(e.target.value)}
                        style={inputStyle}
                      >
                        {CAIXAS_BANCOS_ESCOLARES.map((cx) => (
                          <option key={cx} value={cx}>{cx}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Chave PIX e Linha Digitável */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12 }}>
                  <div>
                    <label htmlFor="cp-chave-pix" style={labelStyle}>
                      Chave PIX ou Copia e Cola do Favorecido
                    </label>
                    <input
                      id="cp-chave-pix"
                      type="text"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={chavePix}
                      onChange={(e) => setChavePix(e.target.value)}
                      placeholder="CNPJ, E-mail, Telefone ou Chave Aleatória"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="cp-linha-digitavel" style={labelStyle}>
                      Linha Digitável do Boleto / Código de Barras
                    </label>
                    <input
                      id="cp-linha-digitavel"
                      type="text"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      value={linhaDigitavel}
                      onChange={(e) => setLinhaDigitavel(e.target.value)}
                      placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
                      style={{ ...inputStyle, fontFamily: 'monospace' }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="cp-observacoes" style={labelStyle}>
                    Observações Internas / Justificativa da Despesa
                  </label>
                  <textarea
                    id="cp-observacoes"
                    rows={3}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Detalhes contratuais, número de pedido de compra, centro de autorização..."
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* SECTION 3: RATEIO MULTICENTRO DE CUSTO POR SEGMENTO ESCOLAR */}
            {activeSection === 'rateio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div
                  style={{
                    padding: 16,
                    borderRadius: 14,
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                      Rateio Contábil entre Segmentos Pedagógicos
                    </div>
                    <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                      Distribua despesas compartilhadas (ex: Folha Docente, Energia, Limpeza) entre Educação Infantil, Fundamental I/II e Ensino Médio.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={handleAplicarRateioPedagogicoPadrao}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: '#f5f3ff',
                        border: '1px solid #ddd6fe',
                        color: '#6d28d9',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Aplicar Rateio Pedagógico (20/30/30/20%)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUsarRateio((v) => !v)
                        if (!usarRateio && rateioList.length === 0) {
                          setRateioList([{ centroCusto, percentual: 100, valor: valorLiquidoCalculado }])
                        }
                      }}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: usarRateio ? '#fff1f2' : '#ecfdf5',
                        border: usarRateio ? '1px solid #fecdd3' : '1px solid #a7f3d0',
                        color: usarRateio ? '#be123c' : '#047857',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      {usarRateio ? 'Desativar Rateio Múltiplo' : 'Ativar Rateio Múltiplo'}
                    </button>
                  </div>
                </div>

                {usarRateio ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {rateioComValores.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1.6fr 140px 160px 44px',
                            gap: 10,
                            alignItems: 'center',
                            padding: '10px 12px',
                            borderRadius: 12,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          <div>
                            <label htmlFor={`rateio-cc-${idx}`} style={{ ...labelStyle, marginBottom: 4 }}>
                              Segmento / Centro de Custo #{idx + 1}
                            </label>
                            <select
                              id={`rateio-cc-${idx}`}
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
                              {item.centroCusto && !listaCentrosCusto.some((cc) => cc.id === item.centroCusto) && (
                                <option value={item.centroCusto}>{item.centroCusto}</option>
                              )}
                            </select>
                          </div>
                          <div>
                            <label htmlFor={`rateio-pct-${idx}`} style={{ ...labelStyle, marginBottom: 4 }}>
                              Percentual (%)
                            </label>
                            <input
                              id={`rateio-pct-${idx}`}
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={item.percentual}
                              onChange={(e) => {
                                const pct = Math.max(0, Number(e.target.value) || 0)
                                setRateioList((prev) => prev.map((r, i) => (i === idx ? { ...r, percentual: pct } : r)))
                              }}
                              style={inputStyle}
                            />
                          </div>
                          <div>
                            <div style={{ ...labelStyle, marginBottom: 4 }}>Valor Alocado</div>
                            <div
                              style={{
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: '#f0f9ff',
                                border: '1px solid #bae6fd',
                                color: '#0369a1',
                                fontWeight: 800,
                                fontSize: 13,
                              }}
                            >
                              {formatCurrency(item.valor)}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setRateioList((prev) => prev.filter((_, i) => i !== idx))}
                            aria-label="Remover linha de rateio"
                            style={{
                              marginTop: 18,
                              height: 38,
                              borderRadius: 10,
                              background: '#fff1f2',
                              border: '1px solid #fecdd3',
                              color: '#be123c',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <button
                        type="button"
                        onClick={handleAddRateioRow}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          borderRadius: 10,
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          color: '#334155',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={14} />
                        Adicionar Segmento ao Rateio
                      </button>

                      <div
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          background: Math.abs(somaPercentualRateio - 100) <= 0.5 ? '#ecfdf5' : '#fffbeb',
                          border: Math.abs(somaPercentualRateio - 100) <= 0.5 ? '1px solid #a7f3d0' : '1px solid #fde68a',
                          color: Math.abs(somaPercentualRateio - 100) <= 0.5 ? '#047857' : '#b45309',
                          fontSize: 12,
                          fontWeight: 800,
                        }}
                      >
                        Total Distribuído: {somaPercentualRateio}% ({formatCurrency(rateioComValores.reduce((a, b) => a + b.valor, 0))})
                      </div>
                    </div>
                  </>
                ) : (
                  <div
                    style={{
                      padding: 24,
                      borderRadius: 14,
                      background: '#f8fafc',
                      border: '1px dashed #cbd5e1',
                      textAlign: 'center',
                      color: '#64748b',
                      fontSize: 13,
                    }}
                  >
                    100% da despesa será alocada no Centro de Custo principal selecionado:{' '}
                    <strong style={{ color: '#0f172a' }}>{centroCusto}</strong>.
                  </div>
                )}
              </div>
            )}

            {/* SECTION 4: PARCELAMENTO E RECORRÊNCIA AUTOMÁTICA */}
            {activeSection === 'parcelamento' && !editingRecord && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  {[
                    { id: 'unico', title: 'Lançamento Único (À Vista)', desc: 'Apenas 1 título na data de vencimento escolhida' },
                    { id: 'parcelado', title: 'Compra / Contrato Parcelado (2x a 60x)', desc: 'Gera automaticamente todas as parcelas numeradas' },
                    { id: 'recorrente', title: 'Assinatura / Despesa Fixa Recorrente', desc: 'Projeta os próximos meses (Energia, Internet, SaaS, Aluguel)' },
                  ].map((opt) => {
                    const active = modoParcelamento === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setModoParcelamento(opt.id as any)}
                        style={{
                          padding: 14,
                          borderRadius: 14,
                          textAlign: 'left',
                          background: active ? '#f0f9ff' : '#f8fafc',
                          border: active ? '2px solid #0284c7' : '1px solid #e2e8f0',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 800, color: active ? '#0369a1' : '#0f172a' }}>
                          {opt.title}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{opt.desc}</div>
                      </button>
                    )
                  })}
                </div>

                {modoParcelamento !== 'unico' && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      <div>
                        <label htmlFor="cp-qtd-parcelas" style={labelStyle}>
                          Quantidade de Parcelas / Meses
                        </label>
                        <input
                          id="cp-qtd-parcelas"
                          type="number"
                          min="2"
                          max="60"
                          value={qtdParcelas}
                          onChange={(e) => setQtdParcelas(Math.min(60, Math.max(2, Number(e.target.value) || 2)))}
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <label htmlFor="cp-freq-parcelas" style={labelStyle}>
                          Periodicidade dos Vencimentos
                        </label>
                        <select
                          id="cp-freq-parcelas"
                          value={frequenciaRecorrencia}
                          onChange={(e) => setFrequenciaRecorrencia(e.target.value as any)}
                          style={inputStyle}
                        >
                          <option value="mensal">Mensal (a cada 1 mês)</option>
                          <option value="bimestral">Bimestral (a cada 2 meses)</option>
                          <option value="trimestral">Trimestral (a cada 3 meses)</option>
                          <option value="semestral">Semestral (a cada 6 meses)</option>
                          <option value="anual">Anual (a cada 12 meses)</option>
                        </select>
                      </div>
                      <div>
                        <label htmlFor="cp-modo-valor" style={labelStyle}>
                          Cálculo do Valor por Parcela
                        </label>
                        <select
                          id="cp-modo-valor"
                          value={modoValorParcela}
                          onChange={(e) => setModoValorParcela(e.target.value as any)}
                          style={inputStyle}
                        >
                          <option value="repetir">Repetir {formatCurrency(valorLiquidoCalculado)} em cada parcela</option>
                          <option value="dividir">Dividir {formatCurrency(valorLiquidoCalculado)} entre as {qtdParcelas} parcelas</option>
                        </select>
                      </div>
                    </div>

                    {/* Preview Editável das Parcelas */}
                    <div
                      style={{
                        borderRadius: 14,
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        maxHeight: 260,
                        overflowY: 'auto',
                      }}
                    >
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <thead>
                          <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '2px solid #e2e8f0' }}>
                            <th style={{ padding: '10px 12px' }}>Parcela</th>
                            <th style={{ padding: '10px 12px' }}>Descrição</th>
                            <th style={{ padding: '10px 12px' }}>Vencimento</th>
                            <th style={{ padding: '10px 12px' }}>Competência</th>
                            <th style={{ padding: '10px 12px', textAlign: 'right' }}>Valor Líquido (R$)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parcelasPreview.map((p, idx) => (
                            <tr key={p.numero} style={{ borderTop: '1px solid #f1f5f9', background: '#ffffff' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 800, color: '#0369a1' }}>
                                {String(p.numero).padStart(2, '0')}/{String(p.total).padStart(2, '0')}
                              </td>
                              <td style={{ padding: '8px 12px', color: '#0f172a', fontWeight: 600 }}>{p.descricao}</td>
                              <td style={{ padding: '8px 12px' }}>
                                <input
                                  aria-label={`Vencimento da parcela ${p.numero}`}
                                  type="date"
                                  value={p.vencimento}
                                  onChange={(e) => {
                                    const nv = e.target.value
                                    setParcelasPreview((prev) =>
                                      prev.map((item, i) => (i === idx ? { ...item, vencimento: nv, competencia: nv.slice(0, 7) } : item))
                                    )
                                  }}
                                  style={{ ...inputStyle, padding: '5px 8px', fontSize: 12 }}
                                />
                              </td>
                              <td style={{ padding: '8px 12px', color: '#64748b' }}>{p.competencia}</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#047857' }}>
                                {formatCurrency(p.valorLiquido)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div>
                <span style={{ fontSize: 11, color: '#64748b', display: 'block', fontWeight: 600 }}>Valor Líquido por Título</span>
                <strong style={{ fontSize: 16, color: '#047857', fontWeight: 900 }}>
                  {formatCurrency(valorLiquidoCalculado)}
                </strong>
              </div>
              {!editingRecord && modoParcelamento !== 'unico' && parcelasPreview.length > 1 && (
                <div style={{ paddingLeft: 16, borderLeft: '1px solid #cbd5e1' }}>
                  <span style={{ fontSize: 11, color: '#64748b', display: 'block', fontWeight: 600 }}>
                    Total do Compromisso ({parcelasPreview.length}x)
                  </span>
                  <strong style={{ fontSize: 16, color: '#0369a1', fontWeight: 900 }}>
                    {formatCurrency(parcelasPreview.reduce((a, b) => a + b.valorLiquido, 0))}
                  </strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 18px',
                  borderRadius: 11,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '10px 22px',
                  borderRadius: 11,
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: saving ? 'wait' : 'pointer',
                  boxShadow: '0 6px 16px rgba(5, 150, 105, 0.25)',
                }}
              >
                {saving
                  ? 'Salvando...'
                  : editingRecord
                    ? `Salvar Alterações (${formatCurrency(valorLiquidoCalculado)})`
                    : modoParcelamento !== 'unico' && parcelasPreview.length > 1
                      ? `Gerar ${parcelasPreview.length} Títulos (${formatCurrency(parcelasPreview.reduce((a, b) => a + b.valorLiquido, 0))})`
                      : `Confirmar Lançamento de ${formatCurrency(valorLiquidoCalculado)}`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
