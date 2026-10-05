'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  History,
  Search,
  Filter,
  Trash2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Download,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  Shield,
  Layers,
  ArrowRight,
  Eye,
  Sliders,
  Sparkles,
  Info,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Send,
  PlusCircle,
  Edit3,
  MinusCircle,
  DollarSign,
  KeyRound,
  CheckCircle,
  Copy,
  Check
} from 'lucide-react'
import { useApp } from '@/lib/context'
import { toast } from 'sonner'

interface SystemLog {
  id: string
  dataHora: string
  usuarioNome: string
  perfil: string
  modulo: string
  acao: string
  descricao: string
  status: string
  origem: string
  registroId: string | null
  nomeRelacionado: string | null
  detalhesAntes: any
  detalhesDepois: any
}

interface AuditSettings {
  paused: boolean
  auto_delete_enabled: boolean
  auto_delete_days: number
  last_cleanup_at?: string
}

export default function LogsAuditoriaPage() {
  const { currentUserPerfil } = useApp()
  const isAdmin =
    currentUserPerfil === 'Administrador' ||
    currentUserPerfil === 'Diretor Geral' ||
    currentUserPerfil === 'Admin' ||
    currentUserPerfil === 'Master' ||
    currentUserPerfil === 'Administrador Master'

  // Estados principais
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [settings, setSettings] = useState<AuditSettings>({
    paused: false,
    auto_delete_enabled: true,
    auto_delete_days: 90,
  })
  const [storageStats, setStorageStats] = useState<{
    totalLogs: number
    performanceLogs: number
    businessLogs: number
    oldestLogDate: string | null
  }>({
    totalLogs: 0,
    performanceLogs: 0,
    businessLogs: 0,
    oldestLogDate: null,
  })

  // Filtros
  const [search, setSearch] = useState('')
  const [selectedModulo, setSelectedModulo] = useState('todos')
  const [selectedAcao, setSelectedAcao] = useState('todos')
  const [selectedPerfil, setSelectedPerfil] = useState('todos')
  const [periodo, setPeriodo] = useState('30') // 'hoje' | '7' | '30' | '90' | 'todos' | 'custom'
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Modais
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<SystemLog | null>(null)
  const [modalTab, setModalTab] = useState<'formatted' | 'raw'>('formatted')
  const [copiedRaw, setCopiedRaw] = useState(false)
  const [showOnlyChanged, setShowOnlyChanged] = useState(true)
  const [resolvingPrevious, setResolvingPrevious] = useState(false)
  const [resolvedAntes, setResolvedAntes] = useState<any>(null)
  const [isRetentionModalOpen, setIsRetentionModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isPauseConfirmOpen, setIsPauseConfirmOpen] = useState(false)
  const [isPurgingLegacy, setIsPurgingLegacy] = useState(false)

  // Configurações do formulário do Modal de Retenção
  const [retentionDaysInput, setRetentionDaysInput] = useState(90)
  const [retentionEnabledInput, setRetentionEnabledInput] = useState(true)

  // Configurações do Modal de Exclusão Manual
  const [deleteMode, setDeleteMode] = useState<'days' | 'beforeDate' | 'range'>('days')
  const [deleteDaysValue, setDeleteDaysValue] = useState(90)
  const [deleteBeforeDateValue, setDeleteBeforeDateValue] = useState('')
  const [deleteStartDateValue, setDeleteStartDateValue] = useState('')
  const [deleteEndDateValue, setDeleteEndDateValue] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  // ── Carregar Dados de Auditoria ──────────────────────────────────────────
  const fetchLogs = useCallback(
    async (targetPage = page) => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('page', String(targetPage))
        params.set('limit', '50')

        if (search.trim()) params.set('search', search.trim())
        if (selectedModulo !== 'todos') params.set('modulo', selectedModulo)
        if (selectedAcao !== 'todos') params.set('acao', selectedAcao)
        if (selectedPerfil !== 'todos') params.set('perfil', selectedPerfil)
        params.set('periodo', periodo)

        if (periodo === 'custom') {
          if (startDate) params.set('startDate', startDate)
          if (endDate) params.set('endDate', endDate)
        }

        const res = await fetch(`/api/system-logs?${params.toString()}`)
        if (!res.ok) {
          throw new Error('Falha ao carregar registros de auditoria.')
        }

        const json = await res.json()
        setLogs(json.logs || [])
        setTotalPages(json.pagination?.totalPages || 1)
        setTotalCount(json.pagination?.total || 0)
        setTodayCount(json.stats?.todayCount || 0)

        if (json.settings) {
          setSettings(json.settings)
          setRetentionDaysInput(json.settings.auto_delete_days || 90)
          setRetentionEnabledInput(json.settings.auto_delete_enabled ?? true)
        }
      } catch (err: any) {
        toast.error(err.message || 'Erro ao carregar logs')
      } finally {
        setLoading(false)
      }
    },
    [page, search, selectedModulo, selectedAcao, selectedPerfil, periodo, startDate, endDate]
  )

  // ── Carregar Status de Configurações e Espaço ─────────────────────────────
  const fetchSettingsAndStats = useCallback(async () => {
    try {
      const res = await fetch('/api/system-logs/settings')
      if (res.ok) {
        const json = await res.json()
        if (json.settings) setSettings(json.settings)
        if (json.stats) setStorageStats(json.stats)
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchLogs(page)
  }, [page, selectedModulo, selectedAcao, selectedPerfil, periodo])

  useEffect(() => {
    fetchSettingsAndStats()
  }, [fetchSettingsAndStats])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchLogs(1)
    }, 400)
    return () => clearTimeout(timer)
  }, [search])

  // ── Resolução Dinâmica de Dados Anteriores para Comparativo (Diff) ──────
  useEffect(() => {
    if (!selectedLogForDetails) {
      setResolvedAntes(null)
      setResolvingPrevious(false)
      setShowOnlyChanged(true)
      return
    }

    setShowOnlyChanged(true)

    // Se o registro já possui detalhesAntes válido, usa imediatamente
    if (
      selectedLogForDetails.detalhesAntes &&
      typeof selectedLogForDetails.detalhesAntes === 'object' &&
      Object.keys(selectedLogForDetails.detalhesAntes).length > 0
    ) {
      setResolvedAntes(selectedLogForDetails.detalhesAntes)
      setResolvingPrevious(false)
      return
    }

    // Se é uma edição/alteração e não tem detalhesAntes, resolve dinamicamente do histórico
    const acaoLower = (selectedLogForDetails.acao || '').toLowerCase()
    const descLower = (selectedLogForDetails.descricao || '').toLowerCase()
    const isEdit =
      acaoLower.includes('edição') ||
      acaoLower.includes('edicao') ||
      acaoLower.includes('alter') ||
      descLower.includes('atualiz') ||
      descLower.includes('edit')

    if (isEdit && selectedLogForDetails.registroId) {
      setResolvingPrevious(true)
      fetch(
        `/api/system-logs?registroId=${encodeURIComponent(
          selectedLogForDetails.registroId
        )}&beforeDate=${encodeURIComponent(selectedLogForDetails.dataHora)}&limit=1&periodo=todos`
      )
        .then(res => res.json())
        .then(json => {
          if (json.logs && json.logs.length > 0 && json.logs[0].detalhesDepois) {
            setResolvedAntes(json.logs[0].detalhesDepois)
          } else {
            setResolvedAntes(null)
          }
        })
        .catch(() => setResolvedAntes(null))
        .finally(() => setResolvingPrevious(false))
    } else {
      setResolvedAntes(null)
      setResolvingPrevious(false)
    }
  }, [selectedLogForDetails])

  // ── Alternar Pausa dos Logs ───────────────────────────────────────────────
  const handleTogglePause = async () => {
    try {
      const newPausedState = !settings.paused
      const res = await fetch('/api/system-logs/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: newPausedState }),
      })
      if (!res.ok) throw new Error('Falha ao atualizar status de gravação.')

      setSettings(prev => ({ ...prev, paused: newPausedState }))
      setIsPauseConfirmOpen(false)
      toast.success(
        newPausedState
          ? 'Auditoria PAUSADA com sucesso! Nenhuma alteração será gravada até ser reativada.'
          : 'Auditoria RETOMADA! O sistema voltou a gravar logs normalmente.'
      )
    } catch (err: any) {
      toast.error(err.message || 'Erro ao alterar pausa.')
    }
  }

  // ── Salvar Configuração de Retenção Automática ─────────────────────────────
  const handleSaveRetention = async () => {
    try {
      const res = await fetch('/api/system-logs/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auto_delete_enabled: retentionEnabledInput,
          auto_delete_days: Number(retentionDaysInput),
        }),
      })
      if (!res.ok) throw new Error('Falha ao salvar preferências de retenção.')

      setSettings(prev => ({
        ...prev,
        auto_delete_enabled: retentionEnabledInput,
        auto_delete_days: Number(retentionDaysInput),
      }))
      setIsRetentionModalOpen(false)
      toast.success('Política de retenção atualizada com sucesso!')
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar configuração.')
    }
  }

  // ── Disparar Limpeza Imediata com Base na Retenção ────────────────────────
  const handleRunRetentionNow = async () => {
    try {
      const res = await fetch('/api/system-logs/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runCleanupNow: true,
          days: Number(retentionDaysInput),
        }),
      })
      if (!res.ok) throw new Error('Falha ao executar limpeza.')
      toast.success(`Limpeza concluída! Logs anteriores a ${retentionDaysInput} dias foram removidos.`)
      setIsRetentionModalOpen(false)
      fetchLogs(1)
      fetchSettingsAndStats()
    } catch (err: any) {
      toast.error(err.message || 'Erro ao executar limpeza.')
    }
  }

  // ── Exclusão Manual de Logs por Data ───────────────────────────────────────
  const handleDeleteByDate = async () => {
    setIsDeleting(true)
    try {
      let payload: any = {}
      if (deleteMode === 'days') {
        payload.olderThanDays = Number(deleteDaysValue)
      } else if (deleteMode === 'beforeDate') {
        if (!deleteBeforeDateValue) {
          toast.error('Selecione uma data limite válida.')
          setIsDeleting(false)
          return
        }
        payload.beforeDate = deleteBeforeDateValue
      } else if (deleteMode === 'range') {
        if (!deleteStartDateValue || !deleteEndDateValue) {
          toast.error('Preencha a data inicial e final do intervalo.')
          setIsDeleting(false)
          return
        }
        payload.startDate = deleteStartDateValue
        payload.endDate = deleteEndDateValue
      }

      const res = await fetch('/api/system-logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao excluir logs.')
      }

      toast.success('Registros excluídos com sucesso!')
      setIsDeleteModalOpen(false)
      fetchLogs(1)
      fetchSettingsAndStats()
    } catch (err: any) {
      toast.error(err.message || 'Falha na exclusão de logs.')
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Limpar Telemetria Legada (Web Vitals) com 1 Clique ────────────────────
  const handlePurgeLegacyPerformance = async () => {
    if (!confirm('Deseja purgar os registros de telemetria legados do banco? Esta ação liberará muito espaço no Supabase.')) {
      return
    }
    setIsPurgingLegacy(true)
    try {
      const res = await fetch('/api/system-logs/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purgePerformanceNow: true }),
      })
      if (!res.ok) throw new Error('Falha ao limpar telemetria legada.')
      toast.success('Logs de telemetria legados removidos com sucesso! Espaço em disco liberado.')
      fetchSettingsAndStats()
      fetchLogs(1)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao expurgar telemetria.')
    } finally {
      setIsPurgingLegacy(false)
    }
  }

  // ── Exportar Logs Formatados para CSV ──────────────────────────────────────
  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error('Nenhum log disponível para exportação com os filtros atuais.')
      return
    }

    const headers = ['ID', 'Data e Hora', 'Usuário', 'Perfil', 'Módulo', 'Ação', 'Registro Alvo', 'Descrição', 'Status']
    const rows = logs.map(l => [
      l.id,
      new Date(l.dataHora).toLocaleString('pt-BR'),
      `"${l.usuarioNome || ''}"`,
      `"${l.perfil || ''}"`,
      `"${l.modulo || ''}"`,
      `"${l.acao || ''}"`,
      `"${l.nomeRelacionado || l.registroId || ''}"`,
      `"${(l.descricao || '').replace(/"/g, '""')}"`,
      l.status || 'sucesso',
    ])

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `auditoria_impacto_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success('Planilha CSV gerada com sucesso!')
  }

  // Helpers de Estilização de Badges e Ações com Alto Contraste
  const getActionBadge = (acao: string) => {
    const a = (acao || '').toLowerCase()
    if (a.includes('cria') || a.includes('cadastr') || a.includes('novo')) {
      return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0', icon: <PlusCircle size={12} /> }
    }
    if (a.includes('edit') || a.includes('altera') || a.includes('modific')) {
      return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe', icon: <Edit3 size={12} /> }
    }
    if (a.includes('exclu') || a.includes('remov') || a.includes('delet')) {
      return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca', icon: <MinusCircle size={12} /> }
    }
    if (a.includes('envi') || a.includes('notific') || a.includes('comunic')) {
      return { bg: '#faf5ff', text: '#6b21a8', border: '#e9d5ff', icon: <Send size={12} /> }
    }
    if (a.includes('baix') || a.includes('pagament') || a.includes('recebi')) {
      return { bg: '#fffbeb', text: '#b45309', border: '#fde68a', icon: <DollarSign size={12} /> }
    }
    if (a.includes('login') || a.includes('autentica') || a.includes('senha')) {
      return { bg: '#ecfeff', text: '#0e7490', border: '#a5f3fc', icon: <KeyRound size={12} /> }
    }
    return { bg: '#f8fafc', text: '#334155', border: '#cbd5e1', icon: <FileText size={12} /> }
  }

  const getProfileBadgeStyle = (perfil: string) => {
    const p = (perfil || '').toLowerCase()
    if (p.includes('admin') || p.includes('diretor') || p.includes('master')) {
      return { bg: '#fdf2f8', text: '#be185d', border: '#fbcfe8' }
    }
    if (p.includes('professor') || p.includes('docente')) {
      return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' }
    }
    if (p.includes('secretar') || p.includes('coordena')) {
      return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' }
    }
    if (p.includes('financ')) {
      return { bg: '#fffbeb', text: '#b45309', border: '#fde68a' }
    }
    return { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' }
  }

  // ── Formatador de Nomes de Campos Amigável ────────────────────────────────
  const formatFieldName = (key: string): { label: string; raw: string } => {
    const map: Record<string, string> = {
      bloqueadoProvasOnline: 'Bloqueio: Provas Online',
      bloqueadoCredImpacto: 'Bloqueio: CredImpacto',
      bloqueadoSimulados: 'Bloqueio: Simulados',
      bloqueadoAgendaDigital: 'Bloqueio: Agenda Digital',
      bloqueadoGestaoEscolar: 'Bloqueio: Gestão Escolar',
      bloqueadoGestaoPessoas: 'Bloqueio: Gestão de Pessoas',
      permissoes: 'Permissões de Acesso',
      nome: 'Nome',
      email: 'E-mail',
      cor: 'Cor do Perfil',
      descricao: 'Descrição',
      cargo: 'Cargo',
      perfil: 'Perfil de Acesso',
      ativo: 'Status Ativo',
      telefone: 'Telefone / WhatsApp',
      dataNasc: 'Data de Nascimento',
      turma: 'Turma',
      serie: 'Série',
      segmento: 'Segmento Escolar',
      anoLetivo: 'Ano Letivo',
      historicoTurmas: 'Histórico de Turmas',
      responsavel: 'Responsável Principal',
      responsaveis: 'Lista de Responsáveis',
      autorizadoSairSozinho: 'Autorizado a Sair Sozinho',
      rfid: 'Cartão RFID',
      obs: 'Observações',
      observacoes: 'Observações',
      codigo: 'Código / Matrícula',
      id: 'ID do Registro',
      status: 'Status',
      diasAcesso: 'Dias de Acesso',
      proibido: 'Acesso Proibido',
      profissao: 'Profissão',
      isFinanceiro: 'Responsável Financeiro',
      isPedagogico: 'Responsável Pedagógico',
      foto: 'Foto',
      anuidade: 'Valor da Anuidade',
      parcelas: 'Parcelas',
      descontoTipo: 'Tipo de Desconto',
      descontoValor: 'Valor do Desconto',
      diaVencimento: 'Dia de Vencimento',
      totalParcelas: 'Total de Parcelas',
      eventoId: 'ID do Evento',
      eventoDescricao: 'Descrição do Evento',
    }

    if (map[key]) {
      return { label: map[key], raw: key }
    }

    const formatted = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()

    return { label: formatted, raw: key }
  }

  // ── Formatador Amigável de Valores para o Modal (Evita "null" feio) ────────
  const renderFormattedValue = (val: any, type: 'old' | 'new' | 'neutral' = 'neutral') => {
    if (val === null || val === undefined) {
      if (type === 'old') {
        return <span className="text-slate-400 italic font-mono text-[11px]">— (não existia)</span>
      }
      if (type === 'new') {
        return (
          <span className="text-rose-500 font-bold italic font-mono text-[11px] bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
            — (removido / apagado)
          </span>
        )
      }
      return <span className="text-slate-400 italic font-mono text-[11px]">— (não informado)</span>
    }
    if (val === '') {
      return <span className="text-slate-400 italic text-[11px]">— (em branco)</span>
    }
    if (typeof val === 'boolean') {
      if (type === 'old') {
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
              val
                ? 'bg-rose-50 text-rose-800 border border-rose-200 line-through'
                : 'bg-slate-100 text-slate-600 border border-slate-200 line-through'
            }`}
          >
            {val ? 'Sim / Ativo' : 'Não / Inativo'}
          </span>
        )
      }
      if (type === 'new') {
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold shadow-xs ${
              val
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                : 'bg-slate-100 text-slate-700 border border-slate-300'
            }`}
          >
            {val ? <Check size={12} className="text-emerald-700 stroke-[3]" /> : <X size={12} className="text-slate-500 stroke-[3]" />}
            {val ? 'Sim / Ativo' : 'Não / Inativo'}
          </span>
        )
      }
      return (
        <span
          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
            val ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          {val ? 'Sim / Ativo' : 'Não / Inativo'}
        </span>
      )
    }
    if (Array.isArray(val)) {
      if (val.length === 0) return <span className="text-slate-400 italic text-[11px]">— (nenhum item)</span>
      return (
        <div className="flex flex-wrap gap-1.5 my-1">
          {val.slice(0, 8).map((item, idx) => (
            <span
              key={idx}
              className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold ${
                type === 'old'
                  ? 'bg-rose-50 text-rose-800 border-rose-200 line-through'
                  : type === 'new'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 shadow-xs'
                  : 'bg-slate-100 text-slate-800 border-slate-200'
              }`}
            >
              {typeof item === 'object' && item !== null ? (
                item.nome || item.descricao || item.serie || item.codigo || JSON.stringify(item)
              ) : (
                String(item)
              )}
            </span>
          ))}
          {val.length > 8 && (
            <span className="text-[10px] text-slate-400 font-semibold self-center italic">
              +{val.length - 8} mais
            </span>
          )}
        </div>
      )
    }
    if (typeof val === 'object' && val !== null) {
      if (val.nome) {
        return (
          <span
            className={`font-semibold text-xs ${
              type === 'old' ? 'line-through text-rose-800' : type === 'new' ? 'text-emerald-950 font-bold' : 'text-slate-900'
            }`}
          >
            {val.nome} {val.parentesco ? `(${val.parentesco})` : ''} {val.id ? `• ID: ${val.id}` : ''}
          </span>
        )
      }
      return (
        <pre
          className={`text-[11px] p-2 rounded-lg border font-mono whitespace-pre-wrap max-h-32 overflow-y-auto ${
            type === 'old'
              ? 'bg-rose-50/50 border-rose-200 text-rose-900'
              : type === 'new'
              ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
              : 'bg-slate-50 border-slate-200 text-slate-800'
          }`}
        >
          {JSON.stringify(val, null, 2)}
        </pre>
      )
    }

    if (type === 'old') {
      return (
        <span className="text-rose-900 font-medium line-through decoration-rose-400 bg-rose-50/70 px-2 py-0.5 rounded border border-rose-200/60 inline-block text-xs break-all">
          {String(val)}
        </span>
      )
    }
    if (type === 'new') {
      return (
        <span className="text-emerald-950 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-300 inline-block text-xs shadow-xs break-all">
          {String(val)}
        </span>
      )
    }

    return <span className="text-slate-900 font-medium break-all text-xs">{String(val)}</span>
  }

  // Copiar JSON bruto
  const handleCopyRaw = () => {
    if (!selectedLogForDetails) return
    const content = JSON.stringify(
      {
        ...selectedLogForDetails,
        detalhesAntes: selectedLogForDetails.detalhesAntes,
        detalhesDepois: selectedLogForDetails.detalhesDepois,
      },
      null,
      2
    )
    navigator.clipboard.writeText(content)
    setCopiedRaw(true)
    setTimeout(() => setCopiedRaw(false), 2000)
    toast.success('JSON copiado para a área de transferência!')
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto text-slate-800 animate-in fade-in duration-200">
      {/* ── TOP HEADER COM BREADCRUMB & CONTROLES ────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
            <span>Configurações</span>
            <span>/</span>
            <span className="text-blue-600 font-extrabold">Auditoria & Logs</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                <History size={20} />
              </span>
              Logs e Auditoria do Sistema
            </h1>

            {/* Status Pill de Gravação */}
            {settings.paused ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Auditoria Pausada
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Gravando Ativamente
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
            Rastreamento completo de cadastros, edições, envios e exclusões realizados por administradores, professores e equipe escolar.
          </p>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Botão Pausar / Retomar */}
          <button
            onClick={() => setIsPauseConfirmOpen(true)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-sm border ${
              settings.paused
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
            }`}
          >
            {settings.paused ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
            {settings.paused ? 'Retomar Gravação' : 'Pausar Logs'}
          </button>

          {/* Botão Configurar Retenção */}
          <button
            onClick={() => setIsRetentionModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm transition-all"
          >
            <Sliders size={14} className="text-blue-600" />
            Auto-Limpeza ({settings.auto_delete_enabled ? `${settings.auto_delete_days}d` : 'Desat.'})
          </button>

          {/* Botão Excluir por Data */}
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 shadow-sm transition-all"
          >
            <Trash2 size={14} />
            Excluir por Data
          </button>

          {/* Exportar CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-sm transition-all"
            title="Exportar registros filtrados para CSV"
          >
            <Download size={14} />
            Exportar
          </button>

          {/* Refresh */}
          <button
            onClick={() => {
              fetchLogs(page)
              fetchSettingsAndStats()
              toast.info('Dados de auditoria atualizados.')
            }}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 shadow-sm transition-all"
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* ── BANNER DE OTIMIZAÇÃO SE HOUVER TELEMETRIA LEGADA ──────────────── */}
      {storageStats.performanceLogs > 0 && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 mt-0.5 shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-950 flex items-center gap-2">
                Oportunidade de Economia no Supabase
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                  {storageStats.performanceLogs.toLocaleString('pt-BR')} registros legados
                </span>
              </h4>
              <p className="text-[11px] text-amber-800 mt-0.5">
                Existem métricas antigas de Web Vitals ocupando espaço. Purgue-as agora para liberar banco de dados.
              </p>
            </div>
          </div>
          <button
            onClick={handlePurgeLegacyPerformance}
            disabled={isPurgingLegacy}
            className="shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 shadow transition-all disabled:opacity-50"
          >
            {isPurgingLegacy ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
            {isPurgingLegacy ? 'Limpando...' : 'Liberar Espaço Agora'}
          </button>
        </div>
      )}

      {/* ── 4 KPI METRIC CARDS ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total de Eventos</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <History size={16} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {totalCount.toLocaleString('pt-BR')}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
            <CheckCircle2 size={13} className="text-emerald-600" />
            Auditados no banco
          </p>
        </div>

        {/* Card 2: Hoje */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ações Hoje</span>
            <div className="p-2 rounded-xl bg-pink-50 text-pink-600 border border-pink-100">
              <Clock size={16} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {todayCount.toLocaleString('pt-BR')}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
            <span className="text-pink-600 font-bold">Criações, edições e envios</span> hoje
          </p>
        </div>

        {/* Card 3: Público Rastreado */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Público Rastreado</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Shield size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-pink-50 text-pink-700 border border-pink-200">Admin</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Professores</span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Equipe</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
            <span className="text-emerald-700 font-bold">Alunos e Famílias</span> 100% isentos
          </p>
        </div>

        {/* Card 4: Retenção */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Política de Retenção</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Sliders size={16} />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xl font-black text-slate-900 tracking-tight">
              {settings.auto_delete_enabled ? `${settings.auto_delete_days} dias` : 'Manual'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
            {settings.auto_delete_enabled ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle size={12} /> Auto-limpeza ativa
              </span>
            ) : (
              <span className="text-amber-700 font-bold">Limpeza manual</span>
            )}
          </p>
        </div>
      </div>

      {/* ── BARRA DE FILTROS AVANÇADOS ──────────────────────────────────── */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2.5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2.5">
          {/* Campo de Busca Textual */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              placeholder="Buscar por usuário, descrição, nome relacionado ou ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 focus:border-blue-500 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Filtro de Módulo */}
          <select
            value={selectedModulo}
            onChange={e => {
              setSelectedModulo(e.target.value)
              setPage(1)
            }}
            className="bg-slate-50 hover:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none shadow-sm cursor-pointer"
          >
            <option value="todos">Todos os Módulos</option>
            <option value="Acadêmico">Acadêmico</option>
            <option value="Financeiro">Financeiro</option>
            <option value="RH">RH / Gestão de Pessoas</option>
            <option value="Secretaria">Secretaria</option>
            <option value="Matrículas">Matrículas</option>
            <option value="Portaria">Portaria</option>
            <option value="Comunicação">Comunicação / Agenda</option>
            <option value="Configurações">Configurações</option>
            <option value="Segurança">Segurança & Acesso</option>
          </select>

          {/* Filtro de Ação */}
          <select
            value={selectedAcao}
            onChange={e => {
              setSelectedAcao(e.target.value)
              setPage(1)
            }}
            className="bg-slate-50 hover:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none shadow-sm cursor-pointer"
          >
            <option value="todos">Todas as Ações</option>
            <option value="Criação">Criação / Cadastro</option>
            <option value="Edição">Edição / Alteração</option>
            <option value="Exclusão">Exclusão / Remoção</option>
            <option value="Envio">Envio (Mensagens/Notificações)</option>
            <option value="Baixa">Baixa / Pagamento</option>
            <option value="Login">Login / Acesso</option>
          </select>

          {/* Filtro de Perfil */}
          <select
            value={selectedPerfil}
            onChange={e => {
              setSelectedPerfil(e.target.value)
              setPage(1)
            }}
            className="bg-slate-50 hover:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none shadow-sm cursor-pointer"
          >
            <option value="todos">Todos os Perfis</option>
            <option value="Administrador">Administrador</option>
            <option value="Professor">Professor</option>
            <option value="Secretária">Secretária</option>
            <option value="Financeiro">Financeiro</option>
            <option value="Coordenador">Coordenação</option>
            <option value="Colaborador">Colaborador Geral</option>
          </select>

          {/* Seletor de Período */}
          <select
            value={periodo}
            onChange={e => {
              setPeriodo(e.target.value)
              setPage(1)
            }}
            className="bg-slate-50 hover:bg-white border border-slate-300 focus:border-blue-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none shadow-sm cursor-pointer"
          >
            <option value="hoje">Hoje</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="todos">Todo o Histórico</option>
            <option value="custom">Personalizado...</option>
          </select>
        </div>

        {/* Campos de Data Personalizada se selecionado */}
        {periodo === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-xs text-slate-600 font-bold">Intervalo de Datas:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-900 shadow-sm"
            />
            <span className="text-xs text-slate-400 font-bold">até</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs text-slate-900 shadow-sm"
            />
            <button
              onClick={() => {
                setPage(1)
                fetchLogs(1)
              }}
              className="px-3 py-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      {/* ── TABELA DE AUDITORIA (AJUSTADA 100% PARA NÃO ROLAR HORIZONTALMENTE) ── */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden w-full">
        <div className="w-full">
          <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
              <col className="w-[115px]" />
              <col className="w-[180px]" />
              <col className="w-[125px]" />
              <col className="w-[90px]" />
              <col className="w-[115px]" />
              <col className="w-auto" />
              <col className="w-[85px]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 pl-4 pr-2">Data / Hora</th>
                <th className="py-3 px-2">Usuário & Perfil</th>
                <th className="py-3 px-2">Módulo</th>
                <th className="py-3 px-2 text-center">Ação</th>
                <th className="py-3 px-2">Registro / Alvo</th>
                <th className="py-3 px-2">Descrição da Alteração</th>
                <th className="py-3 pr-4 pl-2 text-center">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={22} className="animate-spin text-blue-600" />
                      <span className="font-semibold text-slate-600 text-xs">Carregando trilha de auditoria...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Info size={26} className="text-slate-300" />
                      <span className="font-bold text-slate-700 text-sm">Nenhum registro de auditoria encontrado</span>
                      <span className="text-xs text-slate-500 max-w-sm">
                        Ajuste os filtros acima ou aguarde as próximas ações da equipe.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map(log => {
                  const badge = getActionBadge(log.acao)
                  const profileBadge = getProfileBadgeStyle(log.perfil)
                  const hasDiff = log.detalhesAntes || log.detalhesDepois

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => {
                        setSelectedLogForDetails(log)
                        setModalTab('formatted')
                      }}
                    >
                      {/* Data e Hora */}
                      <td className="py-2.5 pl-4 pr-2">
                        <div className="text-slate-900 font-bold text-xs truncate">
                          {new Date(log.dataHora).toLocaleDateString('pt-BR')}
                        </div>
                        <div className="text-slate-400 font-mono text-[10.5px]">
                          {new Date(log.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </td>

                      {/* Usuário & Perfil */}
                      <td className="py-2.5 px-2">
                        <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-xs truncate" title={log.usuarioNome}>
                          {log.usuarioNome || 'Colaborador'}
                        </div>
                        <div className="mt-0.5">
                          <span
                            className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold border truncate max-w-full"
                            style={{
                              borderColor: profileBadge.border,
                              backgroundColor: profileBadge.bg,
                              color: profileBadge.text,
                            }}
                            title={log.perfil}
                          >
                            {log.perfil || 'Usuário'}
                          </span>
                        </div>
                      </td>

                      {/* Módulo */}
                      <td className="py-2.5 px-2">
                        <span
                          className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 border border-slate-200 text-slate-700 truncate block text-center"
                          title={log.modulo}
                        >
                          {log.modulo || 'Geral'}
                        </span>
                      </td>

                      {/* Ação */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap"
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.text,
                            borderColor: badge.border,
                          }}
                        >
                          {badge.icon}
                          {log.acao}
                        </span>
                      </td>

                      {/* Registro Alvo */}
                      <td className="py-2.5 px-2 text-slate-800 font-semibold text-xs truncate" title={log.nomeRelacionado || log.registroId || ''}>
                        {log.nomeRelacionado ? (
                          <span className="truncate block">{log.nomeRelacionado}</span>
                        ) : log.registroId ? (
                          <span className="font-mono text-slate-500 text-[11px] truncate block">ID: {log.registroId}</span>
                        ) : (
                          <span className="text-slate-300 italic">—</span>
                        )}
                      </td>

                      {/* Descrição */}
                      <td className="py-2.5 px-2 text-slate-600 text-xs">
                        <div className="truncate text-slate-700 font-medium" title={log.descricao}>
                          {log.descricao || 'Operação registrada no sistema'}
                        </div>
                      </td>

                      {/* Detalhes / Botão de Inspeção */}
                      <td className="py-2.5 pr-4 pl-2 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setSelectedLogForDetails(log)
                            setModalTab('formatted')
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all border shadow-sm ${
                            hasDiff
                              ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                              : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          <Eye size={12} />
                          {hasDiff ? 'Diffs' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── PAGINAÇÃO ─────────────────────────────────────────────────── */}
        {!loading && logs.length > 0 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-600">
            <div>
              Página <strong className="text-slate-900">{page}</strong> de <strong className="text-slate-900">{totalPages}</strong> ({totalCount.toLocaleString('pt-BR')} registros)
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-slate-700 font-bold border border-slate-300 shadow-sm text-xs"
              >
                <ChevronLeft size={13} /> Anterior
              </button>

              <div className="flex items-center gap-1 font-mono">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pNum = page - 2 + i
                  if (page <= 2) pNum = i + 1
                  if (page >= totalPages - 2) pNum = totalPages - 4 + i
                  if (pNum < 1 || pNum > totalPages) return null

                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`w-6 h-6 rounded-lg text-xs font-bold transition-colors shadow-sm ${
                        page === pNum
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {pNum}
                    </button>
                  )
                })}
              </div>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none text-slate-700 font-bold border border-slate-300 shadow-sm text-xs"
              >
                Próxima <ChevronRight size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL 1: INSPEÇÃO INTELIGENTE DE DETALHES (CORREÇÃO DE "NULL") ─ */}
      {selectedLogForDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-4xl max-h-[90vh] bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Inspeção do Registro de Auditoria
                    <span className="font-mono text-xs text-slate-400">#{selectedLogForDetails.id}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Gravado em {new Date(selectedLogForDetails.dataHora).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Abas Formatado vs JSON Bruto */}
                <div className="flex items-center bg-slate-200/70 p-0.5 rounded-xl text-[11px] font-bold">
                  <button
                    onClick={() => setModalTab('formatted')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      modalTab === 'formatted' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Formatado
                  </button>
                  <button
                    onClick={() => setModalTab('raw')}
                    className={`px-3 py-1 rounded-lg transition-colors ${
                      modalTab === 'raw' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    JSON Bruto
                  </button>
                </div>

                <button
                  onClick={() => setSelectedLogForDetails(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Metadados do Registro */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Responsável</span>
                  <span className="font-bold text-slate-900 mt-0.5 block truncate">{selectedLogForDetails.usuarioNome}</span>
                  <span className="text-[10px] text-pink-600 font-bold">{selectedLogForDetails.perfil}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Módulo</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{selectedLogForDetails.modulo}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Ação</span>
                  <span className="font-bold text-slate-900 mt-0.5 block">{selectedLogForDetails.acao}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Alvo / Registro ID</span>
                  <span className="font-bold text-slate-900 mt-0.5 block truncate">
                    {selectedLogForDetails.nomeRelacionado || selectedLogForDetails.registroId || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Descrição do Evento</h4>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800">
                  {selectedLogForDetails.descricao || 'Nenhuma descrição fornecida.'}
                </div>
              </div>

              {/* ── ABA 1: VISUALIZAÇÃO FORMATADA INTELIGENTE ── */}
              {modalTab === 'formatted' && (
                <div>
                  {(() => {
                    if (resolvingPrevious) {
                      return (
                        <div className="py-12 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                          <RefreshCw size={26} className="animate-spin text-blue-600 mx-auto" />
                          <div className="text-xs font-bold text-slate-800">Recuperando histórico anterior do registro...</div>
                          <div className="text-[11px] text-slate-500">Buscando o snapshot prévio na auditoria para comparar as alterações.</div>
                        </div>
                      )
                    }

                    const antes = resolvedAntes || selectedLogForDetails.detalhesAntes
                    const depois = selectedLogForDetails.detalhesDepois

                    const hasAntes = antes && typeof antes === 'object' && Object.keys(antes).length > 0
                    const hasDepois = depois && typeof depois === 'object' && Object.keys(depois).length > 0

                    // CASO A: Temos tanto ANTES quanto DEPOIS (Comparativo real de Diff)
                    if (hasAntes && hasDepois) {
                      const allKeys = Array.from(new Set([...Object.keys(antes), ...Object.keys(depois)]))
                      const relevantKeys = allKeys.filter(k => !['updated_at', 'updatedAt', 'lastModified'].includes(k))
                      const changedKeys = relevantKeys.filter(k => JSON.stringify(antes[k]) !== JSON.stringify(depois[k]))
                      const displayedKeys = showOnlyChanged && changedKeys.length > 0 ? changedKeys : relevantKeys

                      return (
                        <div className="space-y-3">
                          {/* Top bar with count & toggle */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                                Comparativo de Alterações
                              </h4>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                  changedKeys.length > 0
                                    ? 'bg-amber-50 text-amber-900 border-amber-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-300'
                                }`}
                              >
                                {changedKeys.length} {changedKeys.length === 1 ? 'campo alterado' : 'campos alterados'}
                              </span>
                              {resolvedAntes && !selectedLogForDetails.detalhesAntes && (
                                <span className="text-[10.5px] text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
                                  Histórico correlacionado
                                </span>
                              )}
                            </div>

                            {/* Toggle para alternar entre "Apenas Alterados" e "Todos os Campos" */}
                            {relevantKeys.length > changedKeys.length && (
                              <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-[11px] font-bold border border-slate-200 self-start sm:self-auto">
                                <button
                                  type="button"
                                  onClick={() => setShowOnlyChanged(true)}
                                  className={`px-2.5 py-1 rounded-lg transition-all ${
                                    showOnlyChanged ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  Apenas Alterações ({changedKeys.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowOnlyChanged(false)}
                                  className={`px-2.5 py-1 rounded-lg transition-all ${
                                    !showOnlyChanged ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  Todos os Campos ({relevantKeys.length})
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Tabela de Diff */}
                          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-700 font-bold">
                                  <th className="py-2.5 px-3.5 w-[28%]">Campo Modificado</th>
                                  <th className="py-2.5 px-3.5 w-[36%] text-rose-800 bg-rose-50/70 border-r border-rose-100">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                                      Valor Antigo (Anterior)
                                    </div>
                                  </th>
                                  <th className="py-2.5 px-3.5 w-[36%] text-emerald-950 bg-emerald-50/70">
                                    <div className="flex items-center gap-1.5">
                                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                      Alteração Feita (Novo Valor)
                                    </div>
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {displayedKeys.length === 0 ? (
                                  <tr>
                                    <td colSpan={3} className="py-8 text-center text-slate-400">
                                      Nenhum atributo sofreu alteração no payload.
                                    </td>
                                  </tr>
                                ) : (
                                  displayedKeys.map(key => {
                                    const isChanged = JSON.stringify(antes[key]) !== JSON.stringify(depois[key])
                                    const fieldInfo = formatFieldName(key)

                                    return (
                                      <tr
                                        key={key}
                                        className={`transition-colors ${
                                          isChanged ? 'hover:bg-amber-50/20' : 'opacity-60 hover:opacity-100 hover:bg-slate-50'
                                        }`}
                                      >
                                        <td className="py-2.5 px-3.5 align-top">
                                          <div className="font-bold text-slate-900 text-xs">{fieldInfo.label}</div>
                                          <div className="font-mono text-[10px] text-slate-400 mt-0.5">{fieldInfo.raw}</div>
                                          {isChanged && (
                                            <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                              Modificado
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3.5 align-top bg-rose-50/20 border-r border-rose-100">
                                          {renderFormattedValue(antes[key], 'old')}
                                        </td>
                                        <td className="py-2.5 px-3.5 align-top bg-emerald-50/20 font-bold">
                                          {renderFormattedValue(depois[key], 'new')}
                                        </td>
                                      </tr>
                                    )
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    }

                    // CASO B: Temos apenas DEPOIS (Cadastro, Criação ou Snapshot gravado)
                    // NÃO exibe coluna de "null" fictício! Exibe como Snapshot de Dados Registrados
                    if (!hasAntes && hasDepois) {
                      const keys = Object.keys(depois).filter(k => !['updated_at', 'updatedAt', 'lastModified'].includes(k))

                      return (
                        <div className="space-y-3">
                          <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs flex items-center gap-2.5">
                            <Info size={16} className="text-blue-600 shrink-0" />
                            <span>
                              <strong>Cadastro Inicial / Primeiro Registro:</strong> Não há registros anteriores deste item na auditoria. Abaixo estão todos os dados gravados nesta operação.
                            </span>
                          </div>

                          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                                  <th className="py-2.5 px-3.5 w-1/3">Propriedade / Atributo</th>
                                  <th className="py-2.5 px-3.5 w-2/3 text-emerald-800 bg-emerald-50/30">Valor Gravado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {keys.map(key => {
                                  const fieldInfo = formatFieldName(key)
                                  return (
                                    <tr key={key} className="hover:bg-slate-50/80">
                                      <td className="py-2.5 px-3.5 align-top">
                                        <div className="font-bold text-slate-900 text-xs">{fieldInfo.label}</div>
                                        <div className="font-mono text-[10px] text-slate-400">{fieldInfo.raw}</div>
                                      </td>
                                      <td className="py-2.5 px-3.5 align-top">{renderFormattedValue(depois[key], 'neutral')}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    }

                    // CASO C: Temos apenas ANTES (Exclusão / Remoção)
                    if (hasAntes && !hasDepois) {
                      const keys = Object.keys(antes).filter(k => !['updated_at', 'updatedAt', 'lastModified'].includes(k))

                      return (
                        <div className="space-y-3">
                          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2.5">
                            <Trash2 size={16} className="text-rose-600 shrink-0" />
                            <span>
                              <strong>Registro Excluído:</strong> Este item foi removido do sistema. Abaixo estão os dados que estavam cadastrados anteriormente.
                            </span>
                          </div>

                          <div className="rounded-xl border border-rose-200 overflow-hidden bg-white shadow-xs">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-rose-50/70 border-b border-rose-200 text-rose-800 font-bold">
                                  <th className="py-2.5 px-3.5 w-1/3">Propriedade</th>
                                  <th className="py-2.5 px-3.5 w-2/3">Valor Anteriormente Cadastrado</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {keys.map(key => {
                                  const fieldInfo = formatFieldName(key)
                                  return (
                                    <tr key={key} className="hover:bg-rose-50/20">
                                      <td className="py-2.5 px-3.5 align-top">
                                        <div className="font-bold text-slate-900 text-xs">{fieldInfo.label}</div>
                                        <div className="font-mono text-[10px] text-slate-400">{fieldInfo.raw}</div>
                                      </td>
                                      <td className="py-2.5 px-3.5 align-top text-rose-800">{renderFormattedValue(antes[key], 'neutral')}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )
                    }

                    // CASO D: Nenhum payload adicional gravado
                    return (
                      <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center font-medium">
                        Esta operação não gerou alteração de dados de campos (ex: login de acesso ou envio de notificação sem payload).
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* ── ABA 2: JSON BRUTO / RAW ── */}
              {modalTab === 'raw' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono">Payload JSON completo gravado no Supabase</span>
                    <button
                      onClick={handleCopyRaw}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                    >
                      {copiedRaw ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      {copiedRaw ? 'Copiado!' : 'Copiar JSON'}
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto max-h-[350px]">
                    {JSON.stringify(
                      {
                        id: selectedLogForDetails.id,
                        dataHora: selectedLogForDetails.dataHora,
                        usuarioNome: selectedLogForDetails.usuarioNome,
                        perfil: selectedLogForDetails.perfil,
                        modulo: selectedLogForDetails.modulo,
                        acao: selectedLogForDetails.acao,
                        registroId: selectedLogForDetails.registroId,
                        nomeRelacionado: selectedLogForDetails.nomeRelacionado,
                        descricao: selectedLogForDetails.descricao,
                        detalhesAntes: selectedLogForDetails.detalhesAntes,
                        detalhesDepois: selectedLogForDetails.detalhesDepois,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-100 flex justify-end bg-slate-50/50">
              <button
                onClick={() => setSelectedLogForDetails(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm"
              >
                Fechar Inspeção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 2: CONFIGURAÇÃO DE RETENÇÃO AUTOMÁTICA ──────────────────── */}
      {isRetentionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 shadow-sm">
                  <Sliders size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Retenção Automática de Logs</h3>
                  <p className="text-xs text-slate-500">Configure o expurgo automático para economizar no Supabase</p>
                </div>
              </div>
              <button onClick={() => setIsRetentionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Toggle de Auto-Limpeza */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <span className="font-bold text-slate-900 block text-sm">Ativar Auto-Limpeza Automática</span>
                  <span className="text-slate-500 text-xs">
                    Executa em background periodicamente sem intervenção manual
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={retentionEnabledInput}
                  onChange={e => setRetentionEnabledInput(e.target.checked)}
                  className="w-5 h-5 accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Seletor de Dias */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Manter logs no banco por:</label>
                <select
                  value={retentionDaysInput}
                  onChange={e => setRetentionDaysInput(Number(e.target.value))}
                  disabled={!retentionEnabledInput}
                  className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-semibold text-slate-800 disabled:opacity-50 shadow-sm focus:outline-none focus:border-blue-500"
                >
                  <option value={30}>30 dias (Ultra-econômico — Ideal para bancos menores)</option>
                  <option value={60}>60 dias (Recomendado para médio volume)</option>
                  <option value={90}>90 dias (Recomendado padrão — 1 trimestre)</option>
                  <option value={180}>180 dias (Semestral)</option>
                  <option value={365}>365 dias (1 ano completo de auditoria)</option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs leading-relaxed">
                💡 <strong>Como funciona a economia:</strong> Logs mais antigos que o período selecionado são expurgados de forma otimizada, garantindo que o seu plano no Supabase nunca atinja os limites de armazenamento.
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={handleRunRetentionNow}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-all shadow-sm"
              >
                Limpar Agora ({retentionDaysInput}d)
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsRetentionModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveRetention}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-all"
                >
                  Salvar Preferências
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 3: EXCLUSÃO MANUAL POR DATA ────────────────────────────── */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-white border border-rose-200 rounded-3xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 shadow-sm">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Exclusão Manual por Data</h3>
                  <p className="text-xs text-slate-500">Elimine registros de log antigos de forma permanente</p>
                </div>
              </div>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Opções de exclusão */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteMode('days')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    deleteMode === 'days'
                      ? 'bg-rose-50 border-rose-400 text-rose-700 font-bold shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Por Idade (Dias)
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteMode('beforeDate')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    deleteMode === 'beforeDate'
                      ? 'bg-rose-50 border-rose-400 text-rose-700 font-bold shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Antes de Data
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteMode('range')}
                  className={`p-2.5 rounded-xl border text-center transition-all ${
                    deleteMode === 'range'
                      ? 'bg-rose-50 border-rose-400 text-rose-700 font-bold shadow-sm'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Intervalo Específico
                </button>
              </div>

              {/* Modo 1: Dias */}
              {deleteMode === 'days' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Excluir registros mais antigos que:</label>
                  <select
                    value={deleteDaysValue}
                    onChange={e => setDeleteDaysValue(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-semibold text-slate-800 shadow-sm"
                  >
                    <option value={15}>15 dias</option>
                    <option value={30}>30 dias</option>
                    <option value={60}>60 dias</option>
                    <option value={90}>90 dias</option>
                    <option value={180}>180 dias</option>
                    <option value={365}>1 ano (365 dias)</option>
                  </select>
                </div>
              )}

              {/* Modo 2: Antes de Data */}
              {deleteMode === 'beforeDate' && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Excluir todos os logs gerados antes de:</label>
                  <input
                    type="date"
                    value={deleteBeforeDateValue}
                    onChange={e => setDeleteBeforeDateValue(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 shadow-sm"
                  />
                </div>
              )}

              {/* Modo 3: Range */}
              {deleteMode === 'range' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Data Inicial:</label>
                    <input
                      type="date"
                      value={deleteStartDateValue}
                      onChange={e => setDeleteStartDateValue(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Data Final:</label>
                    <input
                      type="date"
                      value={deleteEndDateValue}
                      onChange={e => setDeleteEndDateValue(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs text-slate-900 shadow-sm"
                    />
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs leading-relaxed">
                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-rose-600" />
                <span>
                  <strong>Atenção:</strong> Esta operação é <u>definitiva e irreversível</u>. Os registros removidos não poderão ser recuperados.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteByDate}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow transition-all flex items-center gap-1.5"
              >
                {isDeleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL 4: CONFIRMAÇÃO DE PAUSA / RETOMADA ─────────────────────── */}
      {isPauseConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl ${
                  settings.paused ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                }`}
              >
                {settings.paused ? <PlayCircle size={24} /> : <PauseCircle size={24} />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {settings.paused ? 'Retomar Gravação de Auditoria?' : 'Pausar Gravação de Auditoria?'}
                </h3>
                <p className="text-xs text-slate-500">Controle dinâmico de performance e gravações</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {settings.paused
                ? 'Ao retomar, o sistema voltará imediatamente a registrar todas as criações, alterações, envios e exclusões feitas por administradores, professores e colaboradores.'
                : 'Ao pausar, nenhuma nova alteração ou ação será gravada no banco de dados até que você reative a gravação. Útil durante manutenções, correções em massa ou importações.'}
            </p>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={() => setIsPauseConfirmOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Voltar
              </button>
              <button
                onClick={handleTogglePause}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                  settings.paused
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                }`}
              >
                {settings.paused ? 'Confirmar Retomada' : 'Confirmar Pausa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
