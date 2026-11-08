'use client'

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { useDebounce } from 'use-debounce'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import {
  Plus, Search, Filter, X, Download, CheckCircle, Pencil, Trash2,
  AlertTriangle, DollarSign, Check, FileText, Tag, Layers, RotateCcw,
  FileSpreadsheet, Printer, MessageCircle, ArrowUpDown, Calendar, Sparkles, Target,
  TrendingUp, Clock, ShieldCheck, Wallet, BarChart3, ChevronDown, ChevronUp,
  Upload, Copy, ArrowUpRight, SlidersHorizontal, CheckCircle2, CalendarClock, MoreHorizontal
} from 'lucide-react'

import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useApp } from '@/lib/context'
import { useData, Titulo, newId, newEventoId, newParcelaId } from '@/lib/dataContext'
import { formatCurrency, formatCurrencyInput, handleCurrencyInputChange, parseCurrencyNumeric } from '@/lib/utils'
import { resolveCentrosCustoEscolares, resolveMetodosPagamentoEscolares, resolveCaixasEscolares } from '../pagar/types'
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
const resolveParcelaDisplay = (t: any): { parc: string; cur: number; tot: number; codigoTecnico?: string; isEntrada?: boolean } => {
  const raw = String(t?.parcela || '').trim()
  const rawCod = String(t?.codigo || '').trim()
  const rawDesc = String(t?.descricao || '').trim()
  if (/^entrada$/i.test(raw) || rawCod.endsWith('-ENT') || /^Entrada\s+Acordo/i.test(rawDesc)) {
    return { parc: 'ENT', cur: 1, tot: 1, codigoTecnico: rawCod || undefined, isEntrada: true }
  }
  // 1. Formato padrão X/Y (ex: 1/1, 2/6)
  const slashMatch = raw.match(/^(\d+)\s*\/\s*(\d+)$/)
  if (slashMatch) {
    const cur = Math.max(1, Number(slashMatch[1]) || 1)
    const tot = Math.max(cur, Number(slashMatch[2]) || 1)
    return { parc: `${cur}/${tot}`, cur, tot, codigoTecnico: t?.parcelaCodigo }
  }
  // 2. Tenta extrair (X/Y) da descrição se existir (ex: "Mensalidade (2/12)")
  const descMatch = rawDesc.match(/\((\d+)\s*\/\s*(\d+)\)/)
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
  const { cfgEventos, cfgMetodosPagamento, cfgCentrosCusto, cfgCaixas, setMovimentacoesManuais, logSystemAction } = useData()
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

  const caixasAbertos = useMemo(() => {
    const resolved = resolveCaixasEscolares(cfgCaixas, true)
    return resolved.map(c => ({
      id: c.value,
      nome: c.label,
      nomeCaixa: c.label,
      fechado: c.situacao !== 'Aberto',
      dataAbertura: today(),
      operador: c.operador || currentUser?.nome || 'Tesouraria',
    }))
  }, [cfgCaixas, currentUser?.nome])

  const mutateTitulo = useApiMutation('/api/titulos', 'POST', [['titulos-receber']])
  const mutateDelete = useApiMutation('/api/titulos', 'DELETE', [['titulos-receber']])

  // ── Filtros, Visão Analítica e Ordenação ──
  const [tabStatus, setTabStatus] = useState<'todos' | 'pendente' | 'hoje' | '7dias' | 'atrasado' | 'pago'>('todos')
  const [quickPeriod, setQuickPeriod] = useState<'todos' | 'hoje' | '7dias' | 'mes_atual' | 'mes_seguinte'>('todos')
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [searchRaw, setSearchRaw] = useState('')
  const [search] = useDebounce(searchRaw, 220)
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
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const tableRegionRef = useRef<HTMLDivElement | null>(null)

  const closeMenuPopover = useCallback((menuId: string) => {
    const el = document.getElementById(menuId) as HTMLElement | null
    if (!el) return
    if ('popover' in HTMLElement.prototype && typeof (el as any).hidePopover === 'function') {
      try {
        if (el.matches(':popover-open')) (el as any).hidePopover()
      } catch {
        // Ignora caso já esteja fechado
      }
    } else {
      el.classList.remove(':popover-open')
      el.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'closed' } }))
    }
  }, [])

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
        const rawDesc = String(t.descricao || '').trim()
        const rawCod = String(t.codigo || '').trim()
        const isRenegociacao =
          Boolean(t.acordoId) ||
          t.origemLanca === 'renegociacao' ||
          rawCod.startsWith('RNG') ||
          /^(Acordo\s+Renegocia[cç][aã]o|Entrada\s+Acordo)\b/i.test(rawDesc)
        const normalizedDesc = isRenegociacao
          ? /Saldo\s+Residual/i.test(rawDesc)
            ? 'Acordo Renegociação (Saldo Residual)'
            : 'Acordo Renegociação'
          : rawDesc

        // Formata código compacto p/ acordos legados com hash longo (ex: RNGMW7QEQ1HZ3F55WLL-P03 -> RNG-55WLL-P03)
        // e corrige sufixo -PXX defasado quando houver informação de parcela (X/Y)
        let codigoDisplay = rawCod
        let acordoShort = String(t.acordoId || '').trim()
        if (acordoShort.startsWith('RNG') && !acordoShort.startsWith('RNG-') && acordoShort.length > 10) {
          acordoShort = `RNG-${acordoShort.slice(-5).toUpperCase()}`
        }
        if (isRenegociacao && rawCod.startsWith('RNG')) {
          const dashIdx = rawCod.lastIndexOf('-')
          const basePart = dashIdx > 0 ? rawCod.slice(0, dashIdx) : rawCod
          const suffixPart = dashIdx > 0 ? rawCod.slice(dashIdx + 1) : ''
          const cleanBase = basePart.startsWith('RNG-')
            ? basePart
            : basePart.length > 10
              ? `RNG-${basePart.slice(-5).toUpperCase()}`
              : basePart
          if (!acordoShort) {
            acordoShort = cleanBase
          }
          if (parcInfo.isEntrada || suffixPart === 'ENT') {
            codigoDisplay = `${cleanBase}-ENT`
          } else if (/^P\d+$/i.test(suffixPart) && parcInfo.cur >= 1) {
            codigoDisplay = `${cleanBase}-P${String(parcInfo.cur).padStart(2, '0')}`
          } else if (suffixPart) {
            codigoDisplay = `${cleanBase}-${suffixPart}`
          } else {
            codigoDisplay = cleanBase
          }
        }

        return {
          ...t,
          descricao: normalizedDesc,
          vencimento: venc,
          status: effectiveStatus,
          valor: Number(t.valor) || 0,
          _isRenegociacao: isRenegociacao,
          _codigoDisplay: codigoDisplay || undefined,
          _acordoShort: acordoShort || undefined,
          _parcDisplay: parcInfo.parc,
          _parcCur: parcInfo.cur,
          _parcTot: parcInfo.tot,
          _parcCodigo: parcInfo.codigoTecnico,
          _parcIsEntrada: Boolean(parcInfo.isEntrada),
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

  const metodosAtivosObj = useMemo(
    () => resolveMetodosPagamentoEscolares(cfgMetodosPagamento, false),
    [cfgMetodosPagamento]
  )
  const metodosSelect = useMemo(
    () => (metodosAtivosObj.length > 0 ? metodosAtivosObj.map(m => m.nome) : METODOS_FALLBACK),
    [metodosAtivosObj]
  )
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
    metodo: '',
    dataPagamento: today(),
    valorPago: 0,
    aplicarEncargos: true,
    descontoPontualidade: 0,
    obs: '',
    caixaId: '',
    emitirRecibo: false,
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
    const hojeStr = today()
    const d7Str = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const list = titulosReceber.filter(t => {
      if (q) {
        const hay = `${t.aluno || ''} ${t.responsavel || ''} ${t.descricao || ''} ${t.codigo || ''} ${t._codigoDisplay || ''} ${t.acordoId || ''} ${t._acordoShort || ''} ${t.eventoDescricao || ''} ${t.centroCusto || ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (tabStatus === 'hoje') {
        if (t.status === 'pago' || t.vencimento !== hojeStr) return false
      } else if (tabStatus === '7dias') {
        if (t.status === 'pago' || t.vencimento < hojeStr || t.vencimento > d7Str) return false
      } else if (tabStatus !== 'todos' && t.status !== tabStatus) {
        return false
      }
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

  // ── Progressive enhancement: Popover + Invoker Commands + focusgroup="menu" + Anchor Fallback ──
  useEffect(() => {
    const root = tableRegionRef.current
    if (!root) return

    const hasPopover = 'popover' in HTMLElement.prototype
    const hasCommandFor = 'commandForElement' in HTMLButtonElement.prototype
    const hasFocusGroup = 'focusGroup' in HTMLElement.prototype
    const hasAnchorPos = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('position-area: block-end')

    const cleanups: (() => void)[] = []
    const popovers = Array.from(root.querySelectorAll<HTMLElement>('.cr-action-popover[popover]'))

    const isOpen = (el: HTMLElement) =>
      hasPopover ? el.matches(':popover-open') : el.classList.contains(':popover-open')

    const showPop = (el: HTMLElement) => {
      if (hasPopover && typeof (el as any).showPopover === 'function') {
        try {
          if (!el.matches(':popover-open')) (el as any).showPopover()
        } catch {
          // ignore
        }
      } else {
        popovers.forEach(p => {
          if (p !== el && p.classList.contains(':popover-open')) {
            p.classList.remove(':popover-open')
            p.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'closed' } }))
          }
        })
        el.classList.add(':popover-open')
        el.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'open' } }))
      }
    }

    const hidePop = (el: HTMLElement) => {
      if (hasPopover && typeof (el as any).hidePopover === 'function') {
        try {
          if (el.matches(':popover-open')) (el as any).hidePopover()
        } catch {
          // ignore
        }
      } else if (el.classList.contains(':popover-open')) {
        el.classList.remove(':popover-open')
        el.dispatchEvent(new CustomEvent('toggle', { detail: { newState: 'closed' } }))
      }
    }

    const positionMenu = (menu: HTMLElement, invoker: HTMLElement) => {
      const bRect = invoker.getBoundingClientRect()
      const mRect = menu.getBoundingClientRect()
      const gap = 4
      const margin = 8
      let left = bRect.right - mRect.width
      let top = bRect.bottom + gap
      if (top + mRect.height > window.innerHeight - margin) {
        top = bRect.top - mRect.height - gap
      }
      left = Math.max(margin, Math.min(left, window.innerWidth - mRect.width - margin))
      top = Math.max(margin, Math.min(top, window.innerHeight - mRect.height - margin))
      menu.style.left = '0px'
      menu.style.top = '0px'
      const zeroRect = menu.getBoundingClientRect()
      menu.style.left = `${left - zeroRect.left}px`
      menu.style.top = `${top - zeroRect.top}px`
    }

    popovers.forEach(pop => {
      const prev = pop.previousElementSibling
      const trigger =
        prev instanceof HTMLButtonElement
          ? prev
          : root.querySelector<HTMLButtonElement>(`button[commandfor="${pop.id}"]`)
      if (!trigger) return

      const fg = pop.querySelector<HTMLElement>('[focusgroup]')
      const getItems = () =>
        fg ? Array.from(fg.querySelectorAll<HTMLButtonElement>(':scope > button:not(:disabled)')) : []

      const onToggle = (ev: Event) => {
        const state = (ev as ToggleEvent).newState ?? (ev as CustomEvent)?.detail?.newState ?? (isOpen(pop) ? 'open' : 'closed')
        const opened = state === 'open'
        trigger.setAttribute('aria-expanded', opened ? 'true' : 'false')
        if (opened) {
          // Quando CSS Anchor Positioning não está ativo (ou quando aberto via fallback JS sem implicit anchor), posiciona ancorado ao botão
          if (!hasAnchorPos || !hasCommandFor) {
            positionMenu(pop, trigger)
          }
          if (!hasFocusGroup) {
            const items = getItems()
            items.forEach((it, idx) => {
              it.tabIndex = idx === 0 ? 0 : -1
            })
            items[0]?.focus()
          }
        }
      }
      pop.addEventListener('toggle', onToggle)
      cleanups.push(() => pop.removeEventListener('toggle', onToggle))

      if (!hasCommandFor) {
        const onTriggerClick = (e: MouseEvent) => {
          e.stopPropagation()
          if (isOpen(pop)) hidePop(pop)
          else showPop(pop)
        }
        trigger.addEventListener('click', onTriggerClick)
        cleanups.push(() => trigger.removeEventListener('click', onTriggerClick))
      }

      if (!hasFocusGroup && fg) {
        fg.setAttribute('role', 'menu')
        getItems().forEach((item, idx) => {
          item.setAttribute('role', 'menuitem')
          item.tabIndex = idx === 0 ? 0 : -1
        })

        const onTriggerKeyDown = (e: KeyboardEvent) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!isOpen(pop)) showPop(pop)
            const items = getItems()
            const target = e.key === 'ArrowUp' ? items[items.length - 1] : items[0]
            items.forEach(it => {
              it.tabIndex = it === target ? 0 : -1
            })
            target?.focus()
          }
        }
        trigger.addEventListener('keydown', onTriggerKeyDown)
        cleanups.push(() => trigger.removeEventListener('keydown', onTriggerKeyDown))

        const onMenuKeyDown = (e: KeyboardEvent) => {
          const items = getItems()
          if (!items.length) return
          const curIdx = items.indexOf(document.activeElement as HTMLButtonElement)
          let nextIdx = -1
          if (e.key === 'ArrowDown') nextIdx = (curIdx + 1) % items.length
          else if (e.key === 'ArrowUp') nextIdx = (curIdx - 1 + items.length) % items.length
          else if (e.key === 'Home') nextIdx = 0
          else if (e.key === 'End') nextIdx = items.length - 1
          else if (e.key === 'Escape') {
            e.preventDefault()
            hidePop(pop)
            trigger.focus()
            return
          }
          if (nextIdx >= 0) {
            e.preventDefault()
            items.forEach((it, idx) => {
              it.tabIndex = idx === nextIdx ? 0 : -1
            })
            items[nextIdx]?.focus()
          }
        }
        fg.addEventListener('keydown', onMenuKeyDown)
        cleanups.push(() => fg.removeEventListener('keydown', onMenuKeyDown))
      }
    })

    if (!hasPopover) {
      const onDocPointerDown = (e: PointerEvent) => {
        const target = e.target as Node
        popovers.forEach(pop => {
          if (!isOpen(pop)) return
          const trig = pop.previousElementSibling
          if (!pop.contains(target) && (!trig || !trig.contains(target))) {
            hidePop(pop)
          }
        })
      }
      document.addEventListener('pointerdown', onDocPointerDown)
      cleanups.push(() => document.removeEventListener('pointerdown', onDocPointerDown))
    }

    return () => {
      cleanups.forEach(fn => fn())
    }
  }, [titulosLista])

  // ── KPIs Executivos & Inteligência de Tesouraria (Sempre consistentes com titulosReceber) ──
  const kpis = useMemo(() => {
    const hojeStr = today()
    const d7Str = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    let totalPago = 0
    let qtdPago = 0
    let totalAtrasado = 0
    let totalAtrasadoComEncargos = 0
    let qtdAtrasado = 0
    let totalPendente = 0
    let qtdPendente = 0
    let venceHojeVal = 0
    let venceHojeQtd = 0
    let vence7DiasVal = 0
    let vence7DiasQtd = 0

    const metodoMap = new Map<string, { valor: number; qtd: number }>()
    let valMensalidades = 0
    let valAcordos = 0
    let valAvulsos = 0

    for (const t of titulosReceber) {
      const v = Number(t.valor) || 0
      const isAcordo = Boolean(t.acordoId) || String(t.descricao || '').includes('Acordo Renegociação')
      const isAvulso = t.origemLanca === 'manual_receber' && !isAcordo
      if (isAcordo) valAcordos += v
      else if (isAvulso) valAvulsos += v
      else valMensalidades += v

      if (t.metodo) {
        const cur = metodoMap.get(t.metodo) || { valor: 0, qtd: 0 }
        metodoMap.set(t.metodo, { valor: cur.valor + v, qtd: cur.qtd + 1 })
      }

      if (t.status === 'pago') {
        totalPago += v
        qtdPago++
      } else if (t.status === 'atrasado') {
        totalAtrasado += v
        qtdAtrasado++
        const d = diasAtraso(t.vencimento)
        const enc = calcularEncargosAtraso(v, d)
        totalAtrasadoComEncargos += enc.total
      } else {
        totalPendente += v
        qtdPendente++
        if (t.vencimento === hojeStr) {
          venceHojeVal += v
          venceHojeQtd++
        }
        if (t.vencimento >= hojeStr && t.vencimento <= d7Str) {
          vence7DiasVal += v
          vence7DiasQtd++
        }
      }
    }

    const totalCarteira = totalPago + totalAtrasado + totalPendente
    const taxaRecebimento = totalCarteira > 0 ? (totalPago / totalCarteira) * 100 : 0
    const taxaInadimplencia = totalCarteira > 0 ? (totalAtrasado / totalCarteira) * 100 : 0
    const pctNoPrazo = totalCarteira > 0 ? (totalPendente / totalCarteira) * 100 : 0
    const ticketMedioPago = qtdPago > 0 ? totalPago / qtdPago : 0
    const ticketMedioCarteira = titulosReceber.length > 0 ? totalCarteira / titulosReceber.length : 0
    const totalEncargosPotenciais = Math.max(0, +(totalAtrasadoComEncargos - totalAtrasado).toFixed(2))

    const topMetodos = Array.from(metodoMap.entries())
      .map(([nome, info]) => ({ nome, ...info }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 4)

    return {
      totalPago, qtdPago, ticketMedioPago,
      totalAtrasado, qtdAtrasado, totalAtrasadoComEncargos, totalEncargosPotenciais,
      totalPendente, qtdPendente, pctNoPrazo,
      venceHojeVal, venceHojeQtd,
      vence7DiasVal, vence7DiasQtd,
      totalCarteira, ticketMedioCarteira,
      taxaRecebimento,
      taxaInadimplencia,
      origens: {
        mensalidades: valMensalidades,
        acordos: valAcordos,
        avulsos: valAvulsos,
      },
      topMetodos,
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
    const atr = t.status === 'atrasado' ? diasAtraso(t.vencimento) : 0
    const enc = calcularEncargosAtraso(Number(t.valor) || 0, atr)
    setBaixaForm({
      metodo: '',
      dataPagamento: today(),
      valorPago: atr > 0 ? enc.total : Number(t.valor) || 0,
      aplicarEncargos: atr > 0,
      descontoPontualidade: 0,
      obs: '',
      caixaId: '',
      emitirRecibo: false,
    })
    setModal('baixa')
  }

  const openBaixaLote = () => {
    const abertos = selectedObjects.filter(t => t.status !== 'pago')
    if (abertos.length === 0) {
      toast.error('Selecione pelo menos um título em aberto para liquidar em lote.')
      return
    }
    setBaixaForm({
      metodo: '',
      dataPagamento: today(),
      valorPago: abertos.reduce((s, t) => s + (Number(t.valor) || 0), 0),
      aplicarEncargos: false,
      descontoPontualidade: 0,
      obs: 'Liquidação em lote via Contas a Receber',
      caixaId: '',
      emitirRecibo: false,
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

      const cxSelecionado = (Array.isArray(cfgCaixas) ? cfgCaixas : []).find(
        (c: any) =>
          c.id === baixaForm.caixaId ||
          `${c.codigo} - ${c.descricao}` === baixaForm.caixaId ||
          c.codigo === baixaForm.caixaId
      )
      const caixaLabel = cxSelecionado
        ? `${cxSelecionado.codigo} - ${cxSelecionado.descricao}`
        : baixaForm.caixaId || undefined

      const changes = {
        ...titulo,
        status: 'pago' as const,
        pagamento: baixaForm.dataPagamento,
        metodo: baixaForm.metodo,
        caixaId: baixaForm.caixaId || undefined,
        caixaOrigem: caixaLabel,
        unidadeEmpresa: cxSelecionado?.unidadeEmpresa || (titulo as any).unidadeEmpresa || undefined,
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
      if (baixaForm.emitirRecibo !== false) {
        setReceiptTarget([changes])
      }
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
      const cxSelecionado = (Array.isArray(cfgCaixas) ? cfgCaixas : []).find(
        (c: any) =>
          c.id === baixaForm.caixaId ||
          `${c.codigo} - ${c.descricao}` === baixaForm.caixaId ||
          c.codigo === baixaForm.caixaId
      )
      const caixaLabel = cxSelecionado
        ? `${cxSelecionado.codigo} - ${cxSelecionado.descricao}`
        : baixaForm.caixaId || undefined

      const payload = abertos.map(t => ({
        ...t,
        status: 'pago' as const,
        pagamento: baixaForm.dataPagamento,
        metodo: baixaForm.metodo,
        caixaId: baixaForm.caixaId || undefined,
        caixaOrigem: caixaLabel,
        unidadeEmpresa: cxSelecionado?.unidadeEmpresa || (t as any).unidadeEmpresa || undefined,
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
      if (baixaForm.emitirRecibo !== false) {
        setReceiptTarget(payload)
      }
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
        caixaId: null,
        obs: null,
        parcela: t._parcDisplay || '1/1',
      })
      setMovimentacoesManuais((prev: any) => (Array.isArray(prev) ? prev : []).filter((m: any) => m.referenciaId !== t.id))
      fetch('/api/financeiro/movimentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'estornar_movimentacao',
          id: `REC-${t.id}`,
          sourceId: String(t.id),
          categoriaOrigem: 'rec_aluno',
          motivo: 'Estorno realizado em Contas a Receber',
        }),
      }).catch(() => {})
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
    setQuickPeriod('todos')
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

  const applyQuickPeriod = (period: 'todos' | 'hoje' | '7dias' | 'mes_atual' | 'mes_seguinte') => {
    const hojeStr = today()
    setQuickPeriod(period)
    if (period === 'todos') {
      setDataVencDe('')
      setDataVencAte('')
      setFiltroMes('todos')
      setFiltroAno('todos')
      if (tabStatus === 'hoje' || tabStatus === '7dias') setTabStatus('todos')
      return
    }
    if (period === 'hoje') {
      setDataVencDe(hojeStr)
      setDataVencAte(hojeStr)
      setFiltroMes('todos')
      setFiltroAno('todos')
      return
    }
    if (period === '7dias') {
      const d7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
      setDataVencDe(hojeStr)
      setDataVencAte(d7)
      setFiltroMes('todos')
      setFiltroAno('todos')
      return
    }
    if (period === 'mes_atual') {
      const now = new Date()
      setDataVencDe('')
      setDataVencAte('')
      setFiltroMes(String(now.getMonth() + 1).padStart(2, '0'))
      setFiltroAno(String(now.getFullYear()))
      return
    }
    if (period === 'mes_seguinte') {
      const now = new Date()
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      setDataVencDe('')
      setDataVencAte('')
      setFiltroMes(String(next.getMonth() + 1).padStart(2, '0'))
      setFiltroAno(String(next.getFullYear()))
    }
  }

  const handleDuplicateNextMonth = async (t: any) => {
    try {
      const baseDate = new Date(`${t.vencimento || today()}T12:00:00`)
      baseDate.setMonth(baseDate.getMonth() + 1)
      const nextVenc = baseDate.toISOString().slice(0, 10)
      const todosEventoIds = rawTitulos.map(x => (x as any).eventoId || '').filter(Boolean)
      const eventoIdUnico = t.eventoId || newEventoId(todosEventoIds)
      const payload = {
        codigo: genCod(rawTitulos as any),
        aluno: t.aluno || '',
        responsavel: t.responsavel || '',
        descricao: t.descricao || 'Receita Escolar',
        valor: Number(t.valor) || 0,
        vencimento: nextVenc,
        pagamento: null,
        status: 'pendente' as const,
        metodo: t.metodo || null,
        parcela: '1/1',
        parcelaCodigo: newParcelaId(eventoIdUnico, 1),
        eventoId: eventoIdUnico,
        eventoDescricao: t.eventoDescricao || undefined,
        centroCusto: t.centroCusto || '',
        origemLanca: 'manual_receber',
        dataLancamento: new Date().toISOString(),
        usuarioLancamento: currentUser?.nome || 'Sistema',
        obs: t.obs || '',
      }
      await mutateTitulo.mutateAsync(payload)
      toast.success(`Título duplicado para ${fmt(nextVenc)} (${payload.codigo})!`)
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao duplicar título para o próximo mês.')
    }
  }

  const handleImportSpreadsheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const firstSheet = wb.Sheets[wb.SheetNames[0]]
      const rows: any[] = XLSX.utils.sheet_to_json(firstSheet)
      if (!rows.length) {
        toast.error('A planilha selecionada está vazia.')
        return
      }
      const todosEventoIds = rawTitulos.map(x => (x as any).eventoId || '').filter(Boolean)
      const loteEventoId = newEventoId(todosEventoIds)
      const novos = rows
        .map((r, i) => {
          const valorRaw = r['Valor (R$)'] ?? r['Valor'] ?? r['valor'] ?? 0
          const valorNum = typeof valorRaw === 'number'
            ? valorRaw
            : Number(String(valorRaw).replace(/[R$\s.]/g, '').replace(',', '.')) || 0
          let vencRaw = String(r['Vencimento'] ?? r['vencimento'] ?? today()).trim()
          if (/^\d{2}\/\d{2}\/\d{4}$/.test(vencRaw)) {
            const [dd, mm, yyyy] = vencRaw.split('/')
            vencRaw = `${yyyy}-${mm}-${dd}`
          }
          return {
            codigo: String(r['Código'] || r['codigo'] || `TIT-${Math.floor(10000 + Math.random() * 89999)}`),
            aluno: String(r['Aluno'] || r['aluno'] || '').trim(),
            responsavel: String(r['Responsável Financeiro'] || r['Responsável'] || r['responsavel'] || '').trim(),
            descricao: String(r['Descrição'] || r['descricao'] || 'Recebível Importado').trim(),
            centroCusto: String(r['Centro de Custo'] || r['centroCusto'] || '').trim(),
            parcela: String(r['Parcela'] || r['parcela'] || '1/1'),
            parcelaCodigo: newParcelaId(loteEventoId, i + 1),
            eventoId: loteEventoId,
            vencimento: vencRaw.slice(0, 10) || today(),
            pagamento: null,
            valor: valorNum,
            status: 'pendente' as const,
            metodo: r['Método Pagamento'] || r['Método'] || r['metodo'] || null,
            origemLanca: 'manual_receber',
            dataLancamento: new Date().toISOString(),
            usuarioLancamento: currentUser?.nome || 'Sistema',
            obs: String(r['Observações'] || r['obs'] || 'Importado via planilha'),
          }
        })
        .filter(item => item.valor > 0)

      if (novos.length === 0) {
        toast.error('Nenhum registro com valor válido encontrado na planilha.')
        return
      }
      await mutateTitulo.mutateAsync(novos)
      toast.success(`${novos.length} título(s) importado(s) com sucesso!`)
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao importar planilha. Verifique o formato das colunas.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePrintRelatorio = () => {
    const source = selectedObjects.length > 0 ? selectedObjects : filtered
    if (source.length === 0) {
      toast.error('Não há títulos na listagem atual para imprimir o relatório.')
      return
    }
    const win = window.open('', '_blank', 'width=1020,height=760')
    if (!win) {
      toast.error('Permita pop-ups para visualizar o relatório de impressão.')
      return
    }
    const sumTotal = source.reduce((s, t) => s + (Number(t.valor) || 0), 0)
    const sumPago = source.filter(t => t.status === 'pago').reduce((s, t) => s + (Number(t.valor) || 0), 0)
    const sumAtraso = source.filter(t => t.status === 'atrasado').reduce((s, t) => s + (Number(t.valor) || 0), 0)
    const sumAberto = source.filter(t => t.status === 'pendente').reduce((s, t) => s + (Number(t.valor) || 0), 0)
    const rowsHtml = source
      .map(t => {
        const atr = t.status === 'atrasado' ? diasAtraso(t.vencimento) : 0
        const stLabel = STATUS_CFG[t.status as keyof typeof STATUS_CFG]?.label || t.status
        return `<tr>
          <td style="font-family:monospace;font-weight:700">${t.codigo || String(t.id).slice(0, 8)}</td>
          <td><strong>${t.aluno || t.responsavel || 'Avulso'}</strong>${t.responsavel && t.aluno ? `<br/><span style="color:#64748b;font-size:10px">Resp: ${t.responsavel}</span>` : ''}</td>
          <td>${t.descricao || '—'}${t.centroCusto ? `<br/><span style="color:#475569;font-size:10px">${t.centroCusto}</span>` : ''}</td>
          <td style="text-align:center">${t._parcDisplay || '1/1'}</td>
          <td style="text-align:center">${fmt(t.vencimento)}${atr > 0 ? `<br/><span style="color:#dc2626;font-size:9.5px;font-weight:700">${atr}d atraso</span>` : ''}</td>
          <td style="text-align:center">${stLabel}</td>
          <td style="text-align:center">${t.metodo || '—'}</td>
          <td style="text-align:right;font-weight:800">${fmtCur(t.valor)}</td>
        </tr>`
      })
      .join('')

    win.document.write(`<!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8"/>
        <title>Borderô & Relatório Executivo — Contas a Receber</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; margin: 28px; font-size: 12px; }
          .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px; }
          .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
          .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; background: #f8fafc; }
          .kpi-lbl { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; }
          .kpi-val { font-size: 16px; font-weight: 800; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f1f5f9; color: #334155; text-transform: uppercase; font-size: 9.5px; padding: 8px; border-bottom: 1.5px solid #94a3b8; text-align: left; }
          td { padding: 7px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
          @media print { body { margin: 10mm; } }
        </style>
      </head>
      <body>
        <div class="hdr">
          <div>
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#475569;letter-spacing:0.06em">Tesouraria & Controladoria Escolar</div>
            <h1 style="margin:4px 0;font-size:20px">Relatório de Contas a Receber & Faturamento</h1>
            <div style="color:#64748b;font-size:11px">Emitido em ${new Date().toLocaleString('pt-BR')} • ${source.length} registro(s)</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:#475569">Eficiência da Carteira</div>
            <div style="font-size:18px;font-weight:900;color:#059669">${kpis.taxaRecebimento.toFixed(1)}%</div>
          </div>
        </div>
        <div class="kpis">
          <div class="kpi"><div class="kpi-lbl">Total Listado (${source.length})</div><div class="kpi-val" style="color:#0f172a">${fmtCur(sumTotal)}</div></div>
          <div class="kpi"><div class="kpi-lbl">Recebido em Caixa</div><div class="kpi-val" style="color:#059669">${fmtCur(sumPago)}</div></div>
          <div class="kpi"><div class="kpi-lbl">A Vencer (No Prazo)</div><div class="kpi-val" style="color:#0284c7">${fmtCur(sumAberto)}</div></div>
          <div class="kpi"><div class="kpi-lbl">Vencido / Em Atraso</div><div class="kpi-val" style="color:#dc2626">${fmtCur(sumAtraso)}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Aluno / Pagador</th>
              <th>Descrição & Centro de Custo</th>
              <th style="text-align:center">Parc.</th>
              <th style="text-align:center">Vencimento</th>
              <th style="text-align:center">Situação</th>
              <th style="text-align:center">Método</th>
              <th style="text-align:right">Valor</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>`)
    win.document.close()
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
    <div className="cr-cockpit-root" style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', paddingBlockEnd: '2.5rem' }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .cr-cockpit-root {
            line-height: 1.45;
          }
          .cr-surface-card {
            background: hsl(var(--bg-surface));
            border: 1px solid hsl(var(--border-subtle));
            border-radius: 14px;
            box-shadow: 0 2px 10px -4px rgba(15, 23, 42, 0.05);
          }
          .cr-kpi-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(235px, 1fr));
            gap: 0.75rem;
            inline-size: 100%;
          }
          .cr-kpi-article {
            container-type: inline-size;
            position: relative;
            background: hsl(var(--bg-surface));
            border: 1.5px solid hsl(var(--border-subtle));
            border-radius: 14px;
            padding: 0.875rem 1rem;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            gap: 0.5rem;
            cursor: pointer;
            transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
            overflow: clip;
            box-shadow: 0 2px 8px -3px rgba(15, 23, 42, 0.04);
          }
          .cr-kpi-article:hover {
            border-color: hsl(var(--border-default));
            box-shadow: 0 6px 18px -6px rgba(15, 23, 42, 0.08);
          }
          .cr-pill-group {
            display: flex;
            flex-wrap: wrap;
            flex-wrap: balance;
            align-items: safe center;
            gap: 0.375rem;
          }
          .cr-toolbar-row {
            display: flex;
            flex-wrap: wrap;
            align-items: safe center;
            justify-content: space-between;
            gap: 0.625rem;
          }
          .cr-table-region {
            inline-size: 100%;
            max-inline-size: 100%;
            container-type: inline-size;
            overflow: auto;
            scrollbar-gutter: stable;
            overscroll-behavior: contain;
            border-radius: 14px;
            background: hsl(var(--bg-surface));
            border: 1px solid hsl(var(--border-subtle));
            box-shadow: 0 4px 16px -6px rgba(15, 23, 42, 0.05);
            content-visibility: auto;
            contain-intrinsic-size: auto 900px auto 560px;
          }
          @supports not (content-visibility: auto) {
            .cr-table-region {
              contain: layout style paint;
            }
          }
          .cr-data-table {
            inline-size: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 0.8125rem;
          }
          .cr-data-table thead {
            position: sticky;
            inset-block-start: 0;
            z-index: 2;
          }
          .cr-data-table thead th {
            background: hsl(var(--bg-elevated));
            color: hsl(var(--text-secondary));
            font-size: 0.6875rem;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 0.65rem 0.75rem;
            text-align: start;
            border-block-end: 1px solid hsl(var(--border-subtle));
            white-space: nowrap;
            text-wrap: balance;
          }
          .cr-data-table tbody th {
            position: sticky;
            inset-inline-start: 0;
            z-index: 1;
            background: inherit;
            text-align: start;
            padding: 0.65rem 0.75rem;
            font-weight: 700;
            border-block-end: 1px solid hsl(var(--border-subtle));
            vertical-align: middle;
          }
          .cr-data-table tbody td {
            padding: 0.65rem 0.75rem;
            border-block-end: 1px solid hsl(var(--border-subtle));
            vertical-align: middle;
            background: inherit;
          }
          .cr-data-table tbody tr {
            background: hsl(var(--bg-surface));
            transition: background-color 0.12s ease;
          }
          .cr-data-table tbody tr:hover {
            background: hsl(var(--bg-elevated));
          }
          .cr-data-table tbody tr.cr-row-pago {
            background: rgba(16, 185, 129, 0.035);
          }
          .cr-data-table tbody tr.cr-row-pago:hover {
            background: rgba(16, 185, 129, 0.075);
          }
          .cr-data-table tbody tr.cr-row-atrasado {
            background: rgba(239, 68, 68, 0.035);
          }
          .cr-data-table tbody tr.cr-row-atrasado:hover {
            background: rgba(239, 68, 68, 0.075);
          }
          .cr-data-table tbody tr.cr-row-hoje {
            background: rgba(245, 158, 11, 0.045);
          }
          .cr-data-table tbody tr.cr-row-hoje:hover {
            background: rgba(245, 158, 11, 0.085);
          }
          .cr-action-trigger {
            inline-size: 28px;
            block-size: 28px;
            padding: 0;
            border-radius: 7px;
            border: 1px solid hsl(var(--border-subtle));
            background: hsl(var(--bg-surface));
            color: hsl(var(--text-secondary));
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background-color 0.14s ease, border-color 0.14s ease, color 0.14s ease;
          }
          .cr-action-trigger:hover,
          .cr-action-trigger[aria-expanded="true"] {
            background: hsl(var(--bg-elevated));
            border-color: hsl(var(--border-default));
            color: hsl(var(--text-primary));
          }
          .cr-action-popover[popover] {
            margin: 0;
            inset: auto;
            padding: 0.35rem;
            border: 1px solid hsl(var(--border-subtle));
            border-radius: 10px;
            background: hsl(var(--bg-surface));
            color: hsl(var(--text-primary));
            box-shadow: 0 12px 28px -6px rgba(15, 23, 42, 0.18), 0 4px 10px -3px rgba(15, 23, 42, 0.08);
            z-index: 60;
            text-align: start;
          }
          .cr-action-popover[popover]:not(:popover-open):not(.\\:popover-open) {
            display: none;
          }
          .cr-action-popover [focusgroup~="menu"] {
            --menu-icon-size: 1.125rem;
            display: flex;
            flex-direction: column;
            min-inline-size: 13.5rem;
            gap: 1px;
          }
          .cr-action-popover [focusgroup~="menu"] > button {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            inline-size: 100%;
            padding: 0.425rem 0.625rem;
            border: 0;
            border-radius: 7px;
            background: transparent;
            color: hsl(var(--text-primary));
            font: inherit;
            font-size: 0.75rem;
            font-weight: 600;
            text-align: start;
            white-space: nowrap;
            cursor: pointer;
            transition: background-color 0.12s ease, color 0.12s ease;
          }
          .cr-action-popover [focusgroup~="menu"] > button:hover,
          .cr-action-popover [focusgroup~="menu"] > button:focus-visible {
            background: hsl(var(--bg-elevated));
            outline: none;
          }
          .cr-action-popover [focusgroup~="menu"] > button.cr-menu-item-danger {
            color: #dc2626;
          }
          .cr-action-popover [focusgroup~="menu"] > button.cr-menu-item-danger:hover,
          .cr-action-popover [focusgroup~="menu"] > button.cr-menu-item-danger:focus-visible {
            background: rgba(239, 68, 68, 0.09);
            color: #b91c1c;
          }
          .cr-action-popover .cr-menu-icon {
            flex: 0 0 var(--menu-icon-size);
            inline-size: var(--menu-icon-size);
            block-size: var(--menu-icon-size);
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }
          .cr-action-popover .cr-menu-label {
            flex: 1 1 auto;
          }
          .cr-action-popover [focusgroup~="menu"] > hr {
            border: 0;
            border-block-start: 1px solid hsl(var(--border-subtle));
            margin: 0.25rem 0;
          }
          @supports (position-area: block-end) {
            .cr-action-popover[popover] {
              position: fixed;
              position-area: block-end span-inline-start;
              position-try-fallbacks: flip-block, flip-inline;
              margin-block-start: 0.25rem;
            }
          }
          @supports not (position-area: block-end) {
            .cr-action-popover[popover] {
              position: fixed;
              inset: auto;
              margin: 0;
            }
          }
          @media (prefers-reduced-motion: no-preference) {
            .cr-action-popover[popover] {
              transition:
                opacity 120ms ease-out,
                transform 120ms ease-out,
                overlay 120ms allow-discrete,
                display 120ms allow-discrete;
            }
            .cr-action-popover[popover]:is(:popover-open, .\\:popover-open) {
              opacity: 1;
              transform: translateY(0);
            }
            @starting-style {
              .cr-action-popover[popover]:is(:popover-open, .\\:popover-open) {
                opacity: 0;
                transform: translateY(-0.25rem);
              }
            }
          }
          @container (width < 720px) {
            .cr-data-table,
            .cr-data-table thead,
            .cr-data-table tbody,
            .cr-data-table tr,
            .cr-data-table th,
            .cr-data-table td {
              display: block;
            }
            .cr-data-table thead {
              display: none;
            }
            .cr-data-table tbody tr {
              margin-block-end: 0.75rem;
              padding: 0.75rem;
              border: 1px solid hsl(var(--border-subtle));
              border-radius: 10px;
            }
            .cr-data-table tbody th {
              position: sticky;
              inset-block-start: 0;
              z-index: 2;
              padding: 0.25rem 0 0.5rem;
              border: none;
            }
            .cr-data-table tbody td {
              display: grid;
              grid-template-columns: 7.5rem 1fr;
              padding: 0.25rem 0;
              border: none;
              text-align: start !important;
            }
            .cr-data-table tbody td::before {
              content: var(--label) ": ";
              font-weight: 700;
              color: hsl(var(--text-muted));
            }
          }
        `,
        }}
      />

      {/* ─── 1. HEADER EXECUTIVO COMPACTO & ORIENTADO A AÇÃO ─── */}
      <header
        className="cr-surface-card"
        style={{
          padding: '0.875rem 1.25rem',
          display: 'flex',
          alignItems: 'safe center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.875rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'safe center', gap: '0.875rem', minInlineSize: 0 }}>
          <div
            style={{
              inlineSize: '2.625rem',
              blockSize: '2.625rem',
              borderRadius: 11,
              background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.22)',
              flexShrink: 0,
            }}
          >
            <TrendingUp size={20} />
          </div>
          <div style={{ minInlineSize: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'hsl(var(--text-muted))',
                }}
              >
                Tesouraria & Controladoria Escolar
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '1px 8px',
                  borderRadius: 99,
                  background: kpis.taxaRecebimento >= 95 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                  color: kpis.taxaRecebimento >= 95 ? '#059669' : '#d97706',
                }}
                title="Eficiência de recebimento frente à meta escolar de 95%"
              >
                <ShieldCheck size={11} />
                Adimplência { (100 - kpis.taxaInadimplencia).toFixed(1) }% • Meta 95%
              </span>
              {isFetchingTitulos && <UpdatingIndicator />}
            </div>
            <h1
              style={{
                margin: '0.1rem 0 0',
                fontSize: 'clamp(1.125rem, 1rem + 0.4vw, 1.35rem)',
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: 'hsl(var(--text-primary))',
                textWrap: 'balance',
              }}
            >
              Contas a Receber & Faturamento
            </h1>
          </div>
        </div>

        {/* Ações Rápidas de Tesouraria */}
        <div className="cr-pill-group">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportSpreadsheet}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => setShowAnalytics(v => !v)}
            className="btn btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0.45rem 0.75rem',
              borderRadius: 9,
              background: showAnalytics ? 'rgba(59,130,246,0.12)' : 'hsl(var(--bg-elevated))',
              border: `1px solid ${showAnalytics ? 'rgba(59,130,246,0.35)' : 'hsl(var(--border-subtle))'}`,
              color: showAnalytics ? '#2563eb' : 'hsl(var(--text-secondary))',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
            title="Expandir Raio-X de Aging, Previsão Trimestral e Composição da Carteira"
          >
            <BarChart3 size={14} />
            <span>Raio-X & Projeções</span>
            {showAnalytics ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.45rem 0.75rem', borderRadius: 9 }}
            title="Importar planilha de títulos (.xlsx ou .csv)"
          >
            <Upload size={13} />
            <span>Importar</span>
          </button>

          <button
            type="button"
            onClick={() => handleExportExcel(false)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.45rem 0.75rem', borderRadius: 9 }}
            title="Exportar planilha Excel (.xlsx)"
          >
            <FileSpreadsheet size={13} style={{ color: '#059669' }} />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.45rem 0.65rem', borderRadius: 9 }}
            title="Exportar arquivo CSV"
          >
            <Download size={13} />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrintRelatorio}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.75rem', padding: '0.45rem 0.75rem', borderRadius: 9 }}
            title="Imprimir Borderô / Relatório Executivo da listagem atual"
          >
            <Printer size={13} style={{ color: '#2563eb' }} />
            <span>Relatório</span>
          </button>

          <button
            type="button"
            onClick={openNew}
            className="btn btn-primary btn-sm"
            style={{
              fontSize: '0.78rem',
              fontWeight: 800,
              padding: '0.5rem 0.95rem',
              borderRadius: 9,
              background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.24)',
            }}
          >
            <Plus size={14} />
            <span>Novo Título</span>
          </button>
        </div>
      </header>

      {/* ─── 2. RADAR INTELIGENTE DE COBRANÇA (Aparece apenas quando há urgência hoje ou atraso) ─── */}
      {(kpis.qtdAtrasado > 0 || kpis.venceHojeQtd > 0) && (
        <div
          style={{
            padding: '0.625rem 1rem',
            borderRadius: 12,
            background: kpis.qtdAtrasado > 0 ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.08)',
            border: `1px solid ${kpis.qtdAtrasado > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.28)'}`,
            display: 'flex',
            alignItems: 'safe center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.625rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.78rem', flexWrap: 'wrap' }}>
            <AlertTriangle size={15} color={kpis.qtdAtrasado > 0 ? '#ef4444' : '#d97706'} />
            <span style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Atenção Operacional:</span>
            {kpis.qtdAtrasado > 0 && (
              <span style={{ color: '#dc2626', fontWeight: 700 }}>
                {kpis.qtdAtrasado} vencido(s) ({fmtCur(kpis.totalAtrasado)} • c/ encargos: {fmtCur(kpis.totalAtrasadoComEncargos)})
              </span>
            )}
            {kpis.venceHojeQtd > 0 && (
              <span style={{ color: '#d97706', fontWeight: 700 }}>
                • {kpis.venceHojeQtd} título(s) vencendo HOJE ({fmtCur(kpis.venceHojeVal)})
              </span>
            )}
          </div>
          <div className="cr-pill-group">
            {kpis.qtdAtrasado > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  fontSize: '0.7rem',
                  padding: '0.25rem 0.65rem',
                  background: 'rgba(239,68,68,0.12)',
                  color: '#dc2626',
                  border: '1px solid rgba(239,68,68,0.28)',
                  fontWeight: 700,
                }}
                onClick={() => setTabStatus(tabStatus === 'atrasado' ? 'todos' : 'atrasado')}
              >
                Ver Inadimplentes
              </button>
            )}
            {kpis.venceHojeQtd > 0 && (
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  fontSize: '0.7rem',
                  padding: '0.25rem 0.65rem',
                  background: 'rgba(245,158,11,0.14)',
                  color: '#b45309',
                  border: '1px solid rgba(245,158,11,0.3)',
                  fontWeight: 700,
                }}
                onClick={() => setTabStatus(tabStatus === 'hoje' ? 'todos' : 'hoje')}
              >
                Vencendo Hoje
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── 3. STRIP EXECUTIVO DE 4 CARDS FINANCEIROS (Design Leve, Sem Redundância, Click-to-Filter) ─── */}
      <section aria-label="Indicadores Executivos de Contas a Receber" className="cr-kpi-grid">
        {/* CARD 1: RECEBIDO EM CAIXA & EFICIÊNCIA */}
        <article
          className="cr-kpi-article"
          onClick={() => setTabStatus(tabStatus === 'pago' ? 'todos' : 'pago')}
          style={{
            borderColor: tabStatus === 'pago' ? '#10b981' : undefined,
            boxShadow: tabStatus === 'pago' ? '0 0 0 2px rgba(16,185,129,0.18)' : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  inlineSize: 28,
                  blockSize: 28,
                  borderRadius: 8,
                  background: 'rgba(16,185,129,0.12)',
                  color: '#059669',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CheckCircle2 size={15} />
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--text-muted))' }}>
                Recebido (Caixa)
              </span>
            </div>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 99,
                background: kpis.taxaRecebimento >= 95 ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                color: kpis.taxaRecebimento >= 95 ? '#059669' : '#d97706',
              }}
            >
              {kpis.taxaRecebimento.toFixed(1)}% realizado
            </span>
          </div>

          <div>
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#059669', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
              {fmtCur(kpis.totalPago)}
            </div>
            {/* Barra de progresso embutida (elimina card duplicado de Performance) */}
            <div style={{ background: 'hsl(var(--bg-overlay))', borderRadius: 99, blockSize: 5, overflow: 'clip', marginBlock: '0.4rem' }}>
              <div
                style={{
                  blockSize: '100%',
                  inlineSize: `${Math.min(100, kpis.taxaRecebimento)}%`,
                  background: 'linear-gradient(90deg, #10b981, #34d399)',
                  borderRadius: 99,
                  transition: 'inline-size 0.35s ease',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'hsl(var(--text-muted))' }}>
            <span><strong>{kpis.qtdPago}</strong> liquidado(s)</span>
            <span>Ticket: <strong style={{ color: 'hsl(var(--text-secondary))' }}>{fmtCur(kpis.ticketMedioPago)}</strong></span>
          </div>
        </article>

        {/* CARD 2: A VENCER NO PRAZO & CURTO PRAZO (HOJE / 7 DIAS) */}
        <article
          className="cr-kpi-article"
          onClick={() => setTabStatus(tabStatus === 'pendente' ? 'todos' : 'pendente')}
          style={{
            borderColor: tabStatus === 'pendente' || tabStatus === 'hoje' || tabStatus === '7dias' ? '#0284c7' : undefined,
            boxShadow: tabStatus === 'pendente' || tabStatus === 'hoje' || tabStatus === '7dias' ? '0 0 0 2px rgba(2,132,199,0.18)' : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  inlineSize: 28,
                  blockSize: 28,
                  borderRadius: 8,
                  background: 'rgba(2,132,199,0.12)',
                  color: '#0284c7',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <CalendarClock size={15} />
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--text-muted))' }}>
                A Vencer (No Prazo)
              </span>
            </div>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#0284c7' }}>
              {kpis.qtdPendente} em aberto
            </span>
          </div>

          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0284c7', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
            {fmtCur(kpis.totalPendente)}
          </div>

          <div
            style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setTabStatus(tabStatus === 'hoje' ? 'todos' : 'hoje')}
              style={{
                flex: 1,
                padding: '3px 7px',
                borderRadius: 6,
                border: `1px solid ${tabStatus === 'hoje' ? '#d97706' : 'hsl(var(--border-subtle))'}`,
                background: tabStatus === 'hoje' ? 'rgba(245,158,11,0.14)' : 'hsl(var(--bg-elevated))',
                color: kpis.venceHojeQtd > 0 ? '#d97706' : 'hsl(var(--text-muted))',
                fontSize: '0.675rem',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
              title="Filtrar títulos que vencem hoje"
            >
              Hoje ({kpis.venceHojeQtd}): {fmtCur(kpis.venceHojeVal)}
            </button>
            <button
              type="button"
              onClick={() => setTabStatus(tabStatus === '7dias' ? 'todos' : '7dias')}
              style={{
                flex: 1,
                padding: '3px 7px',
                borderRadius: 6,
                border: `1px solid ${tabStatus === '7dias' ? '#0284c7' : 'hsl(var(--border-subtle))'}`,
                background: tabStatus === '7dias' ? 'rgba(2,132,199,0.14)' : 'hsl(var(--bg-elevated))',
                color: kpis.vence7DiasQtd > 0 ? '#0284c7' : 'hsl(var(--text-muted))',
                fontSize: '0.675rem',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
              title="Filtrar títulos a vencer nos próximos 7 dias"
            >
              7 dias ({kpis.vence7DiasQtd}): {fmtCur(kpis.vence7DiasVal)}
            </button>
          </div>
        </article>

        {/* CARD 3: INADIMPLÊNCIA, RISCO & AGING INTEGRADO */}
        <article
          className="cr-kpi-article"
          onClick={() => setTabStatus(tabStatus === 'atrasado' ? 'todos' : 'atrasado')}
          style={{
            borderColor: tabStatus === 'atrasado' ? '#ef4444' : undefined,
            boxShadow: tabStatus === 'atrasado' ? '0 0 0 2px rgba(239,68,68,0.18)' : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  inlineSize: 28,
                  blockSize: 28,
                  borderRadius: 8,
                  background: kpis.totalAtrasado > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                  color: kpis.totalAtrasado > 0 ? '#ef4444' : '#059669',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {kpis.totalAtrasado > 0 ? <AlertTriangle size={15} /> : <ShieldCheck size={15} />}
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--text-muted))' }}>
                Em Atraso & Aging
              </span>
            </div>
            <span
              style={{
                fontSize: '0.6875rem',
                fontWeight: 800,
                padding: '2px 7px',
                borderRadius: 99,
                background: kpis.totalAtrasado > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                color: kpis.totalAtrasado > 0 ? '#dc2626' : '#059669',
              }}
            >
              {kpis.totalAtrasado > 0 ? `${kpis.taxaInadimplencia.toFixed(1)}% inadimp.` : '0% inadimp.'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <div
              style={{
                fontSize: '1.35rem',
                fontWeight: 900,
                color: kpis.totalAtrasado > 0 ? '#dc2626' : 'hsl(var(--text-primary))',
                fontFamily: 'Outfit, sans-serif',
                letterSpacing: '-0.02em',
              }}
            >
              {fmtCur(kpis.totalAtrasado)}
            </div>
            {kpis.totalEncargosPotenciais > 0 && (
              <span
                style={{ fontSize: '0.675rem', fontWeight: 700, color: '#dc2626' }}
                title="Valor atualizado com Multa (2%) + Juros moratórios (1% a.m.)"
              >
                c/ encargos: {fmtCur(kpis.totalAtrasadoComEncargos)}
              </span>
            )}
          </div>

          {/* Mini Aging Integrado (Elimina o card vazio gigante quando não há atrasos) */}
          {kpis.totalAtrasado === 0 ? (
            <div
              style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#059669',
                background: 'rgba(16,185,129,0.08)',
                borderRadius: 6,
                padding: '3px 8px',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Check size={12} /> Carteira 100% adimplente — zero vencidos
            </div>
          ) : (
            <div
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}
              onClick={e => e.stopPropagation()}
            >
              {agingData.map(b => {
                const active = filtroAging === b.label
                return (
                  <button
                    key={b.label}
                    type="button"
                    onClick={() => {
                      if (active) {
                        setFiltroAging('todos')
                      } else {
                        setTabStatus('atrasado')
                        setFiltroAging(b.label)
                      }
                    }}
                    title={`${b.label}: ${b.qtd} título(s) — ${fmtCur(b.valor)}`}
                    style={{
                      padding: '2px 4px',
                      borderRadius: 5,
                      border: `1px solid ${active ? b.color : 'hsl(var(--border-subtle))'}`,
                      background: active ? `${b.color}18` : 'hsl(var(--bg-elevated))',
                      color: b.qtd > 0 ? b.color : 'hsl(var(--text-muted))',
                      fontSize: '0.625rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      overflow: 'clip',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {b.label.replace(' dias', 'd')}: {b.qtd}
                  </button>
                )
              })}
            </div>
          )}
        </article>

        {/* CARD 4: CARTEIRA ATIVA & PROJEÇÃO TRIMESTRAL */}
        <article
          className="cr-kpi-article"
          onClick={clearFilters}
          style={{
            borderColor: selectedIds.size > 0 ? '#7c3aed' : (activeFilters > 0 || searchRaw || tabStatus !== 'todos') ? '#2563eb' : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  inlineSize: 28,
                  blockSize: 28,
                  borderRadius: 8,
                  background: selectedIds.size > 0 ? 'rgba(124,58,237,0.12)' : 'rgba(37,99,235,0.12)',
                  color: selectedIds.size > 0 ? '#7c3aed' : '#2563eb',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wallet size={15} />
              </span>
              <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'hsl(var(--text-muted))' }}>
                {selectedIds.size > 0
                  ? `Selecionados (${selectedIds.size})`
                  : filtered.length !== titulos.length
                    ? `Subtotal Filtrado (${filtered.length})`
                    : 'Carteira Faturada'}
              </span>
            </div>
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'hsl(var(--text-muted))' }}>
              {titulos.length} tít. ativos
            </span>
          </div>

          <div>
            <div
              style={{
                fontSize: '1.35rem',
                fontWeight: 900,
                color: selectedIds.size > 0 ? '#7c3aed' : '#2563eb',
                fontFamily: 'Outfit, sans-serif',
                letterSpacing: '-0.02em',
              }}
            >
              {fmtCur(selectedIds.size > 0 ? totalSelected : filtered.length !== titulos.length ? totalFiltrado : kpis.totalCarteira)}
            </div>

            {/* Barra de composição proporcional da carteira (Pago / A Vencer / Atrasado) */}
            <div
              style={{
                display: 'flex',
                blockSize: 5,
                borderRadius: 99,
                background: 'hsl(var(--bg-overlay))',
                overflow: 'clip',
                marginBlock: '0.4rem',
                gap: 1,
              }}
              title={`Composição: Pago ${kpis.taxaRecebimento.toFixed(1)}% • No Prazo ${kpis.pctNoPrazo.toFixed(1)}% • Atraso ${kpis.taxaInadimplencia.toFixed(1)}%`}
            >
              <div style={{ inlineSize: `${kpis.taxaRecebimento}%`, background: '#10b981' }} />
              <div style={{ inlineSize: `${kpis.pctNoPrazo}%`, background: '#0284c7' }} />
              <div style={{ inlineSize: `${kpis.taxaInadimplencia}%`, background: '#ef4444' }} />
            </div>
          </div>

          {/* Previsão 3 Meses Compacta Integrada (Clicável para filtrar cada mês) */}
          <div
            style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}
            onClick={e => e.stopPropagation()}
          >
            {previsao.map(p => {
              const isMesActive = filtroMes === p.mes && filtroAno === p.ano
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    if (isMesActive) {
                      setFiltroMes('todos')
                      setFiltroAno('todos')
                    } else {
                      setFiltroMes(p.mes)
                      setFiltroAno(p.ano)
                    }
                  }}
                  title={`Previsão em aberto para ${p.label}: ${fmtCur(p.valor)} (${p.qtd} títulos) — clique para filtrar`}
                  style={{
                    padding: '2px 5px',
                    borderRadius: 5,
                    border: `1px solid ${isMesActive ? '#2563eb' : 'hsl(var(--border-subtle))'}`,
                    background: isMesActive ? 'rgba(37,99,235,0.12)' : 'hsl(var(--bg-elevated))',
                    color: isMesActive ? '#2563eb' : 'hsl(var(--text-secondary))',
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'clip',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {p.label.slice(0, 3)}: <strong>{fmtCur(p.valor)}</strong>
                </button>
              )
            })}
          </div>
        </article>
      </section>

      {/* ─── 4. DRAWER RETRÁTIL DE INTELIGÊNCIA FINANCEIRA (Raio-X, Aging & Fluxo 3 Meses) ─── */}
      <AnimatePresence initial={false}>
        {showAnalytics && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'clip' }}
            aria-label="Raio-X Financeiro da Carteira"
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {/* Painel A: Origem da Receita & Métodos */}
              <div className="cr-surface-card" style={{ padding: '0.875rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: '0.625rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))' }}>
                    Composição por Origem & Método
                  </span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb' }}>
                    Ticket Médio: {fmtCur(kpis.ticketMedioCarteira)}
                  </span>
                </div>

                {[
                  { id: 'matricula', label: 'Mensalidades & Matrículas', val: kpis.origens.mensalidades, color: '#2563eb' },
                  { id: 'acordo', label: 'Acordos & Renegociações', val: kpis.origens.acordos, color: '#0891b2' },
                  { id: 'manual_receber', label: 'Receitas Avulsas / Manuais', val: kpis.origens.avulsos, color: '#10b981' },
                ].map(orig => {
                  const active = filtroOrigem === orig.id
                  return (
                    <div
                      key={orig.id}
                      onClick={() => setFiltroOrigem(active ? 'todos' : (orig.id as any))}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.75rem',
                        padding: '0.3rem 0.45rem',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: active ? 'hsl(var(--bg-elevated))' : 'transparent',
                        marginBlockEnd: 3,
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: active ? 800 : 600 }}>
                        <span style={{ inlineSize: 7, blockSize: 7, borderRadius: 99, background: orig.color }} />
                        {orig.label}
                      </span>
                      <strong style={{ color: orig.color }}>{fmtCur(orig.val)}</strong>
                    </div>
                  )
                })}

                {kpis.topMetodos.length > 0 && (
                  <div style={{ borderBlockStart: '1px solid hsl(var(--border-subtle))', marginBlockStart: 8, paddingBlockStart: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {kpis.topMetodos.map(m => (
                      <button
                        key={m.nome}
                        type="button"
                        onClick={() => setFiltroMetodo(filtroMetodo === m.nome ? 'todos' : m.nome)}
                        style={{
                          fontSize: '0.675rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: 99,
                          border: `1px solid ${filtroMetodo === m.nome ? '#6366f1' : 'hsl(var(--border-subtle))'}`,
                          background: filtroMetodo === m.nome ? 'rgba(99,102,241,0.12)' : 'hsl(var(--bg-elevated))',
                          color: filtroMetodo === m.nome ? '#4f46e5' : 'hsl(var(--text-secondary))',
                          cursor: 'pointer',
                        }}
                      >
                        {m.nome}: {fmtCur(m.valor)} ({m.qtd})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Painel B: Aging Detalhado de Inadimplência */}
              <div className="cr-surface-card" style={{ padding: '0.875rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: '0.625rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))' }}>
                    Aging de Inadimplência (Faixas de Atraso)
                  </span>
                  {filtroAging !== 'todos' && (
                    <button
                      type="button"
                      onClick={() => setFiltroAging('todos')}
                      style={{ fontSize: '0.6875rem', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}
                    >
                      Limpar faixa
                    </button>
                  )}
                </div>

                {agingData.map(b => {
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
                        marginBlockEnd: 6,
                        cursor: 'pointer',
                        padding: '3px 6px',
                        borderRadius: 6,
                        background: isSelected ? 'hsl(var(--bg-elevated))' : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.725rem', marginBlockEnd: 2 }}>
                        <span style={{ color: b.color, fontWeight: 700 }}>{b.label}</span>
                        <span style={{ fontWeight: 700 }}>{b.qtd > 0 ? `${b.qtd} tít. • ${fmtCur(b.valor)}` : 'R$ 0,00'}</span>
                      </div>
                      <div style={{ background: 'hsl(var(--bg-overlay))', borderRadius: 4, blockSize: 5, overflow: 'clip' }}>
                        <div
                          style={{
                            blockSize: '100%',
                            inlineSize: `${kpis.totalAtrasado > 0 ? (b.valor / kpis.totalAtrasado) * 100 : 0}%`,
                            background: b.color,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Painel C: Projeção Trimestral de Recebíveis */}
              <div className="cr-surface-card" style={{ padding: '0.875rem 1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBlockEnd: '0.625rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))' }}>
                    Fluxo de Recebimento Previsto (3 Meses)
                  </span>
                  <strong style={{ fontSize: '0.75rem', color: '#2563eb' }}>
                    Total: {fmtCur(previsao.reduce((s, p) => s + p.valor, 0))}
                  </strong>
                </div>

                {previsao.map(p => {
                  const maxVal = Math.max(...previsao.map(x => x.valor), 1)
                  const active = filtroMes === p.mes && filtroAno === p.ano
                  return (
                    <div
                      key={p.label}
                      style={{
                        marginBlockEnd: 8,
                        cursor: 'pointer',
                        padding: '3px 6px',
                        borderRadius: 6,
                        background: active ? 'hsl(var(--bg-elevated))' : 'transparent',
                      }}
                      onClick={() => {
                        if (active) {
                          setFiltroMes('todos')
                          setFiltroAno('todos')
                        } else {
                          setFiltroMes(p.mes)
                          setFiltroAno(p.ano)
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBlockEnd: 3 }}>
                        <span style={{ fontWeight: 700 }}>
                          {p.label} <span style={{ fontSize: '0.675rem', color: 'hsl(var(--text-muted))' }}>({p.qtd} em aberto)</span>
                        </span>
                        <span style={{ fontWeight: 800, color: '#2563eb' }}>{fmtCur(p.valor)}</span>
                      </div>
                      <div style={{ background: 'hsl(var(--bg-overlay))', borderRadius: 4, blockSize: 6, overflow: 'clip' }}>
                        <div
                          style={{
                            blockSize: '100%',
                            inlineSize: `${p.valor > 0 ? (p.valor / maxVal) * 100 : 0}%`,
                            background: 'linear-gradient(90deg, #2563eb, #60a5fa)',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* ─── 5. BARRA UNIFICADA DE COMANDO, SEGMENTAÇÃO & BUSCA RÁPIDA ─── */}
      <div
        className="cr-surface-card"
        style={{
          padding: '0.625rem 0.875rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
        }}
      >
        <div className="cr-toolbar-row">
          {/* Segmented Control de Status (Sem quebra de linha em "A Vencer") */}
          <div
            role="tablist"
            aria-label="Filtrar títulos por situação"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: 3,
              borderRadius: 10,
              background: 'hsl(var(--bg-elevated))',
              border: '1px solid hsl(var(--border-subtle))',
              flexWrap: 'wrap',
            }}
          >
            {([
              { id: 'todos', label: 'Todos', count: titulosReceber.length, dot: '#475569' },
              { id: 'pendente', label: 'A Vencer', count: kpis.qtdPendente, dot: '#0284c7' },
              { id: 'hoje', label: 'Vence Hoje', count: kpis.venceHojeQtd, dot: '#d97706' },
              { id: 'atrasado', label: 'Em Atraso', count: kpis.qtdAtrasado, dot: '#ef4444' },
              { id: 'pago', label: 'Recebidos', count: kpis.qtdPago, dot: '#10b981' },
            ] as const).map(pill => {
              const active = tabStatus === pill.id
              return (
                <button
                  key={pill.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTabStatus(pill.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '0.35rem 0.65rem',
                    borderRadius: 7,
                    background: active ? 'hsl(var(--bg-surface))' : 'transparent',
                    border: 'none',
                    boxShadow: active ? '0 1px 3px rgba(15, 23, 42, 0.1)' : 'none',
                    color: active ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))',
                    fontSize: '0.75rem',
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      inlineSize: 6,
                      blockSize: 6,
                      borderRadius: 99,
                      background: pill.dot,
                      opacity: active ? 1 : 0.65,
                      flexShrink: 0,
                    }}
                  />
                  <span>{pill.label}</span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      padding: '0px 5px',
                      borderRadius: 99,
                      background: active ? 'rgba(37,99,235,0.12)' : 'hsl(var(--bg-overlay))',
                      color: active ? '#2563eb' : 'hsl(var(--text-muted))',
                      fontWeight: 800,
                    }}
                  >
                    {pill.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Busca Instantânea */}
          <div style={{ position: 'relative', flex: '1 1 240px', minInlineSize: 200 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                insetInlineStart: 11,
                insetBlockStart: '50%',
                transform: 'translateY(-50%)',
                color: 'hsl(var(--text-muted))',
                pointerEvents: 'none',
              }}
            />
            <input
              className="form-input"
              style={{
                paddingInlineStart: 34,
                paddingInlineEnd: searchRaw ? 30 : 12,
                paddingBlock: '0.42rem',
                fontSize: '0.78rem',
                borderRadius: 9,
              }}
              placeholder="Buscar aluno, código (TIT-...), responsável, centro de custo ou descrição..."
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
                style={{
                  position: 'absolute',
                  insetInlineEnd: 8,
                  insetBlockStart: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'hsl(var(--text-muted))',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Atalhos de Período + Ordenação + Botão de Filtros Avançados */}
          <div className="cr-pill-group">
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 2,
                padding: 2,
                borderRadius: 8,
                background: 'hsl(var(--bg-elevated))',
                border: '1px solid hsl(var(--border-subtle))',
              }}
            >
              {(
                [
                  { id: 'todos', label: 'Tudo' },
                  { id: 'hoje', label: 'Hoje' },
                  { id: '7dias', label: '7d' },
                  { id: 'mes_atual', label: 'Este Mês' },
                  { id: 'mes_seguinte', label: 'Próx. Mês' },
                ] as const
              ).map(p => {
                const active = quickPeriod === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyQuickPeriod(active && p.id !== 'todos' ? 'todos' : p.id)}
                    style={{
                      padding: '0.28rem 0.55rem',
                      borderRadius: 6,
                      border: 'none',
                      background: active ? 'hsl(var(--bg-surface))' : 'transparent',
                      color: active ? '#2563eb' : 'hsl(var(--text-muted))',
                      fontSize: '0.7rem',
                      fontWeight: active ? 800 : 600,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <ArrowUpDown size={13} style={{ color: 'hsl(var(--text-muted))', flexShrink: 0 }} />
              <select
                aria-label="Ordenar títulos"
                className="form-input"
                style={{ inlineSize: 172, padding: '0.38rem 0.6rem', fontSize: '0.75rem', borderRadius: 8 }}
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
              >
                <option value="venc_desc">Vencimento (Recentes)</option>
                <option value="venc_asc">Vencimento (Próximos)</option>
                <option value="valor_desc">Maior Valor (R$)</option>
                <option value="valor_asc">Menor Valor (R$)</option>
                <option value="aluno_asc">Aluno / Pagador (A-Z)</option>
              </select>
            </div>

            <button
              type="button"
              className={`btn btn-sm ${showFilters || activeFilters > 0 ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 8, padding: '0.4rem 0.7rem', fontSize: '0.75rem' }}
              onClick={() => setShowFilters(p => !p)}
            >
              <SlidersHorizontal size={13} />
              <span>Filtros</span>
              {activeFilters > 0 && (
                <span
                  style={{
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: 99,
                    minInlineSize: 16,
                    blockSize: 16,
                    paddingInline: 4,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.625rem',
                    fontWeight: 900,
                  }}
                >
                  {activeFilters}
                </span>
              )}
            </button>

            {(activeFilters > 0 || searchRaw || tabStatus !== 'todos' || quickPeriod !== 'todos') && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ color: '#ef4444', fontWeight: 700, fontSize: '0.75rem', padding: '0.35rem 0.55rem' }}
                onClick={clearFilters}
              >
                <X size={12} /> Limpar
              </button>
            )}
          </div>
        </div>

        {/* Chips de Filtros Ativos (Visibilidade imediata quando qualquer filtro está aplicado) */}
        {(activeFilters > 0 || tabStatus !== 'todos' || Boolean(searchRaw)) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
              paddingBlockStart: 6,
              borderBlockStart: '1px dashed hsl(var(--border-subtle))',
              fontSize: '0.7rem',
            }}
          >
            <span style={{ color: 'hsl(var(--text-muted))', fontWeight: 700 }}>Filtros ativos:</span>
            {tabStatus !== 'todos' && (
              <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(37,99,235,0.1)', color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Situação: {tabStatus.toUpperCase()}
                <X size={11} style={{ cursor: 'pointer' }} onClick={() => setTabStatus('todos')} />
              </span>
            )}
            {filtroOrigem !== 'todos' && (
              <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(8,145,178,0.1)', color: '#0891b2', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Origem: {filtroOrigem === 'matricula' ? 'Mensalidades' : filtroOrigem === 'acordo' ? 'Acordos' : 'Manuais'}
                <X size={11} style={{ cursor: 'pointer' }} onClick={() => setFiltroOrigem('todos')} />
              </span>
            )}
            {filtroAging !== 'todos' && (
              <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(239,68,68,0.1)', color: '#dc2626', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Aging: {filtroAging}
                <X size={11} style={{ cursor: 'pointer' }} onClick={() => setFiltroAging('todos')} />
              </span>
            )}
            {filtroMes !== 'todos' && (
              <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(37,99,235,0.1)', color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Mês: {MESES_FULL[Number(filtroMes) - 1] || filtroMes}{filtroAno !== 'todos' ? `/${filtroAno}` : ''}
                <X size={11} style={{ cursor: 'pointer' }} onClick={() => { setFiltroMes('todos'); setQuickPeriod('todos') }} />
              </span>
            )}
            {filtroMetodo !== 'todos' && (
              <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(99,102,241,0.1)', color: '#4f46e5', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Método: {filtroMetodo}
                <X size={11} style={{ cursor: 'pointer' }} onClick={() => setFiltroMetodo('todos')} />
              </span>
            )}
            {filtroCentroCusto !== 'todos' && (
              <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                C. Custo: {filtroCentroCusto}
                <X size={11} style={{ cursor: 'pointer' }} onClick={() => setFiltroCentroCusto('todos')} />
              </span>
            )}
            {(dataVencDe || dataVencAte) && (
              <span style={{ padding: '2px 8px', borderRadius: 99, background: 'rgba(245,158,11,0.12)', color: '#d97706', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Período: {fmt(dataVencDe)} até {fmt(dataVencAte)}
                <X size={11} style={{ cursor: 'pointer' }} onClick={() => { setDataVencDe(''); setDataVencAte(''); setQuickPeriod('todos') }} />
              </span>
            )}
            <span style={{ marginInlineStart: 'auto', fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
              Exibindo {filtered.length} registro(s) • Soma: <strong style={{ color: '#059669' }}>{fmtCur(totalFiltrado)}</strong>
            </span>
          </div>
        )}
      </div>

      {/* ─── 6. PAINEL DE FILTROS AVANÇADOS (Sob demanda) ─── */}
      {showFilters && (
        <div
          className="cr-surface-card"
          style={{
            padding: '0.875rem 1.125rem',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '0.75rem',
            alignItems: 'end',
          }}
        >
          <div>
            <label htmlFor="cr-origem" className="form-label" style={{ fontSize: '0.65rem' }}>Origem da Receita</label>
            <select id="cr-origem" className="form-input" style={{ inlineSize: '100%', fontSize: '0.75rem' }} value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value as any)}>
              <option value="todos">Todas as Origens</option>
              <option value="matricula">Mensalidades / Matrícula</option>
              <option value="acordo">Acordos / Renegociação</option>
              <option value="manual_receber">Lançamentos Manuais</option>
            </select>
          </div>
          <div>
            <label htmlFor="cr-venc-de" className="form-label" style={{ fontSize: '0.65rem' }}>Vencimento Inicial</label>
            <input id="cr-venc-de" type="date" className="form-input" style={{ inlineSize: '100%', fontSize: '0.75rem' }} value={dataVencDe} onChange={e => { setDataVencDe(e.target.value); setQuickPeriod('todos') }} />
          </div>
          <div>
            <label htmlFor="cr-venc-ate" className="form-label" style={{ fontSize: '0.65rem' }}>Vencimento Final</label>
            <input id="cr-venc-ate" type="date" className="form-input" style={{ inlineSize: '100%', fontSize: '0.75rem' }} value={dataVencAte} onChange={e => { setDataVencAte(e.target.value); setQuickPeriod('todos') }} />
          </div>
          <div>
            <label htmlFor="cr-mes" className="form-label" style={{ fontSize: '0.65rem' }}>Mês de Competência</label>
            <select id="cr-mes" className="form-input" style={{ inlineSize: '100%', fontSize: '0.75rem' }} value={filtroMes} onChange={e => setFiltroMes(e.target.value)}>
              <option value="todos">Todos os meses</option>
              {MESES_FULL.map((m, i) => <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cr-ano" className="form-label" style={{ fontSize: '0.65rem' }}>Ano</label>
            <select id="cr-ano" className="form-input" style={{ inlineSize: '100%', fontSize: '0.75rem' }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
              <option value="todos">Todos</option>
              {anos.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cr-metodo" className="form-label" style={{ fontSize: '0.65rem' }}>Método de Pagamento</label>
            <select id="cr-metodo" className="form-input" style={{ inlineSize: '100%', fontSize: '0.75rem' }} value={filtroMetodo} onChange={e => setFiltroMetodo(e.target.value)}>
              <option value="todos">Todos os métodos</option>
              {metodosSelect.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="cr-evento" className="form-label" style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tag size={10} />Evento Financeiro
            </label>
            <select id="cr-evento" className="form-input" style={{ inlineSize: '100%', fontSize: '0.75rem' }} value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <label htmlFor="cr-centro-custo" className="form-label" style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Target size={10} />Centro de Custo
              </label>
              <Link
                href="/configuracoes/financeiro/centro-custo"
                style={{ fontSize: '0.65rem', fontWeight: 700, color: '#2563eb', textDecoration: 'none', marginBlockEnd: 4 }}
              >
                Configurar
              </Link>
            </div>
            <select
              id="cr-centro-custo"
              className="form-input"
              style={{ inlineSize: '100%', fontSize: '0.75rem' }}
              value={filtroCentroCusto}
              onChange={e => setFiltroCentroCusto(e.target.value)}
            >
              <option value="todos">Todos os Centros</option>
              {todosCentrosCusto.map(cc => (
                <option key={cc.id} value={cc.id}>
                  {cc.sigla} — {cc.id}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ─── 7. BARRA DE AÇÕES EM LOTE (Quando há títulos selecionados) ─── */}
      {selectedIds.size > 0 && (
        <div
          style={{
            padding: '0.65rem 1rem',
            borderRadius: 12,
            background: 'rgba(16,185,129,0.08)',
            border: '1.5px solid rgba(16,185,129,0.35)',
            display: 'flex',
            alignItems: 'safe center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div style={{ fontSize: '0.8125rem', fontWeight: 700 }}>
            <strong>{selectedIds.size}</strong> título(s) selecionado(s) • Total:{' '}
            <strong style={{ color: '#059669', fontSize: '0.9375rem' }}>{fmtCur(totalSelected)}</strong>
          </div>
          <div className="cr-pill-group">
            {selectedObjects.some(t => t.status !== 'pago') && (
              <button type="button" className="btn btn-primary btn-sm" style={{ background: '#059669' }} onClick={openBaixaLote}>
                <Check size={13} />Baixar Selecionados ({selectedObjects.filter(t => t.status !== 'pago').length})
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReceiptTarget(selectedObjects)}>
              <Printer size={13} />Emitir Recibo ({selectedIds.size})
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrintRelatorio}>
              <FileText size={13} />Imprimir Borderô
            </button>
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

      {/* ─── 8. TABELA PRINCIPAL DE CONTAS A RECEBER (Responsiva com Container Queries & Ações Rápidas) ─── */}
      {loadingTitulos && titulos.length === 0 ? (
        <div className="cr-table-region">
          <table className="cr-data-table">
            <thead>
              <tr>
                <th style={{ inlineSize: 38 }} />
                <th>Código</th>
                <th>Aluno / Pagador</th>
                <th>Descrição & Classificação</th>
                <th>Vencimento</th>
                <th style={{ textAlign: 'center' }}>Parcela</th>
                <th style={{ textAlign: 'right' }}>Valor Líquido</th>
                <th>Método</th>
                <th>Situação</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              <TableSkeleton rows={8} cols={10} />
            </tbody>
          </table>
        </div>
      ) : titulos.length === 0 ? (
        <div className="cr-surface-card" style={{ padding: '3.5rem 1.5rem', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <DollarSign size={44} style={{ opacity: 0.18, margin: '0 auto 0.875rem', display: 'block' }} />
          <div style={{ fontWeight: 800, fontSize: '1rem', marginBlockEnd: 6, color: 'hsl(var(--text-primary))' }}>
            Nenhum título registrado na carteira
          </div>
          <div style={{ fontSize: '0.8125rem', marginBlockEnd: 18 }}>
            Registre mensalidades, taxas escolares, acordos ou importe uma planilha Excel/CSV com controle integrado de caixa.
          </div>
          <div style={{ display: 'inline-flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload size={14} />Importar Planilha
            </button>
            <button type="button" className="btn btn-primary" onClick={openNew}>
              <Plus size={14} />Lançar Primeiro Título
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={tableRegionRef}
          className="cr-table-region"
          tabIndex={0}
          role="region"
          aria-label="Relação de Contas a Receber"
        >
          <table className="cr-data-table">
            <thead>
              <tr>
                <th style={{ inlineSize: 38, textAlign: 'center' }}>
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
                <th>Aluno / Pagador</th>
                <th>Descrição & Classificação</th>
                <th>Vencimento</th>
                <th style={{ textAlign: 'center' }}>Parcela</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Método</th>
                <th>Situação</th>
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
                const isEntrada = Boolean(t._parcIsEntrada)
                const isSingle = tot === 1 && !isEntrada
                const isFirst = cur === 1 && tot > 1
                const isLast = cur === tot && tot > 1
                const pBg = isEntrada
                  ? 'rgba(6,182,212,0.12)'
                  : isSingle
                    ? 'rgba(99,102,241,0.1)'
                    : isFirst
                      ? 'rgba(16,185,129,0.1)'
                      : isLast
                        ? 'rgba(245,158,11,0.1)'
                        : 'rgba(59,130,246,0.08)'
                const pColor = isEntrada
                  ? '#0891b2'
                  : isSingle
                    ? '#6366f1'
                    : isFirst
                      ? '#059669'
                      : isLast
                        ? '#d97706'
                        : '#2563eb'
                const pSub = isEntrada ? 'Entrada' : isSingle ? 'Única' : isFirst ? 'Inicial' : isLast ? 'Final' : 'Mensal'
                const rowClass =
                  t.status === 'pago'
                    ? 'cr-row-pago'
                    : t.status === 'atrasado'
                      ? 'cr-row-atrasado'
                      : isToday
                        ? 'cr-row-hoje'
                        : ''
                const stripeColor =
                  t.status === 'pago'
                    ? '#10b981'
                    : t.status === 'atrasado'
                      ? '#ef4444'
                      : isToday
                        ? '#f59e0b'
                        : '#0284c7'
                const safeDomId = String(t.id).replace(/[^a-zA-Z0-9_-]/g, '_')
                const triggerId = `cr-act-btn-${safeDomId}`
                const menuId = `cr-act-menu-${safeDomId}`

                return (
                  <tr key={t.id} className={rowClass}>
                    <td
                      style={
                        {
                          '--label': 'Selecionar',
                          textAlign: 'center',
                          borderInlineStart: `3.5px solid ${stripeColor}`,
                        } as React.CSSProperties
                      }
                    >
                      <input
                        type="checkbox"
                        aria-label={`Selecionar título ${t._codigoDisplay || t.codigo || t.descricao}`}
                        checked={selectedIds.has(t.id)}
                        onChange={e => {
                          const next = new Set(selectedIds)
                          if (e.target.checked) next.add(t.id)
                          else next.delete(t.id)
                          setSelectedIds(next)
                        }}
                      />
                    </td>
                    <td style={{ '--label': 'Código' } as React.CSSProperties}>
                      <code
                        title={t.codigo || undefined}
                        style={{
                          fontSize: '0.6875rem',
                          background: 'hsl(var(--bg-overlay))',
                          padding: '3px 7px',
                          borderRadius: 6,
                          color: '#2563eb',
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t._codigoDisplay || t.codigo || String(t.id).slice(0, 8).toUpperCase()}
                      </code>
                    </td>
                    <th scope="row" style={{ minInlineSize: 160, maxInlineSize: 240 }}>
                      {t.aluno ? (
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'hsl(var(--text-primary))', lineHeight: 1.3 }}>
                            {t.aluno}
                          </div>
                          {t.responsavel && (
                            <div style={{ fontSize: '0.6875rem', color: 'hsl(var(--text-muted))', fontWeight: 500, marginBlockStart: 2 }}>
                              Resp: {t.responsavel}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                            {t.responsavel || 'Receita Avulsa'}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', fontWeight: 500 }}>Sem vínculo de aluno</div>
                        </div>
                      )}
                    </th>
                    <td style={{ '--label': 'Descrição', minInlineSize: 180, maxInlineSize: 280 } as React.CSSProperties}>
                      <div style={{ fontWeight: 600, color: 'hsl(var(--text-primary))', lineHeight: 1.35 }}>{t.descricao}</div>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBlockStart: 3 }}>
                        {t.centroCusto && (() => {
                          const ccMeta = todosCentrosCusto.find(c => c.id === t.centroCusto)
                          const ccCor = ccMeta?.cor || '#0284c7'
                          const ccSigla = ccMeta?.sigla || 'CC'
                          return (
                            <span
                              title={`Centro de Custo: ${t.centroCusto}`}
                              style={{
                                fontSize: '0.625rem',
                                padding: '1px 7px',
                                borderRadius: 20,
                                background: `${ccCor}18`,
                                color: ccCor,
                                border: `1px solid ${ccCor}40`,
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
                              fontSize: '0.625rem',
                              padding: '1px 7px',
                              borderRadius: 20,
                              background: 'rgba(99,102,241,0.1)',
                              color: '#4f46e5',
                              fontWeight: 700,
                            }}
                          >
                            {t.eventoDescricao}
                          </span>
                        )}
                        {(t.acordoId || t._isRenegociacao) && (
                          <span
                            title={t.acordoId ? `Acordo: ${t.acordoId}` : 'Título originado de renegociação'}
                            style={{
                              fontSize: '0.625rem',
                              padding: '1px 7px',
                              borderRadius: 20,
                              background: 'rgba(6,182,212,0.12)',
                              color: '#0891b2',
                              fontWeight: 700,
                            }}
                          >
                            {t._acordoShort ? `Renegociação • ${t._acordoShort}` : 'Renegociação'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ '--label': 'Vencimento' } as React.CSSProperties}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: isToday ? '#d97706' : undefined, whiteSpace: 'nowrap' }}>
                        {fmt(t.vencimento)}
                      </div>
                      {isToday && (
                        <div style={{ fontSize: '0.625rem', fontWeight: 800, color: '#d97706' }}>Vence Hoje!</div>
                      )}
                      {atr > 0 && (
                        <div
                          style={{
                            fontSize: '0.625rem',
                            fontWeight: 800,
                            color: atr > 90 ? '#7f1d1d' : atr > 60 ? '#dc2626' : atr > 30 ? '#ea580c' : '#d97706',
                          }}
                        >
                          {atr}d em atraso
                        </div>
                      )}
                      {t.status === 'pago' && t.pagamento && (
                        <div style={{ fontSize: '0.625rem', color: '#059669', fontWeight: 700 }}>
                          Pago {fmt(t.pagamento)}
                        </div>
                      )}
                    </td>
                    <td style={{ '--label': 'Parcela', textAlign: 'center' } as React.CSSProperties}>
                      <span
                        title={t._parcCodigo ? `Parcela ${parcLabelStr} (${t._parcCodigo})` : `Parcela ${parcLabelStr}`}
                        style={{
                          display: 'inline-flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 1,
                          padding: '2px 9px',
                          borderRadius: 10,
                          background: pBg,
                          border: `1px solid ${pColor}28`,
                          minInlineSize: 48,
                        }}
                      >
                        <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '0.75rem', color: pColor, lineHeight: 1.1 }}>
                          {parcLabelStr}
                        </span>
                        <span style={{ fontSize: '0.525rem', fontWeight: 700, color: pColor, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          {pSub}
                        </span>
                      </span>
                    </td>
                    <td style={{ '--label': 'Valor', textAlign: 'right', fontWeight: 900, fontSize: '0.875rem', color: sc.color, fontFamily: 'Outfit, sans-serif' } as React.CSSProperties}>
                      <div style={{ whiteSpace: 'nowrap' }}>{fmtCur(t.valor)}</div>
                      {atr > 0 && t.status === 'atrasado' && (
                        <div style={{ fontSize: '0.6rem', color: 'hsl(var(--text-muted))', fontWeight: 700, whiteSpace: 'nowrap' }} title="Valor atualizado com Multa 2% + Juros 1% a.m.">
                          c/ encargos: {fmtCur(calcularEncargosAtraso(t.valor, atr).total)}
                        </div>
                      )}
                    </td>
                    <td style={{ '--label': 'Método' } as React.CSSProperties}>
                      {t.metodo ? (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(99,102,241,0.1)',
                            color: '#4f46e5',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.metodo}
                        </span>
                      ) : (
                        <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.7rem' }}>—</span>
                      )}
                    </td>
                    <td style={{ '--label': 'Situação' } as React.CSSProperties}>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          padding: '3px 9px',
                          borderRadius: 99,
                          background: sc.bg,
                          color: sc.color,
                          fontWeight: 800,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ '--label': 'Ações', textAlign: 'right' } as React.CSSProperties}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
                        {t.status !== 'pago' ? (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '0.6875rem', padding: '4px 10px', gap: 4, background: '#059669' }}
                            onClick={() => openBaixa(t)}
                            title="Registrar recebimento / baixa"
                          >
                            <Check size={11} />Baixar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.6875rem', padding: '4px 9px', gap: 4 }}
                            onClick={() => setReceiptTarget([t])}
                            title="Emitir Recibo Oficial com QR Code"
                          >
                            <Printer size={11} />Recibo
                          </button>
                        )}
                        <button
                          id={triggerId}
                          type="button"
                          className="cr-action-trigger"
                          aria-label={`Mais ações para ${t.aluno || t.descricao || t.codigo}`}
                          aria-haspopup="menu"
                          aria-expanded="false"
                          {...({ commandfor: menuId, command: 'toggle-popover' } as any)}
                          title="Mais ações"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                        <div id={menuId} popover="auto" className="cr-action-popover">
                          <div {...({ focusgroup: 'menu nomemory' } as any)} aria-labelledby={triggerId}>
                            {t.status !== 'pago' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeMenuPopover(menuId)
                                    handleWhatsAppCobranca(t)
                                  }}
                                >
                                  <span className="cr-menu-icon" aria-hidden="true" style={{ color: '#059669' }}>
                                    <MessageCircle size={14} />
                                  </span>
                                  <span className="cr-menu-label">Cobrar via WhatsApp</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    closeMenuPopover(menuId)
                                    setReceiptTarget([t])
                                  }}
                                >
                                  <span className="cr-menu-icon" aria-hidden="true" style={{ color: '#2563eb' }}>
                                    <Printer size={14} />
                                  </span>
                                  <span className="cr-menu-label">Emitir Demonstrativo / 2ª Via</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  closeMenuPopover(menuId)
                                  handleReverter(t)
                                }}
                              >
                                <span className="cr-menu-icon" aria-hidden="true" style={{ color: '#d97706' }}>
                                  <RotateCcw size={14} />
                                </span>
                                <span className="cr-menu-label" style={{ color: '#d97706', fontWeight: 700 }}>
                                  Estornar / Reverter Baixa
                                </span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                closeMenuPopover(menuId)
                                openEdit(t)
                              }}
                            >
                              <span className="cr-menu-icon" aria-hidden="true">
                                <Pencil size={14} />
                              </span>
                              <span className="cr-menu-label">Editar Título</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                closeMenuPopover(menuId)
                                handleDuplicateNextMonth(t)
                              }}
                            >
                              <span className="cr-menu-icon" aria-hidden="true">
                                <Copy size={14} />
                              </span>
                              <span className="cr-menu-label">Duplicar p/ Próximo Mês</span>
                            </button>
                            <hr />
                            <button
                              type="button"
                              className="cr-menu-item-danger"
                              onClick={() => {
                                closeMenuPopover(menuId)
                                if (t.status === 'pago') {
                                  setAlertMsg("Não é possível excluir um título que já consta como PAGO. Clique em 'Estornar / Reverter Baixa' primeiro.")
                                } else {
                                  setConfirmId(t.id)
                                }
                              }}
                            >
                              <span className="cr-menu-icon" aria-hidden="true">
                                <Trash2 size={14} />
                              </span>
                              <span className="cr-menu-label">Excluir Título</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtered.length === 0 && titulos.length > 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: '0.8125rem' }}>
              Nenhum título encontrado para os filtros aplicados —{' '}
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                limpar filtros
              </button>
            </div>
          )}

          {/* Rodapé Consolidado da Tabela + Paginação */}
          <div
            style={{
              padding: '0.75rem 1rem',
              borderBlockStart: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-elevated))',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'safe center',
              flexWrap: 'wrap',
              gap: 10,
              fontSize: '0.75rem',
              color: 'hsl(var(--text-muted))',
            }}
          >
            <span>
              Exibindo <strong>{titulosLista.length}</strong> de <strong>{filtered.length}</strong> títulos filtrados (Carteira ativa: {titulos.length})
            </span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                Subtotal Filtrado: <strong style={{ color: '#059669' }}>{fmtCur(totalFiltrado)}</strong>
              </span>

              {totalPages > 1 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <span style={{ fontWeight: 700, color: 'hsl(var(--text-primary))', paddingInline: 6 }}>
                    Pág. {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal de Recibo Oficial (ReceiptModal) ─── */}
      {receiptTarget && (() => {
        const list = Array.isArray(receiptTarget) ? receiptTarget : [receiptTarget]
        if (list.length === 0) return null
        const first = list[0]
        const hasAnyAluno = list.some(x => Boolean(String(x.aluno || '').trim()))
        const uniqueAlunos = Array.from(new Set(list.map(x => x.aluno || x.responsavel || x.descricao || 'Pagador Diverso')))
        return (
          <ReceiptModal
            natureza="receber"
            turmaUnidade={(first as any).unidadeEmpresa || first.centroCusto || undefined}
            aluno={{
              nome: uniqueAlunos.length === 1 ? uniqueAlunos[0] : `${uniqueAlunos[0]} (+${uniqueAlunos.length - 1})`,
              responsavelFinanceiro: first.responsavel || first.aluno || first.descricao || 'Responsável / Pagador',
              codigo: hasAnyAluno ? first.codigo : undefined,
              unidade: (first as any).unidadeEmpresa || first.centroCusto || undefined,
              semVinculoAluno: !hasAnyAluno,
            }}
            parcelas={list.map((item, idx) => ({
              num: item._parcCur || idx + 1,
              parcelaLabel: item._parcDisplay || `${idx + 1}/${list.length}`,
              evento: item.descricao || 'Receita Escolar',
              competencia: (item.vencimento || '').slice(0, 7),
              vencimento: item.vencimento,
              valor: Number(item.valorOriginal || item.valor) || 0,
              desconto: Number(item.descontoConcedido) || 0,
              juros: Number(item.jurosPago) || 0,
              multa: Number(item.multaPaga) || 0,
              valorFinal: Number(item.valor) || 0,
              dtPagto: item.pagamento || today(),
              formaPagto: item.metodo || 'PIX',
              caixaOrigem: (item as any).caixaOrigem || item.caixaId || '',
              codBaixa: item.codigo || item.id,
              obs: item.obs,
              centroCusto: item.centroCusto,
              status: item.status === 'pago' ? 'pago' : 'pendente',
            } as ReceiptParcela))}
            onClose={() => setReceiptTarget(null)}
          />
        )
      })()}

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
                    type="text"
                    inputMode="numeric"
                    required
                    className="form-input"
                    style={{ fontWeight: 800, color: '#10b981', textAlign: 'right' }}
                    value={formatCurrencyInput(form.valor || '')}
                    onChange={e => set('valor', parseCurrencyNumeric(handleCurrencyInputChange(e.target.value)))}
                    placeholder="R$ 0,00"
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

                {/* Seleção Obrigatória de Caixa */}
                <div
                  style={{
                    padding: '10px 14px',
                    background: baixaForm.caixaId ? 'rgba(16,185,129,0.06)' : 'rgba(245,158,11,0.08)',
                    border: `1px solid ${baixaForm.caixaId ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.35)'}`,
                    borderRadius: 10,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  <div style={{ fontSize: 18 }}>🏦</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <label htmlFor="cr-baixa-caixa" style={{ fontSize: 10.5, fontWeight: 800, color: 'hsl(var(--text-muted))' }}>
                        CONTA / CAIXA DE DESTINO *
                      </label>
                      <Link
                        href="/configuracoes/financeiro/caixas"
                        style={{
                          fontSize: 10.5,
                          fontWeight: 800,
                          color: '#059669',
                          textDecoration: 'none',
                        }}
                      >
                        + Configurar Caixas
                      </Link>
                    </div>
                    <select
                      id="cr-baixa-caixa"
                      className="form-input"
                      required
                      style={{ fontSize: 12, fontWeight: 700, padding: '7px 10px' }}
                      value={baixaForm.caixaId}
                      onChange={e => setBaixaForm(p => ({ ...p, caixaId: e.target.value }))}
                    >
                      <option value="">
                        {caixasAbertos.length === 0
                          ? 'Nenhum caixa aberto cadastrado — clique em + Configurar Caixas'
                          : 'Selecione obrigatoriamente o caixa...'}
                      </option>
                      {caixasAbertos.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nomeCaixa} ({c.operador})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Método de Pagamento Único e Obrigatório */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="form-label" style={{ marginBottom: 0 }}>
                        Método de Recebimento * ({metodosAtivosObj.length} ativos)
                      </span>
                      {!baixaForm.metodo && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 800,
                            color: '#d97706',
                            background: 'rgba(245,158,11,0.12)',
                            border: '1px solid rgba(245,158,11,0.35)',
                            padding: '1px 7px',
                            borderRadius: 999,
                          }}
                        >
                          Obrigatório selecionar
                        </span>
                      )}
                    </div>
                    <Link
                      href="/configuracoes/financeiro/metodos-pagamento"
                      style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textDecoration: 'none' }}
                    >
                      + Configurar
                    </Link>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                    {metodosAtivosObj.map(m => (
                      <button
                        type="button"
                        key={m.id || m.nome}
                        onClick={() => setBaixaForm(p => ({ ...p, metodo: m.nome }))}
                        style={{
                          padding: '8px 6px',
                          borderRadius: 8,
                          border: `1.5px solid ${baixaForm.metodo === m.nome ? '#10b981' : 'hsl(var(--border-subtle))'}`,
                          background: baixaForm.metodo === m.nome ? 'rgba(16,185,129,0.12)' : 'transparent',
                          color: baixaForm.metodo === m.nome ? '#10b981' : 'hsl(var(--text-secondary))',
                          fontWeight: 700,
                          fontSize: 11.5,
                          cursor: 'pointer',
                        }}
                      >
                        {m.nome}
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
                      type="text"
                      inputMode="numeric"
                      className="form-input"
                      style={{ textAlign: 'right' }}
                      value={formatCurrencyInput(baixaForm.descontoPontualidade || '', false)}
                      placeholder="R$ 0,00"
                      onChange={e => {
                        const d = parseCurrencyNumeric(handleCurrencyInputChange(e.target.value, false))
                        const base = baixaForm.aplicarEncargos ? enc.total : Number(selectedTitulo.valor) || 0
                        setBaixaForm(p => ({ ...p, descontoPontualidade: d, valorPago: Math.max(0, +(base - d).toFixed(2)) }))
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="cr-baixa-val" className="form-label">Valor Recebido (R$)</label>
                    <input
                      id="cr-baixa-val"
                      type="text"
                      inputMode="numeric"
                      className="form-input"
                      style={{ fontWeight: 800, color: '#10b981', textAlign: 'right' }}
                      value={formatCurrencyInput(baixaForm.valorPago, false)}
                      onChange={e => setBaixaForm(p => ({ ...p, valorPago: parseCurrencyNumeric(handleCurrencyInputChange(e.target.value, false)) }))}
                      placeholder="R$ 0,00"
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

                <label
                  htmlFor="cr-baixa-emitir-recibo"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: baixaForm.emitirRecibo ? 'rgba(16,185,129,0.1)' : 'hsl(var(--bg-elevated))',
                    border: `1px solid ${baixaForm.emitirRecibo ? 'rgba(16,185,129,0.35)' : 'hsl(var(--border-subtle))'}`,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    id="cr-baixa-emitir-recibo"
                    type="checkbox"
                    checked={Boolean(baixaForm.emitirRecibo)}
                    onChange={e => setBaixaForm(p => ({ ...p, emitirRecibo: e.target.checked }))}
                    style={{ width: 15, height: 15, accentColor: '#10b981' }}
                  />
                  <Printer size={14} color="#10b981" />
                  <span style={{ fontSize: 12, fontWeight: 700 }}>
                    Emitir Recibo Oficial automaticamente após confirmar o recebimento
                  </span>
                </label>
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
                  disabled={saving || !baixaForm.caixaId || !baixaForm.metodo || !baixaForm.dataPagamento || baixaForm.valorPago <= 0}
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
              maxWidth: 520,
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
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <label htmlFor="lote-caixa" className="form-label" style={{ marginBottom: 0 }}>Caixa de Destino *</label>
                    <Link
                      href="/configuracoes/financeiro/caixas"
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        color: '#059669',
                        textDecoration: 'none',
                      }}
                    >
                      + Configurar
                    </Link>
                  </div>
                  <select id="lote-caixa" required className="form-input" value={baixaForm.caixaId} onChange={e => setBaixaForm(p => ({ ...p, caixaId: e.target.value }))}>
                    <option value="">
                      {caixasAbertos.length === 0
                        ? 'Nenhum caixa aberto — clique em + Configurar'
                        : 'Selecione obrigatoriamente o caixa...'}
                    </option>
                    {caixasAbertos.map(c => <option key={c.id} value={c.id}>{c.nomeCaixa}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="lote-data" className="form-label">Data do Recebimento *</label>
                  <input id="lote-data" required type="date" className="form-input" value={baixaForm.dataPagamento} onChange={e => setBaixaForm(p => ({ ...p, dataPagamento: e.target.value }))} />
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="form-label" style={{ marginBottom: 0 }}>Método de Pagamento *</span>
                  <Link
                    href="/configuracoes/financeiro/metodos-pagamento"
                    style={{ fontSize: 10.5, fontWeight: 700, color: '#10b981', textDecoration: 'none' }}
                  >
                    + Configurar
                  </Link>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {metodosAtivosObj.map(m => (
                    <button
                      key={m.id || m.nome}
                      type="button"
                      onClick={() => setBaixaForm(p => ({ ...p, metodo: m.nome }))}
                      style={{
                        padding: '6px 11px',
                        borderRadius: 8,
                        border: `1.5px solid ${baixaForm.metodo === m.nome ? '#10b981' : 'hsl(var(--border-subtle))'}`,
                        background: baixaForm.metodo === m.nome ? 'rgba(16,185,129,0.12)' : 'transparent',
                        color: baixaForm.metodo === m.nome ? '#10b981' : 'hsl(var(--text-secondary))',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {m.nome}
                    </button>
                  ))}
                </div>
              </div>
              <label
                htmlFor="lote-emitir-recibo"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: baixaForm.emitirRecibo ? 'rgba(16,185,129,0.1)' : 'hsl(var(--bg-elevated))',
                  border: `1px solid ${baixaForm.emitirRecibo ? 'rgba(16,185,129,0.35)' : 'hsl(var(--border-subtle))'}`,
                  cursor: 'pointer',
                }}
              >
                <input
                  id="lote-emitir-recibo"
                  type="checkbox"
                  checked={Boolean(baixaForm.emitirRecibo)}
                  onChange={e => setBaixaForm(p => ({ ...p, emitirRecibo: e.target.checked }))}
                  style={{ width: 15, height: 15, accentColor: '#10b981' }}
                />
                <Printer size={14} color="#10b981" />
                <span style={{ fontSize: 12, fontWeight: 700 }}>
                  Emitir Recibo Oficial Consolidado após confirmar a liquidação
                </span>
              </label>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" style={{ background: '#10b981' }} disabled={saving || !baixaForm.caixaId || !baixaForm.metodo}>
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
