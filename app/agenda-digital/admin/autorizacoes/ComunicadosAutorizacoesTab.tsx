'use client'

import React, { useState, useEffect, useMemo, useRef, useId, useCallback } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  RefreshCw,
  FileSpreadsheet,
  Printer,
  BellRing,
  Calendar,
  MapPin,
  DollarSign,
  Users,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  FileText,
  ExternalLink,
  Copy,
  Check,
  X,
  Eye,
  EyeOff,
  MessageCircle,
  ShieldCheck,
  SlidersHorizontal,
  CreditCard,
  Send,
} from 'lucide-react'
import { apiFetch } from '@/lib/api/apiClient'
import { supabase } from '@/lib/supabase'
import { getInitials } from '@/lib/utils'
import { formatAutorizacaoTermoHtml } from '@/lib/autorizacoes/autorizacaoUtils'
import { SCHOOL_TIMEZONE, formatDateTimeSchoolBR } from '@/lib/autorizacoes/saidaSozinhoUtils'
import type {
  RelatorioAutorizacaoComunicadoItem,
  RelatorioAutorizacaoAlunoItem,
} from '@/app/api/agenda/autorizacoes/relatorio/route'

export interface RelatorioComunicadosApiPayload {
  comunicados: RelatorioAutorizacaoComunicadoItem[]
  turmas: string[]
  kpis: {
    totalComunicados: number
    comunicadosAbertos: number
    comunicadosEncerrados: number
    totalDestinatariosGeral: number
    totalAssinaturasColetadas: number
    totalAprovadosGeral: number
    totalRecusadosGeral: number
    totalPendentesEmAberto: number
    totalComObservacoesGeral: number
    taxaAdesaoMedia: number
  }
}

interface ComunicadosAutorizacoesTabProps {
  initialComunicadoId?: string | null
  onCountsChange?: (counts: {
    totalComunicados: number
    comunicadosAbertos: number
    pendentesEmAberto: number
  }) => void
}

const TIPO_AUTORIZACAO_META: Record<
  string,
  { label: string; badgeBg: string; badgeColor: string; badgeBorder: string }
> = {
  passeio: {
    label: 'Passeio / Excursão',
    badgeBg: '#ecfdf5',
    badgeColor: '#047857',
    badgeBorder: '#a7f3d0',
  },
  evento: {
    label: 'Evento Escolar',
    badgeBg: '#eef2ff',
    badgeColor: '#4338ca',
    badgeBorder: '#c7d2fe',
  },
  uso_imagem: {
    label: 'Uso de Imagem',
    badgeBg: '#fdf4ff',
    badgeColor: '#a21caf',
    badgeBorder: '#f5d0fe',
  },
  medicamento: {
    label: 'Saúde / Medicamento',
    badgeBg: '#fff1f2',
    badgeColor: '#be123c',
    badgeBorder: '#fecdd3',
  },
  saida_desacompanhada: {
    label: 'Saída Desacompanhada',
    badgeBg: '#f0f9ff',
    badgeColor: '#0369a1',
    badgeBorder: '#bae6fd',
  },
  personalizado: {
    label: 'Termo de Autorização',
    badgeBg: '#f8fafc',
    badgeColor: '#334155',
    badgeBorder: '#cbd5e1',
  },
}

function escapeHtml(text?: string | null): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function legacyCopyText(text: string): boolean {
  const field = Object.assign(document.createElement('textarea'), { value: text })
  field.setAttribute('readonly', '')
  field.style.cssText = 'position:fixed;inset-block-start:0;opacity:0'
  document.body.append(field)
  field.select()
  try {
    return document.execCommand('copy')
  } finally {
    field.remove()
  }
}

function buildWhatsAppUrl(
  rawPhone: string | null | undefined,
  responsavelNome: string | null | undefined,
  alunoNome: string,
  tituloAutorizacao: string,
  dataLimiteFormatada: string | null
): string | null {
  if (!rawPhone) return null
  const digits = rawPhone.replace(/\D/g, '')
  if (digits.length < 10) return null
  const intlDigits = digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`
  const saudacao = responsavelNome ? `Olá, ${responsavelNome.split(' ')[0]}!` : 'Olá!'
  const prazoPart = dataLimiteFormatada ? ` (prazo até ${dataLimiteFormatada})` : ''
  const msg = `${saudacao} Tudo bem? Notamos que a autorização digital "${tituloAutorizacao}" referente a ${alunoNome}${prazoPart} ainda está pendente na Agenda Digital do Colégio Impacto. Poderia conferir e assinar pelo aplicativo, por gentileza?`
  return `https://wa.me/${intlDigits}?text=${encodeURIComponent(msg)}`
}

function attachLightDismissFallback(dialog: HTMLDialogElement | null): (() => void) | undefined {
  if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return undefined
  let pressedOutside = false
  const isOutside = (e: PointerEvent) => {
    const r = dialog.getBoundingClientRect()
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
  }
  const onDown = (e: PointerEvent) => {
    if (dialog.open) pressedOutside = isOutside(e)
  }
  const onUp = (e: PointerEvent) => {
    if (dialog.open && pressedOutside && isOutside(e)) {
      dialog.close('')
    }
    pressedOutside = false
  }
  dialog.addEventListener('pointerdown', onDown)
  dialog.addEventListener('pointerup', onUp)
  return () => {
    dialog.removeEventListener('pointerdown', onDown)
    dialog.removeEventListener('pointerup', onUp)
  }
}

type StudentFilterType = 'todos' | 'aprova' | 'recusa' | 'neutro' | 'pendente' | 'obs' | 'pago'

interface PerComunicadoUIState {
  statusFilter: StudentFilterType
  opcaoIdFilter: string | null
  turmaFilter: string
  search: string
  page: number
}

const DEFAULT_COM_UI: PerComunicadoUIState = {
  statusFilter: 'todos',
  opcaoIdFilter: null,
  turmaFilter: 'todas',
  search: '',
  page: 1,
}

const STUDENTS_PER_PAGE = 25

export function ComunicadosAutorizacoesTab({
  initialComunicadoId,
  onCountsChange,
}: ComunicadosAutorizacoesTabProps) {
  const [statusGlobal, setStatusGlobal] = useState<'todos' | 'abertos' | 'pendentes' | 'encerrados'>('todos')
  const [tipoGlobal, setTipoGlobal] = useState<string>('todos')
  const [turmaGlobal, setTurmaGlobal] = useState<string>('todas')
  const [buscaGlobal, setBuscaGlobal] = useState<string>('')

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    initialComunicadoId ? new Set([initialComunicadoId]) : new Set()
  )
  const hasAutoExpandedRef = useRef<boolean>(Boolean(initialComunicadoId))
  const [perComState, setPerComState] = useState<Record<string, PerComunicadoUIState>>({})

  // Dialog 1: Comprovante Individual de Assinatura
  const receiptDialogRef = useRef<HTMLDialogElement | null>(null)
  const receiptTitleId = useId()
  const [selectedReceipt, setSelectedReceipt] = useState<{
    com: RelatorioAutorizacaoComunicadoItem
    aluno: RelatorioAutorizacaoAlunoItem
  } | null>(null)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [copyStatusMsg, setCopyStatusMsg] = useState('')
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCopyMsgRef = useRef<string>('')

  // Dialog 2: Termo de Consentimento Completo
  const termoDialogRef = useRef<HTMLDialogElement | null>(null)
  const termoTitleId = useId()
  const [selectedTermoCom, setSelectedTermoCom] = useState<RelatorioAutorizacaoComunicadoItem | null>(null)

  // Dialog 3: Gerenciar Prazo / Encerrar / Reabrir
  const prazoDialogRef = useRef<HTMLDialogElement | null>(null)
  const prazoTitleId = useId()
  const prazoDateId = useId()
  const [prazoTarget, setPrazoTarget] = useState<{
    com: RelatorioAutorizacaoComunicadoItem
    mode: 'deadline' | 'reopen'
  } | null>(null)
  const [draftDataLimite, setDraftDataLimite] = useState('')
  const [draftSemPrazo, setDraftSemPrazo] = useState(false)
  const [prazoError, setPrazoError] = useState<string | null>(null)
  const [isSavingPrazo, setIsSavingPrazo] = useState(false)

  // Dialog 4: Enviar Lembrete Push para Pendentes
  const reminderDialogRef = useRef<HTMLDialogElement | null>(null)
  const reminderTitleId = useId()
  const reminderMsgId = useId()
  const [reminderTargetCom, setReminderTargetCom] = useState<RelatorioAutorizacaoComunicadoItem | null>(null)
  const [reminderCustomMsg, setReminderCustomMsg] = useState('')
  const [isSendingReminder, setIsSendingReminder] = useState(false)

  const globalSearchId = useId()
  const globalTipoId = useId()
  const globalTurmaId = useId()

  const { data, isLoading, isFetching, refetch } = useQuery<RelatorioComunicadosApiPayload>({
    queryKey: ['agenda', 'admin', 'autorizacoes-comunicados'],
    queryFn: async () => {
      const res = await apiFetch('/api/agenda/autorizacoes/relatorio')
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erro ao carregar relatórios de autorizações dos comunicados.')
      }
      return res.json()
    },
    staleTime: 20_000,
  })

  // Notificar contadores para o cabeçalho de abas superior
  useEffect(() => {
    if (data?.kpis && onCountsChange) {
      onCountsChange({
        totalComunicados: data.kpis.totalComunicados,
        comunicadosAbertos: data.kpis.comunicadosAbertos,
        pendentesEmAberto: data.kpis.totalPendentesEmAberto,
      })
    }
  }, [data?.kpis, onCountsChange])

  // Auto-expandir o primeiro comunicado disponível na primeira carga para experiência imediata
  useEffect(() => {
    if (hasAutoExpandedRef.current) return
    if (data?.comunicados && data.comunicados.length > 0) {
      hasAutoExpandedRef.current = true
      const firstOpen = data.comunicados.find((c) => !c.autorizacao.isClosed) || data.comunicados[0]
      setExpandedIds(new Set([firstOpen.comunicadoId]))
    }
  }, [data?.comunicados])

  // Se initialComunicadoId mudar na URL
  useEffect(() => {
    if (initialComunicadoId) {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        next.add(initialComunicadoId)
        return next
      })
    }
  }, [initialComunicadoId])

  // Realtime quando comunicados receberem novas assinaturas
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const triggerRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        refetch()
      }, 700)
    }

    const channel = supabase
      .channel('ad_admin_aut_comunicados_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comunicados' }, triggerRefresh)
      .subscribe()

    const onPull = () => refetch()
    window.addEventListener('ad:pull-to-refresh', onPull)

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      window.removeEventListener('ad:pull-to-refresh', onPull)
      supabase.removeChannel(channel)
    }
  }, [refetch])

  // Configurar eventos close + fallback light-dismiss nos 4 <dialog> nativos
  useEffect(() => {
    const cleanups: Array<(() => void) | undefined> = []

    const bindDialog = (
      dialog: HTMLDialogElement | null,
      onClosedStateReset: () => void
    ) => {
      if (!dialog) return
      const onClose = () => {
        dialog.returnValue = ''
        onClosedStateReset()
      }
      dialog.addEventListener('close', onClose)
      const removeLightDismiss = attachLightDismissFallback(dialog)
      cleanups.push(() => {
        dialog.removeEventListener('close', onClose)
        removeLightDismiss?.()
      })
    }

    bindDialog(receiptDialogRef.current, () => setSelectedReceipt(null))
    bindDialog(termoDialogRef.current, () => setSelectedTermoCom(null))
    bindDialog(prazoDialogRef.current, () => {
      setPrazoTarget(null)
      setPrazoError(null)
    })
    bindDialog(reminderDialogRef.current, () => {
      setReminderTargetCom(null)
      setReminderCustomMsg('')
    })

    return () => {
      cleanups.forEach((fn) => fn?.())
    }
  }, [])

  const kpis = data?.kpis || {
    totalComunicados: 0,
    comunicadosAbertos: 0,
    comunicadosEncerrados: 0,
    totalDestinatariosGeral: 0,
    totalAssinaturasColetadas: 0,
    totalAprovadosGeral: 0,
    totalRecusadosGeral: 0,
    totalPendentesEmAberto: 0,
    totalComObservacoesGeral: 0,
    taxaAdesaoMedia: 0,
  }

  const turmasDisponiveis = data?.turmas || []

  const getComUI = useCallback(
    (comId: string): PerComunicadoUIState => {
      return perComState[comId] || DEFAULT_COM_UI
    },
    [perComState]
  )

  const updateComUI = useCallback(
    (comId: string, patch: Partial<PerComunicadoUIState>) => {
      setPerComState((prev) => {
        const cur = prev[comId] || DEFAULT_COM_UI
        const resetPage =
          patch.page === undefined &&
          (patch.statusFilter !== undefined ||
            patch.opcaoIdFilter !== undefined ||
            patch.turmaFilter !== undefined ||
            patch.search !== undefined)
        return {
          ...prev,
          [comId]: {
            ...cur,
            ...patch,
            ...(resetPage ? { page: 1 } : {}),
          },
        }
      })
    },
    []
  )

  const toggleExpand = (comId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(comId)) next.delete(comId)
      else next.add(comId)
      return next
    })
  }

  const filteredComunicados = useMemo(() => {
    const list = data?.comunicados || []
    const q = buscaGlobal.trim().toLowerCase()

    return list.filter((com) => {
      if (statusGlobal === 'abertos' && com.autorizacao.isClosed) return false
      if (statusGlobal === 'encerrados' && !com.autorizacao.isClosed) return false
      if (
        statusGlobal === 'pendentes' &&
        (com.autorizacao.isClosed || com.metricas.totalPendentes === 0)
      ) {
        return false
      }

      if (tipoGlobal !== 'todos' && com.autorizacao.tipoAutorizacao !== tipoGlobal) {
        return false
      }

      if (turmaGlobal !== 'todas') {
        const hasTurma =
          com.turmasAlvo.includes(turmaGlobal) ||
          com.itensAlunos.some((a) => a.alunoTurma === turmaGlobal)
        if (!hasTurma) return false
      }

      if (q) {
        const metaMatch = [
          com.autorizacao.titulo,
          com.comunicadoTitulo,
          com.comunicadoAutor,
          com.autorizacao.localEvento,
          com.comunicadoDestinoLabel,
          ...com.turmasAlvo,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(q)

        if (!metaMatch) {
          const studentMatch = com.itensAlunos.some((a) =>
            [a.alunoNome, a.alunoMatricula, a.assinanteNome, a.protocoloToken, a.observacoes]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(q)
          )
          if (!studentMatch) return false
        }
      }

      return true
    })
  }, [data?.comunicados, statusGlobal, tipoGlobal, turmaGlobal, buscaGlobal])

  // Abrir Dialogs
  const openReceiptDialog = (
    com: RelatorioAutorizacaoComunicadoItem,
    aluno: RelatorioAutorizacaoAlunoItem
  ) => {
    setSelectedReceipt({ com, aluno })
    setCopyState('idle')
    setCopyStatusMsg('')
    const d = receiptDialogRef.current
    if (d && !d.open) d.showModal()
  }

  const closeReceiptDialog = () => {
    const d = receiptDialogRef.current
    if (d && d.open) d.close('')
    setSelectedReceipt(null)
  }

  const openTermoDialog = (com: RelatorioAutorizacaoComunicadoItem) => {
    setSelectedTermoCom(com)
    const d = termoDialogRef.current
    if (d && !d.open) d.showModal()
  }

  const closeTermoDialog = () => {
    const d = termoDialogRef.current
    if (d && d.open) d.close('')
    setSelectedTermoCom(null)
  }

  const getLocalTodayYmd = () => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const openPrazoDialog = (
    com: RelatorioAutorizacaoComunicadoItem,
    mode: 'deadline' | 'reopen'
  ) => {
    const today = getLocalTodayYmd()
    const curYmd = com.autorizacao.dataLimite ? String(com.autorizacao.dataLimite).slice(0, 10) : ''
    const validFuture = /^\d{4}-\d{2}-\d{2}$/.test(curYmd) && curYmd >= today
    setDraftDataLimite(validFuture ? curYmd : '')
    setDraftSemPrazo(mode === 'deadline' && !com.autorizacao.dataLimite)
    setPrazoError(null)
    setPrazoTarget({ com, mode })
    const d = prazoDialogRef.current
    if (d && !d.open) d.showModal()
  }

  const closePrazoDialog = () => {
    const d = prazoDialogRef.current
    if (d && d.open) d.close('')
    setPrazoTarget(null)
    setPrazoError(null)
  }

  const handleQuickCloseAutorizacao = async (com: RelatorioAutorizacaoComunicadoItem) => {
    try {
      const res = await apiFetch('/api/agenda/autorizacoes/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comunicadoId: com.comunicadoId, encerrada: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Não foi possível encerrar a autorização.')
      }
      toast.success('Coleta de assinaturas encerrada com sucesso!')
      refetch()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao encerrar autorização.')
    }
  }

  const handleSavePrazo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prazoTarget || isSavingPrazo) return
    const today = getLocalTodayYmd()

    if (!draftSemPrazo) {
      const trimmed = draftDataLimite.trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || trimmed < today) {
        setPrazoError('Escolha a data de hoje ou uma data futura, ou marque "Sem data limite".')
        return
      }
    }

    setIsSavingPrazo(true)
    setPrazoError(null)
    try {
      const res = await apiFetch('/api/agenda/autorizacoes/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comunicadoId: prazoTarget.com.comunicadoId,
          encerrada: false,
          dataLimite: draftSemPrazo ? null : draftDataLimite.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        setPrazoError(json.error || 'Erro ao atualizar prazo.')
        return
      }
      toast.success(
        prazoTarget.mode === 'reopen'
          ? 'Autorização reaberta com sucesso!'
          : 'Prazo da autorização atualizado!'
      )
      closePrazoDialog()
      refetch()
    } catch (err: any) {
      setPrazoError(err?.message || 'Erro ao salvar prazo.')
    } finally {
      setIsSavingPrazo(false)
    }
  }

  const openReminderDialog = (com: RelatorioAutorizacaoComunicadoItem) => {
    setReminderTargetCom(com)
    setReminderCustomMsg('')
    const d = reminderDialogRef.current
    if (d && !d.open) d.showModal()
  }

  const closeReminderDialog = () => {
    const d = reminderDialogRef.current
    if (d && d.open) d.close('')
    setReminderTargetCom(null)
    setReminderCustomMsg('')
  }

  const handleSendPendingReminder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reminderTargetCom || isSendingReminder) return
    setIsSendingReminder(true)
    try {
      const res = await apiFetch('/api/comunicados/lembrete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reminderTargetCom.comunicadoId,
          mode: 'unanswered_auth',
          customMessage: reminderCustomMsg.trim() || undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        toast.error(json.error || 'Não foi possível enviar o lembrete push.')
        return
      }
      toast.success(json.message || 'Lembrete enviado às famílias pendentes!')
      closeReminderDialog()
      refetch()
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao disparar lembrete.')
    } finally {
      setIsSendingReminder(false)
    }
  }

  const handleCopyToken = async (token: string) => {
    if (!token) return
    clearTimeout(copyTimerRef.current ?? undefined)
    let ok = false
    try {
      await navigator.clipboard.writeText(token)
      ok = true
    } catch {
      ok = legacyCopyText(token)
    }
    let msg = ok ? 'Protocolo copiado' : 'Falha ao copiar'
    if (msg === lastCopyMsgRef.current) msg += '\u00A0'
    lastCopyMsgRef.current = msg
    setCopyState(ok ? 'copied' : 'failed')
    setCopyStatusMsg('')
    requestAnimationFrame(() => setCopyStatusMsg(msg))
    copyTimerRef.current = setTimeout(() => {
      setCopyState('idle')
      setCopyStatusMsg('')
    }, 2200)
  }

  // Exportação Excel Consolidada Geral (Todos os Comunicados filtrados)
  const handleExportGlobalExcel = () => {
    if (filteredComunicados.length === 0) {
      toast.info('Nenhum comunicado encontrado para exportar.')
      return
    }

    const resumoRows = filteredComunicados.map((c) => ({
      Autorizacao: c.autorizacao.titulo,
      Categoria: TIPO_AUTORIZACAO_META[c.autorizacao.tipoAutorizacao]?.label || c.autorizacao.tipoAutorizacao,
      ComunicadoOrigem: c.comunicadoTitulo,
      Autor: c.comunicadoAutor,
      DataEnvio: c.comunicadoDataEnvioFormatada,
      PublicoAlvo: c.comunicadoDestinoLabel,
      LocalEvento: c.autorizacao.localEvento || '-',
      DataEvento: c.autorizacao.dataEventoFormatada || '-',
      Valor: c.autorizacao.valor || '-',
      PrazoLimite: c.autorizacao.dataLimiteFormatada || 'Sem limite',
      Situacao: c.autorizacao.isClosed ? 'Encerrada' : 'Aberta',
      Destinatarios: c.metricas.totalDestinatarios,
      Assinados: c.metricas.totalRespondidos,
      Aprovados: c.metricas.totalAprovados,
      Recusados: c.metricas.totalRecusados,
      Pendentes: c.metricas.totalPendentes,
      AdesaoPercentual: `${c.metricas.percentAdesao}%`,
      ComObservacoes: c.metricas.totalComObservacoes,
    }))

    const detalhadoRows: Record<string, any>[] = []
    filteredComunicados.forEach((c) => {
      c.itensAlunos.forEach((a) => {
        detalhadoRows.push({
          Autorizacao: c.autorizacao.titulo,
          Comunicado: c.comunicadoTitulo,
          Turma: a.alunoTurma,
          Aluno: a.alunoNome,
          Matricula: a.alunoMatricula,
          Situacao:
            a.statusResposta === 'aprova'
              ? 'Autorizado (Aprova)'
              : a.statusResposta === 'recusa'
                ? 'Não Autorizado (Recusa)'
                : a.statusResposta === 'neutro'
                  ? 'Respondido (Outra opção)'
                  : 'Pendente (Sem assinatura)',
          OpcaoEscolhida: a.opcaoTexto || '-',
          ResponsavelSignatario: a.assinanteNome || a.responsavelPrincipalNome || '-',
          CPFResponsavel: a.assinanteCpf || '-',
          TelefoneContato: a.responsavelPrincipalTelefone || '-',
          DataHoraAssinatura: a.respondidoEmFormatado || '-',
          LeuComunicado: a.leuComunicado ? 'Sim' : 'Não',
          ObservacoesRestricoes: a.observacoes || '',
          Pagamento:
            a.pagamentoStatus === 'pago'
              ? 'Pago'
              : a.pagamentoStatus === 'pendente'
                ? 'Pendente'
                : 'N/A',
          ProtocoloDigital: a.protocoloToken || '-',
        })
      })
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumoRows), 'Resumo por Comunicado')
    if (detalhadoRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detalhadoRows), 'Todos os Alunos')
    }
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE }).format(new Date())
    XLSX.writeFile(wb, `relatorio_autorizacoes_comunicados_${ymd}.xlsx`)
    toast.success('Relatório consolidado exportado com sucesso!')
  }

  // Exportação Excel Individual de UM Comunicado (Múltiplas Abas Úteis)
  const handleExportSingleComunicadoExcel = (com: RelatorioAutorizacaoComunicadoItem) => {
    const mapStudentRow = (a: RelatorioAutorizacaoAlunoItem) => ({
      Turma: a.alunoTurma,
      Aluno: a.alunoNome,
      Matricula: a.alunoMatricula,
      Situacao:
        a.statusResposta === 'aprova'
          ? 'Autorizado'
          : a.statusResposta === 'recusa'
            ? 'Recusado'
            : a.statusResposta === 'neutro'
              ? 'Outra Opção'
              : 'Pendente',
      OpcaoEscolhida: a.opcaoTexto || 'Aguardando assinatura',
      ResponsavelAssinatura: a.assinanteNome || '-',
      CPF: a.assinanteCpf || '-',
      DataHoraAssinatura: a.respondidoEmFormatado || '-',
      ObservacoesMedicasRecados: a.observacoes || '',
      ResponsavelContato: a.responsavelPrincipalNome || '-',
      TelefoneContato: a.responsavelPrincipalTelefone || '-',
      VisualizouComunicado: a.leuComunicado ? 'Sim' : 'Não',
      ...(com.metricas.hasCobranca
        ? {
            Financeiro:
              a.pagamentoStatus === 'pago' ? 'Pago' : 'Pendente',
          }
        : {}),
      ProtocoloDigital: a.protocoloToken || '-',
    })

    const todosRows = com.itensAlunos.map(mapStudentRow)
    const aprovadosRows = com.itensAlunos
      .filter((a) => a.statusResposta === 'aprova')
      .map(mapStudentRow)
    const pendentesRows = com.itensAlunos
      .filter((a) => a.statusResposta === 'pendente')
      .map((a) => ({
        Turma: a.alunoTurma,
        Aluno: a.alunoNome,
        Matricula: a.alunoMatricula,
        Responsavel: a.responsavelPrincipalNome || '-',
        Parentesco: a.responsavelPrincipalParentesco || '-',
        TelefoneWhatsApp: a.responsavelPrincipalTelefone || '-',
        JaVisualizouComunicado: a.leuComunicado ? 'Sim (leu e não assinou)' : 'Não abriu o comunicado',
      }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(todosRows.length > 0 ? todosRows : [{ Aviso: 'Sem destinatários' }]),
      'Lista Completa'
    )
    if (aprovadosRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aprovadosRows), 'Autorizados (Embarque)')
    }
    if (pendentesRows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pendentesRows), 'Pendentes c Contato')
    }

    const safeSlug = com.autorizacao.titulo
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 36)
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: SCHOOL_TIMEZONE }).format(new Date())
    XLSX.writeFile(wb, `autorizacao_${safeSlug || 'comunicado'}_${ymd}.xlsx`)
    toast.success(`Planilha de "${com.autorizacao.titulo}" exportada!`)
  }

  // Impressão de Lista Consolidada / Mapa de Conferência do Comunicado
  const handlePrintComunicadoReport = (
    com: RelatorioAutorizacaoComunicadoItem,
    rowsToPrint: RelatorioAutorizacaoAlunoItem[],
    activeFilterLabel: string
  ) => {
    const win = window.open('', '_blank', 'width=980,height=760')
    if (!win) {
      toast.error('Permita pop-ups para imprimir ou salvar a lista em PDF.')
      return
    }

    const rowsHtml = rowsToPrint
      .map((a, idx) => {
        const badgeClass =
          a.statusResposta === 'aprova'
            ? 'b-ok'
            : a.statusResposta === 'recusa'
              ? 'b-no'
              : a.statusResposta === 'neutro'
                ? 'b-neu'
                : 'b-pend'
        const statusText =
          a.statusResposta === 'pendente'
            ? 'PENDENTE'
            : escapeHtml(a.opcaoTexto || a.statusResposta.toUpperCase())
        const signerInfo =
          a.statusResposta === 'pendente'
            ? `<span class="muted">${escapeHtml(a.responsavelPrincipalNome || 'Sem contato')} ${
                a.responsavelPrincipalTelefone ? `• ${escapeHtml(a.responsavelPrincipalTelefone)}` : ''
              }</span>`
            : `<strong>${escapeHtml(a.assinanteNome)}</strong>${
                a.assinanteCpf ? `<br/><span class="muted">CPF ${escapeHtml(a.assinanteCpf)}</span>` : ''
              }`

        return `<tr>
          <td class="c">${idx + 1}</td>
          <td><strong>${escapeHtml(a.alunoNome)}</strong><br/><span class="muted">#${escapeHtml(a.alunoMatricula)}</span></td>
          <td>${escapeHtml(a.alunoTurma)}</td>
          <td><span class="badge ${badgeClass}">${statusText}</span></td>
          ${
            com.metricas.hasCobranca
              ? `<td class="c"><span class="badge ${
                  a.pagamentoStatus === 'pago' ? 'b-ok' : 'b-pend'
                }">${a.pagamentoStatus === 'pago' ? 'PAGO' : 'PENDENTE'}</span></td>`
              : ''
          }
          <td>${signerInfo}</td>
          <td>${
            a.respondidoEmFormatado
              ? `${escapeHtml(a.respondidoEmFormatado)}<br/><span class="mono">${escapeHtml(
                  a.protocoloToken || ''
                )}</span>`
              : `<span class="muted">${a.leuComunicado ? 'Leu comunicado' : 'Não visualizou'}</span>`
          }</td>
          <td>${
            a.observacoes
              ? `<div class="obs">${escapeHtml(a.observacoes)}</div>`
              : '<span class="muted">—</span>'
          }</td>
        </tr>`
      })
      .join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório - ${escapeHtml(com.autorizacao.titulo)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif; color: #0f172a; margin: 0; padding: 16px; background: #fff; }
    @media print { body { padding: 0; } }
    .hdr { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 12px; gap: 16px; }
    .hdr h1 { margin: 0; font-size: 16px; font-weight: 800; }
    .hdr p { margin: 3px 0 0; font-size: 11px; color: #475569; }
    .meta { font-size: 10px; color: #64748b; text-align: right; white-space: nowrap; }
    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(125px, 1fr)); gap: 8px; margin-bottom: 12px; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 7px 10px; background: #f8fafc; font-size: 10px; font-weight: 700; color: #475569; }
    .kpi b { display: block; font-size: 15px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: middle; }
    th { background: #f1f5f9; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.03em; font-weight: 800; color: #334155; }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .c { text-align: center; }
    .muted { color: #64748b; font-size: 9.5px; }
    .mono { font-family: monospace; font-size: 9px; color: #475569; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 9px; font-weight: 800; }
    .b-ok { background: #dcfce7; color: #166534; }
    .b-no { background: #fee2e2; color: #991b1b; }
    .b-neu { background: #e0e7ff; color: #3730a3; }
    .b-pend { background: #fef3c7; color: #92400e; }
    .obs { background: #fffbeb; border-left: 3px solid #f59e0b; padding: 3px 6px; font-size: 9.5px; font-weight: 700; color: #92400e; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="hdr">
    <div>
      <h1>Colégio Impacto — Relatório de Autorização Digital (${escapeHtml(com.autorizacao.titulo)})</h1>
      <p>
        <strong>Comunicado:</strong> ${escapeHtml(com.comunicadoTitulo)} • <strong>Autor:</strong> ${escapeHtml(com.comunicadoAutor)}
        ${com.autorizacao.localEvento ? ` • <strong>Local:</strong> ${escapeHtml(com.autorizacao.localEvento)}` : ''}
        ${com.autorizacao.dataEventoFormatada ? ` • <strong>Data do Evento:</strong> ${escapeHtml(com.autorizacao.dataEventoFormatada)}` : ''}
        ${com.autorizacao.valor ? ` • <strong>Valor:</strong> ${escapeHtml(com.autorizacao.valor)}` : ''}
      </p>
      <p><strong>Recorte impresso:</strong> ${escapeHtml(activeFilterLabel)} (${rowsToPrint.length} aluno(s))</p>
    </div>
    <div class="meta">
      Emitido em ${escapeHtml(formatDateTimeSchoolBR(new Date().toISOString()))}<br/>
      Agenda Digital • Controle Oficial
    </div>
  </div>
  <div class="kpis">
    <div class="kpi">Público-Alvo<b>${com.metricas.totalDestinatarios}</b></div>
    <div class="kpi" style="background:#f0fdf4;border-color:#bbf7d0;color:#166534;">Autorizados<b style="color:#166534;">${com.metricas.totalAprovados} (${com.metricas.percentAprovadosSobreTotal}%)</b></div>
    <div class="kpi" style="background:#fef2f2;border-color:#fecaca;color:#991b1b;">Não Autorizados<b style="color:#991b1b;">${com.metricas.totalRecusados}</b></div>
    <div class="kpi" style="background:#fffbeb;border-color:#fde68a;color:#92400e;">Pendentes<b style="color:#92400e;">${com.metricas.totalPendentes}</b></div>
    <div class="kpi">Com Observações<b>${com.metricas.totalComObservacoes}</b></div>
  </div>
  <table>
    <thead>
      <tr>
        <th class="c" style="width:34px;">#</th>
        <th style="width:20%;">Aluno(a)</th>
        <th style="width:12%;">Turma</th>
        <th style="width:13%;">Decisão / Status</th>
        ${com.metricas.hasCobranca ? '<th class="c" style="width:8%;">Pagto.</th>' : ''}
        <th style="width:18%;">Responsável</th>
        <th style="width:15%;">Assinatura / Protocolo</th>
        <th>Observações / Alergias</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body>
</html>`

    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  // Impressão do Comprovante Individual de Assinatura Digital do Comunicado
  const handlePrintSingleReceipt = (
    com: RelatorioAutorizacaoComunicadoItem,
    aluno: RelatorioAutorizacaoAlunoItem
  ) => {
    const win = window.open('', '_blank', 'width=820,height=740')
    if (!win) {
      toast.error('Permita pop-ups para imprimir o comprovante individual.')
      return
    }
    const isOk = aluno.statusResposta === 'aprova'
    const isNo = aluno.statusResposta === 'recusa'
    const statusColor = isOk ? '#047857' : isNo ? '#be123c' : '#3730a3'
    const statusBg = isOk ? '#ecfdf5' : isNo ? '#fff1f2' : '#eef2ff'

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Comprovante ${escapeHtml(aluno.protocoloToken || '')} - Colégio Impacto</title>
  <style>
    body { font-family: 'Inter', system-ui, sans-serif; color: #0f172a; margin: 0; padding: 28px; background: #fff; }
    .sheet { max-width: 720px; margin: 0 auto; border: 1.5px solid #cbd5e1; border-radius: 16px; overflow: hidden; }
    .top { background: linear-gradient(135deg, #065f46 0%, #059669 100%); color: #fff; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
    .top h1 { margin: 0; font-size: 17px; font-weight: 800; }
    .top p { margin: 4px 0 0; font-size: 12px; opacity: 0.92; }
    .proto { font-family: monospace; font-size: 11.5px; background: rgba(255,255,255,0.18); padding: 6px 10px; border-radius: 8px; font-weight: 700; }
    .body { padding: 22px 24px; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 800; color: ${statusColor}; background: ${statusBg}; border: 1px solid ${statusColor}33; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 18px; }
    .cell { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 13px; }
    .lbl { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em; }
    .val { font-size: 13px; font-weight: 700; color: #0f172a; margin-top: 3px; }
    .termo { font-size: 12px; line-height: 1.55; color: #334155; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #059669; padding: 12px 14px; border-radius: 8px; margin-bottom: 18px; }
    .sig { border: 1px dashed #94a3b8; border-radius: 12px; padding: 14px; text-align: center; background: #f8fafc; }
    .foot { font-size: 10.5px; color: #64748b; margin-top: 16px; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 10px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <h1>Colégio Impacto — Comprovante de Autorização Digital</h1>
        <p>${escapeHtml(com.autorizacao.titulo)} (${escapeHtml(com.comunicadoTitulo)})</p>
      </div>
      ${aluno.protocoloToken ? `<div class="proto">${escapeHtml(aluno.protocoloToken)}</div>` : ''}
    </div>
    <div class="body">
      <div class="badge">${escapeHtml(aluno.opcaoTexto || aluno.statusResposta.toUpperCase())}</div>
      <div class="grid">
        <div class="cell"><div class="lbl">Aluno(a)</div><div class="val">${escapeHtml(aluno.alunoNome)} (#${escapeHtml(aluno.alunoMatricula)})</div></div>
        <div class="cell"><div class="lbl">Turma</div><div class="val">${escapeHtml(aluno.alunoTurma)}</div></div>
        <div class="cell"><div class="lbl">Responsável Signatário</div><div class="val">${escapeHtml(aluno.assinanteNome)}${aluno.assinanteCpf ? ` • CPF ${escapeHtml(aluno.assinanteCpf)}` : ''}</div></div>
        <div class="cell"><div class="lbl">Data e Hora da Assinatura</div><div class="val">${escapeHtml(aluno.respondidoEmFormatado || '-')}</div></div>
        ${com.autorizacao.localEvento ? `<div class="cell"><div class="lbl">Local / Destino</div><div class="val">${escapeHtml(com.autorizacao.localEvento)}</div></div>` : ''}
        ${com.autorizacao.dataEventoFormatada ? `<div class="cell"><div class="lbl">Data do Evento</div><div class="val">${escapeHtml(com.autorizacao.dataEventoFormatada)}</div></div>` : ''}
      </div>
      <div class="lbl" style="margin-bottom:6px;">Termo de Consentimento Aceito / Respondido</div>
      <div class="termo">${formatAutorizacaoTermoHtml(com.autorizacao.termoTexto)}</div>
      ${aluno.observacoes ? `<div class="cell" style="margin-bottom:16px;background:#fffbeb;border-color:#fde68a;"><div class="lbl" style="color:#92400e;">Observação / Restrição Informada pelo Responsável</div><div class="val" style="color:#78350f;">${escapeHtml(aluno.observacoes)}</div></div>` : ''}
      <div class="sig">
        <div style="font-size:13px;font-weight:800;color:#0f172a;">Assinado eletronicamente por ${escapeHtml(aluno.assinanteNome)}</div>
        <div style="font-size:11.5px;color:#475569;margin-top:4px;">Token de autenticidade: <strong>${escapeHtml(aluno.protocoloToken || 'REGISTRO-DIGITAL')}</strong></div>
      </div>
      <div class="foot">
        <span>Agenda Digital • Colégio Impacto</span>
        <span>Impresso em ${escapeHtml(formatDateTimeSchoolBR(new Date().toISOString()))}</span>
      </div>
    </div>
  </div>
  <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 250); };</script>
</body>
</html>`
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  return (
    <div className="ad-com-aut-root" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .ad-com-aut-root {
              container: com-aut-hub / inline-size;
            }
            .ad-com-aut-kpis {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
              gap: 12px;
            }
            @container com-aut-hub (inline-size < 900px) {
              .ad-com-aut-kpis {
                grid-template-columns: repeat(2, minmax(0, 1fr));
              }
            }
            @container com-aut-hub (inline-size < 520px) {
              .ad-com-aut-kpis {
                grid-template-columns: 1fr 1fr;
                gap: 9px;
              }
              .ad-com-header-card {
                padding: 14px 15px !important;
              }
              .ad-com-header-actions {
                width: 100%;
              }
              .ad-com-header-actions > button {
                flex: 1;
                justify-content: center;
              }
            }
            .ad-com-table-region {
              overflow-x: auto;
              max-inline-size: 100%;
              container: stu-table / inline-size;
              border-radius: 14px;
              border: 1px solid #e2e8f0;
              background: #ffffff;
            }
            .ad-com-table {
              width: 100%;
              border-collapse: separate;
              border-spacing: 0;
              font-size: 12.5px;
            }
            .ad-com-table thead {
              position: sticky;
              inset-block-start: 0;
              z-index: 2;
              background: #f8fafc;
            }
            .ad-com-table th {
              padding: 10px 14px;
              text-align: left;
              font-size: 10.5px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              color: #64748b;
              border-bottom: 1px solid #e2e8f0;
            }
            .ad-com-table tbody th {
              font-size: 13px;
              text-transform: none;
              letter-spacing: normal;
              color: #0f172a;
              background: #ffffff;
            }
            .ad-com-table td, .ad-com-table tbody th {
              padding: 11px 14px;
              border-bottom: 1px solid #f1f5f9;
              vertical-align: middle;
            }
            .ad-com-table tbody tr:last-child td,
            .ad-com-table tbody tr:last-child th {
              border-bottom: none;
            }
            .ad-com-table tbody tr:hover td,
            .ad-com-table tbody tr:hover th {
              background: #f8fafc;
            }
            @container stu-table (inline-size < 720px) {
              .ad-com-table,
              .ad-com-table tbody,
              .ad-com-table tr,
              .ad-com-table tbody th,
              .ad-com-table td {
                display: block;
                width: 100%;
              }
              .ad-com-table thead {
                display: none;
              }
              .ad-com-table tbody tr {
                padding: 12px 14px;
                border-bottom: 1px solid #e2e8f0;
              }
              .ad-com-table tbody th {
                padding: 0 0 8px 0;
                border-bottom: 1px dashed #e2e8f0;
                margin-bottom: 8px;
                background: transparent !important;
              }
              .ad-com-table td {
                padding: 5px 0;
                border-bottom: none;
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 10px;
                background: transparent !important;
              }
              .ad-com-table td[data-label]::before {
                content: attr(data-label) ": ";
                font-size: 10.5px;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.04em;
                color: #64748b;
                flex-shrink: 0;
                padding-top: 2px;
              }
              .ad-com-table td.ad-com-td-actions {
                margin-top: 6px;
                padding-top: 8px;
                border-top: 1px solid #f1f5f9;
                justify-content: flex-end;
              }
            }
            .ad-com-scroller {
              display: flex;
              align-items: center;
              gap: 6px;
              overflow-x: auto;
              scrollbar-width: none;
              -ms-overflow-style: none;
              padding-bottom: 2px;
            }
            .ad-com-scroller::-webkit-scrollbar {
              display: none;
            }
          `,
        }}
      />

      {/* Cabeçalho da Aba de Comunicados */}
      <div
        className="ad-com-header-card"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 20,
          padding: '18px 22px',
          boxShadow: '0 4px 18px -6px rgba(15, 23, 42, 0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: '1 1 280px' }}>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 18px -4px rgba(5, 150, 105, 0.32)',
              flexShrink: 0,
            }}
          >
            <FileCheck2 size={22} strokeWidth={2.3} aria-hidden="true" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18.5,
                  fontWeight: 900,
                  color: '#0f172a',
                  lineHeight: 1.2,
                  textWrap: 'balance',
                }}
              >
                Autorizações Digitais nos Comunicados
              </h2>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: '#ecfdf5',
                  color: '#047857',
                  border: '1px solid #a7f3d0',
                }}
              >
                {filteredComunicados.length}{' '}
                {filteredComunicados.length === 1 ? 'comunicado' : 'comunicados'}
              </span>
            </div>
            <p
              style={{
                margin: '3px 0 0 0',
                fontSize: 12.5,
                color: '#64748b',
                fontWeight: 500,
                textWrap: 'pretty',
              }}
            >
              Relatórios separados por comunicado: acompanhe assinaturas, recusas, pendências familiares, observações e comprovantes.
            </p>
          </div>
        </div>

        <div
          className="ad-com-header-actions"
          style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
        >
          <button
            type="button"
            onClick={handleExportGlobalExcel}
            className="ad-aut-focusable ad-aut-touch"
            style={{
              minBlockSize: 'var(--ad-aut-target, 38px)',
              padding: '0 14px',
              borderRadius: 11,
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <FileSpreadsheet size={15} color="#059669" aria-hidden="true" />
            <span>Exportar Consolidado</span>
          </button>

          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="ad-aut-focusable ad-aut-touch"
            style={{
              minBlockSize: 'var(--ad-aut-target, 38px)',
              padding: '0 14px',
              borderRadius: 11,
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
              color: '#ffffff',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: isFetching ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 6px 14px -4px rgba(5, 150, 105, 0.35)',
            }}
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} aria-hidden="true" />
            <span>{isFetching ? 'Atualizando...' : 'Atualizar'}</span>
          </button>
        </div>
      </div>

      {/* KPIs Globais dos Comunicados */}
      <div className="ad-com-aut-kpis">
        {[
          {
            label: 'Comunicados c/ Termo',
            value: kpis.totalComunicados,
            sub: `${kpis.comunicadosAbertos} abertos • ${kpis.comunicadosEncerrados} encerrados`,
            color: '#059669',
            bg: '#ecfdf5',
            icon: <FileCheck2 size={17} aria-hidden="true" />,
          },
          {
            label: 'Assinaturas Coletadas',
            value: kpis.totalAssinaturasColetadas,
            sub: `${kpis.totalAprovadosGeral} aprov. • ${kpis.totalRecusadosGeral} recus.`,
            color: '#4f46e5',
            bg: '#eef2ff',
            icon: <CheckCircle2 size={17} aria-hidden="true" />,
          },
          {
            label: 'Pendentes (Em Aberto)',
            value: kpis.totalPendentesEmAberto,
            sub: 'Aguardando resposta dos pais',
            color: '#d97706',
            bg: '#fffbeb',
            icon: <Clock size={17} aria-hidden="true" />,
          },
          {
            label: 'Adesão Geral',
            value: `${kpis.taxaAdesaoMedia}%`,
            sub: `${kpis.totalComObservacoesGeral} c/ observações/alergias`,
            color: '#0284c7',
            bg: '#e0f2fe',
            icon: <Users size={17} aria-hidden="true" />,
          },
        ].map((kpi, idx) => (
          <div
            key={idx}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: '13px 15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              boxShadow: '0 2px 10px -4px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#64748b',
                }}
              >
                {kpi.label}
              </div>
              <div
                style={{
                  fontSize: 21,
                  fontWeight: 900,
                  color: kpi.color,
                  lineHeight: 1.15,
                  marginTop: 4,
                }}
              >
                {kpi.value}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginTop: 2 }}>
                {kpi.sub}
              </div>
            </div>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: kpi.bg,
                color: kpi.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {kpi.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Barra Global de Filtros de Comunicados */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 18,
          padding: '13px 15px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxShadow: '0 2px 10px -4px rgba(15, 23, 42, 0.04)',
        }}
      >
        <div className="ad-com-scroller" role="group" aria-label="Filtrar comunicados por situação">
          {[
            { id: 'todos' as const, label: `Todos (${kpis.totalComunicados})`, color: '#334155', bg: '#f1f5f9', border: '#cbd5e1' },
            { id: 'abertos' as const, label: `Em Aberto (${kpis.comunicadosAbertos})`, color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
            { id: 'pendentes' as const, label: 'Com Pendências', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
            { id: 'encerrados' as const, label: `Encerrados (${kpis.comunicadosEncerrados})`, color: '#475569', bg: '#f8fafc', border: '#cbd5e1' },
          ].map((pill) => {
            const active = statusGlobal === pill.id
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setStatusGlobal(pill.id)}
                className="ad-aut-focusable"
                style={{
                  flex: 'none',
                  minBlockSize: 'var(--ad-aut-target, 36px)',
                  padding: '0 12px',
                  borderRadius: 10,
                  border: `1.5px solid ${active ? pill.border : '#e2e8f0'}`,
                  background: active ? pill.bg : '#ffffff',
                  color: active ? pill.color : '#64748b',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {pill.label}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <select
            id={globalTipoId}
            aria-label="Filtrar por categoria da autorização"
            value={tipoGlobal}
            onChange={(e) => setTipoGlobal(e.target.value)}
            className="ad-aut-focusable"
            style={{
              minBlockSize: 'var(--ad-aut-target, 36px)',
              padding: '0 12px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#0f172a',
              fontSize: 12.5,
              fontWeight: 600,
              flex: '1 1 170px',
            }}
          >
            <option value="todos">Todas as Categorias</option>
            <option value="passeio">Passeio / Excursão</option>
            <option value="evento">Evento Escolar</option>
            <option value="uso_imagem">Uso de Imagem</option>
            <option value="medicamento">Saúde / Medicamento</option>
            <option value="personalizado">Termo Personalizado</option>
          </select>

          <select
            id={globalTurmaId}
            aria-label="Filtrar comunicados por turma"
            value={turmaGlobal}
            onChange={(e) => setTurmaGlobal(e.target.value)}
            className="ad-aut-focusable"
            style={{
              minBlockSize: 'var(--ad-aut-target, 36px)',
              padding: '0 12px',
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#0f172a',
              fontSize: 12.5,
              fontWeight: 600,
              flex: '1 1 170px',
            }}
          >
            <option value="todas">Todas as Turmas</option>
            {turmasDisponiveis.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <div style={{ flex: '2 1 240px', minInlineSize: 0, position: 'relative' }}>
            <label
              htmlFor={globalSearchId}
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clipPath: 'inset(50%)',
              }}
            >
              Buscar comunicado, título da autorização, local, aluno ou protocolo
            </label>
            <Search
              size={15}
              color="#94a3b8"
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            />
            <input
              id={globalSearchId}
              type="search"
              value={buscaGlobal}
              onChange={(e) => setBuscaGlobal(e.target.value)}
              placeholder="Buscar comunicado, passeio, local, aluno ou protocolo..."
              className="ad-aut-focusable"
              style={{
                width: '100%',
                minBlockSize: 'var(--ad-aut-target, 36px)',
                padding: '0 12px 0 36px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: 12.5,
                fontWeight: 600,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* Lista de Comunicados Separados Individualmente */}
      {isLoading ? (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            padding: 48,
            textAlign: 'center',
            color: '#64748b',
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          Consolidando autorizações digitais por comunicado...
        </div>
      ) : filteredComunicados.length === 0 ? (
        <div
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px dashed #cbd5e1',
            padding: '44px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <SlidersHorizontal size={22} aria-hidden="true" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
            {(data?.comunicados?.length || 0) === 0
              ? 'Nenhum comunicado com autorização digital enviado ainda'
              : 'Nenhum comunicado encontrado com estes filtros'}
          </div>
          <div style={{ fontSize: 12.5, color: '#64748b', maxWidth: 460, textWrap: 'pretty' }}>
            {(data?.comunicados?.length || 0) === 0
              ? 'Ao criar um comunicado com "Nova Autorização Digital" (passeios, eventos ou termos), o relatório completo separado por comunicado aparecerá automaticamente aqui.'
              : 'Tente limpar a busca ou selecionar "Todos" nos filtros acima para visualizar todos os comunicados.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filteredComunicados.map((com) => {
            const isExpanded = expandedIds.has(com.comunicadoId)
            const ui = getComUI(com.comunicadoId)
            const effectiveTurmaFilter =
              ui.turmaFilter !== 'todas'
                ? ui.turmaFilter
                : turmaGlobal !== 'todas'
                  ? turmaGlobal
                  : 'todas'

            const tipoMeta =
              TIPO_AUTORIZACAO_META[com.autorizacao.tipoAutorizacao] ||
              TIPO_AUTORIZACAO_META.personalizado

            const m = com.metricas
            const baseTotal = Math.max(1, m.totalDestinatarios)
            const wAprova = Math.min(100, (m.totalAprovados / baseTotal) * 100)
            const wRecusa = Math.min(100 - wAprova, (m.totalRecusados / baseTotal) * 100)
            const wNeutro = Math.min(100 - wAprova - wRecusa, (m.totalNeutros / baseTotal) * 100)

            // Filtragem interna dos alunos deste comunicado
            const qInner = (ui.search || '').trim().toLowerCase()
            const filteredStudents = com.itensAlunos.filter((stu) => {
              if (effectiveTurmaFilter !== 'todas' && stu.alunoTurma !== effectiveTurmaFilter) {
                return false
              }
              if (ui.opcaoIdFilter && stu.opcaoId !== ui.opcaoIdFilter) {
                return false
              }
              if (ui.statusFilter === 'aprova' && stu.statusResposta !== 'aprova') return false
              if (ui.statusFilter === 'recusa' && stu.statusResposta !== 'recusa') return false
              if (ui.statusFilter === 'neutro' && stu.statusResposta !== 'neutro') return false
              if (ui.statusFilter === 'pendente' && stu.statusResposta !== 'pendente') return false
              if (ui.statusFilter === 'obs' && !stu.observacoes) return false
              if (ui.statusFilter === 'pago' && stu.pagamentoStatus !== 'pago') return false

              if (qInner) {
                const hay = [
                  stu.alunoNome,
                  stu.alunoMatricula,
                  stu.alunoTurma,
                  stu.assinanteNome,
                  stu.assinanteCpf,
                  stu.responsavelPrincipalNome,
                  stu.responsavelPrincipalTelefone,
                  stu.protocoloToken,
                  stu.observacoes,
                  stu.opcaoTexto,
                ]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase()
                if (!hay.includes(qInner)) return false
              }
              return true
            })

            const totalStuPages = Math.max(1, Math.ceil(filteredStudents.length / STUDENTS_PER_PAGE))
            const safeStuPage = Math.min(ui.page, totalStuPages)
            const paginatedStudents = filteredStudents.slice(
              (safeStuPage - 1) * STUDENTS_PER_PAGE,
              safeStuPage * STUDENTS_PER_PAGE
            )

            const activePrintLabel = [
              effectiveTurmaFilter !== 'todas' ? `Turma ${effectiveTurmaFilter}` : 'Todas as turmas',
              ui.statusFilter === 'aprova'
                ? 'Apenas Autorizados'
                : ui.statusFilter === 'recusa'
                  ? 'Apenas Recusados'
                  : ui.statusFilter === 'pendente'
                    ? 'Apenas Pendentes'
                    : ui.statusFilter === 'obs'
                      ? 'Com Observações'
                      : 'Todos os status',
            ].join(' • ')

            const accentColor = com.autorizacao.isClosed
              ? '#94a3b8'
              : m.totalPendentes > 0
                ? '#059669'
                : '#10b981'

            return (
              <section
                key={com.comunicadoId}
                aria-label={`Relatório da autorização ${com.autorizacao.titulo}`}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderLeft: `4px solid ${accentColor}`,
                  borderRadius: 20,
                  boxShadow: isExpanded
                    ? '0 10px 28px -10px rgba(15, 23, 42, 0.1)'
                    : '0 2px 12px -6px rgba(15, 23, 42, 0.06)',
                  overflow: 'hidden',
                }}
              >
                {/* Cabeçalho Resumo do Comunicado (Clicável para Expandir/Recolher) */}
                <div
                  style={{
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: '1 1 260px' }}>
                      {/* Badges Superiores: Categoria + Status do Prazo + Público */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '2.5px 9px',
                            borderRadius: 999,
                            background: tipoMeta.badgeBg,
                            color: tipoMeta.badgeColor,
                            border: `1px solid ${tipoMeta.badgeBorder}`,
                          }}
                        >
                          {tipoMeta.label}
                        </span>

                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '2.5px 9px',
                            borderRadius: 999,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: com.autorizacao.isClosed ? '#f1f5f9' : '#ecfdf5',
                            color: com.autorizacao.isClosed ? '#475569' : '#047857',
                            border: `1px solid ${com.autorizacao.isClosed ? '#cbd5e1' : '#a7f3d0'}`,
                          }}
                        >
                          {com.autorizacao.isClosed ? (
                            <Lock size={11} aria-hidden="true" />
                          ) : (
                            <Unlock size={11} aria-hidden="true" />
                          )}
                          <span>
                            {com.autorizacao.statusPrazo === 'encerrada_manual'
                              ? 'Encerrada'
                              : com.autorizacao.statusPrazo === 'prazo_expirado'
                                ? 'Prazo Expirado'
                                : com.autorizacao.tempoRestanteLabel || 'Recebendo Assinaturas'}
                          </span>
                        </span>

                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: 800,
                            padding: '2.5px 9px',
                            borderRadius: 999,
                            background: '#eef2ff',
                            color: '#4338ca',
                            border: '1px solid #e0e7ff',
                          }}
                        >
                          {com.comunicadoDestinoLabel}
                        </span>

                        {com.autorizacao.exigirCpfResponsavel && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: '2px 7px',
                              borderRadius: 6,
                              background: '#f8fafc',
                              color: '#475569',
                              border: '1px solid #e2e8f0',
                            }}
                          >
                            CPF Validado
                          </span>
                        )}
                      </div>

                      {/* Título da Autorização */}
                      <h3
                        style={{
                          margin: 0,
                          fontSize: 16.5,
                          fontWeight: 900,
                          color: '#0f172a',
                          lineHeight: 1.25,
                          textWrap: 'balance',
                        }}
                      >
                        {com.autorizacao.titulo}
                      </h3>

                      {/* Linha do Comunicado de Origem */}
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: '#64748b',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span>
                          Comunicado: <strong style={{ color: '#334155' }}>{com.comunicadoTitulo}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Por <strong style={{ color: '#334155' }}>{com.comunicadoAutor}</strong> em{' '}
                          {com.comunicadoDataEnvioFormatada}
                        </span>
                      </div>

                      {/* Metadados do Evento (Local, Data, Valor, Prazo) */}
                      {(com.autorizacao.localEvento ||
                        com.autorizacao.dataEventoFormatada ||
                        com.autorizacao.valor ||
                        com.autorizacao.dataLimiteFormatada) && (
                        <div
                          style={{
                            marginTop: 8,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            flexWrap: 'wrap',
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: '#334155',
                          }}
                        >
                          {com.autorizacao.localEvento && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                padding: '3px 9px',
                                borderRadius: 8,
                              }}
                            >
                              <MapPin size={12} color="#059669" aria-hidden="true" />
                              <span>{com.autorizacao.localEvento}</span>
                            </span>
                          )}
                          {com.autorizacao.dataEventoFormatada && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                padding: '3px 9px',
                                borderRadius: 8,
                              }}
                            >
                              <Calendar size={12} color="#4f46e5" aria-hidden="true" />
                              <span>Evento: {com.autorizacao.dataEventoFormatada}</span>
                            </span>
                          )}
                          {com.autorizacao.valor && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#ecfdf5',
                                border: '1px solid #a7f3d0',
                                color: '#065f46',
                                padding: '3px 9px',
                                borderRadius: 8,
                              }}
                            >
                              <DollarSign size={12} aria-hidden="true" />
                              <span>{com.autorizacao.valor}</span>
                            </span>
                          )}
                          {com.autorizacao.dataLimiteFormatada && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                background: '#fffbeb',
                                border: '1px solid #fde68a',
                                color: '#92400e',
                                padding: '3px 9px',
                                borderRadius: 8,
                              }}
                            >
                              <Clock size={12} aria-hidden="true" />
                              <span>Limite: {com.autorizacao.dataLimiteFormatada}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Botão Expandir / Recolher Relatório */}
                    <button
                      type="button"
                      onClick={() => toggleExpand(com.comunicadoId)}
                      aria-expanded={isExpanded}
                      className="ad-aut-focusable"
                      style={{
                        minBlockSize: 'var(--ad-aut-target, 38px)',
                        padding: '0 14px',
                        borderRadius: 11,
                        border: isExpanded ? '1px solid #c7d2fe' : '1px solid #cbd5e1',
                        background: isExpanded ? '#eef2ff' : '#f8fafc',
                        color: isExpanded ? '#3730a3' : '#0f172a',
                        fontSize: 12.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        flexShrink: 0,
                      }}
                    >
                      <span>{isExpanded ? 'Recolher Relatório' : 'Abrir Relatório'}</span>
                      {isExpanded ? (
                        <ChevronUp size={15} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={15} aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {/* Barra de Progresso Empilhada + Indicadores Rápidos */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 14,
                      padding: '10px 13px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                        fontSize: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, color: '#0f172a' }}>
                          {m.totalRespondidos} de {m.totalDestinatarios} assinaram ({m.percentAdesao}%)
                        </span>
                        <span style={{ color: '#047857', fontWeight: 800 }}>
                          • {m.totalAprovados} aprovados
                        </span>
                        <span style={{ color: '#be123c', fontWeight: 800 }}>
                          • {m.totalRecusados} recusados
                        </span>
                        {m.totalNeutros > 0 && (
                          <span style={{ color: '#4338ca', fontWeight: 800 }}>
                            • {m.totalNeutros} outras opções
                          </span>
                        )}
                        <span style={{ color: '#b45309', fontWeight: 800 }}>
                          • {m.totalPendentes} pendentes
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {m.totalComObservacoes > 0 && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: '#fffbeb',
                              color: '#92400e',
                              border: '1px solid #fde68a',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <AlertTriangle size={11} aria-hidden="true" />
                            <span>{m.totalComObservacoes} obs./alergias</span>
                          </span>
                        )}
                        {m.hasCobranca && (
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: '#ecfdf5',
                              color: '#065f46',
                              border: '1px solid #a7f3d0',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <CreditCard size={11} aria-hidden="true" />
                            <span>
                              {m.totalPagos}/{m.totalDestinatarios} pagos
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div
                      role="img"
                      aria-label={`${m.totalAprovados} aprovados, ${m.totalRecusados} recusados e ${m.totalPendentes} pendentes de ${m.totalDestinatarios} alunos`}
                      style={{
                        height: 8,
                        borderRadius: 999,
                        background: '#e2e8f0',
                        overflow: 'hidden',
                        display: 'flex',
                      }}
                    >
                      {wAprova > 0 && (
                        <div style={{ width: `${wAprova}%`, background: '#10b981', transition: 'width 0.3s ease' }} />
                      )}
                      {wRecusa > 0 && (
                        <div style={{ width: `${wRecusa}%`, background: '#ef4444', transition: 'width 0.3s ease' }} />
                      )}
                      {wNeutro > 0 && (
                        <div style={{ width: `${wNeutro}%`, background: '#6366f1', transition: 'width 0.3s ease' }} />
                      )}
                    </div>
                  </div>
                </div>

                {/* Painel Detalhado Expandido deste Comunicado */}
                {isExpanded && (
                  <div
                    style={{
                      borderTop: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                    }}
                  >
                    {/* Barra de Ações Exclusiva deste Comunicado */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {com.canManage && !com.autorizacao.isClosed && m.totalPendentes > 0 && (
                          <button
                            type="button"
                            onClick={() => openReminderDialog(com)}
                            className="ad-aut-focusable"
                            style={{
                              minBlockSize: 'var(--ad-aut-target, 36px)',
                              padding: '0 13px',
                              borderRadius: 10,
                              border: 'none',
                              background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                              color: '#ffffff',
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              boxShadow: '0 4px 12px -3px rgba(217, 119, 6, 0.35)',
                            }}
                          >
                            <BellRing size={14} aria-hidden="true" />
                            <span>Notificar Pendentes ({m.totalPendentes})</span>
                          </button>
                        )}

                        {com.canManage && !com.autorizacao.isClosed && (
                          <>
                            <button
                              type="button"
                              onClick={() => openPrazoDialog(com, 'deadline')}
                              className="ad-aut-focusable"
                              style={{
                                minBlockSize: 'var(--ad-aut-target, 36px)',
                                padding: '0 12px',
                                borderRadius: 10,
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#334155',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              <Calendar size={13} color="#4f46e5" aria-hidden="true" />
                              <span>Definir Prazo</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickCloseAutorizacao(com)}
                              className="ad-aut-focusable"
                              style={{
                                minBlockSize: 'var(--ad-aut-target, 36px)',
                                padding: '0 12px',
                                borderRadius: 10,
                                border: '1px solid #fecdd3',
                                background: '#fff1f2',
                                color: '#be123c',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                              }}
                            >
                              <Lock size={13} aria-hidden="true" />
                              <span>Encerrar Coleta</span>
                            </button>
                          </>
                        )}

                        {com.canManage && com.autorizacao.isClosed && (
                          <button
                            type="button"
                            onClick={() => openPrazoDialog(com, 'reopen')}
                            className="ad-aut-focusable"
                            style={{
                              minBlockSize: 'var(--ad-aut-target, 36px)',
                              padding: '0 12px',
                              borderRadius: 10,
                              border: '1px solid #a7f3d0',
                              background: '#ecfdf5',
                              color: '#047857',
                              fontSize: 12,
                              fontWeight: 800,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                            }}
                          >
                            <Unlock size={13} aria-hidden="true" />
                            <span>Reabrir Autorização</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openTermoDialog(com)}
                          className="ad-aut-focusable"
                          style={{
                            minBlockSize: 'var(--ad-aut-target, 36px)',
                            padding: '0 12px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <FileText size={13} color="#6366f1" aria-hidden="true" />
                          <span>Ver Termo</span>
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() =>
                            handlePrintComunicadoReport(com, filteredStudents, activePrintLabel)
                          }
                          className="ad-aut-focusable"
                          style={{
                            minBlockSize: 'var(--ad-aut-target, 36px)',
                            padding: '0 12px',
                            borderRadius: 10,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#0f172a',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Printer size={13.5} color="#4f46e5" aria-hidden="true" />
                          <span>Imprimir / PDF ({filteredStudents.length})</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportSingleComunicadoExcel(com)}
                          className="ad-aut-focusable"
                          style={{
                            minBlockSize: 'var(--ad-aut-target, 36px)',
                            padding: '0 12px',
                            borderRadius: 10,
                            border: '1px solid #a7f3d0',
                            background: '#ecfdf5',
                            color: '#065f46',
                            fontSize: 12,
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <FileSpreadsheet size={13.5} aria-hidden="true" />
                          <span>Excel deste Comunicado</span>
                        </button>
                      </div>
                    </div>

                    {/* Distribuição por Opção de Resposta configurada no Comunicado */}
                    {com.autorizacao.opcoes.length > 0 && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
                          gap: 8,
                        }}
                      >
                        {com.autorizacao.opcoes.map((op) => {
                          const selected = ui.opcaoIdFilter === op.id
                          const opColor =
                            op.tipo === 'aprova'
                              ? '#047857'
                              : op.tipo === 'recusa'
                                ? '#be123c'
                                : '#4338ca'
                          const opBg =
                            op.tipo === 'aprova'
                              ? '#ecfdf5'
                              : op.tipo === 'recusa'
                                ? '#fff1f2'
                                : '#eef2ff'
                          return (
                            <button
                              key={op.id}
                              type="button"
                              onClick={() =>
                                updateComUI(com.comunicadoId, {
                                  opcaoIdFilter: selected ? null : op.id,
                                  statusFilter: 'todos',
                                })
                              }
                              className="ad-aut-focusable"
                              style={{
                                textAlign: 'left',
                                padding: '9px 12px',
                                borderRadius: 12,
                                border: selected ? `2px solid ${opColor}` : '1px solid #e2e8f0',
                                background: selected ? opBg : '#ffffff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 8,
                              }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 800,
                                    color: '#0f172a',
                                    overflowWrap: 'break-word',
                                  }}
                                >
                                  {op.emoji ? `${op.emoji} ` : ''}
                                  {op.texto}
                                </div>
                                <div style={{ fontSize: 10.5, fontWeight: 600, color: '#64748b', marginTop: 2 }}>
                                  {op.percent}% das respostas
                                </div>
                              </div>
                              <span
                                style={{
                                  fontSize: 14,
                                  fontWeight: 900,
                                  color: opColor,
                                  background: opBg,
                                  padding: '3px 9px',
                                  borderRadius: 999,
                                  flexShrink: 0,
                                }}
                              >
                                {op.count}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Resumo por Turma (quando o comunicado abrange mais de 1 turma) */}
                    {com.turmasResumo.length > 1 && (
                      <div className="ad-com-scroller" role="group" aria-label="Recorte por turma deste comunicado">
                        <button
                          type="button"
                          onClick={() => updateComUI(com.comunicadoId, { turmaFilter: 'todas' })}
                          className="ad-aut-focusable"
                          style={{
                            flex: 'none',
                            minBlockSize: 32,
                            padding: '0 11px',
                            borderRadius: 9,
                            border: `1.5px solid ${
                              effectiveTurmaFilter === 'todas' ? '#4f46e5' : '#cbd5e1'
                            }`,
                            background: effectiveTurmaFilter === 'todas' ? '#eef2ff' : '#ffffff',
                            color: effectiveTurmaFilter === 'todas' ? '#3730a3' : '#475569',
                            fontSize: 11.5,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          Todas as Turmas ({m.totalRespondidos}/{m.totalDestinatarios})
                        </button>
                        {com.turmasResumo.map((tr) => {
                          const active = effectiveTurmaFilter === tr.turma
                          return (
                            <button
                              key={tr.turma}
                              type="button"
                              onClick={() =>
                                updateComUI(com.comunicadoId, {
                                  turmaFilter: active ? 'todas' : tr.turma,
                                })
                              }
                              className="ad-aut-focusable"
                              style={{
                                flex: 'none',
                                minBlockSize: 32,
                                padding: '0 11px',
                                borderRadius: 9,
                                border: `1.5px solid ${active ? '#4f46e5' : '#e2e8f0'}`,
                                background: active ? '#eef2ff' : '#ffffff',
                                color: active ? '#3730a3' : '#334155',
                                fontSize: 11.5,
                                fontWeight: 700,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {tr.turma}: <strong>{tr.respondidos}/{tr.total}</strong> ({tr.percentAdesao}%)
                            </button>
                          )
                        })}
                      </div>
                    )}

                    {/* Filtros de Alunos dentro deste Comunicado */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div className="ad-com-scroller" style={{ flex: '1 1 auto' }}>
                        {[
                          { id: 'todos' as const, label: `Todos (${m.totalDestinatarios})`, show: true },
                          { id: 'aprova' as const, label: `Aprovados (${m.totalAprovados})`, show: true },
                          { id: 'recusa' as const, label: `Recusados (${m.totalRecusados})`, show: true },
                          { id: 'neutro' as const, label: `Outras (${m.totalNeutros})`, show: m.totalNeutros > 0 },
                          { id: 'pendente' as const, label: `Pendentes (${m.totalPendentes})`, show: true },
                          { id: 'obs' as const, label: `Com Obs. (${m.totalComObservacoes})`, show: m.totalComObservacoes > 0 },
                          { id: 'pago' as const, label: `Pagos (${m.totalPagos})`, show: m.hasCobranca },
                        ]
                          .filter((x) => x.show)
                          .map((f) => {
                            const active = ui.statusFilter === f.id && !ui.opcaoIdFilter
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() =>
                                  updateComUI(com.comunicadoId, {
                                    statusFilter: f.id,
                                    opcaoIdFilter: null,
                                  })
                                }
                                className="ad-aut-focusable"
                                style={{
                                  flex: 'none',
                                  minBlockSize: 'var(--ad-aut-target, 34px)',
                                  padding: '0 11px',
                                  borderRadius: 9,
                                  border: `1.5px solid ${active ? '#0f172a' : '#cbd5e1'}`,
                                  background: active ? '#0f172a' : '#ffffff',
                                  color: active ? '#ffffff' : '#475569',
                                  fontSize: 11.5,
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {f.label}
                              </button>
                            )
                          })}
                      </div>

                      <div style={{ flex: '1 1 220px', maxInlineSize: 340, position: 'relative' }}>
                        <Search
                          size={14}
                          color="#94a3b8"
                          aria-hidden="true"
                          style={{
                            position: 'absolute',
                            left: 11,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            pointerEvents: 'none',
                          }}
                        />
                        <input
                          type="search"
                          aria-label={`Filtrar alunos em ${com.autorizacao.titulo}`}
                          value={ui.search}
                          onChange={(e) => updateComUI(com.comunicadoId, { search: e.target.value })}
                          placeholder="Filtrar aluno, responsável, CPF..."
                          className="ad-aut-focusable"
                          style={{
                            width: '100%',
                            minBlockSize: 'var(--ad-aut-target, 34px)',
                            padding: '0 10px 0 32px',
                            borderRadius: 9,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#0f172a',
                            fontSize: 12,
                            fontWeight: 600,
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    {/* Tabela Semântica Responsiva (vira Cards no Mobile via @container) */}
                    {paginatedStudents.length === 0 ? (
                      <div
                        style={{
                          background: '#ffffff',
                          border: '1px dashed #cbd5e1',
                          borderRadius: 14,
                          padding: '28px 16px',
                          textAlign: 'center',
                          fontSize: 12.5,
                          fontWeight: 600,
                          color: '#64748b',
                        }}
                      >
                        Nenhum aluno corresponde ao filtro selecionado neste comunicado.
                      </div>
                    ) : (
                      <div
                        tabIndex={0}
                        role="region"
                        aria-label={`Lista de alunos da autorização ${com.autorizacao.titulo}`}
                        className="ad-com-table-region ad-aut-focusable"
                      >
                        <table className="ad-com-table">
                          <thead>
                            <tr>
                              <th scope="col">Aluno(a) & Turma</th>
                              <th scope="col">Decisão / Status</th>
                              <th scope="col">Responsável</th>
                              <th scope="col">Assinatura / Leitura</th>
                              {(m.totalComObservacoes > 0 || m.hasCobranca) && (
                                <th scope="col">Obs. / Financeiro</th>
                              )}
                              <th scope="col" style={{ textAlign: 'right' }}>
                                Ações
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedStudents.map((stu) => {
                              const isSigned = stu.statusResposta !== 'pendente'
                              const waUrl = !isSigned
                                ? buildWhatsAppUrl(
                                    stu.responsavelPrincipalTelefone,
                                    stu.responsavelPrincipalNome,
                                    stu.alunoNome,
                                    com.autorizacao.titulo,
                                    com.autorizacao.dataLimiteFormatada
                                  )
                                : null

                              return (
                                <tr key={stu.key}>
                                  <th scope="row">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <div
                                        style={{
                                          width: 36,
                                          height: 36,
                                          borderRadius: 11,
                                          background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                                          color: '#4338ca',
                                          fontWeight: 900,
                                          fontSize: 12.5,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          overflow: 'hidden',
                                          flexShrink: 0,
                                          border: '1px solid #e2e8f0',
                                        }}
                                      >
                                        {stu.alunoFoto ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img
                                            src={stu.alunoFoto}
                                            alt=""
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                          />
                                        ) : (
                                          getInitials(stu.alunoNome)
                                        )}
                                      </div>
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.25 }}>
                                          {stu.alunoNome}
                                        </div>
                                        <div
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            flexWrap: 'wrap',
                                            marginTop: 2,
                                          }}
                                        >
                                          <span style={{ fontSize: 10.5, color: '#64748b', fontWeight: 700 }}>
                                            #{stu.alunoMatricula}
                                          </span>
                                          <span
                                            style={{
                                              fontSize: 10,
                                              fontWeight: 800,
                                              color: '#4338ca',
                                              background: '#eef2ff',
                                              padding: '1px 6px',
                                              borderRadius: 5,
                                            }}
                                          >
                                            {stu.alunoTurma}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </th>

                                  <td data-label="Status">
                                    {stu.statusResposta === 'aprova' ? (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          padding: '3px 9px',
                                          borderRadius: 999,
                                          fontSize: 11,
                                          fontWeight: 800,
                                          background: '#ecfdf5',
                                          color: '#047857',
                                          border: '1px solid #a7f3d0',
                                        }}
                                      >
                                        <CheckCircle2 size={12} aria-hidden="true" />
                                        <span>{stu.opcaoTexto || 'Aprovado'}</span>
                                      </span>
                                    ) : stu.statusResposta === 'recusa' ? (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          padding: '3px 9px',
                                          borderRadius: 999,
                                          fontSize: 11,
                                          fontWeight: 800,
                                          background: '#fff1f2',
                                          color: '#be123c',
                                          border: '1px solid #fecdd3',
                                        }}
                                      >
                                        <XCircle size={12} aria-hidden="true" />
                                        <span>{stu.opcaoTexto || 'Recusado'}</span>
                                      </span>
                                    ) : stu.statusResposta === 'neutro' ? (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          padding: '3px 9px',
                                          borderRadius: 999,
                                          fontSize: 11,
                                          fontWeight: 800,
                                          background: '#eef2ff',
                                          color: '#3730a3',
                                          border: '1px solid #c7d2fe',
                                        }}
                                      >
                                        <span>{stu.opcaoTexto || 'Respondido'}</span>
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          padding: '3px 9px',
                                          borderRadius: 999,
                                          fontSize: 11,
                                          fontWeight: 800,
                                          background: '#fffbeb',
                                          color: '#b45309',
                                          border: '1px solid #fde68a',
                                        }}
                                      >
                                        <Clock size={12} aria-hidden="true" />
                                        <span>Aguardando Assinatura</span>
                                      </span>
                                    )}
                                  </td>

                                  <td data-label="Responsável">
                                    {isSigned ? (
                                      <div>
                                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 12 }}>
                                          {stu.assinanteNome}
                                        </div>
                                        {stu.assinanteCpf && (
                                          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                            CPF {stu.assinanteCpf}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div>
                                        <div style={{ fontWeight: 600, color: '#334155', fontSize: 12 }}>
                                          {stu.responsavelPrincipalNome || 'Responsável não vinculado'}
                                          {stu.responsavelPrincipalParentesco
                                            ? ` (${stu.responsavelPrincipalParentesco})`
                                            : ''}
                                        </div>
                                        {stu.responsavelPrincipalTelefone && (
                                          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>
                                            {stu.responsavelPrincipalTelefone}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </td>

                                  <td data-label="Assinatura">
                                    {isSigned ? (
                                      <div>
                                        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
                                          {stu.respondidoEmFormatado}
                                        </div>
                                        {stu.protocoloToken && (
                                          <code
                                            style={{
                                              fontSize: 10.5,
                                              fontWeight: 700,
                                              color: '#475569',
                                              overflowWrap: 'anywhere',
                                            }}
                                          >
                                            {stu.protocoloToken}
                                          </code>
                                        )}
                                      </div>
                                    ) : stu.leuComunicado ? (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          fontSize: 11,
                                          fontWeight: 700,
                                          color: '#0284c7',
                                          background: '#f0f9ff',
                                          padding: '2px 8px',
                                          borderRadius: 6,
                                        }}
                                      >
                                        <Eye size={12} aria-hidden="true" />
                                        <span>Visualizou comunicado</span>
                                      </span>
                                    ) : (
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          fontSize: 11,
                                          fontWeight: 600,
                                          color: '#64748b',
                                          background: '#f1f5f9',
                                          padding: '2px 8px',
                                          borderRadius: 6,
                                        }}
                                      >
                                        <EyeOff size={12} aria-hidden="true" />
                                        <span>Ainda não abriu</span>
                                      </span>
                                    )}
                                  </td>

                                  {(m.totalComObservacoes > 0 || m.hasCobranca) && (
                                    <td data-label="Detalhes">
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        {m.hasCobranca && (
                                          <span
                                            style={{
                                              alignSelf: 'flex-start',
                                              fontSize: 10.5,
                                              fontWeight: 800,
                                              padding: '2px 7px',
                                              borderRadius: 6,
                                              background:
                                                stu.pagamentoStatus === 'pago' ? '#ecfdf5' : '#fffbeb',
                                              color:
                                                stu.pagamentoStatus === 'pago' ? '#047857' : '#b45309',
                                              border: `1px solid ${
                                                stu.pagamentoStatus === 'pago' ? '#a7f3d0' : '#fde68a'
                                              }`,
                                            }}
                                          >
                                            {stu.pagamentoStatus === 'pago'
                                              ? 'Pagto. Confirmado'
                                              : 'Pagto. Pendente'}
                                          </span>
                                        )}
                                        {stu.observacoes ? (
                                          <div
                                            style={{
                                              fontSize: 11,
                                              fontWeight: 700,
                                              color: '#92400e',
                                              background: '#fffbeb',
                                              border: '1px solid #fde68a',
                                              borderRadius: 7,
                                              padding: '3px 8px',
                                              maxInlineSize: 240,
                                              overflowWrap: 'break-word',
                                            }}
                                          >
                                            {stu.observacoes}
                                          </div>
                                        ) : (
                                          !m.hasCobranca && (
                                            <span style={{ color: '#cbd5e1', fontSize: 11 }}>—</span>
                                          )
                                        )}
                                      </div>
                                    </td>
                                  )}

                                  <td className="ad-com-td-actions" style={{ textAlign: 'right' }}>
                                    <div
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        flexWrap: 'wrap',
                                        justifyContent: 'flex-end',
                                      }}
                                    >
                                      {isSigned ? (
                                        <button
                                          type="button"
                                          onClick={() => openReceiptDialog(com, stu)}
                                          className="ad-aut-focusable"
                                          style={{
                                            minBlockSize: 32,
                                            padding: '0 10px',
                                            borderRadius: 8,
                                            border: '1px solid #a7f3d0',
                                            background: '#ecfdf5',
                                            color: '#065f46',
                                            fontSize: 11.5,
                                            fontWeight: 800,
                                            cursor: 'pointer',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 5,
                                          }}
                                        >
                                          <ShieldCheck size={13} aria-hidden="true" />
                                          <span>Comprovante</span>
                                        </button>
                                      ) : (
                                        <>
                                          {waUrl && (
                                            <a
                                              href={waUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="ad-aut-focusable"
                                              aria-label={`Enviar lembrete via WhatsApp para responsável de ${stu.alunoNome}`}
                                              style={{
                                                minBlockSize: 32,
                                                padding: '0 10px',
                                                borderRadius: 8,
                                                border: '1px solid #86efac',
                                                background: '#f0fdf4',
                                                color: '#15803d',
                                                fontSize: 11.5,
                                                fontWeight: 800,
                                                textDecoration: 'none',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 5,
                                              }}
                                            >
                                              <MessageCircle size={13} aria-hidden="true" />
                                              <span>WhatsApp</span>
                                            </a>
                                          )}
                                          {stu.alunoId && (
                                            <Link
                                              href={`/agenda-digital/admin/pessoas/${encodeURIComponent(stu.alunoId)}`}
                                              className="ad-aut-focusable"
                                              style={{
                                                minBlockSize: 32,
                                                padding: '0 9px',
                                                borderRadius: 8,
                                                border: '1px solid #cbd5e1',
                                                background: '#ffffff',
                                                color: '#475569',
                                                fontSize: 11.5,
                                                fontWeight: 700,
                                                textDecoration: 'none',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                              }}
                                            >
                                              <ExternalLink size={12} aria-hidden="true" />
                                              <span>Perfil</span>
                                            </Link>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Paginação interna por Comunicado (caso passe de 25 alunos) */}
                    {totalStuPages > 1 && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          flexWrap: 'wrap',
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#475569',
                        }}
                      >
                        <span>
                          Página <strong>{safeStuPage}</strong> de <strong>{totalStuPages}</strong> (
                          {filteredStudents.length} alunos)
                        </span>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            disabled={safeStuPage <= 1}
                            onClick={() =>
                              updateComUI(com.comunicadoId, { page: Math.max(1, safeStuPage - 1) })
                            }
                            className="ad-aut-focusable"
                            style={{
                              minBlockSize: 32,
                              padding: '0 10px',
                              borderRadius: 8,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#334155',
                              cursor: safeStuPage <= 1 ? 'not-allowed' : 'pointer',
                              opacity: safeStuPage <= 1 ? 0.5 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <ChevronLeft size={14} aria-hidden="true" /> Anterior
                          </button>
                          <button
                            type="button"
                            disabled={safeStuPage >= totalStuPages}
                            onClick={() =>
                              updateComUI(com.comunicadoId, {
                                page: Math.min(totalStuPages, safeStuPage + 1),
                              })
                            }
                            className="ad-aut-focusable"
                            style={{
                              minBlockSize: 32,
                              padding: '0 10px',
                              borderRadius: 8,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#334155',
                              cursor: safeStuPage >= totalStuPages ? 'not-allowed' : 'pointer',
                              opacity: safeStuPage >= totalStuPages ? 0.5 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            Próxima <ChevronRight size={14} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {/* DIALOG 1: Comprovante Individual de Assinatura Digital */}
      <dialog
        ref={receiptDialogRef}
        className="ad-aut-dialog"
        aria-labelledby={receiptTitleId}
        {...({ closedby: 'any' } as any)}
      >
        {selectedReceipt && (
          <>
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid #f1f5f9',
                background:
                  selectedReceipt.aluno.statusResposta === 'aprova'
                    ? 'linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 100%)'
                    : selectedReceipt.aluno.statusResposta === 'recusa'
                      ? 'linear-gradient(135deg, #fff1f2 0%, #fef2f2 100%)'
                      : 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <ShieldCheck
                  size={22}
                  color={
                    selectedReceipt.aluno.statusResposta === 'aprova'
                      ? '#059669'
                      : selectedReceipt.aluno.statusResposta === 'recusa'
                        ? '#e11d48'
                        : '#4f46e5'
                  }
                  aria-hidden="true"
                />
                <div style={{ minWidth: 0 }}>
                  <h1
                    id={receiptTitleId}
                    style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}
                  >
                    Comprovante de Assinatura Digital
                  </h1>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                    {selectedReceipt.com.autorizacao.titulo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeReceiptDialog}
                aria-label="Fechar comprovante"
                className="ad-aut-focusable"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <div
              style={{
                padding: '18px 22px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {selectedReceipt.aluno.protocoloToken && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                      Token Digital:
                    </span>
                    <code style={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', overflowWrap: 'anywhere' }}>
                      {selectedReceipt.aluno.protocoloToken}
                    </code>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleCopyToken(selectedReceipt.aluno.protocoloToken || '')}
                      className="ad-aut-copy-btn ad-aut-focusable"
                      data-copied={copyState === 'copied' ? '' : undefined}
                      data-failed={copyState === 'failed' ? '' : undefined}
                    >
                      {copyState === 'copied' ? (
                        <Check size={13} aria-hidden="true" />
                      ) : (
                        <Copy size={13} aria-hidden="true" />
                      )}
                      <span>{copyState === 'copied' ? 'Copiado' : 'Copiar'}</span>
                    </button>
                    <span
                      className={`ad-aut-copy-tip ${copyStatusMsg ? 'visible' : ''} ${
                        copyState === 'failed' ? 'failed' : ''
                      }`}
                      role="status"
                    >
                      {copyStatusMsg}
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
                    Aluno(a)
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 3 }}>
                    {selectedReceipt.aluno.alunoNome} ({selectedReceipt.aluno.alunoTurma})
                  </div>
                </div>

                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
                    Decisão Registrada
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color:
                        selectedReceipt.aluno.statusResposta === 'aprova'
                          ? '#047857'
                          : selectedReceipt.aluno.statusResposta === 'recusa'
                            ? '#be123c'
                            : '#4338ca',
                      marginTop: 3,
                    }}
                  >
                    {selectedReceipt.aluno.opcaoTexto}
                  </div>
                </div>

                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
                    Responsável Signatário
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 3 }}>
                    {selectedReceipt.aluno.assinanteNome}
                    {selectedReceipt.aluno.assinanteCpf ? ` • CPF ${selectedReceipt.aluno.assinanteCpf}` : ''}
                  </div>
                </div>

                <div style={{ padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>
                    Data e Hora da Assinatura
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginTop: 3 }}>
                    {selectedReceipt.aluno.respondidoEmFormatado}
                  </div>
                </div>
              </div>

              {selectedReceipt.aluno.observacoes && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#92400e',
                  }}
                >
                  <strong>Observação / Restrição informada:</strong> {selectedReceipt.aluno.observacoes}
                </div>
              )}

              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: '3px solid #059669',
                  fontSize: 12,
                  color: '#334155',
                  lineHeight: 1.55,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
                dangerouslySetInnerHTML={{
                  __html: formatAutorizacaoTermoHtml(selectedReceipt.com.autorizacao.termoTexto),
                }}
              />
            </div>

            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid #f1f5f9',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={() => handlePrintSingleReceipt(selectedReceipt.com, selectedReceipt.aluno)}
                className="ad-aut-focusable"
                style={{
                  minBlockSize: 38,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Printer size={14} aria-hidden="true" />
                <span>Imprimir Comprovante / PDF</span>
              </button>
              <button
                type="button"
                onClick={closeReceiptDialog}
                className="ad-aut-focusable"
                style={{
                  minBlockSize: 38,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </dialog>

      {/* DIALOG 2: Visualizar Termo de Consentimento Original */}
      <dialog
        ref={termoDialogRef}
        className="ad-aut-dialog"
        aria-labelledby={termoTitleId}
        {...({ closedby: 'any' } as any)}
      >
        {selectedTermoCom && (
          <>
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <h1 id={termoTitleId} style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                  {selectedTermoCom.autorizacao.titulo}
                </h1>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  Comunicado: {selectedTermoCom.comunicadoTitulo}
                </p>
              </div>
              <button
                type="button"
                onClick={closeTermoDialog}
                aria-label="Fechar termo"
                className="ad-aut-focusable"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <div
              style={{
                padding: '18px 22px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: '#1e293b',
                }}
                dangerouslySetInnerHTML={{
                  __html: formatAutorizacaoTermoHtml(selectedTermoCom.autorizacao.termoTexto),
                }}
              />
            </div>

            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid #f1f5f9',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <Link
                href="/agenda-digital/admin/comunicados"
                className="ad-aut-focusable"
                style={{
                  minBlockSize: 36,
                  padding: '0 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <ExternalLink size={13} aria-hidden="true" />
                <span>Ir para Comunicados</span>
              </Link>
              <button
                type="button"
                onClick={closeTermoDialog}
                className="ad-aut-focusable"
                style={{
                  minBlockSize: 36,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Fechar
              </button>
            </div>
          </>
        )}
      </dialog>

      {/* DIALOG 3: Alterar Prazo / Reabrir Autorização */}
      <dialog
        ref={prazoDialogRef}
        className="ad-aut-dialog"
        aria-labelledby={prazoTitleId}
        {...({ closedby: 'any' } as any)}
      >
        {prazoTarget && (
          <form onSubmit={handleSavePrazo} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <h1 id={prazoTitleId} style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                  {prazoTarget.mode === 'reopen'
                    ? 'Reabrir Coleta de Assinaturas'
                    : 'Gerenciar Prazo da Autorização'}
                </h1>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                  {prazoTarget.com.autorizacao.titulo}
                </p>
              </div>
              <button
                type="button"
                onClick={closePrazoDialog}
                aria-label="Fechar janela de prazo"
                className="ad-aut-focusable"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  color: '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label
                  htmlFor={prazoDateId}
                  style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}
                >
                  Data limite para assinatura dos responsáveis
                </label>
                <input
                  id={prazoDateId}
                  type="date"
                  min={getLocalTodayYmd()}
                  disabled={draftSemPrazo}
                  value={draftDataLimite}
                  onChange={(e) => setDraftDataLimite(e.target.value)}
                  className="ad-aut-focusable"
                  style={{
                    width: '100%',
                    minBlockSize: 40,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: draftSemPrazo ? '#f1f5f9' : '#ffffff',
                    color: '#0f172a',
                    fontSize: 13,
                    fontWeight: 600,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={draftSemPrazo}
                  onChange={(e) => setDraftSemPrazo(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#059669' }}
                />
                <span>Deixar aberta sem data limite automática</span>
              </label>

              {prazoError && (
                <div
                  role="alert"
                  style={{
                    padding: '9px 12px',
                    borderRadius: 10,
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    color: '#be123c',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {prazoError}
                </div>
              )}
            </div>

            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid #f1f5f9',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={closePrazoDialog}
                className="ad-aut-focusable"
                style={{
                  minBlockSize: 38,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSavingPrazo}
                className="ad-aut-focusable"
                style={{
                  minBlockSize: 38,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                  color: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: isSavingPrazo ? 'wait' : 'pointer',
                }}
              >
                {isSavingPrazo ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </form>
        )}
      </dialog>

      {/* DIALOG 4: Disparar Lembrete Push Exclusivo aos Pendentes */}
      <dialog
        ref={reminderDialogRef}
        className="ad-aut-dialog"
        aria-labelledby={reminderTitleId}
        {...({ closedby: 'any' } as any)}
      >
        {reminderTargetCom && (
          <form
            onSubmit={handleSendPendingReminder}
            style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div
              style={{
                padding: '18px 22px',
                borderBottom: '1px solid #f1f5f9',
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BellRing size={20} color="#d97706" aria-hidden="true" />
                <div>
                  <h1 id={reminderTitleId} style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                    Notificar Famílias Pendentes
                  </h1>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#78350f', fontWeight: 600 }}>
                    {reminderTargetCom.autorizacao.titulo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeReminderDialog}
                aria-label="Fechar envio de lembrete"
                className="ad-aut-focusable"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  border: '1px solid #fde68a',
                  background: '#ffffff',
                  color: '#78350f',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  padding: '11px 14px',
                  borderRadius: 12,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: 12.5,
                  color: '#334155',
                  lineHeight: 1.5,
                }}
              >
                O lembrete push será enviado <strong>somente</strong> para os responsáveis dos{' '}
                <strong>{reminderTargetCom.metricas.totalPendentes} aluno(s)</strong> que ainda não
                assinaram esta autorização (os{' '}
                <strong>{reminderTargetCom.metricas.totalRespondidos}</strong> que já responderam não
                serão incomodados).
              </div>

              <div>
                <label
                  htmlFor={reminderMsgId}
                  style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#334155', marginBottom: 6 }}
                >
                  Mensagem personalizada (opcional — máx. 160 caracteres)
                </label>
                <textarea
                  id={reminderMsgId}
                  rows={3}
                  maxLength={160}
                  value={reminderCustomMsg}
                  onChange={(e) => setReminderCustomMsg(e.target.value)}
                  placeholder={`Ex: Olá! Lembramos que o prazo da autorização "${reminderTargetCom.autorizacao.titulo}" encerra em breve. Toque para assinar!`}
                  className="ad-aut-focusable"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    fontWeight: 500,
                    color: '#0f172a',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                padding: '14px 22px',
                borderTop: '1px solid #f1f5f9',
                background: '#f8fafc',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={closeReminderDialog}
                className="ad-aut-focusable"
                style={{
                  minBlockSize: 38,
                  padding: '0 14px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSendingReminder}
                className="ad-aut-focusable"
                style={{
                  minBlockSize: 38,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
                  color: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: isSendingReminder ? 'wait' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Send size={13.5} aria-hidden="true" />
                <span>{isSendingReminder ? 'Enviando Push...' : 'Enviar Lembrete Agora'}</span>
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  )
}
