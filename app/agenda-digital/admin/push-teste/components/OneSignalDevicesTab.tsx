'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Smartphone,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Search,
  CheckCircle2,
  Clock,
  Users,
  GraduationCap,
  Briefcase,
  Sparkles,
  Copy,
  Check,
  Send,
  Filter,
  Zap,
  BellOff,
  UserX,
  Layers,
  Ghost,
  ChevronLeft,
  ChevronRight,
  Info,
  X,
  Laptop,
  Shield,
} from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'
import { toast } from 'sonner'
import type {
  OneSignalFleetDevice,
  OneSignalFleetOverviewResult,
  OneSignalFleetSummary,
  SmartCleanupMode,
} from '@/lib/server/oneSignalFleetService'

interface OneSignalDevicesTabProps {
  initialOverview?: OneSignalFleetOverviewResult | null
  onOverviewUpdated?: (overview: OneSignalFleetOverviewResult) => void
  currentDeviceSubId?: string | null
}

type FilterCategoryTab =
  | 'all'
  | 'recommended'
  | 'active'
  | 'inactive_students'
  | 'unused'
  | 'duplicates'
  | 'orphans'
  | 'disabled'

export function OneSignalDevicesTab({
  initialOverview,
  onOverviewUpdated,
  currentDeviceSubId,
}: OneSignalDevicesTabProps) {
  const [overview, setOverview] = useState<OneSignalFleetOverviewResult | null>(initialOverview || null)
  const [isLoading, setIsLoading] = useState(!initialOverview)
  const [activeFilterTab, setActiveFilterTab] = useState<FilterCategoryTab>('all')
  const [unusedThresholdDays, setUnusedThresholdDays] = useState<number>(60)
  const [protectStaffOnUnused, setProtectStaffOnUnused] = useState<boolean>(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [platformFilter, setPlatformFilter] = useState<'all' | 'iOS' | 'Android' | 'Web'>('all')
  const [ownerTypeFilter, setOwnerTypeFilter] = useState<'all' | 'responsavel' | 'aluno' | 'colaborador' | 'orfao'>('all')
  const [sortBy, setSortBy] = useState<'priority' | 'inactive_desc' | 'active_recent' | 'sessions_desc' | 'name_asc'>('priority')
  const [page, setPage] = useState(1)
  const pageSize = 25

  // Seleção em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [testingSubId, setTestingSubId] = useState<string | null>(null)
  const [deletingSubId, setDeletingSubId] = useState<string | null>(null)
  const [isExecutingBatch, setIsExecutingBatch] = useState(false)

  // Modal nativo <dialog> de confirmação de limpeza em lote
  const confirmDialogRef = useRef<HTMLDialogElement | null>(null)
  const [pendingCleanupAction, setPendingCleanupAction] = useState<{
    mode: SmartCleanupMode
    title: string
    description: string
    targetDevices: OneSignalFleetDevice[]
    minInactiveDays?: number
    protectStaff?: boolean
  } | null>(null)

  const fetchOverview = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true)
    try {
      const res = await fetch('/api/agenda/push/test?onesignal_overview=true')
      if (res.ok) {
        const data: OneSignalFleetOverviewResult = await res.json()
        setOverview(data)
        if (onOverviewUpdated) onOverviewUpdated(data)
      } else {
        toast.error('Não foi possível carregar os aparelhos do OneSignal.')
      }
    } catch (err: any) {
      toast.error('Erro de conexão ao consultar aparelhos no OneSignal.')
    } finally {
      setIsLoading(false)
    }
  }, [onOverviewUpdated])

  useEffect(() => {
    if (initialOverview) {
      setOverview(initialOverview)
      setIsLoading(false)
    } else {
      fetchOverview()
    }
  }, [initialOverview, fetchOverview])

  const summary: OneSignalFleetSummary = overview?.summary || {
    isMockMode: false,
    totalDevices: 0,
    activeDevices: 0,
    disabledDevices: 0,
    uniqueUsersTotal: 0,
    uniqueUsersWithActivePush: 0,
    byPlatform: {
      ios: { total: 0, active: 0 },
      android: { total: 0, active: 0 },
      web: { total: 0, active: 0 },
    },
    byCategory: {
      activeFamily: 0,
      activeStaff: 0,
      inactiveStudents: 0,
      inactiveStudentsActivePush: 0,
      orphans: 0,
      orphansActivePush: 0,
      disabledPush: 0,
      duplicatesStale: 0,
      duplicatesStaleActivePush: 0,
      unused30d: 0,
      unused30dNonStaff: 0,
      unused60d: 0,
      unused60dNonStaff: 0,
      unused90d: 0,
      unused90dNonStaff: 0,
      unused180d: 0,
      recommendedCleanupTotal: 0,
      recommendedActiveSlotsFreed: 0,
    },
  }

  const allDevices = useMemo(() => overview?.devices || [], [overview])

  // Contagem dinâmica para o filtro "Sem Uso" baseado no threshold escolhido (30, 60, 90, 180 dias)
  const unusedMatchingDevices = useMemo(() => {
    return allDevices.filter(d => {
      if (protectStaffOnUnused && d.isStaffMember) return false
      return d.daysInactive >= unusedThresholdDays
    })
  }, [allDevices, unusedThresholdDays, protectStaffOnUnused])

  // Filtragem e ordenação da lista
  const filteredDevices = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()

    const list = allDevices.filter(d => {
      // 1. Aba de categoria
      if (activeFilterTab === 'recommended' && !d.isRecommendedForCleanup) return false
      if (activeFilterTab === 'active' && !d.isSubscribed) return false
      if (
        activeFilterTab === 'inactive_students' &&
        !d.cleanupReasons.includes('aluno_inativo') &&
        !d.cleanupReasons.includes('colaborador_inativo')
      ) {
        return false
      }
      if (activeFilterTab === 'unused') {
        if (protectStaffOnUnused && d.isStaffMember) return false
        if (d.daysInactive < unusedThresholdDays) return false
      }
      if (activeFilterTab === 'duplicates' && !d.isDuplicateStale) return false
      if (activeFilterTab === 'orphans' && !d.cleanupReasons.includes('orfao')) return false
      if (activeFilterTab === 'disabled' && d.isSubscribed) return false

      // 2. Plataforma
      if (platformFilter !== 'all' && d.platform !== platformFilter) return false

      // 3. Tipo de Proprietário
      if (ownerTypeFilter !== 'all' && d.ownerType !== ownerTypeFilter) return false

      // 4. Busca textual
      if (q) {
        const matchOwner = d.ownerName.toLowerCase().includes(q)
        const matchEmail = (d.ownerEmail || '').toLowerCase().includes(q)
        const matchRole = d.ownerRole.toLowerCase().includes(q)
        const matchModel = d.model.toLowerCase().includes(q) || d.os.toLowerCase().includes(q)
        const matchSubId = d.id.toLowerCase().includes(q) || (d.externalUserId || '').toLowerCase().includes(q)
        const matchStudents = d.linkedStudents.some(
          s =>
            s.nome.toLowerCase().includes(q) ||
            s.matricula.toLowerCase().includes(q) ||
            s.turma.toLowerCase().includes(q)
        )
        if (!matchOwner && !matchEmail && !matchRole && !matchModel && !matchSubId && !matchStudents) {
          return false
        }
      }

      return true
    })

    // Ordenação
    return [...list].sort((a, b) => {
      if (sortBy === 'inactive_desc') {
        return b.daysInactive - a.daysInactive
      }
      if (sortBy === 'active_recent') {
        return a.daysInactive - b.daysInactive
      }
      if (sortBy === 'sessions_desc') {
        return b.sessionCount - a.sessionCount
      }
      if (sortBy === 'name_asc') {
        return a.ownerName.localeCompare(b.ownerName)
      }
      return 0 // mantém prioridade padrão do servidor
    })
  }, [
    allDevices,
    activeFilterTab,
    unusedThresholdDays,
    protectStaffOnUnused,
    platformFilter,
    ownerTypeFilter,
    searchTerm,
    sortBy,
  ])

  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / pageSize))
  const paginatedDevices = useMemo(() => {
    const start = (page - 1) * pageSize
    return filteredDevices.slice(start, start + pageSize)
  }, [filteredDevices, page, pageSize])

  useEffect(() => {
    setPage(1)
  }, [activeFilterTab, unusedThresholdDays, protectStaffOnUnused, platformFilter, ownerTypeFilter, searchTerm, sortBy])

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(text)
      toast.success(`${label} copiado!`)
      setTimeout(() => setCopiedId(null), 1800)
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredDevices.map(d => d.id)
    const allSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id))
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredIds.forEach(id => next.delete(id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filteredIds.forEach(id => next.add(id))
        return next
      })
    }
  }

  // Abrir modal de confirmação para qualquer modo de limpeza
  const openCleanupModal = (mode: SmartCleanupMode) => {
    let targetDevices: OneSignalFleetDevice[] = []
    let title = ''
    let description = ''

    if (mode === 'selected_ids') {
      targetDevices = allDevices.filter(d => selectedIds.has(d.id))
      title = `Excluir ${targetDevices.length} Aparelho(s) Selecionado(s)`
      description =
        'Os aparelhos marcados serão removidos do OneSignal imediatamente, liberando seus acessos. Caso um usuário ativo abra o app novamente, o sistema registrará uma nova sessão limpa.'
    } else if (mode === 'inactive_students') {
      targetDevices = allDevices.filter(
        d => d.cleanupReasons.includes('aluno_inativo') || d.cleanupReasons.includes('colaborador_inativo')
      )
      title = 'Limpar Alunos Inativos & Ex-Colaboradores'
      description =
        'Remove todos os aparelhos de alunos inativos/transferidos/cancelados e de seus responsáveis que não possuem outros filhos ativos na escola. Responsáveis com outros filhos ativos e colaboradores ativos são 100% preservados.'
    } else if (mode === 'unused') {
      targetDevices = unusedMatchingDevices
      title = `Limpar Aparelhos Sem Uso há +${unusedThresholdDays} Dias`
      description = `Remove do OneSignal os aparelhos que não abrem o aplicativo há pelo menos ${unusedThresholdDays} dias${
        protectStaffOnUnused ? ' (preservando todos os colaboradores e administradores da escola)' : ''
      }. Se o responsável voltar a abrir o app no futuro, a inscrição é recriada automaticamente.`
    } else if (mode === 'duplicates') {
      targetDevices = allDevices.filter(d => d.isDuplicateStale && d.deviceRankInUser > 1)
      title = 'Limpar Sessões Duplicadas / Aparelhos Antigos'
      description =
        'Mantém intacto o aparelho principal mais recente de cada usuário e remove apenas as sessões extras antigas geradas por reinstalações ou trocas de smartphone.'
    } else if (mode === 'orphans') {
      targetDevices = allDevices.filter(d => d.cleanupReasons.includes('orfao'))
      title = 'Limpar Aparelhos Órfãos / Anônimos'
      description =
        'Remove registros anônimos sem external_id ou vinculados a contas que não existem mais no banco de dados da escola.'
    } else if (mode === 'disabled') {
      targetDevices = allDevices.filter(d => !d.isSubscribed)
      title = 'Limpar Aparelhos com Push Desativado / Sem Token'
      description =
        'Remove aparelhos onde as notificações foram bloqueadas, o app foi desinstalado ou o token push expirou.'
    } else if (mode === 'smart_all') {
      targetDevices = allDevices.filter(d => d.isRecommendedForCleanup)
      title = 'Limpeza Inteligente Completa (Liberar Acessos)'
      description =
        'Executa de uma só vez a remoção segura de: Alunos Inativos, Aparelhos Órfãos, Sessões Duplicadas Antigas, Tokens Desativados e Aparelhos de Famílias sem uso há +60 dias. Todos os alunos ativos em uso e colaboradores são preservados.'
    }

    if (targetDevices.length === 0) {
      toast.info('Nenhum aparelho encontrado para esta categoria de limpeza!')
      return
    }

    setPendingCleanupAction({
      mode,
      title,
      description,
      targetDevices,
      minInactiveDays: unusedThresholdDays,
      protectStaff: protectStaffOnUnused,
    })

    if (confirmDialogRef.current && !confirmDialogRef.current.open) {
      confirmDialogRef.current.showModal()
    }
  }

  const closeCleanupModal = () => {
    if (confirmDialogRef.current?.open) {
      confirmDialogRef.current.close()
    }
    setPendingCleanupAction(null)
  }

  const executeConfirmedCleanup = async () => {
    if (!pendingCleanupAction) return
    setIsExecutingBatch(true)
    try {
      const res = await fetch('/api/agenda/push/test', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanupMode: pendingCleanupAction.mode,
          subscriptionIds:
            pendingCleanupAction.mode === 'selected_ids'
              ? pendingCleanupAction.targetDevices.map(d => d.id)
              : undefined,
          minInactiveDays: pendingCleanupAction.minInactiveDays,
          protectStaff: pendingCleanupAction.protectStaff,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(data.message || `${data.deletedCount} aparelho(s) removido(s) com sucesso!`, {
          duration: 5000,
        })
        if (pendingCleanupAction.mode === 'selected_ids') {
          setSelectedIds(new Set())
        } else if (Array.isArray(data.deletedSubscriptionIds)) {
          setSelectedIds(prev => {
            const next = new Set(prev)
            data.deletedSubscriptionIds.forEach((id: string) => next.delete(id))
            return next
          })
        }
        closeCleanupModal()
        await fetchOverview(true)
      } else {
        toast.error(data.error || 'Erro ao executar limpeza no OneSignal.')
      }
    } catch (err: any) {
      toast.error('Erro de conexão ao executar limpeza: ' + err.message)
    } finally {
      setIsExecutingBatch(false)
    }
  }

  // Excluir 1 aparelho individualmente direto da linha
  const handleDeleteSingleDevice = async (dev: OneSignalFleetDevice) => {
    setDeletingSubId(dev.id)
    try {
      const res = await fetch('/api/agenda/push/test', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cleanupMode: 'selected_ids',
          subscriptionIds: [dev.id],
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        toast.success(`Aparelho "${dev.model}" (${dev.ownerName}) removido do OneSignal!`)
        setSelectedIds(prev => {
          const next = new Set(prev)
          next.delete(dev.id)
          return next
        })
        await fetchOverview(true)
      } else {
        toast.error(data.error || 'Falha ao excluir aparelho.')
      }
    } catch (err: any) {
      toast.error('Erro ao excluir aparelho: ' + err.message)
    } finally {
      setDeletingSubId(null)
    }
  }

  // Testar push diretamente para 1 aparelho específico da tabela
  const handleSendQuickTestToDevice = async (dev: OneSignalFleetDevice) => {
    setTestingSubId(dev.id)
    try {
      const res = await fetch('/api/agenda/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetSubscriptionId: dev.id,
          title: '🔔 Teste Direto de Aparelho',
          message: `Olá ${dev.ownerName.split(' ')[0]}! Verificação de entrega push no seu ${dev.model} realizada com sucesso.`,
          type: 'test',
          bypassDedup: true,
          bypassPause: true,
        }),
      })
      const data = await res.json()
      if (res.ok && data.ok) {
        toast.success(`Push de teste enviado para ${dev.model} (${dev.ownerName})!`)
      } else {
        toast.error(data.error || data.warning || 'O aparelho não aceitou a notificação.')
      }
    } catch (err: any) {
      toast.error('Erro ao disparar teste: ' + err.message)
    } finally {
      setTestingSubId(null)
    }
  }

  const selectedActiveCount = useMemo(() => {
    let count = 0
    for (const d of allDevices) {
      if (selectedIds.has(d.id) && d.isSubscribed) count++
    }
    return count
  }, [allDevices, selectedIds])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        dialog.onesignal-cleanup-dialog:modal {
          overscroll-behavior: contain;
          border: 1px solid hsl(var(--border-subtle));
          border-radius: 20px;
          background: hsl(var(--bg-surface));
          color: hsl(var(--text-main));
          padding: 0;
          max-width: 600px;
          width: calc(100% - 32px);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45);
        }
        dialog.onesignal-cleanup-dialog::backdrop {
          overflow: hidden;
          overscroll-behavior: contain;
          background: rgba(15, 23, 42, 0.72);
          backdrop-filter: blur(4px);
        }
        .os-fleet-table-wrapper {
          overflow: auto;
          max-inline-size: 100%;
          max-block-size: min(680px, 82vh);
          container-type: inline-size;
          border-radius: 14px;
          border: 1px solid hsl(var(--border-subtle));
          background: hsl(var(--bg-surface));
        }
        .os-fleet-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 12.5px;
          --label-device: "Aparelho";
          --label-status: "Status Push";
          --label-usage: "Último Uso";
          --label-diag: "Diagnóstico";
          --label-actions: "Ações";
        }
        .os-fleet-table thead {
          position: sticky;
          inset-block-start: 0;
          z-index: 3;
          background: hsl(var(--bg-main));
        }
        .os-fleet-table thead th {
          padding: 11px 14px;
          text-align: left;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: hsl(var(--text-muted));
          border-bottom: 1px solid hsl(var(--border-subtle));
          white-space: nowrap;
        }
        .os-fleet-table tbody tr {
          transition: background 0.12s;
        }
        .os-fleet-table tbody tr:hover {
          background: rgba(99, 102, 241, 0.04);
        }
        .os-fleet-table tbody th,
        .os-fleet-table tbody td {
          padding: 12px 14px;
          border-bottom: 1px solid hsl(var(--border-subtle));
          vertical-align: middle;
          text-align: left;
        }
        .os-fleet-table tbody th {
          position: sticky;
          inset-inline-start: 0;
          z-index: 1;
          background: hsl(var(--bg-surface));
          font-weight: 600;
        }
        @container (width < 760px) {
          .os-fleet-table,
          .os-fleet-table thead,
          .os-fleet-table tbody,
          .os-fleet-table tr,
          .os-fleet-table th,
          .os-fleet-table td {
            display: block;
          }
          .os-fleet-table thead {
            display: none;
          }
          .os-fleet-table tbody tr {
            margin: 10px;
            border: 1px solid hsl(var(--border-subtle));
            border-radius: 14px;
            overflow: hidden;
            background: hsl(var(--bg-main));
          }
          .os-fleet-table tbody th {
            position: sticky;
            inset-block-start: 0;
            z-index: 2;
            background: hsl(var(--bg-surface));
            border-bottom: 1px solid hsl(var(--border-subtle));
          }
          .os-fleet-table tbody td {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            padding: 9px 14px;
          }
          .os-fleet-table tbody td:nth-child(2)::before {
            content: var(--label-device) ": ";
            font-weight: 700;
            font-size: 11px;
            color: hsl(var(--text-muted));
          }
          .os-fleet-table tbody td:nth-child(3)::before {
            content: var(--label-status) ": ";
            font-weight: 700;
            font-size: 11px;
            color: hsl(var(--text-muted));
          }
          .os-fleet-table tbody td:nth-child(4)::before {
            content: var(--label-usage) ": ";
            font-weight: 700;
            font-size: 11px;
            color: hsl(var(--text-muted));
          }
          .os-fleet-table tbody td:nth-child(5)::before {
            content: var(--label-diag) ": ";
            font-weight: 700;
            font-size: 11px;
            color: hsl(var(--text-muted));
          }
        }
      `,
        }}
      />

      {/* ── 1. KPIS DE ACESSOS & APARELHOS ATIVOS NO ONESIGNAL ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 14,
        }}
      >
        {/* Card 1: Aparelhos Ativos */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, hsl(var(--bg-surface)) 100%)',
            border: '1.5px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: '#059669',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}
            >
              Aparelhos Ativos (Push ON)
            </span>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.18)',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle2 size={16} />
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              style={{
                fontSize: 30,
                fontWeight: 900,
                fontFamily: 'Outfit, sans-serif',
                color: '#059669',
                lineHeight: 1,
              }}
            >
              {isLoading ? '...' : summary.activeDevices}
            </span>
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
              de {summary.totalDevices} registrados
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 6,
                background: 'hsl(var(--bg-main))',
                border: '1px solid hsl(var(--border-subtle))',
              }}
            >
              🍏 {summary.byPlatform.ios.active} iOS
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 6,
                background: 'hsl(var(--bg-main))',
                border: '1px solid hsl(var(--border-subtle))',
              }}
            >
              🤖 {summary.byPlatform.android.active} Android
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 6,
                background: 'hsl(var(--bg-main))',
                border: '1px solid hsl(var(--border-subtle))',
              }}
            >
              💻 {summary.byPlatform.web.active} Web
            </span>
          </div>
        </div>

        {/* Card 2: Pessoas Conectadas */}
        <div
          style={{
            background: 'hsl(var(--bg-surface))',
            border: '1px solid hsl(var(--border-subtle))',
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: 'hsl(var(--text-muted))',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}
            >
              Usuários com Push Ativo
            </span>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(99, 102, 241, 0.12)',
                color: '#6366f1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={16} />
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 30,
                fontWeight: 900,
                fontFamily: 'Outfit, sans-serif',
                color: 'hsl(var(--text-main))',
                lineHeight: 1,
              }}
            >
              {isLoading ? '...' : summary.uniqueUsersWithActivePush}
            </span>
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
              contas únicas
            </span>
          </div>

          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>👨‍👩‍👧 {summary.byCategory.activeFamily} famílias ativas</span>
            <span>•</span>
            <span>👔 {summary.byCategory.activeStaff} equipe</span>
          </div>
        </div>

        {/* Card 3: Alunos Inativos & Sem Uso */}
        <div
          style={{
            background: 'hsl(var(--bg-surface))',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: '#d97706',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}
            >
              Alunos Inativos & Sem Uso
            </span>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(245, 158, 11, 0.14)',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <UserX size={16} />
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 30,
                fontWeight: 900,
                fontFamily: 'Outfit, sans-serif',
                color: '#d97706',
                lineHeight: 1,
              }}
            >
              {isLoading ? '...' : summary.byCategory.inactiveStudents + summary.byCategory.unused60dNonStaff}
            </span>
            <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
              aparelhos ociosos
            </span>
          </div>

          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span>🎓 {summary.byCategory.inactiveStudents} alunos inativos</span>
            <span>•</span>
            <span>⏳ {summary.byCategory.unused60dNonStaff} sem uso (+60d)</span>
          </div>
        </div>

        {/* Card 4: Liberação Rápida de Acessos */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
            border: '1.5px solid rgba(99, 102, 241, 0.4)',
            borderRadius: 16,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 800,
                color: '#4f46e5',
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
              }}
            >
              Acessos p/ Liberar Agora
            </span>
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: '#4f46e5',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap size={15} />
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span
              style={{
                fontSize: 30,
                fontWeight: 900,
                fontFamily: 'Outfit, sans-serif',
                color: '#4f46e5',
                lineHeight: 1,
              }}
            >
              {isLoading ? '...' : summary.byCategory.recommendedCleanupTotal}
            </span>
            <span style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
              ({summary.byCategory.recommendedActiveSlotsFreed} ativos no push)
            </span>
          </div>

          <button
            type="button"
            onClick={() => openCleanupModal('smart_all')}
            disabled={isLoading || summary.byCategory.recommendedCleanupTotal === 0 || isExecutingBatch}
            style={{
              width: '100%',
              padding: '7px 12px',
              borderRadius: 9,
              border: 'none',
              background: summary.byCategory.recommendedCleanupTotal > 0 ? '#4f46e5' : 'rgba(100, 116, 139, 0.2)',
              color: summary.byCategory.recommendedCleanupTotal > 0 ? 'white' : 'hsl(var(--text-muted))',
              fontSize: 11.5,
              fontWeight: 800,
              cursor: summary.byCategory.recommendedCleanupTotal > 0 ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              transition: 'all 0.15s',
            }}
          >
            <Sparkles size={13} />
            {summary.byCategory.recommendedCleanupTotal > 0
              ? `Liberar ${summary.byCategory.recommendedCleanupTotal} Acessos (1-Clique)`
              : 'OneSignal 100% Otimizado'}
          </button>
        </div>
      </div>

      {/* ── 2. CENTRAL DE LIMPEZA INTELIGENTE POR CATEGORIA ── */}
      <div
        style={{
          background: 'hsl(var(--bg-surface))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 18,
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
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
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Sparkles size={17} color="#6366f1" />
              Assistente de Higienização & Liberação de Acessos no OneSignal
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
              Exclua quem não usa mais o aplicativo, alunos inativos, sessões duplicadas e registros órfãos sem afetar quem está ativo.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchOverview(false)}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 13px',
              borderRadius: 10,
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-main))',
              color: 'hsl(var(--text-main))',
              fontSize: 12,
              fontWeight: 700,
              cursor: isLoading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            Recarregar Diagnóstico
          </button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 12,
          }}
        >
          {/* Ação 1: Alunos Inativos */}
          <div
            style={{
              borderRadius: 14,
              border: '1px solid rgba(239, 68, 68, 0.28)',
              background: 'rgba(239, 68, 68, 0.04)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <GraduationCap size={15} /> Alunos Inativos / Egressos
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#dc2626',
                  }}
                >
                  {summary.byCategory.inactiveStudents} aparelhos
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', margin: '6px 0 0', lineHeight: 1.4 }}>
                Remove aparelhos de alunos transferidos/inativos e de seus responsáveis.{' '}
                <strong style={{ color: 'hsl(var(--text-main))' }}>Preserva pais com outro filho ativo e colaboradores.</strong>
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => setActiveFilterTab('inactive_students')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-surface))',
                  color: 'hsl(var(--text-main))',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Filtrar ({summary.byCategory.inactiveStudents})
              </button>
              <button
                type="button"
                onClick={() => openCleanupModal('inactive_students')}
                disabled={summary.byCategory.inactiveStudents === 0 || isExecutingBatch}
                style={{
                  flex: 1.3,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: summary.byCategory.inactiveStudents > 0 ? '#dc2626' : 'rgba(100,116,139,0.2)',
                  color: summary.byCategory.inactiveStudents > 0 ? 'white' : 'hsl(var(--text-muted))',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: summary.byCategory.inactiveStudents > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Trash2 size={12} /> Limpar Inativos
              </button>
            </div>
          </div>

          {/* Ação 2: Quem Não Usa (Inativos por Tempo) */}
          <div
            style={{
              borderRadius: 14,
              border: '1px solid rgba(245, 158, 11, 0.35)',
              background: 'rgba(245, 158, 11, 0.05)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#d97706', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={15} /> Quem Não Usa o App
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: 'rgba(245, 158, 11, 0.18)',
                    color: '#b45309',
                  }}
                >
                  {unusedMatchingDevices.length} aparelhos
                </span>
              </div>

              {/* Seletor de dias sem acesso */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                {[30, 60, 90, 180].map(days => {
                  const active = unusedThresholdDays === days
                  return (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setUnusedThresholdDays(days)}
                      style={{
                        flex: 1,
                        padding: '3px 4px',
                        borderRadius: 6,
                        fontSize: 10.5,
                        fontWeight: active ? 800 : 600,
                        border: active ? '1px solid #d97706' : '1px solid hsl(var(--border-subtle))',
                        background: active ? '#d97706' : 'hsl(var(--bg-surface))',
                        color: active ? 'white' : 'hsl(var(--text-muted))',
                        cursor: 'pointer',
                      }}
                    >
                      +{days}d
                    </button>
                  )
                })}
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: 'hsl(var(--text-muted))',
                  marginTop: 6,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={protectStaffOnUnused}
                  onChange={e => setProtectStaffOnUnused(e.target.checked)}
                  style={{ accentColor: '#d97706' }}
                />
                <span>Preservar equipe/colaboradores</span>
              </label>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => setActiveFilterTab('unused')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-surface))',
                  color: 'hsl(var(--text-main))',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Filtrar ({unusedMatchingDevices.length})
              </button>
              <button
                type="button"
                onClick={() => openCleanupModal('unused')}
                disabled={unusedMatchingDevices.length === 0 || isExecutingBatch}
                style={{
                  flex: 1.3,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: unusedMatchingDevices.length > 0 ? '#d97706' : 'rgba(100,116,139,0.2)',
                  color: unusedMatchingDevices.length > 0 ? 'white' : 'hsl(var(--text-muted))',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: unusedMatchingDevices.length > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Trash2 size={12} /> Excluir +{unusedThresholdDays}d
              </button>
            </div>
          </div>

          {/* Ação 3: Sessões Duplicadas / Antigas */}
          <div
            style={{
              borderRadius: 14,
              border: '1px solid rgba(59, 130, 246, 0.3)',
              background: 'rgba(59, 130, 246, 0.04)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#2563eb', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Layers size={15} /> Duplicados / Antigos
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#2563eb',
                  }}
                >
                  {summary.byCategory.duplicatesStale} aparelhos
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', margin: '6px 0 0', lineHeight: 1.4 }}>
                Mantém o celular principal mais recente de cada usuário e limpa registros antigos de reinstalações.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => setActiveFilterTab('duplicates')}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-surface))',
                  color: 'hsl(var(--text-main))',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Filtrar ({summary.byCategory.duplicatesStale})
              </button>
              <button
                type="button"
                onClick={() => openCleanupModal('duplicates')}
                disabled={summary.byCategory.duplicatesStale === 0 || isExecutingBatch}
                style={{
                  flex: 1.3,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: 'none',
                  background: summary.byCategory.duplicatesStale > 0 ? '#2563eb' : 'rgba(100,116,139,0.2)',
                  color: summary.byCategory.duplicatesStale > 0 ? 'white' : 'hsl(var(--text-muted))',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: summary.byCategory.duplicatesStale > 0 ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}
              >
                <Trash2 size={12} /> Limpar Duplicados
              </button>
            </div>
          </div>

          {/* Ação 4: Órfãos e Desativados */}
          <div
            style={{
              borderRadius: 14,
              border: '1px solid rgba(139, 92, 246, 0.3)',
              background: 'rgba(139, 92, 246, 0.04)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: '#7c3aed', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Ghost size={15} /> Órfãos & Sem Permissão
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#7c3aed',
                  }}
                >
                  {summary.byCategory.orphans + summary.byCategory.disabledPush} registros
                </span>
              </div>
              <p style={{ fontSize: 11.5, color: 'hsl(var(--text-muted))', margin: '6px 0 0', lineHeight: 1.4 }}>
                {summary.byCategory.orphans} anônimos/órfãos e {summary.byCategory.disabledPush} com push bloqueado ou app desinstalado.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => openCleanupModal('orphans')}
                disabled={summary.byCategory.orphans === 0 || isExecutingBatch}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: '1px solid rgba(139, 92, 246, 0.35)',
                  background: 'hsl(var(--bg-surface))',
                  color: summary.byCategory.orphans > 0 ? '#7c3aed' : 'hsl(var(--text-muted))',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: summary.byCategory.orphans > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                Órfãos ({summary.byCategory.orphans})
              </button>
              <button
                type="button"
                onClick={() => openCleanupModal('disabled')}
                disabled={summary.byCategory.disabledPush === 0 || isExecutingBatch}
                style={{
                  flex: 1.2,
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: 'none',
                  background: summary.byCategory.disabledPush > 0 ? '#7c3aed' : 'rgba(100,116,139,0.2)',
                  color: summary.byCategory.disabledPush > 0 ? 'white' : 'hsl(var(--text-muted))',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: summary.byCategory.disabledPush > 0 ? 'pointer' : 'not-allowed',
                }}
              >
                Sem Push ({summary.byCategory.disabledPush})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 3. FILTROS, BUSCA E SELEÇÃO EM LOTE DA TABELA ── */}
      <div
        style={{
          background: 'hsl(var(--bg-surface))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 18,
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Abas rápidas de filtro */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: 'Todos Registrados', count: summary.totalDevices, color: '#6366f1' },
            { id: 'recommended', label: '⚡ Sugeridos p/ Limpar', count: summary.byCategory.recommendedCleanupTotal, color: '#4f46e5' },
            { id: 'active', label: '🟢 Ativos (Recebendo Push)', count: summary.activeDevices, color: '#059669' },
            { id: 'inactive_students', label: '🎓 Alunos Inativos', count: summary.byCategory.inactiveStudents, color: '#dc2626' },
            { id: 'unused', label: `⏳ Sem Uso (+${unusedThresholdDays}d)`, count: unusedMatchingDevices.length, color: '#d97706' },
            { id: 'duplicates', label: '📱 Duplicados', count: summary.byCategory.duplicatesStale, color: '#2563eb' },
            { id: 'orphans', label: '👻 Órfãos / Anônimos', count: summary.byCategory.orphans, color: '#7c3aed' },
            { id: 'disabled', label: '🔴 Push Desativado', count: summary.byCategory.disabledPush, color: '#ef4444' },
          ].map(tab => {
            const active = activeFilterTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilterTab(tab.id as FilterCategoryTab)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: active ? 800 : 600,
                  border: active ? `1.5px solid ${tab.color}` : '1px solid hsl(var(--border-subtle))',
                  background: active ? `${tab.color}15` : 'hsl(var(--bg-main))',
                  color: active ? tab.color : 'hsl(var(--text-muted))',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                <span>{tab.label}</span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 8,
                    background: active ? tab.color : 'rgba(100,116,139,0.15)',
                    color: active ? 'white' : 'inherit',
                  }}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Barra de Pesquisa e Seletores */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            style={{
              flex: '1 1 280px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-main))',
            }}
          >
            <Search size={15} color="hsl(var(--text-muted))" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar por responsável, aluno, turma, colaborador, modelo (iPhone, Samsung) ou Sub ID..."
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: 12.5,
                color: 'hsl(var(--text-main))',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            value={platformFilter}
            onChange={e => setPlatformFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-main))',
              color: 'hsl(var(--text-main))',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="all">Todas Plataformas</option>
            <option value="iOS">🍏 Apple iOS (iPhone/iPad)</option>
            <option value="Android">🤖 Google Android</option>
            <option value="Web">💻 Navegador Web (PC/Mac)</option>
          </select>

          <select
            value={ownerTypeFilter}
            onChange={e => setOwnerTypeFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-main))',
              color: 'hsl(var(--text-main))',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="all">Todos os Perfis</option>
            <option value="responsavel">👨‍👩‍👧 Responsáveis / Família</option>
            <option value="aluno">🎓 Alunos (Acesso Direto)</option>
            <option value="colaborador">👔 Colaboradores / Equipe</option>
            <option value="orfao">👻 Órfãos / Sem Conta</option>
          </select>

          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid hsl(var(--border-subtle))',
              background: 'hsl(var(--bg-main))',
              color: 'hsl(var(--text-main))',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value="priority">Ordenar: Prioridade de Limpeza</option>
            <option value="inactive_desc">Ordenar: Mais Tempo Sem Usar</option>
            <option value="active_recent">Ordenar: Uso Mais Recente</option>
            <option value="sessions_desc">Ordenar: Mais Sessões no App</option>
            <option value="name_asc">Ordenar: Nome (A-Z)</option>
          </select>
        </div>

        {/* Barra de Seleção Múltipla (aparece quando há itens selecionados) */}
        {selectedIds.size > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              padding: '10px 16px',
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1.5px solid rgba(239, 68, 68, 0.35)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, fontWeight: 700 }}>
              <span
                style={{
                  padding: '2px 9px',
                  borderRadius: 8,
                  background: '#dc2626',
                  color: 'white',
                  fontWeight: 800,
                }}
              >
                {selectedIds.size} selecionado(s)
              </span>
              <span>
                {selectedActiveCount > 0
                  ? `Liberará ${selectedActiveCount} acesso(s) ativo(s) no OneSignal`
                  : 'Registros desativados selecionados para limpeza'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                style={{
                  padding: '6px 12px',
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-surface))',
                  color: 'hsl(var(--text-main))',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Desmarcar tudo
              </button>
              <button
                type="button"
                onClick={() => openCleanupModal('selected_ids')}
                disabled={isExecutingBatch}
                style={{
                  padding: '7px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: '#dc2626',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Trash2 size={13} />
                Excluir {selectedIds.size} Selecionado(s)
              </button>
            </div>
          </div>
        )}

        {/* Tabela Responsiva Semântica */}
        <div
          tabIndex={0}
          role="region"
          aria-label="Aparelhos registrados no OneSignal"
          className="os-fleet-table-wrapper"
        >
          {isLoading ? (
            <div
              style={{
                padding: '50px 20px',
                textAlign: 'center',
                color: 'hsl(var(--text-muted))',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <RefreshCw size={24} color="#6366f1" className="animate-spin" />
              <div style={{ fontWeight: 700, fontSize: 14, color: 'hsl(var(--text-main))' }}>
                Auditando aparelhos em tempo real no OneSignal...
              </div>
              <div style={{ fontSize: 12 }}>
                Cruzando tokens, histórico de último uso e vínculos de alunos ativos e inativos.
              </div>
            </div>
          ) : filteredDevices.length === 0 ? (
            <div style={{ padding: '50px 20px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              <Smartphone size={32} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
              <div style={{ fontWeight: 700, fontSize: 14, color: 'hsl(var(--text-main))' }}>
                Nenhum aparelho encontrado neste filtro
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Experimente trocar a aba de categoria acima ou limpar o campo de busca.
              </div>
            </div>
          ) : (
            <table className="os-fleet-table">
              <thead>
                <tr>
                  <th>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={
                          filteredDevices.length > 0 &&
                          filteredDevices.every(d => selectedIds.has(d.id))
                        }
                        onChange={toggleSelectAllFiltered}
                        style={{ accentColor: '#4f46e5', width: 15, height: 15, cursor: 'pointer' }}
                      />
                      <span>Usuário / Vínculo Escolar ({filteredDevices.length})</span>
                    </label>
                  </th>
                  <th>Aparelho & Plataforma</th>
                  <th>Status no OneSignal</th>
                  <th>Último Uso no App</th>
                  <th>Diagnóstico / Acesso</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDevices.map(dev => {
                  const isChecked = selectedIds.has(dev.id)
                  const isCurrentBrowserDevice = Boolean(currentDeviceSubId && dev.id === currentDeviceSubId)

                  return (
                    <tr
                      key={dev.id}
                      style={{
                        background: isChecked
                          ? 'rgba(99, 102, 241, 0.08)'
                          : isCurrentBrowserDevice
                          ? 'rgba(14, 165, 233, 0.06)'
                          : undefined,
                      }}
                    >
                      {/* Coluna 1 (Sticky Row Header): Usuário e Vínculo de Alunos */}
                      <th scope="row">
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelectOne(dev.id)}
                            style={{
                              accentColor: '#4f46e5',
                              width: 15,
                              height: 15,
                              marginTop: 6,
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          />
                          <UserAvatar
                            name={dev.ownerName}
                            fotoUrl={dev.ownerFoto || undefined}
                            size={34}
                          />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 800, fontSize: 13, color: 'hsl(var(--text-main))' }}>
                                {dev.ownerName}
                              </span>
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 800,
                                  padding: '1px 6px',
                                  borderRadius: 5,
                                  textTransform: 'uppercase',
                                  background:
                                    dev.ownerType === 'colaborador'
                                      ? 'rgba(16, 185, 129, 0.14)'
                                      : dev.ownerType === 'responsavel'
                                      ? 'rgba(99, 102, 241, 0.14)'
                                      : dev.ownerType === 'aluno'
                                      ? 'rgba(14, 165, 233, 0.14)'
                                      : 'rgba(245, 158, 11, 0.15)',
                                  color:
                                    dev.ownerType === 'colaborador'
                                      ? '#059669'
                                      : dev.ownerType === 'responsavel'
                                      ? '#4f46e5'
                                      : dev.ownerType === 'aluno'
                                      ? '#0284c7'
                                      : '#d97706',
                                }}
                              >
                                {dev.ownerRole}
                              </span>
                              {isCurrentBrowserDevice && (
                                <span
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 800,
                                    padding: '1px 6px',
                                    borderRadius: 5,
                                    background: '#0ea5e9',
                                    color: 'white',
                                  }}
                                >
                                  ESTE APARELHO
                                </span>
                              )}
                            </div>

                            {dev.ownerEmail && (
                              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 1 }}>
                                {dev.ownerEmail}
                              </div>
                            )}

                            {/* Alunos Vinculados */}
                            {dev.linkedStudents.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                                {dev.linkedStudents.map(st => (
                                  <span
                                    key={st.id}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      fontSize: 10.5,
                                      fontWeight: 700,
                                      padding: '2px 7px',
                                      borderRadius: 6,
                                      background: st.isInactive
                                        ? 'rgba(239, 68, 68, 0.12)'
                                        : 'rgba(16, 185, 129, 0.1)',
                                      color: st.isInactive ? '#dc2626' : '#059669',
                                      border: `1px solid ${
                                        st.isInactive ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'
                                      }`,
                                    }}
                                  >
                                    🎓 {st.friendlyName} ({st.turma})
                                    {st.isInactive && (
                                      <strong style={{ textTransform: 'uppercase', fontSize: 9 }}>
                                        • {st.status}
                                      </strong>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}

                            {dev.isProtected && dev.protectionReason && (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  color: '#059669',
                                  marginTop: 4,
                                }}
                              >
                                <Shield size={11} /> {dev.protectionReason}
                              </div>
                            )}
                          </div>
                        </div>
                      </th>

                      {/* Coluna 2: Aparelho & Plataforma */}
                      <td>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                            <span>
                              {dev.platform === 'iOS' ? '🍏' : dev.platform === 'Android' ? '🤖' : '💻'}
                            </span>
                            <span>{dev.model}</span>
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'hsl(var(--text-muted))',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 2,
                              flexWrap: 'wrap',
                            }}
                          >
                            <span>{dev.os}</span>
                            {dev.appVersion && <span>• v{dev.appVersion}</span>}
                            <button
                              type="button"
                              onClick={() => handleCopy(dev.id, 'Subscription ID')}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                background: 'hsl(var(--bg-main))',
                                border: '1px solid hsl(var(--border-subtle))',
                                borderRadius: 4,
                                padding: '0px 5px',
                                fontSize: 10,
                                fontFamily: 'monospace',
                                color: 'hsl(var(--text-muted))',
                                cursor: 'pointer',
                              }}
                              title={`Copiar Sub ID: ${dev.id}`}
                            >
                              {dev.id.slice(0, 8)}...
                              {copiedId === dev.id ? <Check size={10} color="#10b981" /> : <Copy size={10} />}
                            </button>
                          </div>
                          {dev.userTotalDevices > 1 && (
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: dev.deviceRankInUser === 1 ? '#059669' : '#2563eb',
                                marginTop: 2,
                              }}
                            >
                              {dev.deviceRankInUser === 1
                                ? `★ Aparelho Principal (1º de ${dev.userTotalDevices})`
                                : `${dev.deviceRankInUser}º de ${dev.userTotalDevices} aparelhos deste usuário`}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Coluna 3: Status Push */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              width: 'fit-content',
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: dev.isSubscribed
                                ? 'rgba(16, 185, 129, 0.14)'
                                : 'rgba(239, 68, 68, 0.12)',
                              color: dev.isSubscribed ? '#059669' : '#dc2626',
                            }}
                          >
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: dev.isSubscribed ? '#10b981' : '#ef4444',
                              }}
                            />
                            {dev.isSubscribed ? 'Ativo (Inscrito)' : 'Desativado'}
                          </span>
                          <span style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))' }}>
                            {dev.statusLabel}
                          </span>
                        </div>
                      </td>

                      {/* Coluna 4: Último Uso */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              fontWeight: 800,
                              color:
                                dev.daysInactive <= 7
                                  ? '#059669'
                                  : dev.daysInactive < 30
                                  ? 'hsl(var(--text-main))'
                                  : dev.daysInactive < 60
                                  ? '#d97706'
                                  : '#dc2626',
                            }}
                          >
                            {dev.daysInactive === 0
                              ? 'Hoje'
                              : dev.daysInactive === 1
                              ? 'Ontem'
                              : dev.daysInactive >= 900
                              ? 'Sem registro'
                              : `Há ${dev.daysInactive} dias`}
                          </span>
                          <span style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))' }}>
                            {dev.lastActiveAt
                              ? new Date(dev.lastActiveAt).toLocaleDateString('pt-BR')
                              : '—'}{' '}
                            • {dev.sessionCount} {dev.sessionCount === 1 ? 'sessão' : 'sessões'}
                          </span>
                        </div>
                      </td>

                      {/* Coluna 5: Diagnóstico / Motivo */}
                      <td>
                        {dev.primaryCleanupBadge ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 10.5,
                              fontWeight: 800,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background:
                                dev.primaryCleanupBadge.tone === 'danger'
                                  ? 'rgba(239, 68, 68, 0.14)'
                                  : dev.primaryCleanupBadge.tone === 'warning'
                                  ? 'rgba(245, 158, 11, 0.16)'
                                  : dev.primaryCleanupBadge.tone === 'info'
                                  ? 'rgba(59, 130, 246, 0.14)'
                                  : 'rgba(100, 116, 139, 0.14)',
                              color:
                                dev.primaryCleanupBadge.tone === 'danger'
                                  ? '#dc2626'
                                  : dev.primaryCleanupBadge.tone === 'warning'
                                  ? '#b45309'
                                  : dev.primaryCleanupBadge.tone === 'info'
                                  ? '#2563eb'
                                  : 'hsl(var(--text-muted))',
                            }}
                          >
                            {dev.primaryCleanupBadge.label}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: '#059669',
                            }}
                          >
                            <CheckCircle2 size={12} /> Em uso regular
                          </span>
                        )}
                      </td>

                      {/* Coluna 6: Ações */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {dev.isSubscribed && (
                            <button
                              type="button"
                              onClick={() => handleSendQuickTestToDevice(dev)}
                              disabled={testingSubId === dev.id}
                              style={{
                                padding: '5px 9px',
                                borderRadius: 7,
                                border: '1px solid rgba(99, 102, 241, 0.35)',
                                background: 'rgba(99, 102, 241, 0.1)',
                                color: '#4f46e5',
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: testingSubId === dev.id ? 'not-allowed' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                              title="Enviar um push de teste diretamente para este aparelho"
                            >
                              <Send size={11} />
                              {testingSubId === dev.id ? '...' : 'Testar'}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDeleteSingleDevice(dev)}
                            disabled={deletingSubId === dev.id}
                            style={{
                              padding: '5px 9px',
                              borderRadius: 7,
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              background: 'rgba(239, 68, 68, 0.08)',
                              color: '#ef4444',
                              fontSize: 11,
                              fontWeight: 700,
                              cursor: deletingSubId === dev.id ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            title="Excluir este aparelho do OneSignal e liberar o acesso"
                          >
                            <Trash2 size={11} />
                            {deletingSubId === dev.id ? '...' : 'Excluir'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação */}
        {filteredDevices.length > pageSize && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 10,
              paddingTop: 4,
              fontSize: 12,
              color: 'hsl(var(--text-muted))',
            }}
          >
            <div>
              Exibindo <b>{(page - 1) * pageSize + 1}</b> a{' '}
              <b>{Math.min(page * pageSize, filteredDevices.length)}</b> de{' '}
              <b>{filteredDevices.length}</b> aparelhos
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-main))',
                  color: 'hsl(var(--text-main))',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer',
                  opacity: page <= 1 ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <ChevronLeft size={14} /> Anterior
              </button>
              <span style={{ fontWeight: 700, padding: '0 8px' }}>
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-main))',
                  color: 'hsl(var(--text-main))',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                  opacity: page >= totalPages ? 0.5 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Próxima <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. MODAL NATIVO (<dialog>) DE CONFIRMAÇÃO DE LIMPEZA EM LOTE ── */}
      <dialog ref={confirmDialogRef} className="onesignal-cleanup-dialog">
        {pendingCleanupAction && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid hsl(var(--border-subtle))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.14)',
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, fontFamily: 'Outfit, sans-serif' }}>
                    {pendingCleanupAction.title}
                  </h3>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                    Confirmação de exclusão e liberação de acessos no OneSignal
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeCleanupModal}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'hsl(var(--text-muted))',
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'hsl(var(--text-main))' }}>
                {pendingCleanupAction.description}
              </p>

              {/* Resumo de impacto */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                  padding: 12,
                  borderRadius: 12,
                  background: 'hsl(var(--bg-main))',
                  border: '1px solid hsl(var(--border-subtle))',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>
                    Total a Remover:
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#dc2626' }}>
                    {pendingCleanupAction.targetDevices.length} aparelho(s)
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>
                    Acessos Ativos Liberados:
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#059669' }}>
                    {pendingCleanupAction.targetDevices.filter(d => d.isSubscribed).length} ativo(s)
                  </div>
                </div>
              </div>

              {/* Amostra dos aparelhos que serão excluídos */}
              <div>
                <div style={{ fontSize: 11.5, fontWeight: 800, marginBottom: 6, color: 'hsl(var(--text-muted))' }}>
                  Amostra dos aparelhos que serão removidos:
                </div>
                <div
                  style={{
                    maxHeight: 190,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    paddingRight: 4,
                  }}
                >
                  {pendingCleanupAction.targetDevices.slice(0, 12).map(dev => (
                    <div
                      key={dev.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        padding: '7px 10px',
                        borderRadius: 8,
                        background: 'hsl(var(--bg-main))',
                        border: '1px solid hsl(var(--border-subtle))',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {dev.ownerName} • <span style={{ fontWeight: 600 }}>{dev.model}</span>
                        </div>
                        <div style={{ fontSize: 10.5, color: 'hsl(var(--text-muted))' }}>
                          {dev.linkedStudents.length > 0
                            ? `Aluno: ${dev.linkedStudents.map(s => `${s.friendlyName} (${s.status})`).join(', ')}`
                            : dev.ownerRole}{' '}
                          • Último uso: {dev.daysInactive >= 900 ? 'Sem registro' : `há ${dev.daysInactive}d`}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 5,
                          background: 'rgba(239, 68, 68, 0.14)',
                          color: '#dc2626',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {dev.primaryCleanupBadge?.label || 'Selecionado'}
                      </span>
                    </div>
                  ))}
                  {pendingCleanupAction.targetDevices.length > 12 && (
                    <div style={{ fontSize: 11, textAlign: 'center', color: 'hsl(var(--text-muted))', padding: 4 }}>
                      + {pendingCleanupAction.targetDevices.length - 12} outros aparelhos...
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid hsl(var(--border-subtle))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 10,
                background: 'hsl(var(--bg-main))',
              }}
            >
              <button
                type="button"
                onClick={closeCleanupModal}
                disabled={isExecutingBatch}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid hsl(var(--border-subtle))',
                  background: 'hsl(var(--bg-surface))',
                  color: 'hsl(var(--text-main))',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={executeConfirmedCleanup}
                disabled={isExecutingBatch}
                style={{
                  padding: '8px 18px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#dc2626',
                  color: 'white',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: isExecutingBatch ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isExecutingBatch ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Excluindo no OneSignal...
                  </>
                ) : (
                  <>
                    <Trash2 size={14} /> Confirmar e Excluir ({pendingCleanupAction.targetDevices.length})
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}
