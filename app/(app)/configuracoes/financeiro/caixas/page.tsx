'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  useFinanceiroData,
  useGlobalData,
  newId,
  ConfigCaixa,
  TipoCaixaConfig,
  TIPOS_CAIXA_PADRAO,
  SituacaoCaixaConfig,
  HistoricoCaixaConfigItem,
  isSimulatedCaixaRecord,
} from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import {
  calcularSaldosPorCaixaMap,
  getLocalISODate,
  isCaixaDoUsuario,
  isUsuarioAdministrador,
} from '@/app/(app)/financeiro/movimentacoes/types'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { apiFetch } from '@/lib/api/apiClient'
import { invalidateConfigCache } from '@/lib/useConfigDb'
import { toast } from 'sonner'
import {
  Plus,
  Edit2,
  Lock,
  Unlock,
  ShieldCheck,
  Info,
  Search,
  X,
  Check,
  Download,
  Upload,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Wallet,
  Building2,
  UserCheck,
  Calendar,
  Landmark,
  ArrowRightLeft,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Trash2,
  ExternalLink,
  RefreshCw,
  Filter,
  Eye,
  PenLine,
} from 'lucide-react'
import * as XLSX from 'xlsx'

const TIPOS_CAIXA: TipoCaixaConfig[] = [
  'Caixa – Movimento Diário',
  'Conta Corrente Bancária',
  'Conta Digital / PIX',
  'Caixa Fundo Fixo',
  'Cofre / Reserva',
  'Conta Poupança / Aplicação',
]

interface OperadorOption {
  id: string
  codigo: string
  nome: string
  label: string
  cargo?: string
  email?: string
}

function formatDateBR(isoOrBr?: string): string {
  if (!isoOrBr) return '—'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(isoOrBr)) return isoOrBr
  const match = isoOrBr.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  try {
    const d = new Date(isoOrBr)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('pt-BR')
    }
  } catch {}
  return isoOrBr
}

function formatDateTimeBR(iso?: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (!isNaN(d.getTime())) {
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    }
  } catch {}
  return formatDateBR(iso)
}

function brToIsoDate(val: string): string {
  if (!val) return new Date().toISOString().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val
  const parts = val.split('/')
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
  }
  return val
}

function formatBRL(val: number): string {
  return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type SortField =
  | 'codigo'
  | 'descricao'
  | 'dataAbertura'
  | 'agencia'
  | 'conta'
  | 'situacao'
  | 'abertoPor'
  | 'operador'
  | 'vistoriadoPor'
  | 'unidadeEmpresa'

export default function ConfigCaixasPage() {
  const {
    cfgCaixas: rawCaixas = [],
    setCfgCaixas,
    cfgPlanoContas = [],
    mantenedores = [],
  } = useFinanceiroData()
  const { logSystemAction } = useGlobalData()
  const { currentUser, currentUserPerfil } = useApp()
  const isAdmin = useMemo(
    () => isUsuarioAdministrador(currentUser, currentUserPerfil),
    [currentUser, currentUserPerfil]
  )
  const isMobile = useIsMobile()
  const isTablet = false
  const showToast = useCallback((msg: string, type?: 'success' | 'error') => {
    if (type === 'error') toast.error(msg)
    else toast.success(msg)
  }, [])

  // Estado real sincronizado diretamente com o banco de dados Supabase (`configuracoes`, chave `cfgCaixas`)
  const [dbCaixas, setDbCaixas] = useState<ConfigCaixa[] | null>(null)
  const [customTiposCaixa, setCustomTiposCaixa] = useState<string[]>([])
  const [dbSyncStatus, setDbSyncStatus] = useState<'loading' | 'synced' | 'saving' | 'error'>('loading')
  const [lastSavedAt, setLastSavedAt] = useState<string>('')

  // Filtra apenas caixas reais (remove qualquer registro simulado legado se houver)
  const cfgCaixas = useMemo<ConfigCaixa[]>(() => {
    const source = dbCaixas !== null ? dbCaixas : Array.isArray(rawCaixas) ? rawCaixas : []
    return source.filter(c => c && typeof c === 'object' && !isSimulatedCaixaRecord(c))
  }, [dbCaixas, rawCaixas])

  // Persistência garantida no banco de dados Supabase (/api/configuracoes)
  const persistCaixasToDb = useCallback(
    async (nextList: ConfigCaixa[], successToast?: string): Promise<boolean> => {
      const cleanList = nextList.filter(c => c && typeof c === 'object' && !isSimulatedCaixaRecord(c))
      setDbCaixas(cleanList)
      setCfgCaixas(cleanList)
      setDbSyncStatus('saving')
      try {
        const res = await apiFetch('/api/configuracoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chave: 'cfgCaixas', valor: cleanList }),
        })
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}))
          throw new Error(errJson?.error || `Falha HTTP ${res.status} ao gravar no banco de dados`)
        }
        invalidateConfigCache('cfgCaixas')
        setDbSyncStatus('synced')
        setLastSavedAt(
          new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        )
        if (successToast) {
          showToast(successToast)
        }
        return true
      } catch (err: any) {
        setDbSyncStatus('error')
        showToast(err?.message || 'Erro ao salvar no banco de dados.', 'error')
        return false
      }
    },
    [setCfgCaixas, showToast]
  )

  // Leitura direta do banco de dados para garantir 100% de fidelidade com o Supabase
  const syncCaixasFromDatabase = useCallback(async () => {
    setDbSyncStatus('loading')
    try {
      invalidateConfigCache('cfgCaixas')
      invalidateConfigCache('cfgTiposCaixa')
      const [res, tiposRes] = await Promise.all([
        apiFetch('/api/configuracoes?chave=cfgCaixas', { cache: 'no-store' }),
        apiFetch('/api/configuracoes?chave=cfgTiposCaixa', { cache: 'no-store' }).catch(() => null),
      ])
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const rawVal = Array.isArray(json?.valor) ? json.valor : []
      const realOnly = rawVal.filter((c: any) => c && typeof c === 'object' && !isSimulatedCaixaRecord(c))

      // Se havia registros simulados no banco, grava imediatamente a lista limpa no Supabase
      if (realOnly.length !== rawVal.length) {
        await apiFetch('/api/configuracoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chave: 'cfgCaixas', valor: realOnly }),
        })
      }

      if (tiposRes && tiposRes.ok) {
        const tJson = await tiposRes.json().catch(() => null)
        if (Array.isArray(tJson?.valor)) {
          setCustomTiposCaixa(
            tJson.valor.map((s: any) => String(s || '').trim()).filter(Boolean)
          )
        }
      }

      setDbCaixas(realOnly)
      setCfgCaixas(realOnly)
      setDbSyncStatus('synced')
      setLastSavedAt(
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      )
    } catch {
      setDbSyncStatus('error')
    }
  }, [setCfgCaixas])

  useEffect(() => {
    syncCaixasFromDatabase()
  }, [syncCaixasFromDatabase])

  // Identificação real do operador logado
  const currentOperatorDisplay = useMemo(() => {
    const rawName = (currentUser?.nome || '').trim()
    if (!rawName) return '11 - Ivan Rossi'
    if (/^\d+\s*-/.test(rawName)) return rawName
    if (rawName.toLowerCase().includes('ivan')) return `11 - ${rawName}`
    return rawName
  }, [currentUser])

  // Carregar operadores reais do sistema (/api/configuracoes/usuarios)
  const [operadoresSistema, setOperadoresSistema] = useState<OperadorOption[]>([])
  useEffect(() => {
    let active = true
    apiFetch('/api/configuracoes/usuarios?type=colaboradores&limit=1000')
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (!active || !json) return
        const lista = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : []
        const mapped: OperadorOption[] = lista
          .filter((u: any) => u && u.nome)
          .map((u: any, idx: number) => {
            const nomeLimpo = String(u.nome).trim()
            const isIvan = nomeLimpo.toLowerCase().includes('ivan rossi')
            const cod = isIvan ? '11' : String(u.codigo || idx + 1)
            const label = /^\d+\s*-/.test(nomeLimpo) ? nomeLimpo : `${cod} - ${nomeLimpo}`
            return {
              id: String(u.id || cod),
              codigo: cod,
              nome: nomeLimpo,
              label,
              cargo: u.cargo || u.perfil || '',
              email: u.email || '',
            }
          })
        setOperadoresSistema(mapped)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Lista unificada de operadores reais (usuários do banco + usuário logado + operadores vinculados a caixas reais)
  const allOperadores = useMemo<OperadorOption[]>(() => {
    const map = new Map<string, OperadorOption>()
    if (currentOperatorDisplay) {
      const parts = currentOperatorDisplay.split('-').map(s => s.trim())
      map.set(currentOperatorDisplay, {
        id: String((currentUser as any)?.id || parts[0] || 'OP-ATUAL'),
        codigo: parts.length > 1 ? parts[0] : '11',
        nome: parts.length > 1 ? parts.slice(1).join(' - ') : currentOperatorDisplay,
        label: currentOperatorDisplay,
        cargo: (currentUser as any)?.perfil || 'Administrador',
        email: currentUser?.email || '',
      })
    }
    operadoresSistema.forEach(op => {
      if (!map.has(op.label)) map.set(op.label, op)
    })
    cfgCaixas.forEach(cx => {
      if (cx.operador && !map.has(cx.operador)) {
        const parts = cx.operador.split('-').map(s => s.trim())
        map.set(cx.operador, {
          id: cx.operadorCodigo || cx.operador,
          codigo: parts.length > 1 ? parts[0] : '',
          nome: parts.length > 1 ? parts.slice(1).join(' - ') : cx.operador,
          label: cx.operador,
        })
      }
    })
    return Array.from(map.values())
  }, [currentOperatorDisplay, currentUser, operadoresSistema, cfgCaixas])

  // Carregar Unidades / Mantenedores reais do banco de dados (/configuracoes/unidades)
  const [mantenedoresApi, setMantenedoresApi] = useState<any[]>([])
  useEffect(() => {
    let active = true
    apiFetch('/api/configuracoes/mantenedores')
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (!active || !json) return
        const lista = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : []
        if (lista.length > 0) {
          setMantenedoresApi(lista)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [mantenedores])

  // Lista de Unidades / Empresas reais cadastradas em Multi-Unidades (Matriz + Unidades)
  const allUnidades = useMemo(() => {
    const sourceMant =
      Array.isArray(mantenedoresApi) && mantenedoresApi.length > 0
        ? mantenedoresApi
        : Array.isArray(mantenedores)
        ? mantenedores
        : []

    const list: {
      codigo: string
      label: string
      cnpj: string
      tipo: 'Matriz' | 'Unidade'
      nomeExibicao: string
      subtitulo?: string
    }[] = []

    sourceMant.forEach((m: any, mIdx: number) => {
      if (!m || typeof m !== 'object') return
      const nomeMatriz = String(m.nome || m.razaoSocial || m.razao_social || '').trim()
      const razaoMatriz = String(m.razaoSocial || m.razao_social || '').trim()
      const cnpjMatriz = String(m.cnpj || '').trim()

      // 1. Sempre incluir a própria MATRIZ (Mantenedor) para seleção
      if (nomeMatriz) {
        const codMatriz = String(m.codigo || (sourceMant.length > 1 ? `MATRIZ-${mIdx + 1}` : 'MATRIZ')).trim()
        const temRazaoDistinta =
          Boolean(razaoMatriz) && razaoMatriz.toLowerCase() !== nomeMatriz.toLowerCase()
        const labelMatriz = temRazaoDistinta
          ? `MATRIZ - ${nomeMatriz} (${razaoMatriz})`
          : `MATRIZ - ${nomeMatriz}`

        if (!list.some(item => item.label.toLowerCase() === labelMatriz.toLowerCase())) {
          list.push({
            codigo: codMatriz,
            label: labelMatriz,
            cnpj: cnpjMatriz,
            tipo: 'Matriz',
            nomeExibicao: `${nomeMatriz} (Matriz)`,
            subtitulo: razaoMatriz || (m.cidade ? `${m.cidade}/${m.estado || ''}` : 'Mantenedora Principal'),
          })
        }
      }

      // 2. Incluir todas as Unidades vinculadas dentro da Matriz
      const unidadesInternas = Array.isArray(m.unidades) ? m.unidades : []
      unidadesInternas.forEach((u: any, uIdx: number) => {
        if (!u || typeof u !== 'object') return
        const nomeFantasia = String(u.nomeFantasia || u.nome || '').trim()
        const razaoSocial = String(u.razaoSocial || u.razao_social || '').trim()
        const nomeBase = nomeFantasia || razaoSocial
        if (!nomeBase) return

        const cod = String(u.codigo || uIdx + 1).trim()
        const temAmbosDistintos =
          Boolean(nomeFantasia) &&
          Boolean(razaoSocial) &&
          nomeFantasia.toLowerCase() !== razaoSocial.toLowerCase()

        const descCompleta = temAmbosDistintos
          ? `${nomeFantasia} — ${razaoSocial}`
          : razaoSocial || nomeFantasia

        const label = `${cod} - ${descCompleta}`
        if (!list.some(item => item.label.toLowerCase() === label.toLowerCase())) {
          list.push({
            codigo: cod,
            label,
            cnpj: String(u.cnpj || cnpjMatriz || '').trim(),
            tipo: 'Unidade',
            nomeExibicao: `${cod} - ${nomeFantasia || razaoSocial}`,
            subtitulo: razaoSocial || nomeFantasia,
          })
        }
      })
    })

    return list
  }, [mantenedores, mantenedoresApi])

  // Movimentações financeiras reais vinculadas aos caixas via motor unificado `/api/financeiro/movimentacoes`
  const [movimentacoesPayload, setMovimentacoesPayload] = useState<{
    movimentacoesManuais: any[]
    overrides: Record<string, any>
    contasPagarPagas: any[]
    titulosPagos: any[]
    planoContas: any[]
    centrosCusto: any[]
  }>({
    movimentacoesManuais: [],
    overrides: {},
    contasPagarPagas: [],
    titulosPagos: [],
    planoContas: [],
    centrosCusto: [],
  })
  const [loadingMovimentos, setLoadingMovimentos] = useState(false)

  const fetchMovimentosReais = useCallback(async () => {
    setLoadingMovimentos(true)
    try {
      const movRes = await apiFetch('/api/financeiro/movimentacoes', { cache: 'no-store' }).catch(() => null)
      if (movRes && movRes.ok) {
        const movJson = await movRes.json().catch(() => null)
        if (movJson?.ok) {
          setMovimentacoesPayload({
            movimentacoesManuais: Array.isArray(movJson.movimentacoesManuais) ? movJson.movimentacoesManuais : [],
            overrides: movJson.overrides && typeof movJson.overrides === 'object' ? movJson.overrides : {},
            contasPagarPagas: Array.isArray(movJson.contasPagarPagas) ? movJson.contasPagarPagas : [],
            titulosPagos: Array.isArray(movJson.titulosPagos) ? movJson.titulosPagos : [],
            planoContas: Array.isArray(movJson.planoContas) ? movJson.planoContas : [],
            centrosCusto: Array.isArray(movJson.centrosCusto) ? movJson.centrosCusto : [],
          })
        }
      }
    } catch {
      // ignora erro silencioso de rede
    } finally {
      setLoadingMovimentos(false)
    }
  }, [])

  useEffect(() => {
    fetchMovimentosReais()
  }, [fetchMovimentosReais])

  // Mapa unificado de saldos, entradas, saídas e lançamentos de todos os caixas (idêntico a /financeiro/movimentacoes)
  const saldosPorCaixaMap = useMemo(
    () =>
      calcularSaldosPorCaixaMap({
        allCaixas: cfgCaixas,
        movimentacoesManuais: movimentacoesPayload.movimentacoesManuais,
        overrides: movimentacoesPayload.overrides,
        contasPagarPagas: movimentacoesPayload.contasPagarPagas,
        titulosPagos: movimentacoesPayload.titulosPagos,
        planoContas:
          movimentacoesPayload.planoContas.length > 0 ? movimentacoesPayload.planoContas : cfgPlanoContas,
        centrosCusto: movimentacoesPayload.centrosCusto,
      }),
    [cfgCaixas, movimentacoesPayload, cfgPlanoContas]
  )

  // Helper para obter métricas financeiras reais de um caixa específico (100% sincronizado com o Livro Caixa)
  const getCaixaMetrics = useCallback(
    (cx: ConfigCaixa) => {
      const resumo = saldosPorCaixaMap[cx.id] || (cx.codigo ? saldosPorCaixaMap[cx.codigo] : undefined)
      if (resumo) {
        return {
          saldoInicial: resumo.saldoInicial,
          entradas: resumo.totalEntradas,
          totalSaidas: resumo.totalSaidas,
          saldoAtual: resumo.saldoAtual,
          qtdEntradas: resumo.qtdEntradas,
          qtdSaidas: resumo.qtdSaidas,
          qtdPagamentos: resumo.qtdLancamentos,
          ultimos: resumo.ultimosLancamentos.slice(0, 10).map(item => ({
            id: item.id,
            codigoLcto: item.codigoLcto,
            tipo: item.tipoOperacao === 'Recebimento' ? 'entrada' : 'saida',
            fornecedor: item.fornecedorNome || item.descricao || 'Movimentação',
            descricao: item.descricao,
            documento: item.numeroDocumento || String(item.codigoLcto || ''),
            valor: item.valorLiquido,
            saldoApos: item.saldoAposLancamento,
            data: item.dataLcto,
            forma: item.tipoRecurso || 'PIX',
            usuario: item.operador || '',
          })),
        }
      }

      const saldoInicial = Number(cx.saldoInicial || 0)
      return {
        saldoInicial,
        entradas: 0,
        totalSaidas: 0,
        saldoAtual: saldoInicial,
        qtdEntradas: 0,
        qtdSaidas: 0,
        qtdPagamentos: 0,
        ultimos: [],
      }
    },
    [saldosPorCaixaMap]
  )

  // ── Estados de Filtro, Ordenação, Paginação e Seleção (Imagem 2) ──────────
  const [somenteMeusCaixas, setSomenteMeusCaixas] = useState<boolean>(false)
  const [filtroOperador, setFiltroOperador] = useState<string>('')
  const [filtroSituacao, setFiltroSituacao] = useState<string>('Aberto')
  const [search, setSearch] = useState<string>('')
  const [pageSize, setPageSize] = useState<number>(10)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [sortField, setSortField] = useState<SortField>('codigo')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedCaixaId, setSelectedCaixaId] = useState<string | null>(null)
  const [showDidacticGuide, setShowDidacticGuide] = useState<boolean>(false)

  // Verifica estritamente se o caixa foi designado ao usuário logado (`cx.operador`)
  const isMeuCaixa = useCallback(
    (cx: ConfigCaixa) => {
      return isCaixaDoUsuario(cx, currentUser)
    },
    [currentUser]
  )

  // Filtragem e Ordenação (Somente Administrador visualiza todos os caixas; demais usuários veem apenas os seus)
  const filteredCaixas = useMemo(() => {
    const q = search.trim().toLowerCase()

    const list = cfgCaixas.filter(cx => {
      if ((!isAdmin || somenteMeusCaixas) && !isMeuCaixa(cx)) return false
      if (filtroOperador && cx.operador !== filtroOperador) return false
      if (filtroSituacao !== 'Todos' && cx.situacao !== filtroSituacao) return false

      if (q) {
        const hay = [
          cx.codigo,
          cx.descricao,
          formatDateBR(cx.dataAbertura),
          cx.agencia,
          cx.conta,
          cx.situacao,
          cx.abertoPor,
          cx.operador,
          cx.vistoriadoPor,
          cx.unidadeEmpresa,
          cx.tipoCaixa,
          cx.contaPlanoLabel,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })

    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortField === 'codigo') {
        const na = parseInt(a.codigo, 10)
        const nb = parseInt(b.codigo, 10)
        if (!isNaN(na) && !isNaN(nb)) cmp = na - nb
        else cmp = String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true })
      } else if (sortField === 'dataAbertura') {
        cmp = String(a.dataAbertura || '').localeCompare(String(b.dataAbertura || ''))
      } else {
        const va = String((a as any)[sortField] || '').toLowerCase()
        const vb = String((b as any)[sortField] || '').toLowerCase()
        cmp = va.localeCompare(vb, 'pt-BR', { numeric: true })
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [cfgCaixas, somenteMeusCaixas, isMeuCaixa, filtroOperador, filtroSituacao, search, sortField, sortDir])

  // Reset página ao mudar filtros
  useEffect(() => {
    setCurrentPage(1)
  }, [somenteMeusCaixas, filtroOperador, filtroSituacao, search, pageSize])

  // Garantir seleção válida
  const selectedCaixa = useMemo(
    () => cfgCaixas.find(c => c.id === selectedCaixaId) || null,
    [cfgCaixas, selectedCaixaId]
  )

  // Paginação
  const totalRecords = filteredCaixas.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const startIdx = (safePage - 1) * pageSize
  const paginatedCaixas = filteredCaixas.slice(startIdx, startIdx + pageSize)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'codigo' ? 'desc' : 'asc')
    }
  }

  // KPIs Globais
  const kpis = useMemo(() => {
    const abertos = cfgCaixas.filter(c => c.situacao === 'Aberto').length
    const fechados = cfgCaixas.filter(c => c.situacao === 'Fechado').length
    const vistoriados = cfgCaixas.filter(c => c.situacao === 'Vistoriado').length
    const aceitamBaixaOutros = cfgCaixas.filter(
      c => c.situacao === 'Aberto' && c.aceitaBaixaContasPagarOutroUsuario
    ).length
    const saldoConsolidado =
      Math.round(cfgCaixas.reduce((acc, cx) => acc + getCaixaMetrics(cx).saldoAtual, 0) * 100) / 100
    return {
      total: cfgCaixas.length,
      abertos,
      fechados,
      vistoriados,
      aceitamBaixaOutros,
      saldoConsolidado,
    }
  }, [cfgCaixas, getCaixaMetrics])

  // Próximo código gerado automaticamente (maior código numérico + 1)
  const nextSuggestedCode = useMemo(() => {
    const maxNum = cfgCaixas.reduce((max, c) => {
      const n = parseInt(c.codigo, 10)
      return !isNaN(n) && n > max ? n : max
    }, 0)
    return String(maxNum + 1)
  }, [cfgCaixas])

  // Lista completa de Tipos de Caixa (Padrão + Criados pelo usuário no banco + Usados em caixas existentes)
  const todosTiposCaixa = useMemo<string[]>(() => {
    const set = new Set<string>(TIPOS_CAIXA_PADRAO)
    customTiposCaixa.forEach(t => {
      const clean = String(t || '').trim()
      if (clean) set.add(clean)
    })
    cfgCaixas.forEach(c => {
      const clean = String(c.tipoCaixa || '').trim()
      if (clean) set.add(clean)
    })
    return Array.from(set)
  }, [customTiposCaixa, cfgCaixas])

  // ── Estados do Modal Cadastrar / Editar Caixa (Imagem 3) ──────────────────
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCaixa, setEditingCaixa] = useState<ConfigCaixa | null>(null)
  const [formCodigo, setFormCodigo] = useState('1')
  const [formDataAbertura, setFormDataAbertura] = useState(() => getLocalISODate())
  const [formDescricao, setFormDescricao] = useState('')
  const [formTipoCaixa, setFormTipoCaixa] = useState<TipoCaixaConfig>('Caixa – Movimento Diário')
  const [formOperador, setFormOperador] = useState('11 - Ivan Rossi')
  const [formContaPlanoId, setFormContaPlanoId] = useState('')
  const [formContaPlanoLabel, setFormContaPlanoLabel] = useState('')
  const [formUnidadeEmpresa, setFormUnidadeEmpresa] = useState('')
  const [formAgencia, setFormAgencia] = useState('')
  const [formConta, setFormConta] = useState('')
  const [formBanco, setFormBanco] = useState('')
  const [formSaldoInicial, setFormSaldoInicial] = useState('0')
  const [formAceitaTransferencia, setFormAceitaTransferencia] = useState<'Não' | 'Sim'>('Não')
  const [formAceitaBaixaOutroUsuario, setFormAceitaBaixaOutroUsuario] = useState<'Não' | 'Sim'>('Não')
  const [formObservacoes, setFormObservacoes] = useState('')
  const [formError, setFormError] = useState('')

  // Criação de novo Tipo de Caixa dentro do próprio modal
  const [showNovoTipoInput, setShowNovoTipoInput] = useState(false)
  const [novoTipoNome, setNovoTipoNome] = useState('')
  const [savingNovoTipo, setSavingNovoTipo] = useState(false)

  // Mantém o código sempre sincronizado automaticamente ao criar novo caixa
  useEffect(() => {
    if (modalOpen && !editingCaixa) {
      setFormCodigo(nextSuggestedCode)
    }
  }, [modalOpen, editingCaixa, nextSuggestedCode])

  const handleCriarNovoTipoCaixa = async () => {
    const nomeLimpo = novoTipoNome.trim()
    if (!nomeLimpo) {
      showToast('Digite o nome do novo Tipo de Caixa.', 'error')
      return
    }
    const jaExiste = todosTiposCaixa.find(t => t.toLowerCase() === nomeLimpo.toLowerCase())
    if (jaExiste) {
      setFormTipoCaixa(jaExiste)
      setNovoTipoNome('')
      setShowNovoTipoInput(false)
      showToast(`Tipo "${jaExiste}" selecionado!`)
      return
    }

    setSavingNovoTipo(true)
    const nextCustom = [...customTiposCaixa, nomeLimpo]
    setCustomTiposCaixa(nextCustom)
    setFormTipoCaixa(nomeLimpo)
    setNovoTipoNome('')
    setShowNovoTipoInput(false)

    try {
      const res = await apiFetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'cfgTiposCaixa', valor: nextCustom }),
      })
      if (!res.ok) throw new Error('Falha ao salvar tipo de caixa')
      invalidateConfigCache('cfgTiposCaixa')
      showToast(`Novo tipo de caixa "${nomeLimpo}" criado e salvo no banco de dados!`)
    } catch {
      showToast('Erro ao salvar novo tipo no banco de dados.', 'error')
    } finally {
      setSavingNovoTipo(false)
    }
  }

  const handleRemoverTipoCustom = async (tipoParaRemover: string) => {
    const nextCustom = customTiposCaixa.filter(t => t !== tipoParaRemover)
    setCustomTiposCaixa(nextCustom)
    if (formTipoCaixa === tipoParaRemover) {
      setFormTipoCaixa('Caixa – Movimento Diário')
    }
    try {
      await apiFetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'cfgTiposCaixa', valor: nextCustom }),
      })
      invalidateConfigCache('cfgTiposCaixa')
      showToast(`Tipo "${tipoParaRemover}" removido.`)
    } catch {}
  }

  // Sub-seletor de Conta Plano e Unidade dentro do modal
  const [showPlanoPicker, setShowPlanoPicker] = useState(false)
  const [planoSearch, setPlanoSearch] = useState('')
  const [showUnidadePicker, setShowUnidadePicker] = useState(false)

  // ── Estados de Modais de Operação (Info, Fechar/Reabrir/Vistoriar, Transferir) ──
  const [infoCaixa, setInfoCaixa] = useState<ConfigCaixa | null>(null)
  const [statusActionModal, setStatusActionModal] = useState<{
    caixa: ConfigCaixa
    action: 'fechar' | 'reabrir' | 'vistoriar'
  } | null>(null)
  const [statusActionObs, setStatusActionObs] = useState('')

  const [transferModalOpen, setTransferModalOpen] = useState(false)
  const [transferOrigemId, setTransferOrigemId] = useState('')
  const [transferDestinoId, setTransferDestinoId] = useState('')
  const [transferValor, setTransferValor] = useState('')
  const [transferObs, setTransferObs] = useState('')

  // Abrir Modal "+ Novo" (idêntico à Imagem 3)
  const openCreateModal = () => {
    setEditingCaixa(null)
    setFormCodigo(nextSuggestedCode)
    setFormDataAbertura(new Date().toISOString().slice(0, 10))
    setFormDescricao('')
    setFormTipoCaixa('Caixa – Movimento Diário')
    setFormOperador(currentOperatorDisplay || '11 - Ivan Rossi')
    setFormContaPlanoId('')
    setFormContaPlanoLabel('')
    setFormUnidadeEmpresa('')
    setFormAgencia('')
    setFormConta('')
    setFormBanco('')
    setFormSaldoInicial('0')
    setFormAceitaTransferencia('Não')
    setFormAceitaBaixaOutroUsuario('Não')
    setFormObservacoes('')
    setFormError('')
    setShowNovoTipoInput(false)
    setNovoTipoNome('')
    setShowPlanoPicker(false)
    setShowUnidadePicker(false)
    setModalOpen(true)
  }

  // Abrir Modal "Editar"
  const openEditModal = (caixaTarget?: ConfigCaixa | null) => {
    const target = caixaTarget || selectedCaixa
    if (!target) {
      showToast('Selecione um caixa na tabela para editar.', 'error')
      return
    }
    setEditingCaixa(target)
    setFormCodigo(target.codigo)
    setFormDataAbertura(brToIsoDate(target.dataAbertura))
    setFormDescricao(target.descricao)
    setFormTipoCaixa(target.tipoCaixa || 'Caixa – Movimento Diário')
    setFormOperador(target.operador || currentOperatorDisplay)
    setFormContaPlanoId(target.contaPlanoId || '')
    setFormContaPlanoLabel(target.contaPlanoLabel || '')
    setFormUnidadeEmpresa(target.unidadeEmpresa || '')
    setFormAgencia(target.agencia || '')
    setFormConta(target.conta || '')
    setFormBanco(target.banco || '')
    setFormSaldoInicial(String(target.saldoInicial ?? 0))
    setFormAceitaTransferencia(target.aceitaTransferenciaOutrosCaixas ? 'Sim' : 'Não')
    setFormAceitaBaixaOutroUsuario(target.aceitaBaixaContasPagarOutroUsuario ? 'Sim' : 'Não')
    setFormObservacoes(target.observacoes || '')
    setFormError('')
    setShowNovoTipoInput(false)
    setNovoTipoNome('')
    setShowPlanoPicker(false)
    setShowUnidadePicker(false)
    setModalOpen(true)
  }

  // Gravar Caixa (Novo ou Edição) diretamente no banco de dados Supabase
  const handleSaveCaixa = async (e: React.FormEvent) => {
    e.preventDefault()
    const descTrim = formDescricao.trim()
    if (!descTrim) {
      setFormError('Informe a Descrição do caixa (ex: IVAN-2026 ou CAIXA SECRETARIA).')
      return
    }
    if (!formOperador.trim()) {
      setFormError('Selecione um Operador responsável pelo caixa.')
      return
    }
    if (!formUnidadeEmpresa.trim()) {
      setFormError('Selecione a Unidade/Empresa vinculada ao caixa.')
      return
    }

    const resolvedCode =
      !formCodigo.trim() || formCodigo.trim() === '0' ? nextSuggestedCode : formCodigo.trim()

    // Verificar duplicidade de código
    const duplicateCode = cfgCaixas.find(
      c => c.codigo === resolvedCode && (!editingCaixa || c.id !== editingCaixa.id)
    )
    if (duplicateCode) {
      setFormError(
        `Já existe o caixa "${duplicateCode.codigo} - ${duplicateCode.descricao}" com este código.`
      )
      return
    }

    const opParts = formOperador.split('-').map(s => s.trim())
    const opCodigo = opParts.length > 1 ? opParts[0] : ''
    const unParts = formUnidadeEmpresa.split('-').map(s => s.trim())
    const unCodigo = unParts.length > 1 ? unParts[0] : '1'
    const parsedSaldoInicial = parseFloat(String(formSaldoInicial).replace(',', '.')) || 0
    const nowIso = new Date().toISOString()

    if (editingCaixa) {
      const histItem: HistoricoCaixaConfigItem = {
        id: newId('HCX'),
        dataHora: nowIso,
        acao: 'Edição',
        usuario: currentOperatorDisplay,
        observacao: `Dados do caixa atualizados (${descTrim}).`,
      }

      const updated: ConfigCaixa = {
        ...editingCaixa,
        codigo: resolvedCode,
        descricao: descTrim,
        dataAbertura: formDataAbertura,
        tipoCaixa: formTipoCaixa,
        operador: formOperador.trim(),
        operadorCodigo: opCodigo,
        contaPlanoId: formContaPlanoId || undefined,
        contaPlanoLabel: formContaPlanoLabel || undefined,
        unidadeEmpresa: formUnidadeEmpresa.trim(),
        unidadeId: unCodigo,
        agencia: formAgencia.trim(),
        conta: formConta.trim(),
        banco: formBanco.trim() || undefined,
        saldoInicial: parsedSaldoInicial,
        aceitaTransferenciaOutrosCaixas: formAceitaTransferencia === 'Sim',
        aceitaBaixaContasPagarOutroUsuario: formAceitaBaixaOutroUsuario === 'Sim',
        observacoes: formObservacoes.trim() || undefined,
        updatedAt: nowIso,
        historico: [histItem, ...(editingCaixa.historico || [])],
      }

      const nextList = cfgCaixas.map(item => (item.id === editingCaixa.id ? updated : item))
      const saved = await persistCaixasToDb(
        nextList,
        `Caixa "${updated.codigo} - ${updated.descricao}" salvo no banco de dados!`
      )
      if (!saved) return

      logSystemAction(
        'Config. Financeiro',
        'Edição de Caixa',
        `Caixa ${updated.codigo} - ${updated.descricao} atualizado por ${currentOperatorDisplay}`
      )
    } else {
      const novoCaixa: ConfigCaixa = {
        id: `CX-${resolvedCode}-${Date.now().toString(36).toUpperCase()}`,
        codigo: resolvedCode,
        descricao: descTrim,
        dataAbertura: formDataAbertura,
        tipoCaixa: formTipoCaixa,
        agencia: formAgencia.trim(),
        conta: formConta.trim(),
        banco: formBanco.trim() || undefined,
        situacao: 'Aberto',
        abertoPor: currentOperatorDisplay,
        operador: formOperador.trim(),
        operadorCodigo: opCodigo,
        vistoriadoPor: '',
        unidadeEmpresa: formUnidadeEmpresa.trim(),
        unidadeId: unCodigo,
        contaPlanoId: formContaPlanoId || undefined,
        contaPlanoLabel: formContaPlanoLabel || undefined,
        aceitaTransferenciaOutrosCaixas: formAceitaTransferencia === 'Sim',
        aceitaBaixaContasPagarOutroUsuario: formAceitaBaixaOutroUsuario === 'Sim',
        saldoInicial: parsedSaldoInicial,
        totalEntradas: 0,
        totalSaidas: 0,
        observacoes: formObservacoes.trim() || undefined,
        historico: [
          {
            id: newId('HCX'),
            dataHora: nowIso,
            acao: 'Abertura',
            usuario: currentOperatorDisplay,
            observacao: `Caixa aberto com saldo inicial de ${formatBRL(parsedSaldoInicial)}.`,
          },
        ],
        createdAt: nowIso,
      }

      const nextList = [novoCaixa, ...cfgCaixas]
      const saved = await persistCaixasToDb(
        nextList,
        `Caixa "${novoCaixa.codigo} - ${novoCaixa.descricao}" criado e salvo no banco de dados!`
      )
      if (!saved) return

      setSelectedCaixaId(novoCaixa.id)
      if (filtroSituacao !== 'Aberto' && filtroSituacao !== 'Todos') {
        setFiltroSituacao('Aberto')
      }
      logSystemAction(
        'Config. Financeiro',
        'Abertura de Caixa',
        `Novo caixa ${novoCaixa.codigo} - ${novoCaixa.descricao} aberto por ${currentOperatorDisplay}`
      )
    }

    setModalOpen(false)
  }

  // Iniciar ação de Fechar / Reabrir / Vistoriar
  const triggerStatusAction = (
    action: 'fechar' | 'reabrir' | 'vistoriar',
    targetOverride?: ConfigCaixa
  ) => {
    const target = targetOverride || selectedCaixa
    if (!target) {
      showToast('Selecione um caixa na tabela para executar esta ação.', 'error')
      return
    }
    if (action === 'fechar' && target.situacao === 'Fechado') {
      showToast(`O caixa "${target.codigo} - ${target.descricao}" já está Fechado.`, 'error')
      return
    }
    if (action === 'reabrir' && target.situacao === 'Aberto') {
      showToast(`O caixa "${target.codigo} - ${target.descricao}" já encontra-se Aberto.`, 'error')
      return
    }
    setStatusActionObs('')
    setStatusActionModal({ caixa: target, action })
  }

  // Confirmar Fechar / Reabrir / Vistoriar e salvar no banco de dados
  const confirmStatusAction = async () => {
    if (!statusActionModal) return
    const { caixa, action } = statusActionModal
    const nowIso = new Date().toISOString()

    const metrics = getCaixaMetrics(caixa)
    if (action === 'fechar' && Math.abs(metrics.saldoAtual) >= 0.01) {
      showToast(
        `O caixa "${caixa.codigo} - ${caixa.descricao}" possui saldo de ${formatBRL(metrics.saldoAtual)}. Só é permitido fechar o caixa quando o saldo estiver zerado (R$ 0,00).`,
        'error'
      )
      return
    }

    let novaSituacao: SituacaoCaixaConfig = caixa.situacao
    let acaoHist: HistoricoCaixaConfigItem['acao'] = 'Edição'
    let labelAcao = ''

    if (action === 'fechar') {
      novaSituacao = 'Fechado'
      acaoHist = 'Fechamento'
      labelAcao = 'fechado'
    } else if (action === 'reabrir') {
      novaSituacao = 'Aberto'
      acaoHist = 'Reabertura'
      labelAcao = 'reaberto'
    } else if (action === 'vistoriar') {
      novaSituacao = 'Vistoriado'
      acaoHist = 'Vistoria'
      labelAcao = 'vistoriado'
    }

    const defaultObs =
      action === 'fechar'
        ? `Caixa fechado com saldo zerado (${formatBRL(0)}).`
        : action === 'reabrir'
        ? `Caixa reaberto para movimentações por ${currentOperatorDisplay}.`
        : `Caixa vistoriado e conferido por ${currentOperatorDisplay}. Saldo conferido: ${formatBRL(metrics.saldoAtual)}.`

    const resolvedObs = statusActionObs.trim() || defaultObs
    const novoHist: HistoricoCaixaConfigItem & { detalhes?: string } = {
      id: newId('HCX'),
      dataHora: nowIso,
      acao: acaoHist,
      usuario: currentOperatorDisplay,
      observacao: resolvedObs,
      detalhes: resolvedObs,
    }

    const updated: ConfigCaixa = {
      ...caixa,
      situacao: novaSituacao,
      abertoPor: action === 'reabrir' ? currentOperatorDisplay : caixa.abertoPor,
      dataFechamento: action === 'fechar' ? nowIso : caixa.dataFechamento,
      vistoriadoPor: action === 'vistoriar' ? currentOperatorDisplay : caixa.vistoriadoPor,
      dataVistoria: action === 'vistoriar' ? nowIso : caixa.dataVistoria,
      updatedAt: nowIso,
      historico: [novoHist, ...(caixa.historico || [])],
    }

    const nextList = cfgCaixas.map(c => (c.id === caixa.id ? updated : c))
    const saved = await persistCaixasToDb(
      nextList,
      `Caixa "${caixa.codigo} - ${caixa.descricao}" ${labelAcao} e salvo no banco de dados!`
    )
    if (!saved) return

    if (infoCaixa?.id === caixa.id) {
      setInfoCaixa(updated)
    }

    logSystemAction(
      'Config. Financeiro',
      `${acaoHist} de Caixa`,
      `Caixa ${caixa.codigo} - ${caixa.descricao} ${labelAcao} por ${currentOperatorDisplay}`
    )
    setStatusActionModal(null)
  }

  // Transferência entre Caixas persistida no banco de dados e no Livro Caixa
  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    const origem = cfgCaixas.find(c => c.id === transferOrigemId)
    const destino = cfgCaixas.find(c => c.id === transferDestinoId)
    const val = Math.round((parseFloat(String(transferValor).replace(',', '.')) || 0) * 100) / 100

    if (!origem || !destino) {
      showToast('Selecione o caixa de origem e o caixa de destino.', 'error')
      return
    }
    if (origem.id === destino.id) {
      showToast('O caixa de destino deve ser diferente do caixa de origem.', 'error')
      return
    }
    if (origem.situacao !== 'Aberto' || destino.situacao !== 'Aberto') {
      showToast('Ambos os caixas precisam estar com situação "Aberto" para transferir.', 'error')
      return
    }
    if (!destino.aceitaTransferenciaOutrosCaixas) {
      showToast(
        `O caixa destino "${destino.codigo} - ${destino.descricao}" está configurado como "Aceita transferências de outros caixas: Não". Edite o caixa para habilitar.`,
        'error'
      )
      return
    }
    if (val <= 0) {
      showToast('Informe um valor positivo maior que R$ 0,00.', 'error')
      return
    }

    const metricsOrigem = getCaixaMetrics(origem)
    if (metricsOrigem.saldoAtual <= 0) {
      showToast(
        `O caixa de origem "${origem.codigo} - ${origem.descricao}" não possui saldo positivo disponível (${formatBRL(metricsOrigem.saldoAtual)}). Só é possível transferir saldo positivo.`,
        'error'
      )
      return
    }
    if (val > metricsOrigem.saldoAtual + 0.009) {
      showToast(
        `O valor informado (${formatBRL(val)}) excede o saldo positivo disponível no caixa de origem (${formatBRL(metricsOrigem.saldoAtual)}).`,
        'error'
      )
      return
    }

    try {
      const res = await apiFetch('/api/financeiro/movimentacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'transferir_valores',
          caixaOrigemId: origem.id,
          caixaOrigemCodigo: origem.codigo,
          caixaOrigemDescricao: origem.descricao,
          caixaDestinoId: destino.id,
          caixaDestinoCodigo: destino.codigo,
          caixaDestinoDescricao: destino.descricao,
          valor: val,
          saldoOrigemAtual: metricsOrigem.saldoAtual,
          dataTransferencia: getLocalISODate(),
          dataLcto: getLocalISODate(),
          tipoRecurso: 'Transferência / TED',
          observacao: transferObs.trim(),
          operador: currentOperatorDisplay,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) {
        showToast(json?.error || 'Não foi possível realizar a transferência.', 'error')
        return
      }
      if (Array.isArray(json.caixas)) {
        const cleanCaixas = json.caixas.filter((c: any) => c && typeof c === 'object' && !isSimulatedCaixaRecord(c))
        setDbCaixas(cleanCaixas)
        setCfgCaixas(cleanCaixas)
        if (infoCaixa) {
          const updatedInfo = cleanCaixas.find((c: any) => c.id === infoCaixa.id)
          if (updatedInfo) setInfoCaixa(updatedInfo)
        }
      }
      await fetchMovimentosReais()
      showToast(
        `Transferência de ${formatBRL(val)} de "${origem.descricao}" para "${destino.descricao}" realizada com sucesso!`,
        'success'
      )
      logSystemAction(
        'Config. Financeiro',
        'Transferência entre Caixas',
        `Transferência de ${formatBRL(val)} do caixa ${origem.codigo} para ${destino.codigo}`
      )
      setTransferModalOpen(false)
      setTransferValor('')
      setTransferObs('')
    } catch {
      showToast('Erro de conexão ao registrar transferência.', 'error')
    }
  }

  // Excluir caixa do banco de dados (somente se não tiver pagamentos reais vinculados)
  const handleDeleteCaixa = async (cx: ConfigCaixa) => {
    const metrics = getCaixaMetrics(cx)
    if (metrics.qtdPagamentos > 0) {
      showToast(
        `Não é possível excluir um caixa que possui ${metrics.qtdPagamentos} baixa(s) financeira(s) vinculada(s). Utilize "Fechar Caixa".`,
        'error'
      )
      return
    }
    const nextList = cfgCaixas.filter(item => item.id !== cx.id)
    const saved = await persistCaixasToDb(
      nextList,
      `Caixa "${cx.codigo} - ${cx.descricao}" excluído do banco de dados.`
    )
    if (!saved) return
    if (selectedCaixaId === cx.id) setSelectedCaixaId(null)
    if (infoCaixa?.id === cx.id) setInfoCaixa(null)
  }

  // Exportação / Template / Importação XLSX
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        Codigo: '109',
        Descricao: 'CAIXA SECRETARIA 2026',
        DataAbertura: '06/11/2026',
        TipoCaixa: 'Caixa – Movimento Diário',
        Agencia: '',
        Conta: '',
        Situacao: 'Aberto',
        AbertoPor: '11 - Ivan Rossi',
        Operador: '11 - Ivan Rossi',
        UnidadeEmpresa: '1 - Colégio Impacto Centro de Ensino - ME',
        AceitaTransferencias: 'Não',
        AceitaBaixaOutroUsuario: 'Não',
        SaldoInicial: 0,
      },
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Caixas')
    XLSX.writeFile(wb, 'Template_Abertura_Caixas.xlsx')
    showToast('Template XLSX baixado com sucesso!')
  }

  const handleExportExcel = () => {
    const rows = filteredCaixas.map(cx => {
      const m = getCaixaMetrics(cx)
      return {
        Código: cx.codigo,
        Descrição: cx.descricao,
        Abertura: formatDateBR(cx.dataAbertura),
        'Tipo do Caixa': cx.tipoCaixa,
        Agência: cx.agencia || '',
        Conta: cx.conta || '',
        Situação: cx.situacao,
        'Aberto por': cx.abertoPor || '',
        Operador: cx.operador || '',
        'Vistoriado por': cx.vistoriadoPor || '',
        'Unidade/Empresa': cx.unidadeEmpresa || '',
        'Conta Plano': cx.contaPlanoLabel || '',
        'Aceita Transferências': cx.aceitaTransferenciaOutrosCaixas ? 'Sim' : 'Não',
        'Aceita Baixa Outro Usuário': cx.aceitaBaixaContasPagarOutroUsuario ? 'Sim' : 'Não',
        'Saldo Atual (R$)': m.saldoAtual,
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Caixas')
    XLSX.writeFile(wb, `Relacao_Caixas_${new Date().toISOString().slice(0, 10)}.xlsx`)
    showToast('Relação de Caixas exportada para Excel!')
  }

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const wb = XLSX.read(data, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(sheet)
        let importedCount = 0
        const novos: ConfigCaixa[] = []

        rows.forEach((r, idx) => {
          const desc = String(r.Descricao || r['Descrição'] || '').trim()
          if (!desc) return
          const cod = String(r.Codigo || r['Código'] || Number(nextSuggestedCode) + idx).trim()
          const sitRaw = String(r.Situacao || r['Situação'] || 'Aberto').trim()
          const situacao: SituacaoCaixaConfig =
            sitRaw === 'Fechado' || sitRaw === 'Vistoriado' ? sitRaw : 'Aberto'

          novos.push({
            id: newId('CX'),
            codigo: cod,
            descricao: desc,
            dataAbertura: brToIsoDate(String(r.DataAbertura || r['Abertura'] || '06/11/2026')),
            tipoCaixa: (r.TipoCaixa || r['Tipo do Caixa'] || 'Caixa – Movimento Diário') as TipoCaixaConfig,
            agencia: String(r.Agencia || r['Agência'] || ''),
            conta: String(r.Conta || ''),
            situacao,
            abertoPor: String(r.AbertoPor || r['Aberto por'] || currentOperatorDisplay),
            operador: String(r.Operador || currentOperatorDisplay),
            operadorCodigo: '11',
            vistoriadoPor: String(r['Vistoriado por'] || ''),
            unidadeEmpresa: String(
              r.UnidadeEmpresa || r['Unidade/Empresa'] || '1 - Colégio Impacto Centro de Ensino - ME'
            ),
            unidadeId: '1',
            aceitaTransferenciaOutrosCaixas:
              String(r.AceitaTransferencias || r['Aceita Transferências'] || '').toLowerCase() === 'sim',
            aceitaBaixaContasPagarOutroUsuario:
              String(r.AceitaBaixaOutroUsuario || r['Aceita Baixa Outro Usuário'] || '').toLowerCase() === 'sim',
            saldoInicial: Number(r.SaldoInicial || 0),
            historico: [
              {
                id: newId('HCX'),
                dataHora: new Date().toISOString(),
                acao: 'Abertura',
                usuario: currentOperatorDisplay,
                observacao: 'Importado via planilha XLSX.',
              },
            ],
            createdAt: new Date().toISOString(),
          })
          importedCount++
        })

        if (importedCount > 0) {
          persistCaixasToDb(
            [...novos, ...cfgCaixas],
            `${importedCount} caixa(s) importado(s) e salvo(s) no banco de dados!`
          )
        } else {
          showToast('Nenhum registro válido encontrado na planilha.', 'error')
        }
      } catch {
        showToast('Erro ao processar o arquivo XLSX.', 'error')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  // Renderizador de ícone de ordenação nas colunas
  const renderSortIcon = (field: SortField) => {
    const active = sortField === field
    if (!active) return <ArrowUpDown size={12} style={{ opacity: 0.35, flexShrink: 0 }} />
    return sortDir === 'asc' ? (
      <ArrowUp size={12} style={{ color: '#2563eb', flexShrink: 0 }} />
    ) : (
      <ArrowDown size={12} style={{ color: '#2563eb', flexShrink: 0 }} />
    )
  }

  // Badge de Situação (cores fiéis à legenda da Imagem 2, com acabamento moderno)
  const renderSituacaoBadge = (situacao: SituacaoCaixaConfig) => {
    const styles: Record<
      SituacaoCaixaConfig,
      { bg: string; color: string; border: string; dot: string }
    > = {
      Aberto: {
        bg: '#eff6ff',
        color: '#0284c7',
        border: '#bae6fd',
        dot: '#0284c7',
      },
      Fechado: {
        bg: '#fffbeb',
        color: '#d97706',
        border: '#fde68a',
        dot: '#f59e0b',
      },
      Vistoriado: {
        bg: '#f5f3ff',
        color: '#7c3aed',
        border: '#ddd6fe',
        dot: '#7c3aed',
      },
    }
    const st = styles[situacao] || styles.Aberto
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          background: st.bg,
          color: st.color,
          border: `1px solid ${st.border}`,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: st.dot,
          }}
        />
        {situacao}
      </span>
    )
  }

  // Planos de contas analíticos/ativos para o seletor "Conta Plano" do modal
  const filteredPlanos = useMemo(() => {
    const q = planoSearch.trim().toLowerCase()
    return cfgPlanoContas.filter(p => {
      if (p.situacao === 'inativo') return false
      if (!q) return true
      const cod = String(p.codPlano || (p as any).codigo || '').toLowerCase()
      const desc = String(p.descricao || (p as any).nome || '').toLowerCase()
      return (
        cod.includes(q) ||
        desc.includes(q) ||
        String(p.tipo || '').toLowerCase().includes(q)
      )
    })
  }, [cfgPlanoContas, planoSearch])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        padding: isMobile ? '16px 12px 48px' : '24px 28px 64px',
        color: '#0f172a',
        fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
      }}
    >
      <div style={{ maxWidth: 1480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* ── 1. HEADER ULTRA MODERNO LIGHT ───────────────────────────────────── */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: isMobile ? '16px 14px' : '16px 22px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.04)',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: isMobile ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 8px 16px -4px rgba(37, 99, 235, 0.35)',
                flexShrink: 0,
              }}
            >
              <Wallet size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: '0.07em',
                  color: '#64748b',
                  textTransform: 'uppercase',
                  marginBottom: 3,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>TESOURARIA & CONTROLADORIA ESCOLAR</span>
                <span>•</span>
                <span style={{ color: '#0284c7' }}>CONFIG. FINANCEIRO</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexWrap: isMobile ? 'wrap' : 'nowrap',
                  whiteSpace: 'nowrap',
                }}
              >
                <h1
                  style={{
                    fontSize: isMobile ? 19 : 21,
                    fontWeight: 800,
                    color: '#0f172a',
                    margin: 0,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Abertura de Caixas
                </h1>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  Integrado ao Contas a Pagar & Receber
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 10.5,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background:
                      dbSyncStatus === 'error'
                        ? '#fef2f2'
                        : dbSyncStatus === 'saving' || dbSyncStatus === 'loading'
                        ? '#fffbeb'
                        : '#ecfdf5',
                    color:
                      dbSyncStatus === 'error'
                        ? '#dc2626'
                        : dbSyncStatus === 'saving' || dbSyncStatus === 'loading'
                        ? '#d97706'
                        : '#047857',
                    border: `1px solid ${
                      dbSyncStatus === 'error'
                        ? '#fecaca'
                        : dbSyncStatus === 'saving' || dbSyncStatus === 'loading'
                        ? '#fde68a'
                        : '#a7f3d0'
                    }`,
                  }}
                >
                  <CheckCircle2 size={11} />
                  {dbSyncStatus === 'saving'
                    ? 'Gravando...'
                    : dbSyncStatus === 'loading'
                    ? 'Sincronizando...'
                    : dbSyncStatus === 'error'
                    ? 'Erro ao sincronizar'
                    : `Salvo no Banco${lastSavedAt ? ` (${lastSavedAt})` : ''}`}
                </span>
              </div>
            </div>
          </div>

          {/* Ações Rápidas Superiores e Guia Didático (Tudo em 1 linha sem quebrar) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: isMobile ? 'wrap' : 'nowrap',
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setShowDidacticGuide(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 11px',
                borderRadius: 9,
                border: '1px solid #cbd5e1',
                background: showDidacticGuide ? '#eff6ff' : '#f8fafc',
                color: showDidacticGuide ? '#1d4ed8' : '#334155',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}
            >
              <HelpCircle size={14} style={{ color: '#0284c7' }} />
              {showDidacticGuide ? 'Ocultar Guia' : 'Como funciona?'}
            </button>

            <Link
              href="/financeiro/pagar"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 11px',
                borderRadius: 9,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#334155',
                fontSize: 12,
                fontWeight: 700,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              <ExternalLink size={13} style={{ color: '#2563eb' }} />
              Contas a Pagar
            </Link>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 10px',
                borderRadius: 9,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#475569',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              title="Baixar planilha modelo para importação em lote"
            >
              <FileSpreadsheet size={13} style={{ color: '#16a34a' }} />
              Template
            </button>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 10px',
                borderRadius: 9,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#475569',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              title="Importar caixas via planilha Excel (.xlsx)"
            >
              <Upload size={13} style={{ color: '#2563eb' }} />
              Importar
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportExcel}
                style={{ display: 'none' }}
              />
            </label>

            <button
              type="button"
              onClick={handleExportExcel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 10px',
                borderRadius: 9,
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#475569',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Download size={13} style={{ color: '#0284c7' }} />
              Exportar Excel
            </button>
          </div>
        </div>

        {/* ── PAINEL DIDÁTICO COLAPSÁVEL ──────────────────────────────────────── */}
        {showDidacticGuide && (
          <div
            style={{
              background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
              borderRadius: 16,
              padding: '18px 22px',
              border: '1px solid #bfdbfe',
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
              gap: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#dbeafe',
                  color: '#1d4ed8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontWeight: 800,
                }}
              >
                1
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a8a', marginBottom: 4 }}>
                  Ciclo de Vida do Caixa
                </div>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                  Um caixa <strong>Aberto</strong> (azul) pode receber baixas de Contas a Pagar e Contas a
                  Receber. Ao encerrar o expediente ou exercício, utilize <strong>Fechar Caixa</strong>{' '}
                  (laranja) e, após conferência da controladoria, <strong>Vistoriar</strong> (roxo).
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#dcfce7',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontWeight: 800,
                }}
              >
                2
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#14532d', marginBottom: 4 }}>
                  Regras de Segurança & Operador
                </div>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                  Em <strong>Informações Extras</strong> no cadastro do caixa, você define se o caixa{' '}
                  <em>aceita transferências de outros caixas</em> e se{' '}
                  <em>aceita baixa de contas a pagar por outro usuário</em> além do operador titular.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: '#f3e8ff',
                  color: '#6d28d9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontWeight: 800,
                }}
              >
                3
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#4c1d95', marginBottom: 4 }}>
                  Uso Rápido na Tabela
                </div>
                <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                  Clique em qualquer linha para selecioná-la e usar os botões superiores (
                  <strong>Editar</strong>, <strong>Fechar Caixa</strong>, <strong>Reabrir</strong>,{' '}
                  <strong>Vistoriar</strong>), dê <strong>duplo clique</strong> para editar rapidamente ou
                  clique no botão azul <strong>i</strong> para ver auditoria e movimentações.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── 2. CARDS DE INDICADORES (KPIs) ──────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile
              ? '1fr'
              : isTablet
              ? 'repeat(2, 1fr)'
              : 'repeat(4, 1fr)',
            gap: 14,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '16px 20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Caixas Abertos (Ativos)
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: '#0284c7',
                  marginTop: 4,
                  lineHeight: 1.1,
                }}
              >
                {kpis.abertos}
                <span style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', marginLeft: 6 }}>
                  de {kpis.total}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                Prontos para lançamentos e baixas
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#f0f9ff',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #bae6fd',
              }}
            >
              <Unlock size={20} />
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '16px 20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Fechados & Vistoriados
              </div>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 800,
                  color: '#d97706',
                  marginTop: 4,
                  lineHeight: 1.1,
                }}
              >
                {kpis.fechados}
                <span style={{ fontSize: 14, fontWeight: 700, color: '#7c3aed', marginLeft: 8 }}>
                  • {kpis.vistoriados} vistoriado(s)
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                Bloqueados para novas baixas
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#fffbeb',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #fde68a',
              }}
            >
              <ShieldCheck size={20} />
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '16px 20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Operador Atual
              </div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 800,
                  color: '#0f172a',
                  marginTop: 6,
                  lineHeight: 1.2,
                }}
              >
                {currentOperatorDisplay}
              </div>
              <div style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>
                {cfgCaixas.filter(c => isMeuCaixa(c)).length} caixa(s) sob sua titularidade
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#f0fdf4',
                color: '#16a34a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #bbf7d0',
              }}
            >
              <UserCheck size={20} />
            </div>
          </div>

          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              padding: '16px 20px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 10px -2px rgba(15, 23, 42, 0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Movimentação Consolidada
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: kpis.saldoConsolidado >= 0 ? '#059669' : '#dc2626',
                  marginTop: 4,
                  lineHeight: 1.2,
                }}
              >
                {formatBRL(kpis.saldoConsolidado)}
              </div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 4 }}>
                Sincronizado com baixas financeiras
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #a7f3d0',
              }}
            >
              <Landmark size={20} />
            </div>
          </div>
        </div>

        {/* ── 3. CARD PRINCIPAL: BARRA DE AÇÕES + FILTROS + TABELA (IMAGEM 2) ── */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            boxShadow: '0 6px 24px -6px rgba(15, 23, 42, 0.05)',
            overflow: 'hidden',
          }}
        >
          {/* Faixa de Título Interna */}
          <div
            style={{
              padding: isMobile ? '14px 16px' : '16px 24px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: '#0284c7',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wallet size={15} />
              </div>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#0284c7' }}>
                Abertura De Caixas
              </span>
              {selectedCaixa && (
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: '#e0f2fe',
                    color: '#0369a1',
                    border: '1px solid #bae6fd',
                  }}
                >
                  Selecionado: #{selectedCaixa.codigo} - {selectedCaixa.descricao}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  syncCaixasFromDatabase()
                  fetchMovimentosReais()
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 11px',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#64748b',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                title="Recarregar caixas e saldos diretamente do banco de dados"
              >
                <RefreshCw
                  size={13}
                  className={loadingMovimentos || dbSyncStatus === 'loading' ? 'animate-spin' : ''}
                />
                Sincronizar Banco & Saldos
              </button>
            </div>
          </div>

          {/* ── BARRA DE BOTÕES OPERACIONAIS (Fiel à Imagem 2 + Transferência) ── */}
          <div style={{ padding: isMobile ? '16px' : '20px 24px 12px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                {/* + Novo (Verde) */}
                <button
                  type="button"
                  onClick={openCreateModal}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid #15803d',
                    background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
                  }}
                >
                  <Plus size={15} strokeWidth={2.5} />
                  Novo
                </button>

                {/* Editar (Laranja/Âmbar) */}
                <button
                  type="button"
                  onClick={() => openEditModal()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid #d97706',
                    background: 'linear-gradient(180deg, #f59e0b 0%, #d97706 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(217, 119, 6, 0.22)',
                    opacity: selectedCaixa ? 1 : 0.85,
                  }}
                >
                  <Edit2 size={14} />
                  Editar
                </button>

                {/* Fechar Caixa (Azul) */}
                <button
                  type="button"
                  onClick={() => triggerStatusAction('fechar')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid #0369a1',
                    background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.22)',
                  }}
                >
                  <Lock size={14} />
                  Fechar Caixa
                </button>

                {/* Reabrir (Azul) */}
                <button
                  type="button"
                  onClick={() => triggerStatusAction('reabrir')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid #1d4ed8',
                    background: 'linear-gradient(180deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(37, 99, 235, 0.22)',
                  }}
                >
                  <Unlock size={14} />
                  Reabrir
                </button>

                {/* Vistoriar (Azul/Roxo) */}
                <button
                  type="button"
                  onClick={() => triggerStatusAction('vistoriar')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid #0369a1',
                    background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.22)',
                  }}
                >
                  <ShieldCheck size={15} />
                  Vistoriar
                </button>
              </div>

              {/* Botão extra moderno: Transferir entre Caixas */}
              <button
                type="button"
                onClick={() => {
                  const abertos = cfgCaixas.filter(c => c.situacao === 'Aberto')
                  setTransferOrigemId(selectedCaixa?.situacao === 'Aberto' ? selectedCaixa.id : abertos[0]?.id || '')
                  const destCandidato = abertos.find(
                    c => c.id !== (selectedCaixa?.id || abertos[0]?.id) && c.aceitaTransferenciaOutrosCaixas
                  )
                  setTransferDestinoId(destCandidato?.id || abertos[1]?.id || '')
                  setTransferValor('')
                  setTransferObs('')
                  setTransferModalOpen(true)
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '9px 14px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#0f172a',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <ArrowRightLeft size={14} style={{ color: '#0284c7' }} />
                Transferir entre Caixas
              </button>
            </div>

            {/* Visibilidade de Caixas: Administrador vê Todos ou Meus Caixas; Operador vê apenas os seus designados */}
            <div style={{ marginBottom: 14 }}>
              {isAdmin ? (
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    userSelect: 'none',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#334155',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={somenteMeusCaixas}
                    onChange={e => setSomenteMeusCaixas(e.target.checked)}
                    style={{
                      width: 16,
                      height: 16,
                      accentColor: '#0284c7',
                      cursor: 'pointer',
                    }}
                  />
                  <span>Somente meus caixas designados</span>
                </label>
              ) : (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    color: '#0369a1',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <UserCheck size={13} />
                  <span>Exibindo exclusivamente os caixas designados para {currentUser?.nome || 'você'}</span>
                </div>
              )}
            </div>

            {/* Linha de Filtros: Operador + Situação do caixa (Imagem 2) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '340px 220px 1fr',
                gap: 16,
                alignItems: 'end',
                marginBottom: 16,
              }}
            >
              {/* Operador com botão X */}
              <div>
                <label
                  htmlFor="filtro-operador-caixa"
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#475569',
                    marginBottom: 6,
                  }}
                >
                  Operador:
                </label>
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <select
                    id="filtro-operador-caixa"
                    value={filtroOperador}
                    onChange={e => setFiltroOperador(e.target.value)}
                    style={{
                      flex: 1,
                      height: 38,
                      padding: '0 12px',
                      borderRadius: '8px 0 0 8px',
                      border: '1px solid #cbd5e1',
                      borderRight: 'none',
                      background: filtroOperador ? '#ffffff' : '#f1f5f9',
                      color: filtroOperador ? '#0f172a' : '#64748b',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  >
                    <option value="">Selecione um operador</option>
                    {allOperadores.map(op => (
                      <option key={op.label} value={op.label}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setFiltroOperador('')}
                    aria-label="Limpar filtro de operador"
                    title="Limpar operador"
                    style={{
                      width: 36,
                      height: 38,
                      borderRadius: '0 8px 8px 0',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Situação do caixa */}
              <div>
                <label
                  htmlFor="filtro-situacao-caixa"
                  style={{
                    display: 'block',
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: '#475569',
                    marginBottom: 6,
                  }}
                >
                  Situação do caixa
                </label>
                <select
                  id="filtro-situacao-caixa"
                  value={filtroSituacao}
                  onChange={e => setFiltroSituacao(e.target.value)}
                  style={{
                    width: '100%',
                    height: 38,
                    padding: '0 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: 13,
                    fontWeight: 500,
                    outline: 'none',
                  }}
                >
                  <option value="Aberto">Aberto</option>
                  <option value="Fechado">Fechado</option>
                  <option value="Vistoriado">Vistoriado</option>
                  <option value="Todos">Todos (Abertos, Fechados e Vistoriados)</option>
                </select>
              </div>

              <div />
            </div>

            {/* Linha Page Size + Pesquisar (Imagem 2) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12,
                paddingTop: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                  aria-label="Registros por página"
                  value={pageSize}
                  onChange={e => setPageSize(Number(e.target.value))}
                  style={{
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: 13,
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span style={{ fontSize: 12.5, color: '#64748b' }}>registros por página</span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: isMobile ? '100%' : 'auto',
                }}
              >
                <label
                  htmlFor="pesquisar-caixas"
                  style={{ fontSize: 13, fontWeight: 500, color: '#475569' }}
                >
                  Pesquisar
                </label>
                <div style={{ position: 'relative', flex: isMobile ? 1 : 'initial' }}>
                  <input
                    id="pesquisar-caixas"
                    type="search"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Código, descrição, operador, conta..."
                    style={{
                      width: isMobile ? '100%' : 300,
                      height: 36,
                      padding: '0 32px 0 12px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Limpar pesquisa"
                      style={{
                        position: 'absolute',
                        right: 8,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        border: 'none',
                        background: 'transparent',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: 2,
                      }}
                    >
                      <X size={14} />
                    </button>
                  ) : (
                    <Search
                      size={14}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#94a3b8',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── TABELA DE CAIXAS (100% Enquadrada sem Rolagem Horizontal) ────── */}
          <div
            className="table-wrapper"
            role="region"
            aria-labelledby="caixas-table-caption"
            tabIndex={0}
            style={{
              overflowX: isMobile ? 'auto' : 'hidden',
              WebkitOverflowScrolling: 'touch',
              borderTop: '1px solid #e2e8f0',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: isMobile ? 'auto' : 'fixed',
                fontSize: 12.5,
              }}
            >
              <caption
                id="caixas-table-caption"
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  padding: 0,
                  margin: -1,
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
              >
                Relação de Caixas Cadastrados e Abertos
              </caption>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  {(
                    [
                      { key: 'codigo', label: 'Código', width: '6%' },
                      { key: 'descricao', label: 'Descrição', width: '14%' },
                      { key: 'dataAbertura', label: 'Abertura', width: '8%' },
                      { key: 'agencia', label: 'Agência', width: '6%' },
                      { key: 'conta', label: 'Conta', width: '7%' },
                      { key: 'situacao', label: 'Situação', width: '8%' },
                      { key: 'abertoPor', label: 'Aberto por', width: '10%' },
                      { key: 'operador', label: 'Operador', width: '10%' },
                      { key: 'vistoriadoPor', label: 'Vistoriado por', width: '9%' },
                      { key: 'unidadeEmpresa', label: 'Unidade/Empresa', width: '17.5%' },
                    ] as { key: SortField; label: string; width: string }[]
                  ).map(col => (
                    <th
                      key={col.key}
                      scope="col"
                      onClick={() => handleSort(col.key)}
                      style={{
                        padding: '10px 8px',
                        textAlign: 'left',
                        fontWeight: 700,
                        color: '#0284c7',
                        fontSize: 11.5,
                        borderRight: '1px solid #e2e8f0',
                        cursor: 'pointer',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        width: col.width,
                        position: 'sticky',
                        top: 0,
                        background: '#f8fafc',
                        zIndex: 1,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 4,
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {col.label}
                        </span>
                        {renderSortIcon(col.key)}
                      </div>
                    </th>
                  ))}
                  <th
                    scope="col"
                    style={{
                      padding: '10px 6px',
                      textAlign: 'center',
                      fontWeight: 700,
                      color: '#0284c7',
                      fontSize: 11.5,
                      whiteSpace: 'nowrap',
                      width: '4.5%',
                      position: 'sticky',
                      top: 0,
                      background: '#f8fafc',
                      zIndex: 1,
                    }}
                  >
                    Info
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedCaixas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      style={{
                        padding: '48px 20px',
                        textAlign: 'center',
                        color: '#64748b',
                        background: '#ffffff',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <Wallet size={36} style={{ color: '#0284c7', opacity: 0.7 }} />
                        {cfgCaixas.length === 0 ? (
                          <>
                            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                              Nenhum caixa cadastrado no banco de dados
                            </div>
                            <div style={{ fontSize: 13, color: '#64748b', maxWidth: 460 }}>
                              Clique no botão verde <strong>&ldquo;+ Novo&rdquo;</strong> para abrir e gravar seu
                              primeiro caixa real no sistema.
                            </div>
                            <button
                              type="button"
                              onClick={openCreateModal}
                              style={{
                                marginTop: 6,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 7,
                                padding: '9px 18px',
                                borderRadius: 10,
                                border: '1px solid #15803d',
                                background: 'linear-gradient(180deg, #22c55e 0%, #16a34a 100%)',
                                color: '#ffffff',
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              <Plus size={15} strokeWidth={2.5} />
                              Cadastrar Primeiro Caixa
                            </button>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>
                              Nenhum caixa encontrado com os filtros selecionados
                            </div>
                            <div style={{ fontSize: 12.5, color: '#64748b' }}>
                              Existem {cfgCaixas.length} caixa(s) salvo(s) no banco de dados.
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSomenteMeusCaixas(false)
                                setFiltroOperador('')
                                setFiltroSituacao('Todos')
                                setSearch('')
                              }}
                              style={{
                                marginTop: 4,
                                padding: '7px 14px',
                                borderRadius: 8,
                                border: '1px solid #bae6fd',
                                background: '#eff6ff',
                                color: '#0284c7',
                                fontSize: 12.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                              }}
                            >
                              Limpar filtros e exibir todos ({cfgCaixas.length})
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedCaixas.map((cx, idx) => {
                    const isSelected = selectedCaixaId === cx.id
                    const rowBg = isSelected
                      ? '#e0f2fe'
                      : idx % 2 === 0
                      ? '#ffffff'
                      : '#f8fafc'
                    const textColor =
                      cx.situacao === 'Aberto'
                        ? '#0284c7'
                        : cx.situacao === 'Fechado'
                        ? '#b45309'
                        : '#6d28d9'

                    return (
                      <tr
                        key={cx.id}
                        onClick={() => setSelectedCaixaId(cx.id)}
                        onDoubleClick={() => openEditModal(cx)}
                        style={{
                          background: rowBg,
                          borderBottom: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          transition: 'background 0.12s',
                        }}
                        title="Clique para selecionar ou dê duplo clique para editar"
                      >
                        <td
                          style={{
                            padding: '9px 8px',
                            borderRight: '1px solid #e2e8f0',
                            color: textColor,
                            fontWeight: isSelected ? 800 : 600,
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <input
                              type="radio"
                              name="selected-caixa-row"
                              checked={isSelected}
                              onChange={() => setSelectedCaixaId(cx.id)}
                              aria-label={`Selecionar caixa ${cx.codigo} - ${cx.descricao}`}
                              style={{ accentColor: '#0284c7', cursor: 'pointer', margin: 0, flexShrink: 0 }}
                            />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {cx.codigo}
                            </span>
                          </div>
                        </td>
                        <td
                          title={cx.descricao}
                          style={{
                            padding: '9px 8px',
                            borderRight: '1px solid #e2e8f0',
                            color: textColor,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cx.descricao}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '9px 8px',
                            borderRight: '1px solid #e2e8f0',
                            color: textColor,
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {formatDateBR(cx.dataAbertura)}
                        </td>
                        <td
                          title={cx.agencia || ''}
                          style={{
                            padding: '9px 8px',
                            borderRight: '1px solid #e2e8f0',
                            color: textColor,
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cx.agencia || ''}
                        </td>
                        <td
                          title={cx.conta || ''}
                          style={{
                            padding: '9px 8px',
                            borderRight: '1px solid #e2e8f0',
                            color: textColor,
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cx.conta || ''}
                        </td>
                        <td
                          style={{
                            padding: '9px 8px',
                            borderRight: '1px solid #e2e8f0',
                            color: textColor,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                          }}
                        >
                          {renderSituacaoBadge(cx.situacao)}
                        </td>
                        <td
                          title={cx.abertoPor || ''}
                          style={{
                            padding: '9px 8px',
                            borderRight: '1px solid #e2e8f0',
                            color: textColor,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cx.abertoPor || ''}
                        </td>
                        <td
                          title={cx.operador || ''}
                          style={{
                            padding: '9px 8px',
                            borderRight: '1px solid #e2e8f0',
                            color: textColor,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cx.operador || ''}
                        </td>
                        <td
                          title={cx.vistoriadoPor || ''}
                          style={{
                            padding: '9px 8px',
                            borderRight: '1px solid #e2e8f0',
                            color: textColor,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cx.vistoriadoPor || ''}
                        </td>
                        <td
                          title={cx.unidadeEmpresa || ''}
                          style={{
                            padding: '9px 8px',
                            borderRight: '1px solid #e2e8f0',
                            color: textColor,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {cx.unidadeEmpresa}
                        </td>
                        <td
                          style={{
                            padding: '6px 4px',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {/* Botão Azul Info (i) idêntico à Imagem 2 */}
                            <button
                              type="button"
                              onClick={() => setInfoCaixa(cx)}
                              aria-label={`Informações detalhadas do caixa ${cx.descricao}`}
                              title="Ver detalhes, saldos e auditoria do caixa"
                              style={{
                                width: 30,
                                height: 28,
                                borderRadius: 6,
                                border: '1px solid #0369a1',
                                background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 100%)',
                                color: '#ffffff',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                boxShadow: '0 1px 3px rgba(2, 132, 199, 0.25)',
                              }}
                            >
                              <Info size={14} />
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

          {/* ── RODAPÉ DA TABELA: CONTAGEM + LEGENDA DE STATUS + PAGINAÇÃO (IMAGEM 2) ── */}
          <div
            style={{
              padding: isMobile ? '14px 16px' : '16px 24px',
              background: '#ffffff',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 14,
            }}
          >
            {/* Contagem de registros */}
            <div style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>
              {totalRecords === 0
                ? 'Mostrando 0 registros'
                : `Mostrando de ${startIdx + 1} até ${Math.min(
                    startIdx + pageSize,
                    totalRecords
                  )} de ${totalRecords} registros`}
            </div>

            {/* Legenda interativa central (Aberto | Fechado | Vistoriado) igual à Imagem 2 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() =>
                  setFiltroSituacao(prev => (prev === 'Aberto' ? 'Todos' : 'Aberto'))
                }
                title="Clique para filtrar por Aberto"
                style={{
                  padding: '4px 10px',
                  borderRadius: 5,
                  border: 'none',
                  background: '#0284c7',
                  color: '#ffffff',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: filtroSituacao === 'Aberto' ? '2px solid #bae6fd' : 'none',
                }}
              >
                Aberto
              </button>
              <button
                type="button"
                onClick={() =>
                  setFiltroSituacao(prev => (prev === 'Fechado' ? 'Todos' : 'Fechado'))
                }
                title="Clique para filtrar por Fechado"
                style={{
                  padding: '4px 10px',
                  borderRadius: 5,
                  border: 'none',
                  background: '#f59e0b',
                  color: '#ffffff',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: filtroSituacao === 'Fechado' ? '2px solid #fde68a' : 'none',
                }}
              >
                Fechado
              </button>
              <button
                type="button"
                onClick={() =>
                  setFiltroSituacao(prev => (prev === 'Vistoriado' ? 'Todos' : 'Vistoriado'))
                }
                title="Clique para filtrar por Vistoriado"
                style={{
                  padding: '4px 10px',
                  borderRadius: 5,
                  border: 'none',
                  background: '#7c3aed',
                  color: '#ffffff',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: filtroSituacao === 'Vistoriado' ? '2px solid #ddd6fe' : 'none',
                }}
              >
                Vistoriado
              </button>
              {filtroSituacao !== 'Todos' && (
                <button
                  type="button"
                  onClick={() => setFiltroSituacao('Todos')}
                  style={{
                    padding: '4px 8px',
                    borderRadius: 5,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    color: '#475569',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Ver Todos
                </button>
              )}
            </div>

            {/* Paginação (Anterior | 1 | Próximo) igual à Imagem 2 */}
            <div style={{ display: ' inline-flex', alignItems: 'center' }}>
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{
                  height: 34,
                  padding: '0 12px',
                  borderRadius: '6px 0 0 6px',
                  border: '1px solid #cbd5e1',
                  background: safePage <= 1 ? '#f8fafc' : '#ffffff',
                  color: safePage <= 1 ? '#94a3b8' : '#334155',
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: safePage <= 1 ? 'not-allowed' : 'pointer',
                }}
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    height: 34,
                    minWidth: 34,
                    padding: '0 10px',
                    borderTop: '1px solid #0284c7',
                    borderBottom: '1px solid #0284c7',
                    borderLeft: 'none',
                    borderRight: 'none',
                    background: pageNum === safePage ? '#0284c7' : '#ffffff',
                    color: pageNum === safePage ? '#ffffff' : '#334155',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {pageNum}
                </button>
              ))}
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{
                  height: 34,
                  padding: '0 12px',
                  borderRadius: '0 6px 6px 0',
                  border: '1px solid #cbd5e1',
                  background: safePage >= totalPages ? '#f8fafc' : '#ffffff',
                  color: safePage >= totalPages ? '#94a3b8' : '#334155',
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: safePage >= totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 1: CADASTRAR / EDITAR CAIXA (FIEL À IMAGEM 3 + MELHORIAS)
         ══════════════════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-cadastrar-caixa-title"
          onClick={() => setModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? 12 : 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 640,
              maxHeight: '92vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            }}
          >
            {/* Header do Modal (Imagem 3: "Cadastrar Caixa") */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <h2
                id="modal-cadastrar-caixa-title"
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#0284c7',
                }}
              >
                {editingCaixa ? `Editar Caixa #${editingCaixa.codigo}` : 'Cadastrar Caixa'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar modal"
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Formulário do Modal */}
            <form onSubmit={handleSaveCaixa} style={{ padding: '20px 24px 24px' }}>
              {formError && (
                <div
                  style={{
                    marginBottom: 16,
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    fontSize: 12.5,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AlertCircle size={15} />
                  <span>{formError}</span>
                </div>
              )}

              {/* Linha 1: Código + Data Abertura */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: 16,
                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 5,
                    }}
                  >
                    <label
                      htmlFor="caixa-codigo"
                      style={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: '#475569',
                      }}
                    >
                      Código:
                    </label>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#0284c7',
                        background: '#eff6ff',
                        border: '1px solid #bae6fd',
                        padding: '1px 7px',
                        borderRadius: 999,
                      }}
                    >
                      Automático
                    </span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="caixa-codigo"
                      type="text"
                      readOnly
                      value={editingCaixa ? formCodigo : nextSuggestedCode}
                      title="Código sequencial gerado automaticamente pelo sistema"
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 85px 0 12px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#f1f5f9',
                        color: '#0f172a',
                        fontSize: 14,
                        fontWeight: 800,
                        outline: 'none',
                        cursor: 'default',
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: '#64748b',
                        pointerEvents: 'none',
                      }}
                    >
                      Sequencial #{editingCaixa ? formCodigo : nextSuggestedCode}
                    </span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="caixa-data-abertura"
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: '#475569',
                      marginBottom: 5,
                    }}
                  >
                    Data Abertura
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="caixa-data-abertura"
                      type="date"
                      value={formDataAbertura}
                      onChange={e => setFormDataAbertura(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 12px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: 13.5,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Linha 2: Descrição + Tipo do Caixa */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: 16,
                  marginBottom: 14,
                }}
              >
                <div>
                  <label
                    htmlFor="caixa-descricao"
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: '#475569',
                      marginBottom: 5,
                    }}
                  >
                    Descrição:
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="caixa-descricao"
                      type="text"
                      value={formDescricao}
                      onChange={e => setFormDescricao(e.target.value)}
                      placeholder="Ex: IVAN-2026 ou CAIXA SECRETARIA"
                      required
                      autoFocus
                      style={{
                        width: '100%',
                        height: 38,
                        padding: '0 34px 0 12px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: 13.5,
                        outline: 'none',
                      }}
                    />
                    <PenLine
                      size={14}
                      style={{
                        position: 'absolute',
                        right: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#475569',
                        pointerEvents: 'none',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 5,
                    }}
                  >
                    <label
                      htmlFor="caixa-tipo"
                      style={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        color: '#475569',
                      }}
                    >
                      Tipo do Caixa
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowNovoTipoInput(prev => !prev)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#0284c7',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: 0,
                      }}
                    >
                      <Plus size={12} strokeWidth={2.5} />
                      {showNovoTipoInput ? 'Fechar' : 'Novo Tipo'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <select
                      id="caixa-tipo"
                      value={formTipoCaixa}
                      onChange={e => setFormTipoCaixa(e.target.value as TipoCaixaConfig)}
                      style={{
                        flex: 1,
                        height: 38,
                        padding: '0 12px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: 13.5,
                        outline: 'none',
                      }}
                    >
                      {todosTiposCaixa.map(t => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNovoTipoInput(prev => !prev)}
                      title="Criar novo Tipo de Caixa"
                      aria-label="Criar novo Tipo de Caixa"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 6,
                        border: '1px solid #bae6fd',
                        background: showNovoTipoInput ? '#0284c7' : '#eff6ff',
                        color: showNovoTipoInput ? '#ffffff' : '#0284c7',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      <Plus size={16} strokeWidth={2.5} />
                    </button>
                  </div>

                  {/* Criação rápida de novo Tipo de Caixa no próprio modal */}
                  {showNovoTipoInput && (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 10,
                        borderRadius: 8,
                        background: '#f8fafc',
                        border: '1px solid #bae6fd',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0369a1' }}>
                        Cadastrar Novo Tipo de Caixa
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          value={novoTipoNome}
                          onChange={e => setNovoTipoNome(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleCriarNovoTipoCaixa()
                            }
                          }}
                          placeholder="Ex: Caixa Cantina, Caixa Eventos..."
                          style={{
                            flex: 1,
                            height: 34,
                            padding: '0 10px',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: 12.5,
                            color: '#0f172a',
                            outline: 'none',
                          }}
                        />
                        <button
                          type="button"
                          disabled={savingNovoTipo}
                          onClick={handleCriarNovoTipoCaixa}
                          style={{
                            height: 34,
                            padding: '0 12px',
                            borderRadius: 6,
                            border: 'none',
                            background: '#0284c7',
                            color: '#ffffff',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {savingNovoTipo ? '...' : 'Adicionar'}
                        </button>
                      </div>
                      {customTiposCaixa.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingTop: 2 }}>
                          {customTiposCaixa.map(ct => (
                            <span
                              key={ct}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 7px',
                                borderRadius: 999,
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                fontSize: 11,
                                color: '#334155',
                                fontWeight: 600,
                              }}
                            >
                              {ct}
                              <button
                                type="button"
                                onClick={() => handleRemoverTipoCustom(ct)}
                                title={`Remover tipo "${ct}"`}
                                style={{
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'inline-flex',
                                }}
                              >
                                <X size={11} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Linha 3: Operador + Conta Plano (Imagem 3 com botões X) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                  gap: 16,
                  marginBottom: 14,
                }}
              >
                {/* Operador */}
                <div>
                  <label
                    htmlFor="caixa-operador"
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: '#475569',
                      marginBottom: 5,
                    }}
                  >
                    Operador:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <select
                        id="caixa-operador"
                        value={formOperador}
                        onChange={e => setFormOperador(e.target.value)}
                        style={{
                          width: '100%',
                          height: 38,
                          padding: '0 30px 0 12px',
                          borderRadius: '6px 0 0 6px',
                          border: '1px solid #cbd5e1',
                          borderRight: 'none',
                          background: '#f1f5f9',
                          color: '#0f172a',
                          fontSize: 13,
                          outline: 'none',
                        }}
                      >
                        <option value="">Selecione um operador...</option>
                        {allOperadores.map(op => (
                          <option key={op.label} value={op.label}>
                            {op.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormOperador('')}
                      aria-label="Limpar operador"
                      title="Limpar operador"
                      style={{
                        width: 34,
                        height: 38,
                        borderRadius: '0 6px 6px 0',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>

                {/* Conta Plano */}
                <div>
                  <label
                    htmlFor="caixa-conta-plano"
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: '#475569',
                      marginBottom: 5,
                    }}
                  >
                    Conta Plano:
                  </label>
                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    <button
                      id="caixa-conta-plano"
                      type="button"
                      onClick={() => setShowPlanoPicker(prev => !prev)}
                      style={{
                        flex: 1,
                        height: 38,
                        padding: '0 12px',
                        borderRadius: '6px 0 0 6px',
                        border: '1px solid #cbd5e1',
                        borderRight: 'none',
                        background: '#f1f5f9',
                        color: formContaPlanoLabel ? '#0f172a' : '#64748b',
                        fontSize: 13,
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {formContaPlanoLabel || '-'}
                      </span>
                      <PenLine size={13} style={{ color: '#475569', flexShrink: 0 }} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setFormContaPlanoId('')
                        setFormContaPlanoLabel('')
                      }}
                      aria-label="Limpar conta do plano de contas"
                      title="Limpar Conta Plano"
                      style={{
                        width: 34,
                        height: 38,
                        borderRadius: '0 6px 6px 0',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={14} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Seletor rápido de Plano de Contas quando clicado */}
              {showPlanoPicker && (
                <div
                  style={{
                    marginBottom: 14,
                    padding: 12,
                    borderRadius: 8,
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <Search size={14} style={{ color: '#64748b' }} />
                    <input
                      type="search"
                      value={planoSearch}
                      onChange={e => setPlanoSearch(e.target.value)}
                      placeholder="Pesquisar conta no Plano de Contas..."
                      style={{
                        flex: 1,
                        height: 32,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        fontSize: 12.5,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPlanoPicker(false)}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        fontSize: 12,
                        color: '#64748b',
                        cursor: 'pointer',
                      }}
                    >
                      Fechar
                    </button>
                  </div>
                  <div
                    style={{
                      maxHeight: 150,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    {filteredPlanos.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#64748b', padding: 6 }}>
                        Nenhuma conta encontrada.
                      </div>
                    ) : (
                      filteredPlanos.map(p => {
                        const cod = p.codPlano || (p as any).codigo || ''
                        const desc = p.descricao || (p as any).nome || ''
                        const label = `${cod} - ${desc}`
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setFormContaPlanoId(p.id)
                              setFormContaPlanoLabel(label)
                              setShowPlanoPicker(false)
                            }}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              border: 'none',
                              background: formContaPlanoId === p.id ? '#e0f2fe' : '#ffffff',
                              color: '#0f172a',
                              fontSize: 12.5,
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            <span>
                              <strong>{cod}</strong> - {desc}
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b' }}>{p.tipo}</span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Linha 4: Unidade/Empresa sincronizada com Multi-Unidades (Matriz + Unidades) */}
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 5,
                  }}
                >
                  <label
                    htmlFor="caixa-unidade-empresa"
                    style={{
                      display: 'block',
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: '#475569',
                    }}
                  >
                    Unidade/Empresa <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    Sincronizado com Multi-Unidades ({allUnidades.filter(u => u.tipo === 'Matriz').length} Matriz ·{' '}
                    {allUnidades.filter(u => u.tipo === 'Unidade').length} Unidades)
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <select
                    id="caixa-unidade-empresa"
                    value={formUnidadeEmpresa}
                    onChange={e => setFormUnidadeEmpresa(e.target.value)}
                    style={{
                      flex: 1,
                      height: 38,
                      padding: '0 12px',
                      borderRadius: '6px 0 0 6px',
                      border: '1px solid #cbd5e1',
                      borderRight: 'none',
                      background: '#f1f5f9',
                      color: formUnidadeEmpresa ? '#0f172a' : '#64748b',
                      fontSize: 13,
                      fontWeight: formUnidadeEmpresa ? 600 : 400,
                      outline: 'none',
                    }}
                  >
                    <option value="">Selecione a Matriz ou Unidade cadastrada...</option>
                    {allUnidades.some(u => u.tipo === 'Matriz') && (
                      <optgroup label="🏢 Matriz / Mantenedora Principal">
                        {allUnidades
                          .filter(u => u.tipo === 'Matriz')
                          .map(u => (
                            <option key={u.label} value={u.label}>
                              {u.label}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {allUnidades.some(u => u.tipo === 'Unidade') && (
                      <optgroup label="🏫 Unidades Educacionais">
                        {allUnidades
                          .filter(u => u.tipo === 'Unidade')
                          .map(u => (
                            <option key={u.label} value={u.label}>
                              {u.label}
                            </option>
                          ))}
                      </optgroup>
                    )}
                    {formUnidadeEmpresa &&
                      !allUnidades.some(u => u.label === formUnidadeEmpresa) && (
                        <option value={formUnidadeEmpresa}>{formUnidadeEmpresa}</option>
                      )}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowUnidadePicker(prev => !prev)}
                    aria-label="Visualizar lista detalhada de Matriz e Unidades"
                    title="Selecionar Matriz ou Unidade"
                    style={{
                      width: 36,
                      height: 38,
                      border: '1px solid #cbd5e1',
                      borderRight: 'none',
                      background: showUnidadePicker ? '#e0f2fe' : '#ffffff',
                      color: showUnidadePicker ? '#0284c7' : '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <Search size={14} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormUnidadeEmpresa('')}
                    aria-label="Limpar Unidade ou Empresa"
                    title="Limpar Unidade/Empresa"
                    style={{
                      width: 36,
                      height: 38,
                      borderRadius: '0 6px 6px 0',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} strokeWidth={2.5} />
                  </button>
                </div>

                {showUnidadePicker && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: 10,
                      borderRadius: 8,
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    {allUnidades.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#64748b', padding: 6 }}>
                        Nenhuma Matriz ou Unidade encontrada em Multi-Unidades.
                      </div>
                    ) : (
                      allUnidades.map(u => {
                        const isSelected = formUnidadeEmpresa === u.label
                        const isMatriz = u.tipo === 'Matriz'
                        return (
                          <button
                            key={u.label}
                            type="button"
                            onClick={() => {
                              setFormUnidadeEmpresa(u.label)
                              setShowUnidadePicker(false)
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 7,
                              border: isSelected
                                ? '1.5px solid #0284c7'
                                : '1px solid #e2e8f0',
                              background: isSelected ? '#e0f2fe' : '#ffffff',
                              color: '#0f172a',
                              fontSize: 12.5,
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span
                                  style={{
                                    padding: '1px 6px',
                                    borderRadius: 4,
                                    fontSize: 10,
                                    fontWeight: 800,
                                    background: isMatriz ? '#ede9fe' : '#dbeafe',
                                    color: isMatriz ? '#6d28d9' : '#1d4ed8',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  {isMatriz ? '🏢 Matriz' : `🏫 ${u.codigo}`}
                                </span>
                                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                                  {u.nomeExibicao}
                                </span>
                              </div>
                              {u.subtitulo && (
                                <span style={{ fontSize: 11, color: '#64748b' }}>
                                  {u.subtitulo}
                                </span>
                              )}
                            </div>
                            {u.cnpj && (
                              <span
                                style={{
                                  fontSize: 11,
                                  color: '#475569',
                                  fontFamily: 'monospace',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {u.cnpj}
                              </span>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              {/* ── SEÇÃO: INFORMAÇÕES EXTRAS (Idêntica à Imagem 3 + Saldo Inicial) ── */}
              <div
                style={{
                  background: '#f8fafc',
                  borderRadius: 8,
                  border: '1px solid #e2e8f0',
                  padding: '14px 16px 16px',
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#0f172a',
                    marginBottom: 12,
                  }}
                >
                  Informações Extras
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '110px 110px 1fr',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <label
                      htmlFor="caixa-agencia"
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: '#475569',
                        marginBottom: 4,
                      }}
                    >
                      Agência
                    </label>
                    <input
                      id="caixa-agencia"
                      type="text"
                      value={formAgencia}
                      onChange={e => setFormAgencia(e.target.value)}
                      placeholder="Ex: 6492"
                      style={{
                        width: '100%',
                        height: 36,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="caixa-conta"
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: '#475569',
                        marginBottom: 4,
                      }}
                    >
                      Conta
                    </label>
                    <input
                      id="caixa-conta"
                      type="text"
                      value={formConta}
                      onChange={e => setFormConta(e.target.value)}
                      placeholder="Ex: 34022-6"
                      style={{
                        width: '100%',
                        height: 36,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: 13,
                      }}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="caixa-aceita-transferencia"
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: '#475569',
                        marginBottom: 4,
                      }}
                    >
                      Aceita transferências de outros caixas:
                    </label>
                    <select
                      id="caixa-aceita-transferencia"
                      value={formAceitaTransferencia}
                      onChange={e => setFormAceitaTransferencia(e.target.value as 'Não' | 'Sim')}
                      style={{
                        width: '100%',
                        height: 36,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: 13,
                      }}
                    >
                      <option value="Não">Não</option>
                      <option value="Sim">Sim</option>
                    </select>
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr',
                    gap: 12,
                  }}
                >
                  <div>
                    <label
                      htmlFor="caixa-aceita-baixa-outro"
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: '#475569',
                        marginBottom: 4,
                      }}
                    >
                      Aceita baixa de contas a pagar de outro usuário:
                    </label>
                    <select
                      id="caixa-aceita-baixa-outro"
                      value={formAceitaBaixaOutroUsuario}
                      onChange={e =>
                        setFormAceitaBaixaOutroUsuario(e.target.value as 'Não' | 'Sim')
                      }
                      style={{
                        width: '100%',
                        height: 36,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: 13,
                      }}
                    >
                      <option value="Não">Não</option>
                      <option value="Sim">Sim</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="caixa-saldo-inicial"
                      style={{
                        display: 'block',
                        fontSize: 12,
                        color: '#475569',
                        marginBottom: 4,
                      }}
                    >
                      Saldo Inicial de Abertura (R$):
                    </label>
                    <input
                      id="caixa-saldo-inicial"
                      type="number"
                      step="0.01"
                      value={formSaldoInicial}
                      onChange={e => setFormSaldoInicial(e.target.value)}
                      style={{
                        width: '100%',
                        height: 36,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: 13,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Botões do Rodapé: ✓ Gravar | ✕ Fechar (Idênticos à Imagem 3) */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: 10,
                  paddingTop: 12,
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <button
                  type="submit"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 18px',
                    borderRadius: 6,
                    border: '1px solid #0284c7',
                    background: 'linear-gradient(180deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                  }}
                >
                  <Check size={15} strokeWidth={2.5} />
                  Gravar
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '9px 16px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <X size={15} strokeWidth={2.5} />
                  Fechar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 2: CONFIRMAÇÃO DE STATUS (FECHAR CAIXA / REABRIR / VISTORIAR)
         ══════════════════════════════════════════════════════════════════════════ */}
      {statusActionModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-status-caixa-title"
          onClick={() => setStatusActionModal(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1010,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background:
                    statusActionModal.action === 'fechar'
                      ? '#fffbeb'
                      : statusActionModal.action === 'reabrir'
                      ? '#eff6ff'
                      : '#f5f3ff',
                  color:
                    statusActionModal.action === 'fechar'
                      ? '#d97706'
                      : statusActionModal.action === 'reabrir'
                      ? '#0284c7'
                      : '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {statusActionModal.action === 'fechar' && <Lock size={20} />}
                {statusActionModal.action === 'reabrir' && <Unlock size={20} />}
                {statusActionModal.action === 'vistoriar' && <ShieldCheck size={20} />}
              </div>
              <div>
                <h3
                  id="modal-status-caixa-title"
                  style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}
                >
                  {statusActionModal.action === 'fechar' && 'Fechar Caixa'}
                  {statusActionModal.action === 'reabrir' && 'Reabrir Caixa'}
                  {statusActionModal.action === 'vistoriar' && 'Vistoriar e Auditar Caixa'}
                </h3>
                <div style={{ fontSize: 12.5, color: '#64748b' }}>
                  Caixa #{statusActionModal.caixa.codigo} — {statusActionModal.caixa.descricao}
                </div>
              </div>
            </div>

            {(() => {
              const statusMetrics = getCaixaMetrics(statusActionModal.caixa)
              const isSaldoZerado = Math.abs(statusMetrics.saldoAtual) < 0.01
              const bloqueadoFechar = statusActionModal.action === 'fechar' && !isSaldoZerado
              return (
                <>
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: bloqueadoFechar ? '#fef2f2' : '#f8fafc',
                      border: `1px solid ${bloqueadoFechar ? '#fca5a5' : '#e2e8f0'}`,
                      fontSize: 12.5,
                      color: bloqueadoFechar ? '#991b1b' : '#334155',
                      marginBottom: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    {statusActionModal.action === 'fechar' && (
                      <>
                        <div style={{ marginBottom: 6 }}>
                          <strong>Saldo Atual Apurado:</strong>{' '}
                          <span
                            style={{
                              fontWeight: 900,
                              color: isSaldoZerado ? '#15803d' : '#b91c1c',
                            }}
                          >
                            {formatBRL(statusMetrics.saldoAtual)}
                          </span>
                        </div>
                        {isSaldoZerado ? (
                          <>
                            O caixa encontra-se <strong>Zerado (R$ 0,00)</strong> e pronto para
                            fechamento. Ao fechar, a situação mudará para <strong>Fechado</strong> e
                            ele não receberá novas baixas até ser reaberto.
                          </>
                        ) : (
                          <>
                            <strong>Bloqueado:</strong> Só é permitido fechar o caixa quando o saldo
                            estiver zerado (<strong>R$ 0,00</strong>).{' '}
                            {statusMetrics.saldoAtual > 0
                              ? 'Transfira o saldo positivo para outro caixa antes de fechar.'
                              : 'Regularize o saldo negativo antes de fechar.'}
                            {statusMetrics.saldoAtual > 0 && (
                              <div style={{ marginTop: 10 }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const cxTarget = statusActionModal.caixa
                                    setStatusActionModal(null)
                                    setTransferOrigemId(cxTarget.id)
                                    const destCandidato = cfgCaixas.find(
                                      c =>
                                        c.situacao === 'Aberto' &&
                                        c.id !== cxTarget.id &&
                                        c.aceitaTransferenciaOutrosCaixas
                                    )
                                    setTransferDestinoId(destCandidato?.id || '')
                                    setTransferValor(statusMetrics.saldoAtual.toFixed(2))
                                    setTransferObs(
                                      `Recolhimento para fechamento do Caixa ${cxTarget.codigo}`
                                    )
                                    setTransferModalOpen(true)
                                  }}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '7px 12px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: '#16a34a',
                                    color: '#ffffff',
                                    fontSize: 12,
                                    fontWeight: 800,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <ArrowRightLeft size={13} />
                                  Transferir {formatBRL(statusMetrics.saldoAtual)} para Zerar Caixa
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </>
                    )}
                    {statusActionModal.action === 'reabrir' && (
                      <>
                        O caixa voltará para a situação <strong>Aberto</strong>, ficando
                        imediatamente disponível para baixas em Contas a Pagar e Receber.
                      </>
                    )}
                    {statusActionModal.action === 'vistoriar' && (
                      <>
                        O caixa será marcado como <strong>Vistoriado</strong> por{' '}
                        <strong>{currentOperatorDisplay}</strong>, registrando a conferência na trilha
                        de auditoria (Saldo conferido: <strong>{formatBRL(statusMetrics.saldoAtual)}</strong>).
                      </>
                    )}
                  </div>

                  <div style={{ marginBottom: 18 }}>
                    <label
                      htmlFor="obs-operacao-caixa"
                      style={{
                        display: 'block',
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: '#475569',
                        marginBottom: 6,
                      }}
                    >
                      Observação de Auditoria (opcional):
                    </label>
                    <textarea
                      id="obs-operacao-caixa"
                      rows={3}
                      value={statusActionObs}
                      onChange={e => setStatusActionObs(e.target.value)}
                      placeholder="Ex: Conferência de fechamento de expediente sem divergências..."
                      style={{
                        width: '100%',
                        padding: 10,
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 13,
                        color: '#0f172a',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setStatusActionModal(null)}
                      style={{
                        padding: '9px 16px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#334155',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={bloqueadoFechar}
                      onClick={confirmStatusAction}
                      style={{
                        padding: '9px 18px',
                        borderRadius: 8,
                        border: 'none',
                        background: bloqueadoFechar
                          ? '#cbd5e1'
                          : statusActionModal.action === 'fechar'
                          ? '#d97706'
                          : statusActionModal.action === 'reabrir'
                          ? '#0284c7'
                          : '#7c3aed',
                        color: bloqueadoFechar ? '#64748b' : '#ffffff',
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: bloqueadoFechar ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {bloqueadoFechar ? 'Zere o Caixa para Fechar' : 'Confirmar'}
                    </button>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 3: TRANSFERÊNCIA ENTRE CAIXAS
         ══════════════════════════════════════════════════════════════════════════ */}
      {transferModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-transferencia-caixas-title"
          onClick={() => setTransferModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1010,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
              padding: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: '#eff6ff',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ArrowRightLeft size={20} />
                </div>
                <div>
                  <h3
                    id="modal-transferencia-caixas-title"
                    style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}
                  >
                    Transferência entre Caixas
                  </h3>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Respeita a permissão &ldquo;Aceita transferências de outros caixas&rdquo;
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTransferModalOpen(false)}
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmTransfer}>
              {(() => {
                const cxOrigemSel = cfgCaixas.find(c => c.id === transferOrigemId) || null
                const metricsOrigemSel = cxOrigemSel ? getCaixaMetrics(cxOrigemSel) : null
                const saldoOrigemDisp = metricsOrigemSel ? Math.max(0, metricsOrigemSel.saldoAtual) : 0
                return (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <label
                        htmlFor="transf-origem"
                        style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 5 }}
                      >
                        Caixa de Origem (Saída — Somente Saldo Positivo):
                      </label>
                      <select
                        id="transf-origem"
                        value={transferOrigemId}
                        onChange={e => setTransferOrigemId(e.target.value)}
                        style={{
                          width: '100%',
                          height: 38,
                          padding: '0 12px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 13,
                        }}
                      >
                        <option value="">Selecione o caixa de origem...</option>
                        {cfgCaixas
                          .filter(c => c.situacao === 'Aberto')
                          .map(c => {
                            const m = getCaixaMetrics(c)
                            return (
                              <option key={c.id} value={c.id}>
                                {c.codigo} - {c.descricao} — Saldo: {formatBRL(m.saldoAtual)}
                              </option>
                            )
                          })}
                      </select>
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label
                        htmlFor="transf-destino"
                        style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 5 }}
                      >
                        Caixa de Destino (Entrada):
                      </label>
                      <select
                        id="transf-destino"
                        value={transferDestinoId}
                        onChange={e => setTransferDestinoId(e.target.value)}
                        style={{
                          width: '100%',
                          height: 38,
                          padding: '0 12px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 13,
                        }}
                      >
                        <option value="">Selecione o caixa de destino...</option>
                        {cfgCaixas
                          .filter(c => c.situacao === 'Aberto' && c.id !== transferOrigemId)
                          .map(c => {
                            const m = getCaixaMetrics(c)
                            return (
                              <option key={c.id} value={c.id}>
                                {c.codigo} - {c.descricao} (Saldo: {formatBRL(m.saldoAtual)}){' '}
                                {c.aceitaTransferenciaOutrosCaixas
                                  ? '✓ (Aceita Transferência)'
                                  : '🔒 (Bloqueado p/ Transferência)'}
                              </option>
                            )
                          })}
                      </select>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 12,
                        marginBottom: 16,
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                          <label
                            htmlFor="transf-valor"
                            style={{ fontSize: 12.5, fontWeight: 600, color: '#475569' }}
                          >
                            Valor Positivo (R$):
                          </label>
                          {saldoOrigemDisp > 0 && (
                            <button
                              type="button"
                              onClick={() => setTransferValor(saldoOrigemDisp.toFixed(2))}
                              style={{
                                border: '1px solid #86efac',
                                background: '#dcfce7',
                                color: '#15803d',
                                borderRadius: 6,
                                padding: '2px 7px',
                                fontSize: 10.5,
                                fontWeight: 800,
                                cursor: 'pointer',
                              }}
                            >
                              100% • Zerar ({formatBRL(saldoOrigemDisp)})
                            </button>
                          )}
                        </div>
                        <input
                          id="transf-valor"
                          type="number"
                          step="0.01"
                          min="0.01"
                          max={saldoOrigemDisp > 0 ? saldoOrigemDisp : undefined}
                          required
                          value={transferValor}
                          onKeyDown={e => {
                            if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                              e.preventDefault()
                            }
                          }}
                          onChange={e => setTransferValor(e.target.value.replace(/-/g, ''))}
                          placeholder="0,00"
                          style={{
                            width: '100%',
                            height: 38,
                            padding: '0 12px',
                            borderRadius: 8,
                            border: '1px solid #cbd5e1',
                            fontSize: 13.5,
                            fontWeight: 700,
                          }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="transf-obs"
                          style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#475569', marginBottom: 5 }}
                        >
                          Motivo / Observação:
                        </label>
                        <input
                          id="transf-obs"
                          type="text"
                          value={transferObs}
                          onChange={e => setTransferObs(e.target.value)}
                          placeholder="Ex: Recolhimento para zerar caixa..."
                          style={{
                            width: '100%',
                            height: 38,
                            padding: '0 12px',
                            borderRadius: 8,
                            border: '1px solid #cbd5e1',
                            fontSize: 13,
                          }}
                        />
                      </div>
                    </div>
                  </>
                )
              })()}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '9px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Realizar Transferência
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL 4: INFO / FICHA COMPLETA E AUDITORIA DO CAIXA (BOTÃO "i")
         ══════════════════════════════════════════════════════════════════════════ */}
      {infoCaixa && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-info-caixa-title"
          onClick={() => setInfoCaixa(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1005,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? 12 : 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 740,
              maxHeight: '90vh',
              overflowY: 'auto',
              background: '#ffffff',
              borderRadius: 18,
              border: '1px solid #e2e8f0',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
            }}
          >
            {(() => {
              const m = getCaixaMetrics(infoCaixa)
              return (
                <>
                  {/* Cabeçalho */}
                  <div
                    style={{
                      padding: '18px 24px',
                      borderBottom: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          background: '#0284c7',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 14,
                        }}
                      >
                        #{infoCaixa.codigo}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <h3
                            id="modal-info-caixa-title"
                            style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}
                          >
                            {infoCaixa.descricao}
                          </h3>
                          {renderSituacaoBadge(infoCaixa.situacao)}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {infoCaixa.tipoCaixa} • {infoCaixa.unidadeEmpresa}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setInfoCaixa(null)}
                      aria-label="Fechar detalhes do caixa"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#64748b',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Resumo Financeiro do Caixa */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>
                          SALDO INICIAL
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
                          {formatBRL(m.saldoInicial)}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d' }}>
                          ENTRADAS / RECEB. ({m.qtdEntradas})
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a', marginTop: 4 }}>
                          {formatBRL(m.entradas)}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c' }}>
                          SAÍDAS / PAGAMENTOS ({m.qtdSaidas})
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626', marginTop: 4 }}>
                          {formatBRL(m.totalSaidas)}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                        }}
                      >
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8' }}>
                          SALDO APURADO ({m.qtdPagamentos} lcto{m.qtdPagamentos === 1 ? '' : 's'})
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#0284c7', marginTop: 4 }}>
                          {formatBRL(m.saldoAtual)}
                        </div>
                      </div>
                    </div>

                    {/* Metadados e Permissões */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: 12,
                        padding: 16,
                        borderRadius: 12,
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: 13,
                      }}
                    >
                      <div>
                        <strong>Data de Abertura:</strong> {formatDateBR(infoCaixa.dataAbertura)}
                      </div>
                      <div>
                        <strong>Aberto por:</strong> {infoCaixa.abertoPor || '—'}
                      </div>
                      <div>
                        <strong>Operador Responsável:</strong> {infoCaixa.operador || '—'}
                      </div>
                      <div>
                        <strong>Vistoriado por:</strong> {infoCaixa.vistoriadoPor || 'Não vistoriado'}
                      </div>
                      <div>
                        <strong>Agência / Conta:</strong>{' '}
                        {infoCaixa.agencia || infoCaixa.conta
                          ? `${infoCaixa.agencia || '—'} / ${infoCaixa.conta || '—'}`
                          : 'Caixa Interno (Sem agência/conta)'}
                      </div>
                      <div>
                        <strong>Conta Plano:</strong> {infoCaixa.contaPlanoLabel || '—'}
                      </div>
                      <div>
                        <strong>Aceita transferências de outros caixas:</strong>{' '}
                        <span
                          style={{
                            fontWeight: 700,
                            color: infoCaixa.aceitaTransferenciaOutrosCaixas ? '#16a34a' : '#64748b',
                          }}
                        >
                          {infoCaixa.aceitaTransferenciaOutrosCaixas ? 'Sim' : 'Não'}
                        </span>
                      </div>
                      <div>
                        <strong>Aceita baixa de Contas a Pagar de outro usuário:</strong>{' '}
                        <span
                          style={{
                            fontWeight: 700,
                            color: infoCaixa.aceitaBaixaContasPagarOutroUsuario
                              ? '#16a34a'
                              : '#64748b',
                          }}
                        >
                          {infoCaixa.aceitaBaixaContasPagarOutroUsuario ? 'Sim' : 'Não'}
                        </span>
                      </div>
                    </div>

                    {/* Histórico de Auditoria do Caixa */}
                    <div>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 800,
                          color: '#0f172a',
                          marginBottom: 8,
                        }}
                      >
                        Trilha de Auditoria do Caixa
                      </div>
                      <div
                        style={{
                          border: '1px solid #e2e8f0',
                          borderRadius: 10,
                          overflow: 'hidden',
                        }}
                      >
                        {(infoCaixa.historico || []).length === 0 ? (
                          <div style={{ padding: 14, fontSize: 12.5, color: '#64748b' }}>
                            Sem eventos adicionais registrados.
                          </div>
                        ) : (
                          (infoCaixa.historico || []).map((h, i) => (
                            <div
                              key={h.id || i}
                              style={{
                                padding: '10px 14px',
                                borderBottom:
                                  i < (infoCaixa.historico?.length || 0) - 1
                                    ? '1px solid #f1f5f9'
                                    : 'none',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 12,
                                fontSize: 12.5,
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 700, color: '#0284c7' }}>{h.acao}</span>{' '}
                                —{' '}
                                <span style={{ color: '#334155' }}>
                                  {h.observacao || (h as any).detalhes || 'Registro operacional do caixa.'}
                                </span>
                              </div>
                              <div style={{ color: '#64748b', whiteSpace: 'nowrap', fontSize: 11.5 }}>
                                {h.usuario} • {formatDateTimeBR(h.dataHora)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Ações rápidas dentro do Info */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10,
                        paddingTop: 12,
                        borderTop: '1px solid #e2e8f0',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => handleDeleteCaixa(infoCaixa)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '8px 14px',
                          borderRadius: 8,
                          border: '1px solid #fecaca',
                          background: '#fef2f2',
                          color: '#dc2626',
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={14} />
                        Excluir Caixa
                      </button>

                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => {
                            const target = infoCaixa
                            setInfoCaixa(null)
                            openEditModal(target)
                          }}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: '1px solid #d97706',
                            background: '#f59e0b',
                            color: '#ffffff',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Editar
                        </button>
                        {infoCaixa.situacao === 'Aberto' ? (
                          <button
                            type="button"
                            onClick={() => triggerStatusAction('fechar', infoCaixa)}
                            style={{
                              padding: '8px 14px',
                              borderRadius: 8,
                              border: 'none',
                              background: '#0284c7',
                              color: '#ffffff',
                              fontSize: 12.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Fechar Caixa
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => triggerStatusAction('reabrir', infoCaixa)}
                            style={{
                              padding: '8px 14px',
                              borderRadius: 8,
                              border: 'none',
                              background: '#2563eb',
                              color: '#ffffff',
                              fontSize: 12.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Reabrir Caixa
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => triggerStatusAction('vistoriar', infoCaixa)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#7c3aed',
                            color: '#ffffff',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Vistoriar
                        </button>
                        <button
                          type="button"
                          onClick={() => setInfoCaixa(null)}
                          style={{
                            padding: '8px 14px',
                            borderRadius: 8,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            fontSize: 12.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}
