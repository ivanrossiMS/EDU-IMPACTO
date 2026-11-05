'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import {
  Plus, Search, Filter, X, Download, CheckCircle, Pencil, Trash2,
  AlertTriangle, DollarSign, Check, FileText, Tag, Layers, RotateCcw,
  FileSpreadsheet, Printer, MessageCircle, ArrowUpDown, Calendar, Sparkles, Target
} from 'lucide-react'

import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useApp } from '@/lib/context'
import { useData, Titulo, newId, newEventoId, newParcelaId } from '@/lib/dataContext'
import { formatCurrency } from '@/lib/utils'
import { resolveCentrosCustoEscolares } from '../pagar/types'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import { TableSkeleton } from '@/components/skeletons/TableSkeleton'
import { UpdatingIndicator } from '@/components/skeletons/States'
import { ReceiptModal, type ReceiptParcela } from '@/components/financeiro/ReceiptModal'

// ─── Constantes ────────────────────────────────────────────────────
const METODOS_FALLBACK = [
  'PIX', 'Boleto', 'Cartão de Crédito', 'Cartão de Débito',
  'Débito Automático', 'Dinheiro', 'Cheque', 'Transferência', 'Bolsa Integral'
]
const MESES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]
const MESES_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const today = () => new Date().toISOString().slice(0, 10)

const fmt = (d: string | null | undefined) => {
  if (!d) return '—'
  const clean = String(d).slice(0, 10)
  const parts = clean.split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

const fmtCur = formatCurrency

// Cálculo seguro de dias de atraso usando meio-dia local para evitar desvios de fuso horário (UTC vs BRT)
const diasAtraso = (venc: string | null | undefined): number => {
  if (!venc) return 0
  const clean = String(venc).slice(0, 10)
  const hojeStr = today()
  if (clean >= hojeStr) return 0
  const dtVenc = new Date(`${clean}T12:00:00`)
  const dtHoje = new Date(`${hojeStr}T12:00:00`)
  if (isNaN(dtVenc.getTime())) return 0
  return Math.max(0, Math.round((dtHoje.getTime() - dtVenc.getTime()) / 86400000))
}

// Cálculo financeiro de encargos moratórios (Multa 2% + Juros 1% a.m. pro-rata die = 0.0333%/dia)
const calcularEncargosAtraso = (valorBase: number, dias: number) => {
  if (dias <= 0 || valorBase <= 0) return { multa: 0, juros: 0, total: valorBase }
  const multa = Math.round(valorBase * 0.02 * 100) / 100
  const juros = Math.round(valorBase * (0.01 / 30) * dias * 100) / 100
  const total = Math.round((valorBase + multa + juros) * 100) / 100
  return { multa, juros, total }
}

// Normalizador inteligente de rótulo de parcela (evita exibir IDs técnicos como EVMNTFR2HSHSEIAWGI-01)
const resolveParcelaDisplay = (t: any): { parc: string; cur: number; tot: number; codigoTecnico?: string } => {
  const raw = String(t?.parcela || '').trim()
  // 1. Formato padrão X/Y (ex: 1/1, 2/6)
  const slashMatch = raw.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (slashMatch) {
    const cur = Math.max(1, Number(slashMatch[1]) || 1)
    const tot = Math.max(cur, Number(slashMatch[2]) || 1)
    return { parc: `${cur}/${tot}`, cur, tot, codigoTecnico: t?.parcelaCodigo }
  }
  // 2. Tenta extrair (X/Y) da descrição se existir (ex: "Mensalidade (2/12)")
  const descMatch = String(t?.descricao || '').match(/\((\d+)\s*\/\s*(\d+)\)/)
  if (descMatch) {
    const cur = Math.max(1, Number(descMatch[1]) || 1)
    const tot = Math.max(cur, Number(descMatch[2]) || 1)
    return { parc: `${cur}/${tot}`, cur, tot, codigoTecnico: raw || undefined }
  }
  // 3. Se for código técnico tipo EV...-01 ou P01
  const suffixMatch = raw.match(/-(\d{1,2})$/)
  if (suffixMatch) {
    const cur = Math.max(1, Number(suffixMatch[1]) || 1)
    const tot = Math.max(cur, Number(t?.totalParcelas) || cur)
    return { parc: `${cur}/${tot}`, cur, tot, codigoTecnico: raw }
  }
  return { parc: '1/1', cur: 1, tot: 1 }
}

// Gera código amigável como TIT-XXXXX
const genCod = (lista: (Titulo & { codigo?: string })[]) => {
  const set = new Set(lista.map(t => (t as any).codigo).filter(Boolean))
  let cod: string
  do {
    cod = `TIT-${Math.floor(Math.random() * 90000) + 10000}`
  } while (set.has(cod))
  return cod
}

// Aging buckets (dias de atraso)
const AGING = [
  { label: 'Corrente',   min: 0,  max: 0,    color: '#10b981' },
  { label: '1-30 dias',  min: 1,  max: 30,   color: '#f59e0b' },
  { label: '31-60 dias', min: 31, max: 60,   color: '#f97316' },
  { label: '61-90 dias', min: 61, max: 90,   color: '#ef4444' },
  { label: '+90 dias',   min: 91, max: 9999, color: '#7f1d1d' },
]

const STATUS_CFG = {
  pago:     { label: 'Pago',     color: '#10b981', bg: 'rgba(16,185,129,0.12)',  icon: '✅' },
  pendente: { label: 'A Vencer', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: '⏰' },
  atrasado: { label: 'Atrasado', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: '⚠' },
}

const BLANK: Omit<Titulo, 'id'> & {
  codigo: string
  origemLanca?: string
  eventoId?: string
  eventoNome?: string
  eventoTipo?: string
  centroCusto?: string
  obs?: string
} = {
  codigo: '',
  aluno: '',
  responsavel: '',
  descricao: '',
  valor: 0,
  vencimento: today(),
  pagamento: null,
  status: 'pendente',
  metodo: null,
  parcela: '1/1',
  centroCusto: '',
  origemLanca: 'manual_receber',
  obs: '',
}

export default function ContasReceberPage() {
  const { cfgEventos, cfgMetodosPagamento, cfgCentrosCusto, setMovimentacoesManuais, logSystemAction } = useData()
  const { currentUser } = useApp()
  const [alunos] = useSupabaseArray<any>('alunos')
  const [ctxTitulos] = useSupabaseArray<any>('titulos')
  const queryClient = useQueryClient()

  const centrosCustoReceber = useMemo(
    () => resolveCentrosCustoEscolares(cfgCentrosCusto, 'receita', false),
    [cfgCentrosCusto]
  )
  const todosCentrosCusto = useMemo(
    () => resolveCentrosCustoEscolares(cfgCentrosCusto, 'todos', true),
    [cfgCentrosCusto]
  )

  const caixasAbertos = useMemo(() => [
    { id: 'CX-TESOURARIA', nome: 'Caixa Geral / Secretaria', nomeCaixa: 'Caixa Geral / Secretaria', fechado: false, dataAbertura: today(), operador: currentUser?.nome || 'Tesouraria' },
    { id: 'CX-BANCO', nome: 'Conta Bancária / PIX', nomeCaixa: 'Conta Bancária / PIX', fechado: false, dataAbertura: today(), operador: currentUser?.nome || 'Banco' },
  ], [currentUser?.nome])

  const mutateTitulo = useApiMutation('/api/titulos', 'POST', [['titulos-receber']])
  const mutateDelete = useApiMutation('/api/titulos', 'DELETE', [['titulos-receber']])

  // ── Filtros e Ordenação ──
  const [tabStatus, setTabStatus] = useState<'todos' | 'pendente' | 'atrasado' | 'pago'>('todos')
  const [searchRaw, setSearchRaw] = useState('')
  const [search] = useDebounce(searchRaw, 250)
  const [showFilters, setShowFilters] = useState(false)
  const [filtroMetodo, setFiltroMetodo] = useState('todos')
  const [filtroMes, setFiltroMes] = useState('todos')
  const [filtroAno, setFiltroAno] = useState('todos')
  const [dataVencDe, setDataVencDe] = useState('')
  const [dataVencAte, setDataVencAte] = useState('')
  const [filtroAging, setFiltroAging] = useState('todos')
  const [filtroEvento, setFiltroEvento] = useState('todos')
  const [filtroCentroCusto, setFiltroCentroCusto] = useState('todos')
  const [filtroOrigem, setFiltroOrigem] = useState<'todos' | 'manual_receber' | 'acordo' | 'matricula'>('todos')
  const [sortBy, setSortBy] = useState<'venc_asc' | 'venc_desc' | 'valor_desc' | 'valor_asc' | 'aluno_asc'>('venc_desc')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 25

  // Seleção em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Recibo Oficial Modal
  const [receiptTarget, setReceiptTarget] = useState<any | null>(null)

  // Busca todos os títulos ativos com cache React Query (filtros aplicados em memória p/ KPIs consistentes e resposta instantânea)
  const { data: apiResponse, isLoading: loadingTitulos, isFetching: isFetchingTitulos } = useApiQuery<{ data: any[] }>(
    ['titulos-receber'],
    '/api/titulos',
    { limit: 2500 },
    { staleTime: 25_000, gcTime: 300_000 }
  )

  const rawTitulos = useMemo(() => {
    const source: any[] = Array.isArray(apiResponse)
      ? apiResponse
      : Array.isArray(apiResponse?.data)
        ? apiResponse.data
        : Array.isArray(ctxTitulos)
          ? ctxTitulos
          : []
    const hojeStr = today()
    return source
      .filter((t: any) => t && t.status !== 'excluido' && t.status !== 'cancelado' && t.status !== 'renegociado')
      .map((t: any) => {
        const venc = String(t.vencimento || '').slice(0, 10)
        // Normaliza status de atraso dinamicamente se vencimento já passou e ainda consta pendente
        let effectiveStatus: 'pago' | 'pendente' | 'atrasado' =
          t.status === 'pago' ? 'pago' : (venc && venc < hojeStr ? 'atrasado' : 'pendente')
        if (t.status === 'atrasado' && venc >= hojeStr) {
          effectiveStatus = 'pendente'
        }
        const parcInfo = resolveParcelaDisplay(t)
        return {
          ...t,
          vencimento: venc,
          status: effectiveStatus,
          valor: Number(t.valor) || 0,
          _parcDisplay: parcInfo.parc,
          _parcCur: parcInfo.cur,
          _parcTot: parcInfo.tot,
          _parcCodigo: parcInfo.codigoTecnico,
        }
      })
  }, [apiResponse, ctxTitulos])

  // Filtra por origem se selecionado (por padrão exibe os lançamentos de Contas a Receber / Acordos / Todos)
  const titulosReceber = useMemo(() => {
    return rawTitulos.filter((t: any) => {
      if (filtroOrigem === 'manual_receber') return t.origemLanca === 'manual_receber' && !t.acordoId
      if (filtroOrigem === 'acordo') return Boolean(t.acordoId) || String(t.descricao || '').includes('Acordo Renegociação')
      if (filtroOrigem === 'matricula') return t.origemLanca !== 'manual_receber' && !t.acordoId
      // Em 'todos', prioriza se houver manual_receber ou mostra toda a carteira ativa
      return true
    })
  }, [rawTitulos, filtroOrigem])

  const titulos = titulosReceber

  const METODOS = (cfgMetodosPagamento || []).filter(m => m.situacao === 'ativo').map(m => m.nome)
  const metodosSelect = METODOS.length > 0 ? METODOS : METODOS_FALLBACK
  const todosEventosAtivos = (cfgEventos || []).filter(e => e.situacao === 'ativo')

  // ── Modais ──
  const [modal, setModal] = useState<'new' | 'edit' | 'baixa' | 'baixa_lote' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false)
  const [alertMsg, setAlertMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<typeof BLANK>({ ...BLANK })
  const [baixaForm, setBaixaForm] = useState({
    metodo: 'PIX',
    dataPagamento: today(),
    valorPago: 0,
    aplicarEncargos: true,
    descontoPontualidade: 0,
    obs: '',
    caixaId: 'CX-TESOURARIA',
  })

  const set = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))

  const anos = useMemo(
    () => [...new Set(titulosReceber.map(t => t.vencimento?.slice(0, 4)).filter(Boolean))].sort().reverse(),
    [titulosReceber]
  )

  // ── Typeahead: Aluno ──
  const [alunoSearch, setAlunoSearch] = useState('')
  const [showAlunoDrop, setShowAlunoDrop] = useState(false)
  const alunosFiltrados = useMemo(() => {
    const q = alunoSearch.toLowerCase().trim()
    return (alunos || [])
      .filter(a => (a.nome || '').toLowerCase().includes(q) || (a.responsavel || '').toLowerCase().includes(q))
      .slice(0, 10)
  }, [alunos, alunoSearch])

  // ── Modal de seleção de Evento ──
  const [showEventoModal, setShowEventoModal] = useState(false)
  const [eventoModalSearch, setEventoModalSearch] = useState('')
  const eventosFiltradosModal = useMemo(() => {
    const q = eventoModalSearch.toLowerCase().trim()
    return (cfgEventos || []).filter(
      e => e.situacao === 'ativo' && (e.descricao.toLowerCase().includes(q) || e.tipo.toLowerCase().includes(q))
    )
  }, [cfgEventos, eventoModalSearch])

  // ── Gerador de Parcelas ──
  const [gerarParcelas, setGerarParcelas] = useState(false)
  const [numParcelas, setNumParcelas] = useState(3)
  const [dataInicioParcelas, setDataInicioParcelas] = useState(today())
  const [modoParcelas, setModoParcelas] = useState<'corridos' | 'mesmo_dia'>('mesmo_dia')
  const [modoValorParcela, setModoValorParcela] = useState<'dividir' | 'repetir'>('dividir')
  const [previewParcelas, setPreviewParcelas] = useState<{ num: number; venc: string; valor: number }[]>([])

  const calcParcelas = useCallback(() => {
    const valNum = Number(form.valor) || 0
    const dataRef = dataInicioParcelas || form.vencimento || today()
    if (valNum <= 0 || !dataRef) return
    const qtd = Math.min(60, Math.max(2, Number(numParcelas) || 2))
    const base = new Date(`${dataRef}T12:00:00`)
    const vp = modoValorParcela === 'dividir' ? +(valNum / qtd).toFixed(2) : +valNum.toFixed(2)

    const ps = Array.from({ length: qtd }, (_, i) => {
      const d = new Date(base)
      if (modoParcelas === 'corridos') d.setDate(d.getDate() + 30 * i)
      else d.setMonth(d.getMonth() + i)
      return { num: i + 1, venc: d.toISOString().slice(0, 10), valor: vp }
    })

    if (modoValorParcela === 'dividir' && ps.length > 0) {
      const diff = +(valNum - ps.reduce((s, p) => s + p.valor, 0)).toFixed(2)
      ps[ps.length - 1].valor = +(ps[ps.length - 1].valor + diff).toFixed(2)
    }
    setPreviewParcelas(ps)
  }, [form.valor, form.vencimento, dataInicioParcelas, numParcelas, modoParcelas, modoValorParcela])

  // Atualiza preview automaticamente quando gerarParcelas está ativo
  useEffect(() => {
    if (gerarParcelas && Number(form.valor) > 0 && (dataInicioParcelas || form.vencimento)) {
      calcParcelas()
    } else if (!gerarParcelas) {
      setPreviewParcelas([])
    }
  }, [gerarParcelas, form.valor, dataInicioParcelas, form.vencimento, numParcelas, modoParcelas, modoValorParcela, calcParcelas])

  // ── Dados filtrados e ordenados ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = titulosReceber.filter(t => {
      if (q) {
        const hay = `${t.aluno || ''} ${t.responsavel || ''} ${t.descricao || ''} ${t.codigo || ''} ${t.eventoDescricao || ''} ${t.centroCusto || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (tabStatus !== 'todos' && t.status !== tabStatus) return false
      if (filtroMetodo !== 'todos' && t.metodo !== filtroMetodo) return false
      if (filtroCentroCusto !== 'todos' && (t.centroCusto || '') !== filtroCentroCusto) return false
      if (filtroMes !== 'todos' && t.vencimento?.slice(5, 7) !== filtroMes) return false
      if (filtroAno !== 'todos' && !t.vencimento?.startsWith(filtroAno)) return false
      if (dataVencDe && t.vencimento < dataVencDe) return false
      if (dataVencAte && t.vencimento > dataVencAte) return false
      if (filtroEvento !== 'todos' && !(t.descricao || '').toLowerCase().includes(filtroEvento.toLowerCase()) && !(t.eventoDescricao || '').toLowerCase().includes(filtroEvento.toLowerCase())) {
        return false
      }
      if (filtroAging !== 'todos') {
        if (filtroAging === 'corrente') {
          if (t.status === 'atrasado') return false
        } else {
          if (t.status !== 'atrasado') return false
          const d = diasAtraso(t.vencimento)
          const bucket = AGING.find(b => d >= b.min && d <= b.max)
          if (!bucket || bucket.label !== filtroAging) return false
        }
      }
      return true
    })

    return list.sort((a, b) => {
      if (sortBy === 'venc_asc') return (a.vencimento || '').localeCompare(b.vencimento || '')
      if (sortBy === 'venc_desc') return (b.vencimento || '').localeCompare(a.vencimento || '')
      if (sortBy === 'valor_desc') return (Number(b.valor) || 0) - (Number(a.valor) || 0)
      if (sortBy === 'valor_asc') return (Number(a.valor) || 0) - (Number(b.valor) || 0)
      return (a.aluno || a.descricao || '').localeCompare(b.aluno || b.descricao || '')
    })
  }, [titulosReceber, search, tabStatus, filtroMetodo, filtroCentroCusto, filtroMes, filtroAno, dataVencDe, dataVencAte, filtroAging, filtroEvento, sortBy])

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, tabStatus, filtroMetodo, filtroCentroCusto, filtroMes, filtroAno, dataVencDe, dataVencAte, filtroAging, filtroEvento, filtroOrigem, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage))
  const titulosLista = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage])

  // ── KPIs Executivos (Sempre consistentes com titulosReceber) ──
  const kpis = useMemo(() => {
    const hojeStr = today()
    let totalPago = 0
    let qtdPago = 0
    let totalAtrasado = 0
    let qtdAtrasado = 0
    let totalPendente = 0
    let qtdPendente = 0
    let venceHojeVal = 0
    let venceHojeQtd = 0

    for (const t of titulosReceber) {
      const v = Number(t.valor) || 0
      if (t.status === 'pago') {
        totalPago += v
        qtdPago++
      } else if (t.status === 'atrasado') {
        totalAtrasado += v
        qtdAtrasado++
      } else {
        totalPendente += v
        qtdPendente++
        if (t.vencimento === hojeStr) {
          venceHojeVal += v
          venceHojeQtd++
        }
      }
    }

    const totalCarteira = totalPago + totalAtrasado + totalPendente
    const taxaRecebimento = totalCarteira > 0 ? (totalPago / totalCarteira) * 100 : 0
    const taxaInadimplencia = totalCarteira > 0 ? (totalAtrasado / totalCarteira) * 100 : 0

    return {
      totalPago, qtdPago,
      totalAtrasado, qtdAtrasado,
      totalPendente, qtdPendente,
      venceHojeVal, venceHojeQtd,
      totalCarteira,
      taxaRecebimento,
      taxaInadimplencia,
    }
  }, [titulosReceber])

  const totalFiltrado = useMemo(() => filtered.reduce((s, t) => s + (Number(t.valor) || 0), 0), [filtered])
  const selectedObjects = useMemo(() => filtered.filter(t => selectedIds.has(t.id)), [filtered, selectedIds])
  const totalSelected = useMemo(() => selectedObjects.reduce((s, t) => s + (Number(t.valor) || 0), 0), [selectedObjects])

  // Aging de inadimplência
  const agingData = useMemo(() => AGING.slice(1).map(b => {
    const matches = titulosReceber.filter(t => {
      if (t.status !== 'atrasado') return false
      const d = diasAtraso(t.vencimento)
      return d >= b.min && d <= b.max
    })
    return {
      ...b,
      valor: matches.reduce((s, t) => s + t.valor, 0),
      qtd: matches.length,
    }
  }), [titulosReceber])

  // Previsão de recebimento por mês (próximos 3 meses)
  const previsao = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const mes = String(d.getMonth() + 1).padStart(2, '0')
      const ano = d.getFullYear()
      const key = `${ano}-${mes}`
      const items = titulosReceber.filter(t => t.status !== 'pago' && t.vencimento?.startsWith(key))
      const valor = items.reduce((s, t) => s + t.valor, 0)
      return { label: `${MESES_SHORT[d.getMonth()]}/${ano}`, valor, qtd: items.length, mes, ano: String(ano) }
    })
  }, [titulosReceber])

  // ── Handlers ──
  const openNew = () => {
    setForm({ ...BLANK, codigo: genCod(rawTitulos as any), vencimento: today() })
    setAlunoSearch('')
    setShowAlunoDrop(false)
    setShowEventoModal(false)
    setEventoModalSearch('')
    setGerarParcelas(false)
    setNumParcelas(3)
    setDataInicioParcelas(today())
    setPreviewParcelas([])
    setEditingId(null)
    setModal('new')
  }

  const openEdit = (t: any) => {
    if (t.status === 'pago') {
      setAlertMsg("Não é possível editar ou excluir um título que já consta como PAGO. Clique em 'Reverter' primeiro caso precise estornar a baixa.")
      return
    }
    setForm({
      ...BLANK,
      ...t,
      codigo: t.codigo || genCod(rawTitulos as any),
      parcela: t._parcDisplay || '1/1',
    })
    setAlunoSearch(t.aluno || '')
    setGerarParcelas(false)
    setPreviewParcelas([])
    setEditingId(t.id)
    setModal('edit')
  }

  const openBaixa = (t: any) => {
    setEditingId(t.id)
    const cxDef = caixasAbertos.find(c => !c.fechado)?.id || 'CX-TESOURARIA'
    const atr = t.status === 'atrasado' ? diasAtraso(t.vencimento) : 0
    const enc = calcularEncargosAtraso(Number(t.valor) || 0, atr)
    setBaixaForm({
      metodo: t.metodo ?? 'PIX',
      dataPagamento: today(),
      valorPago: atr > 0 ? enc.total : Number(t.valor) || 0,
      aplicarEncargos: atr > 0,
      descontoPontualidade: 0,
      obs: '',
      caixaId: cxDef,
    })
    setModal('baixa')
  }

  const openBaixaLote = () => {
    const abertos = selectedObjects.filter(t => t.status !== 'pago')
    if (abertos.length === 0) {
      toast.error('Selecione pelo menos um título em aberto para liquidar em lote.')
      return
    }
    const cxDef = caixasAbertos.find(c => !c.fechado)?.id || 'CX-TESOURARIA'
    setBaixaForm({
      metodo: 'PIX',
      dataPagamento: today(),
      valorPago: abertos.reduce((s, t) => s + (Number(t.valor) || 0), 0),
      aplicarEncargos: false,
      descontoPontualidade: 0,
      obs: 'Liquidação em lote via Contas a Receber',
      caixaId: cxDef,
    })
    setModal('baixa_lote')
  }

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!form.vencimento) {
      toast.error('Informe a data de vencimento.')
      return
    }
    if (!form.descricao?.trim()) {
      toast.error('Informe a descrição do lançamento.')
      return
    }
    if ((Number(form.valor) || 0) <= 0) {
      toast.error('O valor do título deve ser maior que zero.')
      return
    }

    setSaving(true)
    try {
      const isNew = modal === 'new'

      if (gerarParcelas && previewParcelas.length > 0) {
        const todosEventoIds = rawTitulos.map(t => (t as any).eventoId || '').filter(Boolean)
        const eventoIdLote = newEventoId(todosEventoIds)
        const novos = previewParcelas.map((p, i) => ({
          ...form,
          id: undefined,
          codigo: `${form.codigo}-P${String(i + 1).padStart(2, '0')}`,
          descricao: `${form.descricao.trim()} (${i + 1}/${previewParcelas.length})`,
          parcela: `${i + 1}/${previewParcelas.length}`,
          parcelaCodigo: newParcelaId(eventoIdLote, i + 1),
          totalParcelas: previewParcelas.length,
          eventoId: form.eventoId || eventoIdLote,
          eventoDescricao: form.eventoNome || undefined,
          valor: p.valor,
          vencimento: p.venc,
          origemLanca: 'manual_receber',
          dataLancamento: new Date().toISOString(),
          usuarioLancamento: currentUser?.nome || 'Sistema',
        }))

        await mutateTitulo.mutateAsync(novos)
        toast.success(`${novos.length} parcelas geradas com sucesso!`)
      } else if (isNew) {
        const todosEventoIds = rawTitulos.map(t => (t as any).eventoId || '').filter(Boolean)
        const eventoIdUnico = form.eventoId || newEventoId(todosEventoIds)
        const payload = {
          ...form,
          id: undefined,
          descricao: form.descricao.trim(),
          eventoId: eventoIdUnico,
          eventoDescricao: form.eventoNome || undefined,
          parcela: '1/1',
          parcelaCodigo: newParcelaId(eventoIdUnico, 1),
          origemLanca: 'manual_receber',
          dataLancamento: new Date().toISOString(),
          usuarioLancamento: currentUser?.nome || 'Sistema',
        }
        await mutateTitulo.mutateAsync(payload)
        toast.success('Novo título registrado com sucesso!')
      } else if (editingId) {
        const oldTitulo = rawTitulos.find(x => x.id === editingId) || {}
        await mutateTitulo.mutateAsync({
          ...oldTitulo,
          ...form,
          id: editingId,
          descricao: form.descricao.trim(),
          parcela: form.parcela || oldTitulo._parcDisplay || '1/1',
        })

        setMovimentacoesManuais((prev: any) =>
          (Array.isArray(prev) ? prev : []).map((m: any) =>
            m.referenciaId === editingId
              ? {
                  ...m,
                  descricao: `Contas a Receber — ${form.descricao}${form.aluno ? ` · ${form.aluno}` : ''}`,
                  valor: form.valor,
                  editadoEm: new Date().toISOString(),
                }
              : m
          )
        )
        toast.success('Título atualizado com sucesso!')
      }

      setModal(null)
      setEditingId(null)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar título.')
    } finally {
      setSaving(false)
    }
  }

  const handleBaixa = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!editingId) return
    const titulo = rawTitulos.find(t => t.id === editingId)
    if (!titulo) return

    setSaving(true)
    try {
      const valorOriginal = Number(titulo.valor) || 0
      const atr = titulo.status === 'atrasado' ? diasAtraso(titulo.vencimento) : 0
      const enc = baixaForm.aplicarEncargos ? calcularEncargosAtraso(valorOriginal, atr) : { multa: 0, juros: 0, total: valorOriginal }
      const valorDevido = Math.max(0, +(enc.total - (Number(baixaForm.descontoPontualidade) || 0)).toFixed(2))
      const valorPago = Number(baixaForm.valorPago || valorDevido)

      const isParcial = valorPago > 0 && valorPago < valorDevido - 0.01
      const saldoResidual = Math.max(0, Math.round((valorDevido - valorPago) * 100) / 100)

      const changes = {
        ...titulo,
        status: 'pago' as const,
        pagamento: baixaForm.dataPagamento,
        metodo: baixaForm.metodo,
        valor: valorPago,
        valorOriginal: titulo.valorOriginal || valorOriginal,
        jurosPago: enc.juros,
        multaPaga: enc.multa,
        descontoConcedido: Number(baixaForm.descontoPontualidade) || 0,
        parcela: titulo._parcDisplay || '1/1',
        obs: baixaForm.obs,
      }

      await mutateTitulo.mutateAsync(changes)

      if (isParcial && saldoResidual > 0) {
        const residualPayload = {
          ...titulo,
          id: undefined,
          codigo: `${titulo.codigo || genCod(rawTitulos as any)}-RES`,
          descricao: `${titulo.descricao} (Saldo Residual)`,
          valor: saldoResidual,
          valorOriginal,
          parcela: titulo._parcDisplay || '1/1',
          status: 'pendente' as const,
          pagamento: null,
          origemLanca: titulo.origemLanca || 'manual_receber',
          dataLancamento: new Date().toISOString(),
          usuarioLancamento: currentUser?.nome || 'Sistema',
        }
        await mutateTitulo.mutateAsync(residualPayload)
      }

      if (baixaForm.caixaId) {
        setMovimentacoesManuais((prev: any) => [
          {
            id: newId('MOV'),
            caixaId: baixaForm.caixaId,
            tipo: 'entrada',
            valor: Math.abs(valorPago),
            descricao: `Contas a Receber — ${titulo.descricao}${titulo.aluno ? ` · ${titulo.aluno}` : ''}`,
            data: baixaForm.dataPagamento,
            operador: currentUser?.nome || 'Sistema',
            planoContasId: null,
            forma_pagamento: baixaForm.metodo,
            compensadoBanco: 'Compensado',
            origem: 'baixa_receber',
            referenciaId: titulo.id,
            obs: baixaForm.obs || '',
          },
          ...(Array.isArray(prev) ? prev : []),
        ])
      }

      logSystemAction('Financeiro (Receber)', 'Baixa de Pagamento', `Título liquidado via ${baixaForm.metodo}`, {
        registroId: titulo.codigo,
        nomeRelacionado: titulo.aluno,
      })

      toast.success(
        isParcial
          ? `Baixa parcial de ${fmtCur(valorPago)} registrada! Saldo residual de ${fmtCur(saldoResidual)} gerado.`
          : `Baixa de ${fmtCur(valorPago)} confirmada com sucesso!`
      )
      setModal(null)
      setEditingId(null)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao registrar baixa.')
    } finally {
      setSaving(false)
    }
  }

  const handleBaixaLote = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const abertos = selectedObjects.filter(t => t.status !== 'pago')
    if (abertos.length === 0) return

    setSaving(true)
    try {
      const payload = abertos.map(t => ({
        ...t,
        status: 'pago' as const,
        pagamento: baixaForm.dataPagamento,
        metodo: baixaForm.metodo,
        parcela: t._parcDisplay || '1/1',
        obs: baixaForm.obs || 'Baixa em lote',
      }))
      await mutateTitulo.mutateAsync(payload)

      if (baixaForm.caixaId) {
        const novasMovs = abertos.map(t => ({
          id: newId('MOV'),
          caixaId: baixaForm.caixaId,
          tipo: 'entrada',
          valor: Math.abs(Number(t.valor) || 0),
          descricao: `Contas a Receber (Lote) — ${t.descricao}${t.aluno ? ` · ${t.aluno}` : ''}`,
          data: baixaForm.dataPagamento,
          operador: currentUser?.nome || 'Sistema',
          planoContasId: null,
          forma_pagamento: baixaForm.metodo,
          compensadoBanco: 'Compensado',
          origem: 'baixa_receber',
          referenciaId: t.id,
          obs: baixaForm.obs || '',
        }))
        setMovimentacoesManuais((prev: any) => [...novasMovs, ...(Array.isArray(prev) ? prev : [])])
      }

      setSelectedIds(new Set())
      setModal(null)
      toast.success(`${abertos.length} título(s) liquidados em lote com sucesso!`)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao processar baixa em lote.')
    } finally {
      setSaving(false)
    }
  }

  const handleReverter = async (t: any) => {
    try {
      await mutateTitulo.mutateAsync({
        ...t,
        status: 'pendente',
        pagamento: null,
        metodo: null,
        obs: null,
        parcela: t._parcDisplay || '1/1',
      })
      setMovimentacoesManuais((prev: any) => (Array.isArray(prev) ? prev : []).filter((m: any) => m.referenciaId !== t.id))
      toast.success('Baixa estornada! O título retornou para aberto.')
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao reverter baixa.')
    }
  }

  const handleDelete = async () => {
    if (!confirmId) return
    try {
      await mutateDelete.mutateAsync({ id: confirmId })
      setMovimentacoesManuais((prev: any) => (Array.isArray(prev) ? prev : []).filter((m: any) => m.referenciaId !== confirmId))
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(confirmId)
        return next
      })
      toast.success('Título excluído com sucesso.')
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao excluir título.')
    } finally {
      setConfirmId(null)
    }
  }

  const handleBatchDelete = async () => {
    const deletable = selectedObjects.filter(t => t.status !== 'pago').map(t => t.id)
    if (deletable.length === 0) {
      toast.error('Títulos já pagos não podem ser excluídos diretamente. Reverta a baixa primeiro.')
      setConfirmBatchDelete(false)
      return
    }
    try {
      await mutateDelete.mutateAsync({ ids: deletable })
      setSelectedIds(new Set())
      toast.success(`${deletable.length} título(s) excluído(s) com sucesso.`)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir seleção.')
    } finally {
      setConfirmBatchDelete(false)
    }
  }

  const handleWhatsAppCobranca = (t: any) => {
    const alunoObj = (alunos || []).find(a => a.nome === t.aluno)
    const foneRaw = String(alunoObj?.telefone || alunoObj?.telResponsavelFinanceiro || '').replace(/\D/g, '')
    const atr = t.status === 'atrasado' ? diasAtraso(t.vencimento) : 0
    const saudacao = t.responsavel ? `Olá, *${t.responsavel}*!` : `Olá!`
    const msg =
      `${saudacao} Aqui é da Tesouraria do *Colégio Impacto*.\n\n` +
      `Identificamos o título referente a *${t.descricao}*${t.aluno ? ` (Aluno(a): *${t.aluno}*)` : ''} ` +
      `com vencimento em *${fmt(t.vencimento)}* no valor de *${fmtCur(t.valor)}*` +
      `${atr > 0 ? ` (${atr} dia(s) em atraso)` : ''}.\n\n` +
      `Caso já tenha efetuado o pagamento, por gentileza desconsidere esta mensagem ou nos envie o comprovante. Estamos à disposição!`

    const url = foneRaw.length >= 10
      ? `https://wa.me/55${foneRaw}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const clearFilters = () => {
    setSearchRaw('')
    setTabStatus('todos')
    setFiltroMetodo('todos')
    setFiltroCentroCusto('todos')
    setFiltroMes('todos')
    setFiltroAno('todos')
    setDataVencDe('')
    setDataVencAte('')
    setFiltroAging('todos')
    setFiltroEvento('todos')
    setFiltroOrigem('todos')
  }

  const handleExportExcel = (onlySelected = false) => {
    const source = onlySelected && selectedObjects.length > 0 ? selectedObjects : filtered
    const rows = source.map(t => ({
      Código: t.codigo || t.id,
      Aluno: t.aluno || 'Receita Avulsa',
      'Responsável Financeiro': t.responsavel || '—',
      Descrição: t.descricao || '',
      'Centro de Custo': t.centroCusto || '—',
      Parcela: t._parcDisplay || '1/1',
      Vencimento: fmt(t.vencimento),
      'Data Pagamento': fmt(t.pagamento),
      'Dias Atraso': t.status === 'atrasado' ? diasAtraso(t.vencimento) : 0,
      'Valor (R$)': Number(t.valor || 0),
      Status: STATUS_CFG[t.status as keyof typeof STATUS_CFG]?.label || t.status,
      'Método Pagamento': t.metodo || '—',
      Observações: t.obs || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Contas_a_Receber')
    XLSX.writeFile(wb, `Contas_a_Receber_Impacto_${today()}.xlsx`)
    toast.success(`Planilha Excel exportada (${rows.length} registros)!`)
  }

  const handleExportCSV = () => {
    const headers = ['Código', 'Aluno', 'Responsável', 'Descrição', 'Centro de Custo', 'Parcela', 'Vencimento', 'Pagamento', 'Valor', 'Status', 'Método']
    const rows = filtered.map(t => [
      t.codigo || t.id,
      t.aluno || '',
      t.responsavel || '',
      t.descricao || '',
      t.centroCusto || '',
      t._parcDisplay || '1/1',
      t.vencimento || '',
      t.pagamento || '',
      Number(t.valor || 0).toFixed(2).replace('.', ','),
      t.status || '',
      t.metodo || '',
    ])
    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(';')),
    ].join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `contas-a-receber-${today()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Arquivo CSV exportado com sucesso!')
  }

  const activeFilters = [
    filtroMetodo !== 'todos',
    filtroCentroCusto !== 'todos',
    filtroMes !== 'todos',
    filtroAno !== 'todos',
    Boolean(dataVencDe),
    Boolean(dataVencAte),
    filtroAging !== 'todos',
    filtroEvento !== 'todos',
    filtroOrigem !== 'todos',
  ].filter(Boolean).length

  const selectedTitulo = rawTitulos.find(t => t.id === editingId)

  return (
    <div>
      {/* Header Executivo */}
      <div className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Contas a Receber & Faturamento
            {isFetchingTitulos && <UpdatingIndicator />}
          </h1>
          <p className="page-subtitle">
            Taxa de recebimento: <strong style={{ color: '#10b981' }}>{kpis.taxaRecebimento.toFixed(1)}%</strong>
            {' '}• Carteira ativa: <strong style={{ color: '#3b82f6' }}>{fmtCur(kpis.totalCarteira)}</strong>
            {kpis.totalAtrasado > 0 && (
              <span style={{ marginLeft: 12, color: '#ef4444', fontWeight: 700 }}>
                ⚠ {fmtCur(kpis.totalAtrasado)} em atraso ({kpis.taxaInadimplencia.toFixed(1)}%)
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleExportExcel(false)} title="Exportar planilha Excel (.xlsx)">
            <FileSpreadsheet size={14} style={{ color: '#10b981' }} />Exportar Excel
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCSV} title="Exportar arquivo CSV">
            <Download size={13} />CSV
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={openNew}>
            <Plus size={14} />Novo Título
          </button>
        </div>
      </div>

      {/* Radar Inteligente de Recebíveis */}
      {(kpis.qtdAtrasado > 0 || kpis.venceHojeQtd > 0) && (
        <div
          style={{
            marginBottom: 16,
            padding: '11px 16px',
            borderRadius: 12,
            background: kpis.qtdAtrasado > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${kpis.qtdAtrasado > 0 ? 'rgba(239,68,68,0.28)' : 'rgba(245,158,11,0.28)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5 }}>
            <AlertTriangle size={16} color={kpis.qtdAtrasado > 0 ? '#ef4444' : '#f59e0b'} />
            <span>
              <strong>Radar de Cobrança:</strong>{' '}
              {kpis.qtdAtrasado > 0 && (
                <span style={{ color: '#ef4444', fontWeight: 700, marginRight: 12 }}>
                  • {kpis.qtdAtrasado} título(s) vencido(s) ({fmtCur(kpis.totalAtrasado)})
                </span>
              )}
              {kpis.venceHojeQtd > 0 && (
                <span style={{ color: '#d97706', fontWeight: 700 }}>
                  • {kpis.venceHojeQtd} vencendo HOJE ({fmtCur(kpis.venceHojeVal)})
                </span>
              )}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {kpis.qtdAtrasado > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 700 }}
                onClick={() => setTabStatus('atrasado')}
              >
                Filtrar Vencidos
              </button>
            )}
            {kpis.venceHojeQtd > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(245,158,11,0.12)', color: '#d97706', border: '1px solid rgba(245,158,11,0.3)', fontWeight: 700 }}
                onClick={() => {
                  setTabStatus('pendente')
                  setDataVencDe(today())
                  setDataVencAte(today())
                }}
              >
                Vencimentos de Hoje
              </button>
            )}
          </div>
        </div>
      )}

      {/* KPIs Interativos (Click-to-Filter) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          {
            id: 'pago',
            label: 'Recebido (Caixa)',
            value: fmtCur(kpis.totalPago),
            sub: `${kpis.qtdPago} título(s) liquidado(s)`,
            color: '#10b981',
            icon: '✅',
            active: tabStatus === 'pago',
            onClick: () => setTabStatus(tabStatus === 'pago' ? 'todos' : 'pago'),
          },
          {
            id: 'pendente',
            label: 'A Vencer (No Prazo)',
            value: fmtCur(kpis.totalPendente),
            sub: `${kpis.qtdPendente} título(s) em aberto`,
            color: '#f59e0b',
            icon: '⏰',
            active: tabStatus === 'pendente',
            onClick: () => setTabStatus(tabStatus === 'pendente' ? 'todos' : 'pendente'),
          },
          {
            id: 'atrasado',
            label: 'Em Atraso (Vencidos)',
            value: fmtCur(kpis.totalAtrasado),
            sub: `${kpis.qtdAtrasado} vencido(s) • ${kpis.taxaInadimplencia.toFixed(1)}%`,
            color: '#ef4444',
            icon: '⚠️',
            active: tabStatus === 'atrasado',
            onClick: () => setTabStatus(tabStatus === 'atrasado' ? 'todos' : 'atrasado'),
          },
          {
            id: 'todos',
            label: 'Carteira Ativa Total',
            value: fmtCur(kpis.totalCarteira),
            sub: `${titulos.length} título(s) ativos`,
            color: '#3b82f6',
            icon: '💰',
            active: tabStatus === 'todos' && activeFilters === 0 && !search,
            onClick: clearFilters,
          },
          {
            id: 'selecionados',
            label: selectedIds.size > 0 ? `Selecionados (${selectedIds.size})` : 'Subtotal Filtrado',
            value: fmtCur(selectedIds.size > 0 ? totalSelected : totalFiltrado),
            sub: selectedIds.size > 0 ? `${selectedIds.size} marcado(s) na grade` : `${filtered.length} de ${titulos.length} registros`,
            color: '#8b5cf6',
            icon: '🔍',
            active: selectedIds.size > 0,
            onClick: () => {
              if (selectedIds.size > 0) setSelectedIds(new Set())
            },
          },
        ].map(k => (
          <div
            key={k.id}
            className="kpi-card"
            onClick={k.onClick}
            style={{
              cursor: 'pointer',
              borderColor: k.active ? k.color : undefined,
              boxShadow: k.active ? `0 0 0 1.5px ${k.color}40` : undefined,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 16 }}>{k.icon}</span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {k.label}
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: k.color, fontFamily: 'Outfit,sans-serif' }}>{k.value}</div>
            <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))', marginTop: 3 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Painel Analítico: Performance + Aging Interativo + Previsão */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
        {/* 1. Performance de Recebimento */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📊 Performance de Recebimento
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
            <span>Meta Escolar: <strong>95%</strong></span>
            <span style={{ fontWeight: 800, color: kpis.taxaRecebimento >= 95 ? '#10b981' : kpis.taxaRecebimento >= 80 ? '#f59e0b' : '#ef4444' }}>
              {kpis.taxaRecebimento.toFixed(1)}%
            </span>
          </div>
          <div style={{ background: 'hsl(var(--bg-overlay))', borderRadius: 6, height: 10, overflow: 'hidden', marginBottom: 12 }}>
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, kpis.taxaRecebimento)}%`,
                borderRadius: 6,
                background:
                  kpis.taxaRecebimento >= 95
                    ? 'linear-gradient(90deg,#10b981,#34d399)'
                    : kpis.taxaRecebimento >= 80
                      ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                      : 'linear-gradient(90deg,#ef4444,#f87171)',
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          {[
            { label: 'Liquidado / Pago', valor: kpis.totalPago, color: '#10b981' },
            { label: 'A Vencer (No Prazo)', valor: kpis.totalPendente, color: '#f59e0b' },
            { label: 'Vencido / Em Atraso', valor: kpis.totalAtrasado, color: '#ef4444' },
          ].map(r => (
            <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 5 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color, display: 'inline-block' }} />
                {r.label}
              </span>
              <span style={{ fontWeight: 700, color: r.color }}>{fmtCur(r.valor)}</span>
            </div>
          ))}
        </div>

        {/* 2. Aging de Inadimplência (Clicável para filtrar por faixa) */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              ⚠ Aging de Inadimplência
            </div>
            {filtroAging !== 'todos' && (
              <button
                type="button"
                onClick={() => setFiltroAging('todos')}
                style={{ fontSize: 10, color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
              >
                Mostrar todos
              </button>
            )}
          </div>
          {kpis.totalAtrasado === 0 ? (
            <div style={{ textAlign: 'center', color: '#10b981', fontSize: 13, fontWeight: 700, padding: '20px 0' }}>
              ✅ Carteira 100% adimplente — sem títulos vencidos
            </div>
          ) : (
            agingData.map(b => {
              const isSelected = filtroAging === b.label
              return (
                <div
                  key={b.label}
                  onClick={() => {
                    if (isSelected) {
                      setFiltroAging('todos')
                    } else {
                      setTabStatus('atrasado')
                      setFiltroAging(b.label)
                    }
                  }}
                  style={{
                    marginBottom: 8,
                    cursor: 'pointer',
                    padding: '3px 6px',
                    borderRadius: 6,
                    background: isSelected ? 'hsl(var(--bg-overlay))' : 'transparent',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                    <span style={{ color: b.color, fontWeight: 700 }}>{b.label}</span>
                    <span style={{ fontWeight: 700 }}>{b.qtd > 0 ? `${b.qtd} tít. • ${fmtCur(b.valor)}` : '—'}</span>
                  </div>
                  <div style={{ background: 'hsl(var(--bg-overlay))', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${kpis.totalAtrasado > 0 ? (b.valor / kpis.totalAtrasado) * 100 : 0}%`,
                        background: b.color,
                        borderRadius: 4,
                      }}
                    />
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* 3. Previsão de Recebimento (Próximos 3 Meses) */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📅 Previsão de Recebimento (3 Meses)
          </div>
          {previsao.map(p => {
            const maxVal = Math.max(...previsao.map(x => x.valor), 1)
            return (
              <div
                key={p.label}
                style={{ marginBottom: 9, cursor: 'pointer' }}
                onClick={() => {
                  setFiltroMes(p.mes)
                  setFiltroAno(p.ano)
                  setShowFilters(true)
                }}
                title={`Filtrar vencimentos de ${p.label}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600 }}>
                    {p.label} <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>({p.qtd})</span>
                  </span>
                  <span style={{ fontWeight: 800, color: '#3b82f6' }}>{fmtCur(p.valor)}</span>
                </div>
                <div style={{ background: 'hsl(var(--bg-overlay))', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${p.valor > 0 ? (p.valor / maxVal) * 100 : 0}%`,
                      background: 'linear-gradient(90deg,#3b82f6,#60a5fa)',
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>
            )
          })}
          <div
            style={{
              borderTop: '1px solid hsl(var(--border-subtle))',
              paddingTop: 8,
              marginTop: 4,
              fontSize: 11.5,
              color: 'hsl(var(--text-muted))',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>Total previsto trimestre</span>
            <strong style={{ color: '#3b82f6' }}>{fmtCur(previsao.reduce((s, p) => s + p.valor, 0))}</strong>
          </div>
        </div>
      </div>

      {/* Barra de Filtros Principais */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tab-list">
          {(['todos', 'pendente', 'atrasado', 'pago'] as const).map(s => {
            const count =
              s === 'todos'
                ? titulosReceber.length
                : s === 'pago'
                  ? kpis.qtdPago
                  : s === 'atrasado'
                    ? kpis.qtdAtrasado
                    : kpis.qtdPendente
            return (
              <button
                key={s}
                type="button"
                className={`tab-trigger ${tabStatus === s ? 'active' : ''}`}
                onClick={() => setTabStatus(s)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <span>{s === 'todos' ? 'Todos' : STATUS_CFG[s].label}</span>
                <span
                  style={{
                    fontSize: 10,
                    padding: '1px 6px',
                    borderRadius: 99,
                    background: tabStatus === s ? 'rgba(59,130,246,0.18)' : 'hsl(var(--bg-overlay))',
                    fontWeight: 800,
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: 230 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar por aluno, código (TIT-...), responsável ou descrição..."
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={searchRaw}
            onChange={e => setSearchRaw(e.target.value)}
          />
          {searchRaw && (
            <button
              type="button"
              onClick={() => setSearchRaw('')}
              aria-label="Limpar busca"
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowUpDown size={13} style={{ color: 'hsl(var(--text-muted))' }} />
          <select
            aria-label="Ordenar títulos"
            className="form-input"
            style={{ width: 185, padding: '7px 10px', fontSize: 12 }}
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
          >
            <option value="venc_desc">Vencimento (Mais Recentes)</option>
            <option value="venc_asc">Vencimento (Mais Antigos)</option>
            <option value="valor_desc">Maior Valor</option>
            <option value="valor_asc">Menor Valor</option>
            <option value="aluno_asc">Aluno / Descrição (A-Z)</option>
          </select>
        </div>

        <button
          type="button"
          className={`btn btn-sm ${showFilters || activeFilters > 0 ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowFilters(p => !p)}
        >
          <Filter size={13} />Filtros
          {activeFilters > 0 && (
            <span
              style={{
                background: '#ef4444',
                color: '#fff',
                borderRadius: '50%',
                width: 16,
                height: 16,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 9,
                fontWeight: 900,
                marginLeft: 2,
              }}
            >
              {activeFilters}
            </span>
          )}
        </button>

        {(activeFilters > 0 || searchRaw || tabStatus !== 'todos') && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ color: '#ef4444', fontWeight: 700 }} onClick={clearFilters}>
            <X size={12} />Limpar
          </button>
        )}
      </div>

      {/* Painel de Filtros Avançados */}
      {showFilters && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 12, display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label htmlFor="cr-origem" className="form-label" style={{ fontSize: 10 }}>Origem da Receita</label>
            <select id="cr-origem" className="form-input" style={{ width: 175 }} value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value as any)}>
              <option value="todos">Todas as Origens</option>
              <option value="manual_receber">Lançamentos Manuais</option>
              <option value="acordo">Acordos / Renegociação</option>
              <option value="matricula">Mensalidades / Matrícula</option>
            </select>
          </div>
          <div>
            <label htmlFor="cr-venc-de" className="form-label" style={{ fontSize: 10 }}>Vencimento de</label>
            <input id="cr-venc-de" type="date" className="form-input" style={{ width: 142 }} value={dataVencDe} onChange={e => setDataVencDe(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cr-venc-ate" className="form-label" style={{ fontSize: 10 }}>Vencimento até</label>
            <input id="cr-venc-ate" type="date" className="form-input" style={{ width: 142 }} value={dataVencAte} onChange={e => setDataVencAte(e.target.value)} />
          </div>
          <div>
            <label htmlFor="cr-mes" className="form-label" style={{ fontSize: 10 }}>Mês Venc.</label>
            <select id="cr-mes" className="form-input" style={{ width: 125 }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
              <option value="todos">Todos</option>
              {MESES_FULL.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cr-ano" className="form-label" style={{ fontSize: 10 }}>Ano</label>
            <select id="cr-ano" className="form-input" style={{ width: 95 }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
              <option value="todos">Todos</option>
              {anos.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cr-metodo" className="form-label" style={{ fontSize: 10 }}>Método de Pag.</label>
            <select id="cr-metodo" className="form-input" style={{ width: 150 }} value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)}>
              <option value="todos">Todos</option>
              {metodosSelect.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cr-evento" className="form-label" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tag size={10} />Evento Financeiro
            </label>
            <select id="cr-evento" className="form-input" style={{ width: 190 }} value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)}>
              <option value="todos">Todos os eventos</option>
              {todosEventosAtivos.length > 0 ? (
                todosEventosAtivos.map(e => (
                  <option key={e.id} value={e.descricao}>
                    {e.codigo} — {e.descricao}
                  </option>
                ))
              ) : (
                <option disabled value="">Nenhum evento ativo</option>
              )}
            </select>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <label htmlFor="cr-centro-custo" className="form-label" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Target size={10} />Centro de Custo
              </label>
              <Link
                href="/configuracoes/financeiro/centro-custo"
                style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', textDecoration: 'none', marginBottom: 4 }}
              >
                Configurar
              </Link>
            </div>
            <select
              id="cr-centro-custo"
              className="form-input"
              style={{ width: 205 }}
              value={filtroCentroCusto}
              onChange={e => setFiltroCentroCusto(e.target.value)}
            >
              <option value="todos">Todos os Centros de Custo</option>
              {todosCentrosCusto.map(cc => (
                <option key={cc.id} value={cc.id}>
                  {cc.sigla} — {cc.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Barra de Ações em Lote quando há títulos selecionados */}
      {selectedIds.size > 0 && (
        <div
          style={{
            marginBottom: 12,
            padding: '12px 18px',
            borderRadius: 12,
            background: 'rgba(16,185,129,0.08)',
            border: '1.5px solid rgba(16,185,129,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700 }}>
            <strong>{selectedIds.size}</strong> título(s) selecionado(s) • Total:{' '}
            <strong style={{ color: '#10b981', fontSize: 15 }}>{fmtCur(totalSelected)}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedObjects.some(t => t.status !== 'pago') && (
              <button type="button" className="btn btn-primary btn-sm" style={{ background: '#10b981' }} onClick={openBaixaLote}>
                <Check size={13} />Baixar Selecionados ({selectedObjects.filter(t => t.status !== 'pago').length})
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleExportExcel(true)}>
              <FileSpreadsheet size={13} />Exportar Seleção
            </button>
            {selectedObjects.some(t => t.status !== 'pago') && (
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmBatchDelete(true)}>
                <Trash2 size={13} />Excluir Em Aberto
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedIds(new Set())}>
              Desmarcar
            </button>
          </div>
        </div>
      )}

      {/* Tabela Principal de Contas a Receber */}
      {loadingTitulos && titulos.length === 0 ? (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>Código</th>
                <th>Aluno / Responsável</th>
                <th>Descrição</th>
                <th>Vencimento</th>
                <th style={{ textAlign: 'center' }}>Parcela</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Método</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              <TableSkeleton rows={8} cols={10} />
            </tbody>
          </table>
        </div>
      ) : titulos.length === 0 ? (
        <div className="card" style={{ padding: '64px 24px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <DollarSign size={48} style={{ opacity: 0.15, margin: '0 auto 16px', display: 'block' }} />
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6, color: 'hsl(var(--text-primary))' }}>Nenhum título lançado</div>
          <div style={{ fontSize: 13, marginBottom: 20 }}>Registre mensalidades, taxas escolares, materiais e créditos diversos com controle completo de caixa.</div>
          <button type="button" className="btn btn-primary" onClick={openNew}>
            <Plus size={14} />Lançar Primeiro Título
          </button>
        </div>
      ) : (
        <div
          className="table-container"
          tabIndex={0}
          role="region"
          aria-label="Relação de Contas a Receber"
          style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 600px' }}
        >
          <table>
            <thead>
              <tr>
                <th style={{ width: 38, textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    aria-label="Selecionar todos os títulos da página"
                    checked={titulosLista.length > 0 && titulosLista.every(t => selectedIds.has(t.id))}
                    onChange={e => {
                      const next = new Set(selectedIds)
                      if (e.target.checked) {
                        titulosLista.forEach(t => next.add(t.id))
                      } else {
                        titulosLista.forEach(t => next.delete(t.id))
                      }
                      setSelectedIds(next)
                    }}
                  />
                </th>
                <th>Código</th>
                <th>Aluno / Responsável</th>
                <th>Descrição</th>
                <th>Vencimento</th>
                <th style={{ textAlign: 'center' }}>Parcela</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Método</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {titulosLista.map(t => {
                const atr = t.status === 'atrasado' ? diasAtraso(t.vencimento) : 0
                const sc = STATUS_CFG[t.status as keyof typeof STATUS_CFG] || STATUS_CFG.pendente
                const isToday = t.status !== 'pago' && t.vencimento === today()
                const cur = t._parcCur || 1
                const tot = t._parcTot || 1
                const parcLabelStr = t._parcDisplay || '1/1'
                const isSingle = tot === 1
                const isFirst = cur === 1 && tot > 1
                const isLast = cur === tot && tot > 1
                const pBg = isSingle ? 'rgba(99,102,241,0.1)' : isFirst ? 'rgba(16,185,129,0.1)' : isLast ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.08)'
                const pColor = isSingle ? '#6366f1' : isFirst ? '#10b981' : isLast ? '#f59e0b' : '#3b82f6'
                const pSub = isSingle ? 'Única' : isFirst ? 'Inicial' : isLast ? 'Final' : 'Mensal'

                return (
                  <tr key={t.id}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        aria-label={`Selecionar título ${t.codigo || t.descricao}`}
                        checked={selectedIds.has(t.id)}
                        onChange={e => {
                          const next = new Set(selectedIds)
                          if (e.target.checked) next.add(t.id)
                          else next.delete(t.id)
                          setSelectedIds(next)
                        }}
                      />
                    </td>
                    <td>
                      <code
                        style={{
                          fontSize: 10.5,
                          background: 'hsl(var(--bg-overlay))',
                          padding: '3px 7px',
                          borderRadius: 5,
                          color: '#3b82f6',
                          fontWeight: 800,
                        }}
                      >
                        {t.codigo || String(t.id).slice(0, 8).toUpperCase()}
                      </code>
                    </td>
                    <td style={{ whiteSpace: 'normal', minWidth: 160, maxWidth: 240 }}>
                      {t.aluno ? (
                        <>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'hsl(var(--text-primary))', lineHeight: 1.3 }}>
                            {t.aluno}
                          </div>
                          {t.responsavel && (
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                              Resp: {t.responsavel}
                            </div>
                          )}
                        </>
                      ) : (
                        <div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>
                            {t.responsavel || 'Lançamento Avulso'}
                          </span>
                          <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))' }}>Sem vínculo de aluno</div>
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 12.5, whiteSpace: 'normal', minWidth: 180, maxWidth: 280 }}>
                      <div style={{ fontWeight: 600, color: 'hsl(var(--text-primary))', lineHeight: 1.35 }}>{t.descricao}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 3 }}>
                        {t.centroCusto && (() => {
                          const ccMeta = todosCentrosCusto.find(c => c.id === t.centroCusto)
                          const ccCor = ccMeta?.cor || '#38bdf8'
                          const ccSigla = ccMeta?.sigla || 'CC'
                          return (
                            <span
                              title={`Centro de Custo: ${t.centroCusto}`}
                              style={{
                                fontSize: 10,
                                padding: '1px 7px',
                                borderRadius: 20,
                                background: `${ccCor}1f`,
                                color: ccCor,
                                border: `1px solid ${ccCor}45`,
                                fontWeight: 700,
                              }}
                            >
                              {ccSigla} • {t.centroCusto}
                            </span>
                          )
                        })()}
                        {t.eventoDescricao && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '1px 7px',
                              borderRadius: 20,
                              background: 'rgba(99,102,241,0.1)',
                              color: '#6366f1',
                              fontWeight: 700,
                            }}
                          >
                            {t.eventoDescricao}
                          </span>
                        )}
                        {t.acordoId && (
                          <span
                            style={{
                              fontSize: 10,
                              padding: '1px 7px',
                              borderRadius: 20,
                              background: 'rgba(6,182,212,0.12)',
                              color: '#0891b2',
                              fontWeight: 700,
                            }}
                          >
                            Acordo {t.acordoId}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: isToday ? '#d97706' : undefined }}>
                        {fmt(t.vencimento)}
                      </div>
                      {isToday && (
                        <div style={{ fontSize: 10, fontWeight: 800, color: '#d97706', marginTop: 1 }}>Vence Hoje!</div>
                      )}
                      {atr > 0 && (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: atr > 90 ? '#7f1d1d' : atr > 60 ? '#ef4444' : atr > 30 ? '#f97316' : '#d97706',
                            marginTop: 1,
                          }}
                        >
                          {atr}d em atraso
                        </div>
                      )}
                      {t.status === 'pago' && t.pagamento && (
                        <div style={{ fontSize: 10, color: '#10b981', fontWeight: 600, marginTop: 1 }}>
                          Pago {fmt(t.pagamento)}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        title={t._parcCodigo ? `Parcela ${parcLabelStr} (${t._parcCodigo})` : `Parcela ${parcLabelStr}`}
                        style={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 1,
                          padding: '3px 10px',
                          borderRadius: 12,
                          background: pBg,
                          border: `1px solid ${pColor}28`,
                          minWidth: 52,
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 12.5, color: pColor, lineHeight: 1.1 }}>
                          {parcLabelStr}
                        </span>
                        <span style={{ fontSize: 8.5, fontWeight: 700, color: pColor, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          {pSub}
                        </span>
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: sc.color, fontFamily: 'Outfit,sans-serif' }}>
                      <div>{fmtCur(t.valor)}</div>
                      {atr > 0 && t.status === 'atrasado' && (
                        <div style={{ fontSize: 9.5, color: 'hsl(var(--text-muted))', fontWeight: 600 }} title="Valor atualizado com Multa 2% + Juros 1% a.m.">
                          c/ encargos: {fmtCur(calcularEncargosAtraso(t.valor, atr).total)}
                        </div>
                      )}
                    </td>
                    <td>
                      {t.metodo ? (
                        <span
                          style={{
                            fontSize: 10.5,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(99,102,241,0.1)',
                            color: '#6366f1',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.metodo}
                        </span>
                      ) : (
                        <span style={{ color: 'hsl(var(--text-muted))', fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: 11,
                          padding: '3px 9px',
                          borderRadius: 100,
                          background: sc.bg,
                          color: sc.color,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sc.icon} {sc.label}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                        {t.status !== 'pago' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: 10.5, padding: '4px 9px', gap: 4, background: '#10b981' }}
                              onClick={() => openBaixa(t)}
                              title="Registrar recebimento / baixa"
                            >
                              <Check size={11} />Baixar
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm btn-icon"
                              style={{ color: '#10b981' }}
                              onClick={() => handleWhatsAppCobranca(t)}
                              title="Enviar lembrete/cobrança via WhatsApp"
                            >
                              <MessageCircle size={13} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: 10.5, padding: '4px 8px', gap: 4 }}
                              onClick={() => setReceiptTarget(t)}
                              title="Emitir Recibo Oficial com QR Code"
                            >
                              <Printer size={11} />Recibo
                            </button>
                            <button
                              type="button"
                              title="Estornar / Reverter Baixa"
                              className="btn btn-sm"
                              style={{
                                fontSize: 10.5,
                                padding: '4px 8px',
                                background: 'rgba(245,158,11,0.12)',
                                color: '#d97706',
                                border: '1px solid rgba(245,158,11,0.3)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                fontWeight: 700,
                                borderRadius: 6,
                              }}
                              onClick={() => handleReverter(t)}
                            >
                              <RotateCcw size={10} />Reverter
                            </button>
                          </>
                        )}
                        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(t)} title="Editar título">
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-icon"
                          style={{ color: '#ef4444' }}
                          onClick={() => {
                            if (t.status === 'pago') {
                              setAlertMsg("Não é possível excluir um título que já consta como PAGO. Clique em 'Reverter' primeiro.")
                            } else {
                              setConfirmId(t.id)
                            }
                          }}
                          title="Excluir título"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtered.length === 0 && titulos.length > 0 && (
            <div style={{ padding: 32, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Nenhum título encontrado para os filtros aplicados —{' '}
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                limpar filtros
              </button>
            </div>
          )}

          <div
            style={{
              padding: '12px 16px',
              borderTop: '1px solid hsl(var(--border-subtle))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
              fontSize: 12,
              color: 'hsl(var(--text-muted))',
            }}
          >
            <span>
              Exibindo <strong>{titulosLista.length}</strong> de <strong>{filtered.length}</strong> títulos filtrados (Carteira: {titulos.length})
            </span>
            <span style={{ fontWeight: 800, color: 'hsl(var(--text-primary))', fontSize: 13 }}>
              Subtotal Filtrado: <strong style={{ color: '#10b981' }}>{fmtCur(totalFiltrado)}</strong>
            </span>
          </div>

          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 20px',
                borderTop: '1px solid hsl(var(--border-subtle))',
              }}
            >
              <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filtered.length)}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                >
                  Anterior
                </button>
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: 12.5, fontWeight: 700 }}>
                  Página {currentPage} de {totalPages}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Modal de Recibo Oficial (ReceiptModal) ─── */}
      {receiptTarget && (
        <ReceiptModal
          aluno={{
            nome: receiptTarget.aluno || receiptTarget.responsavel || 'Pagador Diverso',
            responsavelFinanceiro: receiptTarget.responsavel || receiptTarget.aluno || 'Responsável Financeiro',
            codigo: receiptTarget.codigo,
          }}
          parcelas={[
            {
              num: receiptTarget._parcCur || 1,
              evento: receiptTarget.descricao || 'Receita Escolar',
              competencia: (receiptTarget.vencimento || '').slice(0, 7),
              vencimento: receiptTarget.vencimento,
              valor: Number(receiptTarget.valorOriginal || receiptTarget.valor) || 0,
              desconto: Number(receiptTarget.descontoConcedido) || 0,
              juros: Number(receiptTarget.jurosPago) || 0,
              multa: Number(receiptTarget.multaPaga) || 0,
              valorFinal: Number(receiptTarget.valor) || 0,
              dtPagto: receiptTarget.pagamento || today(),
              formaPagto: receiptTarget.metodo || 'PIX',
              codBaixa: receiptTarget.codigo || receiptTarget.id,
              obs: receiptTarget.obs,
              status: 'pago',
            } as ReceiptParcela,
          ]}
          onClose={() => setReceiptTarget(null)}
        />
      )}

      {/* ─── Modal de Seleção de Evento ─── */}
      <AnimatePresence>
        {showEventoModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.75)',
              zIndex: 4000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
            }}
            onClick={() => setShowEventoModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'hsl(var(--bg-surface))',
                borderRadius: 18,
                width: '100%',
                maxWidth: 540,
                maxHeight: '80vh',
                display: 'flex',
                flexDirection: 'column',
                border: '1px solid hsl(var(--border-subtle))',
                boxShadow: '0 30px 90px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '16px 22px',
                  borderBottom: '1px solid hsl(var(--border-subtle))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Tag size={16} color="#3b82f6" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>Selecionar Evento Financeiro</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                      {(cfgEventos || []).filter(e => e.situacao === 'ativo').length} eventos ativos
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setShowEventoModal(false)} className="btn btn-ghost btn-icon">
                  <X size={16} />
                </button>
              </div>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: 32 }}
                    placeholder="Filtrar eventos..."
                    value={eventoModalSearch}
                    onChange={e => setEventoModalSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {eventosFiltradosModal.length === 0 ? (
                  <div style={{ padding: 36, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
                    Nenhum evento encontrado.
                  </div>
                ) : (
                  eventosFiltradosModal.map(e => (
                    <div
                      key={e.id}
                      onClick={() => {
                        setForm(p => ({
                          ...p,
                          eventoId: e.id,
                          eventoNome: e.descricao,
                          eventoTipo: e.tipo,
                          descricao: p.descricao || e.descricao,
                        }))
                        setShowEventoModal(false)
                      }}
                      style={{
                        padding: '12px 20px',
                        cursor: 'pointer',
                        borderBottom: '1px solid hsl(var(--border-subtle))',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 8,
                          background: e.tipo === 'receita' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 900, color: e.tipo === 'receita' ? '#10b981' : '#f59e0b' }}>
                          {e.tipo === 'receita' ? 'R' : 'D'}
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{e.descricao}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                          {e.codigo} • {e.tipo === 'receita' ? 'Receita' : 'Despesa'}
                        </div>
                      </div>
                      <Check size={14} style={{ opacity: form.eventoId === e.id ? 1 : 0, color: '#3b82f6' }} />
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Modal Novo / Editar Título ─── */}
      {(modal === 'new' || modal === 'edit') && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(4px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setModal(null)}
        >
          <form
            onSubmit={handleSave}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'hsl(var(--bg-surface))',
              borderRadius: 20,
              width: '100%',
              maxWidth: 640,
              maxHeight: '92vh',
              overflow: 'hidden',
              border: '1px solid hsl(var(--border-subtle))',
              boxShadow: '0 30px 90px rgba(0,0,0,0.45)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '18px 24px',
                background: 'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(16,185,129,0.04))',
                borderBottom: '1px solid hsl(var(--border-subtle))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={18} color="white" />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>
                    {modal === 'new' ? 'Novo Título a Receber' : 'Editar Título a Receber'}
                  </div>
                  {form.codigo && <code style={{ fontSize: 11, color: '#3b82f6', fontWeight: 700 }}>{form.codigo}</code>}
                </div>
              </div>
              <button type="button" onClick={() => setModal(null)} className="btn btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ position: 'relative' }}>
                  <label htmlFor="cr-form-aluno" className="form-label">Aluno (Opcional p/ Avulso)</label>
                  <div style={{ position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                    <input
                      id="cr-form-aluno"
                      className="form-input"
                      style={{ paddingLeft: 30 }}
                      value={alunoSearch}
                      onChange={e => {
                        setAlunoSearch(e.target.value)
                        set('aluno', e.target.value)
                        setShowAlunoDrop(true)
                      }}
                      onFocus={() => setShowAlunoDrop(true)}
                      onBlur={() => setTimeout(() => setShowAlunoDrop(false), 180)}
                      placeholder="Buscar aluno por nome..."
                      autoComplete="off"
                    />
                    {alunoSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setAlunoSearch('')
                          set('aluno', '')
                          set('responsavel', '')
                        }}
                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                  {showAlunoDrop && alunosFiltrados.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 999,
                        background: 'hsl(var(--bg-surface))',
                        border: '1px solid hsl(var(--border-default))',
                        borderRadius: 10,
                        overflow: 'hidden',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
                        marginTop: 4,
                        maxHeight: 220,
                        overflowY: 'auto',
                      }}
                    >
                      {alunosFiltrados.map(a => (
                        <div
                          key={a.id}
                          onMouseDown={() => {
                            setAlunoSearch(a.nome)
                            set('aluno', a.nome)
                            if (a.responsavel || a.responsavelFinanceiro) {
                              set('responsavel', a.responsavelFinanceiro || a.responsavel)
                            }
                            if (!form.centroCusto) {
                              const refTxt = `${a.serie || ''} ${a.turma || ''}`.toLowerCase()
                              if (refTxt.includes('infantil') || refTxt.includes('maternal') || refTxt.includes('berc') || refTxt.includes('jardim') || refTxt.includes('pre')) {
                                const ccInf = centrosCustoReceber.find(c => c.sigla === 'INF' || c.id.toLowerCase().includes('infantil'))
                                if (ccInf) set('centroCusto', ccInf.id)
                              } else if (refTxt.includes('1º') || refTxt.includes('2º') || refTxt.includes('3º') || refTxt.includes('4º') || refTxt.includes('5º')) {
                                const ccEf1 = centrosCustoReceber.find(c => c.sigla === 'EF1' || c.id.toLowerCase().includes('iniciais'))
                                if (ccEf1) set('centroCusto', ccEf1.id)
                              } else if (refTxt.includes('6º') || refTxt.includes('7º') || refTxt.includes('8º') || refTxt.includes('9º')) {
                                const ccEf2 = centrosCustoReceber.find(c => c.sigla === 'EF2' || c.id.toLowerCase().includes('finais'))
                                if (ccEf2) set('centroCusto', ccEf2.id)
                              } else if (refTxt.includes('médio') || refTxt.includes('medio') || refTxt.includes('1ª') || refTxt.includes('2ª') || refTxt.includes('3ª')) {
                                const ccEm = centrosCustoReceber.find(c => c.sigla === 'EM' || c.id.toLowerCase().includes('médio'))
                                if (ccEm) set('centroCusto', ccEm.id)
                              }
                            }
                            setShowAlunoDrop(false)
                          }}
                          style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))' }}
                        >
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{a.nome}</div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                            {a.turma ? `${a.turma} • ` : ''}Resp: {a.responsavelFinanceiro || a.responsavel || '—'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label htmlFor="cr-form-resp" className="form-label">Responsável Financeiro / Pagador</label>
                  <input
                    id="cr-form-resp"
                    className="form-input"
                    value={form.responsavel}
                    onChange={e => set('responsavel', e.target.value)}
                    placeholder="Nome do responsável ou pagador"
                  />
                </div>
              </div>

              {/* Evento + Descrição */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag size={11} />Evento Financeiro
                    {form.eventoId && <span style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700 }}>✓ Vinculado</span>}
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        padding: '9px 14px',
                        background: 'hsl(var(--bg-elevated))',
                        border: '1px solid hsl(var(--border-default))',
                        borderRadius: 10,
                        fontSize: 13,
                        color: form.eventoId ? 'hsl(var(--text-primary))' : 'hsl(var(--text-muted))',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      {form.eventoNome ? (
                        <>
                          <span
                            style={{
                              fontSize: 10,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: 'rgba(16,185,129,0.15)',
                              color: '#10b981',
                              fontWeight: 700,
                            }}
                          >
                            R
                          </span>
                          <span style={{ fontWeight: 600 }}>{form.eventoNome}</span>
                        </>
                      ) : (
                        <span>Nenhum evento selecionado (Opcional)</span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ whiteSpace: 'nowrap', fontSize: 12 }}
                      onClick={() => {
                        setEventoModalSearch('')
                        setShowEventoModal(true)
                      }}
                    >
                      <Search size={12} />Selecionar Evento
                    </button>
                    {form.eventoId && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon"
                        onClick={() => setForm(p => ({ ...p, eventoId: '', eventoNome: '', eventoTipo: '' }))}
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label htmlFor="cr-form-desc" className="form-label">Descrição do Lançamento *</label>
                  <input
                    id="cr-form-desc"
                    required
                    className="form-input"
                    value={form.descricao}
                    onChange={e => set('descricao', e.target.value)}
                    placeholder="Ex: Mensalidade Escolar, Taxa de Material, Uniforme..."
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label htmlFor="cr-form-cc" className="form-label" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Target size={11} />Centro de Custo / Segmento Escolar
                    </label>
                    <Link
                      href="/configuracoes/financeiro/centro-custo"
                      style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textDecoration: 'none' }}
                    >
                      + Gerenciar Centros de Custo
                    </Link>
                  </div>
                  <select
                    id="cr-form-cc"
                    className="form-input"
                    value={form.centroCusto || ''}
                    onChange={e => set('centroCusto', e.target.value)}
                  >
                    <option value="">— Selecionar Centro de Custo (Opcional) —</option>
                    {centrosCustoReceber.map(cc => (
                      <option key={cc.id} value={cc.id}>
                        {cc.sigla} • {cc.label}
                      </option>
                    ))}
                    {form.centroCusto && !centrosCustoReceber.some(cc => cc.id === form.centroCusto) && (
                      <option value={form.centroCusto}>{form.centroCusto}</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Valor + Vencimento + Método */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, alignItems: 'end' }}>
                <div>
                  <label htmlFor="cr-form-valor" className="form-label">
                    {gerarParcelas && modoValorParcela === 'repetir' ? 'Valor de Cada Parcela (R$) *' : 'Valor Total (R$) *'}
                  </label>
                  <input
                    id="cr-form-valor"
                    type="number"
                    required
                    className="form-input"
                    style={{ fontWeight: 800, color: '#10b981' }}
                    value={form.valor || ''}
                    onChange={e => set('valor', +e.target.value)}
                    min={0.01}
                    step="0.01"
                    placeholder="0,00"
                  />
                </div>
                <div>
                  <label htmlFor="cr-form-venc" className="form-label">Vencimento *</label>
                  <input
                    id="cr-form-venc"
                    type="date"
                    required
                    className="form-input"
                    value={form.vencimento}
                    onChange={e => {
                      set('vencimento', e.target.value)
                      setDataInicioParcelas(e.target.value)
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="cr-form-metodo" className="form-label">Método Preferencial</label>
                  <select id="cr-form-metodo" className="form-input" value={form.metodo ?? ''} onChange={e => set('metodo', e.target.value || null)}>
                    <option value="">— Selecionar —</option>
                    {metodosSelect.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Gerador de Parcelas Automático */}
              {modal === 'new' && (
                <div style={{ borderRadius: 12, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden' }}>
                  <div
                    style={{
                      padding: '10px 16px',
                      background: 'hsl(var(--bg-elevated))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={gerarParcelas}
                        onClick={() => setGerarParcelas(g => !g)}
                        style={{
                          width: 40,
                          height: 22,
                          borderRadius: 11,
                          border: 'none',
                          cursor: 'pointer',
                          background: gerarParcelas ? '#3b82f6' : 'hsl(var(--border-default))',
                          position: 'relative',
                          transition: 'background 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <div
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            background: 'white',
                            position: 'absolute',
                            top: 3,
                            left: gerarParcelas ? 21 : 3,
                            transition: 'left 0.2s',
                          }}
                        />
                      </button>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>Gerar Carnê / Múltiplas Parcelas</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                          Divide o valor ou repete mensalidades automaticamente com preview
                        </div>
                      </div>
                    </div>
                    {gerarParcelas && previewParcelas.length > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#3b82f6' }}>
                        {previewParcelas.length}x de {fmtCur(previewParcelas[0].valor)}
                      </span>
                    )}
                  </div>

                  {gerarParcelas && (
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.2fr', gap: 10, alignItems: 'end' }}>
                        <div>
                          <label htmlFor="cr-qtd-parc" className="form-label">Nº de Parcelas</label>
                          <input
                            id="cr-qtd-parc"
                            type="number"
                            className="form-input"
                            min={2}
                            max={60}
                            value={numParcelas}
                            onChange={e => setNumParcelas(Math.max(2, +e.target.value))}
                          />
                        </div>
                        <div>
                          <label htmlFor="cr-modo-val" className="form-label">Cálculo do Valor</label>
                          <select id="cr-modo-val" className="form-input" value={modoValorParcela} onChange={e => setModoValorParcela(e.target.value as any)}>
                            <option value="dividir">Dividir Valor Total</option>
                            <option value="repetir">Repetir Valor em Cada Mês</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="cr-modo-venc" className="form-label">Regra de Vencimento</label>
                          <select id="cr-modo-venc" className="form-input" value={modoParcelas} onChange={e => setModoParcelas(e.target.value as any)}>
                            <option value="mesmo_dia">Mesmo dia de cada mês</option>
                            <option value="corridos">A cada 30 dias corridos</option>
                          </select>
                        </div>
                      </div>

                      {previewParcelas.length > 0 && (
                        <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, overflow: 'hidden', maxHeight: 165, overflowY: 'auto' }}>
                          <table style={{ width: '100%', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                                <th style={{ padding: '7px 12px', textAlign: 'left' }}>Parcela</th>
                                <th style={{ padding: '7px 12px', textAlign: 'left' }}>Vencimento</th>
                                <th style={{ padding: '7px 12px', textAlign: 'right' }}>Valor</th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewParcelas.map(p => (
                                <tr key={p.num}>
                                  <td style={{ padding: '6px 12px', fontWeight: 700 }}>{p.num}/{previewParcelas.length}</td>
                                  <td style={{ padding: '6px 12px' }}>{fmt(p.venc)}</td>
                                  <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                    {fmtCur(p.valor)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr style={{ borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-elevated))' }}>
                                <td colSpan={2} style={{ padding: '7px 12px', fontWeight: 800 }}>Total do Lote</td>
                                <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 900, color: '#10b981' }}>
                                  {fmtCur(previewParcelas.reduce((s, p) => s + p.valor, 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid hsl(var(--border-subtle))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                background: 'hsl(var(--bg-elevated))',
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                {gerarParcelas && previewParcelas.length > 0 && (
                  <span style={{ color: '#3b82f6', fontWeight: 700 }}>
                    📅 {previewParcelas.length} parcelas serão registradas
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving || !form.vencimento || !form.descricao?.trim()}>
                  <Check size={14} />
                  {saving
                    ? 'Salvando...'
                    : gerarParcelas && previewParcelas.length > 0
                      ? `Criar ${previewParcelas.length} Parcelas`
                      : modal === 'new'
                        ? 'Registrar Título'
                        : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ─── Modal Baixa Individual Premium (com cálculo de Multa/Juros e Baixa Parcial) ─── */}
      {modal === 'baixa' && selectedTitulo && (() => {
        const atr = selectedTitulo.status === 'atrasado' ? diasAtraso(selectedTitulo.vencimento) : 0
        const enc = calcularEncargosAtraso(Number(selectedTitulo.valor) || 0, atr)
        const baseLiquida = Math.max(
          0,
          +((baixaForm.aplicarEncargos ? enc.total : Number(selectedTitulo.valor) || 0) - (Number(baixaForm.descontoPontualidade) || 0)).toFixed(2)
        )
        const dif = Math.round((baseLiquida - (Number(baixaForm.valorPago) || 0)) * 100) / 100

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.72)',
              backdropFilter: 'blur(4px)',
              zIndex: 3000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={() => setModal(null)}
          >
            <form
              onSubmit={handleBaixa}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'hsl(var(--bg-surface))',
                borderRadius: 20,
                width: '100%',
                maxWidth: 540,
                border: '1px solid hsl(var(--border-subtle))',
                overflow: 'hidden',
                boxShadow: '0 30px 90px rgba(0,0,0,0.5)',
              }}
            >
              <div
                style={{
                  padding: '18px 24px',
                  background: 'linear-gradient(135deg,rgba(16,185,129,0.12),rgba(6,182,212,0.04))',
                  borderBottom: '1px solid hsl(var(--border-subtle))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: 'linear-gradient(135deg,#10b981,#059669)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircle size={18} color="white" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>Registrar Recebimento (Baixa)</div>
                    <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                      {selectedTitulo.aluno || 'Avulso'} — {selectedTitulo.descricao}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setModal(null)} className="btn btn-ghost btn-icon">
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Resumo Financeiro do Título */}
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'hsl(var(--bg-elevated))',
                    borderRadius: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Valor de Face</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981', fontFamily: 'Outfit,sans-serif' }}>
                      {fmtCur(selectedTitulo.valor)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Vencimento</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{fmt(selectedTitulo.vencimento)}</div>
                    {atr > 0 && <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 800 }}>{atr} dias em atraso</div>}
                  </div>
                </div>

                {/* Encargos Automáticos de Atraso (Multa 2% + Juros 1% a.m.) */}
                {atr > 0 && (
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: baixaForm.aplicarEncargos ? 'rgba(239,68,68,0.08)' : 'hsl(var(--bg-elevated))',
                      border: `1px solid ${baixaForm.aplicarEncargos ? 'rgba(239,68,68,0.28)' : 'hsl(var(--border-subtle))'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div style={{ fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: baixaForm.aplicarEncargos ? '#ef4444' : 'hsl(var(--text-secondary))' }}>
                        Encargos por Atraso (Multa 2%: {fmtCur(enc.multa)} + Juros: {fmtCur(enc.juros)})
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                        Total atualizado: <strong>{fmtCur(enc.total)}</strong>
                      </div>
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={baixaForm.aplicarEncargos}
                        onChange={e => {
                          const apply = e.target.checked
                          const nextVal = Math.max(0, +((apply ? enc.total : Number(selectedTitulo.valor)) - (Number(baixaForm.descontoPontualidade) || 0)).toFixed(2))
                          setBaixaForm(p => ({ ...p, aplicarEncargos: apply, valorPago: nextVal }))
                        }}
                      />
                      Cobrar encargos
                    </label>
                  </div>
                )}

                {/* Seleção de Caixa */}
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(16,185,129,0.06)',
                    border: '1px solid rgba(16,185,129,0.25)',
                    borderRadius: 10,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 18 }}>🏦</div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="cr-baixa-caixa" style={{ fontSize: 10, fontWeight: 700, color: 'hsl(var(--text-muted))', display: 'block', marginBottom: 3 }}>
                      CONTA / CAIXA DE DESTINO *
                    </label>
                    <select
                      id="cr-baixa-caixa"
                      className="form-input"
                      style={{ fontSize: 12, fontWeight: 700, padding: '7px 10px' }}
                      value={baixaForm.caixaId}
                      onChange={e => setBaixaForm(p => ({ ...p, caixaId: e.target.value }))}
                    >
                      {caixasAbertos.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nomeCaixa} ({c.operador})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Método de Pagamento */}
                <div>
                  <label className="form-label">Método de Recebimento</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                    {metodosSelect.slice(0, 9).map(m => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setBaixaForm(p => ({ ...p, metodo: m }))}
                        style={{
                          padding: '7px 6px',
                          borderRadius: 8,
                          border: `1.5px solid ${baixaForm.metodo === m ? '#10b981' : 'hsl(var(--border-subtle))'}`,
                          background: baixaForm.metodo === m ? 'rgba(16,185,129,0.12)' : 'transparent',
                          color: baixaForm.metodo === m ? '#10b981' : 'hsl(var(--text-secondary))',
                          fontWeight: 700,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, alignItems: 'end' }}>
                  <div>
                    <label htmlFor="cr-baixa-dt" className="form-label">Data Pagto.</label>
                    <input
                      id="cr-baixa-dt"
                      type="date"
                      className="form-input"
                      value={baixaForm.dataPagamento}
                      onChange={e => setBaixaForm(p => ({ ...p, dataPagamento: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label htmlFor="cr-baixa-desc" className="form-label">Desconto (R$)</label>
                    <input
                      id="cr-baixa-desc"
                      type="number"
                      className="form-input"
                      min={0}
                      step="0.01"
                      value={baixaForm.descontoPontualidade || ''}
                      placeholder="0,00"
                      onChange={e => {
                        const d = Math.max(0, +e.target.value || 0)
                        const base = baixaForm.aplicarEncargos ? enc.total : Number(selectedTitulo.valor) || 0
                        setBaixaForm(p => ({ ...p, descontoPontualidade: d, valorPago: Math.max(0, +(base - d).toFixed(2)) }))
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="cr-baixa-val" className="form-label">Valor Recebido (R$)</label>
                    <input
                      id="cr-baixa-val"
                      type="number"
                      className="form-input"
                      style={{ fontWeight: 800, color: '#10b981' }}
                      value={baixaForm.valorPago}
                      onChange={e => setBaixaForm(p => ({ ...p, valorPago: +e.target.value }))}
                      min={0.01}
                      step="0.01"
                    />
                  </div>
                </div>

                {dif > 0.01 && baixaForm.valorPago > 0 && (
                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(245,158,11,0.08)',
                      borderRadius: 8,
                      border: '1px solid rgba(245,158,11,0.25)',
                      fontSize: 12,
                      color: '#d97706',
                    }}
                  >
                    ⚡ <strong>Baixa Parcial detectada:</strong> um novo título pendente com o saldo residual de{' '}
                    <strong>{fmtCur(dif)}</strong> será gerado automaticamente.
                  </div>
                )}

                <div>
                  <label htmlFor="cr-baixa-obs" className="form-label">Observação / Comprovante</label>
                  <input
                    id="cr-baixa-obs"
                    className="form-input"
                    value={baixaForm.obs}
                    onChange={e => setBaixaForm(p => ({ ...p, obs: e.target.value }))}
                    placeholder="NSU, ID da transação PIX, observações..."
                  />
                </div>
              </div>

              <div
                style={{
                  padding: '14px 24px',
                  borderTop: '1px solid hsl(var(--border-subtle))',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  background: 'hsl(var(--bg-elevated))',
                }}
              >
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: '#10b981' }}
                  disabled={saving || !baixaForm.caixaId || !baixaForm.dataPagamento || baixaForm.valorPago <= 0}
                >
                  <CheckCircle size={14} />
                  {saving ? 'Confirmando...' : `Confirmar Recebimento (${fmtCur(baixaForm.valorPago)})`}
                </button>
              </div>
            </form>
          </div>
        )
      })()}

      {/* ─── Modal Baixa em Lote ─── */}
      {modal === 'baixa_lote' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.72)',
            backdropFilter: 'blur(4px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setModal(null)}
        >
          <form
            onSubmit={handleBaixaLote}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'hsl(var(--bg-surface))',
              borderRadius: 20,
              width: '100%',
              maxWidth: 480,
              border: '1px solid hsl(var(--border-subtle))',
              overflow: 'hidden',
              boxShadow: '0 30px 90px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>
                Liquidação em Lote ({selectedObjects.filter(t => t.status !== 'pago').length} Títulos)
              </div>
              <button type="button" onClick={() => setModal(null)} className="btn btn-ghost btn-icon">
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 14, borderRadius: 12, background: 'hsl(var(--bg-elevated))', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Total a Liquidar:</span>
                <strong style={{ fontSize: 20, color: '#10b981', fontFamily: 'Outfit,sans-serif' }}>
                  {fmtCur(selectedObjects.filter(t => t.status !== 'pago').reduce((s, t) => s + (Number(t.valor) || 0), 0))}
                </strong>
              </div>
              <div>
                <label htmlFor="lote-caixa" className="form-label">Caixa de Destino</label>
                <select id="lote-caixa" className="form-input" value={baixaForm.caixaId} onChange={e => setBaixaForm(p => ({ ...p, caixaId: e.target.value }))}>
                  {caixasAbertos.map(c => <option key={c.id} value={c.id}>{c.nomeCaixa}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label htmlFor="lote-metodo" className="form-label">Método de Pagamento</label>
                  <select id="lote-metodo" className="form-input" value={baixaForm.metodo} onChange={e => setBaixaForm(p => ({ ...p, metodo: e.target.value }))}>
                    {metodosSelect.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="lote-data" className="form-label">Data do Recebimento</label>
                  <input id="lote-data" type="date" className="form-input" value={baixaForm.dataPagamento} onChange={e => setBaixaForm(p => ({ ...p, dataPagamento: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" style={{ background: '#10b981' }} disabled={saving}>
                <CheckCircle size={14} />{saving ? 'Processando...' : 'Confirmar Liquidação em Lote'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Alerta Bloqueio Edição/Exclusão de Pago */}
      {alertMsg && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setAlertMsg(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'hsl(var(--bg-surface))',
              borderRadius: 20,
              border: '1px solid hsl(var(--border-subtle))',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
              maxWidth: 420,
              textAlign: 'center',
              padding: '28px 24px',
            }}
          >
            <div style={{ fontSize: 42, marginBottom: 12 }}>🚫</div>
            <h2 style={{ fontSize: 18, marginBottom: 10, fontWeight: 800 }}>Ação Bloqueada</h2>
            <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 13.5, lineHeight: 1.5, marginBottom: 22 }}>
              {alertMsg}
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setAlertMsg(null)} style={{ width: '100%', justifyContent: 'center' }}>
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Confirm Delete Individual / Lote */}
      <AnimatePresence>
        {(confirmId || confirmBatchDelete) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.72)',
              zIndex: 4000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={() => {
              setConfirmId(null)
              setConfirmBatchDelete(false)
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'hsl(var(--bg-surface))',
                borderRadius: 16,
                width: '100%',
                maxWidth: 380,
                border: '1px solid hsl(var(--border-subtle))',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '14px 22px',
                  background: 'rgba(239,68,68,0.08)',
                  borderBottom: '1px solid hsl(var(--border-subtle))',
                  fontWeight: 800,
                  color: '#ef4444',
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  fontSize: 14,
                }}
              >
                <AlertTriangle size={16} />
                {confirmBatchDelete ? 'Excluir Títulos Selecionados' : 'Excluir Título'}
              </div>
              <div style={{ padding: '18px 22px', fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
                {confirmBatchDelete
                  ? `Confirma a exclusão permanente de ${selectedObjects.filter(t => t.status !== 'pago').length} título(s) em aberto?`
                  : 'Este título será excluído permanentemente da carteira de recebíveis.'}
              </div>
              <div
                style={{
                  padding: '12px 22px',
                  borderTop: '1px solid hsl(var(--border-subtle))',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setConfirmId(null)
                    setConfirmBatchDelete(false)
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={confirmBatchDelete ? handleBatchDelete : handleDelete}
                >
                  <Trash2 size={13} />Confirmar Exclusão
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
