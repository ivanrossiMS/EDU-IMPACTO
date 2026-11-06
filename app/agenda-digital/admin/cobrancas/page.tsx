'use client'

import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import {
  Search,
  BadgeDollarSign,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  X,
  FileSpreadsheet,
  RefreshCw,
  Calendar,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Wallet,
  Plus,
  Edit3,
  Trash2,
  Users
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/api/apiClient'
import {
  NovaCobrancaModal,
  EditarCobrancaModal,
  ErpMensalidadesView
} from './components/CobrancasModalsAndErp'
import { CobrancaDetailsModal } from './components/CobrancaDetailsModal'

function formatBRL(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function formatPercent(numerator: number, denominator: number): { num: number; label: string } {
  if (!denominator || denominator <= 0 || numerator <= 0) {
    return { num: 0, label: '0%' }
  }
  const raw = (numerator / denominator) * 100
  if (raw >= 100) return { num: 100, label: '100%' }
  if (raw < 1) {
    return {
      num: Math.max(2, raw),
      label: `${raw.toFixed(1).replace('.', ',')}%`
    }
  }
  const rounded1 = Math.round(raw * 10) / 10
  const isInt = Math.abs(rounded1 - Math.round(rounded1)) < 0.05
  return {
    num: rounded1,
    label: isInt ? `${Math.round(rounded1)}%` : `${rounded1.toFixed(1).replace('.', ',')}%`
  }
}

function isVencidaDate(vencimento?: string | null): boolean {
  if (!vencimento) return false
  const str = String(vencimento).trim()
  const vDate = new Date(str.includes('T') ? str : `${str}T23:59:59`)
  if (isNaN(vDate.getTime())) return false
  return vDate < new Date()
}

function normalizeId(raw: any): string {
  return String(raw || '')
    .replace(/^(a_|_ALU|ALU)/i, '')
    .trim()
}

export default function ADAdminCobrancas() {
  const [titulos] = useSupabaseArray<any>('titulos')
  const [turmasDb] = useSupabaseArray<any>('turmas')
  const [activeTab, setActiveTab] = useState<'app' | 'erp'>('app')

  const [cobrancasRows, setCobrancasRows] = useState<any[]>([])
  const [appCharges, setAppCharges] = useState<any[]>([])
  const [comunicadosMap, setComunicadosMap] = useState<Record<string, any>>({})
  const [alunosDirectory, setAlunosDirectory] = useState<Record<string, any>>({})
  const [turmasList, setTurmasList] = useState<string[]>([])
  const [turmasMapApi, setTurmasMapApi] = useState<Record<string, string>>({})
  const [activeAlunosList, setActiveAlunosList] = useState<Array<{ id: string; nome: string; turma: string; matricula: string }>>([])

  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [showNovaModal, setShowNovaModal] = useState(false)
  const [editingGroup, setEditingGroup] = useState<any | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<any | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const [generatingLinkIds, setGeneratingLinkIds] = useState<Record<string, boolean>>({})
  const [togglingStatusIds, setTogglingStatusIds] = useState<Record<string, boolean>>({})
  const [syncingGroupId, setSyncingGroupId] = useState<string | null>(null)
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)

  // Filtros e paginação da tabela principal
  const [mainFilterStatus, setMainFilterStatus] = useState<'ALL' | 'PENDING' | 'PAID' | 'OVERDUE'>('ALL')
  const [mainFilterTurma, setMainFilterTurma] = useState<string>('ALL')
  const [mainSearchTerm, setMainSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'total_desc' | 'open_desc' | 'paid_desc' | 'title_asc'>('recent')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)

  const fetchChargesData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const res = await apiFetch('/api/cobrancas')
      if (res.ok) {
        const data = await res.json()
        setCobrancasRows(data.cobrancas || [])
        setAppCharges(data.destinatarios || [])
        setComunicadosMap(data.comunicadosMap || {})
        setAlunosDirectory(data.alunosDirectory || {})
        setTurmasList(data.turmasList || [])
        setTurmasMapApi(data.turmasMap || {})
        setActiveAlunosList(data.activeAlunosList || [])
        if (silent) toast.success('Dados de cobranças sincronizados!')
      } else {
        // Fallback direto via Supabase caso necessário
        const [{ data: cobs }, { data: dests }] = await Promise.all([
          supabase.from('agenda_cobrancas').select('*').order('created_at', { ascending: false }),
          supabase.from('agenda_cobrancas_destinatarios').select('*').order('created_at', { ascending: false }).range(0, 4999)
        ])
        if (cobs) setCobrancasRows(cobs)
        if (dests) setAppCharges(dests)
      }
    } catch (e) {
      console.error('Erro ao buscar cobranças:', e)
      if (silent) toast.error('Não foi possível atualizar as cobranças.')
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchChargesData(false)
  }, [fetchChargesData])

  // Realtime subscription para atualizar pagamentos do Mercado Pago automaticamente
  useEffect(() => {
    const channel = supabase
      .channel('ad_admin_cobrancas_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agenda_cobrancas_destinatarios' },
        () => {
          fetchChargesData(true)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agenda_cobrancas' },
        () => {
          fetchChargesData(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchChargesData])

  // Bloquear scroll do body quando modal estiver aberto
  useEffect(() => {
    const mainScroll = document.querySelector('.ad-main-scroll') as HTMLElement
    if (selectedGroupId || showNovaModal || editingGroup || deletingGroup) {
      document.body.style.overflow = 'hidden'
      if (mainScroll) mainScroll.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
      if (mainScroll) mainScroll.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = 'unset'
      if (mainScroll) mainScroll.style.overflow = ''
    }
  }, [selectedGroupId, showNovaModal, editingGroup, deletingGroup])

  const resolveTurmaName = useCallback(
    (rawTurma: any): string => {
      const str = String(rawTurma || '').trim()
      if (!str || str === '--') return '--'
      const fromApi =
        turmasMapApi[str] ||
        turmasMapApi[str.toLowerCase()] ||
        turmasMapApi[str.replace(/^(t_|turma_|sync-)/i, '').trim()]
      if (fromApi) return fromApi

      if (Array.isArray(turmasDb) && turmasDb.length > 0) {
        const clean = str.replace(/^(t_|turma_|sync-)/i, '').trim()
        const found = turmasDb.find(
          (t: any) =>
            t &&
            (String(t.id).trim() === str ||
              String(t.id).trim() === clean ||
              String(t.codigo || '').trim() === str ||
              String(t.codigo || '').trim() === clean ||
              String(t.dados?.codigo || '').trim() === str ||
              String(t.nome || '').trim().toLowerCase() === str.toLowerCase())
        )
        if (found?.nome || found?.dados?.nome) {
          return String(found.nome || found.dados?.nome).trim()
        }
      }
      return str
    },
    [turmasMapApi, turmasDb]
  )

  const resolveStudentInfo = useCallback(
    (dest: any) => {
      const cleanId = normalizeId(dest?.destinatario_id || dest?.aluno_id)
      const byId = alunosDirectory[cleanId] || alunosDirectory[String(dest?.destinatario_id || '')]
      const rawName = String(dest?.destinatario_nome || '').trim()
      const byName = !byId && rawName ? alunosDirectory[rawName.toLowerCase()] : null
      const entry = byId || byName

      return {
        nome: rawName || entry?.nome || cleanId || 'Aluno',
        turma: resolveTurmaName(entry?.turma || dest?.turma || '--'),
        matricula: entry?.matricula || '',
        responsavel: entry?.responsavel || '',
        telefone: entry?.telefone || ''
      }
    },
    [alunosDirectory, resolveTurmaName]
  )

  // Agrupamento completo incluindo todas as agenda_cobrancas (mesmo com 0 destinatários) + todos os destinatários
  const groupedCharges = useMemo(() => {
    const acc: Record<string, any> = {}

    cobrancasRows.forEach(cob => {
      if (!cob?.id) return
      acc[cob.id] = {
        cobranca: cob,
        comunicadoInfo: cob.comunicado_id ? comunicadosMap[String(cob.comunicado_id)] || null : null,
        destinatarios: [],
        latestCreatedAt: cob.created_at || ''
      }
    })

    appCharges.forEach(curr => {
      const cId = curr.cobranca_id
      if (!cId) return
      if (!acc[cId]) {
        acc[cId] = {
          cobranca: curr.agenda_cobrancas || { id: cId, titulo: 'Sem Título', valor: 0 },
          comunicadoInfo: null,
          destinatarios: [],
          latestCreatedAt: curr.created_at || ''
        }
      }
      acc[cId].destinatarios.push(curr)
      if (curr.created_at && curr.created_at > acc[cId].latestCreatedAt) {
        acc[cId].latestCreatedAt = curr.created_at
      }
    })

    Object.keys(acc).forEach(k => {
      const grp = acc[k]
      const valorUnitario = Number(grp.cobranca?.valor || 0)
      const totalEnviados = grp.destinatarios.length
      const totalPagos = grp.destinatarios.filter(
        (d: any) => d.status === 'CONFIRMED' || d.status === 'RECEIVED'
      ).length
      const totalAguardando = Math.max(0, totalEnviados - totalPagos)

      const valorTotal = totalEnviados * valorUnitario
      const valorPago = totalPagos * valorUnitario
      const valorAberto = totalAguardando * valorUnitario
      const pct = formatPercent(totalPagos, totalEnviados)
      const isFullyPaid = totalEnviados > 0 && totalPagos === totalEnviados
      const isOverdue = !isFullyPaid && isVencidaDate(grp.cobranca?.vencimento)

      const turmasDaCobranca = new Set<string>()
      grp.destinatarios.forEach((d: any) => {
        const info = resolveStudentInfo(d)
        if (info.turma && info.turma !== '--') turmasDaCobranca.add(info.turma)
      })

      grp.turmasList = Array.from(turmasDaCobranca)
      grp.metrics = {
        valorUnitario,
        totalEnviados,
        totalPagos,
        totalAguardando,
        valorTotal,
        valorPago,
        valorAberto,
        percentualPago: pct.num,
        percentualPagoFormatted: pct.label,
        isFullyPaid,
        isOverdue
      }
    })

    return acc
  }, [cobrancasRows, appCharges, comunicadosMap, resolveStudentInfo])

  const groupedArray = useMemo(
    () => Object.keys(groupedCharges).map(k => ({ id: k, ...groupedCharges[k] })),
    [groupedCharges]
  )

  // Métricas Globais para os Cards KPI Superiores
  const globalKpis = useMemo(() => {
    const totalCobrancas = groupedArray.length
    let totalDestinatarios = 0
    let totalPagosCount = 0
    let totalPendentesCount = 0
    let volumeTotal = 0
    let volumePago = 0
    let volumePendente = 0
    let cobrancasQuitadas = 0
    let cobrancasComPendencia = 0
    let cobrancasVencidas = 0

    groupedArray.forEach(g => {
      const m = g.metrics
      totalDestinatarios += m.totalEnviados
      totalPagosCount += m.totalPagos
      totalPendentesCount += m.totalAguardando
      volumeTotal += m.valorTotal
      volumePago += m.valorPago
      volumePendente += m.valorAberto
      if (m.isFullyPaid) cobrancasQuitadas += 1
      if (m.totalAguardando > 0 || m.totalEnviados === 0) cobrancasComPendencia += 1
      if (m.isOverdue) cobrancasVencidas += 1
    })

    const eficiencia = formatPercent(volumePago, volumeTotal)

    return {
      totalCobrancas,
      totalDestinatarios,
      totalPagosCount,
      totalPendentesCount,
      volumeTotal,
      volumePago,
      volumePendente,
      cobrancasQuitadas,
      cobrancasComPendencia,
      cobrancasVencidas,
      taxaRecebimentoNum: eficiencia.num,
      taxaRecebimentoLabel: eficiencia.label
    }
  }, [groupedArray])

  // Filtragem e Ordenação da Tabela Principal
  const filteredGroupedArray = useMemo(() => {
    const filtered = groupedArray.filter(group => {
      const m = group.metrics

      if (mainFilterStatus === 'PAID' && !m.isFullyPaid) return false
      if (mainFilterStatus === 'PENDING' && m.totalAguardando === 0 && m.totalEnviados > 0) return false
      if (mainFilterStatus === 'OVERDUE' && !m.isOverdue) return false

      if (mainFilterTurma !== 'ALL') {
        const hasTurma =
          group.turmasList?.includes(mainFilterTurma) ||
          group.comunicadoInfo?.turmas?.includes(mainFilterTurma)
        if (!hasTurma) return false
      }

      if (mainSearchTerm.trim()) {
        const term = mainSearchTerm.toLowerCase().trim()
        const titulo = (group.cobranca?.titulo || '').toLowerCase()
        const comTitulo = (group.comunicadoInfo?.titulo || '').toLowerCase()
        const hasStudentMatch = (group.destinatarios || []).some((d: any) =>
          String(d.destinatario_nome || '').toLowerCase().includes(term)
        )
        if (!titulo.includes(term) && !comTitulo.includes(term) && !hasStudentMatch) return false
      }

      return true
    })

    return [...filtered].sort((a, b) => {
      if (sortBy === 'total_desc') return b.metrics.valorTotal - a.metrics.valorTotal
      if (sortBy === 'open_desc') return b.metrics.valorAberto - a.metrics.valorAberto
      if (sortBy === 'paid_desc') return b.metrics.valorPago - a.metrics.valorPago
      if (sortBy === 'title_asc') {
        return (a.cobranca?.titulo || '').localeCompare(b.cobranca?.titulo || '', 'pt-BR')
      }
      return (b.latestCreatedAt || '').localeCompare(a.latestCreatedAt || '')
    })
  }, [groupedArray, mainFilterStatus, mainFilterTurma, mainSearchTerm, sortBy])

  useEffect(() => {
    setCurrentPage(1)
  }, [mainFilterStatus, mainFilterTurma, mainSearchTerm, sortBy, pageSize])

  const totalItems = filteredGroupedArray.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)
  const paginatedGroups = useMemo(
    () => filteredGroupedArray.slice(startIndex, endIndex),
    [filteredGroupedArray, startIndex, endIndex]
  )

  const filteredTotals = useMemo(() => {
    return filteredGroupedArray.reduce(
      (acc, g) => {
        acc.destinatarios += g.metrics.totalEnviados
        acc.pagos += g.metrics.totalPagos
        acc.valorTotal += g.metrics.valorTotal
        acc.valorPago += g.metrics.valorPago
        acc.valorAberto += g.metrics.valorAberto
        return acc
      },
      { destinatarios: 0, pagos: 0, valorTotal: 0, valorPago: 0, valorAberto: 0 }
    )
  }, [filteredGroupedArray])

  // Garante (ou gera sob demanda) a URL de pagamento do destinatário
  const ensurePaymentLink = async (dest: any): Promise<string | null> => {
    if (!dest?.id || !dest?.cobranca_id) return null
    if (dest.url_pagamento) return String(dest.url_pagamento)

    setGeneratingLinkIds(prev => ({ ...prev, [dest.id]: true }))
    try {
      const res = await apiFetch('/api/cobrancas/mercadopago-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cobranca_destinatario_id: dest.id,
          cobranca_id: dest.cobranca_id,
          destinatario_id: dest.destinatario_id,
          from_admin: true
        })
      })
      const data = await res.json()
      if (!res.ok || data.error || !data.invoiceUrl) {
        toast.error(data.error || 'Não foi possível gerar o link de pagamento.')
        return null
      }

      const invoiceUrl = String(data.invoiceUrl)
      setAppCharges(prev =>
        prev.map(item => (item.id === dest.id ? { ...item, url_pagamento: invoiceUrl } : item))
      )
      return invoiceUrl
    } catch (err) {
      console.error('Erro ao obter link de pagamento:', err)
      toast.error('Falha de conexão ao gerar link de pagamento.')
      return null
    } finally {
      setGeneratingLinkIds(prev => ({ ...prev, [dest.id]: false }))
    }
  }

  const handleOpenPaymentLink = async (dest: any) => {
    if (!dest) return
    if (dest.url_pagamento) {
      window.open(dest.url_pagamento, '_blank', 'noopener,noreferrer')
      return
    }

    const isPaid = dest.status === 'CONFIRMED' || dest.status === 'RECEIVED'
    if (isPaid) {
      toast.info('Esta cobrança já está quitada.')
      return
    }

    const popup = window.open('about:blank', '_blank')
    const url = await ensurePaymentLink(dest)
    if (url) {
      if (popup) {
        popup.location.href = url
      } else {
        window.open(url, '_blank', 'noopener,noreferrer')
      }
      toast.success('Link de pagamento aberto em nova guia!')
    } else if (popup) {
      popup.close()
    }
  }

  const handleCopyPaymentLink = async (dest: any) => {
    if (!dest) return
    const url = dest.url_pagamento ? String(dest.url_pagamento) : await ensurePaymentLink(dest)
    if (!url) return

    try {
      await navigator.clipboard.writeText(url)
      setCopiedLinkId(dest.id)
      toast.success('Link de pagamento copiado!')
      setTimeout(() => {
        setCopiedLinkId(prev => (prev === dest.id ? null : prev))
      }, 2200)
    } catch {
      toast.error('Não foi possível copiar o link automaticamente.')
    }
  }

  const handleWhatsAppReminder = async (dest: any, cobranca: any) => {
    if (!dest) return
    const info = resolveStudentInfo(dest)
    const url = dest.url_pagamento ? String(dest.url_pagamento) : await ensurePaymentLink(dest)
    if (!url) return

    const vencFmt = cobranca?.vencimento
      ? new Date(cobranca.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
      : '--'
    const valorFmt = formatBRL(Number(cobranca?.valor || 0))
    const msg = `Olá${info.responsavel ? `, *${info.responsavel}*` : ''}! Tudo bem?\n\nSegue o link para pagamento da cobrança escolar referente ao(à) aluno(a) *${info.nome}*:\n\n📌 *Motivo:* ${cobranca?.titulo || 'Cobrança Escolar'}\n💰 *Valor:* R$ ${valorFmt}\n📅 *Vencimento:* ${vencFmt}\n\n🔗 *Link seguro (Pix ou Cartão):*\n${url}`

    const digits = (info.telefone || '').replace(/\D/g, '')
    const phoneParam = digits.length >= 10 ? (digits.startsWith('55') ? digits : `55${digits}`) : ''
    const waUrl = phoneParam
      ? `https://wa.me/${phoneParam}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`

    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  const handleToggleManualPaid = async (dest: any) => {
    if (!dest?.id) return
    setTogglingStatusIds(prev => ({ ...prev, [dest.id]: true }))
    try {
      const isPaid = dest.status === 'CONFIRMED' || dest.status === 'RECEIVED'
      const novoStatus = isPaid ? 'PENDING' : 'RECEIVED'
      const res = await apiFetch('/api/cobrancas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_destinatario_status',
          destinatario_row_id: dest.id,
          novo_status: novoStatus
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || 'Erro ao alterar status do pagamento.')
        return
      }
      setAppCharges(prev =>
        prev.map(item => (item.id === dest.id ? { ...item, ...data.destinatario } : item))
      )
      toast.success(
        novoStatus === 'RECEIVED'
          ? 'Baixa manual confirmada com sucesso!'
          : 'Cobrança reaberta como Aguardando Pagamento.'
      )
    } catch (err: any) {
      toast.error(err.message || 'Falha ao atualizar status.')
    } finally {
      setTogglingStatusIds(prev => ({ ...prev, [dest.id]: false }))
    }
  }

  const handleSyncRecipients = async (cobrancaId: string) => {
    setSyncingGroupId(cobrancaId)
    try {
      const res = await apiFetch('/api/cobrancas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_destinatarios',
          cobranca_id: cobrancaId
        })
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || 'Erro ao sincronizar destinatários.')
        return
      }
      if (data.addedCount > 0) {
        toast.success(`${data.addedCount} destinatário(s) vinculado(s) com sucesso!`)
        await fetchChargesData(true)
      } else {
        toast.info('Todos os alunos destinatários já estão sincronizados.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Falha ao sincronizar destinatários.')
    } finally {
      setSyncingGroupId(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deletingGroup?.id) return
    setIsDeleting(true)
    try {
      const res = await apiFetch(`/api/cobrancas?id=${encodeURIComponent(deletingGroup.id)}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error || 'Erro ao excluir cobrança.')
        return
      }
      toast.success('Cobrança excluída com sucesso!')
      setCobrancasRows(prev => prev.filter(c => c.id !== deletingGroup.id))
      setAppCharges(prev => prev.filter(d => d.cobranca_id !== deletingGroup.id))
      if (selectedGroupId === deletingGroup.id) setSelectedGroupId(null)
      setDeletingGroup(null)
    } catch (err: any) {
      toast.error(err.message || 'Falha ao excluir cobrança.')
    } finally {
      setIsDeleting(false)
    }
  }

  // Exportar Detalhes de uma Cobrança específica em XLSX
  const handleExportModalXlsx = (groupId: string, respectFilter = false, customList?: any[]) => {
    const selectedGroup = groupedCharges[groupId]
    if (!selectedGroup) return

    const cobrancaObj = selectedGroup.cobranca || { titulo: 'Cobrança', valor: 0 }
    const valorUnitario = Number(cobrancaObj.valor || 0)
    const vencimentoStr = cobrancaObj.vencimento
      ? new Date(cobrancaObj.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
      : '--'

    const allDestinatarios = selectedGroup.destinatarios || []
    const targetList = respectFilter && customList ? customList : allDestinatarios

    if (targetList.length === 0) {
      toast.error('Nenhum destinatário encontrado para exportar.')
      return
    }

    const rows = targetList.map((d: any) => {
      const isPaid = d.status === 'CONFIRMED' || d.status === 'RECEIVED'
      const info = resolveStudentInfo(d)
      const enviadoEm = d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '--'
      const dataPgto =
        isPaid && (d.updated_at || d.created_at)
          ? new Date(d.updated_at || d.created_at).toLocaleDateString('pt-BR')
          : '--'
      const statusLabel = isPaid ? 'Pago' : d.status === 'PENDING' ? 'Aguardando' : d.status || 'Pendente'

      return {
        'Cobrança / Motivo': cobrancaObj.titulo || 'Sem Título',
        'Destinatário (Aluno)': info.nome,
        Turma: info.turma,
        Responsável: info.responsavel || '--',
        'Pagador / Confirmação': d.pagador_usuario_nome || '--',
        'Valor Unitário (R$)': valorUnitario,
        'Valor Pago (R$)': isPaid ? valorUnitario : 0,
        'Valor em Aberto (R$)': isPaid ? 0 : valorUnitario,
        'Enviado em': enviadoEm,
        Vencimento: vencimentoStr,
        'Data Pgto.': dataPgto,
        'Status do Pagamento': statusLabel,
        'Link de Pagamento': d.url_pagamento || '--'
      }
    })

    const totalDest = allDestinatarios.length
    const totalPagos = allDestinatarios.filter(
      (d: any) => d.status === 'CONFIRMED' || d.status === 'RECEIVED'
    ).length
    const totalAguardando = totalDest - totalPagos

    const resumoRows = [
      { Indicador: 'Título da Cobrança', Valor: cobrancaObj.titulo || 'Sem Título' },
      { Indicador: 'Vencimento', Valor: vencimentoStr },
      { Indicador: 'Valor Unitário (R$)', Valor: valorUnitario },
      { Indicador: 'Total de Destinatários', Valor: totalDest },
      { Indicador: 'Total Pagos', Valor: totalPagos },
      { Indicador: 'Total Aguardando', Valor: totalAguardando },
      { Indicador: 'Valor Total (R$)', Valor: totalDest * valorUnitario },
      { Indicador: 'Valor Pago (R$)', Valor: totalPagos * valorUnitario },
      { Indicador: 'Valor em Aberto (R$)', Valor: totalAguardando * valorUnitario },
      { Indicador: 'Exportado em', Valor: new Date().toLocaleString('pt-BR') }
    ]

    const wb = XLSX.utils.book_new()
    const wsDest = XLSX.utils.json_to_sheet(rows)
    wsDest['!cols'] = [
      { wch: 28 },
      { wch: 32 },
      { wch: 20 },
      { wch: 24 },
      { wch: 22 },
      { wch: 16 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 36 }
    ]
    XLSX.utils.book_append_sheet(wb, wsDest, 'Destinatários')

    const wsResumo = XLSX.utils.json_to_sheet(resumoRows)
    wsResumo['!cols'] = [{ wch: 30 }, { wch: 32 }]
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo')

    const safeTitle = (cobrancaObj.titulo || 'cobranca')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40)
    const dateStr = new Date().toISOString().slice(0, 10)

    XLSX.writeFile(wb, `Cobranca_${safeTitle}_${dateStr}.xlsx`)
    toast.success('Planilha Excel (.xlsx) da cobrança exportada com sucesso!')
  }

  // Exportar Relatório Consolidado de todas as Cobranças Rápidas em XLSX
  const handleExportAllXlsx = () => {
    if (filteredGroupedArray.length === 0) {
      toast.error('Nenhuma cobrança disponível para exportar.')
      return
    }

    const resumoCobrancas = filteredGroupedArray.map(group => {
      const cob = group.cobranca || { titulo: 'Sem Título', valor: 0 }
      const m = group.metrics
      const venc = cob.vencimento
        ? new Date(cob.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
        : '--'

      return {
        'Motivo (Comunicado)': cob.titulo || 'Sem Título',
        Vencimento: venc,
        'Destinatários (Famílias)': m.totalEnviados,
        'Valor Unitário (R$)': m.valorUnitario,
        'Valor Total (R$)': m.valorTotal,
        'Valor Pago (R$)': m.valorPago,
        'Valor em Aberto (R$)': m.valorAberto,
        'Qtd. Pagos': m.totalPagos,
        'Qtd. Aguardando': m.totalAguardando,
        'Progresso (%)': m.percentualPagoFormatted
      }
    })

    const todosDestinatarios: any[] = []
    filteredGroupedArray.forEach(group => {
      const cob = group.cobranca || { titulo: 'Sem Título', valor: 0 }
      const valUnit = Number(cob.valor || 0)
      const venc = cob.vencimento
        ? new Date(cob.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
        : '--'

      ;(group.destinatarios || []).forEach((d: any) => {
        const isPaid = d.status === 'CONFIRMED' || d.status === 'RECEIVED'
        const info = resolveStudentInfo(d)
        todosDestinatarios.push({
          'Cobrança / Motivo': cob.titulo || 'Sem Título',
          'Destinatário (Aluno)': info.nome,
          Turma: info.turma,
          Responsável: info.responsavel || '--',
          'Pagador / Confirmação': d.pagador_usuario_nome || '--',
          'Valor Unitário (R$)': valUnit,
          'Valor Pago (R$)': isPaid ? valUnit : 0,
          'Valor em Aberto (R$)': isPaid ? 0 : valUnit,
          'Enviado em': d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '--',
          Vencimento: venc,
          'Data Pgto.':
            isPaid && (d.updated_at || d.created_at)
              ? new Date(d.updated_at || d.created_at).toLocaleDateString('pt-BR')
              : '--',
          'Status do Pagamento': isPaid ? 'Pago' : d.status === 'PENDING' ? 'Aguardando' : d.status || 'Pendente',
          'Link de Pagamento': d.url_pagamento || '--'
        })
      })
    })

    const wb = XLSX.utils.book_new()
    const wsResumo = XLSX.utils.json_to_sheet(resumoCobrancas)
    wsResumo['!cols'] = [
      { wch: 32 },
      { wch: 14 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 16 },
      { wch: 14 }
    ]
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Cobranças')

    if (todosDestinatarios.length > 0) {
      const wsDet = XLSX.utils.json_to_sheet(todosDestinatarios)
      wsDet['!cols'] = [
        { wch: 28 },
        { wch: 34 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
        { wch: 18 },
        { wch: 16 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 }
      ]
      XLSX.utils.book_append_sheet(wb, wsDet, 'Destinatários Detalhado')
    }

    const dateStr = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `Relatorio_Cobrancas_Agenda_${dateStr}.xlsx`)
    toast.success('Relatório consolidado exportado em Excel (.xlsx)!')
  }

  const pageNumbers = useMemo(() => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, safeCurrentPage - 2)
    const end = Math.min(totalPages, start + maxVisible - 1)
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1)
    }
    for (let i = start; i <= end; i++) pages.push(i)
    return pages
  }, [safeCurrentPage, totalPages])

  return (
    <div
      className="ad-admin-page-container ad-mobile-optimized"
      style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', position: 'relative', gap: 20, paddingBottom: 32 }}
    >
      <style dangerouslySetInnerHTML={{__html: `
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .ad-cobrancas-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }
        .ad-cobrancas-kpi-card {
          position: relative;
          border-radius: 18px;
          padding: 20px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          box-shadow: 0 4px 16px rgba(15, 23, 42, 0.03);
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 12px;
          overflow: hidden;
        }
        .ad-cobrancas-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.07);
        }
        .ad-table-region {
          overflow-x: hidden;
          width: 100%;
          max-inline-size: 100%;
          container-type: inline-size;
          content-visibility: auto;
          contain-intrinsic-size: auto 300px auto 600px;
        }
        @supports not (content-visibility: auto) {
          .ad-table-region {
            contain: layout style paint;
          }
        }
        .ad-cobrancas-desktop-table {
          width: 100%;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
        }
        .ad-cobrancas-desktop-table thead {
          position: sticky;
          inset-block-start: 0;
          z-index: 2;
        }
        .ad-cobrancas-desktop-table tbody th[scope="row"] {
          background: inherit;
        }
        .ad-cobrancas-desktop-table tbody tr {
          background: #ffffff;
          transition: background 0.15s ease;
        }
        .ad-cobrancas-desktop-table tbody tr:hover {
          background: #f8fafc;
        }
        .ad-cobrancas-mobile-cards {
          display: none;
        }
        @media (max-width: 1180px) {
          .ad-cobrancas-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (max-width: 960px) {
          .ad-table-region {
            display: none !important;
          }
          .ad-cobrancas-mobile-cards {
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
            padding: 14px !important;
          }
        }
        @media (max-width: 768px) {
          .ad-cobrancas-top-header {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 16px !important;
            gap: 14px !important;
          }
          .ad-cobrancas-top-actions {
            width: 100% !important;
            display: flex !important;
            flex-wrap: wrap !important;
          }
          .ad-cobrancas-top-actions button {
            flex: 1 !important;
            justify-content: center !important;
            min-height: 44px !important;
          }
          .ad-cobrancas-kpi-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 10px !important;
          }
          .ad-cobrancas-kpi-card {
            padding: 14px !important;
            border-radius: 14px !important;
          }
          .ad-cobrancas-kpi-card .kpi-val {
            font-size: 18px !important;
          }
          .ad-cobrancas-toolbar {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 14px 16px !important;
            gap: 12px !important;
          }
          .ad-cobrancas-controls {
            flex-direction: column !important;
            align-items: stretch !important;
            width: 100% !important;
          }
          .ad-cobrancas-controls .search-box {
            width: 100% !important;
          }
          .ad-table-region {
            display: none !important;
          }
          .ad-cobrancas-mobile-cards {
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
            padding: 14px !important;
          }
          .ad-pagination-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            padding: 14px 16px !important;
          }
          .ad-pagination-controls {
            justify-content: center !important;
            flex-wrap: wrap !important;
          }
          .ad-modal-kpi-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .ad-modal-header {
            padding: 18px 16px !important;
          }
          .ad-modal-toolbar {
            padding: 12px 16px !important;
          }
          .ad-modal-body {
            padding: 0 14px 16px !important;
          }
        }
        @media (max-width: 440px) {
          .ad-cobrancas-kpi-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}} />

      {/* ══════════════════════════════════════════════════════════════════════════
          TOP HEADER BAR
      ══════════════════════════════════════════════════════════════════════════ */}
      <div
        className="ad-cobrancas-top-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          padding: '20px 26px',
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(12px)',
          borderRadius: 20,
          border: '1px solid rgba(226, 232, 240, 0.95)',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.04)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 6px 16px rgba(79, 70, 229, 0.25)'
            }}
          >
            <BadgeDollarSign size={24} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  fontFamily: 'Outfit, sans-serif',
                  margin: 0,
                  color: '#0f172a',
                  letterSpacing: '-0.02em'
                }}
              >
                Cobranças Rápidas & Arrecadações
              </h2>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: 20,
                  background: '#eef2ff',
                  color: '#4338ca',
                  border: '1px solid #c7d2fe'
                }}
              >
                {globalKpis.totalCobrancas} campanhas
              </span>
            </div>
            <p style={{ color: '#64748b', fontSize: 13.5, margin: '2px 0 0 0' }}>
              Gerencie cobranças via Mercado Pago (Pix e Cartão), dê baixa manual, envie lembretes via WhatsApp e exporte relatórios.
            </p>
          </div>
        </div>

        <div className="ad-cobrancas-top-actions" style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => fetchChargesData(true)}
            disabled={isRefreshing || loading}
            style={{
              padding: '10px 14px',
              borderRadius: 12,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: 13,
              fontWeight: 700,
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7
            }}
            title="Sincronizar pagamentos agora"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>

          <button
            type="button"
            onClick={handleExportAllXlsx}
            style={{
              padding: '10px 16px',
              borderRadius: 12,
              border: '1px solid #10b981',
              background: '#ecfdf5',
              color: '#047857',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7
            }}
          >
            <FileSpreadsheet size={16} /> Exportar Excel (.xlsx)
          </button>

          <button
            type="button"
            onClick={() => setShowNovaModal(true)}
            style={{
              padding: '10px 18px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
              color: '#ffffff',
              fontSize: 13.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)'
            }}
          >
            <Plus size={17} /> Nova Cobrança
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          INTERACTIVE KPI CARDS (CLICÁVEIS PARA FILTRAR)
      ══════════════════════════════════════════════════════════════════════════ */}
      <div className="ad-cobrancas-kpi-grid">
        {/* Card 1: Valor Total Emitido */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('app')
            setMainFilterStatus('ALL')
          }}
          className="ad-cobrancas-kpi-card"
          style={{
            borderColor: mainFilterStatus === 'ALL' ? '#3b82f6' : '#e2e8f0',
            background:
              mainFilterStatus === 'ALL'
                ? 'linear-gradient(180deg, rgba(239, 246, 255, 0.7) 0%, #ffffff 100%)'
                : '#ffffff'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, width: '100%' }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#2563eb' }}>
                Valor Total Emitido
              </div>
              <div className="kpi-val" style={{ fontSize: 23, fontWeight: 900, color: '#0f172a', marginTop: 4, fontFamily: 'Outfit, sans-serif' }}>
                R$ {formatBRL(globalKpis.volumeTotal)}
              </div>
            </div>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Wallet size={20} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              <strong>{globalKpis.totalCobrancas}</strong> cobranças • <strong>{globalKpis.totalDestinatarios}</strong> envios
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 10,
                background: mainFilterStatus === 'ALL' ? '#2563eb' : '#f1f5f9',
                color: mainFilterStatus === 'ALL' ? '#ffffff' : '#64748b'
              }}
            >
              {mainFilterStatus === 'ALL' ? 'Filtro Ativo' : 'Ver Todas'}
            </span>
          </div>
        </button>

        {/* Card 2: Valor Pago (Recebido In-App) */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('app')
            setMainFilterStatus(mainFilterStatus === 'PAID' ? 'ALL' : 'PAID')
          }}
          className="ad-cobrancas-kpi-card"
          style={{
            borderColor: mainFilterStatus === 'PAID' ? '#10b981' : '#e2e8f0',
            background:
              mainFilterStatus === 'PAID'
                ? 'linear-gradient(180deg, rgba(236, 253, 245, 0.8) 0%, #ffffff 100%)'
                : '#ffffff'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, width: '100%' }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#059669' }}>
                Valor Pago (Recebido)
              </div>
              <div className="kpi-val" style={{ fontSize: 23, fontWeight: 900, color: '#059669', marginTop: 4, fontFamily: 'Outfit, sans-serif' }}>
                R$ {formatBRL(globalKpis.volumePago)}
              </div>
            </div>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: '#ecfdf5',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <CheckCircle2 size={20} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              <strong>{globalKpis.totalPagosCount}</strong> pagamentos • <strong>{globalKpis.cobrancasQuitadas}</strong> quitadas
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 10,
                background: mainFilterStatus === 'PAID' ? '#10b981' : '#dcfce7',
                color: mainFilterStatus === 'PAID' ? '#ffffff' : '#15803d'
              }}
            >
              {mainFilterStatus === 'PAID' ? 'Filtrando' : 'Filtrar Pagas'}
            </span>
          </div>
        </button>

        {/* Card 3: Valor em Aberto */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('app')
            setMainFilterStatus(mainFilterStatus === 'PENDING' ? 'ALL' : 'PENDING')
          }}
          className="ad-cobrancas-kpi-card"
          style={{
            borderColor: mainFilterStatus === 'PENDING' ? '#ef4444' : '#e2e8f0',
            background:
              mainFilterStatus === 'PENDING'
                ? 'linear-gradient(180deg, rgba(254, 242, 242, 0.8) 0%, #ffffff 100%)'
                : '#ffffff'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, width: '100%' }}>
            <div>
              <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#dc2626' }}>
                Valor em Aberto
              </div>
              <div className="kpi-val" style={{ fontSize: 23, fontWeight: 900, color: '#dc2626', marginTop: 4, fontFamily: 'Outfit, sans-serif' }}>
                R$ {formatBRL(globalKpis.volumePendente)}
              </div>
            </div>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: '#fef2f2',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <AlertCircle size={20} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              <strong>{globalKpis.totalPendentesCount}</strong> aguardando pgto.
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 10,
                background: mainFilterStatus === 'PENDING' ? '#ef4444' : '#fee2e2',
                color: mainFilterStatus === 'PENDING' ? '#ffffff' : '#b91c1c'
              }}
            >
              {mainFilterStatus === 'PENDING' ? 'Filtrando' : 'Ver Pendentes'}
            </span>
          </div>
        </button>

        {/* Card 4: Eficiência de Arrecadação */}
        <button
          type="button"
          onClick={() => {
            setActiveTab('app')
            setMainFilterStatus(mainFilterStatus === 'OVERDUE' ? 'ALL' : 'OVERDUE')
          }}
          className="ad-cobrancas-kpi-card"
          style={{
            borderColor: mainFilterStatus === 'OVERDUE' ? '#f59e0b' : '#e2e8f0',
            background:
              mainFilterStatus === 'OVERDUE'
                ? 'linear-gradient(180deg, rgba(255, 251, 235, 0.85) 0%, #ffffff 100%)'
                : '#ffffff'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, width: '100%' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#7c3aed' }}>
                Eficiência de Arrecadação
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
                <span className="kpi-val" style={{ fontSize: 23, fontWeight: 900, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                  {globalKpis.taxaRecebimentoLabel}
                </span>
                <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>quitado</span>
              </div>
              <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginTop: 6 }}>
                <div
                  style={{
                    width: `${Math.min(100, globalKpis.taxaRecebimentoNum)}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #4f46e5, #10b981)',
                    borderRadius: 99
                  }}
                />
              </div>
            </div>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: '#f5f3ff',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <TrendingUp size={20} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              <strong>{globalKpis.cobrancasVencidas}</strong> com vencimento expirado
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 10,
                background: mainFilterStatus === 'OVERDUE' ? '#f59e0b' : '#fef3c7',
                color: mainFilterStatus === 'OVERDUE' ? '#ffffff' : '#b45309'
              }}
            >
              {mainFilterStatus === 'OVERDUE' ? 'Filtrando' : 'Ver Vencidas'}
            </span>
          </div>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          MAIN TABLE CARD
      ══════════════════════════════════════════════════════════════════════════ */}
      <div
        className="card"
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 20,
          border: '1px solid #e2e8f0',
          background: '#ffffff',
          boxShadow: '0 8px 30px rgba(15, 23, 42, 0.04)'
        }}
      >
        {/* Toolbar */}
        <div
          className="ad-cobrancas-toolbar"
          style={{
            padding: '14px 22px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)'
          }}
        >
          {/* Abas */}
          <div className="ad-cobrancas-tabs" style={{ display: 'flex', gap: 8, background: '#f1f5f9', padding: 4, borderRadius: 12 }}>
            <button
              type="button"
              onClick={() => setActiveTab('app')}
              style={{
                background: activeTab === 'app' ? '#ffffff' : 'transparent',
                border: 'none',
                fontWeight: 800,
                fontSize: 13,
                padding: '8px 14px',
                borderRadius: 9,
                color: activeTab === 'app' ? '#4f46e5' : '#64748b',
                cursor: 'pointer',
                boxShadow: activeTab === 'app' ? '0 2px 6px rgba(15, 23, 42, 0.06)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              Cobranças Digitais (App)
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 7px',
                  borderRadius: 10,
                  background: activeTab === 'app' ? '#eef2ff' : '#e2e8f0',
                  color: activeTab === 'app' ? '#4f46e5' : '#475569'
                }}
              >
                {groupedArray.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('erp')}
              style={{
                background: activeTab === 'erp' ? '#ffffff' : 'transparent',
                border: 'none',
                fontWeight: 800,
                fontSize: 13,
                padding: '8px 14px',
                borderRadius: 9,
                color: activeTab === 'erp' ? '#4f46e5' : '#64748b',
                cursor: 'pointer',
                boxShadow: activeTab === 'erp' ? '0 2px 6px rgba(15, 23, 42, 0.06)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease'
              }}
            >
              Mensalidades (ERP)
              <span
                style={{
                  fontSize: 11,
                  padding: '1px 7px',
                  borderRadius: 10,
                  background: activeTab === 'erp' ? '#eef2ff' : '#e2e8f0',
                  color: activeTab === 'erp' ? '#4f46e5' : '#475569'
                }}
              >
                {titulos?.length || 0}
              </span>
            </button>
          </div>

          {/* Filtros, Busca, Ordenação e PageSize */}
          {activeTab === 'app' && (
            <div className="ad-cobrancas-controls" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="search-box" style={{ position: 'relative', width: 230 }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Buscar cobrança ou aluno..."
                  value={mainSearchTerm}
                  onChange={e => setMainSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 30px 8px 34px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    fontSize: 13,
                    color: '#0f172a',
                    background: '#ffffff',
                    boxSizing: 'border-box'
                  }}
                />
                {mainSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setMainSearchTerm('')}
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
                      display: 'flex'
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {turmasList.length > 0 && (
                <select
                  aria-label="Filtrar por turma"
                  value={mainFilterTurma}
                  onChange={e => setMainFilterTurma(e.target.value)}
                  style={{
                    width: 'auto',
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    fontSize: 13,
                    fontWeight: 700,
                    color: '#334155',
                    background: '#ffffff',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ALL">Turma: Todas</option>
                  {turmasList.map(t => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              )}

              <select
                aria-label="Filtrar por status da cobrança"
                value={mainFilterStatus}
                onChange={e => setMainFilterStatus(e.target.value as any)}
                style={{
                  width: 'auto',
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#334155',
                  background: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                <option value="ALL">Status: Todas ({groupedArray.length})</option>
                <option value="PENDING">Com Saldo em Aberto ({globalKpis.cobrancasComPendencia})</option>
                <option value="PAID">100% Quitadas ({globalKpis.cobrancasQuitadas})</option>
                <option value="OVERDUE">Vencidas com Pendência ({globalKpis.cobrancasVencidas})</option>
              </select>

              <select
                aria-label="Ordenar cobranças"
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                style={{
                  width: 'auto',
                  padding: '8px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  outline: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#334155',
                  background: '#ffffff',
                  cursor: 'pointer'
                }}
              >
                <option value="recent">Ordenar: Mais Recentes</option>
                <option value="open_desc">Maior Valor em Aberto</option>
                <option value="total_desc">Maior Valor Total</option>
                <option value="paid_desc">Maior Valor Pago</option>
                <option value="title_asc">Motivo (A–Z)</option>
              </select>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f1f5f9', padding: '4px 8px', borderRadius: 10 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#64748b' }}>Por pág:</span>
                {[10, 30, 50, 100].map(size => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setPageSize(size)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 7,
                      border: 'none',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      background: pageSize === size ? '#4f46e5' : 'transparent',
                      color: pageSize === size ? '#ffffff' : '#475569',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {activeTab === 'app' ? (
          <>
            {/* Desktop Table Region */}
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="ad-cobrancas-table-caption"
              className="ad-table-region"
            >
              <table className="table ad-cobrancas-desktop-table">
                <caption id="ad-cobrancas-table-caption" className="sr-only">
                  Tabela de cobranças rápidas e arrecadações da Agenda Digital
                </caption>
                <colgroup>
                  <col style={{ width: '23%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '11%' }} />
                  <col style={{ width: '17%' }} />
                </colgroup>
                <thead>
                  <tr
                    style={{
                      background: '#f8fafc',
                      borderBottom: '1.5px solid #e2e8f0',
                      textAlign: 'left'
                    }}
                  >
                    <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1.5px solid #e2e8f0' }}>
                      Motivo (Comunicado)
                    </th>
                    <th style={{ padding: '12px 6px', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center', borderBottom: '1.5px solid #e2e8f0' }}>
                      Envios
                    </th>
                    <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', borderBottom: '1.5px solid #e2e8f0' }}>
                      Unitário
                    </th>
                    <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', borderBottom: '1.5px solid #e2e8f0', background: 'rgba(239, 246, 255, 0.5)' }}>
                      Valor Total
                    </th>
                    <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', borderBottom: '1.5px solid #e2e8f0', background: 'rgba(236, 253, 245, 0.5)' }}>
                      Valor Pago
                    </th>
                    <th style={{ padding: '12px 8px', fontSize: 11, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', borderBottom: '1.5px solid #e2e8f0', background: 'rgba(254, 242, 242, 0.5)' }}>
                      Em Aberto
                    </th>
                    <th style={{ padding: '12px 10px', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1.5px solid #e2e8f0' }}>
                      Recebimentos
                    </th>
                    <th style={{ padding: '12px 14px', fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'right', borderBottom: '1.5px solid #e2e8f0' }}>
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#64748b', fontWeight: 600 }}>
                        Carregando cobranças e saldos...
                      </td>
                    </tr>
                  ) : paginatedGroups.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a', marginBottom: 4 }}>
                          Nenhuma cobrança encontrada
                        </div>
                        <div style={{ fontSize: 13 }}>Tente limpar os filtros ou clique em &quot;Nova Cobrança&quot; para emitir.</div>
                      </td>
                    </tr>
                  ) : (
                    paginatedGroups.map(group => {
                      const cobrancaObj = group.cobranca
                      const m = group.metrics
                      const vencFormatted = cobrancaObj.vencimento
                        ? new Date(cobrancaObj.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                        : '--'
                      const isSyncing = syncingGroupId === group.id

                      return (
                        <tr key={group.id}>
                          {/* Motivo */}
                          <th
                            scope="row"
                            style={{
                              padding: '13px 14px',
                              borderBottom: '1px solid #f1f5f9',
                              textAlign: 'left',
                              fontWeight: 700,
                              overflow: 'hidden'
                            }}
                          >
                            <div
                              style={{
                                fontWeight: 800,
                                fontSize: 13.5,
                                color: '#0f172a',
                                marginBottom: 3,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title={cobrancaObj.titulo || 'Sem Título'}
                            >
                              {cobrancaObj.titulo || 'Sem Título'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: '#64748b',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  maxWidth: 130,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                <CreditCard size={11} color="#3b82f6" style={{ flexShrink: 0 }} />
                                {group.comunicadoInfo?.titulo ? group.comunicadoInfo.titulo : 'Comunicado'}
                              </span>
                              <span style={{ color: '#cbd5e1' }}>•</span>
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  color: m.isOverdue ? '#dc2626' : '#64748b',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}
                              >
                                <Calendar size={11} /> {vencFormatted}
                              </span>
                              {m.isOverdue && (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    padding: '1px 6px',
                                    borderRadius: 6,
                                    background: '#fef2f2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca',
                                    textTransform: 'uppercase'
                                  }}
                                >
                                  Vencida
                                </span>
                              )}
                            </div>
                          </th>

                          {/* Destinatários */}
                          <td style={{ padding: '13px 6px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                            {m.totalEnviados === 0 ? (
                              <button
                                type="button"
                                disabled={isSyncing}
                                onClick={() => handleSyncRecipients(group.id)}
                                style={{
                                  padding: '4px 8px',
                                  borderRadius: 8,
                                  border: '1px solid #fde68a',
                                  background: '#fffbeb',
                                  color: '#b45309',
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}
                                title="Clique para sincronizar os alunos destinatários do comunicado"
                              >
                                <RefreshCw size={10} className={isSyncing ? 'animate-spin' : ''} />
                                Sync
                              </button>
                            ) : (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  padding: '3px 9px',
                                  borderRadius: 9,
                                  background: '#f8fafc',
                                  border: '1px solid #e2e8f0'
                                }}
                              >
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                                  {m.totalEnviados}
                                </span>
                                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>famílias</span>
                              </div>
                            )}
                          </td>

                          {/* Valor Unitário */}
                          <td
                            style={{
                              padding: '13px 8px',
                              textAlign: 'right',
                              fontWeight: 700,
                              fontSize: 12.5,
                              color: '#475569',
                              borderBottom: '1px solid #f1f5f9',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            R$ {formatBRL(m.valorUnitario)}
                          </td>

                          {/* Valor Total */}
                          <td
                            style={{
                              padding: '13px 8px',
                              textAlign: 'right',
                              fontWeight: 800,
                              fontSize: 13,
                              color: '#1e3a8a',
                              background: 'rgba(239, 246, 255, 0.25)',
                              borderBottom: '1px solid #f1f5f9',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            R$ {formatBRL(m.valorTotal)}
                          </td>

                          {/* Valor Pago */}
                          <td
                            style={{
                              padding: '13px 8px',
                              textAlign: 'right',
                              background: 'rgba(236, 253, 245, 0.25)',
                              borderBottom: '1px solid #f1f5f9',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-block',
                                fontWeight: 800,
                                fontSize: 12.5,
                                padding: '3px 8px',
                                borderRadius: 7,
                                background: m.valorPago > 0 ? '#dcfce7' : '#f1f5f9',
                                color: m.valorPago > 0 ? '#15803d' : '#64748b'
                              }}
                            >
                              R$ {formatBRL(m.valorPago)}
                            </span>
                          </td>

                          {/* Valor em Aberto */}
                          <td
                            style={{
                              padding: '13px 8px',
                              textAlign: 'right',
                              background: 'rgba(254, 242, 242, 0.25)',
                              borderBottom: '1px solid #f1f5f9',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            <span
                              style={{
                                display: 'inline-block',
                                fontWeight: 800,
                                fontSize: 12.5,
                                padding: '3px 8px',
                                borderRadius: 7,
                                background: m.valorAberto > 0 ? '#fee2e2' : '#f0fdf4',
                                color: m.valorAberto > 0 ? '#b91c1c' : '#15803d'
                              }}
                            >
                              R$ {formatBRL(m.valorAberto)}
                            </span>
                          </td>

                          {/* Recebimentos + Barra de Progresso */}
                          <td style={{ padding: '13px 10px', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, marginBottom: 5 }}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontSize: 12,
                                  color: m.isFullyPaid ? '#059669' : '#0f172a',
                                  whiteSpace: 'nowrap'
                                }}
                              >
                                {m.totalPagos}/{m.totalEnviados}
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: 8,
                                  whiteSpace: 'nowrap',
                                  background: m.isFullyPaid
                                    ? '#dcfce7'
                                    : m.totalPagos > 0
                                    ? '#eff6ff'
                                    : '#f1f5f9',
                                  color: m.isFullyPaid
                                    ? '#15803d'
                                    : m.totalPagos > 0
                                    ? '#1d4ed8'
                                    : '#64748b'
                                }}
                              >
                                {m.isFullyPaid ? '100%' : m.percentualPagoFormatted}
                              </span>
                            </div>
                            <div style={{ width: '100%', height: 5, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${Math.min(100, m.percentualPago)}%`,
                                  height: '100%',
                                  background: m.isFullyPaid ? '#10b981' : '#3b82f6',
                                  borderRadius: 99,
                                  transition: 'width 0.3s ease'
                                }}
                              />
                            </div>
                          </td>

                          {/* Ações */}
                          <td style={{ padding: '13px 12px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => setEditingGroup(group)}
                                title="Editar título, valor ou vencimento"
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 8,
                                  border: '1px solid #e2e8f0',
                                  background: '#f8fafc',
                                  color: '#475569',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              >
                                <Edit3 size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleExportModalXlsx(group.id, false)}
                                title="Exportar esta cobrança em Excel (.xlsx)"
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 8,
                                  border: '1px solid #bbf7d0',
                                  background: '#f0fdf4',
                                  color: '#059669',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              >
                                <FileSpreadsheet size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingGroup(group)}
                                title="Excluir cobrança"
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 8,
                                  border: '1px solid #fecaca',
                                  background: '#fef2f2',
                                  color: '#dc2626',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  flexShrink: 0
                                }}
                              >
                                <Trash2 size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedGroupId(group.id)}
                                style={{
                                  padding: '6px 10px',
                                  borderRadius: 8,
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#0f172a',
                                  fontSize: 11.5,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  flexShrink: 0
                                }}
                              >
                                <Eye size={13} color="#4f46e5" /> Detalhes
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>

                {!loading && paginatedGroups.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 800, fontSize: 12, color: '#334155' }}>
                        TOTAL ({filteredGroupedArray.length} cobranças)
                      </td>
                      <td style={{ padding: '12px 6px', textAlign: 'center', fontWeight: 800, fontSize: 12.5, color: '#0f172a' }}>
                        {filteredTotals.destinatarios}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#94a3b8', fontSize: 12 }}>—</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 900, fontSize: 13, color: '#1e3a8a', whiteSpace: 'nowrap' }}>
                        R$ {formatBRL(filteredTotals.valorTotal)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 900, fontSize: 13, color: '#15803d', whiteSpace: 'nowrap' }}>
                        R$ {formatBRL(filteredTotals.valorPago)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 900, fontSize: 13, color: '#b91c1c', whiteSpace: 'nowrap' }}>
                        R$ {formatBRL(filteredTotals.valorAberto)}
                      </td>
                      <td colSpan={2} style={{ padding: '12px 14px', textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: '#475569' }}>
                        {filteredTotals.pagos} de {filteredTotals.destinatarios} pagamentos recebidos
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="ad-cobrancas-mobile-cards">
              {loading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Carregando cobranças...</div>
              ) : paginatedGroups.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Nenhuma cobrança encontrada.</div>
              ) : (
                paginatedGroups.map(group => {
                  const cobrancaObj = group.cobranca
                  const m = group.metrics
                  const vencFormatted = cobrancaObj.vencimento
                    ? new Date(cobrancaObj.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                    : '--'

                  return (
                    <div
                      key={group.id}
                      style={{
                        background: '#ffffff',
                        borderRadius: 16,
                        border: '1.5px solid #e2e8f0',
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        boxShadow: '0 2px 10px rgba(15, 23, 42, 0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 15, color: '#0f172a' }}>
                            {cobrancaObj.titulo || 'Sem Título'}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                            <span>Unit: <strong>R$ {formatBRL(m.valorUnitario)}</strong></span>
                            <span>•</span>
                            <span>{m.totalEnviados} famílias</span>
                            <span>•</span>
                            <span>Venc: {vencFormatted}</span>
                          </div>
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '3px 9px',
                            borderRadius: 10,
                            background: m.isFullyPaid ? '#dcfce7' : '#eff6ff',
                            color: m.isFullyPaid ? '#15803d' : '#1d4ed8',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {m.totalPagos}/{m.totalEnviados} ({m.percentualPagoFormatted})
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        <div style={{ padding: '8px 10px', borderRadius: 10, background: '#eff6ff', border: '1px solid #dbeafe' }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Total</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a8a', marginTop: 2 }}>
                            R$ {formatBRL(m.valorTotal)}
                          </div>
                        </div>
                        <div style={{ padding: '8px 10px', borderRadius: 10, background: '#ecfdf5', border: '1px solid #d1fae5' }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Pago</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#065f46', marginTop: 2 }}>
                            R$ {formatBRL(m.valorPago)}
                          </div>
                        </div>
                        <div style={{ padding: '8px 10px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fee2e2' }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase' }}>Em Aberto</div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#991b1b', marginTop: 2 }}>
                            R$ {formatBRL(m.valorAberto)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6, borderTop: '1px solid #f1f5f9' }}>
                        <button
                          type="button"
                          onClick={() => setEditingGroup(group)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            color: '#334155',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Edit3 size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportModalXlsx(group.id, false)}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 10,
                            border: '1px solid #bbf7d0',
                            background: '#f0fdf4',
                            color: '#059669',
                            fontSize: 12,
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            cursor: 'pointer'
                          }}
                        >
                          <FileSpreadsheet size={14} /> XLSX
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedGroupId(group.id)}
                          style={{
                            flex: 1,
                            padding: '8px 14px',
                            borderRadius: 10,
                            border: 'none',
                            background: '#4f46e5',
                            color: '#ffffff',
                            fontSize: 12.5,
                            fontWeight: 800,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            cursor: 'pointer'
                          }}
                        >
                          <Eye size={14} /> Ver Detalhes
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* Paginação */}
            <div
              className="ad-pagination-bar"
              style={{
                padding: '16px 22px',
                borderTop: '1px solid #e2e8f0',
                background: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 16,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>
                  Exibindo <strong>{totalItems === 0 ? 0 : startIndex + 1}</strong> a <strong>{endIndex}</strong> de{' '}
                  <strong>{totalItems}</strong> cobranças
                </span>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <label htmlFor="ad-cobrancas-pagesize" style={{ fontSize: 12.5, color: '#64748b', fontWeight: 700 }}>
                    Itens por página:
                  </label>
                  <select
                    id="ad-cobrancas-pagesize"
                    value={pageSize}
                    onChange={e => setPageSize(Number(e.target.value))}
                    style={{
                      width: 'auto',
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontSize: 12.5,
                      fontWeight: 800,
                      color: '#0f172a',
                      cursor: 'pointer'
                    }}
                  >
                    <option value={10}>10 por página</option>
                    <option value={30}>30 por página</option>
                    <option value={50}>50 por página</option>
                    <option value={100}>100 por página</option>
                  </select>
                </div>
              </div>

              <div className="ad-pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={safeCurrentPage <= 1}
                  title="Primeira página"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#334155',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                    opacity: safeCurrentPage <= 1 ? 0.4 : 1
                  }}
                >
                  <ChevronsLeft size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={safeCurrentPage <= 1}
                  title="Página anterior"
                  style={{
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 9,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                    opacity: safeCurrentPage <= 1 ? 0.4 : 1
                  }}
                >
                  <ChevronLeft size={15} /> Anterior
                </button>

                {pageNumbers.map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setCurrentPage(num)}
                    style={{
                      minWidth: 34,
                      height: 34,
                      padding: '0 8px',
                      borderRadius: 9,
                      border: num === safeCurrentPage ? 'none' : '1px solid #e2e8f0',
                      background: num === safeCurrentPage ? '#4f46e5' : '#ffffff',
                      color: num === safeCurrentPage ? '#ffffff' : '#334155',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: num === safeCurrentPage ? '0 3px 10px rgba(79, 70, 229, 0.25)' : 'none'
                    }}
                  >
                    {num}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage >= totalPages}
                  title="Próxima página"
                  style={{
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 9,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: 12.5,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: safeCurrentPage >= totalPages ? 0.4 : 1
                  }}
                >
                  Próxima <ChevronRight size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={safeCurrentPage >= totalPages}
                  title="Última página"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#334155',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: safeCurrentPage >= totalPages ? 0.4 : 1
                  }}
                >
                  <ChevronsRight size={15} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <ErpMensalidadesView
            titulos={titulos || []}
            alunosDirectory={alunosDirectory}
            resolveTurmaName={resolveTurmaName}
          />
        )}
      </div>

      {/* Modal: Detalhes da Cobrança */}
      <CobrancaDetailsModal
        selectedGroup={selectedGroupId ? groupedCharges[selectedGroupId] : null}
        onClose={() => setSelectedGroupId(null)}
        onEditGroup={grp => setEditingGroup(grp)}
        onSyncRecipients={handleSyncRecipients}
        onToggleManualPaid={handleToggleManualPaid}
        onOpenPaymentLink={handleOpenPaymentLink}
        onCopyPaymentLink={handleCopyPaymentLink}
        onWhatsAppReminder={handleWhatsAppReminder}
        onExportModalXlsx={handleExportModalXlsx}
        generatingLinkIds={generatingLinkIds}
        togglingStatusIds={togglingStatusIds}
        copiedLinkId={copiedLinkId}
        syncingGroupId={syncingGroupId}
        resolveStudentInfo={resolveStudentInfo}
      />

      {/* Modal: Nova Cobrança */}
      <NovaCobrancaModal
        isOpen={showNovaModal}
        onClose={() => setShowNovaModal(false)}
        turmasList={turmasList}
        activeAlunosList={activeAlunosList}
        onCreateSuccess={() => fetchChargesData(true)}
        apiFetchFn={apiFetch}
      />

      {/* Modal: Editar Cobrança */}
      <EditarCobrancaModal
        group={editingGroup}
        onClose={() => setEditingGroup(null)}
        onSaved={() => fetchChargesData(true)}
        apiFetchFn={apiFetch}
      />

      {/* Modal: Confirmar Exclusão */}
      {typeof window !== 'undefined' &&
        deletingGroup &&
        createPortal(
          <div
            onClick={() => !isDeleting && setDeletingGroup(null)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(6px)',
              zIndex: 100001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 440,
                background: '#ffffff',
                borderRadius: 20,
                padding: 24,
                boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: '#fef2f2',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0f172a' }}>Excluir Cobrança?</h3>
                  <span style={{ fontSize: 12.5, color: '#64748b' }}>Esta ação removerá a cobrança e seus destinatários.</span>
                </div>
              </div>

              <div style={{ padding: 12, borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', marginBottom: 18 }}>
                <div><strong>Motivo:</strong> {deletingGroup.cobranca?.titulo}</div>
                <div><strong>Valor Unitário:</strong> R$ {formatBRL(deletingGroup.metrics?.valorUnitario || 0)}</div>
                <div><strong>Destinatários:</strong> {deletingGroup.metrics?.totalEnviados || 0} ({deletingGroup.metrics?.totalPagos || 0} pagos)</div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingGroup(null)}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: isDeleting ? 'wait' : 'pointer'
                  }}
                >
                  {isDeleting ? 'Excluindo...' : 'Sim, Excluir Cobrança'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
