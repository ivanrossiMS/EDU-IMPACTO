'use client'

import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import {
  Search,
  BadgeDollarSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  X,
  Printer,
  FileSpreadsheet,
  RefreshCw,
  Calendar,
  Users,
  TrendingUp,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Eye,
  Sparkles,
  Wallet,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

function formatBRL(val: number): string {
  return Number(val || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

function isVencidaDate(vencimento?: string | null): boolean {
  if (!vencimento) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const vDate = new Date(vencimento)
  vDate.setHours(0, 0, 0, 0)
  return vDate < today
}

export default function ADAdminCobrancas() {
  const [titulos] = useSupabaseArray<any>('titulos')
  const [activeTab, setActiveTab] = useState<'app' | 'erp'>('app')

  const [appCharges, setAppCharges] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [filterModalStatus, setFilterModalStatus] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL')
  const [modalSearchTerm, setModalSearchTerm] = useState('')
  const [modalPage, setModalPage] = useState(1)
  const [modalPageSize, setModalPageSize] = useState<number>(10)
  const [alunosMap, setAlunosMap] = useState<Record<string, string>>({})
  const [generatingLinkIds, setGeneratingLinkIds] = useState<Record<string, boolean>>({})
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null)

  // Estados da tabela principal e paginação
  const [mainFilterStatus, setMainFilterStatus] = useState<'ALL' | 'PENDING' | 'PAID' | 'OVERDUE'>('ALL')
  const [mainSearchTerm, setMainSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'total_desc' | 'open_desc' | 'paid_desc' | 'title_asc'>('recent')
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(10)

  const fetchChargesData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setIsRefreshing(true)

    try {
      const [{ data: chargesData }, { data: gruposData }] = await Promise.all([
        supabase
          .from('agenda_cobrancas_destinatarios')
          .select('*, agenda_cobrancas(*)')
          .order('created_at', { ascending: false }),
        supabase.from('agenda_grupos').select('id, dados')
      ])

      if (gruposData) {
        const map: Record<string, string> = {}
        gruposData.forEach((grupo: any) => {
          if (grupo.dados?.alunosIds && Array.isArray(grupo.dados.alunosIds)) {
            grupo.dados.alunosIds.forEach((alunoId: string) => {
              map[alunoId] = grupo.dados.nome
            })
          }
        })
        setAlunosMap(map)
      }

      if (chargesData) {
        setAppCharges(chargesData)
      }
      if (silent) toast.success('Dados de cobranças atualizados!')
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

  // Bloquear scroll quando modal estiver aberto
  useEffect(() => {
    const mainScroll = document.querySelector('.ad-main-scroll') as HTMLElement
    if (selectedGroupId) {
      document.body.style.overflow = 'hidden'
      if (mainScroll) mainScroll.style.overflow = 'hidden'
      setModalPage(1)
      setFilterModalStatus('ALL')
      setModalSearchTerm('')
    } else {
      document.body.style.overflow = 'unset'
      if (mainScroll) mainScroll.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = 'unset'
      if (mainScroll) mainScroll.style.overflow = ''
    }
  }, [selectedGroupId])

  // Agrupamento enriquecido por cobranca_id com cálculos financeiros completos
  const groupedCharges = useMemo(() => {
    const acc: Record<string, any> = {}
    appCharges.forEach(curr => {
      const cId = curr.cobranca_id
      if (!cId) return
      if (!acc[cId]) {
        acc[cId] = {
          cobranca: curr.agenda_cobrancas || { titulo: 'Sem Título', valor: 0 },
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
      const percentualPago = totalEnviados > 0 ? Math.round((totalPagos / totalEnviados) * 100) : 0
      const isFullyPaid = totalEnviados > 0 && totalPagos === totalEnviados
      const isOverdue = !isFullyPaid && totalAguardando > 0 && isVencidaDate(grp.cobranca?.vencimento)

      grp.metrics = {
        valorUnitario,
        totalEnviados,
        totalPagos,
        totalAguardando,
        valorTotal,
        valorPago,
        valorAberto,
        percentualPago,
        isFullyPaid,
        isOverdue
      }
    })

    return acc
  }, [appCharges])

  const groupedArray = useMemo(
    () => Object.keys(groupedCharges).map(k => ({ id: k, ...groupedCharges[k] })),
    [groupedCharges]
  )

  // Métricas Globais para os Cards KPI Superiores
  const globalKpis = useMemo(() => {
    let totalCobrancas = groupedArray.length
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
      if (m.totalAguardando > 0) cobrancasComPendencia += 1
      if (m.isOverdue) cobrancasVencidas += 1
    })

    const taxaRecebimento = volumeTotal > 0 ? Math.round((volumePago / volumeTotal) * 100) : 0

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
      taxaRecebimento
    }
  }, [groupedArray])

  // Filtragem e Ordenação da Tabela Principal
  const filteredGroupedArray = useMemo(() => {
    const filtered = groupedArray.filter(group => {
      const m = group.metrics

      if (mainFilterStatus === 'PAID' && !m.isFullyPaid) return false
      if (mainFilterStatus === 'PENDING' && m.totalAguardando === 0) return false
      if (mainFilterStatus === 'OVERDUE' && !m.isOverdue) return false

      if (mainSearchTerm.trim()) {
        const term = mainSearchTerm.toLowerCase().trim()
        const titulo = (group.cobranca?.titulo || '').toLowerCase()
        if (!titulo.includes(term)) return false
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
  }, [groupedArray, mainFilterStatus, mainSearchTerm, sortBy])

  // Reset página ao alterar filtros ou pageSize
  useEffect(() => {
    setCurrentPage(1)
  }, [mainFilterStatus, mainSearchTerm, sortBy, pageSize])

  // Paginação Principal (10, 30, 50, 100)
  const totalItems = filteredGroupedArray.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)
  const paginatedGroups = useMemo(
    () => filteredGroupedArray.slice(startIndex, endIndex),
    [filteredGroupedArray, startIndex, endIndex]
  )

  // Somas do filtro atual para rodapé
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
      const res = await fetch('/api/cobrancas/mercadopago-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cobranca_destinatario_id: dest.id,
          cobranca_id: dest.cobranca_id,
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

  // Abre o link de pagamento em nova guia (gera automaticamente caso ainda não exista)
  const handleOpenPaymentLink = async (dest: any) => {
    if (!dest) return
    if (dest.url_pagamento) {
      window.open(dest.url_pagamento, '_blank', 'noopener,noreferrer')
      return
    }

    const isPaid = dest.status === 'CONFIRMED' || dest.status === 'RECEIVED'
    if (isPaid) {
      toast.info('Esta cobrança já está quitada e não possui link externo salvo.')
      return
    }

    // Abre a aba sincronamente no clique para evitar bloqueio de pop-up
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

  // Copia o link de pagamento para a área de transferência (gera se necessário)
  const handleCopyPaymentLink = async (dest: any) => {
    if (!dest) return
    const url = dest.url_pagamento ? String(dest.url_pagamento) : await ensurePaymentLink(dest)
    if (!url) return

    try {
      await navigator.clipboard.writeText(url)
      setCopiedLinkId(dest.id)
      toast.success('Link de pagamento copiado para a área de transferência!')
      setTimeout(() => {
        setCopiedLinkId(prev => (prev === dest.id ? null : prev))
      }, 2200)
    } catch {
      toast.error('Não foi possível copiar o link automaticamente.')
    }
  }

  // Exportar Detalhes de uma Cobrança específica em XLSX
  const handleExportModalXlsx = (groupId: string, respectModalFilter = true) => {
    const selectedGroup = groupedCharges[groupId]
    if (!selectedGroup) return

    const cobrancaObj = selectedGroup.cobranca || { titulo: 'Cobrança', valor: 0 }
    const valorUnitario = Number(cobrancaObj.valor || 0)
    const vencimentoStr = cobrancaObj.vencimento
      ? new Date(cobrancaObj.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
      : '--'

    const allDestinatarios = selectedGroup.destinatarios || []
    const targetList = respectModalFilter
      ? allDestinatarios.filter((d: any) => {
          const isPaid = d.status === 'CONFIRMED' || d.status === 'RECEIVED'
          if (filterModalStatus === 'PAID' && !isPaid) return false
          if (filterModalStatus === 'PENDING' && isPaid) return false

          if (modalSearchTerm.trim()) {
            const term = modalSearchTerm.toLowerCase()
            const nome = (d.destinatario_nome || d.destinatario_id || '').toLowerCase()
            const turma =
              (
                alunosMap[d.destinatario_id] ||
                (d.destinatario_nome ? alunosMap[d.destinatario_nome.trim()] : '')
              )?.toLowerCase() || ''
            if (!nome.includes(term) && !turma.includes(term)) return false
          }
          return true
        })
      : allDestinatarios

    if (targetList.length === 0) {
      toast.error('Nenhum registro encontrado para exportar.')
      return
    }

    const rows = targetList.map((d: any) => {
      const isPaid = d.status === 'CONFIRMED' || d.status === 'RECEIVED'
      const turmaNome =
        alunosMap[d.destinatario_id] ||
        (d.destinatario_nome ? alunosMap[d.destinatario_nome.trim()] : '') ||
        '--'
      const enviadoEm = d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '--'
      const dataPgto =
        isPaid && (d.updated_at || d.created_at)
          ? new Date(d.updated_at || d.created_at).toLocaleDateString('pt-BR')
          : '--'
      const statusLabel = isPaid ? 'Pago' : d.status === 'PENDING' ? 'Aguardando' : d.status || 'Pendente'

      return {
        'Cobrança / Motivo': cobrancaObj.titulo || 'Sem Título',
        'Destinatário (Aluno)': d.destinatario_nome || d.destinatario_id || '--',
        Turma: turmaNome,
        'Pagador Logado': d.pagador_usuario_nome || '--',
        'Valor Unitário (R$)': valorUnitario,
        'Valor Pago (R$)': isPaid ? valorUnitario : 0,
        'Valor em Aberto (R$)': isPaid ? 0 : valorUnitario,
        'Enviado em': enviadoEm,
        Vencimento: vencimentoStr,
        'Data Pgto.': dataPgto,
        'Status Asaas': statusLabel,
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
      { wch: 34 },
      { wch: 22 },
      { wch: 22 },
      { wch: 18 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 }
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
        'Progresso (%)': `${m.percentualPago}%`
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
        const turmaNome =
          alunosMap[d.destinatario_id] ||
          (d.destinatario_nome ? alunosMap[d.destinatario_nome.trim()] : '') ||
          '--'
        todosDestinatarios.push({
          'Cobrança / Motivo': cob.titulo || 'Sem Título',
          'Destinatário (Aluno)': d.destinatario_nome || d.destinatario_id || '--',
          Turma: turmaNome,
          'Pagador Logado': d.pagador_usuario_nome || '--',
          'Valor Unitário (R$)': valUnit,
          'Valor Pago (R$)': isPaid ? valUnit : 0,
          'Valor em Aberto (R$)': isPaid ? 0 : valUnit,
          'Enviado em': d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '--',
          Vencimento: venc,
          'Data Pgto.':
            isPaid && (d.updated_at || d.created_at)
              ? new Date(d.updated_at || d.created_at).toLocaleDateString('pt-BR')
              : '--',
          'Status Asaas': isPaid ? 'Pago' : d.status === 'PENDING' ? 'Aguardando' : d.status || 'Pendente',
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
        { wch: 18 },
        { wch: 16 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 16 }
      ]
      XLSX.utils.book_append_sheet(wb, wsDet, 'Destinatários Detalhado')
    }

    const dateStr = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `Relatorio_Cobrancas_Agenda_${dateStr}.xlsx`)
    toast.success('Relatório consolidado exportado em Excel (.xlsx)!')
  }

  // Gera lista de botões de página
  const pageNumbers = useMemo(() => {
    const pages: number[] = []
    const maxVisible = 5
    let start = Math.max(1, safeCurrentPage - 2)
    let end = Math.min(totalPages, start + maxVisible - 1)
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
          overflow-x: auto;
          max-inline-size: 100%;
          container-type: inline-size;
          scrollbar-gutter: stable;
        }
        .ad-cobrancas-desktop-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          min-width: 980px;
        }
        .ad-cobrancas-desktop-table thead {
          position: sticky;
          inset-block-start: 0;
          z-index: 2;
        }
        .ad-cobrancas-desktop-table tbody th[scope="row"] {
          position: sticky;
          inset-inline-start: 0;
          background: inherit;
          z-index: 1;
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
          }
          .ad-cobrancas-top-actions button {
            flex: 1 !important;
            justify-content: center !important;
            min-height: 46px !important;
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
          background: 'rgba(255, 255, 255, 0.9)',
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
              Acompanhe valores totais, pagamentos confirmados, saldos em aberto e exporte relatórios em Excel.
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
              padding: '10px 18px',
              borderRadius: 12,
              border: '1px solid #10b981',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#ffffff',
              fontSize: 13.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.28)'
            }}
          >
            <FileSpreadsheet size={16} /> Exportar Excel (.xlsx)
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

        {/* Card 3: Valor em Aberto (Volume Pendente) */}
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

        {/* Card 4: Taxa de Recebimento & Vencidas */}
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
                  {globalKpis.taxaRecebimento}%
                </span>
                <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>quitado</span>
              </div>
              <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginTop: 6 }}>
                <div
                  style={{
                    width: `${Math.min(100, globalKpis.taxaRecebimento)}%`,
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
              Cobranças do App (Asaas)
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
              <div className="search-box" style={{ position: 'relative', width: 240 }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Buscar por motivo..."
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
            <div tabIndex={0} role="region" aria-label="Tabela de cobranças rápidas" className="ad-table-region">
              <table className="table ad-cobrancas-desktop-table">
                <thead>
                  <tr
                    style={{
                      background: '#f8fafc',
                      borderBottom: '1.5px solid #e2e8f0',
                      textAlign: 'left'
                    }}
                  >
                    <th style={{ padding: '14px 20px', fontSize: 11.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1.5px solid #e2e8f0' }}>
                      Motivo (Comunicado)
                    </th>
                    <th style={{ padding: '14px 12px', fontSize: 11.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', borderBottom: '1.5px solid #e2e8f0' }}>
                      Destinatários
                    </th>
                    <th style={{ padding: '14px 14px', fontSize: 11.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', borderBottom: '1.5px solid #e2e8f0' }}>
                      Valor Unitário
                    </th>
                    <th style={{ padding: '14px 14px', fontSize: 11.5, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', borderBottom: '1.5px solid #e2e8f0', background: 'rgba(239, 246, 255, 0.5)' }}>
                      Valor Total
                    </th>
                    <th style={{ padding: '14px 14px', fontSize: 11.5, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', borderBottom: '1.5px solid #e2e8f0', background: 'rgba(236, 253, 245, 0.5)' }}>
                      Valor Pago
                    </th>
                    <th style={{ padding: '14px 14px', fontSize: 11.5, fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', borderBottom: '1.5px solid #e2e8f0', background: 'rgba(254, 242, 242, 0.5)' }}>
                      Valor em Aberto
                    </th>
                    <th style={{ padding: '14px 16px', fontSize: 11.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1.5px solid #e2e8f0' }}>
                      Recebimentos
                    </th>
                    <th style={{ padding: '14px 20px', fontSize: 11.5, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', borderBottom: '1.5px solid #e2e8f0' }}>
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
                        <div style={{ fontSize: 13 }}>Tente limpar o filtro de status ou o termo de busca.</div>
                      </td>
                    </tr>
                  ) : (
                    paginatedGroups.map(group => {
                      const cobrancaObj = group.cobranca
                      const m = group.metrics
                      const vencFormatted = cobrancaObj.vencimento
                        ? new Date(cobrancaObj.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                        : '--'

                      return (
                        <tr key={group.id}>
                          {/* Motivo (Sticky Row Header) */}
                          <th
                            scope="row"
                            style={{
                              padding: '16px 20px',
                              borderBottom: '1px solid #f1f5f9',
                              textAlign: 'left',
                              fontWeight: 700
                            }}
                          >
                            <div style={{ fontWeight: 800, fontSize: 14.5, color: '#0f172a', marginBottom: 4 }}>
                              {cobrancaObj.titulo || 'Sem Título'}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  fontSize: 11.5,
                                  color: '#64748b',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <CreditCard size={12} color="#3b82f6" /> Comunicado
                              </span>
                              <span style={{ color: '#cbd5e1' }}>•</span>
                              <span
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 700,
                                  color: m.isOverdue ? '#dc2626' : '#64748b',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                <Calendar size={12} /> Venc: {vencFormatted}
                              </span>
                              {m.isOverdue && (
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    padding: '1px 7px',
                                    borderRadius: 8,
                                    background: '#fef2f2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca'
                                  }}
                                >
                                  Vencida
                                </span>
                              )}
                            </div>
                          </th>

                          {/* Destinatários */}
                          <td style={{ padding: '16px 12px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' }}>
                            <div
                              style={{
                                display: 'inline-flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                padding: '4px 12px',
                                borderRadius: 10,
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0'
                              }}
                            >
                              <span style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', lineHeight: 1.1 }}>
                                {m.totalEnviados}
                              </span>
                              <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>famílias</span>
                            </div>
                          </td>

                          {/* Valor Unitário */}
                          <td
                            style={{
                              padding: '16px 14px',
                              textAlign: 'right',
                              fontWeight: 700,
                              fontSize: 13.5,
                              color: '#475569',
                              borderBottom: '1px solid #f1f5f9',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            R$ {formatBRL(m.valorUnitario)}
                          </td>

                          {/* NOVO: Valor Total */}
                          <td
                            style={{
                              padding: '16px 14px',
                              textAlign: 'right',
                              fontWeight: 800,
                              fontSize: 14,
                              color: '#1e3a8a',
                              background: 'rgba(239, 246, 255, 0.25)',
                              borderBottom: '1px solid #f1f5f9',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            R$ {formatBRL(m.valorTotal)}
                          </td>

                          {/* NOVO: Valor Pago */}
                          <td
                            style={{
                              padding: '16px 14px',
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
                                fontSize: 13.5,
                                padding: '4px 10px',
                                borderRadius: 8,
                                background: m.valorPago > 0 ? '#dcfce7' : '#f1f5f9',
                                color: m.valorPago > 0 ? '#15803d' : '#64748b'
                              }}
                            >
                              R$ {formatBRL(m.valorPago)}
                            </span>
                          </td>

                          {/* NOVO: Valor em Aberto */}
                          <td
                            style={{
                              padding: '16px 14px',
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
                                fontSize: 13.5,
                                padding: '4px 10px',
                                borderRadius: 8,
                                background: m.valorAberto > 0 ? '#fee2e2' : '#f0fdf4',
                                color: m.valorAberto > 0 ? '#b91c1c' : '#15803d'
                              }}
                            >
                              R$ {formatBRL(m.valorAberto)}
                            </span>
                          </td>

                          {/* Recebimentos + Barra de Progresso */}
                          <td style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', minWidth: 150 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 6 }}>
                              <span
                                style={{
                                  fontWeight: 800,
                                  fontSize: 13,
                                  color: m.isFullyPaid ? '#059669' : '#0f172a'
                                }}
                              >
                                {m.totalPagos} / {m.totalEnviados}
                              </span>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  padding: '2px 7px',
                                  borderRadius: 10,
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
                                {m.isFullyPaid ? '100% Pago' : `${m.percentualPago}%`}
                              </span>
                            </div>
                            <div style={{ width: '100%', height: 6, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${m.percentualPago}%`,
                                  height: '100%',
                                  background: m.isFullyPaid ? '#10b981' : '#3b82f6',
                                  borderRadius: 99,
                                  transition: 'width 0.3s ease'
                                }}
                              />
                            </div>
                          </td>

                          {/* Ações */}
                          <td style={{ padding: '16px 20px', textAlign: 'right', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <button
                                type="button"
                                onClick={() => handleExportModalXlsx(group.id, false)}
                                title="Exportar esta cobrança em Excel (.xlsx)"
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 10,
                                  border: '1px solid #bbf7d0',
                                  background: '#f0fdf4',
                                  color: '#059669',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer'
                                }}
                              >
                                <FileSpreadsheet size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedGroupId(group.id)}
                                style={{
                                  padding: '8px 14px',
                                  borderRadius: 10,
                                  border: '1px solid #cbd5e1',
                                  background: '#ffffff',
                                  color: '#0f172a',
                                  fontSize: 12.5,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6
                                }}
                              >
                                <Eye size={14} color="#4f46e5" /> Detalhes
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>

                {/* Rodapé Consolidado dos Itens Filtrados */}
                {!loading && paginatedGroups.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                      <td style={{ padding: '14px 20px', fontWeight: 800, fontSize: 12.5, color: '#334155' }}>
                        TOTAL CONSOLIDADO ({filteredGroupedArray.length} cobranças filtradas)
                      </td>
                      <td style={{ padding: '14px 12px', textAlign: 'center', fontWeight: 800, fontSize: 13, color: '#0f172a' }}>
                        {filteredTotals.destinatarios}
                      </td>
                      <td style={{ padding: '14px 14px', textAlign: 'right', color: '#94a3b8', fontSize: 12 }}>—</td>
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#1e3a8a', whiteSpace: 'nowrap' }}>
                        R$ {formatBRL(filteredTotals.valorTotal)}
                      </td>
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#15803d', whiteSpace: 'nowrap' }}>
                        R$ {formatBRL(filteredTotals.valorPago)}
                      </td>
                      <td style={{ padding: '14px 14px', textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#b91c1c', whiteSpace: 'nowrap' }}>
                        R$ {formatBRL(filteredTotals.valorAberto)}
                      </td>
                      <td colSpan={2} style={{ padding: '14px 20px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#475569' }}>
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
                          {m.totalPagos}/{m.totalEnviados} ({m.percentualPago}%)
                        </span>
                      </div>

                      {/* Mini Grid: Valor Total, Pago, Em Aberto no Mobile */}
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
                          <Eye size={14} /> Ver Detalhes da Cobrança
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                BARRA DE PAGINAÇÃO (10, 30, 50, 100)
            ════════════════════════════════════════════════════════════════════ */}
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
          <div style={{ padding: 56, textAlign: 'center', color: '#64748b' }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 18,
                background: '#eef2ff',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}
            >
              <FileText size={30} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>
              Sincronização Automática de Mensalidades (ERP)
            </h3>
            <p style={{ maxWidth: 460, margin: '0 auto', lineHeight: 1.5, fontSize: 13.5 }}>
              As <strong>{titulos?.length || 0}</strong> mensalidades ativas do ERP escolar já são sincronizadas automaticamente na aba Financeiro do aplicativo da família.
            </p>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL: DETALHES DA COBRANÇA
      ══════════════════════════════════════════════════════════════════════════ */}
      {typeof window !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {selectedGroupId && groupedCharges[selectedGroupId] && (
              <motion.div
                id="print-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedGroupId(null)}
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(15, 23, 42, 0.65)',
                  backdropFilter: 'blur(8px)',
                  zIndex: 99999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 16
                }}
              >
                <style>{`
                  @media print {
                    body, html { height: auto !important; overflow: visible !important; }
                    body * { visibility: hidden !important; }
                    #print-overlay, #print-overlay * { visibility: visible !important; }
                    #print-overlay {
                      position: absolute !important;
                      left: 0 !important;
                      top: 0 !important;
                      width: 100% !important;
                      display: block !important;
                      padding: 0 !important;
                      background: none !important;
                      backdrop-filter: none !important;
                    }
                    #print-modal {
                      position: static !important;
                      width: 100% !important;
                      max-width: none !important;
                      max-height: none !important;
                      height: auto !important;
                      overflow: visible !important;
                      box-shadow: none !important;
                      transform: none !important;
                      padding: 0 !important;
                      margin: 0 !important;
                      background: white !important;
                      display: block !important;
                    }
                    #print-modal-scroll {
                      overflow: visible !important;
                      max-height: none !important;
                      height: auto !important;
                      display: block !important;
                    }
                    .no-print, .no-print * { display: none !important; }
                    table { page-break-inside: auto !important; width: 100% !important; }
                    tr { page-break-inside: avoid !important; page-break-after: auto !important; }
                    td, th { page-break-inside: avoid !important; }
                  }
                `}</style>

                {(() => {
                  const selectedGroup = groupedCharges[selectedGroupId]
                  const m = selectedGroup.metrics
                  const allDestinatarios = selectedGroup.destinatarios || []
                  const vencStr = selectedGroup.cobranca?.vencimento
                    ? new Date(selectedGroup.cobranca.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
                    : '--'

                  const filteredModalList = allDestinatarios.filter((d: any) => {
                    const isPaid = d.status === 'CONFIRMED' || d.status === 'RECEIVED'
                    if (filterModalStatus === 'PAID' && !isPaid) return false
                    if (filterModalStatus === 'PENDING' && isPaid) return false

                    if (modalSearchTerm.trim()) {
                      const term = modalSearchTerm.toLowerCase()
                      const nome = (d.destinatario_nome || d.destinatario_id || '').toLowerCase()
                      const turma =
                        (
                          alunosMap[d.destinatario_id] ||
                          (d.destinatario_nome ? alunosMap[d.destinatario_nome.trim()] : '')
                        )?.toLowerCase() || ''
                      if (!nome.includes(term) && !turma.includes(term)) return false
                    }
                    return true
                  })

                  const modalTotalPages = Math.max(1, Math.ceil(filteredModalList.length / modalPageSize))
                  const safeModalPage = Math.min(modalPage, modalTotalPages)
                  const modalStartIdx = (safeModalPage - 1) * modalPageSize
                  const paginatedModalList = filteredModalList.slice(modalStartIdx, modalStartIdx + modalPageSize)

                  return (
                    <motion.div
                      id="print-modal"
                      onClick={e => e.stopPropagation()}
                      initial={{ y: 30, scale: 0.96, opacity: 0 }}
                      animate={{ y: 0, scale: 1, opacity: 1 }}
                      exit={{ y: 20, scale: 0.96, opacity: 0 }}
                      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                      style={{
                        width: '100%',
                        maxWidth: 1040,
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff',
                        borderRadius: 24,
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
                        color: '#0f172a'
                      }}
                    >
                      {/* Modal Header */}
                      <div className="ad-modal-header" style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <h3 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                                Detalhes da Cobrança
                              </h3>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 800,
                                  padding: '3px 10px',
                                  borderRadius: 12,
                                  background: '#eef2ff',
                                  color: '#4338ca'
                                }}
                              >
                                Unitário: R$ {formatBRL(m.valorUnitario)}
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  padding: '3px 10px',
                                  borderRadius: 12,
                                  background: '#f1f5f9',
                                  color: '#475569'
                                }}
                              >
                                Vencimento: {vencStr}
                              </span>
                            </div>
                            <p style={{ color: '#475569', fontSize: 15, fontWeight: 600, margin: '6px 0 0 0' }}>
                              {selectedGroup.cobranca?.titulo}
                            </p>
                          </div>

                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }} className="no-print">
                            <button
                              type="button"
                              onClick={() => handleExportModalXlsx(selectedGroupId, true)}
                              style={{
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                border: 'none',
                                height: 38,
                                padding: '0 16px',
                                borderRadius: 12,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 7,
                                cursor: 'pointer',
                                color: '#ffffff',
                                fontSize: 13,
                                fontWeight: 800,
                                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                              }}
                              title="Exportar planilha Excel (.xlsx)"
                            >
                              <FileSpreadsheet size={16} /> Exportar XLSX
                            </button>

                            <button
                              type="button"
                              onClick={() => window.print()}
                              style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                width: 38,
                                height: 38,
                                borderRadius: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#2563eb'
                              }}
                              title="Imprimir"
                            >
                              <Printer size={17} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setSelectedGroupId(null)}
                              style={{
                                background: '#f1f5f9',
                                border: 'none',
                                width: 38,
                                height: 38,
                                borderRadius: 12,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: '#475569'
                              }}
                              title="Fechar"
                            >
                              <X size={19} />
                            </button>
                          </div>
                        </div>

                        {/* Modal KPI Cards */}
                        <div
                          className="ad-modal-kpi-grid"
                          style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 20 }}
                        >
                          <div
                            style={{
                              padding: '16px 18px',
                              background: 'rgba(59, 130, 246, 0.06)',
                              borderRadius: 16,
                              border: '1px solid rgba(59, 130, 246, 0.16)'
                            }}
                          >
                            <div style={{ fontSize: 12, color: '#2563eb', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                              Valor Total ({m.totalEnviados} envios)
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: '#1e3a8a', fontFamily: 'Outfit, sans-serif' }}>
                              R$ {formatBRL(m.valorTotal)}
                            </div>
                          </div>

                          <div
                            style={{
                              padding: '16px 18px',
                              background: 'rgba(16, 185, 129, 0.06)',
                              borderRadius: 16,
                              border: '1px solid rgba(16, 185, 129, 0.18)'
                            }}
                          >
                            <div style={{ fontSize: 12, color: '#059669', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                              Valor Pago ({m.totalPagos} pagos • {m.percentualPago}%)
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: '#065f46', fontFamily: 'Outfit, sans-serif' }}>
                              R$ {formatBRL(m.valorPago)}
                            </div>
                          </div>

                          <div
                            style={{
                              padding: '16px 18px',
                              background: 'rgba(239, 68, 68, 0.06)',
                              borderRadius: 16,
                              border: '1px solid rgba(239, 68, 68, 0.16)'
                            }}
                          >
                            <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                              Valor em Aberto ({m.totalAguardando} pendentes)
                            </div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: '#7f1d1d', fontFamily: 'Outfit, sans-serif' }}>
                              R$ {formatBRL(m.valorAberto)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Modal Toolbar */}
                      <div
                        className="no-print ad-modal-toolbar"
                        style={{
                          padding: '14px 32px',
                          background: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          display: 'flex',
                          gap: 14,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Status:</span>
                          <div style={{ display: 'flex', gap: 6, background: '#e2e8f0', padding: 3, borderRadius: 20 }}>
                            <button
                              type="button"
                              style={{
                                padding: '5px 14px',
                                borderRadius: 16,
                                fontSize: 12.5,
                                fontWeight: 800,
                                border: 'none',
                                cursor: 'pointer',
                                background: filterModalStatus === 'ALL' ? '#ffffff' : 'transparent',
                                color: filterModalStatus === 'ALL' ? '#0f172a' : '#475569'
                              }}
                              onClick={() => {
                                setFilterModalStatus('ALL')
                                setModalPage(1)
                              }}
                            >
                              Todos ({m.totalEnviados})
                            </button>
                            <button
                              type="button"
                              style={{
                                padding: '5px 14px',
                                borderRadius: 16,
                                fontSize: 12.5,
                                fontWeight: 800,
                                border: 'none',
                                cursor: 'pointer',
                                background: filterModalStatus === 'PAID' ? '#10b981' : 'transparent',
                                color: filterModalStatus === 'PAID' ? '#ffffff' : '#475569'
                              }}
                              onClick={() => {
                                setFilterModalStatus('PAID')
                                setModalPage(1)
                              }}
                            >
                              Pagos ({m.totalPagos})
                            </button>
                            <button
                              type="button"
                              style={{
                                padding: '5px 14px',
                                borderRadius: 16,
                                fontSize: 12.5,
                                fontWeight: 800,
                                border: 'none',
                                cursor: 'pointer',
                                background: filterModalStatus === 'PENDING' ? '#ef4444' : 'transparent',
                                color: filterModalStatus === 'PENDING' ? '#ffffff' : '#475569'
                              }}
                              onClick={() => {
                                setFilterModalStatus('PENDING')
                                setModalPage(1)
                              }}
                            >
                              Aguardando ({m.totalAguardando})
                            </button>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 320px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340, minWidth: 200 }}>
                            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
                            <input
                              type="text"
                              placeholder="Buscar aluno, turma ou responsável..."
                              value={modalSearchTerm}
                              onChange={e => {
                                setModalSearchTerm(e.target.value)
                                setModalPage(1)
                              }}
                              style={{
                                width: '100%',
                                padding: '7px 14px 7px 34px',
                                borderRadius: 20,
                                border: '1px solid #cbd5e1',
                                outline: 'none',
                                fontSize: 13,
                                color: '#0f172a',
                                background: '#ffffff',
                                boxSizing: 'border-box'
                              }}
                            />
                          </div>

                          <select
                            aria-label="Itens por página no modal"
                            value={modalPageSize}
                            onChange={e => {
                              setModalPageSize(Number(e.target.value))
                              setModalPage(1)
                            }}
                            style={{
                              width: 'auto',
                              flexShrink: 0,
                              padding: '7px 12px',
                              borderRadius: 10,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              fontSize: 12,
                              fontWeight: 800,
                              color: '#334155',
                              cursor: 'pointer'
                            }}
                          >
                            <option value={10}>10 / pág</option>
                            <option value={30}>30 / pág</option>
                            <option value={50}>50 / pág</option>
                            <option value={100}>100 / pág</option>
                          </select>
                        </div>
                      </div>

                      {/* Modal Table */}
                      <div id="print-modal-scroll" className="ad-modal-body" style={{ flex: 1, overflowY: 'auto', padding: '0 32px 24px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e2e8f0' }}>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}>
                                DESTINATÁRIO
                              </th>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}>
                                PAGADOR LOGADO
                              </th>
                              <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}>
                                VALOR
                              </th>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}>
                                ENVIADO EM
                              </th>
                              <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}>
                                DATA PGTO.
                              </th>
                              <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}>
                                STATUS ASAAS
                              </th>
                              <th
                                className="no-print"
                                style={{ padding: '12px 8px', textAlign: 'right', fontSize: 11.5, fontWeight: 800, color: '#64748b' }}
                              >
                                LINK DE PAGAMENTO
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedModalList.map((d: any) => {
                              const isPaid = d.status === 'CONFIRMED' || d.status === 'RECEIVED'
                              const payDate = isPaid
                                ? new Date(d.updated_at || d.created_at).toLocaleDateString('pt-BR')
                                : '--'
                              const turmaNome =
                                alunosMap[d.destinatario_id] ||
                                (d.destinatario_nome ? alunosMap[d.destinatario_nome.trim()] : undefined)
                              const isGenerating = Boolean(generatingLinkIds[d.id])
                              const isCopied = copiedLinkId === d.id

                              return (
                                <tr key={d.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '14px 8px', fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                                    {d.destinatario_nome || d.destinatario_id}
                                    {turmaNome && (
                                      <div
                                        style={{
                                          fontSize: 11,
                                          color: '#64748b',
                                          fontWeight: 700,
                                          marginTop: 3,
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 6,
                                          textTransform: 'uppercase'
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 5,
                                            height: 5,
                                            borderRadius: '50%',
                                            background: '#3b82f6',
                                            display: 'inline-block'
                                          }}
                                        />
                                        {turmaNome}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '14px 8px', fontSize: 13.5, color: '#475569', fontWeight: 600 }}>
                                    {d.pagador_usuario_nome ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <CheckCircle2 size={14} color="#10b981" />
                                        {d.pagador_usuario_nome}
                                      </div>
                                    ) : (
                                      '--'
                                    )}
                                  </td>
                                  <td style={{ padding: '14px 8px', fontSize: 13.5, fontWeight: 700, color: '#0f172a', textAlign: 'right' }}>
                                    R$ {formatBRL(m.valorUnitario)}
                                  </td>
                                  <td style={{ padding: '14px 8px', fontSize: 13.5, color: '#64748b' }}>
                                    {new Date(d.created_at).toLocaleDateString('pt-BR')}
                                  </td>
                                  <td
                                    style={{
                                      padding: '14px 8px',
                                      fontSize: 13.5,
                                      color: isPaid ? '#059669' : '#cbd5e1',
                                      fontWeight: isPaid ? 700 : 400
                                    }}
                                  >
                                    {payDate}
                                  </td>
                                  <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                                    {isPaid ? (
                                      <span
                                        style={{
                                          padding: '5px 12px',
                                          background: '#dcfce7',
                                          color: '#15803d',
                                          borderRadius: 20,
                                          fontSize: 12,
                                          fontWeight: 800
                                        }}
                                      >
                                        Pago
                                      </span>
                                    ) : d.status === 'PENDING' ? (
                                      <span
                                        style={{
                                          padding: '5px 12px',
                                          background: '#f1f5f9',
                                          color: '#475569',
                                          borderRadius: 20,
                                          fontSize: 12,
                                          fontWeight: 700
                                        }}
                                      >
                                        Aguardando
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          padding: '5px 12px',
                                          background: '#fee2e2',
                                          color: '#b91c1c',
                                          borderRadius: 20,
                                          fontSize: 12,
                                          fontWeight: 700
                                        }}
                                      >
                                        {d.status}
                                      </span>
                                    )}
                                  </td>
                                  <td className="no-print" style={{ padding: '14px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                      {d.url_pagamento ? (
                                        <>
                                          <a
                                            href={d.url_pagamento}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                              padding: '6px 12px',
                                              borderRadius: 10,
                                              border: '1px solid #c7d2fe',
                                              background: '#eef2ff',
                                              color: '#4338ca',
                                              fontSize: 12,
                                              fontWeight: 800,
                                              textDecoration: 'none',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 6,
                                              transition: 'all 0.15s ease'
                                            }}
                                            title="Abrir link de pagamento em nova guia"
                                          >
                                            <ExternalLink size={13} /> Abrir Link
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => handleCopyPaymentLink(d)}
                                            style={{
                                              width: 30,
                                              height: 30,
                                              borderRadius: 9,
                                              border: isCopied ? '1px solid #86efac' : '1px solid #cbd5e1',
                                              background: isCopied ? '#dcfce7' : '#ffffff',
                                              color: isCopied ? '#15803d' : '#475569',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              cursor: 'pointer'
                                            }}
                                            title="Copiar link de pagamento"
                                          >
                                            {isCopied ? <Check size={13} /> : <Copy size={13} />}
                                          </button>
                                        </>
                                      ) : !isPaid ? (
                                        <>
                                          <button
                                            type="button"
                                            disabled={isGenerating}
                                            onClick={() => handleOpenPaymentLink(d)}
                                            style={{
                                              padding: '6px 12px',
                                              borderRadius: 10,
                                              border: '1px solid #bfdbfe',
                                              background: '#eff6ff',
                                              color: '#1d4ed8',
                                              fontSize: 12,
                                              fontWeight: 800,
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: 6,
                                              cursor: isGenerating ? 'wait' : 'pointer',
                                              opacity: isGenerating ? 0.7 : 1
                                            }}
                                            title="Gerar e abrir link de pagamento em nova guia"
                                          >
                                            {isGenerating ? (
                                              <>
                                                <RefreshCw size={13} className="animate-spin" /> Gerando...
                                              </>
                                            ) : (
                                              <>
                                                <ExternalLink size={13} /> Abrir Link
                                              </>
                                            )}
                                          </button>
                                          <button
                                            type="button"
                                            disabled={isGenerating}
                                            onClick={() => handleCopyPaymentLink(d)}
                                            style={{
                                              width: 30,
                                              height: 30,
                                              borderRadius: 9,
                                              border: isCopied ? '1px solid #86efac' : '1px solid #cbd5e1',
                                              background: isCopied ? '#dcfce7' : '#ffffff',
                                              color: isCopied ? '#15803d' : '#475569',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              cursor: isGenerating ? 'wait' : 'pointer',
                                              opacity: isGenerating ? 0.7 : 1
                                            }}
                                            title="Gerar e copiar link de pagamento"
                                          >
                                            {isCopied ? <Check size={13} /> : <Copy size={13} />}
                                          </button>
                                        </>
                                      ) : (
                                        <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Quitado</span>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Paginação Interna do Modal */}
                      {filteredModalList.length > modalPageSize && (
                        <div
                          className="no-print"
                          style={{
                            padding: '12px 32px',
                            borderTop: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            flexWrap: 'wrap'
                          }}
                        >
                          <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>
                            Exibindo {modalStartIdx + 1} a {Math.min(modalStartIdx + modalPageSize, filteredModalList.length)} de{' '}
                            {filteredModalList.length} destinatários
                          </span>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              disabled={safeModalPage <= 1}
                              onClick={() => setModalPage(p => Math.max(1, p - 1))}
                              style={{
                                padding: '5px 12px',
                                borderRadius: 8,
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: safeModalPage <= 1 ? 'not-allowed' : 'pointer',
                                opacity: safeModalPage <= 1 ? 0.4 : 1
                              }}
                            >
                              Anterior
                            </button>
                            <span style={{ padding: '5px 10px', fontSize: 12.5, fontWeight: 800, color: '#0f172a' }}>
                              Página {safeModalPage} de {modalTotalPages}
                            </span>
                            <button
                              type="button"
                              disabled={safeModalPage >= modalTotalPages}
                              onClick={() => setModalPage(p => Math.min(modalTotalPages, p + 1))}
                              style={{
                                padding: '5px 12px',
                                borderRadius: 8,
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: safeModalPage >= modalTotalPages ? 'not-allowed' : 'pointer',
                                opacity: safeModalPage >= modalTotalPages ? 0.4 : 1
                              }}
                            >
                              Próxima
                            </button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )
                })()}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  )
}
