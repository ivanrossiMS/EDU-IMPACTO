'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X, Users, Search, Check, CheckCheck, AlertTriangle, Clock,
  ChevronDown, ChevronRight, RefreshCw, BellRing, Download,
  GraduationCap, Briefcase, ShieldCheck, FileBarChart, Edit2,
  Smartphone, Eye, Loader2, Layers, Phone
} from 'lucide-react'
import { apiFetch } from '@/lib/api/apiClient'
import type {
  ComunicadoAuditoriaResponse,
  DeliveryState,
  AuditoriaTurma,
  AuditoriaAluno,
  AuditoriaResponsavel,
  AuditoriaColaborador,
  AuditoriaGrupo,
} from '@/lib/server/comunicadoAuditoriaService'

interface ComunicadoDestinatariosModalProps {
  isOpen: boolean
  comunicado: any | null
  onClose: () => void
  alunos?: any[]
  onOpenStudentReport?: (payload: {
    string: string
    studentId: string
    studentName: string
    studentAvatar?: string | null
    editMode: boolean
  }) => void
  onOpenReminderModal?: () => void
  canEditReportOverride?: boolean
}

type StatusFilter = 'todos' | 'read' | 'received' | 'unread' | 'no_channel'
type SectionTab = 'todos' | 'turmas' | 'grupos' | 'colaboradores'

function normalizeSearch(text?: string | null): string {
  if (!text) return ''
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function formatDateTimeShort(iso?: string | null): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return ''
  }
}

function getInitials(name?: string | null): string {
  if (!name) return '?'
  const parts = String(name).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const AVATAR_TONES = [
  { bg: '#EEF2FF', text: '#4338CA', border: '#C7D2FE' },
  { bg: '#ECFEFF', text: '#0E7490', border: '#A5F3FC' },
  { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
  { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
  { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  { bg: '#FDF2F8', text: '#BE185D', border: '#FBCFE8' },
]

function getAvatarTone(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h)
  }
  return AVATAR_TONES[Math.abs(h) % AVATAR_TONES.length]
}

function getStatusBadgeMeta(
  status: DeliveryState,
  opts?: {
    leuEm?: string | null
    recebeuEm?: string | null
    canal?: string | null
    statusConta?: string
  }
) {
  if (status === 'read') {
    const when = formatDateTimeShort(opts?.leuEm)
    return {
      label: when ? `Lido • ${when}` : 'Lido',
      shortLabel: 'Lido',
      bg: '#ECFDF5',
      color: '#047857',
      border: '#A7F3D0',
      iconType: 'read' as const,
      title: when ? `Visualizado em ${when}` : 'Comunicado visualizado',
    }
  }
  if (status === 'received') {
    const when = formatDateTimeShort(opts?.recebeuEm)
    const canalLabel =
      opts?.canal === 'push_e_app'
        ? 'Push e App'
        : opts?.canal === 'push'
          ? 'via Push'
          : opts?.canal === 'app'
            ? 'no App'
            : ''
    return {
      label: `Recebeu${canalLabel ? ` (${canalLabel})` : ''}${when ? ` • ${when}` : ''}`,
      shortLabel: 'Recebeu',
      bg: '#EFF6FF',
      color: '#1D4ED8',
      border: '#BFDBFE',
      iconType: 'received' as const,
      title: when ? `Entregue em ${when}` : 'Entregue ao dispositivo/app',
    }
  }
  if (status === 'no_channel') {
    const detail =
      opts?.statusConta === 'no_email'
        ? 'Sem e-mail cadastrado'
        : opts?.statusConta === 'never_activated'
          ? 'App não ativado'
          : 'Sem push/acesso ativo'
    return {
      label: detail,
      shortLabel: 'Sem App',
      bg: '#FFFBEB',
      color: '#B45309',
      border: '#FDE68A',
      iconType: 'no_channel' as const,
      title: 'Responsável ainda não ativou a conta ou está sem aparelho conectado',
    }
  }
  return {
    label: 'Enviado • Aguardando',
    shortLabel: 'Enviado',
    bg: '#F8FAFC',
    color: '#475569',
    border: '#E2E8F0',
    iconType: 'sent' as const,
    title: 'Disponível na conta, aguardando abertura ou entrega',
  }
}

function StatusIcon({ type, size = 13 }: { type: 'read' | 'received' | 'sent' | 'no_channel'; size?: number }) {
  if (type === 'read') return <CheckCheck size={size} strokeWidth={2.5} color="#059669" />
  if (type === 'received') return <CheckCheck size={size} strokeWidth={2.4} color="#2563EB" />
  if (type === 'no_channel') return <AlertTriangle size={size} strokeWidth={2.3} color="#D97706" />
  return <Check size={size} strokeWidth={2.3} color="#64748B" />
}

export function ComunicadoDestinatariosModal({
  isOpen,
  comunicado,
  onClose,
  alunos = [],
  onOpenStudentReport,
  onOpenReminderModal,
  canEditReportOverride,
}: ComunicadoDestinatariosModalProps) {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ComunicadoAuditoriaResponse | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos')
  const [sectionTab, setSectionTab] = useState<SectionTab>('todos')
  const [expandedTurmas, setExpandedTurmas] = useState<Record<string, boolean>>({})
  const [expandedGrupos, setExpandedGrupos] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchAuditoria = useCallback(
    async (isManualRefresh = false) => {
      if (!comunicado?.id) return
      if (isManualRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const res = await apiFetch(
          `/api/comunicados/${encodeURIComponent(String(comunicado.id))}/destinatarios`
        )
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(json?.error || 'Não foi possível carregar os destinatários.')
        }
        setData(json as ComunicadoAuditoriaResponse)

        // Expansão inteligente inicial
        const turmasList: AuditoriaTurma[] = Array.isArray(json?.turmas) ? json.turmas : []
        const totalAlunos = Number(json?.resumo?.totalAlunos || 0)
        const autoExpand: Record<string, boolean> = {}
        if (turmasList.length === 1 || totalAlunos <= 8 || json?.comunicado?.isIndividual) {
          turmasList.forEach(t => {
            autoExpand[t.id] = true
          })
        }
        if (!isManualRefresh) {
          setExpandedTurmas(autoExpand)
          const gruposList: AuditoriaGrupo[] = Array.isArray(json?.grupos) ? json.grupos : []
          const autoGrupos: Record<string, boolean> = {}
          if (gruposList.length === 1 && turmasList.length === 0) {
            autoGrupos[gruposList[0].id] = true
          }
          setExpandedGrupos(autoGrupos)
        }
      } catch (err: any) {
        setError(err?.message || 'Erro ao carregar destinatários.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [comunicado?.id]
  )

  useEffect(() => {
    if (!isOpen || !comunicado?.id) {
      setData(null)
      setSearchQuery('')
      setStatusFilter('todos')
      setSectionTab('todos')
      setExpandedTurmas({})
      setExpandedGrupos({})
      setError(null)
      return
    }
    fetchAuditoria(false)
  }, [isOpen, comunicado?.id, fetchAuditoria])

  // Mapa rápido de fotos do prop alunos caso não venha do cache leve
  const fallbackAlunoPhotoMap = useMemo(() => {
    const map = new Map<string, string>()
    ;(alunos || []).forEach(a => {
      if (!a) return
      const photo = a.foto_url || a.foto || a.dados?.foto || a.dados?.avatarUrl
      if (photo && typeof photo === 'string') {
        const clean = String(a.id || '').replace(/^(?:a_|_ALU|_)/i, '').trim()
        if (clean) map.set(clean, photo)
        if (a.id) map.set(String(a.id), photo)
      }
    })
    return map
  }, [alunos])

  // Mapa rápido de anexos de relatório individual no comunicado (para botão Ver / Editar Relatório)
  const reportAnexoByStudentId = useMemo(() => {
    const map = new Map<string, string>()
    const anexos = comunicado?.anexos || comunicado?.dados?.anexos || []
    if (!Array.isArray(anexos)) return map
    anexos.forEach((anx: any) => {
      if (typeof anx !== 'string' || !anx.includes('payload:')) return
      try {
        const pPart = anx.split('|').find((p: string) => p.startsWith('payload:'))
        if (!pPart) return
        const parsed = JSON.parse(pPart.substring(8))
        const rawId = parsed?.studentInfo?.id || Object.keys(parsed?.values || {})[0] || ''
        const clean = String(rawId).replace(/^(?:a_|_ALU|_)/i, '').trim()
        if (clean) map.set(clean, anx)
      } catch {}
    })
    return map
  }, [comunicado])

  const matchesStatusFilter = useCallback(
    (status: DeliveryState): boolean => {
      if (statusFilter === 'todos') return true
      if (statusFilter === 'read') return status === 'read'
      if (statusFilter === 'received') return status === 'received'
      if (statusFilter === 'unread') return status !== 'read'
      if (statusFilter === 'no_channel') return status === 'no_channel'
      return true
    },
    [statusFilter]
  )

  const searchNorm = useMemo(() => normalizeSearch(searchQuery), [searchQuery])

  // Filtragem de turmas, alunos e responsáveis
  const filteredTurmas = useMemo(() => {
    const list = data?.turmas || []
    return list
      .map(t => {
        const turmaMatches = searchNorm ? normalizeSearch(t.nome).includes(searchNorm) : false
        const filteredAlunos = t.alunos.filter(a => {
          const stuStatusOk = matchesStatusFilter(a.status) || a.responsaveis.some(r => matchesStatusFilter(r.status))
          if (!stuStatusOk) return false
          if (!searchNorm || turmaMatches) return true
          if (normalizeSearch(a.nome).includes(searchNorm)) return true
          if (a.matricula && normalizeSearch(a.matricula).includes(searchNorm)) return true
          return a.responsaveis.some(r => normalizeSearch(r.nome).includes(searchNorm))
        })
        if (filteredAlunos.length === 0) return null
        return { ...t, alunos: filteredAlunos }
      })
      .filter(Boolean) as AuditoriaTurma[]
  }, [data?.turmas, searchNorm, matchesStatusFilter])

  const filteredGrupos = useMemo(() => {
    const list = data?.grupos || []
    return list
      .map(g => {
        const grpMatches = searchNorm ? normalizeSearch(g.nome).includes(searchNorm) : false
        const filteredColabs = g.colaboradores.filter(c => {
          if (!matchesStatusFilter(c.status)) return false
          if (!searchNorm || grpMatches) return true
          return (
            normalizeSearch(c.nome).includes(searchNorm) ||
            normalizeSearch(c.cargo).includes(searchNorm)
          )
        })
        if (searchNorm && !grpMatches && filteredColabs.length === 0) return null
        if (statusFilter !== 'todos' && filteredColabs.length === 0) return null
        return { ...g, colaboradores: filteredColabs }
      })
      .filter(Boolean) as AuditoriaGrupo[]
  }, [data?.grupos, searchNorm, matchesStatusFilter, statusFilter])

  const filteredColaboradores = useMemo(() => {
    const list = data?.colaboradores || []
    return list.filter(c => {
      if (!matchesStatusFilter(c.status)) return false
      if (!searchNorm) return true
      return (
        normalizeSearch(c.nome).includes(searchNorm) ||
        normalizeSearch(c.cargo).includes(searchNorm) ||
        (c.email && normalizeSearch(c.email).includes(searchNorm))
      )
    })
  }, [data?.colaboradores, searchNorm, matchesStatusFilter])

  const toggleTurma = (turmaId: string) => {
    setExpandedTurmas(prev => ({ ...prev, [turmaId]: !prev[turmaId] }))
  }

  const handleExportCsv = () => {
    if (!data) return
    const escapeCsv = (val: any) => {
      const s = String(val ?? '').replace(/"/g, '""')
      return `"${s}"`
    }
    const headers = [
      'Tipo',
      'Turma / Grupo',
      'Destinatário (Aluno/Colaborador)',
      'Responsável',
      'Parentesco',
      'Telefone',
      'Status',
      'Recebeu em',
      'Canal Entrega',
      'Leu em',
      'Ciente em',
    ]
    const rows: string[] = [headers.map(escapeCsv).join(';')]

    data.turmas.forEach(t => {
      t.alunos.forEach(a => {
        if (a.responsaveis.length === 0) {
          rows.push(
            [
              'Aluno',
              t.nome,
              a.nome,
              'Sem responsável vinculado',
              '-',
              '-',
              getStatusBadgeMeta(a.status).shortLabel,
              formatDateTimeShort(a.recebeuEm),
              '-',
              formatDateTimeShort(a.leuEm),
              formatDateTimeShort(a.cienteEm),
            ]
              .map(escapeCsv)
              .join(';')
          )
        } else {
          a.responsaveis.forEach(r => {
            rows.push(
              [
                'Família',
                t.nome,
                a.nome,
                r.nome,
                r.parentesco,
                r.telefone || '',
                getStatusBadgeMeta(r.status, { statusConta: r.statusConta }).label,
                formatDateTimeShort(r.recebeuEm),
                r.canalRecebimento || '-',
                formatDateTimeShort(r.leuEm),
                formatDateTimeShort(r.cienteEm),
              ]
                .map(escapeCsv)
                .join(';')
            )
          })
        }
      })
    })

    data.colaboradores.forEach(c => {
      rows.push(
        [
          'Colaborador',
          c.cargo,
          c.nome,
          '-',
          '-',
          '-',
          getStatusBadgeMeta(c.status).shortLabel,
          formatDateTimeShort(c.recebeuEm),
          c.canalRecebimento || '-',
          formatDateTimeShort(c.leuEm),
          '-',
        ]
          .map(escapeCsv)
          .join(';')
      )
    })

    const csvContent = '\uFEFF' + rows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const safeTitle = (data.comunicado.titulo || 'destinatarios')
      .replace(/[^a-zA-Z0-9À-ÿ_-]+/g, '_')
      .slice(0, 40)
    a.download = `destinatarios_${safeTitle}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!isOpen || !mounted || typeof document === 'undefined') return null

  const resumo = data?.resumo
  const comInfo = data?.comunicado
  const hasTurmas = (data?.turmas?.length || 0) > 0
  const hasGrupos = (data?.grupos?.length || 0) > 0
  const hasColabs = (data?.colaboradores?.length || 0) > 0
  const sectionCount = [hasTurmas, hasGrupos, hasColabs].filter(Boolean).length

  const totalPendentesLembrete =
    (resumo?.alunosPendentes || 0) +
    Math.max(0, (resumo?.totalColaboradores || 0) - (resumo?.colaboradoresLeram || 0))

  const effectiveCanEditReport = canEditReportOverride ?? Boolean(data?.permissions?.canEditReport)

  const readPctAlunos =
    resumo && resumo.totalAlunos > 0 ? Math.round((resumo.alunosLeram / resumo.totalAlunos) * 100) : 0
  const readPctColabs =
    resumo && resumo.totalColaboradores > 0
      ? Math.round((resumo.colaboradoresLeram / resumo.totalColaboradores) * 100)
      : 0

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="dest-audit-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.64)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          zIndex: 100020,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
        }}
      >
        <motion.div
          key="dest-audit-dialog"
          initial={{ scale: 0.96, opacity: 0, y: 14 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 14 }}
          transition={{ type: 'spring', stiffness: 360, damping: 30 }}
          onClick={e => e.stopPropagation()}
          style={{
            background: '#F8FAFC',
            borderRadius: 24,
            width: '100%',
            maxWidth: 740,
            maxHeight: 'min(90dvh, 860px)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 25px 60px -12px rgba(15, 23, 42, 0.35)',
            border: '1px solid rgba(255, 255, 255, 0.6)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '18px 22px',
              background: '#FFFFFF',
              borderBottom: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0, flex: 1 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                  color: '#FFFFFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 6px 14px -4px rgba(79, 70, 229, 0.4)',
                }}
              >
                <Users size={20} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#0F172A' }}>
                    Destinatários & Leituras
                  </h3>
                  {comInfo?.isReport && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 99,
                        background: '#F5F3FF',
                        color: '#6D28D9',
                        border: '1px solid #DDD6FE',
                      }}
                    >
                      Relatório
                    </span>
                  )}
                  {comInfo?.isIndividual && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 99,
                        background: '#ECFEFF',
                        color: '#0E7490',
                        border: '1px solid #A5F3FC',
                      }}
                    >
                      Envio Individual
                    </span>
                  )}
                  {comInfo?.isGlobal && (
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 99,
                        background: '#ECFDF5',
                        color: '#047857',
                        border: '1px solid #A7F3D0',
                      }}
                    >
                      Toda a Escola
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#334155',
                    marginTop: 3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={comInfo?.titulo || comunicado?.titulo}
                >
                  {comInfo?.titulo || comunicado?.titulo || 'Comunicado'}
                </div>
                {(comInfo?.dataEnvio || comunicado?.dataEnvio) && (
                  <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={11.5} />
                    <span>
                      Enviado em {formatDateTimeShort(comInfo?.dataEnvio || comunicado?.dataEnvio)}
                      {comInfo?.autor ? ` por ${comInfo.autor}` : ''}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => fetchAuditoria(true)}
                disabled={loading || refreshing}
                title="Atualizar status de entrega e leitura"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: loading || refreshing ? 'not-allowed' : 'pointer',
                }}
              >
                <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  border: '1px solid #E2E8F0',
                  background: '#F1F5F9',
                  color: '#475569',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
              <div style={{ padding: '48px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <Loader2 size={32} color="#6366F1" className="animate-spin" />
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#64748B' }}>
                  Carregando turmas, alunos, responsáveis e status de entrega...
                </div>
              </div>
            ) : error ? (
              <div
                style={{
                  padding: 20,
                  borderRadius: 16,
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#B91C1C',
                  fontSize: 13.5,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <span>{error}</span>
                <button
                  type="button"
                  onClick={() => fetchAuditoria(false)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#DC2626',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  Tentar novamente
                </button>
              </div>
            ) : data && resumo ? (
              <>
                {/* KPI Summary Cards (clickable filters) */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 10,
                  }}
                >
                  {resumo.totalAlunos > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('todos')}
                        style={{
                          textAlign: 'left',
                          padding: '12px 14px',
                          borderRadius: 14,
                          background: '#FFFFFF',
                          border: statusFilter === 'todos' ? '2px solid #6366F1' : '1px solid #E2E8F0',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                          Alunos Alvo
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginTop: 2 }}>
                          {resumo.totalAlunos}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
                          {resumo.totalResponsaveis} responsável(is)
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatusFilter(prev => (prev === 'read' ? 'todos' : 'read'))}
                        style={{
                          textAlign: 'left',
                          padding: '12px 14px',
                          borderRadius: 14,
                          background: statusFilter === 'read' ? '#ECFDF5' : '#FFFFFF',
                          border: statusFilter === 'read' ? '2px solid #10B981' : '1px solid #E2E8F0',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#059669', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <CheckCheck size={12} /> Leram
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#047857', marginTop: 2 }}>
                          {resumo.alunosLeram}{' '}
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#10B981' }}>({readPctAlunos}%)</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 99, background: '#D1FAE5', marginTop: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${readPctAlunos}%`, height: '100%', background: '#10B981', borderRadius: 99 }} />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatusFilter(prev => (prev === 'received' ? 'todos' : 'received'))}
                        style={{
                          textAlign: 'left',
                          padding: '12px 14px',
                          borderRadius: 14,
                          background: statusFilter === 'received' ? '#EFF6FF' : '#FFFFFF',
                          border: statusFilter === 'received' ? '2px solid #3B82F6' : '1px solid #E2E8F0',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Smartphone size={12} /> Receberam
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#1D4ED8', marginTop: 2 }}>
                          {resumo.alunosReceberam}
                        </div>
                        <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>
                          {resumo.alunosReceberamSemLer > 0
                            ? `${resumo.alunosReceberamSemLer} sem abrir ainda`
                            : 'Push/App entregue'}
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStatusFilter(prev => (prev === 'unread' ? 'todos' : 'unread'))}
                        style={{
                          textAlign: 'left',
                          padding: '12px 14px',
                          borderRadius: 14,
                          background: statusFilter === 'unread' ? '#FEF2F2' : '#FFFFFF',
                          border: statusFilter === 'unread' ? '2px solid #EF4444' : '1px solid #E2E8F0',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#DC2626', textTransform: 'uppercase' }}>
                          Não Leram
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#B91C1C', marginTop: 2 }}>
                          {resumo.alunosPendentes}
                        </div>
                        <div style={{ fontSize: 11, color: resumo.alunosSemAcesso > 0 ? '#B45309' : '#64748B', fontWeight: 600 }}>
                          {resumo.alunosSemAcesso > 0
                            ? `${resumo.alunosSemAcesso} sem app ativo`
                            : 'Aguardando leitura'}
                        </div>
                      </button>

                      {comInfo?.exigeCiencia && (
                        <div
                          style={{
                            padding: '12px 14px',
                            borderRadius: 14,
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                          }}
                        >
                          <div style={{ fontSize: 10.5, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ShieldCheck size={12} /> Cientes
                          </div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: '#6D28D9', marginTop: 2 }}>
                            {resumo.alunosCientes}
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#94A3B8' }}>/{resumo.totalAlunos}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>Ciência confirmada</div>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div style={{ padding: '12px 14px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                          Colaboradores
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#0F172A', marginTop: 2 }}>
                          {resumo.totalColaboradores}
                        </div>
                      </div>
                      <div style={{ padding: '12px 14px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                          Leram
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#047857', marginTop: 2 }}>
                          {resumo.colaboradoresLeram}{' '}
                          <span style={{ fontSize: 13, color: '#10B981' }}>({readPctColabs}%)</span>
                        </div>
                      </div>
                      <div style={{ padding: '12px 14px', borderRadius: 14, background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase' }}>
                          Receberam
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#1D4ED8', marginTop: 2 }}>
                          {resumo.colaboradoresReceberam}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Search + Status Filter + Section Tabs */}
                <div
                  style={{
                    background: '#FFFFFF',
                    borderRadius: 16,
                    border: '1px solid #E2E8F0',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 9,
                  }}
                >
                  <div style={{ position: 'relative', width: '100%' }}>
                    <Search
                      size={15}
                      color="#94A3B8"
                      style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Buscar turma, aluno, responsável ou colaborador..."
                      style={{
                        width: '100%',
                        height: 36,
                        paddingLeft: 34,
                        paddingRight: searchQuery ? 30 : 12,
                        borderRadius: 10,
                        border: '1px solid #E2E8F0',
                        background: '#F8FAFC',
                        fontSize: 13,
                        color: '#0F172A',
                        outline: 'none',
                        boxSizing: 'border-box',
                      }}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        style={{
                          position: 'absolute',
                          right: 8,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          border: 'none',
                          background: 'transparent',
                          color: '#94A3B8',
                          cursor: 'pointer',
                          padding: 2,
                          display: 'flex',
                        }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Filters Row — sempre em uma única linha */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 4,
                        flexWrap: 'nowrap',
                        width: '100%',
                      }}
                    >
                      {(
                        [
                          { id: 'todos', label: 'Todos' },
                          { id: 'read', label: 'Leram' },
                          { id: 'received', label: 'Só receberam' },
                          { id: 'unread', label: 'Não leram' },
                          { id: 'no_channel', label: 'Sem App' },
                        ] as { id: StatusFilter; label: string }[]
                      ).map(opt => {
                        const active = statusFilter === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setStatusFilter(opt.id)}
                            style={{
                              flex: '1 1 auto',
                              minWidth: 0,
                              padding: '5px clamp(5px, 1.5vw, 10px)',
                              borderRadius: 99,
                              fontSize: 'clamp(10px, 2.5vw, 11.5px)',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              textAlign: 'center',
                              border: active ? '1px solid #4F46E5' : '1px solid #E2E8F0',
                              background: active ? '#EEF2FF' : '#FFFFFF',
                              color: active ? '#4338CA' : '#64748B',
                              cursor: 'pointer',
                            }}
                          >
                            {opt.label}
                          </button>
                        )
                      })}
                    </div>

                    {sectionCount > 1 && (
                      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', padding: 3, borderRadius: 10, flexWrap: 'nowrap', width: '100%' }}>
                        {(
                          [
                            { id: 'todos', label: 'Tudo', show: true },
                            { id: 'turmas', label: `Turmas (${data.turmas.length})`, show: hasTurmas },
                            { id: 'grupos', label: `Grupos (${data.grupos.length})`, show: hasGrupos },
                            { id: 'colaboradores', label: `Equipe (${data.colaboradores.length})`, show: hasColabs },
                          ] as { id: SectionTab; label: string; show: boolean }[]
                        )
                          .filter(t => t.show)
                          .map(tab => {
                            const active = sectionTab === tab.id
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setSectionTab(tab.id)}
                                style={{
                                  flex: '1 1 0',
                                  minWidth: 0,
                                  padding: '5px 6px',
                                  borderRadius: 7,
                                  border: 'none',
                                  fontSize: 'clamp(10.5px, 2.6vw, 11.5px)',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  textAlign: 'center',
                                  cursor: 'pointer',
                                  background: active ? '#FFFFFF' : 'transparent',
                                  color: active ? '#0F172A' : '#64748B',
                                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                                }}
                              >
                                {tab.label}
                              </button>
                            )
                          })}
                      </div>
                    )}
                  </div>
                </div>

                {/* SECTION: TURMAS (Clicável -> Alunos -> Responsáveis) */}
                {(sectionTab === 'todos' || sectionTab === 'turmas') && filteredTurmas.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                        Turmas e Alunos ({filteredTurmas.length})
                      </span>
                      <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>
                        Clique na turma para ver alunos e responsáveis
                      </span>
                    </div>

                    {filteredTurmas.map(turma => {
                      const forceExpand = Boolean(searchNorm || statusFilter !== 'todos')
                      const isExpanded = forceExpand || !!expandedTurmas[turma.id]
                      const turmaPct =
                        turma.totalAlunos > 0 ? Math.round((turma.leramCount / turma.totalAlunos) * 100) : 0

                      return (
                        <div
                          key={turma.id}
                          style={{
                            background: '#FFFFFF',
                            borderRadius: 16,
                            border: isExpanded ? '1.5px solid #C7D2FE' : '1px solid #E2E8F0',
                            overflow: 'hidden',
                            boxShadow: isExpanded ? '0 8px 20px -8px rgba(79, 70, 229, 0.16)' : '0 1px 2px rgba(15,23,42,0.02)',
                            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                          }}
                        >
                          {/* Turma Header (Clickable) */}
                          <button
                            type="button"
                            onClick={() => toggleTurma(turma.id)}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '13px 16px',
                              background: isExpanded ? '#F8FAFF' : '#FFFFFF',
                              border: 'none',
                              borderBottom: isExpanded ? '1px solid #E0E7FF' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 12,
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  width: 34,
                                  height: 34,
                                  borderRadius: 10,
                                  background: turma.cor ? `${turma.cor}1A` : '#EEF2FF',
                                  border: `1px solid ${turma.cor ? `${turma.cor}40` : '#C7D2FE'}`,
                                  color: turma.cor || '#4F46E5',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                <GraduationCap size={17} />
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 13.5, fontWeight: 800, color: '#0F172A' }}>
                                    {turma.nome}
                                  </span>
                                  {turma.isPartial && (
                                    <span
                                      style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        padding: '1px 7px',
                                        borderRadius: 99,
                                        background: '#ECFEFF',
                                        color: '#0E7490',
                                        border: '1px solid #A5F3FC',
                                      }}
                                    >
                                      Individual
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11.5, color: '#64748B', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                  <span>
                                    <strong>{turma.alunos.length}</strong> aluno{turma.alunos.length !== 1 ? 's' : ''}
                                  </span>
                                  <span>•</span>
                                  <span style={{ color: '#059669', fontWeight: 700 }}>
                                    {turma.leramCount} leram
                                  </span>
                                  <span>•</span>
                                  <span style={{ color: '#2563EB', fontWeight: 600 }}>
                                    {turma.receberamCount} receberam
                                  </span>
                                  {turma.semAcessoCount > 0 && (
                                    <>
                                      <span>•</span>
                                      <span style={{ color: '#D97706', fontWeight: 600 }}>
                                        {turma.semAcessoCount} sem app
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                              <div style={{ textAlign: 'right', minWidth: 58 }}>
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 800,
                                    color: turmaPct >= 75 ? '#059669' : turmaPct >= 40 ? '#D97706' : '#64748B',
                                  }}
                                >
                                  {turmaPct}%
                                </div>
                                <div style={{ width: 52, height: 5, borderRadius: 99, background: '#E2E8F0', overflow: 'hidden', marginTop: 2 }}>
                                  <div
                                    style={{
                                      width: `${turmaPct}%`,
                                      height: '100%',
                                      borderRadius: 99,
                                      background: turmaPct >= 75 ? '#10B981' : turmaPct >= 40 ? '#F59E0B' : '#6366F1',
                                    }}
                                  />
                                </div>
                              </div>
                              {isExpanded ? <ChevronDown size={18} color="#4F46E5" /> : <ChevronRight size={18} color="#94A3B8" />}
                            </div>
                          </button>

                          {/* Expanded Students & Responsáveis */}
                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div style={{ padding: '10px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {turma.alunos.map(aluno => {
                                    const photo =
                                      aluno.avatarUrl ||
                                      fallbackAlunoPhotoMap.get(aluno.plainId) ||
                                      fallbackAlunoPhotoMap.get(aluno.id) ||
                                      null
                                    const tone = getAvatarTone(aluno.nome)
                                    const stuBadge = getStatusBadgeMeta(aluno.status, {
                                      leuEm: aluno.leuEm,
                                      recebeuEm: aluno.recebeuEm,
                                    })
                                    const reportAnexoStr =
                                      reportAnexoByStudentId.get(aluno.plainId) ||
                                      reportAnexoByStudentId.get(aluno.id) ||
                                      null

                                    return (
                                      <div
                                        key={aluno.id}
                                        style={{
                                          borderRadius: 14,
                                          border: '1px solid #E2E8F0',
                                          background: '#FAFBFD',
                                          padding: '11px 13px',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: 9,
                                        }}
                                      >
                                        {/* Student Row */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: '1 1 200px' }}>
                                            <div
                                              style={{
                                                width: 34,
                                                height: 34,
                                                borderRadius: '50%',
                                                background: tone.bg,
                                                border: `1.5px solid ${tone.border}`,
                                                color: tone.text,
                                                fontSize: 12,
                                                fontWeight: 800,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden',
                                                flexShrink: 0,
                                              }}
                                            >
                                              {photo ? (
                                                <img
                                                  src={photo}
                                                  alt={aluno.nome}
                                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                              ) : (
                                                getInitials(aluno.nome)
                                              )}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                              <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', lineHeight: 1.25 }}>
                                                {aluno.nome}
                                              </div>
                                              <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 1 }}>
                                                {aluno.matricula && <span>Mat. {aluno.matricula}</span>}
                                                {aluno.responsaveis.length > 0 && (
                                                  <span>
                                                    {aluno.matricula ? '• ' : ''}
                                                    {aluno.responsaveis.length} responsável{aluno.responsaveis.length !== 1 ? 'is' : ''}
                                                  </span>
                                                )}
                                                {aluno.alunoProprioLeu && (
                                                  <span
                                                    style={{
                                                      color: '#4F46E5',
                                                      fontWeight: 700,
                                                      background: '#EEF2FF',
                                                      padding: '1px 6px',
                                                      borderRadius: 6,
                                                      fontSize: 10,
                                                    }}
                                                  >
                                                    Aluno abriu {formatDateTimeShort(aluno.alunoProprioLeuEm)}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          </div>

                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            {reportAnexoStr && onOpenStudentReport && (
                                              <>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    onOpenStudentReport({
                                                      string: reportAnexoStr,
                                                      studentId: aluno.id,
                                                      studentName: aluno.nome,
                                                      studentAvatar: photo,
                                                      editMode: false,
                                                    })
                                                  }
                                                  style={{
                                                    padding: '4px 9px',
                                                    borderRadius: 8,
                                                    border: '1px solid #DDD6FE',
                                                    background: '#F5F3FF',
                                                    color: '#6D28D9',
                                                    fontSize: 11,
                                                    fontWeight: 700,
                                                    cursor: 'pointer',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                  }}
                                                >
                                                  <FileBarChart size={12} /> Relatório
                                                </button>
                                                {effectiveCanEditReport && (
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      onOpenStudentReport({
                                                        string: reportAnexoStr,
                                                        studentId: aluno.id,
                                                        studentName: aluno.nome,
                                                        studentAvatar: photo,
                                                        editMode: true,
                                                      })
                                                    }
                                                    title="Editar relatório individual"
                                                    style={{
                                                      padding: '4px 8px',
                                                      borderRadius: 8,
                                                      border: 'none',
                                                      background: '#4F46E5',
                                                      color: '#FFFFFF',
                                                      fontSize: 11,
                                                      fontWeight: 700,
                                                      cursor: 'pointer',
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: 4,
                                                    }}
                                                  >
                                                    <Edit2 size={11} /> Editar
                                                  </button>
                                                )}
                                              </>
                                            )}

                                            <span
                                              title={stuBadge.title}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                padding: '3px 9px',
                                                borderRadius: 99,
                                                fontSize: 11,
                                                fontWeight: 700,
                                                background: stuBadge.bg,
                                                color: stuBadge.color,
                                                border: `1px solid ${stuBadge.border}`,
                                              }}
                                            >
                                              <StatusIcon type={stuBadge.iconType} size={12} />
                                              {stuBadge.shortLabel}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Responsáveis List */}
                                        <div
                                          style={{
                                            marginLeft: 14,
                                            paddingLeft: 12,
                                            borderLeft: '2px solid #E2E8F0',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: 6,
                                          }}
                                        >
                                          {aluno.responsaveis.length === 0 ? (
                                            <div style={{ fontSize: 11.5, color: '#94A3B8', fontStyle: 'italic', padding: '2px 0' }}>
                                              Nenhum responsável vinculado no cadastro do aluno.
                                            </div>
                                          ) : (
                                            aluno.responsaveis.map(resp => {
                                              const rBadge = getStatusBadgeMeta(resp.status, {
                                                leuEm: resp.leuEm,
                                                recebeuEm: resp.recebeuEm,
                                                canal: resp.canalRecebimento,
                                                statusConta: resp.statusConta,
                                              })
                                              const rTone = getAvatarTone(resp.nome)
                                              return (
                                                <div
                                                  key={resp.id}
                                                  style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 8,
                                                    padding: '7px 10px',
                                                    borderRadius: 10,
                                                    background: '#FFFFFF',
                                                    border: '1px solid #F1F5F9',
                                                    flexWrap: 'wrap',
                                                  }}
                                                >
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 180px' }}>
                                                    <div
                                                      style={{
                                                        width: 26,
                                                        height: 26,
                                                        borderRadius: '50%',
                                                        background: rTone.bg,
                                                        color: rTone.text,
                                                        border: `1px solid ${rTone.border}`,
                                                        fontSize: 10,
                                                        fontWeight: 800,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        overflow: 'hidden',
                                                        flexShrink: 0,
                                                      }}
                                                    >
                                                      {resp.avatarUrl ? (
                                                        <img
                                                          src={resp.avatarUrl}
                                                          alt={resp.nome}
                                                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                      ) : (
                                                        getInitials(resp.nome)
                                                      )}
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                                        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1E293B' }}>
                                                          {resp.nome}
                                                        </span>
                                                        {resp.isFinanceiro && (
                                                          <span style={{ padding: '1px 5px', background: '#DCFCE7', color: '#166534', borderRadius: 4, fontSize: 9, fontWeight: 800 }}>
                                                            FIN
                                                          </span>
                                                        )}
                                                        {resp.isPedagogico && (
                                                          <span style={{ padding: '1px 5px', background: '#E0E7FF', color: '#3730A3', borderRadius: 4, fontSize: 9, fontWeight: 800 }}>
                                                            PED
                                                          </span>
                                                        )}
                                                      </div>
                                                      <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                        <span>{resp.parentesco}</span>
                                                        {resp.telefone && (
                                                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#94A3B8' }}>
                                                            • <Phone size={9.5} /> {resp.telefone}
                                                          </span>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>

                                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                                    {resp.ciente && (
                                                      <span
                                                        title={resp.cienteEm ? `Ciente em ${formatDateTimeShort(resp.cienteEm)}` : 'Ciência confirmada'}
                                                        style={{
                                                          display: 'inline-flex',
                                                          alignItems: 'center',
                                                          gap: 3,
                                                          padding: '2px 7px',
                                                          borderRadius: 99,
                                                          fontSize: 10.5,
                                                          fontWeight: 700,
                                                          background: '#F5F3FF',
                                                          color: '#6D28D9',
                                                          border: '1px solid #DDD6FE',
                                                        }}
                                                      >
                                                        <ShieldCheck size={11} /> Ciente
                                                      </span>
                                                    )}
                                                    <span
                                                      title={rBadge.title}
                                                      style={{
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: 4,
                                                        padding: '3px 8px',
                                                        borderRadius: 99,
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        background: rBadge.bg,
                                                        color: rBadge.color,
                                                        border: `1px solid ${rBadge.border}`,
                                                      }}
                                                    >
                                                      <StatusIcon type={rBadge.iconType} size={11.5} />
                                                      {rBadge.label}
                                                    </span>
                                                  </div>
                                                </div>
                                              )
                                            })
                                          )}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* SECTION: GRUPOS (Expandable) */}
                {(sectionTab === 'todos' || sectionTab === 'grupos') && filteredGrupos.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, padding: '0 4px' }}>
                      Grupos e Equipes ({filteredGrupos.length})
                    </span>
                    {filteredGrupos.map(grp => {
                      const isGrpOpen = Boolean(searchNorm || expandedGrupos[grp.id])
                      return (
                        <div
                          key={grp.id}
                          style={{
                            background: '#FFFFFF',
                            borderRadius: 14,
                            border: '1px solid #E2E8F0',
                            overflow: 'hidden',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedGrupos(prev => ({ ...prev, [grp.id]: !prev[grp.id] }))}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: '11px 14px',
                              background: isGrpOpen ? '#FAF5FF' : '#FFFFFF',
                              border: 'none',
                              borderBottom: isGrpOpen ? '1px solid #F3E8FF' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div
                                style={{
                                  width: 30,
                                  height: 30,
                                  borderRadius: 9,
                                  background: '#F5F3FF',
                                  color: '#7C3AED',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Layers size={15} />
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{grp.nome}</div>
                                <div style={{ fontSize: 11, color: '#64748B' }}>
                                  {grp.colaboradores.length > 0 && `${grp.leramCount}/${grp.colaboradores.length} leram`}
                                  {grp.alunosCount > 0 && `${grp.colaboradores.length > 0 ? ' • ' : ''}${grp.alunosCount} aluno(s)`}
                                </div>
                              </div>
                            </div>
                            {isGrpOpen ? <ChevronDown size={17} color="#7C3AED" /> : <ChevronRight size={17} color="#94A3B8" />}
                          </button>

                          {isGrpOpen && grp.colaboradores.length > 0 && (
                            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {grp.colaboradores.map(col => (
                                <ColaboradorRow key={col.id} col={col} />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* SECTION: COLABORADORES */}
                {(sectionTab === 'todos' || sectionTab === 'colaboradores') && filteredColaboradores.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, padding: '0 4px' }}>
                      Colaboradores ({filteredColaboradores.length})
                    </span>
                    <div
                      style={{
                        background: '#FFFFFF',
                        borderRadius: 14,
                        border: '1px solid #E2E8F0',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {filteredColaboradores.map(col => (
                        <ColaboradorRow key={col.id} col={col} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty search / filter state */}
                {filteredTurmas.length === 0 && filteredGrupos.length === 0 && filteredColaboradores.length === 0 && (
                  <div
                    style={{
                      padding: '36px 20px',
                      textAlign: 'center',
                      background: '#FFFFFF',
                      borderRadius: 16,
                      border: '1px dashed #CBD5E1',
                    }}
                  >
                    <Eye size={28} color="#94A3B8" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>
                      Nenhum destinatário encontrado para este filtro
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
                      Tente limpar a busca ou selecionar "Todos".
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '12px 20px',
              background: '#FFFFFF',
              borderTop: '1px solid #E2E8F0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
              flexShrink: 0,
            }}
          >
            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11, color: '#64748B', fontWeight: 600 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <CheckCheck size={13} color="#059669" /> Lido
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <CheckCheck size={13} color="#2563EB" /> Recebeu
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Check size={13} color="#64748B" /> Enviado
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <AlertTriangle size={12} color="#D97706" /> Sem App
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap' }}>
              {data && (
                <button
                  type="button"
                  onClick={handleExportCsv}
                  style={{
                    height: 36,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    color: '#334155',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Download size={14} /> Exportar CSV
                </button>
              )}

              {data?.permissions?.canSendReminder && onOpenReminderModal && totalPendentesLembrete > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenReminderModal()
                  }}
                  style={{
                    height: 36,
                    padding: '0 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                    color: '#FFFFFF',
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '0 4px 12px -3px rgba(217, 119, 6, 0.45)',
                  }}
                >
                  <BellRing size={14} /> Lembrete ({totalPendentesLembrete})
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                style={{
                  height: 36,
                  padding: '0 16px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#E2E8F0',
                  color: '#334155',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

function ColaboradorRow({ col }: { col: AuditoriaColaborador }) {
  const tone = getAvatarTone(col.nome)
  const badge = getStatusBadgeMeta(col.status, {
    leuEm: col.leuEm,
    recebeuEm: col.recebeuEm,
    canal: col.canalRecebimento,
  })
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        padding: '8px 10px',
        borderRadius: 10,
        background: '#FAFBFD',
        border: '1px solid #F1F5F9',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: '1 1 180px' }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: tone.bg,
            color: tone.text,
            border: `1px solid ${tone.border}`,
            fontSize: 11,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {col.avatarUrl ? (
            <img src={col.avatarUrl} alt={col.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            getInitials(col.nome)
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{col.nome}</div>
          <div style={{ fontSize: 11, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Briefcase size={10.5} /> {col.cargo}
          </div>
        </div>
      </div>

      <span
        title={badge.title}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 9px',
          borderRadius: 99,
          fontSize: 11,
          fontWeight: 700,
          background: badge.bg,
          color: badge.color,
          border: `1px solid ${badge.border}`,
        }}
      >
        <StatusIcon type={badge.iconType} size={11.5} />
        {badge.label}
      </span>
    </div>
  )
}
