'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { useConfigDb } from '@/lib/useConfigDb'
import { useApiQuery } from '@/hooks/useApi'
import { PageSkeleton } from '@/components/skeletons/PageSkeleton'
import { useData, newId } from '@/lib/dataContext'
import {
  RefreshCw, Plus, X, Trash2, FileText, CheckCircle, Search,
  Filter, TrendingDown, Printer, MessageCircle, FileSpreadsheet,
  Calendar, Calculator, AlertTriangle, Check, UserCheck,
  Pencil, ChevronDown, ChevronUp, Clock, RotateCcw, CreditCard,
  Phone, GraduationCap, DollarSign, Layers, Copy, MoreHorizontal, Eye
} from 'lucide-react'

export interface AcordoRenegociacao {
  id: string
  alunoNome: string
  responsavel: string
  telefoneResponsavel?: string
  turma?: string
  contaPlano?: string
  valorPrincipal?: number
  valorEncargos?: number
  valorOriginal: number
  valorEntrada?: number
  valorNegociado: number
  desconto: number
  parcelas: number
  formaPagamento?: string
  primeiroVencimento?: string
  data: string
  status: 'ativo' | 'quitado' | 'inadimplente'
  obs: string
  motivoInadimpl?: string
  titulosOriginaisIds?: string[]
}

const DEFAULT_CONTA_PLANO = '00.06.02 - Acordos e parcelamentos'

function getToday() {
  return new Date().toISOString().slice(0, 10)
}

function fmt(d?: string) {
  if (!d) return '—'
  const [y, m, dia] = d.slice(0, 10).split('-')
  if (!y || !m || !dia) return d
  return `${dia}/${m}/${y}`
}

const fmtCur = (v: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function diasAtraso(vencimento?: string) {
  if (!vencimento) return 0
  const d = Math.floor(
    (new Date(getToday() + 'T12:00:00').getTime() - new Date(vencimento.slice(0, 10) + 'T12:00:00').getTime()) /
      86400000
  )
  return Math.max(0, d)
}

function calcularMultaJuros(valor: number, dias: number) {
  if (dias <= 0 || valor <= 0) return { multa: 0, juros: 0, totalEncargos: 0 }
  const multa = Math.round(valor * 0.02 * 100) / 100
  const juros = Math.round(valor * (0.01 / 30) * dias * 100) / 100
  return { multa, juros, totalEncargos: Math.round((multa + juros) * 100) / 100 }
}

const MOTIVOS = [
  'Dificuldade financeira',
  'Desemprego',
  'Doença na família',
  'Esquecimento / Divergência de boleto',
  'Mudança de cidade / Transferência',
  'Outros',
]

const FORMAS_PAGAMENTO = ['PIX', 'Boleto', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência', 'Dinheiro']

const STATUS_BADGE = {
  ativo: { bg: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.3)', cor: '#0891b2', label: '● Acordo Ativo' },
  quitado: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', cor: '#059669', label: '✓ Quitado' },
  inadimplente: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)', cor: '#dc2626', label: '⚠ Quebra / Atraso' },
}

export default function RenegociacaoPage() {
  const queryClient = useQueryClient()
  const [alunos, , { loading: l1 }] = useSupabaseArray<any>('alunos')
  const [turmasDb] = useSupabaseArray<any>('turmas')
  const [ctxTitulos] = useSupabaseArray<any>('titulos')
  const { data: apiTitulosRes, isLoading: l2 } = useApiQuery<{ data?: any[] } | any[]>(
    ['titulos-receber'],
    '/api/titulos',
    { limit: 2500 },
    { staleTime: 25_000, gcTime: 300_000 }
  )
  const { data: acordosRaw, setData: setAcordos } = useConfigDb<AcordoRenegociacao>('fin_acordos_renegociacao', [])
  const { data: cfgPlanoContasDb } = useConfigDb<any>('cfgPlanoContas', [])
  const acordos = useMemo(() => (Array.isArray(acordosRaw) ? acordosRaw : []), [acordosRaw])
  const { turmas: ctxTurmas, cfgPlanoContas: ctxPlanoContas, logSystemAction } = useData()
  const escolaNome = 'Colégio Impacto'

  const turmasList = useMemo(() => {
    if (Array.isArray(turmasDb) && turmasDb.length > 0) return turmasDb
    if (Array.isArray(ctxTurmas) && ctxTurmas.length > 0) return ctxTurmas
    return []
  }, [turmasDb, ctxTurmas])

  // Mapa rápido de ID/código de turma -> Nome da turma (combina tabela turmas + turma_nome dos alunos)
  const turmaIdToNomeMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const t of turmasList) {
      const nome = String(t?.nome || t?.dados?.nome || t?.serie || '').trim()
      if (!nome) continue
      if (t?.id !== undefined && t?.id !== null) map.set(String(t.id).trim(), nome)
      if (t?.codigo !== undefined && t?.codigo !== null) map.set(String(t.codigo).trim(), nome)
      if (t?.dados?.id !== undefined && t?.dados?.id !== null) map.set(String(t.dados.id).trim(), nome)
      if (t?.dados?.codigo !== undefined && t?.dados?.codigo !== null) map.set(String(t.dados.codigo).trim(), nome)
      map.set(nome.toLowerCase(), nome)
    }
    for (const al of alunos || []) {
      const tId = String(al?.turma || al?.turma_id || al?.dados?.turma || '').trim()
      const tNome = String(al?.turma_nome || al?.dados?.turma_nome || al?.dados?.turmaNome || '').trim()
      if (tId && tNome && tNome !== tId && !/^\d+$/.test(tNome)) {
        if (!map.has(tId)) map.set(tId, tNome)
      }
    }
    return map
  }, [turmasList, alunos])

  const resolveTurmaNome = useCallback(
    (rawTurma?: string, alunoNome?: string): string => {
      const raw = String(rawTurma || '').trim()
      const alunoCad = alunoNome
        ? (alunos || []).find(
            (al: any) => String(al?.nome || '').trim().toLowerCase() === String(alunoNome).trim().toLowerCase()
          )
        : null

      // 1. Se raw existe no mapa de IDs/códigos -> retorna o nome da turma correspondente
      if (raw) {
        const mapped = turmaIdToNomeMap.get(raw) || turmaIdToNomeMap.get(raw.toLowerCase())
        if (mapped) return mapped
      }

      // 2. Se encontramos o cadastro do aluno, verifica turma_nome ou resolve o ID da turma do aluno
      if (alunoCad) {
        const cadTurmaNome = String(
          alunoCad.turma_nome || alunoCad.dados?.turma_nome || alunoCad.dados?.turmaNome || ''
        ).trim()
        if (cadTurmaNome && !/^\d+$/.test(cadTurmaNome)) {
          return cadTurmaNome
        }
        if (cadTurmaNome && turmaIdToNomeMap.has(cadTurmaNome)) {
          return turmaIdToNomeMap.get(cadTurmaNome)!
        }

        const cadTurmaId = String(alunoCad.turma || alunoCad.turma_id || alunoCad.dados?.turma || '').trim()
        if (cadTurmaId && turmaIdToNomeMap.has(cadTurmaId)) {
          return turmaIdToNomeMap.get(cadTurmaId)!
        }

        const hist = Array.isArray(alunoCad.historicoTurmas)
          ? alunoCad.historicoTurmas
          : Array.isArray(alunoCad.dados?.historicoTurmas)
            ? alunoCad.dados.historicoTurmas
            : []
        for (let i = hist.length - 1; i >= 0; i--) {
          const h = hist[i]
          const hCandidate = String(h?.turmaNome || h?.serieTurma || h?.turma || '').trim()
          if (!hCandidate) continue
          if (turmaIdToNomeMap.has(hCandidate)) return turmaIdToNomeMap.get(hCandidate)!
          if (!/^\d+$/.test(hCandidate)) return hCandidate
        }

        const cadSerie = String(alunoCad.serie || alunoCad.dados?.serie || '').trim()
        if (cadSerie && !/^\d+$/.test(cadSerie)) {
          return cadSerie
        }
      }

      // 3. Se raw não for apenas números (já é o nome da turma), retorna raw
      if (raw && !/^\d+$/.test(raw)) {
        return raw
      }

      return raw
    },
    [alunos, turmaIdToNomeMap]
  )

  // Opções de Conta do Plano de Contas (com 00.06.02 - Acordos e parcelamentos garantido e padrão)
  const opcoesContaPlano = useMemo(() => {
    const rawList =
      Array.isArray(cfgPlanoContasDb) && cfgPlanoContasDb.length > 0
        ? cfgPlanoContasDb
        : Array.isArray(ctxPlanoContas)
          ? ctxPlanoContas
          : []

    const map = new Map<
      string,
      { value: string; label: string; codPlano: string; descricao: string; id?: string; tipo?: string }
    >()

    map.set('00.06.02', {
      value: DEFAULT_CONTA_PLANO,
      label: '00.06.02 — Acordos e parcelamentos',
      codPlano: '00.06.02',
      descricao: 'Acordos e parcelamentos',
    })

    for (const c of rawList) {
      if (!c || c.situacao === 'Inativo') continue
      const cod = String(c.codPlano || '').trim()
      const desc = String(c.descricao || '').trim()
      if (!cod && !desc) continue
      const isDefault = cod === '00.06.02'
      const value = isDefault
        ? DEFAULT_CONTA_PLANO
        : cod && desc
          ? `${cod} - ${desc}`
          : cod || desc
      const label = isDefault
        ? '00.06.02 — Acordos e parcelamentos'
        : cod && desc
          ? `${cod} — ${desc}`
          : cod || desc
      map.set(cod || value, {
        value,
        label,
        codPlano: cod,
        descricao: isDefault ? 'Acordos e parcelamentos' : desc,
        id: c.id,
        tipo: c.tipo,
      })
    }

    return Array.from(map.values()).sort((a, b) =>
      a.codPlano.localeCompare(b.codPlano, undefined, { numeric: true })
    )
  }, [cfgPlanoContasDb, ctxPlanoContas])

  const resolveContaPlanoValue = useCallback(
    (raw?: string): string => {
      const val = String(raw || '').trim()
      if (!val) return DEFAULT_CONTA_PLANO
      if (val.startsWith('00.06.02') || val.toLowerCase().includes('acordos e parcelamentos')) {
        return DEFAULT_CONTA_PLANO
      }
      const exact = opcoesContaPlano.find(
        (o) => o.value === val || o.codPlano === val || o.id === val || o.label === val
      )
      return exact ? exact.value : val
    },
    [opcoesContaPlano]
  )

  useEffect(() => {
    fetch('/api/configuracoes?chave=fin_acordos_renegociacao')
      .then((r) => (r.ok ? r.json() : null))
      .then((val) => {
        if (Array.isArray(val) && val.length > 0 && acordos.length === 0) {
          setAcordos(val)
        }
      })
      .catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-healing: se algum acordo salvo tinha ID numérico de turma (ex: "6188"), atualiza para o nome real da turma
  useEffect(() => {
    if (!acordos.length || (turmaIdToNomeMap.size === 0 && (!alunos || alunos.length === 0))) return
    let changed = false
    const next = acordos.map((a) => {
      const resolved = resolveTurmaNome(a.turma, a.alunoNome)
      const conta = a.contaPlano || DEFAULT_CONTA_PLANO
      if ((resolved && resolved !== a.turma && /^\d+$/.test(String(a.turma || '').trim())) || !a.contaPlano) {
        changed = true
        return {
          ...a,
          turma: resolved || a.turma,
          contaPlano: conta,
        }
      }
      return a
    })
    if (changed) {
      setAcordos(next)
    }
  }, [acordos, turmaIdToNomeMap.size, alunos, resolveTurmaNome, setAcordos])

  const hoje = useMemo(() => getToday(), [])

  // Normaliza títulos de contas a receber para detectar atrasos reais
  const titulosNormalizados = useMemo(() => {
    const listaBruta: any[] = Array.isArray(apiTitulosRes)
      ? apiTitulosRes
      : Array.isArray(apiTitulosRes?.data)
        ? apiTitulosRes.data
        : Array.isArray(ctxTitulos)
          ? ctxTitulos
          : []

    return listaBruta
      .filter((t: any) => t && t.status !== 'excluido' && t.status !== 'cancelado')
      .map((t: any) => {
        const venc = String(t.vencimento || '').slice(0, 10)
        const isVencido = (t.status === 'pendente' || t.status === 'atrasado' || t.status === 'vencido') && venc && venc < hoje
        return {
          ...t,
          valor: Number(t.valor) || 0,
          statusEfetivo: t.status === 'pago' ? 'pago' : t.status === 'renegociado' ? 'renegociado' : isVencido ? 'atrasado' : t.status,
          diasEmAtraso: isVencido ? diasAtraso(venc) : 0,
        }
      })
  }, [apiTitulosRes, ctxTitulos, hoje])

  const titulosAtrasados = useMemo(
    () => titulosNormalizados.filter((t) => t.statusEfetivo === 'atrasado'),
    [titulosNormalizados]
  )

  // Agrupamento de inadimplência por aluno (combina títulos vencidos + flag aluno.inadimplente)
  const radarInadimplencia = useMemo(() => {
    const map = new Map<
      string,
      {
        alunoNome: string
        responsavel: string
        telefone: string
        turma: string
        qtdTitulos: number
        valorPrincipal: number
        valorEncargos: number
        maiorAtraso: number
        titulosIds: string[]
      }
    >()

    for (const t of titulosAtrasados) {
      const nome = (t.aluno || '').trim()
      if (!nome) continue
      const alunoCad = (alunos || []).find((a: any) => a.nome === nome)
      const enc = calcularMultaJuros(t.valor, t.diasEmAtraso)
      const prev = map.get(nome) || {
        alunoNome: nome,
        responsavel: t.responsavel || alunoCad?.responsavel || '',
        telefone: alunoCad?.telResponsavel || alunoCad?.telefone || '',
        turma: resolveTurmaNome(alunoCad?.turma_nome || alunoCad?.turma || t.turma, nome),
        qtdTitulos: 0,
        valorPrincipal: 0,
        valorEncargos: 0,
        maiorAtraso: 0,
        titulosIds: [] as string[],
      }
      prev.qtdTitulos += 1
      prev.valorPrincipal = Math.round((prev.valorPrincipal + t.valor) * 100) / 100
      prev.valorEncargos = Math.round((prev.valorEncargos + enc.totalEncargos) * 100) / 100
      prev.maiorAtraso = Math.max(prev.maiorAtraso, t.diasEmAtraso)
      prev.titulosIds.push(t.id)
      map.set(nome, prev)
    }

    for (const a of alunos || []) {
      if (a?.inadimplente && a?.nome && !map.has(a.nome)) {
        map.set(a.nome, {
          alunoNome: a.nome,
          responsavel: a.responsavel || '',
          telefone: a.telResponsavel || a.telefone || '',
          turma: resolveTurmaNome(a.turma_nome || a.turma, a.nome),
          qtdTitulos: 0,
          valorPrincipal: Number(a.mensalidade || 0),
          valorEncargos: 0,
          maiorAtraso: 30,
          titulosIds: [],
        })
      }
    }

    return Array.from(map.values()).sort((a, b) => b.valorPrincipal - a.valorPrincipal)
  }, [titulosAtrasados, alunos, resolveTurmaNome])

  // Estados de UI e Filtros
  const [showModal, setShowModal] = useState(false)
  const [editingAcordo, setEditingAcordo] = useState<AcordoRenegociacao | null>(null)
  const [recalcularParcelasNoEdit, setRecalcularParcelasNoEdit] = useState(false)
  const [detalheAcordoId, setDetalheAcordoId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [editingParcelaId, setEditingParcelaId] = useState<string | null>(null)
  const [parcelaEditForm, setParcelaEditForm] = useState({
    valor: '',
    vencimento: '',
    pagamento: '',
    metodo: 'PIX',
    status: 'pendente' as 'pago' | 'pendente' | 'atrasado',
  })
  const [busyParcelaId, setBusyParcelaId] = useState<string | null>(null)

  const acordoDetalhe = useMemo(
    () => (detalheAcordoId ? (acordos || []).find((a) => a.id === detalheAcordoId) || null : null),
    [acordos, detalheAcordoId]
  )

  useEffect(() => {
    const handleGlobalClick = () => {
      setOpenMenuId(null)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenMenuId(null)
      }
    }
    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const [showRadar, setShowRadar] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativo' | 'quitado' | 'inadimplente'>('todos')
  const [search, setSearch] = useState('')
  const [filtroMotivo, setFiltroMotivo] = useState('Todos')
  const [showFilters, setShowFilters] = useState(false)
  const [confirmDeleteAcordo, setConfirmDeleteAcordo] = useState<AcordoRenegociacao | null>(null)
  const [restaurarTitulosAoExcluir, setRestaurarTitulosAoExcluir] = useState(true)
  const [saving, setSaving] = useState(false)

  // Estados do Modal de Novo / Editar Acordo
  const [buscaAluno, setBuscaAluno] = useState('')
  const [showAlunoDropdown, setShowAlunoDropdown] = useState(false)
  const [selectedTituloIds, setSelectedTituloIds] = useState<string[]>([])
  const [incluirEncargos, setIncluirEncargos] = useState(true)

  const [form, setForm] = useState({
    alunoNome: '',
    responsavel: '',
    telefoneResponsavel: '',
    turma: '',
    contaPlano: DEFAULT_CONTA_PLANO,
    valorOriginal: '',
    valorNegociado: '',
    valorEntrada: '0',
    desconto: '0',
    parcelas: '3',
    formaPagamento: 'PIX',
    primeiroVencimento: getToday(),
    data: getToday(),
    status: 'ativo' as AcordoRenegociacao['status'],
    obs: '',
    motivoInadimpl: 'Dificuldade financeira',
  })

  // Se o modal estiver aberto e o campo turma estiver com um ID numérico (ex: "6188"), converte para o nome da turma assim que carregar
  useEffect(() => {
    if (!showModal || !form.alunoNome) return
    const rawT = String(form.turma || '').trim()
    if (!rawT || /^\d+$/.test(rawT)) {
      const resolved = resolveTurmaNome(rawT, form.alunoNome)
      if (resolved && resolved !== rawT) {
        setForm((f) => ({ ...f, turma: resolved }))
      }
    }
  }, [showModal, form.alunoNome, form.turma, resolveTurmaNome])

  const handleOpenDetalhesModal = useCallback((a: AcordoRenegociacao) => {
    setOpenMenuId(null)
    setEditingParcelaId(null)
    setDetalheAcordoId(a.id)
  }, [])

  const resetModalState = useCallback(() => {
    setEditingAcordo(null)
    setRecalcularParcelasNoEdit(false)
    setBuscaAluno('')
    setSelectedTituloIds([])
    setShowAlunoDropdown(false)
    setForm({
      alunoNome: '',
      responsavel: '',
      telefoneResponsavel: '',
      turma: '',
      contaPlano: DEFAULT_CONTA_PLANO,
      valorOriginal: '',
      valorNegociado: '',
      valorEntrada: '0',
      desconto: '0',
      parcelas: '3',
      formaPagamento: 'PIX',
      primeiroVencimento: getToday(),
      data: getToday(),
      status: 'ativo',
      obs: '',
      motivoInadimpl: 'Dificuldade financeira',
    })
  }, [])

  const handleOpenNewModal = useCallback(() => {
    resetModalState()
    setShowModal(true)
  }, [resetModalState])

  const handleOpenEditModal = useCallback(
    (a: AcordoRenegociacao) => {
      const alunoCad = (alunos || []).find((al: any) => al.nome === a.alunoNome)
      const turmaNomeResolvido = resolveTurmaNome(a.turma || alunoCad?.turma_nome || alunoCad?.turma, a.alunoNome)
      setEditingAcordo(a)
      setRecalcularParcelasNoEdit(false)
      setBuscaAluno(a.alunoNome || '')
      setSelectedTituloIds(Array.isArray(a.titulosOriginaisIds) ? a.titulosOriginaisIds : [])
      setShowAlunoDropdown(false)
      setForm({
        alunoNome: a.alunoNome || '',
        responsavel: a.responsavel || alunoCad?.responsavel || '',
        telefoneResponsavel: a.telefoneResponsavel || alunoCad?.telResponsavel || alunoCad?.telefone || '',
        turma: turmaNomeResolvido,
        contaPlano: resolveContaPlanoValue(a.contaPlano),
        valorOriginal: String(Number(a.valorOriginal || a.valorNegociado || 0).toFixed(2)),
        valorNegociado: String(Number(a.valorNegociado || 0).toFixed(2)),
        valorEntrada: String(Number(a.valorEntrada || 0).toFixed(2)),
        desconto: String(Number(a.desconto || 0)),
        parcelas: String(Math.max(1, Number(a.parcelas) || 1)),
        formaPagamento: a.formaPagamento || 'PIX',
        primeiroVencimento: a.primeiroVencimento || a.data || getToday(),
        data: a.data || getToday(),
        status: a.status || 'ativo',
        obs: a.obs || '',
        motivoInadimpl: a.motivoInadimpl || 'Dificuldade financeira',
      })
      setShowModal(true)
    },
    [alunos, resolveTurmaNome, resolveContaPlanoValue]
  )

  // Títulos em aberto/vencidos do aluno selecionado no modal
  const titulosDoAlunoNoModal = useMemo(() => {
    if (!form.alunoNome) return []
    return titulosNormalizados.filter(
      (t) =>
        t.aluno === form.alunoNome &&
        ((t.statusEfetivo === 'atrasado' || t.statusEfetivo === 'pendente') ||
          (editingAcordo && t.acordoId === editingAcordo.id && t.status === 'renegociado')) &&
        !String(t.descricao || '').startsWith('Acordo Renegociação')
    )
  }, [titulosNormalizados, form.alunoNome, editingAcordo])

  // Recalcula valor original + encargos quando muda seleção de títulos ou toggle de encargos
  const resumoCalculoTitulos = useMemo(() => {
    const selecionados = titulosDoAlunoNoModal.filter((t) => selectedTituloIds.includes(t.id))
    let principal = 0
    let encargos = 0
    for (const t of selecionados) {
      principal += Number(t.valor) || 0
      const enc = calcularMultaJuros(Number(t.valor) || 0, t.diasEmAtraso)
      encargos += enc.totalEncargos
    }
    principal = Math.round(principal * 100) / 100
    encargos = Math.round(encargos * 100) / 100
    const baseAtualizada = Math.round((principal + (incluirEncargos ? encargos : 0)) * 100) / 100
    return { principal, encargos, baseAtualizada }
  }, [titulosDoAlunoNoModal, selectedTituloIds, incluirEncargos])

  const aplicarCalculoBase = useCallback(
    (novaBase: number, descPctStr: string) => {
      const descNum = Math.min(100, Math.max(0, parseFloat(descPctStr) || 0))
      const neg = Math.round(novaBase * (1 - descNum / 100) * 100) / 100
      setForm((f) => ({
        ...f,
        valorOriginal: novaBase > 0 ? novaBase.toFixed(2) : f.valorOriginal,
        valorNegociado: novaBase > 0 ? neg.toFixed(2) : f.valorNegociado,
      }))
    },
    []
  )

  useEffect(() => {
    if (!editingAcordo && selectedTituloIds.length > 0) {
      aplicarCalculoBase(resumoCalculoTitulos.baseAtualizada, form.desconto)
    }
  }, [resumoCalculoTitulos.baseAtualizada, selectedTituloIds.length, editingAcordo, aplicarCalculoBase, form.desconto])

  const handleSelectAluno = useCallback(
    (nome: string) => {
      const aluno = (alunos || []).find((a: any) => a.nome === nome)
      const tits = titulosNormalizados.filter(
        (t) =>
          t.aluno === nome &&
          (t.statusEfetivo === 'atrasado' || t.statusEfetivo === 'pendente') &&
          !String(t.descricao || '').startsWith('Acordo Renegociação')
      )
      const atrasadosIds = tits.filter((t) => t.statusEfetivo === 'atrasado').map((t) => t.id)
      const initialIds = atrasadosIds.length > 0 ? atrasadosIds : tits.map((t) => t.id)
      setSelectedTituloIds(initialIds)

      let principal = 0
      let encargos = 0
      for (const t of tits.filter((x) => initialIds.includes(x.id))) {
        principal += Number(t.valor) || 0
        encargos += calcularMultaJuros(Number(t.valor) || 0, t.diasEmAtraso).totalEncargos
      }
      if (principal === 0 && aluno?.mensalidade) {
        principal = Number(aluno.mensalidade) || 0
      }

      const base = Math.round((principal + (incluirEncargos ? encargos : 0)) * 100) / 100
      const descDefault = base > 0 ? '10' : '0'
      const negDefault = Math.round(base * 0.9 * 100) / 100
      const turmaNomeResolvido = resolveTurmaNome(aluno?.turma_nome || aluno?.turma || tits[0]?.turma, nome)

      setForm((f) => ({
        ...f,
        alunoNome: nome,
        responsavel: aluno?.responsavel || tits[0]?.responsavel || '',
        telefoneResponsavel: aluno?.telResponsavel || aluno?.telefone || '',
        turma: turmaNomeResolvido,
        contaPlano: f.contaPlano || DEFAULT_CONTA_PLANO,
        valorOriginal: base > 0 ? base.toFixed(2) : f.valorOriginal,
        valorNegociado: base > 0 ? negDefault.toFixed(2) : f.valorNegociado,
        desconto: base > 0 ? descDefault : f.desconto,
        valorEntrada: '0',
      }))
      setBuscaAluno(nome)
      setShowAlunoDropdown(false)
    },
    [alunos, titulosNormalizados, incluirEncargos, resolveTurmaNome]
  )

  const handleDescontoChange = (desc: string) => {
    const orig = parseFloat(form.valorOriginal) || 0
    const descNum = Math.min(100, Math.max(0, parseFloat(desc) || 0))
    if (editingAcordo) setRecalcularParcelasNoEdit(true)
    setForm((f) => ({
      ...f,
      desconto: desc,
      valorNegociado: orig > 0 ? (orig * (1 - descNum / 100)).toFixed(2) : f.valorNegociado,
    }))
  }

  const handleValorNegChange = (val: string) => {
    const orig = parseFloat(form.valorOriginal) || 0
    const negNum = Math.max(0, parseFloat(val) || 0)
    const desc = orig > 0 ? Math.max(0, (1 - negNum / orig) * 100).toFixed(1) : '0'
    if (editingAcordo) setRecalcularParcelasNoEdit(true)
    setForm((f) => ({ ...f, valorNegociado: val, desconto: desc }))
  }

  // Cronograma de parcelas simulado no modal
  const cronogramaSimulado = useMemo(() => {
    const totalNeg = Math.max(0, parseFloat(form.valorNegociado) || 0)
    const entrada = Math.min(totalNeg, Math.max(0, parseFloat(form.valorEntrada) || 0))
    const nParcelas = Math.max(1, parseInt(form.parcelas) || 1)
    const saldoParcelar = Math.max(0, Math.round((totalNeg - entrada) * 100) / 100)
    const baseData = new Date((form.primeiroVencimento || hoje) + 'T12:00:00')

    const items: Array<{ numero: string; vencimento: string; valor: number; tipo: 'entrada' | 'parcela' }> = []

    if (entrada > 0) {
      items.push({
        numero: 'Entrada',
        vencimento: form.data || hoje,
        valor: entrada,
        tipo: 'entrada',
      })
    }

    if (saldoParcelar > 0) {
      const valorParcelaBase = Math.floor((saldoParcelar / nParcelas) * 100) / 100
      for (let idx = 0; idx < nParcelas; idx++) {
        const vencDate = new Date(baseData)
        vencDate.setMonth(vencDate.getMonth() + idx)
        const isUltima = idx === nParcelas - 1
        const valParc = isUltima
          ? Number((saldoParcelar - valorParcelaBase * (nParcelas - 1)).toFixed(2))
          : valorParcelaBase
        items.push({
          numero: `${idx + 1}/${nParcelas}`,
          vencimento: vencDate.toISOString().slice(0, 10),
          valor: valParc,
          tipo: 'parcela',
        })
      }
    }

    return { totalNeg, entrada, saldoParcelar, nParcelas, items }
  }, [form.valorNegociado, form.valorEntrada, form.parcelas, form.primeiroVencimento, form.data, hoje])

  // Progresso e detalhes completos por acordo (parcelas reais, projetadas, originais, datas, saldos)
  const detalhesPorAcordo = useMemo(() => {
    const map = new Map<
      string,
      {
        parcelasReais: any[]
        parcelasExibicao: any[]
        isVirtual: boolean
        originais: any[]
        totalParcelas: number
        pagas: number
        atrasadas: number
        pendentes: number
        valorRecebido: number
        saldoRestante: number
        pctPago: number
        proximoVencimento: string | null
        proximoStatus: 'quitado' | 'atrasado' | 'hoje' | 'pendente'
        ultimoPagamento: string | null
        turma: string
        contaPlano: string
        responsavel: string
        telefone: string
      }
    >()

    for (const a of acordos || []) {
      const alunoCad = (alunos || []).find((al: any) => al.nome === a.alunoNome)
      const parcelasReais = titulosNormalizados
        .filter(
          (t) =>
            t.status !== 'renegociado' &&
            (t.acordoId === a.id ||
              String(t.codigo || '').startsWith(`${a.id}-`) ||
              String(t.id || '').startsWith(`${a.id}-`))
        )
        .sort((x, y) => {
          const vx = String(x.vencimento || '')
          const vy = String(y.vencimento || '')
          if (vx !== vy) return vx.localeCompare(vy)
          return String(x.id || '').localeCompare(String(y.id || ''))
        })

      const originais = titulosNormalizados.filter(
        (t) =>
          (t.status === 'renegociado' &&
            (t.acordoId === a.id || String(t.descricao || '').includes(`[Reneg. ${a.id}]`))) ||
          (Array.isArray(a.titulosOriginaisIds) && a.titulosOriginaisIds.includes(t.id))
      )

      const contaPlanoAcordo = resolveContaPlanoValue(
        a.contaPlano || parcelasReais[0]?.contaPlano || parcelasReais[0]?.planoContas
      )
      const turmaNomeResolvido = resolveTurmaNome(a.turma || alunoCad?.turma_nome || alunoCad?.turma, a.alunoNome)

      let parcelasExibicao = parcelasReais
      let isVirtual = false

      if (parcelasReais.length === 0) {
        isVirtual = true
        const nParc = Math.max(1, Number(a.parcelas) || 1)
        const entrada = Math.min(a.valorNegociado, Math.max(0, Number(a.valorEntrada) || 0))
        const saldo = Math.max(0, Math.round((a.valorNegociado - entrada) * 100) / 100)
        const baseDt = new Date((a.primeiroVencimento || a.data || hoje) + 'T12:00:00')
        const virt: any[] = []

        if (entrada > 0) {
          const vencEnt = a.data || hoje
          const statusEnt = a.status === 'quitado' ? 'pago' : vencEnt < hoje ? 'atrasado' : 'pendente'
          virt.push({
            id: `${a.id}-ENT`,
            codigo: `${a.id}-ENT`,
            aluno: a.alunoNome,
            responsavel: a.responsavel || alunoCad?.responsavel || '',
            descricao: 'Acordo Renegociação',
            valor: entrada,
            vencimento: vencEnt,
            pagamento: a.status === 'quitado' ? vencEnt : null,
            status: a.status === 'quitado' ? 'pago' : 'pendente',
            statusEfetivo: statusEnt,
            diasEmAtraso: statusEnt === 'atrasado' ? diasAtraso(vencEnt) : 0,
            metodo: a.formaPagamento || 'PIX',
            parcela: 'Entrada',
            totalParcelas: 1,
            contaPlano: contaPlanoAcordo,
            planoContas: contaPlanoAcordo,
            turma: turmaNomeResolvido || undefined,
            origemLanca: 'renegociacao',
            acordoId: a.id,
            isVirtual: true,
          })
        }

        if (saldo > 0) {
          const baseVal = Math.floor((saldo / nParc) * 100) / 100
          for (let i = 0; i < nParc; i++) {
            const dt = new Date(baseDt)
            dt.setMonth(dt.getMonth() + i)
            const vencStr = dt.toISOString().slice(0, 10)
            const isLast = i === nParc - 1
            const valP = isLast ? Number((saldo - baseVal * (nParc - 1)).toFixed(2)) : baseVal
            const suf = `P${String(i + 1).padStart(2, '0')}`
            const stEf = a.status === 'quitado' ? 'pago' : vencStr < hoje ? 'atrasado' : 'pendente'
            virt.push({
              id: `${a.id}-${suf}`,
              codigo: `${a.id}-${suf}`,
              aluno: a.alunoNome,
              responsavel: a.responsavel || alunoCad?.responsavel || '',
              descricao: 'Acordo Renegociação',
              valor: valP,
              vencimento: vencStr,
              pagamento: a.status === 'quitado' ? vencStr : null,
              status: a.status === 'quitado' ? 'pago' : 'pendente',
              statusEfetivo: stEf,
              diasEmAtraso: stEf === 'atrasado' ? diasAtraso(vencStr) : 0,
              metodo: a.formaPagamento || 'PIX',
              parcela: `${i + 1}/${nParc}`,
              totalParcelas: nParc,
              contaPlano: contaPlanoAcordo,
              planoContas: contaPlanoAcordo,
              turma: turmaNomeResolvido || undefined,
              origemLanca: 'renegociacao',
              acordoId: a.id,
              isVirtual: true,
            })
          }
        }
        parcelasExibicao = virt
      }

      const pagas = parcelasExibicao.filter((t) => t.statusEfetivo === 'pago').length
      const atrasadas = parcelasExibicao.filter((t) => t.statusEfetivo === 'atrasado').length
      const pendentes = parcelasExibicao.filter((t) => t.statusEfetivo === 'pendente').length
      const valorRecebidoRaw = parcelasExibicao
        .filter((t) => t.statusEfetivo === 'pago')
        .reduce((acc, t) => acc + (Number(t.valor) || 0), 0)
      const valorRecebido = Math.round(valorRecebidoRaw * 100) / 100
      const saldoRestante = Math.max(0, Math.round((Number(a.valorNegociado || 0) - valorRecebido) * 100) / 100)
      const totalParcelas = Math.max(1, parcelasExibicao.length)
      const pctPago = Math.min(100, Math.round((pagas / totalParcelas) * 100))

      const naoPagas = parcelasExibicao.filter((t) => t.statusEfetivo !== 'pago')
      const proximoVencimento = naoPagas.length > 0 ? String(naoPagas[0].vencimento || '').slice(0, 10) : null
      let proximoStatus: 'quitado' | 'atrasado' | 'hoje' | 'pendente' = 'quitado'
      if (proximoVencimento) {
        if (proximoVencimento < hoje) proximoStatus = 'atrasado'
        else if (proximoVencimento === hoje) proximoStatus = 'hoje'
        else proximoStatus = 'pendente'
      }

      const pagasComData = parcelasExibicao
        .filter((t) => t.statusEfetivo === 'pago' && t.pagamento)
        .map((t) => String(t.pagamento).slice(0, 10))
        .sort()
      const ultimoPagamento = pagasComData.length > 0 ? pagasComData[pagasComData.length - 1] : null

      map.set(a.id, {
        parcelasReais,
        parcelasExibicao,
        isVirtual,
        originais,
        totalParcelas,
        pagas,
        atrasadas,
        pendentes,
        valorRecebido,
        saldoRestante,
        pctPago,
        proximoVencimento,
        proximoStatus,
        ultimoPagamento,
        turma: turmaNomeResolvido,
        contaPlano: contaPlanoAcordo,
        responsavel: a.responsavel || alunoCad?.responsavel || '',
        telefone: a.telefoneResponsavel || alunoCad?.telResponsavel || alunoCad?.telefone || '',
      })
    }

    return map
  }, [acordos, titulosNormalizados, alunos, hoje, resolveTurmaNome, resolveContaPlanoValue])

  // Mantém compatibilidade com progressoPorAcordo
  const progressoPorAcordo = detalhesPorAcordo

  async function handleSave() {
    if (!form.alunoNome.trim()) {
      toast.error('Selecione um aluno para formalizar o acordo.')
      return
    }
    const valorNegNum = parseFloat(form.valorNegociado) || 0
    if (valorNegNum <= 0) {
      toast.error('Informe um valor negociado maior que zero.')
      return
    }

    setSaving(true)
    try {
      const nParcelas = Math.max(1, parseInt(form.parcelas) || 1)
      const turmaFinal = resolveTurmaNome(form.turma, form.alunoNome.trim()) || form.turma
      const contaPlanoEscolhida = form.contaPlano || DEFAULT_CONTA_PLANO

      if (editingAcordo) {
        const det = detalhesPorAcordo.get(editingAcordo.id)
        const atualizado: AcordoRenegociacao = {
          ...editingAcordo,
          alunoNome: form.alunoNome.trim(),
          responsavel: form.responsavel.trim(),
          telefoneResponsavel: form.telefoneResponsavel.trim(),
          turma: turmaFinal,
          contaPlano: contaPlanoEscolhida,
          valorOriginal: parseFloat(form.valorOriginal) || valorNegNum,
          valorEntrada: parseFloat(form.valorEntrada) || 0,
          valorNegociado: valorNegNum,
          desconto: parseFloat(form.desconto) || 0,
          parcelas: nParcelas,
          formaPagamento: form.formaPagamento,
          primeiroVencimento: form.primeiroVencimento || hoje,
          data: form.data || hoje,
          status: form.status || editingAcordo.status,
          obs: form.obs.trim(),
          motivoInadimpl: form.motivoInadimpl,
          titulosOriginaisIds: selectedTituloIds.length > 0 ? selectedTituloIds : editingAcordo.titulosOriginaisIds,
        }

        setAcordos((prev) => (prev || []).map((x) => (x.id === editingAcordo.id ? atualizado : x)))

        logSystemAction(
          'Financeiro (Renegociação)',
          'Edição',
          `Acordo de renegociação ${atualizado.id} de ${atualizado.alunoNome} atualizado`,
          { registroId: atualizado.id, detalhesAntes: editingAcordo, detalhesDepois: atualizado }
        )

        const parcelasExistentes = det?.parcelasReais || []
        const parcelasPagas = parcelasExistentes.filter((p) => p.statusEfetivo === 'pago')
        const parcelasAbertas = parcelasExistentes.filter((p) => p.statusEfetivo !== 'pago')

        if (recalcularParcelasNoEdit || parcelasExistentes.length === 0) {
          // Remove apenas as parcelas em aberto e preserva as pagas
          if (parcelasAbertas.length > 0) {
            await fetch('/api/titulos', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ids: parcelasAbertas.map((p) => p.id) }),
            })
          }

          // Atualiza metadados nas parcelas já pagas se houver
          if (parcelasPagas.length > 0) {
            await Promise.all(
              parcelasPagas.map((p) =>
                fetch(`/api/titulos/${p.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...p,
                    aluno: atualizado.alunoNome,
                    responsavel: atualizado.responsavel,
                    turma: turmaFinal || undefined,
                    contaPlano: contaPlanoEscolhida,
                    planoContas: contaPlanoEscolhida,
                    obs: atualizado.obs || undefined,
                  }),
                })
              )
            )
          }

          const jaRecebido = parcelasPagas.reduce((s, p) => s + (Number(p.valor) || 0), 0)
          const saldoARegenerar = Math.max(0, Math.round((valorNegNum - jaRecebido) * 100) / 100)

          if (saldoARegenerar > 0) {
            let itensParaGerar = cronogramaSimulado.items
            if (parcelasPagas.length > 0) {
              // Distribui o saldo restante nas parcelas restantes
              const qtdRestante = Math.max(1, nParcelas - parcelasPagas.filter((p) => p.parcela !== 'Entrada').length)
              const baseVal = Math.floor((saldoARegenerar / qtdRestante) * 100) / 100
              const dtBase = new Date((atualizado.primeiroVencimento || hoje) + 'T12:00:00')
              const offsetMeses = parcelasPagas.filter((p) => p.parcela !== 'Entrada').length
              itensParaGerar = Array.from({ length: qtdRestante }, (_, idx) => {
                const vencDate = new Date(dtBase)
                vencDate.setMonth(vencDate.getMonth() + offsetMeses + idx)
                const isUlt = idx === qtdRestante - 1
                const vParc = isUlt
                  ? Number((saldoARegenerar - baseVal * (qtdRestante - 1)).toFixed(2))
                  : baseVal
                const numReal = offsetMeses + idx + 1
                return {
                  numero: `${numReal}/${offsetMeses + qtdRestante}`,
                  vencimento: vencDate.toISOString().slice(0, 10),
                  valor: vParc,
                  tipo: 'parcela' as const,
                }
              })
            }

            const novasParcelas = itensParaGerar.map((item, idx) => {
              const parcNum = item.tipo === 'entrada' ? 0 : (parseInt(String(item.numero).split('/')[0], 10) || idx + 1)
              const suf = item.tipo === 'entrada' ? 'ENT' : `P${String(parcNum).padStart(2, '0')}`
              return {
                id: `${atualizado.id}-${suf}`,
                codigo: `${atualizado.id}-${suf}`,
                aluno: atualizado.alunoNome,
                responsavel: atualizado.responsavel,
                turma: turmaFinal || undefined,
                descricao: 'Acordo Renegociação',
                valor: item.valor,
                vencimento: item.vencimento,
                pagamento: atualizado.status === 'quitado' ? hoje : null,
                status: atualizado.status === 'quitado' ? 'pago' : 'pendente',
                metodo: atualizado.formaPagamento || null,
                parcela: item.numero,
                totalParcelas: item.tipo === 'entrada' ? 1 : nParcelas,
                contaPlano: contaPlanoEscolhida,
                planoContas: contaPlanoEscolhida,
                origemLanca: 'renegociacao',
                acordoId: atualizado.id,
                obs: atualizado.obs || undefined,
              }
            })

            if (novasParcelas.length > 0) {
              await fetch('/api/titulos', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(novasParcelas),
              })
            }
          }
        } else if (parcelasExistentes.length > 0) {
          // Apenas sincroniza dados cadastrais, conta plano, forma de pagamento e status nas parcelas existentes
          await Promise.all(
            parcelasExistentes.map((p) => {
              const marcarPago = atualizado.status === 'quitado' && p.statusEfetivo !== 'pago'
              return fetch(`/api/titulos/${p.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  ...p,
                  aluno: atualizado.alunoNome,
                  responsavel: atualizado.responsavel,
                  turma: turmaFinal || p.turma || undefined,
                  contaPlano: contaPlanoEscolhida,
                  planoContas: contaPlanoEscolhida,
                  metodo: p.statusEfetivo === 'pago' ? p.metodo || atualizado.formaPagamento : atualizado.formaPagamento || p.metodo,
                  status: marcarPago ? 'pago' : p.status,
                  pagamento: marcarPago ? p.pagamento || hoje : p.pagamento,
                  obs: atualizado.obs || p.obs || undefined,
                }),
              })
            })
          )
        }

        await queryClient.invalidateQueries({ queryKey: ['titulos-receber'] })
        toast.success(`Acordo ${atualizado.id} atualizado com sucesso!`)
        setShowModal(false)
        resetModalState()
        return
      }

      // Fluxo de Criação de Novo Acordo
      const existingIds = new Set((acordos || []).map((a) => a.id).filter(Boolean))
      let acordoId = ''
      do {
        acordoId = `RNG-${Math.floor(10000 + Math.random() * 90000)}`
      } while (existingIds.has(acordoId))
      const novo: AcordoRenegociacao = {
        id: acordoId,
        alunoNome: form.alunoNome.trim(),
        responsavel: form.responsavel.trim(),
        telefoneResponsavel: form.telefoneResponsavel.trim(),
        turma: turmaFinal,
        contaPlano: contaPlanoEscolhida,
        valorPrincipal: resumoCalculoTitulos.principal || parseFloat(form.valorOriginal) || 0,
        valorEncargos: incluirEncargos ? resumoCalculoTitulos.encargos : 0,
        valorOriginal: parseFloat(form.valorOriginal) || valorNegNum,
        valorEntrada: parseFloat(form.valorEntrada) || 0,
        valorNegociado: valorNegNum,
        desconto: parseFloat(form.desconto) || 0,
        parcelas: nParcelas,
        formaPagamento: form.formaPagamento,
        primeiroVencimento: form.primeiroVencimento || hoje,
        data: form.data || hoje,
        status: form.status || 'ativo',
        obs: form.obs.trim(),
        motivoInadimpl: form.motivoInadimpl,
        titulosOriginaisIds: selectedTituloIds,
      }

      setAcordos((prev) => [novo, ...(prev || [])])

      logSystemAction(
        'Financeiro (Renegociação)',
        'Cadastro',
        `Novo acordo de renegociação ${novo.id} para ${novo.alunoNome}`,
        { registroId: novo.id, detalhesDepois: novo }
      )

      const titsParaRenegociar = titulosDoAlunoNoModal.filter((t) => selectedTituloIds.includes(t.id))
      const centroCustoHerdado = titsParaRenegociar.find((t) => t.centroCusto)?.centroCusto || ''
      const novasParcelas = cronogramaSimulado.items.map((item, idx) => {
        const parcNum = item.tipo === 'entrada' ? 0 : (parseInt(String(item.numero).split('/')[0], 10) || idx + 1)
        const suf = item.tipo === 'entrada' ? 'ENT' : `P${String(parcNum).padStart(2, '0')}`
        return {
          id: `${novo.id}-${suf}`,
          codigo: `${novo.id}-${suf}`,
          aluno: novo.alunoNome,
          responsavel: novo.responsavel,
          turma: turmaFinal || undefined,
          descricao: 'Acordo Renegociação',
          valor: item.valor,
          vencimento: item.vencimento,
          pagamento: novo.status === 'quitado' ? hoje : null,
          status: novo.status === 'quitado' ? 'pago' : 'pendente',
          metodo: novo.formaPagamento || null,
          parcela: item.numero,
          totalParcelas: item.tipo === 'entrada' ? 1 : nParcelas,
          centroCusto: centroCustoHerdado || undefined,
          contaPlano: contaPlanoEscolhida,
          planoContas: contaPlanoEscolhida,
          origemLanca: 'renegociacao',
          acordoId: novo.id,
          obs: novo.obs || undefined,
        }
      })

      await Promise.all(
        titsParaRenegociar.map((t) =>
          fetch(`/api/titulos/${t.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...t,
              status: 'renegociado',
              descricao: `${t.descricao} [Reneg. ${novo.id}]`,
              acordoId: novo.id,
            }),
          })
        )
      )

      if (novasParcelas.length > 0) {
        await fetch('/api/titulos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(novasParcelas),
        })
      }

      await queryClient.invalidateQueries({ queryKey: ['titulos-receber'] })
      toast.success(`Acordo ${novo.id} formalizado e ${novasParcelas.length} título(s) gerado(s) no Contas a Receber!`)

      setShowModal(false)
      resetModalState()
    } catch (err) {
      console.error('Erro ao persistir renegociação:', err)
      toast.error('Erro ao salvar dados do acordo.')
    } finally {
      setSaving(false)
    }
  }

  // Quitar Acordo + baixar parcelas pendentes no Contas a Receber
  const handleQuitarAcordo = async (a: AcordoRenegociacao) => {
    const det = detalhesPorAcordo.get(a.id)
    setAcordos((prev) => (prev || []).map((x) => (x.id === a.id ? { ...x, status: 'quitado' } : x)))
    logSystemAction(
      'Financeiro (Renegociação)',
      'Edição',
      `Acordo de renegociação ${a.id} de ${a.alunoNome} marcado como quitado`,
      { registroId: a.id, detalhesDepois: { ...a, status: 'quitado' } }
    )

    try {
      if (det) {
        if (det.isVirtual && det.parcelasExibicao.length > 0) {
          const payload = det.parcelasExibicao.map((p) => {
            const { isVirtual: _v, statusEfetivo: _se, diasEmAtraso: _da, ...rest } = p
            return {
              ...rest,
              status: 'pago',
              pagamento: hoje,
              metodo: a.formaPagamento || 'PIX',
            }
          })
          await fetch('/api/titulos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        } else {
          const abertas = det.parcelasReais.filter((p) => p.statusEfetivo !== 'pago')
          if (abertas.length > 0) {
            await Promise.all(
              abertas.map((p) =>
                fetch(`/api/titulos/${p.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...p,
                    status: 'pago',
                    pagamento: p.pagamento || hoje,
                    metodo: p.metodo || a.formaPagamento || 'PIX',
                  }),
                })
              )
            )
          }
        }
        await queryClient.invalidateQueries({ queryKey: ['titulos-receber'] })
      }
      toast.success(`Acordo ${a.id} quitado e parcelas baixadas no Contas a Receber!`)
    } catch {
      toast.error('Acordo marcado como quitado, mas houve erro ao baixar parcelas vinculadas.')
    }
  }

  // Alterar status do acordo rapidamente
  const handleChangeStatusAcordo = async (a: AcordoRenegociacao, novoStatus: AcordoRenegociacao['status']) => {
    if (novoStatus === 'quitado') {
      await handleQuitarAcordo(a)
      return
    }
    setAcordos((prev) => (prev || []).map((x) => (x.id === a.id ? { ...x, status: novoStatus } : x)))
    logSystemAction(
      'Financeiro (Renegociação)',
      'Edição',
      `Status do acordo ${a.id} de ${a.alunoNome} alterado para ${novoStatus}`,
      { registroId: a.id, detalhesDepois: { ...a, status: novoStatus } }
    )
    toast.success(`Status do acordo ${a.id} atualizado para ${novoStatus.toUpperCase()}.`)
  }

  // Sincronizar parcelas virtuais no Contas a Receber
  const handleSyncVirtualParcelas = async (a: AcordoRenegociacao) => {
    const det = detalhesPorAcordo.get(a.id)
    if (!det || !det.isVirtual) return
    setBusyParcelaId(`sync-${a.id}`)
    try {
      const payload = det.parcelasExibicao.map((p) => {
        const { isVirtual: _v, statusEfetivo: _se, diasEmAtraso: _da, ...rest } = p
        return rest
      })
      await fetch('/api/titulos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      await queryClient.invalidateQueries({ queryKey: ['titulos-receber'] })
      toast.success(`${payload.length} parcela(s) sincronizada(s) no Contas a Receber!`)
    } catch {
      toast.error('Não foi possível sincronizar as parcelas.')
    } finally {
      setBusyParcelaId(null)
    }
  }

  // Dar baixa ou estornar uma parcela individual diretamente pelo card expandido
  const handleToggleStatusParcela = async (a: AcordoRenegociacao, p: any) => {
    const det = detalhesPorAcordo.get(a.id)
    const eraPago = p.statusEfetivo === 'pago'
    const novoStatus = eraPago ? 'pendente' : 'pago'
    setBusyParcelaId(p.id)
    try {
      if (det?.isVirtual) {
        // Se as parcelas ainda eram virtuais, persiste todas elas com esta parcela atualizada
        const payload = det.parcelasExibicao.map((item) => {
          const { isVirtual: _v, statusEfetivo: _se, diasEmAtraso: _da, ...rest } = item
          if (item.id === p.id) {
            return {
              ...rest,
              status: novoStatus,
              pagamento: novoStatus === 'pago' ? hoje : null,
              metodo: item.metodo || a.formaPagamento || 'PIX',
            }
          }
          return rest
        })
        await fetch('/api/titulos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        const { isVirtual: _v, statusEfetivo: _se, diasEmAtraso: _da, ...cleanP } = p
        await fetch(`/api/titulos/${p.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...cleanP,
            status: novoStatus,
            pagamento: novoStatus === 'pago' ? hoje : null,
            metodo: cleanP.metodo || a.formaPagamento || 'PIX',
          }),
        })
      }

      // Verifica se todas as parcelas ficaram pagas ou se alguma voltou a ficar em aberto
      if (det) {
        const novasPagas = eraPago ? det.pagas - 1 : det.pagas + 1
        if (novasPagas >= det.totalParcelas && a.status !== 'quitado') {
          setAcordos((prev) => (prev || []).map((x) => (x.id === a.id ? { ...x, status: 'quitado' } : x)))
          toast.success(`Todas as parcelas foram pagas! Acordo ${a.id} marcado como Quitado.`)
        } else if (novasPagas < det.totalParcelas && a.status === 'quitado') {
          setAcordos((prev) => (prev || []).map((x) => (x.id === a.id ? { ...x, status: 'ativo' } : x)))
          toast.success(`Parcela ${p.parcela} reaberta e acordo ${a.id} retornado para Ativo.`)
        } else {
          toast.success(
            novoStatus === 'pago'
              ? `Baixa registrada na parcela ${p.parcela} (${fmtCur(p.valor)})!`
              : `Baixa da parcela ${p.parcela} estornada.`
          )
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['titulos-receber'] })
    } catch {
      toast.error('Erro ao atualizar status da parcela.')
    } finally {
      setBusyParcelaId(null)
    }
  }

  // Iniciar edição inline de uma parcela
  const handleStartEditParcela = (a: AcordoRenegociacao, p: any) => {
    setEditingParcelaId(p.id)
    setParcelaEditForm({
      valor: String(Number(p.valor || 0).toFixed(2)),
      vencimento: String(p.vencimento || hoje).slice(0, 10),
      pagamento: p.pagamento ? String(p.pagamento).slice(0, 10) : hoje,
      metodo: p.metodo || a.formaPagamento || 'PIX',
      status: p.statusEfetivo === 'pago' ? 'pago' : 'pendente',
    })
  }

  // Salvar edição inline de uma parcela e sincronizar valor total do acordo
  const handleSaveEditParcela = async (a: AcordoRenegociacao, p: any) => {
    const novoValor = Math.max(0.01, parseFloat(parcelaEditForm.valor) || Number(p.valor) || 0)
    const novoVenc = parcelaEditForm.vencimento || String(p.vencimento || hoje).slice(0, 10)
    const novoMetodo = parcelaEditForm.metodo || a.formaPagamento || 'PIX'
    const isPago = parcelaEditForm.status === 'pago'
    const novoPag = isPago ? parcelaEditForm.pagamento || hoje : null

    const det = detalhesPorAcordo.get(a.id)
    setBusyParcelaId(p.id)
    try {
      if (det?.isVirtual) {
        const payload = det.parcelasExibicao.map((item) => {
          const { isVirtual: _v, statusEfetivo: _se, diasEmAtraso: _da, ...rest } = item
          if (item.id === p.id) {
            return {
              ...rest,
              valor: novoValor,
              vencimento: novoVenc,
              metodo: novoMetodo,
              status: isPago ? 'pago' : 'pendente',
              pagamento: novoPag,
            }
          }
          return rest
        })
        await fetch('/api/titulos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        const { isVirtual: _v, statusEfetivo: _se, diasEmAtraso: _da, ...cleanP } = p
        await fetch(`/api/titulos/${p.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...cleanP,
            valor: novoValor,
            vencimento: novoVenc,
            metodo: novoMetodo,
            status: isPago ? 'pago' : 'pendente',
            pagamento: novoPag,
          }),
        })
      }

      // Atualiza valorNegociado do acordo se a soma das parcelas mudou
      if (det) {
        const novaSoma = det.parcelasExibicao.reduce(
          (acc, item) => acc + (item.id === p.id ? novoValor : Number(item.valor) || 0),
          0
        )
        const novaSomaArred = Math.round(novaSoma * 100) / 100
        if (Math.abs(novaSomaArred - a.valorNegociado) >= 0.01) {
          const novoDesc =
            a.valorOriginal > 0
              ? Number(Math.max(0, (1 - novaSomaArred / a.valorOriginal) * 100).toFixed(1))
              : a.desconto
          setAcordos((prev) =>
            (prev || []).map((x) =>
              x.id === a.id ? { ...x, valorNegociado: novaSomaArred, desconto: novoDesc } : x
            )
          )
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['titulos-receber'] })
      setEditingParcelaId(null)
      toast.success(`Parcela ${p.parcela} atualizada com sucesso!`)
    } catch {
      toast.error('Erro ao salvar alterações da parcela.')
    } finally {
      setBusyParcelaId(null)
    }
  }

  // Cobrar uma parcela específica via WhatsApp
  const handleWhatsAppParcela = (a: AcordoRenegociacao, p: any) => {
    const det = detalhesPorAcordo.get(a.id)
    const fone = (det?.telefone || a.telefoneResponsavel || '').replace(/\D/g, '')
    const situacao =
      p.statusEfetivo === 'pago'
        ? `PAGA em ${fmt(p.pagamento)}`
        : p.statusEfetivo === 'atrasado'
          ? `VENCIDA em ${fmt(p.vencimento)} (${p.diasEmAtraso} dia(s) em atraso)`
          : `com vencimento em ${fmt(p.vencimento)}`
    const msg =
      `Olá, *${det?.responsavel || a.responsavel || 'Responsável'}*!\n\n` +
      `Referente ao *Acordo de Renegociação ${a.id}* do(a) aluno(a) *${a.alunoNome}*, informamos os dados da parcela *${p.parcela}*:\n\n` +
      `• *Código:* ${p.codigo || p.id}\n` +
      `• *Valor:* *${fmtCur(p.valor)}*\n` +
      `• *Forma de Pagamento:* ${p.metodo || a.formaPagamento || 'PIX'}\n` +
      `• *Situação:* ${situacao}\n\n` +
      `Ficamos à disposição na Secretaria Financeira!`
    const url = fone
      ? `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Filtro corrigido (funciona desde o 1º caractere digitado!)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (acordos || []).filter((a) => {
      const matchStatus = filtroStatus === 'todos' || a.status === filtroStatus
      const matchSearch =
        !q ||
        (a.alunoNome || '').toLowerCase().includes(q) ||
        (a.responsavel || '').toLowerCase().includes(q) ||
        (a.id || '').toLowerCase().includes(q)
      const matchMotivo = filtroMotivo === 'Todos' || a.motivoInadimpl === filtroMotivo
      return matchStatus && matchSearch && matchMotivo
    })
  }, [acordos, filtroStatus, search, filtroMotivo])

  const totalNegociado = useMemo(
    () => (acordos || []).reduce((s, a) => s + (Number(a.valorNegociado) || 0), 0),
    [acordos]
  )
  const totalOriginal = useMemo(
    () => (acordos || []).reduce((s, a) => s + (Number(a.valorOriginal) || 0), 0),
    [acordos]
  )
  const totalDesconto = Math.max(0, totalOriginal - totalNegociado)
  const taxaQuitacao =
    (acordos || []).length > 0
      ? (((acordos || []).filter((a) => a.status === 'quitado').length / (acordos || []).length) * 100).toFixed(0)
      : '0'

  const activeFilters = [filtroStatus !== 'todos', filtroMotivo !== 'Todos'].filter(Boolean).length
  const clearFilters = () => {
    setFiltroStatus('todos')
    setFiltroMotivo('Todos')
    setSearch('')
  }

  // Impressão do Termo de Confissão e Renegociação de Dívida (com tabela de parcelas)
  const handlePrintTermoAcordo = (a: AcordoRenegociacao) => {
    const win = window.open('', '_blank', 'width=920,height=780')
    if (!win) {
      toast.error('Permita pop-ups para imprimir o Termo de Acordo.')
      return
    }
    const det = detalhesPorAcordo.get(a.id)
    const parcV = a.valorNegociado / Math.max(1, a.parcelas)
    const parcelasRows = (det?.parcelasExibicao || [])
      .map(
        (p) => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;">${p.parcela || '1/1'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${p.codigo || p.id}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${fmt(p.vencimento)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${p.metodo || a.formaPagamento || 'PIX'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;font-weight:700;">${fmtCur(p.valor)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${
          p.statusEfetivo === 'pago'
            ? `Pago (${fmt(p.pagamento)})`
            : p.statusEfetivo === 'atrasado'
              ? 'Em atraso'
              : 'A vencer'
        }</td>
      </tr>`
      )
      .join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Termo de Confissão e Renegociação de Dívida — ${a.id}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 36px; line-height: 1.55; font-size: 13px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 22px; }
    .title { font-size: 18px; font-weight: 800; text-transform: uppercase; }
    .subtitle { font-size: 12px; color: #475569; }
    .box { border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px 16px; margin-bottom: 16px; background: #f8fafc; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .val { font-size: 14px; font-weight: 800; color: #0f172a; }
    .clause { margin-bottom: 12px; text-align: justify; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; background: #fff; border-radius: 8px; overflow: hidden; }
    th { background: #f1f5f9; text-align: left; padding: 7px 10px; font-size: 10.5px; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 48px; text-align: center; }
    .sig-line { border-top: 1px solid #334155; padding-top: 8px; font-weight: 700; }
    @media print { .no-print { display: none; } body { margin: 20px; } }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:16px;text-align:right;">
    <button onclick="window.print()" style="padding:8px 16px;background:#0f172a;color:#fff;border:none;border-radius:6px;font-weight:700;cursor:pointer;">Imprimir / Salvar PDF</button>
  </div>
  <div class="header">
    <div>
      <div class="title">${escolaNome || 'Colégio Impacto'}</div>
      <div class="subtitle">TERMO DE CONFISSÃO E RENEGOCIAÇÃO DE DÍVIDA ESCOLAR</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:800;font-size:14px;">ACORDO Nº ${a.id}</div>
      <div class="subtitle">Data de Emissão: ${fmt(a.data)}</div>
    </div>
  </div>

  <div class="box">
    <div class="grid">
      <div><div class="label">Aluno(a) Beneficiário(a)</div><div class="val">${a.alunoNome}${det?.turma ? ` (${det.turma})` : ''}</div></div>
      <div><div class="label">Responsável Financeiro</div><div class="val">${det?.responsavel || a.responsavel || 'Não informado'}</div></div>
      <div><div class="label">Forma de Pagamento</div><div class="val">${a.formaPagamento || 'PIX / Boleto'}</div></div>
    </div>
  </div>

  <div class="box">
    <div class="grid">
      <div><div class="label">Dívida Consolidada Original</div><div class="val" style="color:#dc2626">${fmtCur(a.valorOriginal)}</div></div>
      <div><div class="label">Desconto Concedido</div><div class="val" style="color:#059669">${a.desconto}% (${fmtCur(Math.max(0, a.valorOriginal - a.valorNegociado))})</div></div>
      <div><div class="label">Valor Final Confessado e Negociado</div><div class="val" style="color:#0284c7">${fmtCur(a.valorNegociado)}</div></div>
    </div>
    <div style="margin-top:10px;padding-top:10px;border-top:1px dashed #cbd5e1;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <span><strong>Condição de Parcelamento:</strong> ${a.parcelas}x de ${fmtCur(parcV)}${a.valorEntrada ? ` + Entrada de ${fmtCur(a.valorEntrada)}` : ''}</span>
      <span><strong>1º Vencimento:</strong> ${fmt(a.primeiroVencimento || a.data)}</span>
      <span><strong>Recebido até o momento:</strong> ${fmtCur(det?.valorRecebido || 0)} (${det?.pctPago || 0}%)</span>
    </div>
  </div>

  ${
    parcelasRows
      ? `<div class="box">
          <div class="label" style="margin-bottom:6px;">Cronograma Discriminado das Parcelas do Acordo</div>
          <table>
            <thead>
              <tr>
                <th>Parcela</th>
                <th>Código</th>
                <th>Vencimento</th>
                <th>Forma</th>
                <th>Valor</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>${parcelasRows}</tbody>
          </table>
        </div>`
      : ''
  }

  <div class="clause">
    <strong>CLÁUSULA 1ª (DO OBJETO E CONFISSÃO):</strong> Pelo presente instrumento particular, o(a) RESPONSÁVEL FINANCEIRO acima qualificado(a) reconhece e confessa dever à instituição de ensino a importância líquida e certa de <strong>${fmtCur(a.valorNegociado)}</strong>, referente às obrigações financeiras escolares em atraso do(a) aluno(a) <strong>${a.alunoNome}</strong>.
  </div>
  <div class="clause">
    <strong>CLÁUSULA 2ª (DA FORMA DE PAGAMENTO):</strong> Para quitação do débito ora confessado, a instituição concede desconto condicional de <strong>${a.desconto}%</strong>, comprometendo-se o(a) RESPONSÁVEL FINANCEIRO a liquidar o saldo em <strong>${a.parcelas} parcela(s) mensais e consecutivas</strong> via <strong>${a.formaPagamento || 'PIX / Boleto'}</strong>.
  </div>
  <div class="clause">
    <strong>CLÁUSULA 3ª (DO INADIMPLEMENTO E QUEBRA DE ACORDO):</strong> O atraso superior a 15 (quinze) dias no pagamento de qualquer parcela implicará no vencimento antecipado do saldo devedor e na perda do desconto condicional concedido, retornando o débito ao seu valor original acrescido de multa contratual de 2% e juros de mora de 1% ao mês.
  </div>
  ${a.obs ? `<div class="clause"><strong>OBSERVAÇÕES ESPECIAIS:</strong> ${a.obs}</div>` : ''}

  <div class="signatures">
    <div class="sig-line">
      ${escolaNome || 'Colégio Impacto'}<br/>
      <span style="font-size:11px;font-weight:400;color:#64748b">Tesouraria / Diretoria Financeira</span>
    </div>
    <div class="sig-line">
      ${det?.responsavel || a.responsavel || 'Responsável Financeiro'}<br/>
      <span style="font-size:11px;font-weight:400;color:#64748b">Devedor(a) / Responsável Legal</span>
    </div>
  </div>
</body>
</html>`
    win.document.write(html)
    win.document.close()
  }

  // Envio de Resumo do Acordo via WhatsApp
  const handleWhatsAppAcordo = (a: AcordoRenegociacao) => {
    const det = detalhesPorAcordo.get(a.id)
    const parcV = a.valorNegociado / Math.max(1, a.parcelas)
    const msg =
      `Olá, *${det?.responsavel || a.responsavel || 'Responsável'}*! Segue o resumo atualizado do *Acordo de Renegociação (${a.id})* referente ao(à) aluno(a) *${a.alunoNome}*:\n\n` +
      `• *Valor Original:* ${fmtCur(a.valorOriginal)}\n` +
      `• *Desconto Concedido:* ${a.desconto}%\n` +
      `• *Valor Negociado:* *${fmtCur(a.valorNegociado)}*\n` +
      `• *Parcelamento:* ${a.parcelas}x de *${fmtCur(parcV)}* (${a.formaPagamento || 'PIX/Boleto'})\n` +
      `• *Progresso:* ${det ? `${det.pagas} de ${det.totalParcelas} parcela(s) paga(s) (${fmtCur(det.valorRecebido)})` : `0/${a.parcelas}`}\n` +
      `• *Saldo em Aberto:* *${fmtCur(det ? det.saldoRestante : a.valorNegociado)}*\n` +
      (det?.proximoVencimento ? `• *Próximo Vencimento:* ${fmt(det.proximoVencimento)}\n` : '') +
      `• *Data do Acordo:* ${fmt(a.data)}\n\n` +
      `Qualquer dúvida, estamos à disposição na Secretaria Financeira!`
    const fone = (det?.telefone || a.telefoneResponsavel || '').replace(/\D/g, '')
    const url = fone
      ? `https://wa.me/55${fone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  // Exportar Acordos para Excel (.xlsx)
  const handleExportExcel = () => {
    const rows = filtered.map((a) => {
      const prog = detalhesPorAcordo.get(a.id)
      return {
        'Código Acordo': a.id,
        Aluno: a.alunoNome,
        Turma: prog?.turma || a.turma || '',
        Responsável: prog?.responsavel || a.responsavel,
        Telefone: prog?.telefone || a.telefoneResponsavel || '',
        Motivo: a.motivoInadimpl || '',
        'Data Acordo': fmt(a.data),
        'Valor Original (R$)': a.valorOriginal,
        'Desconto (%)': a.desconto,
        'Valor Negociado (R$)': a.valorNegociado,
        Parcelas: a.parcelas,
        'Parcelas Pagas': prog ? `${prog.pagas}/${prog.totalParcelas}` : `0/${a.parcelas}`,
        'Valor Já Recebido (R$)': prog?.valorRecebido || 0,
        'Saldo Restante (R$)': prog?.saldoRestante ?? a.valorNegociado,
        'Próximo Vencimento': prog?.proximoVencimento ? fmt(prog.proximoVencimento) : 'Quitado',
        Status: a.status.toUpperCase(),
        Observações: a.obs || '',
      }
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Acordos_Renegociacao')
    XLSX.writeFile(wb, `Renegociacoes_Impacto_${hoje}.xlsx`)
  }

  // Excluir Acordo com confirmação e restauração opcional dos títulos originais
  const handleConfirmDeleteAcordo = async () => {
    if (!confirmDeleteAcordo) return
    const alvo = confirmDeleteAcordo
    setConfirmDeleteAcordo(null)

    setAcordos((prev) => (prev || []).filter((x) => x.id !== alvo.id))
    logSystemAction(
      'Financeiro (Renegociação)',
      'Exclusão',
      `Exclusão do acordo de renegociação ${alvo.id} de ${alvo.alunoNome}`,
      { registroId: alvo.id, detalhesAntes: alvo }
    )

    try {
      // Remove parcelas em aberto geradas pelo acordo
      const parcelasDoAcordo = titulosNormalizados.filter(
        (t) =>
          (t.acordoId === alvo.id || String(t.id || '').startsWith(`${alvo.id}-`)) &&
          t.statusEfetivo !== 'pago'
      )
      if (parcelasDoAcordo.length > 0) {
        await fetch('/api/titulos', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: parcelasDoAcordo.map((p) => p.id) }),
        })
      }

      // Restaura títulos originais que estavam marcados como 'renegociado'
      if (restaurarTitulosAoExcluir) {
        const originais = titulosNormalizados.filter(
          (t) =>
            t.status === 'renegociado' &&
            (t.acordoId === alvo.id || String(t.descricao || '').includes(`[Reneg. ${alvo.id}]`))
        )
        await Promise.all(
          originais.map((t) =>
            fetch(`/api/titulos/${t.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...t,
                status: 'atrasado',
                descricao: String(t.descricao || '').replace(` [Reneg. ${alvo.id}]`, ''),
                acordoId: null,
              }),
            })
          )
        )
      }

      await queryClient.invalidateQueries({ queryKey: ['titulos-receber'] })
      toast.success(`Acordo ${alvo.id} removido com sucesso.`)
    } catch {
      toast.error('Acordo removido localmente, mas houve falha ao atualizar títulos vinculados.')
    }
  }

  if (l1 || l2) return <PageSkeleton />

  const valorOrig = parseFloat(form.valorOriginal) || 0

  return (
    <div>
      {/* ── CABEÇALHO ────────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Renegociação de Dívidas</h1>
          <p className="page-subtitle">
            Central de acordos, confissão de dívida e parcelamento integrado ao Contas a Receber
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {radarInadimplencia.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowRadar((p) => !p)}
              style={{
                borderColor: 'rgba(239,68,68,0.35)',
                color: '#dc2626',
                background: showRadar ? 'rgba(239,68,68,0.1)' : undefined,
              }}
            >
              <AlertTriangle size={13} />
              Radar Inadimplentes ({radarInadimplencia.length})
            </button>
          )}
          {(acordos || []).length > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportExcel}>
              <FileSpreadsheet size={13} />
              Exportar Excel
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowFilters((p) => !p)}>
            <Filter size={13} />
            Filtros {activeFilters > 0 && `(${activeFilters})`}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleOpenNewModal}
          >
            <Plus size={13} aria-hidden="true" />
            Novo Acordo
          </button>
        </div>
      </div>

      {/* ── 5 KPIs EXECUTIVOS ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        {[
          {
            label: 'Acordos Ativos',
            value: (acordos || []).filter((a) => a.status === 'ativo').length,
            color: '#0891b2',
            icon: '📋',
            sub: `${(acordos || []).length} acordo(s) no total`,
          },
          {
            label: 'Quitados',
            value: (acordos || []).filter((a) => a.status === 'quitado').length,
            color: '#10b981',
            icon: '✅',
            sub: `Taxa de quitação: ${taxaQuitacao}%`,
          },
          {
            label: 'Inadimpl. Base',
            value: radarInadimplencia.length,
            color: '#ef4444',
            icon: '⚠️',
            sub: `${titulosAtrasados.length} título(s) vencido(s)`,
          },
          {
            label: 'Total Negociado',
            value: fmtCur(totalNegociado),
            color: '#f59e0b',
            icon: '💰',
            sub: `Original: ${fmtCur(totalOriginal)}`,
          },
          {
            label: 'Desconto Concedido',
            value: fmtCur(totalDesconto),
            color: '#8b5cf6',
            icon: '🎯',
            sub: `Taxa quitação ${taxaQuitacao}%`,
          },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 16 }} aria-hidden="true">{k.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{k.label}</span>
            </div>
            <div
              style={{
                fontSize: typeof k.value === 'string' ? 17 : 22,
                fontWeight: 800,
                color: k.color,
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              {k.value}
            </div>
            {k.sub && <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── RADAR DE ALUNOS COM PENDÊNCIAS VENCIDAS (1-CLICK ACORDO) ─────────── */}
      {(showRadar || (radarInadimplencia.length > 0 && (acordos || []).length === 0)) &&
        radarInadimplencia.length > 0 && (
          <div
            className="card"
            style={{
              padding: '16px 20px',
              marginBottom: 18,
              border: '1px solid rgba(245, 158, 11, 0.35)',
              background: 'rgba(245, 158, 11, 0.04)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <TrendingDown size={18} color="#d97706" aria-hidden="true" />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 800 }}>
                    Radar de Alunos com Pendências Vencidas ({radarInadimplencia.length})
                  </div>
                  <div style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))' }}>
                    Clique em &ldquo;Iniciar Acordo&rdquo; para carregar automaticamente os títulos em atraso e calcular encargos
                  </div>
                </div>
              </div>
              {showRadar && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowRadar(false)}
                >
                  <X size={14} aria-hidden="true" /> Fechar Radar
                </button>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
                gap: 10,
              }}
            >
              {radarInadimplencia.slice(0, 9).map((item) => (
                <div
                  key={item.alunoNome}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: 'hsl(var(--bg-elevated))',
                    border: '1px solid hsl(var(--border-subtle))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.alunoNome}
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                      {item.qtdTitulos > 0 ? `${item.qtdTitulos} título(s) • até ${item.maiorAtraso}d atraso` : 'Inadimplência cadastral'}
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: '#ef4444', marginTop: 3 }}>
                      {fmtCur(item.valorPrincipal)}
                      {item.valorEncargos > 0 && (
                        <span style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                          {' '}
                          (+{fmtCur(item.valorEncargos)} encargos)
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    style={{ flexShrink: 0, fontSize: 11.5 }}
                    onClick={() => {
                      resetModalState()
                      handleSelectAluno(item.alunoNome)
                      setShowModal(true)
                    }}
                  >
                    Iniciar Acordo
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* ── BARRA DE BUSCA E ABAS DE STATUS ──────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="tab-list">
          {(
            [
              ['todos', 'Todos'],
              ['ativo', 'Ativos'],
              ['quitado', 'Quitados'],
              ['inadimplente', 'Inadimp.'],
            ] as const
          ).map(([v, l]) => (
            <button
              key={v}
              type="button"
              className={`tab-trigger ${filtroStatus === v ? 'active' : ''}`}
              onClick={() => setFiltroStatus(v)}
            >
              {l}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search
            size={14}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'hsl(var(--text-muted))',
            }}
          />
          <input
            type="text"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="form-input"
            style={{ paddingLeft: 36 }}
            aria-label="Buscar aluno, responsável ou código do acordo"
            placeholder="Buscar aluno, responsável ou código do acordo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {(activeFilters > 0 || search) && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ color: '#ef4444' }}
            onClick={clearFilters}
          >
            <X size={13} aria-hidden="true" />
            Limpar
          </button>
        )}
      </div>

      {showFilters && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginBottom: 14,
            padding: 14,
            background: 'hsl(var(--bg-elevated))',
            borderRadius: 12,
            flexWrap: 'wrap',
            border: '1px solid hsl(var(--border-subtle))',
          }}
        >
          <div>
            <label htmlFor="filtro-motivo-select" className="form-label" style={{ fontSize: 10.5 }}>
              Motivo da Inadimplência
            </label>
            <select
              id="filtro-motivo-select"
              className="form-input"
              style={{ minWidth: 210, fontSize: 12.5 }}
              value={filtroMotivo}
              onChange={(e) => setFiltroMotivo(e.target.value)}
            >
              <option value="Todos">Todos os motivos</option>
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ── LISTA DE ACORDOS OU EMPTY STATE CENTRALIZADO ─────────────────────── */}
      {(acordos || []).length === 0 ? (
        <div
          className="card"
          style={{
            padding: '56px 32px',
            textAlign: 'center',
            color: 'hsl(var(--text-muted))',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 20,
              background: 'rgba(99, 102, 241, 0.08)',
              border: '1px solid rgba(99, 102, 241, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#6366f1',
            }}
          >
            <RefreshCw size={32} aria-hidden="true" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 6 }}>
            Nenhum acordo cadastrado
          </div>
          <div style={{ fontSize: 13, maxWidth: 440, margin: '0 auto 22px', lineHeight: 1.5 }}>
            Registre acordos de renegociação com responsáveis inadimplentes, gere parcelas automaticamente no Contas a
            Receber e emita o Termo de Confissão de Dívida.
          </div>
          <button type="button" className="btn btn-primary" onClick={handleOpenNewModal}>
            <Plus size={15} aria-hidden="true" />
            Novo Acordo
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.map((a) => {
            const badge = STATUS_BADGE[a.status] || STATUS_BADGE.ativo
            const parcV = a.valorNegociado / Math.max(1, a.parcelas)
            const det = detalhesPorAcordo.get(a.id)
            const totalParcelas = det?.totalParcelas ?? a.parcelas
            const pagas = det?.pagas ?? 0
            const atrasadas = det?.atrasadas ?? 0
            const valorRecebido = det?.valorRecebido ?? 0
            const saldoRestante = det?.saldoRestante ?? Math.max(0, a.valorNegociado - valorRecebido)
            const pctPago = det?.pctPago ?? 0
            const isMenuOpen = openMenuId === a.id
            const turmaExib = resolveTurmaNome(det?.turma || a.turma, a.alunoNome)
            const respExib = det?.responsavel || a.responsavel || 'Não informado'
            const economia = Math.max(0, (Number(a.valorOriginal) || 0) - (Number(a.valorNegociado) || 0))

            const accentColor =
              a.status === 'quitado' || pctPago === 100
                ? '#10b981'
                : a.status === 'inadimplente' || atrasadas > 0
                  ? '#ef4444'
                  : '#0891b2'

            return (
              <article
                key={a.id}
                className="card"
                style={{
                  containerType: 'inline-size',
                  padding: 0,
                  position: 'relative',
                  zIndex: isMenuOpen ? 40 : 1,
                  boxShadow: `inset 4px 0 0 0 ${accentColor}`,
                  transition: 'box-shadow 0.2s ease, transform 0.15s ease',
                }}
              >
                {/* ── CARD PRINCIPAL (CLICÁVEL PARA ABRIR MODAL DE DETALHES) ── */}
                <div
                  onClick={() => handleOpenDetalhesModal(a)}
                  style={{
                    padding: '18px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 16,
                    flexWrap: 'wrap',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 260 }}>
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 13,
                        background:
                          a.status === 'quitado'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : atrasadas > 0 || a.status === 'inadimplente'
                              ? 'rgba(239, 68, 68, 0.12)'
                              : 'rgba(245, 158, 11, 0.12)',
                        border:
                          a.status === 'quitado'
                            ? '1px solid rgba(16, 185, 129, 0.28)'
                            : atrasadas > 0 || a.status === 'inadimplente'
                              ? '1px solid rgba(239, 68, 68, 0.28)'
                              : '1px solid rgba(245, 158, 11, 0.28)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <FileText
                        size={21}
                        aria-hidden="true"
                        color={
                          a.status === 'quitado'
                            ? '#059669'
                            : atrasadas > 0 || a.status === 'inadimplente'
                              ? '#dc2626'
                              : '#d97706'
                        }
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Linha 1: Código + Nome do Aluno + Turma + Status + Alertas + Motivo */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(99, 102, 241, 0.12)',
                            color: '#6366f1',
                            letterSpacing: '0.02em',
                          }}
                        >
                          {a.id}
                        </span>
                        <h3
                          style={{
                            margin: 0,
                            fontWeight: 800,
                            fontSize: 15,
                            color: 'hsl(var(--text-primary))',
                          }}
                        >
                          {a.alunoNome}
                        </h3>
                        {turmaExib && (
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: 'hsl(var(--bg-elevated))',
                              border: '1px solid hsl(var(--border-subtle))',
                              color: 'hsl(var(--text-secondary))',
                            }}
                          >
                            {turmaExib}
                          </span>
                        )}
                        <span
                          style={{
                            padding: '2px 9px',
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 700,
                            background: badge.bg,
                            border: `1px solid ${badge.border}`,
                            color: badge.cor,
                          }}
                        >
                          {badge.label}
                        </span>
                        {atrasadas > 0 && a.status !== 'quitado' && (
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 99,
                              fontSize: 10.5,
                              fontWeight: 800,
                              background: 'rgba(239, 68, 68, 0.12)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#dc2626',
                            }}
                          >
                            ⚠ {atrasadas} parcela(s) vencida(s)
                          </span>
                        )}
                        {a.motivoInadimpl && (
                          <span style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', fontWeight: 500 }}>
                            • {a.motivoInadimpl}
                          </span>
                        )}
                      </div>

                      {/* Linha 2: Metadados Organizados */}
                      <div
                        style={{
                          fontSize: 12,
                          color: 'hsl(var(--text-muted))',
                          marginTop: 7,
                          display: 'flex',
                          gap: 14,
                          flexWrap: 'wrap',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <UserCheck size={13} aria-hidden="true" color="#64748b" />
                          <strong style={{ color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>{respExib}</strong>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Calendar size={13} aria-hidden="true" color="#64748b" />
                          Acordo: {fmt(a.data)}
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <CreditCard size={13} aria-hidden="true" color="#64748b" />
                          {a.parcelas}x de <strong style={{ color: 'hsl(var(--text-primary))' }}>{fmtCur(parcV)}</strong> ({a.formaPagamento || 'PIX'})
                        </span>
                        {(a.valorEntrada || 0) > 0 && (
                          <span style={{ color: '#0284c7', fontWeight: 700, fontSize: 11.5 }}>
                            + Entrada: {fmtCur(a.valorEntrada || 0)}
                          </span>
                        )}
                        {a.desconto > 0 && (
                          <span
                            style={{
                              color: '#059669',
                              fontWeight: 700,
                              background: 'rgba(16, 185, 129, 0.1)',
                              padding: '1px 7px',
                              borderRadius: 6,
                              fontSize: 11,
                            }}
                          >
                            🎯 {a.desconto}% desc. ({fmtCur(economia)})
                          </span>
                        )}
                        {det?.proximoVencimento ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11.5,
                              fontWeight: 700,
                              color:
                                det.proximoStatus === 'atrasado'
                                  ? '#dc2626'
                                  : det.proximoStatus === 'hoje'
                                    ? '#d97706'
                                    : '#0891b2',
                            }}
                          >
                            <Clock size={12} aria-hidden="true" />
                            {det.proximoStatus === 'atrasado'
                              ? `Vencido em: ${fmt(det.proximoVencimento)}`
                              : det.proximoStatus === 'hoje'
                                ? `Vence Hoje (${fmt(det.proximoVencimento)})`
                                : `Próx. venc: ${fmt(det.proximoVencimento)}`}
                          </span>
                        ) : (
                          <span style={{ color: '#059669', fontWeight: 700, fontSize: 11.5 }}>
                            ✓ Parcelas 100% quitadas
                          </span>
                        )}
                      </div>

                      {/* Linha 3: Barra de Progresso + Recebido vs Saldo Restante */}
                      <div style={{ marginTop: 11, maxWidth: 500 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 11,
                            marginBottom: 5,
                            color: 'hsl(var(--text-muted))',
                            gap: 8,
                            flexWrap: 'wrap',
                          }}
                        >
                          <span>
                            Progresso de Recebimento: <strong style={{ color: 'hsl(var(--text-primary))' }}>{pagas}</strong> de{' '}
                            <strong style={{ color: 'hsl(var(--text-primary))' }}>{totalParcelas}</strong> parcela(s) paga(s)
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontWeight: 700, color: '#059669' }}>
                              Recebido: {fmtCur(valorRecebido)} ({pctPago}%)
                            </span>
                            {saldoRestante > 0 && (
                              <span style={{ fontWeight: 700, color: atrasadas > 0 ? '#dc2626' : '#0284c7' }}>
                                • Falta: {fmtCur(saldoRestante)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            height: 7,
                            borderRadius: 99,
                            background: 'rgba(148, 163, 184, 0.2)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pctPago}%`,
                              height: '100%',
                              background:
                                pctPago === 100
                                  ? 'linear-gradient(90deg, #10b981, #059669)'
                                  : atrasadas > 0
                                    ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
                                    : 'linear-gradient(90deg, #10b981, #06b6d4)',
                              borderRadius: 99,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Coluna Direita: Valor Negociado + Botões Principais + Menu "..." */}
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}
                  >
                    <div style={{ textAlign: 'right', minWidth: 105 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>
                        Total Negociado
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: '#059669' }}>{fmtCur(a.valorNegociado)}</div>
                      {a.valorOriginal > a.valorNegociado && (
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', textDecoration: 'line-through' }}>
                          Original: {fmtCur(a.valorOriginal)}
                        </div>
                      )}
                    </div>

                    <div
                      aria-hidden="true"
                      style={{
                        width: 1,
                        height: 34,
                        background: 'hsl(var(--border-subtle))',
                      }}
                    />

                    {/* Botões Principais + Menu "..." */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, position: 'relative' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        aria-label={`Abrir detalhes e parcelas do acordo ${a.id} de ${a.alunoNome}`}
                        onClick={() => handleOpenDetalhesModal(a)}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '6px 12px',
                          borderRadius: 9,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Eye size={13.5} aria-hidden="true" color="#6366f1" />
                        Detalhes
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        aria-label={`Enviar WhatsApp do acordo ${a.id}`}
                        onClick={() => handleWhatsAppAcordo(a)}
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          padding: '6px 12px',
                          borderRadius: 9,
                          color: '#059669',
                          background: 'rgba(16, 185, 129, 0.08)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <MessageCircle size={13.5} aria-hidden="true" />
                        WhatsApp
                      </button>

                      {/* Botão "..." com Menu Dropdown de Ações Secundárias */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          aria-label={`Mais opções do acordo ${a.id}`}
                          aria-expanded={isMenuOpen}
                          aria-haspopup="menu"
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId((prev) => (prev === a.id ? null : a.id))
                          }}
                          style={{
                            width: 34,
                            height: 34,
                            padding: 0,
                            borderRadius: 9,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isMenuOpen ? 'rgba(99, 102, 241, 0.12)' : undefined,
                            color: isMenuOpen ? '#6366f1' : 'hsl(var(--text-secondary))',
                          }}
                        >
                          <MoreHorizontal size={16} aria-hidden="true" />
                        </button>

                        <AnimatePresence>
                          {isMenuOpen && (
                            <motion.div
                              role="menu"
                              initial={{ opacity: 0, y: -6, scale: 0.96 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: -6, scale: 0.96 }}
                              transition={{ duration: 0.14 }}
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 6px)',
                                right: 0,
                                minWidth: 235,
                                background: 'hsl(var(--bg-elevated))',
                                border: '1px solid hsl(var(--border-subtle))',
                                borderRadius: 12,
                                padding: 6,
                                boxShadow: '0 14px 36px rgba(15, 23, 42, 0.24)',
                                zIndex: 100,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 2,
                              }}
                            >
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => handleOpenDetalhesModal(a)}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 9,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: 'hsl(var(--text-primary))',
                                  textAlign: 'left',
                                }}
                              >
                                <Layers size={14} aria-hidden="true" color="#6366f1" />
                                Ver Resumo e Parcelas
                              </button>

                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  handleOpenEditModal(a)
                                }}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 9,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: 'hsl(var(--text-primary))',
                                  textAlign: 'left',
                                }}
                              >
                                <Pencil size={14} aria-hidden="true" color="#0284c7" />
                                Editar Acordo
                              </button>

                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  handlePrintTermoAcordo(a)
                                }}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 9,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: 'hsl(var(--text-primary))',
                                  textAlign: 'left',
                                }}
                              >
                                <Printer size={14} aria-hidden="true" color="#64748b" />
                                Imprimir Termo de Confissão
                              </button>

                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  navigator.clipboard?.writeText(a.id)
                                  toast.success(`Código ${a.id} copiado!`)
                                }}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 9,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  color: 'hsl(var(--text-primary))',
                                  textAlign: 'left',
                                }}
                              >
                                <Copy size={14} aria-hidden="true" color="#64748b" />
                                Copiar Código ({a.id})
                              </button>

                              <div
                                aria-hidden="true"
                                style={{ height: 1, background: 'hsl(var(--border-subtle))', margin: '4px 0' }}
                              />

                              {a.status !== 'quitado' && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    handleQuitarAcordo(a)
                                  }}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 9,
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 700,
                                    color: '#059669',
                                    textAlign: 'left',
                                  }}
                                >
                                  <CheckCircle size={14} aria-hidden="true" />
                                  Quitar Acordo Integralmente
                                </button>
                              )}

                              {a.status !== 'ativo' && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    handleChangeStatusAcordo(a, 'ativo')
                                  }}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 9,
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#0891b2',
                                    textAlign: 'left',
                                  }}
                                >
                                  <RotateCcw size={14} aria-hidden="true" />
                                  Marcar como Acordo Ativo
                                </button>
                              )}

                              {a.status !== 'inadimplente' && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    handleChangeStatusAcordo(a, 'inadimplente')
                                  }}
                                  style={{
                                    width: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 9,
                                    padding: '8px 10px',
                                    borderRadius: 8,
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: '#d97706',
                                    textAlign: 'left',
                                  }}
                                >
                                  <AlertTriangle size={14} aria-hidden="true" />
                                  Marcar Quebra / Em Atraso
                                </button>
                              )}

                              <div
                                aria-hidden="true"
                                style={{ height: 1, background: 'hsl(var(--border-subtle))', margin: '4px 0' }}
                              />

                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null)
                                  setConfirmDeleteAcordo(a)
                                }}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 9,
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: '#ef4444',
                                  textAlign: 'left',
                                }}
                              >
                                <Trash2 size={14} aria-hidden="true" />
                                Cancelar / Excluir Acordo
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}

          {filtered.length === 0 && (acordos || []).length > 0 && (
            <div
              className="card"
              style={{ padding: 32, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}
            >
              Nenhum acordo encontrado para os filtros aplicados.
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════════
          MODAL: DETALHES DO ACORDO, RESUMO ORGANIZADO E EDIÇÃO DE PARCELAS
         ═════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {acordoDetalhe &&
          (() => {
            const a = acordoDetalhe
            const badge = STATUS_BADGE[a.status] || STATUS_BADGE.ativo
            const det = detalhesPorAcordo.get(a.id)
            const totalParcelas = det?.totalParcelas ?? a.parcelas
            const pagas = det?.pagas ?? 0
            const atrasadas = det?.atrasadas ?? 0
            const pendentes = det?.pendentes ?? Math.max(0, totalParcelas - pagas)
            const valorRecebido = det?.valorRecebido ?? 0
            const saldoRestante = det?.saldoRestante ?? Math.max(0, a.valorNegociado - valorRecebido)
            const pctPago = det?.pctPago ?? 0
            const turmaExib = resolveTurmaNome(det?.turma || a.turma, a.alunoNome)
            const contaPlanoExib = det?.contaPlano || resolveContaPlanoValue(a.contaPlano)
            const respExib = det?.responsavel || a.responsavel || 'Não informado'
            const foneExib = det?.telefone || a.telefoneResponsavel || ''
            const economia = Math.max(0, (Number(a.valorOriginal) || 0) - (Number(a.valorNegociado) || 0))

            return (
              <motion.div
                key={`modal-detalhe-${a.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.65)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 990,
                  backdropFilter: 'blur(6px)',
                  padding: 20,
                }}
                onClick={() => {
                  setDetalheAcordoId(null)
                  setEditingParcelaId(null)
                }}
              >
                <motion.div
                  role="dialog"
                  aria-labelledby="modal-detalhe-acordo-title"
                  onClick={(e) => e.stopPropagation()}
                  initial={{ scale: 0.96, opacity: 0, y: 16 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.96, opacity: 0, y: 16 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  style={{
                    background: 'hsl(var(--bg-elevated))',
                    border: '1px solid hsl(var(--border-subtle))',
                    borderRadius: 20,
                    padding: '22px 26px',
                    width: '100%',
                    maxWidth: 880,
                    boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
                    maxHeight: '92vh',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                  }}
                >
                  {/* Cabeçalho do Modal de Detalhes */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 16,
                      paddingBottom: 14,
                      borderBottom: '1px solid hsl(var(--border-subtle))',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: 'rgba(99, 102, 241, 0.12)',
                          border: '1px solid rgba(99, 102, 241, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#6366f1',
                          flexShrink: 0,
                        }}
                      >
                        <FileText size={20} aria-hidden="true" />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(a.id)
                              toast.success(`Código ${a.id} copiado!`)
                            }}
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 6,
                              background: 'rgba(99, 102, 241, 0.12)',
                              color: '#6366f1',
                              border: 'none',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            {a.id}
                            <Copy size={10} aria-hidden="true" />
                          </button>
                          <h2
                            id="modal-detalhe-acordo-title"
                            style={{ margin: 0, fontWeight: 800, fontSize: 17 }}
                          >
                            {a.alunoNome}
                          </h2>
                          {turmaExib && (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: 'rgba(148, 163, 184, 0.12)',
                                color: 'hsl(var(--text-secondary))',
                              }}
                            >
                              {turmaExib}
                            </span>
                          )}
                          <span
                            style={{
                              padding: '2px 9px',
                              borderRadius: 99,
                              fontSize: 11,
                              fontWeight: 700,
                              background: badge.bg,
                              border: `1px solid ${badge.border}`,
                              color: badge.cor,
                            }}
                          >
                            {badge.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
                          Responsável: <strong>{respExib}</strong> • Formalizado em {fmt(a.data)} • {a.parcelas}x via{' '}
                          <strong>{a.formaPagamento || 'PIX'}</strong>
                          {contaPlanoExib && (
                            <>
                              {' '}
                              • Conta Plano: <strong>{contaPlanoExib}</strong>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handlePrintTermoAcordo(a)}
                        style={{ fontSize: 11.5 }}
                      >
                        <Printer size={13} aria-hidden="true" />
                        Termo
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleWhatsAppAcordo(a)}
                        style={{ fontSize: 11.5, color: '#059669' }}
                      >
                        <MessageCircle size={13} aria-hidden="true" />
                        WhatsApp
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setDetalheAcordoId(null)
                          handleOpenEditModal(a)
                        }}
                        style={{ fontSize: 11.5 }}
                      >
                        <Pencil size={12} aria-hidden="true" />
                        Editar Acordo
                      </button>
                      <button
                        type="button"
                        aria-label="Fechar detalhes do acordo"
                        onClick={() => {
                          setDetalheAcordoId(null)
                          setEditingParcelaId(null)
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'hsl(var(--text-muted))',
                          padding: 4,
                        }}
                      >
                        <X size={20} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Barra de Status Rápido e Sincronização */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: 'rgba(148, 163, 184, 0.06)',
                      border: '1px solid hsl(var(--border-subtle))',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))' }}>
                        Situação do Acordo:
                      </span>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'hsl(var(--bg-elevated))',
                          padding: 3,
                          borderRadius: 8,
                          border: '1px solid hsl(var(--border-subtle))',
                        }}
                      >
                        {(
                          [
                            ['ativo', 'Ativo', '#0891b2'],
                            ['quitado', 'Quitado', '#059669'],
                            ['inadimplente', 'Quebra / Atraso', '#dc2626'],
                          ] as const
                        ).map(([stKey, stLabel, stCor]) => {
                          const active = a.status === stKey
                          return (
                            <button
                              key={stKey}
                              type="button"
                              onClick={() => handleChangeStatusAcordo(a, stKey)}
                              style={{
                                padding: '4px 10px',
                                fontSize: 11,
                                fontWeight: 700,
                                borderRadius: 6,
                                border: 'none',
                                cursor: 'pointer',
                                background: active ? stCor : 'transparent',
                                color: active ? '#ffffff' : 'hsl(var(--text-muted))',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {stLabel}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      {det?.isVirtual && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busyParcelaId === `sync-${a.id}`}
                          onClick={() => handleSyncVirtualParcelas(a)}
                          style={{ fontSize: 11, color: '#0284c7' }}
                        >
                          <RefreshCw size={12} aria-hidden="true" />
                          {busyParcelaId === `sync-${a.id}`
                            ? 'Sincronizando...'
                            : 'Sincronizar Parcelas no Contas a Receber'}
                        </button>
                      )}
                      {a.status !== 'quitado' && (
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          onClick={() => handleQuitarAcordo(a)}
                          style={{ fontSize: 11.5 }}
                        >
                          <CheckCircle size={12} aria-hidden="true" />
                          Quitar Acordo Integralmente
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4 Cards de Resumo Financeiro do Acordo */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: 'rgba(148, 163, 184, 0.04)',
                        border: '1px solid hsl(var(--border-subtle))',
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
                        Dívida Consolidada Original
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: '#ef4444', marginTop: 4 }}>
                        {fmtCur(a.valorOriginal)}
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
                        Principal: <strong>{fmtCur(a.valorPrincipal || a.valorOriginal)}</strong>
                        {(a.valorEncargos || 0) > 0 && ` • Encargos: ${fmtCur(a.valorEncargos || 0)}`}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: 'rgba(148, 163, 184, 0.04)',
                        border: '1px solid hsl(var(--border-subtle))',
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
                        Condição & Economia
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: '#0284c7', marginTop: 4 }}>
                        {fmtCur(a.valorNegociado)}
                      </div>
                      <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginTop: 4 }}>
                        Desconto: {a.desconto}% ({fmtCur(economia)} de economia)
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: 'rgba(148, 163, 184, 0.04)',
                        border: '1px solid hsl(var(--border-subtle))',
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
                        Total Recebido
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 900, color: '#10b981', marginTop: 4 }}>
                        {fmtCur(valorRecebido)}{' '}
                        <span style={{ fontSize: 12, fontWeight: 700 }}>({pctPago}%)</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
                        {pagas} de {totalParcelas} paga(s)
                        {det?.ultimoPagamento ? ` • Últ. baixa: ${fmt(det.ultimoPagamento)}` : ''}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: 'rgba(148, 163, 184, 0.04)',
                        border: '1px solid hsl(var(--border-subtle))',
                      }}
                    >
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>
                        Saldo Devedor Restante
                      </div>
                      <div
                        style={{
                          fontSize: 17,
                          fontWeight: 900,
                          color: saldoRestante === 0 ? '#10b981' : atrasadas > 0 ? '#ef4444' : '#f59e0b',
                          marginTop: 4,
                        }}
                      >
                        {fmtCur(saldoRestante)}
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
                        {saldoRestante === 0
                          ? 'Acordo integralmente liquidado'
                          : `${pendentes} a vencer • ${atrasadas} em atraso`}
                      </div>
                    </div>
                  </div>

                  {/* Tabela Interativa do Cronograma de Lançamentos / Parcelas */}
                  <div
                    style={{
                      borderRadius: 12,
                      border: '1px solid hsl(var(--border-subtle))',
                      background: 'hsl(var(--bg-elevated))',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid hsl(var(--border-subtle))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div style={{ fontSize: 12.5, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Layers size={14} aria-hidden="true" color="#6366f1" />
                        Lançamentos / Parcelas do Acordo ({det?.parcelasExibicao.length || 0})
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                        Clique em <strong>Receber</strong> para dar baixa ou em <strong>Editar</strong> para alterar vencimento/valor da parcela
                      </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                        <caption style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
                          Parcelas do acordo {a.id} de {a.alunoNome}
                        </caption>
                        <thead>
                          <tr
                            style={{
                              borderBottom: '1px solid hsl(var(--border-subtle))',
                              background: 'rgba(148, 163, 184, 0.06)',
                              textAlign: 'left',
                            }}
                          >
                            <th scope="col" style={{ padding: '9px 14px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>
                              Parcela / Código
                            </th>
                            <th scope="col" style={{ padding: '9px 14px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>
                              Vencimento
                            </th>
                            <th scope="col" style={{ padding: '9px 14px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>
                              Forma / Pagamento
                            </th>
                            <th scope="col" style={{ padding: '9px 14px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>
                              Valor
                            </th>
                            <th scope="col" style={{ padding: '9px 14px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))' }}>
                              Situação
                            </th>
                            <th scope="col" style={{ padding: '9px 14px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', textAlign: 'right' }}>
                              Ações da Parcela
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {(det?.parcelasExibicao || []).map((p) => {
                            const isEditingRow = editingParcelaId === p.id
                            const isBusy = busyParcelaId === p.id
                            const stEf = p.statusEfetivo as 'pago' | 'pendente' | 'atrasado'

                            return (
                              <tr
                                key={p.id}
                                style={{
                                  borderBottom: '1px solid hsl(var(--border-subtle))',
                                  background: isEditingRow ? 'rgba(99, 102, 241, 0.06)' : undefined,
                                }}
                              >
                                <td style={{ padding: '10px 14px', fontWeight: 700 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span
                                      style={{
                                        padding: '2px 7px',
                                        borderRadius: 6,
                                        fontSize: 11,
                                        fontWeight: 800,
                                        background:
                                          p.parcela === 'Entrada'
                                            ? 'rgba(2, 132, 199, 0.12)'
                                            : 'rgba(99, 102, 241, 0.1)',
                                        color: p.parcela === 'Entrada' ? '#0284c7' : '#6366f1',
                                      }}
                                    >
                                      {p.parcela || '1/1'}
                                    </span>
                                    <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                                      {p.codigo || p.id}
                                    </span>
                                  </div>
                                </td>

                                <td style={{ padding: '10px 14px' }}>
                                  {isEditingRow ? (
                                    <input
                                      type="date"
                                      className="form-input"
                                      aria-label={`Vencimento da parcela ${p.parcela}`}
                                      style={{ padding: '4px 8px', fontSize: 12, maxWidth: 145 }}
                                      value={parcelaEditForm.vencimento}
                                      onChange={(e) =>
                                        setParcelaEditForm((f) => ({ ...f, vencimento: e.target.value }))
                                      }
                                    />
                                  ) : (
                                    <div>
                                      <div style={{ fontWeight: 700 }}>{fmt(p.vencimento)}</div>
                                      {stEf === 'atrasado' && p.diasEmAtraso > 0 && (
                                        <div style={{ fontSize: 10, color: '#dc2626', fontWeight: 700 }}>
                                          {p.diasEmAtraso} dia(s) em atraso
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>

                                <td style={{ padding: '10px 14px' }}>
                                  {isEditingRow ? (
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <select
                                        className="form-input"
                                        aria-label={`Forma de pagamento da parcela ${p.parcela}`}
                                        style={{ padding: '4px 8px', fontSize: 12, maxWidth: 135 }}
                                        value={parcelaEditForm.metodo}
                                        onChange={(e) =>
                                          setParcelaEditForm((f) => ({ ...f, metodo: e.target.value }))
                                        }
                                      >
                                        {FORMAS_PAGAMENTO.map((fp) => (
                                          <option key={fp} value={fp}>
                                            {fp}
                                          </option>
                                        ))}
                                      </select>
                                      {parcelaEditForm.status === 'pago' && (
                                        <input
                                          type="date"
                                          className="form-input"
                                          aria-label={`Data de pagamento da parcela ${p.parcela}`}
                                          style={{ padding: '4px 8px', fontSize: 11.5, maxWidth: 135 }}
                                          value={parcelaEditForm.pagamento}
                                          onChange={(e) =>
                                            setParcelaEditForm((f) => ({ ...f, pagamento: e.target.value }))
                                          }
                                        />
                                      )}
                                    </div>
                                  ) : (
                                    <div>
                                      <div style={{ fontWeight: 600 }}>{p.metodo || a.formaPagamento || 'PIX'}</div>
                                      {stEf === 'pago' && p.pagamento && (
                                        <div style={{ fontSize: 10.5, color: '#059669', fontWeight: 600 }}>
                                          Pago em {fmt(p.pagamento)}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </td>

                                <td style={{ padding: '10px 14px', fontWeight: 800 }}>
                                  {isEditingRow ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      className="form-input"
                                      aria-label={`Valor da parcela ${p.parcela}`}
                                      style={{ padding: '4px 8px', fontSize: 12, maxWidth: 115, fontWeight: 800 }}
                                      value={parcelaEditForm.valor}
                                      onChange={(e) =>
                                        setParcelaEditForm((f) => ({ ...f, valor: e.target.value }))
                                      }
                                    />
                                  ) : (
                                    <span style={{ color: stEf === 'pago' ? '#059669' : stEf === 'atrasado' ? '#dc2626' : 'hsl(var(--text-primary))' }}>
                                      {fmtCur(p.valor)}
                                    </span>
                                  )}
                                </td>

                                <td style={{ padding: '10px 14px' }}>
                                  {isEditingRow ? (
                                    <select
                                      className="form-input"
                                      aria-label={`Status da parcela ${p.parcela}`}
                                      style={{ padding: '4px 8px', fontSize: 12, maxWidth: 120 }}
                                      value={parcelaEditForm.status}
                                      onChange={(e) =>
                                        setParcelaEditForm((f) => ({
                                          ...f,
                                          status: e.target.value as 'pago' | 'pendente' | 'atrasado',
                                        }))
                                      }
                                    >
                                      <option value="pendente">Em Aberto</option>
                                      <option value="pago">Pago</option>
                                    </select>
                                  ) : (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 4,
                                        padding: '2px 9px',
                                        borderRadius: 99,
                                        fontSize: 11,
                                        fontWeight: 700,
                                        background:
                                          stEf === 'pago'
                                            ? 'rgba(16, 185, 129, 0.12)'
                                            : stEf === 'atrasado'
                                              ? 'rgba(239, 68, 68, 0.12)'
                                              : 'rgba(245, 158, 11, 0.12)',
                                        color:
                                          stEf === 'pago'
                                            ? '#059669'
                                            : stEf === 'atrasado'
                                              ? '#dc2626'
                                              : '#d97706',
                                      }}
                                    >
                                      {stEf === 'pago' ? '✓ Pago' : stEf === 'atrasado' ? '⚠ Atrasado' : '⏰ A Vencer'}
                                    </span>
                                  )}
                                </td>

                                <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                                  {isEditingRow ? (
                                    <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end' }}>
                                      <button
                                        type="button"
                                        className="btn btn-success btn-sm"
                                        disabled={isBusy}
                                        onClick={() => handleSaveEditParcela(a, p)}
                                        style={{ fontSize: 11, padding: '4px 10px' }}
                                      >
                                        <Check size={12} aria-hidden="true" />
                                        Salvar
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setEditingParcelaId(null)}
                                        style={{ fontSize: 11, padding: '4px 8px' }}
                                      >
                                        <X size={12} aria-hidden="true" />
                                        Cancelar
                                      </button>
                                    </div>
                                  ) : (
                                    <div style={{ display: 'inline-flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                      <button
                                        type="button"
                                        className={stEf === 'pago' ? 'btn btn-secondary btn-sm' : 'btn btn-success btn-sm'}
                                        disabled={isBusy}
                                        onClick={() => handleToggleStatusParcela(a, p)}
                                        style={{ fontSize: 11, padding: '4px 10px' }}
                                      >
                                        {stEf === 'pago' ? (
                                          <>
                                            <RotateCcw size={11} aria-hidden="true" />
                                            Estornar
                                          </>
                                        ) : (
                                          <>
                                            <Check size={11} aria-hidden="true" />
                                            Receber
                                          </>
                                        )}
                                      </button>

                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        aria-label={`Editar parcela ${p.parcela}`}
                                        onClick={() => handleStartEditParcela(a, p)}
                                        style={{ fontSize: 11, padding: '4px 8px' }}
                                      >
                                        <Pencil size={11} aria-hidden="true" />
                                        Editar
                                      </button>

                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        aria-label={`Enviar lembrete de WhatsApp da parcela ${p.parcela}`}
                                        onClick={() => handleWhatsAppParcela(a, p)}
                                        style={{ fontSize: 11, padding: '4px 8px', color: '#059669' }}
                                      >
                                        <MessageCircle size={11} aria-hidden="true" />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Seção Inferior: Títulos Originais Consolidados + Dados Cadastrais e Observações */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: 'rgba(148, 163, 184, 0.04)',
                        border: '1px solid hsl(var(--border-subtle))',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: 8 }}>
                        Títulos Originais Consolidados ({det?.originais.length || 0})
                      </div>
                      {det && det.originais.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto' }}>
                          {det.originais.map((orig) => (
                            <div
                              key={orig.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '6px 10px',
                                borderRadius: 8,
                                background: 'hsl(var(--bg-elevated))',
                                border: '1px solid hsl(var(--border-subtle))',
                                fontSize: 11.5,
                              }}
                            >
                              <div>
                                <div style={{ fontWeight: 700 }}>
                                  {String(orig.descricao || '').replace(` [Reneg. ${a.id}]`, '')}
                                </div>
                                <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))' }}>
                                  Venc. original: {fmt(orig.vencimento)}
                                </div>
                              </div>
                              <div style={{ fontWeight: 800, color: '#ef4444' }}>{fmtCur(orig.valor)}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', lineHeight: 1.5 }}>
                          Acordo formalizado sobre montante consolidado de <strong>{fmtCur(a.valorOriginal)}</strong>
                          {(a.valorEncargos || 0) > 0 && ` (incluindo ${fmtCur(a.valorEncargos || 0)} de encargos)`}.
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: 'rgba(148, 163, 184, 0.04)',
                        border: '1px solid hsl(var(--border-subtle))',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', marginBottom: 8 }}>
                          Dados Cadastrais & Condições do Acordo
                        </div>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 1fr',
                            gap: 8,
                            fontSize: 11.5,
                          }}
                        >
                          <div>
                            <span style={{ color: 'hsl(var(--text-muted))' }}>Responsável:</span>{' '}
                            <strong>{respExib}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'hsl(var(--text-muted))' }}>Telefone:</span>{' '}
                            <strong>{foneExib || 'Não informado'}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'hsl(var(--text-muted))' }}>1º Vencimento:</span>{' '}
                            <strong>{fmt(a.primeiroVencimento || a.data)}</strong>
                          </div>
                          <div>
                            <span style={{ color: 'hsl(var(--text-muted))' }}>Motivo:</span>{' '}
                            <strong>{a.motivoInadimpl || '—'}</strong>
                          </div>
                        </div>
                        <div
                          style={{
                            marginTop: 8,
                            paddingTop: 8,
                            borderTop: '1px dashed hsl(var(--border-subtle))',
                            fontSize: 11.5,
                            color: a.obs ? 'hsl(var(--text-secondary))' : 'hsl(var(--text-muted))',
                          }}
                        >
                          <strong>Observações:</strong> {a.obs || 'Nenhuma observação especial registrada.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé do Modal de Detalhes */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: 12,
                      borderTop: '1px solid hsl(var(--border-subtle))',
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setDetalheAcordoId(null)
                        setConfirmDeleteAcordo(a)
                      }}
                      style={{ color: '#ef4444', fontSize: 12 }}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Cancelar / Excluir Acordo
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setDetalheAcordoId(null)
                          handleOpenEditModal(a)
                        }}
                      >
                        <Pencil size={13} aria-hidden="true" />
                        Editar Condições do Acordo
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setDetalheAcordoId(null)
                          setEditingParcelaId(null)
                        }}
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )
          })()}
      </AnimatePresence>

      {/* ═════════════════════════════════════════════════════════════════════════
          MODAL: NOVO OU EDITAR ACORDO DE RENEGOCIAÇÃO
         ═════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              backdropFilter: 'blur(6px)',
              padding: 20,
            }}
            onClick={() => {
              setShowModal(false)
              resetModalState()
            }}
          >
            <motion.div
              role="dialog"
              aria-labelledby="modal-acordo-title"
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              style={{
                background: 'hsl(var(--bg-elevated))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 20,
                padding: '24px 26px',
                width: '100%',
                maxWidth: 680,
                boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
                maxHeight: '92vh',
                overflowY: 'auto',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 18,
                  paddingBottom: 12,
                  borderBottom: '1px solid hsl(var(--border-subtle))',
                }}
              >
                <div>
                  <h2 id="modal-acordo-title" style={{ margin: 0, fontWeight: 800, fontSize: 17.5 }}>
                    {editingAcordo ? `Editar Acordo de Renegociação — ${editingAcordo.id}` : 'Novo Acordo de Renegociação'}
                  </h2>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                    {editingAcordo
                      ? 'Atualize os dados do responsável, valores, condições de parcelamento ou status do acordo'
                      : 'Selecione o aluno, consolide títulos vencidos e gere o novo parcelamento'}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Fechar modal"
                  onClick={() => {
                    setShowModal(false)
                    resetModalState()
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'hsl(var(--text-muted))',
                    padding: 4,
                  }}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Seleção de Aluno + Responsável */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 12, alignItems: 'end' }}>
                  <div style={{ position: 'relative' }}>
                    <label htmlFor="acordo-aluno-input" className="form-label">Aluno *</label>
                    <div style={{ position: 'relative' }}>
                      <Search
                        size={13}
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          left: 11,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: 'hsl(var(--text-muted))',
                          pointerEvents: 'none',
                        }}
                      />
                      <input
                        id="acordo-aluno-input"
                        className="form-input"
                        style={{ paddingLeft: 34 }}
                        placeholder="Buscar aluno pelo nome..."
                        value={buscaAluno}
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                        onChange={(e) => {
                          setBuscaAluno(e.target.value)
                          setForm((f) => ({ ...f, alunoNome: e.target.value }))
                          setShowAlunoDropdown(true)
                          if (!e.target.value) {
                            setForm((f) => ({ ...f, alunoNome: '', responsavel: '', telefoneResponsavel: '' }))
                            setSelectedTituloIds([])
                          }
                        }}
                        onFocus={() => setShowAlunoDropdown(true)}
                        autoComplete="off"
                      />
                      {form.alunoNome && (
                        <button
                          type="button"
                          aria-label="Limpar aluno selecionado"
                          onClick={() => {
                            setBuscaAluno('')
                            setForm((f) => ({ ...f, alunoNome: '', responsavel: '', telefoneResponsavel: '' }))
                            setSelectedTituloIds([])
                            setShowAlunoDropdown(false)
                          }}
                          style={{
                            position: 'absolute',
                            right: 10,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'hsl(var(--text-muted))',
                            padding: 2,
                          }}
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {showAlunoDropdown &&
                      buscaAluno.length >= 1 &&
                      (() => {
                        const matches = (alunos || [])
                          .filter((a: any) => (a.nome || '').toLowerCase().includes(buscaAluno.toLowerCase()))
                          .slice(0, 8)
                        if (matches.length === 0)
                          return (
                            <div
                              style={{
                                position: 'absolute',
                                zIndex: 50,
                                width: '100%',
                                background: 'hsl(var(--bg-elevated))',
                                border: '1px solid hsl(var(--border-subtle))',
                                borderRadius: 8,
                                padding: '10px 14px',
                                fontSize: 12,
                                color: 'hsl(var(--text-muted))',
                                marginTop: 3,
                                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                              }}
                            >
                              Nenhum aluno encontrado
                            </div>
                          )
                        return (
                          <div
                            style={{
                              position: 'absolute',
                              zIndex: 50,
                              width: '100%',
                              background: 'hsl(var(--bg-elevated))',
                              border: '1px solid hsl(var(--border-subtle))',
                              borderRadius: 10,
                              overflow: 'hidden',
                              marginTop: 3,
                              boxShadow: '0 12px 32px rgba(0,0,0,0.35)',
                            }}
                          >
                            {matches.map((a: any) => {
                              const temAtraso = radarInadimplencia.some((r) => r.alunoNome === a.nome)
                              return (
                                <button
                                  key={a.id}
                                  type="button"
                                  onMouseDown={() => handleSelectAluno(a.nome)}
                                  style={{
                                    width: '100%',
                                    padding: '9px 14px',
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 30,
                                      height: 30,
                                      borderRadius: '50%',
                                      background:
                                        a.inadimplente || temAtraso
                                          ? 'rgba(239,68,68,0.15)'
                                          : 'rgba(99,102,241,0.15)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 11,
                                      fontWeight: 800,
                                      color: a.inadimplente || temAtraso ? '#ef4444' : '#6366f1',
                                      flexShrink: 0,
                                    }}
                                  >
                                    {(a.nome || 'A').charAt(0).toUpperCase()}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div
                                      style={{
                                        fontSize: 13,
                                        fontWeight: 700,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                      }}
                                    >
                                      {a.nome}
                                      {(a.inadimplente || temAtraso) && (
                                        <span
                                          style={{
                                            fontSize: 9,
                                            padding: '1px 5px',
                                            borderRadius: 4,
                                            background: 'rgba(239,68,68,0.15)',
                                            color: '#ef4444',
                                            fontWeight: 800,
                                          }}
                                        >
                                          PENDÊNCIA
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))' }}>
                                      {resolveTurmaNome(a.turma_nome || a.turma, a.nome) || 'Sem turma'} •{' '}
                                      {a.responsavel || 'Sem responsável'}
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        )
                      })()}
                  </div>

                  <div>
                    <label htmlFor="acordo-resp-input" className="form-label">Responsável Financeiro</label>
                    <input
                      id="acordo-resp-input"
                      value={form.responsavel}
                      onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))}
                      placeholder="Nome do responsável financeiro"
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Telefone do Responsável + Turma + Status do Acordo */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label htmlFor="acordo-fone-input" className="form-label">Telefone / WhatsApp</label>
                    <input
                      id="acordo-fone-input"
                      type="tel"
                      autoComplete="tel"
                      value={form.telefoneResponsavel}
                      onChange={(e) => setForm((f) => ({ ...f, telefoneResponsavel: e.target.value }))}
                      placeholder="(00) 00000-0000"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="acordo-turma-input" className="form-label">Turma</label>
                    <input
                      id="acordo-turma-input"
                      list="acordo-turmas-datalist"
                      value={resolveTurmaNome(form.turma, form.alunoNome) || form.turma}
                      onChange={(e) => setForm((f) => ({ ...f, turma: e.target.value }))}
                      placeholder="Ex: 9º Ano A"
                      className="form-input"
                    />
                    <datalist id="acordo-turmas-datalist">
                      {Array.from(
                        new Set(
                          turmasList
                            .map((t: any) => String(t?.nome || t?.dados?.nome || '').trim())
                            .filter(Boolean)
                        )
                      ).map((nomeT) => (
                        <option key={nomeT} value={nomeT} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label htmlFor="acordo-status-select" className="form-label">Status do Acordo</label>
                    <select
                      id="acordo-status-select"
                      className="form-input"
                      value={form.status}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, status: e.target.value as AcordoRenegociacao['status'] }))
                      }
                    >
                      <option value="ativo">● Acordo Ativo</option>
                      <option value="quitado">✓ Quitado</option>
                      <option value="inadimplente">⚠ Quebra / Atraso</option>
                    </select>
                  </div>
                </div>

                {/* Lista de Títulos do Aluno para Consolidar no Acordo */}
                {form.alunoNome && titulosDoAlunoNoModal.length > 0 && !editingAcordo && (
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      border: '1px solid hsl(var(--border-subtle))',
                      background: 'rgba(148, 163, 184, 0.05)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: 8,
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 11.5, fontWeight: 800 }}>
                        Títulos em Aberto / Vencidos de {form.alunoNome} ({selectedTituloIds.length} selecionado(s))
                      </span>
                      <label
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: 'pointer',
                          color: '#d97706',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={incluirEncargos}
                          onChange={(e) => setIncluirEncargos(e.target.checked)}
                        />
                        Incluir Multa (2%) + Mora (1% a.m.)
                      </label>
                    </div>

                    <div style={{ maxHeight: 135, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {titulosDoAlunoNoModal.map((t) => {
                        const checked = selectedTituloIds.includes(t.id)
                        const enc = calcularMultaJuros(t.valor, t.diasEmAtraso)
                        return (
                          <label
                            key={t.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 10px',
                              borderRadius: 8,
                              background: checked ? 'rgba(99, 102, 241, 0.08)' : 'hsl(var(--bg-elevated))',
                              border: checked
                                ? '1px solid rgba(99, 102, 241, 0.35)'
                                : '1px solid hsl(var(--border-subtle))',
                              fontSize: 11.5,
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedTituloIds((prev) => [...prev, t.id])
                                  } else {
                                    setSelectedTituloIds((prev) => prev.filter((id) => id !== t.id))
                                  }
                                }}
                              />
                              <div>
                                <div style={{ fontWeight: 700 }}>{t.descricao}</div>
                                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>
                                  Venc: {fmt(t.vencimento)}{' '}
                                  {t.diasEmAtraso > 0 ? `• ${t.diasEmAtraso}d em atraso` : '• A vencer'}
                                </div>
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, color: t.diasEmAtraso > 0 ? '#ef4444' : undefined }}>
                                {fmtCur(t.valor)}
                              </div>
                              {incluirEncargos && enc.totalEncargos > 0 && (
                                <div style={{ fontSize: 9.5, color: '#d97706', fontWeight: 700 }}>
                                  +{fmtCur(enc.totalEncargos)} encargos
                                </div>
                              )}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Motivo + Forma de Pagamento + Data do Acordo */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 0.9fr', gap: 12, alignItems: 'end' }}>
                  <div>
                    <label htmlFor="acordo-motivo-select" className="form-label">Motivo da Inadimplência</label>
                    <select
                      id="acordo-motivo-select"
                      className="form-input"
                      value={form.motivoInadimpl}
                      onChange={(e) => setForm((f) => ({ ...f, motivoInadimpl: e.target.value }))}
                    >
                      {MOTIVOS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="acordo-forma-select" className="form-label">Forma de Pagamento</label>
                    <select
                      id="acordo-forma-select"
                      className="form-input"
                      value={form.formaPagamento}
                      onChange={(e) => setForm((f) => ({ ...f, formaPagamento: e.target.value }))}
                    >
                      {FORMAS_PAGAMENTO.map((fp) => (
                        <option key={fp} value={fp}>
                          {fp}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="acordo-data-input" className="form-label">Data do Acordo</label>
                    <input
                      id="acordo-data-input"
                      type="date"
                      className="form-input"
                      value={form.data}
                      onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
                    />
                  </div>
                </div>

                {/* Linha de Valores Alinhada Perfeitamente */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                    alignItems: 'end',
                  }}
                >
                  <div>
                    <label htmlFor="acordo-vorig-input" className="form-label" style={{ whiteSpace: 'nowrap' }}>
                      Valor Original (R$)
                    </label>
                    <input
                      id="acordo-vorig-input"
                      type="number"
                      step="0.01"
                      value={form.valorOriginal}
                      onChange={(e) => {
                        const vOrig = parseFloat(e.target.value) || 0
                        const vn = (vOrig * (1 - (parseFloat(form.desconto) || 0) / 100)).toFixed(2)
                        if (editingAcordo) setRecalcularParcelasNoEdit(true)
                        setForm((f) => ({ ...f, valorOriginal: e.target.value, valorNegociado: vn }))
                      }}
                      placeholder="0.00"
                      className="form-input"
                      style={{ color: '#ef4444', fontWeight: 800 }}
                    />
                  </div>
                  <div>
                    <label htmlFor="acordo-desc-input" className="form-label" style={{ whiteSpace: 'nowrap' }}>
                      Desconto (%)
                    </label>
                    <input
                      id="acordo-desc-input"
                      type="number"
                      step="0.5"
                      min={0}
                      max={100}
                      value={form.desconto}
                      onChange={(e) => handleDescontoChange(e.target.value)}
                      placeholder="0"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="acordo-vneg-input" className="form-label" style={{ whiteSpace: 'nowrap' }}>
                      Valor Negociado (R$)
                    </label>
                    <input
                      id="acordo-vneg-input"
                      type="number"
                      step="0.01"
                      value={form.valorNegociado}
                      onChange={(e) => handleValorNegChange(e.target.value)}
                      placeholder="0.00"
                      className="form-input"
                      style={{ color: '#059669', fontWeight: 800 }}
                    />
                  </div>
                </div>

                {/* Entrada + Nº de Parcelas + 1º Vencimento */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 12,
                    alignItems: 'end',
                  }}
                >
                  <div>
                    <label htmlFor="acordo-entrada-input" className="form-label" style={{ whiteSpace: 'nowrap' }}>
                      Sinal / Entrada (R$)
                    </label>
                    <input
                      id="acordo-entrada-input"
                      type="number"
                      step="0.01"
                      min={0}
                      value={form.valorEntrada}
                      onChange={(e) => {
                        if (editingAcordo) setRecalcularParcelasNoEdit(true)
                        setForm((f) => ({ ...f, valorEntrada: e.target.value }))
                      }}
                      placeholder="0.00"
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label htmlFor="acordo-parcelas-select" className="form-label" style={{ whiteSpace: 'nowrap' }}>
                      Nº de Parcelas
                    </label>
                    <select
                      id="acordo-parcelas-select"
                      className="form-input"
                      value={form.parcelas}
                      onChange={(e) => {
                        if (editingAcordo) setRecalcularParcelasNoEdit(true)
                        setForm((f) => ({ ...f, parcelas: e.target.value }))
                      }}
                    >
                      <option value="1">À vista (1x)</option>
                      <option value="2">2x mensais</option>
                      <option value="3">3x mensais</option>
                      <option value="4">4x mensais</option>
                      <option value="5">5x mensais</option>
                      <option value="6">6x mensais</option>
                      <option value="7">7x mensais</option>
                      <option value="8">8x mensais</option>
                      <option value="9">9x mensais</option>
                      <option value="10">10x mensais</option>
                      <option value="12">12x mensais</option>
                      <option value="18">18x mensais</option>
                      <option value="24">24x mensais</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="acordo-venc1-input" className="form-label" style={{ whiteSpace: 'nowrap' }}>
                      1º Vencimento
                    </label>
                    <input
                      id="acordo-venc1-input"
                      type="date"
                      value={form.primeiroVencimento}
                      onChange={(e) => {
                        if (editingAcordo) setRecalcularParcelasNoEdit(true)
                        setForm((f) => ({ ...f, primeiroVencimento: e.target.value }))
                      }}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Conta Plano das Parcelas (Plano de Contas) */}
                <div>
                  <label htmlFor="acordo-conta-plano-select" className="form-label">
                    Conta Plano das Parcelas (Plano de Contas)
                  </label>
                  <select
                    id="acordo-conta-plano-select"
                    className="form-input"
                    value={form.contaPlano || DEFAULT_CONTA_PLANO}
                    onChange={(e) => setForm((f) => ({ ...f, contaPlano: e.target.value }))}
                  >
                    {opcoesContaPlano.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Opção de Sincronização de Parcelas em Modo Edição */}
                {editingAcordo && (
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 10,
                      background: recalcularParcelasNoEdit
                        ? 'rgba(2, 132, 199, 0.08)'
                        : 'rgba(148, 163, 184, 0.06)',
                      border: recalcularParcelasNoEdit
                        ? '1px solid rgba(2, 132, 199, 0.35)'
                        : '1px solid hsl(var(--border-subtle))',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={recalcularParcelasNoEdit}
                      onChange={(e) => setRecalcularParcelasNoEdit(e.target.checked)}
                      style={{ marginTop: 2 }}
                    />
                    <div>
                      <div style={{ fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                        Recalcular e atualizar parcelas em aberto no Contas a Receber
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                        {(() => {
                          const detEdit = detalhesPorAcordo.get(editingAcordo.id)
                          const pagasCount = detEdit?.pagas || 0
                          if (pagasCount > 0) {
                            return `Este acordo já possui ${pagasCount} parcela(s) paga(s) (${fmtCur(detEdit?.valorRecebido || 0)}). As parcelas pagas serão preservadas e apenas o saldo restante será redistribuído.`
                          }
                          return 'Ao marcar esta opção, as parcelas em aberto deste acordo serão atualizadas conforme o novo cronograma abaixo.'
                        })()}
                      </div>
                    </div>
                  </label>
                )}

                {/* Preview do Acordo + Cronograma de Parcelas */}
                {(valorOrig > 0 || cronogramaSimulado.totalNeg > 0) && (
                  <div
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(16, 185, 129, 0.07)',
                      borderRadius: 12,
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                        flexWrap: 'wrap',
                        gap: 6,
                      }}
                    >
                      <span style={{ fontWeight: 800, fontSize: 12, color: '#059669' }}>
                        Resumo & Cronograma Simulado das Parcelas
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                        <span>
                          Conta: <strong style={{ color: 'hsl(var(--text-primary))' }}>{form.contaPlano || DEFAULT_CONTA_PLANO}</strong>
                        </span>
                        <span>
                          • Economia:{' '}
                          <strong style={{ color: '#059669' }}>
                            {fmtCur(Math.max(0, valorOrig - cronogramaSimulado.totalNeg))}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        maxHeight: 120,
                        overflowY: 'auto',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))',
                        gap: 6,
                      }}
                    >
                      {cronogramaSimulado.items.map((it) => (
                        <div
                          key={it.numero}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 8,
                            background: 'hsl(var(--bg-elevated))',
                            border: '1px solid hsl(var(--border-subtle))',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            fontSize: 11,
                          }}
                        >
                          <span>
                            <strong>{it.numero}</strong> • {fmt(it.vencimento)}
                          </span>
                          <strong style={{ color: '#059669' }}>{fmtCur(it.valor)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="acordo-obs-textarea" className="form-label">Condições Especiais e Observações</label>
                  <textarea
                    id="acordo-obs-textarea"
                    value={form.obs}
                    onChange={(e) => setForm((f) => ({ ...f, obs: e.target.value }))}
                    placeholder="Descreva as condições acordadas, garantias ou observações para constar no Termo de Confissão..."
                    className="form-input"
                    rows={2}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false)
                    resetModalState()
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!form.alunoNome || saving}
                  className="btn btn-primary"
                  style={{ flex: 2 }}
                >
                  {saving
                    ? 'Salvando Acordo...'
                    : editingAcordo
                      ? '✓ Salvar Alterações do Acordo'
                      : '✓ Formalizar Acordo e Gerar Parcelas'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO / ESTORNO DO ACORDO ─────────────── */}
      {confirmDeleteAcordo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 20,
          }}
          onClick={() => setConfirmDeleteAcordo(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              maxWidth: 440,
              width: '100%',
              padding: 24,
              borderRadius: 18,
              border: '1px solid rgba(239, 68, 68, 0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: 'rgba(239, 68, 68, 0.12)',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Trash2 size={20} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800 }}>Cancelar / Excluir Acordo {confirmDeleteAcordo.id}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                  Aluno(a): <strong>{confirmDeleteAcordo.alunoNome}</strong>
                </div>
              </div>
            </div>

            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                fontSize: 12,
                cursor: 'pointer',
                marginTop: 10,
              }}
            >
              <input
                type="checkbox"
                checked={restaurarTitulosAoExcluir}
                onChange={(e) => setRestaurarTitulosAoExcluir(e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <span>
                Restaurar os títulos originais para o status <strong>Em Atraso</strong> e remover as parcelas em aberto
                deste acordo no Contas a Receber
              </span>
            </label>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setConfirmDeleteAcordo(null)}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626' }}
                onClick={handleConfirmDeleteAcordo}
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
