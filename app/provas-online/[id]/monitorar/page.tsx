'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Users, Clock, Wifi, WifiOff, AlertTriangle, CheckCircle2,
  Send, RefreshCw, Plus, Search, MessageSquare, Play,
  Square, Eye, ChevronRight, ArrowLeft, Check,
  Lock, Unlock, Printer, Link2, Copy, X, ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'
import { ProvaOnline } from '@/types/provas-online'

interface StudentMonitorRow {
  alunoId: string
  alunoNome: string
  alunoMatricula: string
  alunoFoto?: string
  turma: string
  situacao: 'nao_iniciada' | 'em_andamento' | 'entregue' | 'expirada' | 'suspensa'
  statusConexao: 'online' | 'instavel' | 'sem_sinal' | 'desconectado'
  questoesRespondidas: number
  percentualConcluido: number
  tempoRestanteSegundos: number | null
  tentativaId: string | null
  ocorrenciasCount: number
  notaFinal: number | null
}

// ─── inline style tokens ────────────────────────────────────────────────────
const S = {
  card: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    padding: '20px 24px',
  } as React.CSSProperties,
  cardSm: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 16,
    padding: '16px',
  } as React.CSSProperties,
  label: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.08em',
    color: '#64748b',
  },
  btnPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 36,
    padding: '0 16px',
    borderRadius: 10,
    border: 'none',
    background: '#0284c7',
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s',
  } as React.CSSProperties,
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 36,
    padding: '0 14px',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    background: '#ffffff',
    color: '#334155',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s',
  } as React.CSSProperties,
  btnGhost: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 36,
    padding: '0 12px',
    borderRadius: 10,
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
    color: '#334155',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background 0.15s',
  } as React.CSSProperties,
  pill: (color: string, bg: string, border: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '2px 10px',
    borderRadius: 99,
    border: `1px solid ${border}`,
    background: bg,
    color,
    fontSize: 11,
    fontWeight: 700,
  } as React.CSSProperties),
  metricCard: (borderColor: string, topColor?: string) => ({
    background: '#ffffff',
    border: `1px solid ${borderColor}`,
    borderRadius: 16,
    padding: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    gap: 12,
    position: 'relative' as const,
    overflow: 'hidden' as const,
    ...(topColor ? { borderTop: `3px solid ${topColor}` } : {}),
  }),
}

export default function MonitoramentoProvaPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [prova, setProva] = useState<ProvaOnline | null>(null)
  const [metricas, setMetricas] = useState<any>(null)
  const [alunos, setAlunos] = useState<StudentMonitorRow[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [copiedLink, setCopiedLink] = useState(false)

  const handleCopyStudentLink = async () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const link = `${origin}/provas-online/fazer/${id}`
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(link)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = link
        textArea.style.position = 'fixed'
        textArea.style.opacity = '0'
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopiedLink(true)
      toast.success('Link copiado! Envie aos estudantes.')
      setTimeout(() => setCopiedLink(false), 3000)
    } catch (err) {
      toast.error('Não foi possível copiar o link.')
    }
  }

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [filterTurma, setFilterTurma] = useState<string>('todas')

  // Modals
  const [addTimeModal, setAddTimeModal] = useState<{ open: boolean; aluno: StudentMonitorRow | null }>({ open: false, aluno: null })
  const [extraMinutes, setExtraMinutes] = useState(10)
  const [timeJustification, setTimeJustification] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)

  const [messageModal, setMessageModal] = useState<{
    open: boolean
    target: 'geral' | 'individual'
    aluno?: StudentMonitorRow | null
  }>({ open: false, target: 'geral', aluno: null })
  const [messageText, setMessageText] = useState('')

  const [incidentLogsModal, setIncidentLogsModal] = useState<{
    open: boolean
    aluno: StudentMonitorRow | null
    logs: any[]
    loading: boolean
  }>({ open: false, aluno: null, logs: [], loading: false })

  const [batchTimeModal, setBatchTimeModal] = useState<{ open: boolean; minutes: number; justification: string }>({
    open: false, minutes: 10, justification: ''
  })

  // Load Data
  const fetchData = async (isManual = false) => {
    if (!id) return
    if (isManual) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/provas-online/${id}/monitoramento`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar dados')
      setProva(data.prova)
      setMetricas(data.metricas)
      setAlunos(data.alunos || [])
      setLastUpdated(new Date())
    } catch (err: any) {
      toast.error(err.message || 'Falha ao carregar monitoramento')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(() => fetchData(), 30000)
    return () => clearInterval(interval)
  }, [id])

  const handleAddTime = async () => {
    if (!addTimeModal.aluno?.tentativaId) return
    if (!timeJustification.trim()) { toast.error('Informe a justificativa.'); return }
    setSubmittingAction(true)
    try {
      const res = await fetch(`/api/provas-online/${id}/monitoramento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'acrescentar_tempo', tentativaId: addTimeModal.aluno.tentativaId, minutos: extraMinutes, justificativa: timeJustification.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao adicionar tempo')
      toast.success(`+${extraMinutes} min concedidos a ${addTimeModal.aluno.alunoNome}!`)
      setAddTimeModal({ open: false, aluno: null })
      setTimeJustification('')
      fetchData(true)
    } catch (err: any) { toast.error(err.message) }
    finally { setSubmittingAction(false) }
  }

  const handleUnlockStudent = async (aluno: StudentMonitorRow) => {
    if (!aluno.tentativaId) return
    try {
      const res = await fetch(`/api/provas-online/${id}/monitoramento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'liberar_tentativa', tentativaId: aluno.tentativaId, justificativa: 'Retomada autorizada pelo aplicador via painel' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao liberar prova')
      toast.success(`Tentativa liberada para ${aluno.alunoNome}!`)
      fetchData()
    } catch (err: any) { toast.error(err.message) }
  }

  const handleForceSubmit = async (aluno: StudentMonitorRow) => {
    if (!aluno.tentativaId) return
    if (!window.confirm(`Encerrar forçadamente a avaliação de ${aluno.alunoNome}?`)) return
    try {
      const res = await fetch(`/api/provas-online/${id}/monitoramento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'encerrar_tentativa', tentativaId: aluno.tentativaId, justificativa: 'Encerramento forçado por ordem do aplicador' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao encerrar prova')
      toast.success(`Avaliação de ${aluno.alunoNome} finalizada!`)
      fetchData()
    } catch (err: any) { toast.error(err.message) }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim()) { toast.error('Digite a mensagem.'); return }
    setSubmittingAction(true)
    try {
      const isGeneral = messageModal.target === 'geral'
      const res = await fetch(`/api/provas-online/${id}/monitoramento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'enviar_mensagem', mensagem: messageText.trim(), tipoMensagem: isGeneral ? 'geral' : 'individual', tentativaId: messageModal.aluno?.tentativaId || null, alunoId: messageModal.aluno?.alunoId || null })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao transmitir')
      toast.success(isGeneral ? 'Comunicado geral enviado!' : `Mensagem enviada para ${messageModal.aluno?.alunoNome}!`)
      setMessageModal({ open: false, target: 'geral', aluno: null })
      setMessageText('')
      fetchData()
    } catch (err: any) { toast.error(err.message) }
    finally { setSubmittingAction(false) }
  }

  const handleOpenIncidentLogs = async (aluno: StudentMonitorRow) => {
    if (!aluno.tentativaId) return
    setIncidentLogsModal({ open: true, aluno, logs: [], loading: true })
    try {
      const res = await fetch(`/api/provas-online/tentativas/${aluno.tentativaId}/ocorrencias`)
      const data = await res.json()
      setIncidentLogsModal(prev => ({ ...prev, logs: data.ocorrencias || [], loading: false }))
    } catch { setIncidentLogsModal(prev => ({ ...prev, loading: false })) }
  }

  const handleAddBatchTime = async () => {
    if (batchTimeModal.minutes <= 0) { toast.error('Informe uma quantidade válida de minutos.'); return }
    if (!batchTimeModal.justification.trim()) { toast.error('Informe a justificativa.'); return }
    setSubmittingAction(true)
    try {
      const res = await fetch(`/api/provas-online/${id}/monitoramento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acao: 'acrescentar_tempo_turma', minutos: batchTimeModal.minutes, justificativa: batchTimeModal.justification.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao conceder tempo')
      toast.success(data.message || `+${batchTimeModal.minutes} min concedidos para a turma!`)
      setBatchTimeModal({ open: false, minutes: 10, justification: '' })
      fetchData(true)
    } catch (err: any) { toast.error(err.message) }
    finally { setSubmittingAction(false) }
  }

  // Filtered Students
  const filteredAlunos = useMemo(() => {
    return alunos.filter(a => {
      const matchSearch = a.alunoNome.toLowerCase().includes(search.toLowerCase()) || a.alunoMatricula.toLowerCase().includes(search.toLowerCase())
      const matchTurma = filterTurma === 'todas' || a.turma === filterTurma
      let matchStatus = true
      if (filterStatus === 'em_andamento') matchStatus = a.situacao === 'em_andamento'
      else if (filterStatus === 'entregue') matchStatus = a.situacao === 'entregue'
      else if (filterStatus === 'nao_iniciada') matchStatus = a.situacao === 'nao_iniciada'
      else if (filterStatus === 'suspensa') matchStatus = a.situacao === 'suspensa'
      else if (filterStatus === 'ocorrencias') matchStatus = a.ocorrenciasCount > 0
      return matchSearch && matchTurma && matchStatus
    })
  }, [alunos, search, filterTurma, filterStatus])

  const uniqueTurmas = useMemo(() => {
    const set = new Set<string>()
    alunos.forEach(a => { if (a.turma) set.add(a.turma) })
    return Array.from(set)
  }, [alunos])

  const computedStats = useMemo(() => {
    const total = alunos.length
    let emAndamento = 0, entregues = 0, suspensas = 0, comOcorrencias = 0
    alunos.forEach(a => {
      if (a.situacao === 'em_andamento') emAndamento++
      else if (a.situacao === 'entregue') entregues++
      else if (a.situacao === 'suspensa') suspensas++
      if ((a.ocorrenciasCount || 0) > 0) comOcorrencias++
    })
    const finalTotal = metricas?.totalEsperados ?? total
    const finalEmAndamento = metricas?.emAndamento ?? emAndamento
    const finalEntregues = metricas?.entregues ?? entregues
    const finalSuspensas = metricas?.suspensas ?? suspensas
    return {
      totalEsperados: finalTotal,
      emAndamento: finalEmAndamento,
      onlineAgora: metricas?.onlineAgora ?? alunos.filter(a => a.statusConexao === 'online').length,
      entregues: finalEntregues,
      naoIniciaram: Math.max(0, finalTotal - finalEmAndamento - finalEntregues - finalSuspensas),
      comOcorrencias: metricas?.comOcorrencias ?? comOcorrencias,
      suspensas: finalSuspensas,
    }
  }, [alunos, metricas])

  const formatSec = (s: number | null) => {
    if (s === null || s <= 0) return '00:00'
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  const statusTabs = [
    { id: 'todos', label: `Todos`, count: alunos.length },
    { id: 'em_andamento', label: `Em Prova`, count: computedStats.emAndamento },
    { id: 'entregue', label: `Entregues`, count: computedStats.entregues },
    { id: 'nao_iniciada', label: `Aguardando`, count: computedStats.naoIniciaram },
    { id: 'ocorrencias', label: `Alertas`, count: computedStats.comOcorrencias },
  ]

  if (loading && !prova) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: '#f8fafc' }}>
        <div style={{ width: 44, height: 44, borderRadius: 14, background: '#e0f2fe', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw style={{ width: 20, height: 20, color: '#0284c7' }} className="animate-spin" />
        </div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Iniciando central de supervisão...</p>
      </div>
    )
  }

  // ── MODAL BACKDROP ──────────────────────────────────────────────────────────
  const ModalBackdrop = ({ onClose, children }: { onClose: () => void; children: React.ReactNode }) => (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(15,23,42,0.45)' }}
    >
      {children}
    </div>
  )

  const ModalCard = ({ children, maxWidth = 460 }: { children: React.ReactNode; maxWidth?: number }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 10 }}
      style={{ width: '100%', maxWidth, background: '#ffffff', borderRadius: 20, border: '1px solid #e2e8f0', padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '90vh', overflowY: 'auto' }}
    >
      {children}
    </motion.div>
  )

  return (
    <div style={{ padding: '24px 20px', minHeight: '100vh', background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── HEADER CARD ─────────────────────────────────────────────────── */}
        <div style={S.card}>
          {/* Row 1: breadcrumb + status pill */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            <Link href="/provas-online" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
              <ArrowLeft style={{ width: 13, height: 13 }} /> Provas Online
            </Link>
            <span style={{ color: '#cbd5e1' }}>/</span>
            <span style={{ ...S.pill('#0369a1', '#e0f2fe', '#bae6fd'), fontSize: 11 }}>
              {prova?.disciplinaNome || prova?.disciplina || 'Geral'}
            </span>
            <span style={{ ...S.pill('#065f46', '#d1fae5', '#a7f3d0'), fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse 2s infinite' }} />
              Supervisão Ativa
            </span>
          </div>

          {/* Row 2: title + actions */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }} title={prova?.titulo || ''}>
                {prova?.titulo || 'Carregando...'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#64748b' }}>
                  <Clock style={{ width: 13, height: 13, color: '#94a3b8' }} />
                  Duração: <strong style={{ color: '#334155' }}>{prova?.duracaoMinutos || 60} min</strong>
                </span>
                <span style={{ color: '#e2e8f0' }}>•</span>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  Encerramento: <strong style={{ color: '#334155' }}>
                    {(prova?.dataHoraFim || prova?.dataEncerramento)
                      ? new Date(prova?.dataHoraFim || prova?.dataEncerramento || '').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      : '--'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                style={{ ...S.btnGhost, opacity: refreshing ? 0.6 : 1 }}
              >
                <RefreshCw style={{ width: 13, height: 13, color: '#0284c7' }} className={refreshing ? 'animate-spin' : ''} />
                <span style={{ fontSize: 11 }}>
                  {refreshing ? 'Atualizando...' : `${lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`}
                </span>
              </button>

              <button type="button" onClick={() => setMessageModal({ open: true, target: 'geral', aluno: null })} style={S.btnPrimary}>
                <Send style={{ width: 13, height: 13 }} />
                Transmitir Aviso
              </button>

              <button type="button" onClick={() => setBatchTimeModal({ open: true, minutes: 10, justification: '' })}
                style={{ ...S.btnSecondary, background: '#fffbeb', borderColor: '#fde68a', color: '#92400e' }}>
                <Clock style={{ width: 13, height: 13, color: '#b45309' }} />
                + Tempo Turma
              </button>

              <Link href={`/provas-online/${id}/imprimir`}
                style={{ ...S.btnSecondary, textDecoration: 'none' }}>
                <Printer style={{ width: 13, height: 13, color: '#64748b' }} />
                <span>Caderno</span>
              </Link>

              <Link href={`/provas-online/${id}/corrigir`}
                style={{ ...S.btnPrimary, background: '#0f172a', textDecoration: 'none' }}>
                <span>Ir para Correção</span>
                <ChevronRight style={{ width: 13, height: 13 }} />
              </Link>
            </div>
          </div>

          {/* Link strip */}
          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Link2 style={{ width: 15, height: 15, color: '#0284c7' }} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>Link Direto para Alunos</div>
                <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 400 }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/provas-online/fazer/${id}` : `/provas-online/fazer/${id}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button type="button" onClick={handleCopyStudentLink}
                style={{ ...S.btnGhost, height: 32, fontSize: 12, background: copiedLink ? '#059669' : '#ffffff', color: copiedLink ? '#ffffff' : '#334155', borderColor: copiedLink ? '#059669' : '#e2e8f0' }}>
                {copiedLink ? <Check style={{ width: 13, height: 13 }} /> : <Copy style={{ width: 13, height: 13 }} />}
                {copiedLink ? 'Copiado!' : 'Copiar Link'}
              </button>
              <a href={`/provas-online/fazer/${id}`} target="_blank" rel="noopener noreferrer"
                style={{ ...S.btnGhost, height: 32, width: 32, padding: 0, justifyContent: 'center', textDecoration: 'none' }}>
                <ExternalLink style={{ width: 13, height: 13 }} />
              </a>
            </div>
          </div>
        </div>

        {/* ── METRIC CARDS ────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          {/* Total */}
          <div style={S.metricCard('#e2e8f0')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={S.label}>Total</span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users style={{ width: 15, height: 15, color: '#64748b' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{computedStats.totalEsperados}</div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>Alunos esperados</p>
            </div>
          </div>

          {/* Em Prova */}
          <div style={S.metricCard('#bae6fd', '#0284c7')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...S.label, color: '#0369a1', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} className="animate-ping" />
                Em Prova
              </span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Play style={{ width: 14, height: 14, color: '#0284c7', fill: '#0284c7' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#0369a1', lineHeight: 1 }}>{computedStats.emAndamento}</div>
              <p style={{ fontSize: 11, color: '#0284c7', marginTop: 4, fontWeight: 600 }}>{computedStats.onlineAgora} online agora</p>
            </div>
          </div>

          {/* Entregues */}
          <div style={S.metricCard('#a7f3d0', '#10b981')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...S.label, color: '#065f46' }}>Entregues</span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 style={{ width: 15, height: 15, color: '#059669' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#065f46', lineHeight: 1 }}>{computedStats.entregues}</div>
              <p style={{ fontSize: 11, color: '#10b981', marginTop: 4, fontWeight: 600 }}>
                {computedStats.totalEsperados > 0 ? Math.round((computedStats.entregues / computedStats.totalEsperados) * 100) : 0}% de conclusão
              </p>
            </div>
          </div>

          {/* Não Iniciaram */}
          <div style={S.metricCard('#e2e8f0')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={S.label}>Aguardando</span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock style={{ width: 15, height: 15, color: '#94a3b8' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#475569', lineHeight: 1 }}>{computedStats.naoIniciaram}</div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>Não iniciaram</p>
            </div>
          </div>

          {/* Ocorrências */}
          <div style={S.metricCard('#fecaca', '#ef4444')}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ ...S.label, color: '#991b1b' }}>Ocorrências</span>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield style={{ width: 15, height: 15, color: '#ef4444' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 900, color: '#991b1b', lineHeight: 1 }}>{computedStats.comOcorrencias}</div>
              <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4, fontWeight: 600 }}>{computedStats.suspensas} suspensa(s)</p>
            </div>
          </div>
        </div>

        {/* ── TOOLBAR ─────────────────────────────────────────────────────── */}
        <div style={{ ...S.card, padding: '14px 18px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          {/* Search */}
          <div style={{ position: 'relative', minWidth: 200, maxWidth: 300, flex: 1 }}>
            <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar aluno ou matrícula..."
              style={{ width: '100%', height: 36, paddingLeft: 34, paddingRight: search ? 32 : 12, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X style={{ width: 13, height: 13, color: '#94a3b8' }} />
              </button>
            )}
          </div>

          {/* Turma filter */}
          {uniqueTurmas.length > 1 && (
            <select value={filterTurma} onChange={e => setFilterTurma(e.target.value)}
              style={{ width: 170, minWidth: 140, height: 36, padding: '0 10px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, fontWeight: 600, color: '#334155', outline: 'none', flexShrink: 0, boxSizing: 'border-box' }}>
              <option value="todas">Todas as Turmas</option>
              {uniqueTurmas.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}

          {/* Status tabs */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: 12, padding: 4, gap: 2, flexWrap: 'wrap' }}>
            {statusTabs.map(tab => {
              const active = filterStatus === tab.id
              return (
                <button key={tab.id} type="button" onClick={() => setFilterStatus(tab.id)}
                  style={{ height: 28, padding: '0 12px', borderRadius: 8, border: 'none', background: active ? '#ffffff' : 'transparent', color: active ? '#0369a1' : '#64748b', fontSize: 12, fontWeight: active ? 700 : 600, cursor: 'pointer', flexShrink: 0, boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.15s' }}>
                  {tab.label} ({tab.count})
                </button>
              )
            })}
          </div>
        </div>

        {/* ── STUDENT GRID ─────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {filteredAlunos.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', padding: '64px 24px', textAlign: 'center', background: '#ffffff', border: '2px dashed #e2e8f0', borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users style={{ width: 22, height: 22, color: '#94a3b8' }} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>Nenhum aluno encontrado</h3>
                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>Nenhum estudante corresponde aos filtros selecionados.</p>
              </div>
              {search && (
                <button onClick={() => setSearch('')} style={{ ...S.btnSecondary, height: 32, fontSize: 12 }}>
                  Limpar busca
                </button>
              )}
            </div>
          ) : filteredAlunos.map(aluno => {
            const isSuspended = aluno.situacao === 'suspensa'
            const isTaking = aluno.situacao === 'em_andamento'
            const isDelivered = aluno.situacao === 'entregue'

            let cardBorderColor = '#e2e8f0'
            let cardBorderTopColor: string | undefined
            if (isSuspended) { cardBorderColor = '#fca5a5'; cardBorderTopColor = '#ef4444' }
            else if (isTaking) { cardBorderColor = '#93c5fd'; cardBorderTopColor = '#3b82f6' }
            else if (isDelivered) { cardBorderColor = '#6ee7b7'; cardBorderTopColor = '#10b981' }

            return (
              <motion.div
                key={aluno.alunoId}
                layout
                style={{
                  background: '#ffffff',
                  border: `1px solid ${cardBorderColor}`,
                  borderTop: cardBorderTopColor ? `3px solid ${cardBorderTopColor}` : `1px solid ${cardBorderColor}`,
                  borderRadius: 16,
                  padding: 18,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 14,
                }}
              >
                {/* Student header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#475569', fontFamily: 'monospace', flexShrink: 0 }}>
                      {aluno.alunoNome.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={aluno.alunoNome}>
                        {aluno.alunoNome}
                      </h3>
                      <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {aluno.alunoMatricula || 'S/M'} · {aluno.turma}
                      </p>
                    </div>
                  </div>

                  {/* Status badge */}
                  {isTaking && (
                    <span style={{ ...S.pill('#0369a1', '#e0f2fe', '#bae6fd'), flexShrink: 0 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0284c7', display: 'inline-block' }} className="animate-ping" />
                      Em Prova
                    </span>
                  )}
                  {isDelivered && (
                    <span style={{ ...S.pill('#065f46', '#d1fae5', '#a7f3d0'), flexShrink: 0 }}>
                      <CheckCircle2 style={{ width: 11, height: 11 }} /> Entregue
                    </span>
                  )}
                  {isSuspended && (
                    <span style={{ ...S.pill('#991b1b', '#fee2e2', '#fca5a5'), flexShrink: 0 }}>
                      <Shield style={{ width: 11, height: 11 }} /> Suspensa
                    </span>
                  )}
                  {!isTaking && !isDelivered && !isSuspended && (
                    <span style={{ ...S.pill('#475569', '#f1f5f9', '#e2e8f0'), flexShrink: 0 }}>
                      <Clock style={{ width: 11, height: 11 }} /> Aguardando
                    </span>
                  )}
                </div>

                {/* Connection status */}
                {isTaking && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {aluno.statusConexao === 'online' && (
                      <span style={{ ...S.pill('#065f46', '#d1fae5', '#a7f3d0'), fontSize: 11 }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Conexão Estável
                      </span>
                    )}
                    {aluno.statusConexao === 'instavel' && (
                      <span style={{ ...S.pill('#92400e', '#fef3c7', '#fde68a'), fontSize: 11 }}>
                        <Wifi style={{ width: 11, height: 11 }} /> Instável
                      </span>
                    )}
                    {aluno.statusConexao === 'sem_sinal' && (
                      <span style={{ ...S.pill('#991b1b', '#fee2e2', '#fca5a5'), fontSize: 11 }}>
                        <WifiOff style={{ width: 11, height: 11 }} /> Sem Sinal
                      </span>
                    )}
                  </div>
                )}

                {/* Progress section */}
                {isTaking ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>
                        <span style={{ color: '#64748b' }}>Progresso</span>
                        <span style={{ color: '#0369a1', fontFamily: 'monospace' }}>{aluno.questoesRespondidas} resp. ({aluno.percentualConcluido}%)</span>
                      </div>
                      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${aluno.percentualConcluido}%`, background: '#3b82f6', borderRadius: 99, transition: 'width 0.5s' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Clock style={{ width: 13, height: 13, color: '#3b82f6' }} /> Tempo Restante
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 800, fontFamily: 'monospace', color: '#1e40af' }}>
                        {formatSec(aluno.tempoRestanteSegundos)}
                      </span>
                    </div>
                  </div>
                ) : isDelivered ? (
                  <div style={{ padding: '10px 12px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: 12, color: '#166534' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>Prova Entregue</span>
                      <CheckCircle2 style={{ width: 15, height: 15, color: '#16a34a' }} />
                    </div>
                    {aluno.notaFinal !== null && (
                      <p style={{ margin: '4px 0 0', fontFamily: 'monospace', fontWeight: 700 }}>
                        Nota: <strong style={{ color: '#15803d' }}>{aluno.notaFinal.toFixed(1)} pts</strong>
                      </p>
                    )}
                  </div>
                ) : isSuspended ? (
                  <div style={{ padding: '10px 12px', borderRadius: 12, background: '#fff1f2', border: '1px solid #fecdd3', fontSize: 12, color: '#9f1239' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 700 }}>
                      <span>Tentativa Bloqueada</span>
                      <Shield style={{ width: 15, height: 15, color: '#e11d48' }} />
                    </div>
                    <p style={{ margin: '4px 0 0', color: '#64748b' }}>Aguardando liberação do aplicador.</p>
                  </div>
                ) : (
                  <div style={{ padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12, color: '#64748b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#475569' }}>
                      <Clock style={{ width: 13, height: 13, color: '#94a3b8' }} /> Aguardando acesso
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 11 }}>Telemetria ativada quando o aluno iniciar.</p>
                  </div>
                )}

                {/* Incidents */}
                {aluno.ocorrenciasCount > 0 && (
                  <button type="button" onClick={() => handleOpenIncidentLogs(aluno)}
                    style={{ width: '100%', padding: '7px 12px', borderRadius: 10, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <AlertTriangle style={{ width: 13, height: 13, color: '#e11d48' }} />
                      {aluno.ocorrenciasCount} ocorrência(s)
                    </span>
                    <span style={{ fontSize: 11, textDecoration: 'underline', fontWeight: 700 }}>Ver Logs</span>
                  </button>
                )}

                {/* Actions footer */}
                <div style={{ paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  {isSuspended ? (
                    <button type="button" onClick={() => handleUnlockStudent(aluno)}
                      style={{ flex: 1, height: 34, borderRadius: 10, border: 'none', background: '#059669', color: '#ffffff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                      <Unlock style={{ width: 13, height: 13 }} /> Liberar Retomada
                    </button>
                  ) : isTaking ? (
                    <>
                      <button type="button" onClick={() => setAddTimeModal({ open: true, aluno })}
                        style={{ flex: 1, height: 34, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                        <Plus style={{ width: 12, height: 12, color: '#3b82f6' }} /> +Tempo
                      </button>
                      <button type="button" onClick={() => setMessageModal({ open: true, target: 'individual', aluno })}
                        style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <MessageSquare style={{ width: 14, height: 14, color: '#3b82f6' }} />
                      </button>
                      <button type="button" onClick={() => handleForceSubmit(aluno)}
                        style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #fecdd3', background: '#fff1f2', color: '#be123c', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Square style={{ width: 12, height: 12 }} />
                      </button>
                    </>
                  ) : isDelivered ? (
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} /> Concluída
                      </span>
                      <Link href={`/provas-online/${id}/corrigir`}
                        style={{ ...S.btnSecondary, height: 32, fontSize: 11, textDecoration: 'none' }}>
                        <Eye style={{ width: 12, height: 12, color: '#3b82f6' }} /> Ver Correção
                      </Link>
                    </div>
                  ) : (
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#cbd5e1', display: 'inline-block' }} /> Aguardando início
                      </span>
                      <button type="button" onClick={() => setMessageModal({ open: true, target: 'individual', aluno })}
                        style={{ ...S.btnSecondary, height: 32, fontSize: 11 }}>
                        <MessageSquare style={{ width: 12, height: 12, color: '#3b82f6' }} /> Avisar Aluno
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

      </div>

      {/* ── MODAL: ADICIONAR TEMPO INDIVIDUAL ──────────────────────────────── */}
      <AnimatePresence>
        {addTimeModal.open && addTimeModal.aluno && (
          <ModalBackdrop onClose={() => setAddTimeModal({ open: false, aluno: null })}>
            <ModalCard>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, background: '#e0f2fe', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Clock style={{ width: 20, height: 20, color: '#0284c7' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>Conceder Tempo Adicional</h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Aluno: {addTimeModal.aluno.alunoNome}</p>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Minutos a acrescentar:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[5, 10, 15, 30].map(mins => (
                    <button key={mins} type="button" onClick={() => setExtraMinutes(mins)}
                      style={{ padding: '8px 0', borderRadius: 10, border: `1px solid ${extraMinutes === mins ? '#0284c7' : '#e2e8f0'}`, background: extraMinutes === mins ? '#0284c7' : '#f8fafc', color: extraMinutes === mins ? '#ffffff' : '#334155', fontSize: 12, fontWeight: 700, fontFamily: 'monospace', cursor: 'pointer' }}>
                      +{mins} min
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Justificativa (Auditoria):</label>
                <textarea rows={3} value={timeJustification} onChange={e => setTimeJustification(e.target.value)}
                  placeholder="Ex: Aluno apresentou instabilidade de conexão..."
                  style={{ width: '100%', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: 12, color: '#0f172a', background: '#f8fafc', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                <button type="button" onClick={() => setAddTimeModal({ open: false, aluno: null })} style={{ ...S.btnSecondary }}>Cancelar</button>
                <button type="button" onClick={handleAddTime} disabled={submittingAction} style={{ ...S.btnPrimary, opacity: submittingAction ? 0.6 : 1 }}>
                  {submittingAction ? <RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" /> : <Check style={{ width: 13, height: 13 }} />}
                  Confirmar
                </button>
              </div>
            </ModalCard>
          </ModalBackdrop>
        )}
      </AnimatePresence>

      {/* ── MODAL: ENVIAR COMUNICADO ────────────────────────────────────────── */}
      <AnimatePresence>
        {messageModal.open && (
          <ModalBackdrop onClose={() => setMessageModal({ open: false, target: 'geral', aluno: null })}>
            <ModalCard>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, background: '#e0f2fe', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Send style={{ width: 20, height: 20, color: '#0284c7' }} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>
                    {messageModal.target === 'geral' ? 'Transmitir Aviso Geral' : 'Mensagem Individual'}
                  </h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                    {messageModal.target === 'geral' ? 'Aparece na tela de todos os alunos em prova.' : `Para: ${messageModal.aluno?.alunoNome}`}
                  </p>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Texto do Comunicado:</label>
                <textarea rows={4} value={messageText} onChange={e => setMessageText(e.target.value)}
                  placeholder="Ex: Atenção turma: restam 10 minutos..."
                  style={{ width: '100%', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: 12, color: '#0f172a', background: '#f8fafc', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                <button type="button" onClick={() => setMessageModal({ open: false, target: 'geral', aluno: null })} style={S.btnSecondary}>Cancelar</button>
                <button type="button" onClick={handleSendMessage} disabled={submittingAction} style={{ ...S.btnPrimary, opacity: submittingAction ? 0.6 : 1 }}>
                  {submittingAction ? <RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" /> : <Send style={{ width: 13, height: 13 }} />}
                  Transmitir
                </button>
              </div>
            </ModalCard>
          </ModalBackdrop>
        )}
      </AnimatePresence>

      {/* ── MODAL: LOGS DE OCORRÊNCIAS ──────────────────────────────────────── */}
      <AnimatePresence>
        {incidentLogsModal.open && incidentLogsModal.aluno && (
          <ModalBackdrop onClose={() => setIncidentLogsModal({ open: false, aluno: null, logs: [], loading: false })}>
            <ModalCard maxWidth={520}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fee2e2', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield style={{ width: 18, height: 18, color: '#ef4444' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', margin: 0 }}>Log de Supervisão Digital</h3>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>{incidentLogsModal.aluno.alunoNome}</p>
                  </div>
                </div>
                <button onClick={() => setIncidentLogsModal({ open: false, aluno: null, logs: [], loading: false })}
                  style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>

              <div style={{ overflowY: 'auto', maxHeight: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {incidentLogsModal.loading ? (
                  <div style={{ padding: '48px 0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: '#64748b' }}>
                    <RefreshCw style={{ width: 24, height: 24, color: '#0284c7' }} className="animate-spin" />
                    <span style={{ fontSize: 12 }}>Carregando histórico...</span>
                  </div>
                ) : incidentLogsModal.logs.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, padding: '32px 0' }}>Nenhuma ocorrência registrada.</p>
                ) : incidentLogsModal.logs.map((log: any, idx: number) => (
                  <div key={log.id || idx} style={{ padding: '12px 14px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#be123c', textTransform: 'capitalize' }}>{log.tipo?.replace('_', ' ')}</span>
                      <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: 'monospace' }}>
                        {log.createdAt ? new Date(log.createdAt).toLocaleTimeString('pt-BR') : '--'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: '#475569', margin: 0, lineHeight: 1.5 }}>{log.descricao}</p>
                  </div>
                ))}
              </div>

              <div style={{ paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setIncidentLogsModal({ open: false, aluno: null, logs: [], loading: false })} style={S.btnSecondary}>
                  Concluir
                </button>
              </div>
            </ModalCard>
          </ModalBackdrop>
        )}
      </AnimatePresence>

      {/* ── MODAL: TEMPO COLETIVO ──────────────────────────────────────────── */}
      <AnimatePresence>
        {batchTimeModal.open && (
          <ModalBackdrop onClose={() => setBatchTimeModal({ open: false, minutes: 10, justification: '' })}>
            <ModalCard>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 13, background: '#fef3c7', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock style={{ width: 20, height: 20, color: '#b45309' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: 0 }}>Tempo Coletivo para a Turma</h3>
                    <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Estender cronômetro de todos em prova</p>
                  </div>
                </div>
                <button onClick={() => setBatchTimeModal({ open: false, minutes: 10, justification: '' })}
                  style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8' }}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Minutos a adicionar:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
                  {[5, 10, 15, 20].map(m => (
                    <button key={m} type="button" onClick={() => setBatchTimeModal(prev => ({ ...prev, minutes: m }))}
                      style={{ padding: '8px 0', borderRadius: 10, border: `1px solid ${batchTimeModal.minutes === m ? '#b45309' : '#e2e8f0'}`, background: batchTimeModal.minutes === m ? '#b45309' : '#f8fafc', color: batchTimeModal.minutes === m ? '#ffffff' : '#334155', fontSize: 12, fontWeight: 700, fontFamily: 'monospace', cursor: 'pointer' }}>
                      +{m} min
                    </button>
                  ))}
                </div>
                <input type="number" min={1} max={120} value={batchTimeModal.minutes}
                  onChange={e => setBatchTimeModal(prev => ({ ...prev, minutes: parseInt(e.target.value) || 0 }))}
                  style={{ width: '100%', height: 38, padding: '0 12px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, fontWeight: 700, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                  placeholder="Minutos personalizados..." />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 6 }}>Justificativa Pedagógica:</label>
                <textarea rows={3} value={batchTimeModal.justification} onChange={e => setBatchTimeModal(prev => ({ ...prev, justification: e.target.value }))}
                  placeholder="Ex: Instabilidade temporária na conexão ou tolerância concedida pela coordenação."
                  style={{ width: '100%', borderRadius: 10, border: '1px solid #e2e8f0', padding: '10px 12px', fontSize: 12, color: '#0f172a', background: '#f8fafc', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>

              <div style={{ padding: '10px 12px', borderRadius: 10, background: '#fffbeb', border: '1px solid #fde68a', fontSize: 11, color: '#92400e', lineHeight: 1.6 }}>
                <strong>Atenção:</strong> Esta ação adiciona tempo a todos os estudantes em andamento e registra a ocorrência no histórico.
              </div>

              <div style={{ paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" onClick={() => setBatchTimeModal({ open: false, minutes: 10, justification: '' })} style={S.btnSecondary}>Cancelar</button>
                <button type="button" onClick={handleAddBatchTime} disabled={submittingAction}
                  style={{ ...S.btnPrimary, background: '#b45309', opacity: submittingAction ? 0.6 : 1 }}>
                  {submittingAction ? <RefreshCw style={{ width: 13, height: 13 }} className="animate-spin" /> : <Clock style={{ width: 13, height: 13 }} />}
                  {submittingAction ? 'Concedendo...' : 'Conceder Tempo'}
                </button>
              </div>
            </ModalCard>
          </ModalBackdrop>
        )}
      </AnimatePresence>
    </div>
  )
}
