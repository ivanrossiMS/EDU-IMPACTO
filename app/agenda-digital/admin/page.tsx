'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSupabaseArray, invalidateCache } from '@/lib/useSupabaseCollection'
import { useAgendaDigital, ADComunicado, ADMomento } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/api/apiClient'
import { LoadingGlass } from '@/components/LoadingGlass'
import { DashboardEngajamento } from '@/components/agenda/DashboardEngajamento'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Send, Eye, MessageCircle, AlertCircle, Users, UserCheck,
  DollarSign, Image as ImageIcon, Calendar, Bell, TrendingUp,
  ArrowRight, Cake, ShieldAlert, CheckCircle2, Clock, Activity,
  Search, RefreshCw, BarChart3, Sparkles, MonitorSmartphone,
  FileText, Layers, Plus, Filter, X, ExternalLink, Heart,
  MessageSquare, Check, ChevronRight, Pin, Paperclip, BookOpen,
  Radio, CheckCircle, AlertTriangle
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MESES_NOMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val || 0))
}

function formatShortDate(raw?: string | null): string {
  if (!raw) return '—'
  const d = new Date(raw.includes('T') ? raw : `${raw}T12:00:00`)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function ADAdminDashboard() {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const {
    comunicados = [],
    momentosFeed = [],
    setMomentosFeedLocally,
    adConfig,
    chatGroups = []
  } = useAgendaDigital()
  const { currentUser } = useApp()
  const { ocorrencias = [], eventosAgenda = [], turmas = [] } = useData()

  const [alunos] = useSupabaseArray<any>('alunos/lightweight?limit=2000')
  const [titulos] = useSupabaseArray<any>('titulos')
  const [gruposAgenda] = useSupabaseArray<any>('agenda/grupos')

  // Estados de UI & Modais Interativos
  const [chartMode, setChartMode] = useState<'14d' | 'semana' | 'top'>('14d')
  const [commFilter, setCommFilter] = useState<'todos' | 'urgentes' | 'ciencia' | 'agendados'>('todos')
  const [commSearch, setCommSearch] = useState('')
  const [globalSearch, setGlobalSearch] = useState('')
  const [showGlobalSearchDropdown, setShowGlobalSearchDropdown] = useState(false)
  const [rightAgendaTab, setRightAgendaTab] = useState<'eventos' | 'nivers'>('eventos')
  const [niversScope, setNiversScope] = useState<'semana' | 'mes'>('mes')
  const [rightFeedTab, setRightFeedTab] = useState<'momentos' | 'ocorrencias'>('momentos')
  const [showEngajamentoModal, setShowEngajamentoModal] = useState(false)
  const [selectedComunicado, setSelectedComunicado] = useState<ADComunicado | null>(null)
  const [showOcorrenciasModal, setShowOcorrenciasModal] = useState(false)
  const [ocorrenciaSearch, setOcorrenciaSearch] = useState('')
  const [ocorrenciaGravidade, setOcorrenciaGravidade] = useState<'todas' | 'grave' | 'media' | 'leve'>('todas')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [approvingMomentoId, setApprovingMomentoId] = useState<string | number | null>(null)

  const searchContainerRef = useRef<HTMLDivElement>(null)
  const commSectionRef = useRef<HTMLDivElement>(null)
  const comunicadoDialogRef = useRef<HTMLDialogElement>(null)
  const ocorrenciasDialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = comunicadoDialogRef.current
    if (!dialog) return
    if (selectedComunicado) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [selectedComunicado])

  useEffect(() => {
    const dialog = ocorrenciasDialogRef.current
    if (!dialog) return
    if (showOcorrenciasModal) {
      if (!dialog.open) dialog.showModal()
    } else if (dialog.open) {
      dialog.close()
    }
  }, [showOcorrenciasModal])

  const handleDialogLightDismissFallback = useCallback((e: React.MouseEvent<HTMLDialogElement>) => {
    const dialog = e.currentTarget
    if ('closedBy' in HTMLDialogElement.prototype) return
    if (e.target !== dialog) return
    const rect = dialog.getBoundingClientRect()
    const isDialogContent =
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width
    if (!isDialogContent) {
      dialog.close()
    }
  }, [])

  // Dados reais de Aniversariantes via API dedicada (/api/agenda/aniversariantes)
  const [aniversariantesApi, setAniversariantesApi] = useState<any[]>([])
  const [loadingNivers, setLoadingNivers] = useState(false)

  // Dados reais de Cobranças da Agenda Digital (agenda_cobrancas_destinatarios)
  const [appCharges, setAppCharges] = useState<any[]>([])
  const [loadingCharges, setLoadingCharges] = useState(false)

  const fetchDashboardExtras = useCallback(async (silent = false) => {
    if (!silent) {
      setLoadingNivers(true)
      setLoadingCharges(true)
    }
    const mesAtual = new Date().getMonth() + 1

    try {
      const [niversRes, chargesRes] = await Promise.allSettled([
        fetch(`/api/agenda/aniversariantes?mes=${mesAtual}&_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Cache-Control': 'no-cache' }
        }).then(r => (r.ok ? r.json() : [])),
        supabase
          .from('agenda_cobrancas_destinatarios')
          .select('id, aluno_id, aluno_nome, status, valor_pago, agenda_cobrancas(id, titulo, valor, data_vencimento, status)')
          .order('created_at', { ascending: false })
          .limit(500)
      ])

      if (niversRes.status === 'fulfilled' && Array.isArray(niversRes.value)) {
        setAniversariantesApi(niversRes.value)
      }
      if (chargesRes.status === 'fulfilled' && chargesRes.value?.data) {
        setAppCharges(chargesRes.value.data)
      }
    } catch (e) {
      console.error('Erro ao carregar dados extras do dashboard:', e)
    } finally {
      setLoadingNivers(false)
      setLoadingCharges(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboardExtras(false)
  }, [fetchDashboardExtras])

  // Fechar dropdown de busca rápida ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowGlobalSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleRefreshAll = async () => {
    setIsRefreshing(true)
    try {
      invalidateCache('alunos/lightweight?limit=2000')
      invalidateCache('titulos')
      invalidateCache('agenda/grupos')
      await fetchDashboardExtras(true)
      toast.success('Painel atualizado com sucesso!')
    } finally {
      setTimeout(() => setIsRefreshing(false), 400)
    }
  }

  // Aprovar momento diretamente pelo Dashboard
  const handleQuickApproveMomento = async (momento: ADMomento) => {
    setApprovingMomentoId(momento.id)
    try {
      const updated = { ...momento, status: 'approved' as const }
      const res = await apiFetch('/api/agenda/momentos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: momento.id,
          dados: updated
        })
      })
      if (!res.ok) throw new Error('Falha ao aprovar momento')
      if (setMomentosFeedLocally) {
        setMomentosFeedLocally(prev =>
          prev.map(m => (String(m.id) === String(momento.id) ? { ...m, status: 'approved' } : m))
        )
      }
      toast.success('Momento aprovado e publicado no mural!')
    } catch (e) {
      toast.error('Não foi possível aprovar o momento.')
    } finally {
      setApprovingMomentoId(null)
    }
  }

  // ── Métricas de Alunos e Turmas ────────────────────────────────────────────
  const alunosAtivos = useMemo(
    () => (alunos || []).filter((a: any) => a.status === 'matriculado' || a.status === 'ativo' || !a.status),
    [alunos]
  )

  const totalGruposAtivos = useMemo(() => {
    const gLen = (gruposAgenda || []).length || (chatGroups || []).length
    if (gLen > 0) return gLen
    const uniqueT = new Set((alunosAtivos || []).map((a: any) => a.turma).filter(Boolean))
    return uniqueT.size || (turmas || []).length
  }, [gruposAgenda, chatGroups, alunosAtivos, turmas])

  // ── Aniversariantes (API dedicada + fallback local) ────────────────────────
  const { niversMesList, niversSemanaList, niversHojeCount } = useMemo(() => {
    const hoje = new Date()
    const diaHoje = hoje.getDate()
    const mesHoje = hoje.getMonth() + 1

    const source = aniversariantesApi.length > 0 ? aniversariantesApi : (alunos || [])

    const parsed = source
      .map((p: any) => {
        const raw = p.dataNasc || p.data_nascimento || p.dataNascimento || p.nascimento || ''
        if (!raw) return null
        const parts = raw.includes('/') ? raw.split('/') : raw.split('-')
        if (parts.length < 2) return null
        const dia = parseInt(raw.includes('/') ? parts[0] : parts[2], 10)
        const mes = parseInt(raw.includes('/') ? parts[1] : parts[1], 10)
        if (isNaN(dia) || isNaN(mes) || mes !== mesHoje) return null

        const diffDays = dia - diaHoje
        const isHoje = dia === diaHoje
        const isSemana = diffDays >= 0 && diffDays <= 7

        return {
          id: p.id || `${p.nome}-${dia}`,
          nome: p.nome || 'Sem nome',
          tipo: p.tipo || (p.cargo ? 'Colaborador' : 'Aluno'),
          turmaOuCargo: p.turmaNome || p.turma_nome || p.cargo || p.turma || 'Aluno',
          foto: p.foto || p.fotoAlt || p.fotoUrlAlt || null,
          dia,
          mes,
          isHoje,
          isSemana,
          diffDays
        }
      })
      .filter(Boolean) as Array<{
        id: string
        nome: string
        tipo: string
        turmaOuCargo: string
        foto: string | null
        dia: number
        mes: number
        isHoje: boolean
        isSemana: boolean
        diffDays: number
      }>

    parsed.sort((a, b) => {
      if (a.isHoje && !b.isHoje) return -1
      if (!a.isHoje && b.isHoje) return 1
      if (a.dia >= diaHoje && b.dia < diaHoje) return -1
      if (a.dia < diaHoje && b.dia >= diaHoje) return 1
      return a.dia - b.dia
    })

    return {
      niversMesList: parsed,
      niversSemanaList: parsed.filter(x => x.isSemana),
      niversHojeCount: parsed.filter(x => x.isHoje).length
    }
  }, [aniversariantesApi, alunos])

  // ── Cálculo de Destinatários e Taxas de Leitura/Ciência ────────────────────
  const getTargetDestinatariosCount = useMemo(() => {
    const ativos = alunosAtivos || []
    return (c: ADComunicado) => {
      if (ativos.length === 0) return 0
      const alunosIds = Array.isArray(c?.alunosIds)
        ? c.alunosIds
        : Array.isArray((c as any)?.dados?.alunosIds)
          ? (c as any).dados.alunosIds
          : []
      if (alunosIds.length > 0) return alunosIds.length

      const turmasAlvo = Array.isArray(c?.turmas)
        ? c.turmas
        : Array.isArray((c as any)?.dados?.turmas)
          ? (c as any).dados.turmas
          : []
      if (
        turmasAlvo.length > 0 &&
        !turmasAlvo.some((t: any) => String(t).toLowerCase() === 'todas' || String(t).toLowerCase() === 'todos')
      ) {
        const targetSet = new Set(turmasAlvo.map((t: any) => String(t).trim().toLowerCase()))
        const matched = ativos.filter((a: any) => {
          const at = String(a.turma || '').trim().toLowerCase()
          const atNome = String(a.turma_nome || '').trim().toLowerCase()
          return targetSet.has(at) || (atNome && targetSet.has(atNome))
        }).length
        if (matched > 0) return matched
      }
      return ativos.length
    }
  }, [alunosAtivos])

  const commMetrics = useMemo(() => {
    const ativos = alunosAtivos || []
    const allComs = Array.isArray(comunicados) ? comunicados : []
    const sentComs = allComs.filter(c => c.status === 'enviado' || !c.status)
    const scheduledOrDraft = allComs.filter(c => c.status === 'agendado' || c.status === 'rascunho')

    const seteDiasAtras = new Date()
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7)
    const enviados7d = sentComs.filter(c => {
      const d = new Date(c.dataEnvio || (c as any).data || (c as any).created_at || 0)
      return !isNaN(d.getTime()) && d >= seteDiasAtras
    }).length

    if (sentComs.length === 0 || ativos.length === 0) {
      return {
        totalEnviados: sentComs.length,
        enviados7d,
        scheduledCount: scheduledOrDraft.length,
        leituraRate: 0,
        cienciaRate: 0,
        totalLeituras: 0,
        totalCiencias: 0,
        exigemCienciaCount: 0,
        baixaCienciaCount: 0
      }
    }

    let tl = 0
    let tc = 0
    let expectedLeitura = 0
    let expectedCiencia = 0
    let exigemCienciaCount = 0
    let baixaCienciaCount = 0

    sentComs.forEach((c: ADComunicado) => {
      const target = getTargetDestinatariosCount(c)
      const lCount = Object.keys(c?.leituras || {}).length
      const cCount = Object.keys(c?.ciencias || {}).length
      tl += lCount
      tc += cCount
      expectedLeitura += target
      if (c.exigeCiencia) {
        exigemCienciaCount++
        expectedCiencia += target
        const rateC = target > 0 ? (cCount / target) * 100 : 0
        if (rateC < 50) baixaCienciaCount++
      }
    })

    return {
      totalEnviados: sentComs.length,
      enviados7d,
      scheduledCount: scheduledOrDraft.length,
      leituraRate: expectedLeitura > 0 ? Math.min(100, Math.round((tl / expectedLeitura) * 100)) : 0,
      cienciaRate:
        expectedCiencia > 0
          ? Math.min(100, Math.round((tc / expectedCiencia) * 100))
          : expectedLeitura > 0
            ? Math.min(100, Math.round((tc / expectedLeitura) * 100))
            : 0,
      totalLeituras: tl,
      totalCiencias: tc,
      exigemCienciaCount,
      baixaCienciaCount
    }
  }, [comunicados, alunosAtivos, getTargetDestinatariosCount])

  // ── Métricas Financeiras (Agenda Digital + ERP) ────────────────────────────
  const financeMetrics = useMemo(() => {
    let recebidoApp = 0
    let abertoApp = 0
    let vencidoApp = 0
    const alunosVencidosSet = new Set<string>()
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    appCharges.forEach((row: any) => {
      const cob = row.agenda_cobrancas
      if (!cob || cob.status === 'cancelled' || cob.status === 'cancelada') return
      const valor = Number(row.valor_pago || cob.valor || 0)
      const st = String(row.status || '').toUpperCase()
      if (st === 'PAID' || st === 'PAGO' || st === 'RECEIVED' || st === 'CONFIRMED') {
        recebidoApp += valor
      } else {
        const venc = cob.data_vencimento ? new Date(`${cob.data_vencimento}T12:00:00`) : null
        if (venc && venc < hoje) {
          vencidoApp += valor
          if (row.aluno_id) alunosVencidosSet.add(String(row.aluno_id))
        } else {
          abertoApp += valor
        }
      }
    })

    // Complementa com títulos do ERP caso não haja cobranças no módulo app
    const erpAtrasados = (titulos || []).filter((t: any) => t.status === 'atrasado')
    const erpPendentes = (titulos || []).filter((t: any) => t.status === 'pendente')
    const erpPagos = (titulos || []).filter((t: any) => t.status === 'pago')

    const totalVencidoErp = erpAtrasados.reduce((acc: number, t: any) => acc + (Number(t.valor) || 0), 0)
    const totalAbertoErp = erpPendentes.reduce((acc: number, t: any) => acc + (Number(t.valor) || 0), 0)
    const totalPagoErp = erpPagos.reduce((acc: number, t: any) => acc + (Number(t.valor) || 0), 0)

    const inadimplentesCadastro = (alunos || []).filter(
      (a: any) => a.inadimplente === true || a.inadimplente === 'true'
    )
    inadimplentesCadastro.forEach((a: any) => {
      if (a.id) alunosVencidosSet.add(String(a.id))
    })

    const hasAppData = appCharges.length > 0
    const totalEmAberto = hasAppData ? abertoApp + vencidoApp : totalAbertoErp + totalVencidoErp
    const totalVencido = hasAppData ? vencidoApp : totalVencidoErp
    const totalRecebido = hasAppData ? recebidoApp : totalPagoErp
    const totalGeral = totalEmAberto + totalRecebido
    const pctRecebido = totalGeral > 0 ? Math.round((totalRecebido / totalGeral) * 100) : 100

    return {
      totalEmAberto,
      totalVencido,
      totalRecebido,
      pctRecebido,
      inadimplentesCount: alunosVencidosSet.size,
      totalCobrancasCount: hasAppData ? appCharges.length : (titulos || []).length
    }
  }, [appCharges, titulos, alunos])

  // ── Momentos & Ocorrências & Eventos ──────────────────────────────────────
  const momentosPendentesList = useMemo(
    () => (momentosFeed || []).filter((m: any) => m.status === 'pending'),
    [momentosFeed]
  )

  const momentosRecentesList = useMemo(
    () =>
      [...(momentosFeed || [])]
        .sort(
          (a: any, b: any) =>
            new Date(b.date || b.created_at || 0).getTime() - new Date(a.date || a.created_at || 0).getTime()
        )
        .slice(0, 4),
    [momentosFeed]
  )

  const ocorrenciasRecentes = useMemo(() => {
    const limite = new Date()
    limite.setDate(limite.getDate() - 7)
    return [...(ocorrencias || [])]
      .filter((o: any) => {
        const raw = o.created_at || o.createdAt || o.data
        if (!raw) return true
        const d = new Date(raw)
        return isNaN(d.getTime()) ? true : d >= limite
      })
      .sort((a: any, b: any) => {
        const da = new Date(a.created_at || a.createdAt || a.data || 0).getTime()
        const db = new Date(b.created_at || b.createdAt || b.data || 0).getTime()
        return db - da
      })
  }, [ocorrencias])

  const filteredOcorrenciasModal = useMemo(() => {
    const q = ocorrenciaSearch.trim().toLowerCase()
    return ocorrenciasRecentes.filter((o: any) => {
      const grav = String(o.gravidade || 'leve').toLowerCase()
      if (ocorrenciaGravidade !== 'todas' && grav !== ocorrenciaGravidade) return false
      if (!q) return true
      return (
        String(o.alunoNome || o.aluno_nome || '').toLowerCase().includes(q) ||
        String(o.turma || '').toLowerCase().includes(q) ||
        String(o.descricao || o.tipo || '').toLowerCase().includes(q)
      )
    })
  }, [ocorrenciasRecentes, ocorrenciaSearch, ocorrenciaGravidade])

  const proximosEventos = useMemo(() => {
    const h = new Date()
    const todayStr = `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`
    return [...(eventosAgenda || [])]
      .filter(e => e.data >= todayStr)
      .sort((a, b) => ((a.data || '') + (a.horaInicio || '') < (b.data || '') + (b.horaInicio || '') ? -1 : 1))
      .slice(0, 5)
  }, [eventosAgenda])

  // ── Dados do Gráfico (3 modos: 14 dias, Dia da Semana, Top Comunicados) ────
  const chartData14d = useMemo(() => {
    const days: Array<{ name: string; fullDate: string; envios: number; leituras: number; ciencias: number }> = []
    const map = new Map<string, { name: string; fullDate: string; envios: number; leituras: number; ciencias: number }>()

    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      const item = { name: label, fullDate: key, envios: 0, leituras: 0, ciencias: 0 }
      days.push(item)
      map.set(key, item)
    }

    ;(comunicados || []).forEach((c: ADComunicado) => {
      const rawDate = c.dataEnvio || (c as any).data || (c as any).created_at
      if (!rawDate) return
      const d = new Date(rawDate)
      if (isNaN(d.getTime())) return
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const bucket = map.get(key)
      if (bucket) {
        bucket.envios += 1
        bucket.leituras += Object.keys(c.leituras || {}).length
        bucket.ciencias += Object.keys(c.ciencias || {}).length
      }
    })

    return days
  }, [comunicados])

  const chartDataSemana = useMemo(() => {
    const base = DIAS_SEMANA.map(name => ({ name, envios: 0, leituras: 0, ciencias: 0 }))
    ;(comunicados || []).forEach((c: ADComunicado) => {
      const rawDate = c.dataEnvio || (c as any).data || (c as any).created_at
      if (rawDate) {
        const d = new Date(rawDate)
        if (!isNaN(d.getTime())) {
          const idx = d.getDay()
          base[idx].envios += 1
          base[idx].leituras += Object.keys(c.leituras || {}).length
          base[idx].ciencias += Object.keys(c.ciencias || {}).length
        }
      }
    })
    return base
  }, [comunicados])

  const chartDataTop = useMemo(() => {
    return [...(comunicados || [])]
      .filter(c => c.status === 'enviado' || !c.status)
      .slice(0, 8)
      .map(c => {
        const denom = getTargetDestinatariosCount(c)
        const leituras = Object.keys(c.leituras || {}).length
        const ciencias = Object.keys(c.ciencias || {}).length
        const taxaLeitura = denom > 0 ? Math.min(100, Math.round((leituras / denom) * 100)) : 0
        const taxaCiencia = denom > 0 ? Math.min(100, Math.round((ciencias / denom) * 100)) : 0
        const cleanTitle = (c.titulo || 'Sem título').trim()
        return {
          name: cleanTitle.length > 16 ? cleanTitle.slice(0, 16) + '…' : cleanTitle,
          fullTitle: cleanTitle,
          taxaLeitura,
          taxaCiencia,
          leituras
        }
      })
  }, [comunicados, getTargetDestinatariosCount])

  // ── Comunicados Recentes com Filtros e Busca ───────────────────────────────
  const filteredRecentComms = useMemo(() => {
    const q = commSearch.trim().toLowerCase()
    return [...(comunicados || [])]
      .filter((c: ADComunicado) => {
        if (commFilter === 'urgentes') {
          if (c.prioridade !== 'urgente' && c.prioridade !== 'alta') return false
        } else if (commFilter === 'ciencia') {
          if (!c.exigeCiencia) return false
        } else if (commFilter === 'agendados') {
          if (c.status !== 'agendado' && c.status !== 'rascunho') return false
        } else {
          if (c.status && c.status !== 'enviado') return false
        }

        if (!q) return true
        const matchTitle = String(c.titulo || '').toLowerCase().includes(q)
        const matchAutor = String(c.autor || '').toLowerCase().includes(q)
        const matchTurma = Array.isArray(c.turmas) && c.turmas.some(t => String(t).toLowerCase().includes(q))
        return matchTitle || matchAutor || matchTurma
      })
      .sort((a, b) => {
        const timeA = new Date(a.dataEnvio || (a as any).data || (a as any).created_at || 0).getTime()
        const timeB = new Date(b.dataEnvio || (b as any).data || (b as any).created_at || 0).getTime()
        return timeB - timeA
      })
      .slice(0, 8)
  }, [comunicados, commFilter, commSearch])

  // ── Busca Global Rápida (Alunos, Turmas, Comunicados) ─────────────────────
  const globalSearchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase()
    if (q.length < 2) return { alunos: [], comunicados: [], turmas: [] }

    const matchedAlunos = (alunosAtivos || [])
      .filter((a: any) => String(a.nome || '').toLowerCase().includes(q) || String(a.matricula || '').toLowerCase().includes(q))
      .slice(0, 4)

    const matchedComms = (comunicados || [])
      .filter((c: ADComunicado) => String(c.titulo || '').toLowerCase().includes(q))
      .slice(0, 3)

    const sourceGrupos = (gruposAgenda && gruposAgenda.length > 0) ? gruposAgenda : (turmas || [])
    const matchedTurmas = sourceGrupos
      .filter((t: any) => String(t.nome || t.codigo || '').toLowerCase().includes(q))
      .slice(0, 3)

    return { alunos: matchedAlunos, comunicados: matchedComms, turmas: matchedTurmas }
  }, [globalSearch, alunosAtivos, comunicados, gruposAgenda, turmas])

  // ── Status do Horário de Atendimento ───────────────────────────────────────
  const chatStatusInfo = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const minsNow = now.getHours() * 60 + now.getMinutes()
    const ha = adConfig?.chatAuto?.horarioAtendimento
    const inicioStr = ha?.horarioInicio || adConfig?.horarios?.inicio || '07:00'
    const fimStr = ha?.horarioFim || adConfig?.horarios?.fim || '18:00'
    const diasAtivos = ha?.diasSemana || [1, 2, 3, 4, 5]

    const [hI, mI] = inicioStr.split(':').map(Number)
    const [hF, mF] = fimStr.split(':').map(Number)
    const minStart = (hI || 7) * 60 + (mI || 0)
    const minEnd = (hF || 18) * 60 + (mF || 0)

    const isOnline = diasAtivos.includes(day) && minsNow >= minStart && minsNow <= minEnd
    return {
      isOnline,
      label: isOnline ? 'Atendimento Ativo' : 'Fora do Expediente',
      window: `${inicioStr} às ${fimStr}`
    }
  }, [adConfig])

  const nowDate = new Date()
  const hora = nowDate.getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'
  const dataFormatada = nowDate.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  })

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500 font-medium">
        <LoadingGlass />
      </div>
    )
  }

  const quickShortcuts = [
    {
      icon: Send,
      label: 'Novo Comunicado',
      desc: 'Turmas, grupos ou individual',
      href: '/agenda-digital/admin/comunicados',
      color: '#6366f1',
      bg: 'rgba(99, 102, 241, 0.1)',
      badge: `${commMetrics.totalEnviados} enviados`
    },
    {
      icon: ImageIcon,
      label: 'Galeria & Momentos',
      desc: momentosPendentesList.length > 0 ? `${momentosPendentesList.length} aguardando aprovação` : 'Mural de fotos e vídeos',
      href: '/agenda-digital/admin/momentos',
      color: '#ec4899',
      bg: 'rgba(236, 72, 153, 0.1)',
      badge: momentosPendentesList.length > 0 ? `${momentosPendentesList.length} pendente(s)` : 'Em dia',
      badgeAlert: momentosPendentesList.length > 0
    },
    {
      icon: Calendar,
      label: 'Calendário Escolar',
      desc: 'Eventos, provas e reuniões',
      href: '/agenda-digital/admin/calendario',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.1)',
      badge: `${proximosEventos.length} próximos`
    },
    {
      icon: MessageCircle,
      label: 'Chat & Moderação',
      desc: 'Auditoria de atendimento',
      href: '/agenda-digital/admin/chat',
      color: '#0ea5e9',
      bg: 'rgba(14, 165, 233, 0.1)',
      badge: chatStatusInfo.window
    },
    {
      icon: MonitorSmartphone,
      label: 'Espelhar Agenda',
      desc: 'Simular visão da família',
      href: '/agenda-digital/admin/espelhar',
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.1)',
      badge: 'Tempo real'
    },
    {
      icon: FileText,
      label: 'Relatórios & Forms',
      desc: 'Pareceres e autorizações',
      href: '/agenda-digital/admin/relatorios',
      color: '#f59e0b',
      bg: 'rgba(245, 158, 11, 0.1)',
      badge: 'Templates'
    },
    {
      icon: Layers,
      label: 'Turmas & Equipes',
      desc: 'Grupos e permissões',
      href: '/agenda-digital/admin/turmas',
      color: '#14b8a6',
      bg: 'rgba(20, 184, 166, 0.1)',
      badge: `${totalGruposAtivos} grupos`
    },
    {
      icon: Radio,
      label: 'Testar Push',
      desc: 'Diagnóstico por aluno',
      href: '/agenda-digital/admin/push-teste',
      color: '#64748b',
      bg: 'rgba(100, 116, 139, 0.1)',
      badge: 'Simulador'
    }
  ]

  return (
    <div className="ad-dash-root">
      <style dangerouslySetInnerHTML={{__html: `
        dialog:modal {
          overscroll-behavior: contain;
        }

        dialog::backdrop {
          overflow: hidden;
          overscroll-behavior: contain;
          background-color: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }

        .ad-admin-modal-dialog {
          margin: auto;
          padding: 0;
          border: 1px solid hsl(var(--border-subtle));
          border-radius: 20px;
          background: hsl(var(--bg-surface));
          color: hsl(var(--text-main));
          width: calc(100vw - 32px);
          max-height: 85dvh;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.22);
          overflow: hidden;
          overscroll-behavior: contain;
        }

        .ad-admin-modal-dialog[open] {
          display: flex;
          flex-direction: column;
        }

        .ad-dash-root {
          container-type: inline-size;
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
          padding-bottom: 36px;
        }

        .ad-dash-hero {
          position: relative;
          background: hsl(var(--bg-surface));
          border: 1px solid hsl(var(--border-subtle));
          border-radius: 20px;
          padding: 22px 24px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          box-shadow: 0 4px 20px -6px rgba(15, 23, 42, 0.05);
          overflow: visible;
        }

        .ad-dash-hero-title {
          font-size: clamp(1.35rem, 1.1rem + 0.9vw, 1.75rem);
          font-weight: 900;
          font-family: 'Outfit', sans-serif;
          margin: 0;
          color: hsl(var(--text-main));
          letter-spacing: -0.02em;
          line-height: 1.2;
        }

        .ad-dash-kpi-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .ad-dash-shortcuts-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .ad-dash-bento-main {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          align-items: start;
        }

        .ad-comm-list-container {
          container-type: inline-size;
        }

        .ad-comm-row {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          border-radius: 14px;
          border: 1px solid transparent;
          transition: all 0.18s ease;
          cursor: pointer;
        }

        .ad-comm-row:hover {
          background: hsl(var(--bg-main));
          border-color: hsl(var(--border-subtle));
          transform: translateX(2px);
        }

        @media (min-width: 640px) {
          .ad-dash-kpi-grid {
            grid-template-columns: repeat(3, 1fr);
          }
          .ad-dash-shortcuts-grid {
            grid-template-columns: repeat(4, 1fr);
          }
          .ad-comm-row {
            flex-direction: row;
            align-items: center;
          }
        }

        @media (min-width: 1100px) {
          .ad-dash-kpi-grid {
            grid-template-columns: repeat(6, 1fr);
          }
          .ad-dash-bento-main {
            grid-template-columns: 1.65fr 1fr;
          }
        }

        @supports (container-type: inline-size) {
          @container (min-width: 560px) {
            .ad-comm-row {
              flex-direction: row;
              align-items: center;
            }
          }
          @container (min-width: 980px) {
            .ad-dash-kpi-grid {
              grid-template-columns: repeat(6, 1fr);
            }
            .ad-dash-bento-main {
              grid-template-columns: 1.65fr 1fr;
            }
          }
        }

        .ad-kpi-card {
          background: hsl(var(--bg-surface));
          border: 1px solid hsl(var(--border-subtle));
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
          text-decoration: none;
        }

        .ad-kpi-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 24px -8px rgba(15, 23, 42, 0.1);
          border-color: rgba(99, 102, 241, 0.35);
        }

        .ad-shortcut-card {
          background: hsl(var(--bg-surface));
          border: 1px solid hsl(var(--border-subtle));
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          height: 100%;
        }

        .ad-shortcut-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 22px -8px rgba(15, 23, 42, 0.08);
          border-color: rgba(99, 102, 241, 0.3);
        }

        .ad-surface-card {
          background: hsl(var(--bg-surface));
          border: 1px solid hsl(var(--border-subtle));
          border-radius: 18px;
          padding: 20px;
          box-shadow: 0 2px 12px -4px rgba(15, 23, 42, 0.04);
        }

        @keyframes adSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .ad-spin {
          animation: adSpin 0.8s linear infinite;
        }
      `}} />

      {/* ── 1. HERO & BARRA DE COMANDO ──────────────────────────────────────── */}
      <div className="ad-dash-hero">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240, flex: '1 1 300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 11.5, fontWeight: 700, color: 'hsl(var(--text-muted))',
              textTransform: 'capitalize'
            }}>
              {dataFormatada}
            </span>
            <span style={{ color: 'hsl(var(--border-subtle))' }}>•</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, fontWeight: 700,
              padding: '3px 9px', borderRadius: 999,
              background: chatStatusInfo.isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
              color: chatStatusInfo.isOnline ? '#059669' : '#d97706'
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: chatStatusInfo.isOnline ? '#10b981' : '#f59e0b'
              }} />
              {chatStatusInfo.label} ({chatStatusInfo.window})
            </span>
          </div>

          <h1 className="ad-dash-hero-title">
            {saudacao}, {currentUser?.nome?.split(' ')[0] || 'Admin'} 👋
          </h1>
          <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>
            Acompanhe o engajamento das famílias, aprove publicações e gerencie a operação escolar em um só lugar.
          </p>
        </div>

        {/* Busca Rápida Global + Botões de Comando */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: '1 1 420px', justifyContent: 'flex-end' }}>
          {/* Localizador Rápido */}
          <div ref={searchContainerRef} style={{ position: 'relative', flex: '1 1 220px', maxWidth: 320 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'hsl(var(--bg-main))',
              border: '1px solid hsl(var(--border-subtle))',
              borderRadius: 12, padding: '8px 12px'
            }}>
              <Search size={15} color="hsl(var(--text-muted))" style={{ flexShrink: 0 }} />
              <input
                type="text"
                value={globalSearch}
                onFocus={() => setShowGlobalSearchDropdown(true)}
                onChange={e => {
                  setGlobalSearch(e.target.value)
                  setShowGlobalSearchDropdown(true)
                }}
                placeholder="Buscar aluno, turma ou comunicado..."
                style={{
                  border: 'none', background: 'transparent', outline: 'none',
                  fontSize: 12.5, color: 'hsl(var(--text-main))', width: '100%'
                }}
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'hsl(var(--text-muted))', display: 'flex' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Dropdown de Resultados Instantâneos */}
            {showGlobalSearchDropdown && globalSearch.trim().length >= 2 && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                background: 'hsl(var(--bg-surface))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 14, padding: 10, zIndex: 120,
                boxShadow: '0 14px 34px rgba(15, 23, 42, 0.16)',
                maxHeight: '60dvh', overflowY: 'auto'
              }}>
                {globalSearchResults.alunos.length === 0 &&
                 globalSearchResults.comunicados.length === 0 &&
                 globalSearchResults.turmas.length === 0 ? (
                  <div style={{ padding: '14px 8px', textAlign: 'center', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                    Nenhum resultado para &ldquo;{globalSearch}&rdquo;
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {globalSearchResults.alunos.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', padding: '0 6px 4px' }}>
                          Alunos ({globalSearchResults.alunos.length})
                        </div>
                        {globalSearchResults.alunos.map((a: any) => (
                          <div
                            key={a.id}
                            onClick={() => {
                              setShowGlobalSearchDropdown(false)
                              router.push('/agenda-digital/admin/pessoas')
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '7px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-main))')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: 'hsl(var(--text-main))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {a.nome}
                              </div>
                              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Turma: {a.turma || '—'}</div>
                            </div>
                            <ChevronRight size={14} color="hsl(var(--text-muted))" />
                          </div>
                        ))}
                      </div>
                    )}

                    {globalSearchResults.comunicados.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', padding: '0 6px 4px' }}>
                          Comunicados ({globalSearchResults.comunicados.length})
                        </div>
                        {globalSearchResults.comunicados.map((c: ADComunicado) => (
                          <div
                            key={c.id}
                            onClick={() => {
                              setShowGlobalSearchDropdown(false)
                              setSelectedComunicado(c)
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '7px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-main))')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 700, color: 'hsl(var(--text-main))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {c.titulo}
                              </div>
                              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Por {c.autor || 'Equipe'}</div>
                            </div>
                            <Eye size={13} color="#6366f1" />
                          </div>
                        ))}
                      </div>
                    )}

                    {globalSearchResults.turmas.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', padding: '0 6px 4px' }}>
                          Turmas / Grupos ({globalSearchResults.turmas.length})
                        </div>
                        {globalSearchResults.turmas.map((t: any) => (
                          <div
                            key={t.id || t.nome}
                            onClick={() => {
                              setShowGlobalSearchDropdown(false)
                              router.push('/agenda-digital/admin/turmas')
                            }}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '7px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 12.5
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'hsl(var(--bg-main))')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span style={{ fontWeight: 700, color: 'hsl(var(--text-main))' }}>{t.nome || t.codigo}</span>
                            <ChevronRight size={14} color="hsl(var(--text-muted))" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleRefreshAll}
            title="Atualizar indicadores"
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 38, height: 38, borderRadius: 11,
              background: 'hsl(var(--bg-main))',
              border: '1px solid hsl(var(--border-subtle))',
              color: 'hsl(var(--text-muted))', cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            <RefreshCw size={15} className={isRefreshing ? 'ad-spin' : ''} />
          </button>

          <button
            type="button"
            onClick={() => setShowEngajamentoModal(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '9px 14px', borderRadius: 11,
              background: 'hsl(var(--bg-main))',
              border: '1px solid hsl(var(--border-subtle))',
              color: 'hsl(var(--text-main))', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            <BarChart3 size={15} color="#6366f1" />
            <span>Análise 30d</span>
          </button>

          <Link href="/agenda-digital/admin/comunicados" style={{ textDecoration: 'none' }}>
            <button
              type="button"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 16px', borderRadius: 11,
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                border: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700,
                boxShadow: '0 6px 16px rgba(99, 102, 241, 0.28)',
                cursor: 'pointer', transition: 'all 0.15s'
              }}
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>Novo Comunicado</span>
            </button>
          </Link>
        </div>
      </div>

      {/* ── 2. CENTRAL DE ATENÇÃO / ALERTAS ACIONÁVEIS (COMPACTOS) ─────────── */}
      {(momentosPendentesList.length > 0 ||
        ocorrenciasRecentes.length > 0 ||
        financeMetrics.inadimplentesCount > 0 ||
        commMetrics.baixaCienciaCount > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <span style={{
            fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.05em', color: 'hsl(var(--text-muted))',
            display: 'inline-flex', alignItems: 'center', gap: 5, marginRight: 4
          }}>
            <Sparkles size={13} color="#6366f1" /> Atenção Rápida:
          </span>

          {momentosPendentesList.length > 0 && (
            <button
              type="button"
              onClick={() => setRightFeedTab('momentos')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '7px 13px', borderRadius: 999,
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.25)',
                color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}
            >
              <ImageIcon size={14} />
              <span>{momentosPendentesList.length} momento(s) aguardando aprovação</span>
              <ArrowRight size={13} />
            </button>
          )}

          {ocorrenciasRecentes.length > 0 && (
            <button
              type="button"
              onClick={() => setShowOcorrenciasModal(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '7px 13px', borderRadius: 999,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.22)',
                color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}
            >
              <AlertCircle size={14} />
              <span>{ocorrenciasRecentes.length} ocorrência(s) nos últimos 7 dias (Inspecionar)</span>
              <ArrowRight size={13} />
            </button>
          )}

          {commMetrics.baixaCienciaCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setCommFilter('ciencia')
                commSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '7px 13px', borderRadius: 999,
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                color: '#d97706', fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}
            >
              <CheckCircle2 size={14} />
              <span>{commMetrics.baixaCienciaCount} comunicado(s) com ciência abaixo de 50%</span>
              <ArrowRight size={13} />
            </button>
          )}

          {financeMetrics.inadimplentesCount > 0 && (
            <Link href="/agenda-digital/admin/cobrancas" style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '7px 13px', borderRadius: 999,
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.22)',
                color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer'
              }}>
                <ShieldAlert size={14} />
                <span>{financeMetrics.inadimplentesCount} pendência(s) financeira(s) em aberto</span>
                <ArrowRight size={13} />
              </div>
            </Link>
          )}
        </div>
      )}

      {/* ── 3. BENTO KPI CARDS (6 INDICADORES INTERATIVOS) ─────────────────── */}
      <div className="ad-dash-kpi-grid">
        {/* KPI 1: Alunos & Turmas */}
        <Link href="/agenda-digital/admin/pessoas" className="ad-kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Users size={19} />
            </div>
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.1)', color: '#059669'
            }}>
              {totalGruposAtivos} grupos
            </span>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-main))', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>
              {alunosAtivos.length}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
              Alunos Ativos
            </div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', opacity: 0.8, marginTop: 2 }}>
              de {(alunos || []).length} cadastrados
            </div>
          </div>
        </Link>

        {/* KPI 2: Comunicados Enviados */}
        <Link href="/agenda-digital/admin/comunicados" className="ad-kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Send size={18} />
            </div>
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
              background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed'
            }}>
              +{commMetrics.enviados7d} (7d)
            </span>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-main))', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>
              {commMetrics.totalEnviados}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
              Comunicados
            </div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', opacity: 0.8, marginTop: 2 }}>
              {commMetrics.scheduledCount > 0 ? `${commMetrics.scheduledCount} agendados/rascunhos` : 'Todos disparados'}
            </div>
          </div>
        </Link>

        {/* KPI 3: Taxa de Leitura */}
        <div onClick={() => setShowEngajamentoModal(true)} className="ad-kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Eye size={19} />
            </div>
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
              background: 'rgba(236, 72, 153, 0.1)', color: '#db2777'
            }}>
              {commMetrics.totalLeituras} leituras
            </span>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#ec4899', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>
              {commMetrics.leituraRate}%
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
              Taxa de Leitura
            </div>
            <div style={{ width: '100%', height: 4, borderRadius: 99, background: 'hsl(var(--border-subtle))', marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: `${commMetrics.leituraRate}%`, height: '100%', background: '#ec4899', borderRadius: 99 }} />
            </div>
          </div>
        </div>

        {/* KPI 4: Taxa de Ciência */}
        <div
          onClick={() => {
            setCommFilter('ciencia')
            commSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}
          className="ad-kpi-card"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <CheckCircle2 size={19} />
            </div>
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
              background: 'rgba(6, 182, 212, 0.1)', color: '#0891b2'
            }}>
              {commMetrics.totalCiencias} ciências
            </span>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#06b6d4', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>
              {commMetrics.cienciaRate}%
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
              Confirmações
            </div>
            <div style={{ width: '100%', height: 4, borderRadius: 99, background: 'hsl(var(--border-subtle))', marginTop: 6, overflow: 'hidden' }}>
              <div style={{ width: `${commMetrics.cienciaRate}%`, height: '100%', background: '#06b6d4', borderRadius: 99 }} />
            </div>
          </div>
        </div>

        {/* KPI 5: Galeria de Momentos */}
        <Link href="/agenda-digital/admin/momentos" className="ad-kpi-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: 'rgba(16, 185, 129, 0.1)', color: '#10b981',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ImageIcon size={19} />
            </div>
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
              background: momentosPendentesList.length > 0 ? 'rgba(245, 158, 11, 0.14)' : 'rgba(16, 185, 129, 0.1)',
              color: momentosPendentesList.length > 0 ? '#d97706' : '#059669'
            }}>
              {momentosPendentesList.length > 0 ? `${momentosPendentesList.length} pendentes` : '0 pendentes'}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-main))', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>
              {(momentosFeed || []).length}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
              Momentos no Mural
            </div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', opacity: 0.8, marginTop: 2 }}>
              Fotos e vídeos publicados
            </div>
          </div>
        </Link>

        {/* KPI 6: Aniversariantes (Mês & Semana) */}
        <div
          onClick={() => {
            setRightAgendaTab('nivers')
          }}
          className="ad-kpi-card"
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Cake size={19} />
            </div>
            <span style={{
              fontSize: 10.5, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
              background: niversHojeCount > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)',
              color: '#d97706'
            }}>
              {niversHojeCount > 0 ? `🎉 ${niversHojeCount} hoje!` : `${niversMesList.length} no mês`}
            </span>
          </div>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#f59e0b', fontFamily: 'Outfit, sans-serif', lineHeight: 1.1 }}>
              {niversSemanaList.length > 0 ? niversSemanaList.length : niversMesList.length}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
              Aniversariantes
            </div>
            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', opacity: 0.8, marginTop: 2 }}>
              {niversSemanaList.length > 0
                ? `${niversSemanaList.length} nos próximos 7 dias`
                : `Em ${MESES_NOMES[nowDate.getMonth()]}`}
            </div>
          </div>
        </div>
      </div>

      {/* ── 4. ATALHOS RÁPIDOS DOS MÓDULOS (8 CARDS COMPACTOS E MODERNOS) ──── */}
      <div className="ad-dash-shortcuts-grid">
        {quickShortcuts.map((item, idx) => {
          const IconComp = item.icon
          return (
            <Link key={idx} href={item.href} className="ad-shortcut-card">
              <div style={{
                width: 40, height: 40, borderRadius: 12,
                background: item.bg, color: item.color,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <IconComp size={19} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{
                    fontWeight: 800, fontSize: 13, color: 'hsl(var(--text-main))',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {item.label}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                    background: item.badgeAlert ? 'rgba(236, 72, 153, 0.15)' : 'hsl(var(--bg-main))',
                    color: item.badgeAlert ? '#db2777' : 'hsl(var(--text-muted))',
                    flexShrink: 0
                  }}>
                    {item.badge}
                  </span>
                </div>
                <div style={{
                  fontSize: 11.5, color: 'hsl(var(--text-muted))', marginTop: 3,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {item.desc}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* ── 5. GRID PRINCIPAL: ANALYTICS & COMUNICADOS (ESQ) + OPERACIONAL (DIR) ── */}
      <div className="ad-dash-bento-main">
        {/* COLUNA ESQUERDA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          {/* Card: Gráfico Interativo de Engajamento */}
          <div className="ad-surface-card">
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              justifyContent: 'space-between', gap: 12, marginBottom: 18
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0 }}>
                    Engajamento & Alcance Escolar
                  </h3>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: 'rgba(16, 185, 129, 0.1)', color: '#059669',
                    display: 'inline-flex', alignItems: 'center', gap: 4
                  }}>
                    <Activity size={11} /> {commMetrics.totalLeituras} leituras
                  </span>
                </div>
                <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '2px 0 0' }}>
                  Comparativo entre comunicados disparados, famílias que visualizaram e confirmações.
                </p>
              </div>

              {/* Seletor de Modo do Gráfico */}
              <div style={{
                display: 'inline-flex', background: 'hsl(var(--bg-main))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 10, padding: 3, gap: 2
              }}>
                {[
                  { id: '14d', label: '14 Dias' },
                  { id: 'semana', label: 'Dia da Semana' },
                  { id: 'top', label: 'Top Alcance (%)' }
                ].map(tab => {
                  const active = chartMode === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setChartMode(tab.id as any)}
                      style={{
                        border: 'none',
                        background: active ? 'hsl(var(--bg-surface))' : 'transparent',
                        color: active ? '#6366f1' : 'hsl(var(--text-muted))',
                        fontWeight: active ? 800 : 600,
                        fontSize: 11.5,
                        padding: '5px 10px',
                        borderRadius: 7,
                        cursor: 'pointer',
                        boxShadow: active ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                        transition: 'all 0.15s'
                      }}
                    >
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {(comunicados || []).length === 0 ? (
              <div style={{
                height: 240, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))'
              }}>
                <Send size={32} style={{ opacity: 0.2, marginBottom: 10 }} />
                <p style={{ fontSize: 13, margin: 0 }}>Envie comunicados para visualizar as curvas de engajamento.</p>
              </div>
            ) : (
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  {chartMode === 'top' ? (
                    <BarChart data={chartDataTop} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border-subtle))" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--text-muted))' }} />
                      <YAxis domain={[0, 100]} unit="%" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--text-muted))' }} />
                      <Tooltip
                        formatter={(val: any, name: any) => [`${val}%`, name]}
                        contentStyle={{
                          background: 'hsl(var(--bg-surface))',
                          border: '1px solid hsl(var(--border-subtle))',
                          borderRadius: 10,
                          fontSize: 12
                        }}
                      />
                      <Bar dataKey="taxaLeitura" name="Taxa de Leitura" radius={[6, 6, 0, 0]} maxBarSize={38}>
                        {chartDataTop.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.taxaLeitura >= 60 ? '#10b981' : entry.taxaLeitura >= 30 ? '#6366f1' : '#f59e0b'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  ) : (
                    <AreaChart
                      data={chartMode === '14d' ? chartData14d : chartDataSemana}
                      margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="dashGradLeituras" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.32} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="dashGradEnvios" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.32} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border-subtle))" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--text-muted))' }} dy={8} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--text-muted))' }} />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--bg-surface))',
                          border: '1px solid hsl(var(--border-subtle))',
                          borderRadius: 10,
                          fontSize: 12,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="leituras"
                        name="Famílias que Leram"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#dashGradLeituras)"
                      />
                      <Area
                        type="monotone"
                        dataKey="envios"
                        name="Comunicados Enviados"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#dashGradEnvios)"
                      />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}

            {/* Rodapé de Legenda do Gráfico */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, marginTop: 14, paddingTop: 14, borderTop: '1px solid hsl(var(--border-subtle))'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: '#10b981' }} />
                  Leituras ({commMetrics.totalLeituras})
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: '#6366f1' }} />
                  Comunicados ({commMetrics.totalEnviados})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowEngajamentoModal(true)}
                style={{
                  border: 'none', background: 'transparent', color: '#6366f1',
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 4
                }}
              >
                Abrir relatório detalhado <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Card: Central de Comunicados Recentes (Com Busca, Filtros e Inspeção Rápida) */}
          <div ref={commSectionRef} className="ad-surface-card ad-comm-list-container">
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              justifyContent: 'space-between', gap: 12, marginBottom: 14
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: 'rgba(99, 102, 241, 0.1)', color: '#6366f1',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Bell size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0 }}>
                    Comunicados Recentes
                  </h3>
                  <p style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', margin: 0 }}>
                    Clique em qualquer comunicado para inspecionar conteúdo, destinatários e adesão.
                  </p>
                </div>
              </div>

              <Link href="/agenda-digital/admin/comunicados" style={{ textDecoration: 'none' }}>
                <button
                  type="button"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 9,
                    background: 'hsl(var(--bg-main))',
                    border: '1px solid hsl(var(--border-subtle))',
                    color: 'hsl(var(--text-main))', fontSize: 12, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Gerenciar todos <ArrowRight size={13} />
                </button>
              </Link>
            </div>

            {/* Barra de Filtros + Busca de Comunicados */}
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center',
              justifyContent: 'space-between', gap: 10, marginBottom: 14
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { id: 'todos', label: 'Enviados' },
                  { id: 'urgentes', label: 'Urgentes / Alta' },
                  { id: 'ciencia', label: `Exigem Ciência (${commMetrics.exigemCienciaCount})` },
                  { id: 'agendados', label: `Agendados / Rascunhos (${commMetrics.scheduledCount})` }
                ].map(f => {
                  const active = commFilter === f.id
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setCommFilter(f.id as any)}
                      style={{
                        border: active ? '1px solid rgba(99, 102, 241, 0.35)' : '1px solid hsl(var(--border-subtle))',
                        background: active ? 'rgba(99, 102, 241, 0.1)' : 'hsl(var(--bg-main))',
                        color: active ? '#6366f1' : 'hsl(var(--text-muted))',
                        fontSize: 11.5, fontWeight: active ? 800 : 600,
                        padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {f.label}
                    </button>
                  )
                })}
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'hsl(var(--bg-main))',
                border: '1px solid hsl(var(--border-subtle))',
                borderRadius: 9, padding: '5px 10px', minWidth: 190
              }}>
                <Search size={13} color="hsl(var(--text-muted))" />
                <input
                  type="text"
                  value={commSearch}
                  onChange={e => setCommSearch(e.target.value)}
                  placeholder="Filtrar por título ou autor..."
                  style={{
                    border: 'none', background: 'transparent', outline: 'none',
                    fontSize: 12, color: 'hsl(var(--text-main))', width: '100%'
                  }}
                />
                {commSearch && (
                  <button
                    type="button"
                    onClick={() => setCommSearch('')}
                    style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', color: 'hsl(var(--text-muted))', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Lista de Comunicados */}
            {filteredRecentComms.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                <Send size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
                <p style={{ fontSize: 13, margin: 0 }}>Nenhum comunicado encontrado para este filtro.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredRecentComms.map((c: ADComunicado) => {
                  const leituras = Object.keys(c.leituras || {}).length
                  const ciencias = Object.keys(c.ciencias || {}).length
                  const denom = getTargetDestinatariosCount(c)
                  const pctL = denom > 0 ? Math.min(100, Math.round((leituras / denom) * 100)) : 0
                  const pctC = denom > 0 ? Math.min(100, Math.round((ciencias / denom) * 100)) : 0
                  const prioColor =
                    c.prioridade === 'urgente' ? '#ef4444' : c.prioridade === 'alta' ? '#f59e0b' : '#10b981'
                  const rawDate = c.dataEnvio || (c as any).data || (c as any).created_at
                  const turmasLabel =
                    Array.isArray(c.turmas) && c.turmas.length > 0
                      ? c.turmas.slice(0, 2).join(', ') + (c.turmas.length > 2 ? ` +${c.turmas.length - 2}` : '')
                      : 'Toda a escola'

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedComunicado(c)}
                      className="ad-comm-row"
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0, flex: 1 }}>
                        <div
                          title={`Prioridade: ${c.prioridade || 'normal'}`}
                          style={{
                            width: 10, height: 10, borderRadius: '50%',
                            background: prioColor, marginTop: 5, flexShrink: 0,
                            boxShadow: `0 0 0 3px ${prioColor}22`
                          }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {c.fixado && <Pin size={12} color="#6366f1" />}
                            <span style={{
                              fontWeight: 700, fontSize: 13.5, color: 'hsl(var(--text-main))',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%'
                            }}>
                              {c.titulo}
                            </span>
                            <span style={{
                              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                              padding: '2px 6px', borderRadius: 5,
                              background: 'hsl(var(--bg-main))', color: 'hsl(var(--text-muted))',
                              border: '1px solid hsl(var(--border-subtle))'
                            }}>
                              {c.tipo || 'texto'}
                            </span>
                          </div>

                          <div style={{
                            fontSize: 11.5, color: 'hsl(var(--text-muted))', marginTop: 4,
                            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'
                          }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Clock size={11} /> {formatShortDate(rawDate)}
                            </span>
                            <span>•</span>
                            <span style={{ fontWeight: 600 }}>{c.autor || 'Direção'}</span>
                            <span>•</span>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: 3,
                              color: '#6366f1', fontWeight: 600
                            }}>
                              <Users size={11} /> {turmasLabel} ({denom})
                            </span>
                            {c.exigeCiencia && (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                                color: '#0891b2', fontWeight: 700
                              }}>
                                <CheckCircle2 size={11} /> {ciencias}/{denom} ciências ({pctC}%)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Barra de Progresso de Leitura */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: pctL >= 60 ? '#10b981' : pctL >= 30 ? '#f59e0b' : '#ef4444' }}>
                            {pctL}% lido
                          </div>
                          <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))' }}>
                            {leituras} de {denom}
                          </div>
                        </div>
                        <div style={{ width: 68, height: 6, borderRadius: 99, background: 'hsl(var(--border-subtle))', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${pctL}%`,
                            background: pctL >= 60 ? '#10b981' : pctL >= 30 ? '#f59e0b' : '#ef4444',
                            borderRadius: 99,
                            transition: 'width 0.3s ease'
                          }} />
                        </div>
                        <ChevronRight size={15} color="hsl(var(--text-muted))" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: PAINEL OPERACIONAL AO VIVO (SEM BURACOS VAZIOS!) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          {/* Widget 1: Financeiro & Cobranças da Agenda */}
          <div className="ad-surface-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: financeMetrics.totalVencido > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  color: financeMetrics.totalVencido > 0 ? '#ef4444' : '#10b981',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <DollarSign size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: 14.5, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0 }}>
                    Cobranças & Financeiro
                  </h3>
                  <p style={{ fontSize: 11, color: 'hsl(var(--text-muted))', margin: 0 }}>
                    {loadingCharges ? 'Sincronizando...' : `${financeMetrics.totalCobrancasCount} registros monitorados`}
                  </p>
                </div>
              </div>
              <Link href="/agenda-digital/admin/cobrancas" style={{ textDecoration: 'none' }}>
                <button
                  type="button"
                  style={{
                    border: '1px solid hsl(var(--border-subtle))',
                    background: 'hsl(var(--bg-main))',
                    color: 'hsl(var(--text-main))',
                    fontSize: 11.5, fontWeight: 700,
                    padding: '5px 10px', borderRadius: 8, cursor: 'pointer'
                  }}
                >
                  Ver carteira
                </button>
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div style={{
                padding: '10px 12px', borderRadius: 12,
                background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))'
              }}>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Em Aberto / Vencido</div>
                <div style={{
                  fontSize: 17, fontWeight: 900, fontFamily: 'Outfit, sans-serif',
                  color: financeMetrics.totalEmAberto > 0 ? '#ef4444' : '#10b981', marginTop: 2
                }}>
                  {formatBRL(financeMetrics.totalEmAberto)}
                </div>
                <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                  {financeMetrics.inadimplentesCount} aluno(s) pendente(s)
                </div>
              </div>

              <div style={{
                padding: '10px 12px', borderRadius: 12,
                background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))'
              }}>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Recebido / Quitado</div>
                <div style={{
                  fontSize: 17, fontWeight: 900, fontFamily: 'Outfit, sans-serif',
                  color: '#10b981', marginTop: 2
                }}>
                  {formatBRL(financeMetrics.totalRecebido)}
                </div>
                <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))', marginTop: 2 }}>
                  {financeMetrics.pctRecebido}% de adimplência
                </div>
              </div>
            </div>

            <div style={{ width: '100%', height: 6, borderRadius: 99, background: 'hsl(var(--border-subtle))', overflow: 'hidden' }}>
              <div style={{
                width: `${financeMetrics.pctRecebido}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #10b981, #059669)',
                borderRadius: 99
              }} />
            </div>
          </div>

          {/* Widget 2: Agenda Escolar & Aniversariantes (Tabbed Card) */}
          <div className="ad-surface-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
              <div style={{
                display: 'inline-flex', background: 'hsl(var(--bg-main))',
                border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, padding: 3, gap: 2
              }}>
                <button
                  type="button"
                  onClick={() => setRightAgendaTab('eventos')}
                  style={{
                    border: 'none',
                    background: rightAgendaTab === 'eventos' ? 'hsl(var(--bg-surface))' : 'transparent',
                    color: rightAgendaTab === 'eventos' ? '#10b981' : 'hsl(var(--text-muted))',
                    fontWeight: rightAgendaTab === 'eventos' ? 800 : 600,
                    fontSize: 12, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5
                  }}
                >
                  <Calendar size={13} /> Eventos ({proximosEventos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRightAgendaTab('nivers')}
                  style={{
                    border: 'none',
                    background: rightAgendaTab === 'nivers' ? 'hsl(var(--bg-surface))' : 'transparent',
                    color: rightAgendaTab === 'nivers' ? '#f59e0b' : 'hsl(var(--text-muted))',
                    fontWeight: rightAgendaTab === 'nivers' ? 800 : 600,
                    fontSize: 12, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5
                  }}
                >
                  <Cake size={13} /> Aniversários ({niversMesList.length})
                </button>
              </div>

              <Link href="/agenda-digital/admin/calendario" style={{ textDecoration: 'none' }}>
                <button
                  type="button"
                  style={{
                    border: 'none', background: 'transparent', color: '#6366f1',
                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 3
                  }}
                >
                  Calendário <ArrowRight size={12} />
                </button>
              </Link>
            </div>

            {rightAgendaTab === 'eventos' ? (
              proximosEventos.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                  <Calendar size={26} style={{ opacity: 0.25, marginBottom: 6 }} />
                  <p style={{ fontSize: 12.5, margin: '0 0 10px' }}>Nenhum evento futuro agendado no calendário.</p>
                  <Link href="/agenda-digital/admin/calendario" style={{ textDecoration: 'none' }}>
                    <button
                      type="button"
                      style={{
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        background: 'rgba(16, 185, 129, 0.08)',
                        color: '#059669', fontSize: 12, fontWeight: 700,
                        padding: '6px 12px', borderRadius: 8, cursor: 'pointer'
                      }}
                    >
                      + Agendar Evento
                    </button>
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {proximosEventos.map(ev => {
                    const dParts = (ev.data || '').split('-')
                    const diaNum = dParts[2] || '—'
                    const mesIdx = parseInt(dParts[1] || '1', 10) - 1
                    return (
                      <div
                        key={ev.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 11,
                          background: 'hsl(var(--bg-main))',
                          border: '1px solid hsl(var(--border-subtle))'
                        }}
                      >
                        <div style={{
                          width: 38, height: 38, borderRadius: 9,
                          background: `${ev.cor || '#6366f1'}18`,
                          color: ev.cor || '#6366f1',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center', flexShrink: 0, lineHeight: 1.05
                        }}>
                          <span style={{ fontSize: 13, fontWeight: 900 }}>{diaNum}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' }}>
                            {MESES_CURTOS[mesIdx] || ''}
                          </span>
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{
                            fontWeight: 700, fontSize: 12.5, color: 'hsl(var(--text-main))',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                          }}>
                            {ev.titulo}
                          </div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 1 }}>
                            {ev.horaInicio ? `${ev.horaInicio}` : 'Dia todo'} • {ev.tipo || 'evento'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                    {niversScope === 'semana' ? 'Próximos 7 dias' : `Mês de ${MESES_NOMES[nowDate.getMonth()]}`}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      onClick={() => setNiversScope('semana')}
                      style={{
                        border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700,
                        background: niversScope === 'semana' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                        color: niversScope === 'semana' ? '#d97706' : 'hsl(var(--text-muted))', cursor: 'pointer'
                      }}
                    >
                      7 dias ({niversSemanaList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNiversScope('mes')}
                      style={{
                        border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700,
                        background: niversScope === 'mes' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                        color: niversScope === 'mes' ? '#d97706' : 'hsl(var(--text-muted))', cursor: 'pointer'
                      }}
                    >
                      Mês ({niversMesList.length})
                    </button>
                  </div>
                </div>

                {loadingNivers ? (
                  <div style={{ padding: '20px 0', textAlign: 'center', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                    Carregando aniversariantes...
                  </div>
                ) : (niversScope === 'semana' ? niversSemanaList : niversMesList).length === 0 ? (
                  <div style={{ padding: '18px 0', textAlign: 'center', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                    Nenhum aniversariante encontrado para este período.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 220, overflowY: 'auto' }}>
                    {(niversScope === 'semana' ? niversSemanaList : niversMesList).slice(0, 6).map(item => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: 10, padding: '7px 10px', borderRadius: 10,
                          background: item.isHoje ? 'rgba(245, 158, 11, 0.1)' : 'hsl(var(--bg-main))',
                          border: item.isHoje ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid hsl(var(--border-subtle))'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                          <div style={{
                            width: 30, height: 30, borderRadius: 8,
                            background: 'rgba(245, 158, 11, 0.14)', color: '#d97706',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, flexShrink: 0
                          }}>
                            🎂
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontWeight: 700, fontSize: 12.5, color: 'hsl(var(--text-main))',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                              {item.nome}
                            </div>
                            <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))' }}>
                              {item.turmaOuCargo}
                            </div>
                          </div>
                        </div>
                        <span style={{
                          fontSize: 11, fontWeight: 800,
                          padding: '3px 7px', borderRadius: 6,
                          background: item.isHoje ? '#f59e0b' : 'hsl(var(--bg-surface))',
                          color: item.isHoje ? '#fff' : 'hsl(var(--text-main))',
                          flexShrink: 0
                        }}>
                          {item.isHoje ? 'Hoje! 🎉' : `${String(item.dia).padStart(2, '0')}/${String(item.mes).padStart(2, '0')}`}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Widget 3: Galeria de Momentos & Ocorrências (7d) */}
          <div className="ad-surface-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
              <div style={{
                display: 'inline-flex', background: 'hsl(var(--bg-main))',
                border: '1px solid hsl(var(--border-subtle))', borderRadius: 10, padding: 3, gap: 2
              }}>
                <button
                  type="button"
                  onClick={() => setRightFeedTab('momentos')}
                  style={{
                    border: 'none',
                    background: rightFeedTab === 'momentos' ? 'hsl(var(--bg-surface))' : 'transparent',
                    color: rightFeedTab === 'momentos' ? '#ec4899' : 'hsl(var(--text-muted))',
                    fontWeight: rightFeedTab === 'momentos' ? 800 : 600,
                    fontSize: 12, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5
                  }}
                >
                  <ImageIcon size={13} /> Momentos ({(momentosFeed || []).length})
                </button>
                <button
                  type="button"
                  onClick={() => setRightFeedTab('ocorrencias')}
                  style={{
                    border: 'none',
                    background: rightFeedTab === 'ocorrencias' ? 'hsl(var(--bg-surface))' : 'transparent',
                    color: rightFeedTab === 'ocorrencias' ? '#ef4444' : 'hsl(var(--text-muted))',
                    fontWeight: rightFeedTab === 'ocorrencias' ? 800 : 600,
                    fontSize: 12, padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5
                  }}
                >
                  <AlertCircle size={13} /> Ocorrências ({ocorrenciasRecentes.length})
                </button>
              </div>

              {rightFeedTab === 'momentos' ? (
                <Link href="/agenda-digital/admin/momentos" style={{ textDecoration: 'none' }}>
                  <button
                    type="button"
                    style={{
                      border: 'none', background: 'transparent', color: '#6366f1',
                      fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 3
                    }}
                  >
                    Ver galeria <ArrowRight size={12} />
                  </button>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowOcorrenciasModal(true)}
                  style={{
                    border: 'none', background: 'transparent', color: '#6366f1',
                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 3
                  }}
                >
                  Expandir <ArrowRight size={12} />
                </button>
              )}
            </div>

            {rightFeedTab === 'momentos' ? (
              momentosRecentesList.length === 0 ? (
                <div style={{ padding: '20px 12px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                  <ImageIcon size={26} style={{ opacity: 0.25, marginBottom: 6 }} />
                  <p style={{ fontSize: 12.5, margin: 0 }}>Nenhum momento publicado recentemente.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {momentosRecentesList.map((m: ADMomento) => {
                    const firstMedia = Array.isArray(m.media) && m.media.length > 0 ? m.media[0] : null
                    const thumbUrl = firstMedia?.thumbnail_url || firstMedia?.thumbnail || firstMedia?.url || ''
                    const isPending = m.status === 'pending'

                    return (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          gap: 10, padding: '8px 10px', borderRadius: 11,
                          background: 'hsl(var(--bg-main))',
                          border: isPending ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid hsl(var(--border-subtle))'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt="Momento"
                              loading="lazy"
                              style={{
                                width: 40, height: 40, borderRadius: 8,
                                objectFit: 'cover', aspectRatio: '1 / 1', flexShrink: 0,
                                background: 'hsl(var(--border-subtle))'
                              }}
                            />
                          ) : (
                            <div style={{
                              width: 40, height: 40, borderRadius: 8, aspectRatio: '1 / 1',
                              background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                              <ImageIcon size={17} />
                            </div>
                          )}
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{
                              fontWeight: 700, fontSize: 12.5, color: 'hsl(var(--text-main))',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                              {m.desc || 'Momento escolar'}
                            </div>
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                              <span>{m.author || 'Equipe'}</span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Heart size={10} /> {(m.likes || []).length}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isPending ? (
                          <button
                            type="button"
                            disabled={approvingMomentoId === m.id}
                            onClick={() => handleQuickApproveMomento(m)}
                            style={{
                              border: 'none', borderRadius: 8, padding: '5px 10px',
                              background: '#10b981', color: '#fff', fontSize: 11, fontWeight: 700,
                              cursor: 'pointer', flexShrink: 0
                            }}
                          >
                            {approvingMomentoId === m.id ? '...' : 'Aprovar'}
                          </button>
                        ) : (
                          <span style={{
                            fontSize: 10.5, fontWeight: 700, padding: '3px 7px', borderRadius: 6,
                            background: 'rgba(16, 185, 129, 0.1)', color: '#059669', flexShrink: 0
                          }}>
                            Publicado
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            ) : ocorrenciasRecentes.length === 0 ? (
              <div style={{ padding: '20px 12px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                <CheckCircle size={26} style={{ opacity: 0.25, marginBottom: 6 }} />
                <p style={{ fontSize: 12.5, margin: 0 }}>Nenhuma ocorrência registrada nos últimos 7 dias.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {ocorrenciasRecentes.slice(0, 4).map((o: any, idx: number) => {
                  const grav = String(o.gravidade || 'leve').toLowerCase()
                  const gravColor = grav === 'grave' ? '#ef4444' : grav === 'media' ? '#f59e0b' : '#3b82f6'
                  return (
                    <div
                      key={o.id || idx}
                      onClick={() => setShowOcorrenciasModal(true)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 10, padding: '8px 10px', borderRadius: 10,
                        background: 'hsl(var(--bg-main))',
                        border: '1px solid hsl(var(--border-subtle))',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontWeight: 700, fontSize: 12.5, color: 'hsl(var(--text-main))',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {o.alunoNome || o.aluno_nome || 'Aluno'}
                        </div>
                        <div style={{
                          fontSize: 11, color: 'hsl(var(--text-muted))',
                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                        }}>
                          {o.turma ? `${o.turma} • ` : ''}{o.tipo || o.descricao || 'Registro pedagógico'}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                        padding: '2px 7px', borderRadius: 6,
                        background: `${gravColor}18`, color: gravColor, flexShrink: 0
                      }}>
                        {grav}
                      </span>
                    </div>
                  )
                })}
                {ocorrenciasRecentes.length > 4 && (
                  <button
                    type="button"
                    onClick={() => setShowOcorrenciasModal(true)}
                    style={{
                      border: '1px dashed hsl(var(--border-subtle))',
                      background: 'transparent', borderRadius: 9, padding: '7px',
                      fontSize: 11.5, fontWeight: 700, color: '#6366f1', cursor: 'pointer', marginTop: 2
                    }}
                  >
                    Ver todas as {ocorrenciasRecentes.length} ocorrências da semana
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL 1: RELATÓRIO DE ENGAJAMENTO 30 DIAS ──────────────────────── */}
      <DashboardEngajamento
        isOpen={showEngajamentoModal}
        onClose={() => setShowEngajamentoModal(false)}
        comunicados={comunicados}
        alunosAtivos={alunosAtivos}
      />

      {/* ── MODAL 2: INSPEÇÃO RÁPIDA DE COMUNICADO ─────────────────────────── */}
      <dialog
        ref={comunicadoDialogRef}
        className="ad-admin-modal-dialog"
        aria-labelledby="ad-modal-comunicado-title"
        {...({ closedby: 'any' } as any)}
        onClose={() => setSelectedComunicado(null)}
        onClick={handleDialogLightDismissFallback}
        style={{ maxWidth: 620 }}
      >
        {selectedComunicado && (
          <>
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid hsl(var(--border-subtle))',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              flexShrink: 0
            }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: 999,
                    background: 'rgba(99, 102, 241, 0.12)', color: '#6366f1'
                  }}>
                    {selectedComunicado.tipo || 'Comunicado'}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))' }}>
                    {formatShortDate(selectedComunicado.dataEnvio || (selectedComunicado as any).created_at)}
                  </span>
                </div>
                <h3 id="ad-modal-comunicado-title" style={{ fontSize: 17, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0 }}>
                  {selectedComunicado.titulo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedComunicado(null)}
                style={{
                  width: 34, height: 34, borderRadius: 10, border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-main))', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '18px 22px', overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {(() => {
                const denom = getTargetDestinatariosCount(selectedComunicado)
                const leituras = Object.keys(selectedComunicado.leituras || {}).length
                const ciencias = Object.keys(selectedComunicado.ciencias || {}).length
                const pctL = denom > 0 ? Math.min(100, Math.round((leituras / denom) * 100)) : 0
                const pctC = denom > 0 ? Math.min(100, Math.round((ciencias / denom) * 100)) : 0

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                    <div style={{ padding: 12, borderRadius: 12, background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Público-Alvo</div>
                      <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>{denom} famílias</div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 12, background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Leituras</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#ec4899', marginTop: 2 }}>
                        {leituras} ({pctL}%)
                      </div>
                    </div>
                    <div style={{ padding: 12, borderRadius: 12, background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))' }}>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>Ciências</div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#06b6d4', marginTop: 2 }}>
                        {selectedComunicado.exigeCiencia ? `${ciencias} (${pctC}%)` : 'Não exigida'}
                      </div>
                    </div>
                  </div>
                )
              })()}

              <div style={{
                padding: 16, borderRadius: 14,
                background: 'hsl(var(--bg-main))',
                border: '1px solid hsl(var(--border-subtle))',
                fontSize: 13.5, lineHeight: 1.6, color: 'hsl(var(--text-main))',
                whiteSpace: 'pre-wrap'
              }}>
                {selectedComunicado.conteudo || 'Sem conteúdo textual adicional.'}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                <span><strong>Autor:</strong> {selectedComunicado.autor || 'Equipe Escolar'} ({selectedComunicado.autorCargo || 'Admin'})</span>
                <span>•</span>
                <span>
                  <strong>Destinatários:</strong>{' '}
                  {Array.isArray(selectedComunicado.turmas) && selectedComunicado.turmas.length > 0
                    ? selectedComunicado.turmas.join(', ')
                    : 'Toda a Instituição'}
                </span>
              </div>
            </div>

            <div style={{
              padding: '14px 22px', borderTop: '1px solid hsl(var(--border-subtle))',
              display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0
            }}>
              <button
                type="button"
                onClick={() => setSelectedComunicado(null)}
                style={{
                  padding: '8px 14px', borderRadius: 10,
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-main))', color: 'hsl(var(--text-main))',
                  fontSize: 12.5, fontWeight: 700, cursor: 'pointer'
                }}
              >
                Fechar
              </button>
              <Link href="/agenda-digital/admin/comunicados" style={{ textDecoration: 'none' }}>
                <button
                  type="button"
                  style={{
                    padding: '8px 16px', borderRadius: 10, border: 'none',
                    background: '#6366f1', color: '#fff',
                    fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6
                  }}
                >
                  Abrir em Comunicados <ExternalLink size={13} />
                </button>
              </Link>
            </div>
          </>
        )}
      </dialog>

      {/* ── MODAL 3: INSPEÇÃO DE OCORRÊNCIAS DOS ÚLTIMOS 7 DIAS ────────────── */}
      <dialog
        ref={ocorrenciasDialogRef}
        className="ad-admin-modal-dialog"
        aria-labelledby="ad-modal-ocorrencias-title"
        {...({ closedby: 'any' } as any)}
        onClose={() => setShowOcorrenciasModal(false)}
        onClick={handleDialogLightDismissFallback}
        style={{ maxWidth: 680 }}
      >
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid hsl(var(--border-subtle))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          flexShrink: 0
        }}>
          <div>
            <h3 id="ad-modal-ocorrencias-title" style={{ fontSize: 17, fontWeight: 800, fontFamily: 'Outfit, sans-serif', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertCircle size={18} color="#ef4444" />
              Ocorrências dos Últimos 7 Dias ({ocorrenciasRecentes.length})
            </h3>
            <p style={{ fontSize: 12, color: 'hsl(var(--text-muted))', margin: '2px 0 0' }}>
              Registros disciplinares e pedagógicos lançados na última semana.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowOcorrenciasModal(false)}
            style={{
              width: 34, height: 34, borderRadius: 10, border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-main))', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))'
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{
          padding: '12px 22px', borderBottom: '1px solid hsl(var(--border-subtle))',
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['todas', 'grave', 'media', 'leve'] as const).map(g => (
              <button
                key={g}
                type="button"
                onClick={() => setOcorrenciaGravidade(g)}
                style={{
                  border: ocorrenciaGravidade === g ? '1px solid #6366f1' : '1px solid hsl(var(--border-subtle))',
                  background: ocorrenciaGravidade === g ? 'rgba(99, 102, 241, 0.1)' : 'hsl(var(--bg-main))',
                  color: ocorrenciaGravidade === g ? '#6366f1' : 'hsl(var(--text-muted))',
                  fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 999,
                  textTransform: 'capitalize', cursor: 'pointer'
                }}
              >
                {g}
              </button>
            ))}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))',
            borderRadius: 9, padding: '5px 10px', minWidth: 200
          }}>
            <Search size={13} color="hsl(var(--text-muted))" />
            <input
              type="text"
              value={ocorrenciaSearch}
              onChange={e => setOcorrenciaSearch(e.target.value)}
              placeholder="Buscar aluno ou turma..."
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 12, color: 'hsl(var(--text-main))', width: '100%' }}
            />
          </div>
        </div>

        <div style={{ padding: '14px 22px', overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredOcorrenciasModal.length === 0 ? (
            <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 13, color: 'hsl(var(--text-muted))' }}>
              Nenhuma ocorrência encontrada para este filtro.
            </div>
          ) : (
            filteredOcorrenciasModal.map((o: any, idx: number) => {
              const grav = String(o.gravidade || 'leve').toLowerCase()
              const gravColor = grav === 'grave' ? '#ef4444' : grav === 'media' ? '#f59e0b' : '#3b82f6'
              return (
                <div
                  key={o.id || idx}
                  style={{
                    padding: '12px 14px', borderRadius: 12,
                    background: 'hsl(var(--bg-main))',
                    border: '1px solid hsl(var(--border-subtle))',
                    display: 'flex', flexDirection: 'column', gap: 6
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontWeight: 800, fontSize: 13.5, color: 'hsl(var(--text-main))' }}>
                        {o.alunoNome || o.aluno_nome || 'Aluno'}
                      </span>
                      {o.turma && (
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
                          background: 'hsl(var(--bg-surface))', color: 'hsl(var(--text-muted))'
                        }}>
                          {o.turma}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                        {formatShortDate(o.data || o.created_at || o.createdAt)}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                        padding: '2px 7px', borderRadius: 6,
                        background: `${gravColor}18`, color: gravColor
                      }}>
                        {grav}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'hsl(var(--text-main))', lineHeight: 1.45 }}>
                    {o.descricao || o.tipo || 'Sem descrição detalhada.'}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </dialog>
    </div>
  )
}
