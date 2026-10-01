'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Users, Clock, Wifi, WifiOff, AlertTriangle, CheckCircle2,
  Send, RefreshCw, Plus, Search, Filter, MessageSquare, Play,
  Square, Eye, ChevronRight, ArrowLeft, AlertCircle, Sparkles, Check,
  Radio, Lock, Unlock, PhoneCall, Printer
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

export default function MonitoramentoProvaPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [prova, setProva] = useState<ProvaOnline | null>(null)
  const [metricas, setMetricas] = useState<any>(null)
  const [alunos, setAlunos] = useState<StudentMonitorRow[]>([])
  const [mensagens, setMensagens] = useState<any[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Filters
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [filterTurma, setFilterTurma] = useState<string>('todas')

  // Modals
  const [addTimeModal, setAddTimeModal] = useState<{ open: boolean; aluno: StudentMonitorRow | null }>({
    open: false,
    aluno: null
  })
  const [extraMinutes, setExtraMinutes] = useState(10)
  const [timeJustification, setTimeJustification] = useState('')
  const [submittingAction, setSubmittingAction] = useState(false)

  const [messageModal, setMessageModal] = useState<{
    open: boolean
    target: 'geral' | 'individual'
    aluno?: StudentMonitorRow | null
  }>({
    open: false,
    target: 'geral',
    aluno: null
  })
  const [messageText, setMessageText] = useState('')

  const [incidentLogsModal, setIncidentLogsModal] = useState<{
    open: boolean
    aluno: StudentMonitorRow | null
    logs: any[]
    loading: boolean
  }>({
    open: false,
    aluno: null,
    logs: [],
    loading: false
  })

  const [batchTimeModal, setBatchTimeModal] = useState<{
    open: boolean
    minutes: number
    justification: string
  }>({
    open: false,
    minutes: 10,
    justification: ''
  })

  // Load Data
  const fetchData = async (isManual = false) => {
    if (!id) return
    if (isManual) setRefreshing(true)

    try {
      const res = await fetch(`/api/provas-online/${id}/monitoramento`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao carregar monitoramento')
      }

      setProva(data.prova)
      setMetricas(data.metricas)
      setAlunos(data.alunos || [])
      setMensagens(data.mensagens || [])
      setLastUpdated(new Date())
    } catch (err: any) {
      if (isManual) toast.error(err.message || 'Falha ao atualizar dados')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial & Poll
  useEffect(() => {
    fetchData()

    // Poll every 8 seconds for real-time monitoring
    const interval = setInterval(() => {
      fetchData()
    }, 8000)

    return () => clearInterval(interval)
  }, [id])

  // Actions
  const handleAddTime = async () => {
    if (!addTimeModal.aluno?.tentativaId) return
    if (!timeJustification.trim()) {
      toast.error('Informe a justificativa para a concessão de tempo extra.')
      return
    }

    setSubmittingAction(true)
    try {
      const res = await fetch(`/api/provas-online/${id}/monitoramento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'adicionar_tempo',
          tentativaId: addTimeModal.aluno.tentativaId,
          minutos: extraMinutes,
          justificativa: timeJustification.trim()
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao adicionar tempo')

      toast.success(`+${extraMinutes} minutos concedidos para ${addTimeModal.aluno.alunoNome}!`)
      setAddTimeModal({ open: false, aluno: null })
      setTimeJustification('')
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleUnlockStudent = async (aluno: StudentMonitorRow) => {
    if (!aluno.tentativaId) return

    try {
      const res = await fetch(`/api/provas-online/${id}/monitoramento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'liberar_retomada',
          tentativaId: aluno.tentativaId,
          justificativa: 'Retomada autorizada pelo professor supervisor no painel.'
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao liberar prova')

      toast.success(`Tentativa de ${aluno.alunoNome} liberada com sucesso!`)
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleForceSubmit = async (aluno: StudentMonitorRow) => {
    if (!aluno.tentativaId) return
    const confirmed = window.confirm(
      `Deseja realmente encerrar a tentativa de ${aluno.alunoNome}? As respostas atuais serão gravadas e a prova finalizada.`
    )
    if (!confirmed) return

    try {
      const res = await fetch(`/api/provas-online/${id}/monitoramento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'encerrar_tentativa',
          tentativaId: aluno.tentativaId,
          justificativa: 'Encerramento forçado pelo professor supervisor no painel.'
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao encerrar tentativa')

      toast.success(`Tentativa de ${aluno.alunoNome} encerrada.`)
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleSendMessage = async () => {
    if (!messageText.trim()) {
      toast.error('Digite a mensagem a ser transmitida.')
      return
    }

    setSubmittingAction(true)
    try {
      const isGeneral = messageModal.target === 'geral'
      const res = await fetch(`/api/provas-online/${id}/monitoramento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'enviar_mensagem',
          mensagem: messageText.trim(),
          tipoMensagem: isGeneral ? 'geral' : 'individual',
          tentativaId: messageModal.aluno?.tentativaId || null,
          alunoId: messageModal.aluno?.alunoId || null
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao transmitir mensagem')

      toast.success(isGeneral ? 'Comunicado geral enviado a todos os alunos!' : `Mensagem enviada para ${messageModal.aluno?.alunoNome}!`)
      setMessageModal({ open: false, target: 'geral', aluno: null })
      setMessageText('')
      fetchData()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSubmittingAction(false)
    }
  }

  const handleOpenIncidentLogs = async (aluno: StudentMonitorRow) => {
    if (!aluno.tentativaId) return
    setIncidentLogsModal({ open: true, aluno, logs: [], loading: true })

    try {
      const res = await fetch(`/api/provas-online/tentativas/${aluno.tentativaId}/ocorrencias`)
      const data = await res.json()
      setIncidentLogsModal(prev => ({
        ...prev,
        logs: data.ocorrencias || [],
        loading: false
      }))
    } catch (err) {
      setIncidentLogsModal(prev => ({ ...prev, loading: false }))
    }
  }

  const handleAddBatchTime = async () => {
    if (batchTimeModal.minutes <= 0) {
      toast.error('Informe uma quantidade válida de minutos.')
      return
    }
    if (!batchTimeModal.justification.trim()) {
      toast.error('Informe a justificativa pedagógica para conceder tempo extra à turma.')
      return
    }

    setSubmittingAction(true)
    try {
      const res = await fetch(`/api/provas-online/${id}/monitoramento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acao: 'acrescentar_tempo_turma',
          minutos: batchTimeModal.minutes,
          justificativa: batchTimeModal.justification.trim()
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao conceder tempo para a turma')

      toast.success(data.message || `+${batchTimeModal.minutes} min concedidos para toda a turma!`)
      setBatchTimeModal({ open: false, minutes: 10, justification: '' })
      fetchData(true)
    } catch (err: any) {
      toast.error(err.message || 'Erro ao estender tempo coletivo.')
    } finally {
      setSubmittingAction(false)
    }
  }

  // Filtered Students
  const filteredAlunos = useMemo(() => {
    return alunos.filter(a => {
      const matchSearch =
        a.alunoNome.toLowerCase().includes(search.toLowerCase()) ||
        a.alunoMatricula.toLowerCase().includes(search.toLowerCase())

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

  // Extract unique turmas
  const uniqueTurmas = useMemo(() => {
    const set = new Set<string>()
    alunos.forEach(a => {
      if (a.turma) set.add(a.turma)
    })
    return Array.from(set)
  }, [alunos])

  // Computed stats ensuring 100% mathematical consistency across all states
  const computedStats = useMemo(() => {
    const total = alunos.length
    let emAndamento = 0
    let entregues = 0
    let suspensas = 0
    let comOcorrencias = 0
    let naoIniciaram = 0

    alunos.forEach(a => {
      if (a.situacao === 'em_andamento') emAndamento++
      else if (a.situacao === 'entregue') entregues++
      else if (a.situacao === 'suspensa') suspensas++
      else naoIniciaram++

      if ((a.ocorrenciasCount || 0) > 0) comOcorrencias++
    })

    const finalTotal = metricas?.totalEsperados ?? total
    const finalEmAndamento = metricas?.emAndamento ?? emAndamento
    const finalEntregues = metricas?.entregues ?? entregues
    const finalSuspensas = metricas?.suspensas ?? suspensas
    const finalNaoIniciaram = (metricas?.naoIniciaram !== undefined && metricas.naoIniciaram > 0)
      ? metricas.naoIniciaram
      : Math.max(0, finalTotal - finalEmAndamento - finalEntregues - finalSuspensas)

    return {
      totalEsperados: finalTotal,
      emAndamento: finalEmAndamento,
      onlineAgora: metricas?.onlineAgora ?? alunos.filter(a => a.statusConexao === 'online').length,
      entregues: finalEntregues,
      naoIniciaram: finalNaoIniciaram,
      comOcorrencias: metricas?.comOcorrencias ?? comOcorrencias,
      suspensas: finalSuspensas,
    }
  }, [alunos, metricas])

  // Helper format seconds
  const formatSec = (s: number | null) => {
    if (s === null || s <= 0) return '00:00'
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  if (loading && !prova) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-sky-600" />
        <p className="text-sm font-semibold text-slate-700">Iniciando central de supervisão em tempo real...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. TOP HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/provas-online"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors mr-1"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              {prova?.disciplinaNome || prova?.disciplina}
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              Painel de Aplicação Ativo
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            {prova?.titulo}
          </h1>
          <p className="text-xs text-slate-500">
            Duração: {prova?.duracaoMinutos} min • Encerramento oficial: {(prova?.dataHoraFim || prova?.dataEncerramento) ? new Date(prova?.dataHoraFim || prova?.dataEncerramento || '').toLocaleTimeString('pt-BR') : '--'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Refresh pulse button */}
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s'
            }}
          >
            <RefreshCw size={14} color="#0284c7" className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Atualizando...' : `Atualizado ${lastUpdated.toLocaleTimeString('pt-BR')}`}</span>
          </button>

          {/* Broadcast Message Button */}
          <button
            type="button"
            onClick={() => setMessageModal({ open: true, target: 'geral', aluno: null })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: 'none',
              background: '#0284c7',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.28)',
              transition: 'all 0.15s'
            }}
          >
            <Send size={15} color="#ffffff" />
            Transmitir Aviso Geral
          </button>

          {/* Add Time to Class Button */}
          <button
            type="button"
            onClick={() => setBatchTimeModal({ open: true, minutes: 10, justification: '' })}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: '1px solid #fed7aa',
              background: '#fff7ed',
              color: '#c2410c',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s'
            }}
          >
            <Clock size={15} color="#ea580c" />
            + Tempo Geral (Turma)
          </button>

          <Link
            href={`/provas-online/${id}/imprimir`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              textDecoration: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s'
            }}
          >
            <Printer size={15} color="#475569" />
            Caderno Impresso
          </Link>

          <Link
            href={`/provas-online/${id}/corrigir`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 16px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              textDecoration: 'none',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              transition: 'all 0.15s'
            }}
          >
            Ir para Correção
          </Link>
        </div>
      </div>

      {/* 2. LIVE METRICS CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px'
      }}>
        {/* Total Esperados */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Total Esperados
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', lineHeight: 1 }}>
            {computedStats.totalEsperados}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Alunos enturmados</span>
        </div>

        {/* Em Prova Agora */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Em Prova Agora
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={16} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#0284c7', lineHeight: 1 }}>
            {computedStats.emAndamento}
          </div>
          <span style={{ fontSize: '11px', color: '#0369a1', fontWeight: 600 }}>
            {computedStats.onlineAgora} com sinal ativo
          </span>
        </div>

        {/* Entregues */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Entregas Finalizadas
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669', lineHeight: 1 }}>
            {computedStats.entregues}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {computedStats.totalEsperados > 0 ? Math.round((computedStats.entregues / computedStats.totalEsperados) * 100) : 0}% de conclusão
          </span>
        </div>

        {/* Não Iniciaram */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Ainda Não Iniciaram
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} color="#64748b" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#334155', lineHeight: 1 }}>
            {computedStats.naoIniciaram}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Aguardando login</span>
        </div>

        {/* Ocorrências / Suspensos */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#e11d48', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Ocorrências
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={16} color="#e11d48" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#e11d48', lineHeight: 1 }}>
            {computedStats.comOcorrencias}
          </div>
          <span style={{ fontSize: '11px', color: '#be123c', fontWeight: 600 }}>
            {computedStats.suspensas} suspensa(s)
          </span>
        </div>
      </div>

      {/* 3. FILTERS & SEARCH TOOLBAR */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '14px 18px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por aluno ou matrícula..."
            style={{
              width: '100%',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              paddingLeft: '36px',
              paddingRight: '14px',
              paddingTop: '8px',
              paddingBottom: '8px',
              fontSize: '12px',
              color: '#0f172a',
              outline: 'none'
            }}
          />
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {uniqueTurmas.length > 1 && (
            <select
              value={filterTurma}
              onChange={e => setFilterTurma(e.target.value)}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '7px 12px',
                fontSize: '12px',
                color: '#334155',
                outline: 'none'
              }}
            >
              <option value="todas">Todas as Turmas</option>
              {uniqueTurmas.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f1f5f9',
            padding: '3px',
            borderRadius: '10px',
            gap: '3px'
          }}>
            {[
              { id: 'todos', label: `Todos (${alunos.length})` },
              { id: 'em_andamento', label: `Em Prova (${computedStats.emAndamento})` },
              { id: 'entregue', label: `Entregues (${computedStats.entregues})` },
              { id: 'nao_iniciada', label: `Não Iniciaram (${computedStats.naoIniciaram})` },
              { id: 'ocorrencias', label: `Alertas (${computedStats.comOcorrencias})` },
            ].map(tab => {
              const isSelected = filterStatus === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setFilterStatus(tab.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: isSelected ? 800 : 600,
                    background: isSelected ? '#ffffff' : 'transparent',
                    color: isSelected ? '#0284c7' : '#64748b',
                    border: 'none',
                    boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 4. STUDENTS MONITORING GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAlunos.length === 0 ? (
          <div style={{
            gridColumn: '1 / -1',
            padding: '64px 24px',
            textAlign: 'center',
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #e2e8f0'
            }}>
              <Users size={28} color="#94a3b8" />
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#334155' }}>
              Nenhum aluno encontrado
            </div>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0, maxWidth: '340px' }}>
              Não há estudantes correspondentes aos filtros selecionados ou nenhuma tentativa foi iniciada ainda.
            </p>
          </div>
        ) : (
          filteredAlunos.map(aluno => {
            const isSuspended = aluno.situacao === 'suspensa'
            const isTaking = aluno.situacao === 'em_andamento'
            const isDelivered = aluno.situacao === 'entregue'
            const isNotStarted = !isSuspended && !isTaking && !isDelivered

            return (
              <motion.div
                key={aluno.alunoId}
                layout
                style={{
                  background: '#ffffff',
                  border: isSuspended ? '1.5px solid #fecdd3' : isTaking ? '1.5px solid #bae6fd' : isDelivered ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s',
                  gap: '14px'
                }}
              >
                {/* Header */}
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-700 font-mono shrink-0 border border-slate-200">
                        {aluno.alunoNome.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate" title={aluno.alunoNome}>
                          {aluno.alunoNome}
                        </h3>
                        <span className="text-xs text-slate-500 font-mono block truncate">
                          Matrícula: {aluno.alunoMatricula || 'S/M'} • Turma: {aluno.turma}
                        </span>
                      </div>
                    </div>

                    {/* Status Badge in Top Right */}
                    <div className="shrink-0">
                      {isTaking && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                          Em Prova
                        </span>
                      )}
                      {isDelivered && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={12} />
                          Entregue
                        </span>
                      )}
                      {isSuspended && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <Shield size={12} />
                          Suspensa
                        </span>
                      )}
                      {isNotStarted && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          <Clock size={12} />
                          Aguardando
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Conexão */}
                  {isTaking && (
                    <div className="flex items-center gap-1.5 mb-2">
                      {aluno.statusConexao === 'online' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Conexão Estável
                        </span>
                      )}
                      {aluno.statusConexao === 'instavel' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Wifi className="w-3 h-3" />
                          Conexão Instável
                        </span>
                      )}
                      {aluno.statusConexao === 'sem_sinal' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          <WifiOff className="w-3 h-3" />
                          Sem Sinal
                        </span>
                      )}
                    </div>
                  )}

                  {/* Progress & Countdown */}
                  {isTaking ? (
                    <div className="space-y-3 my-4">
                      {/* Progress Bar */}
                      <div>
                        <div className="flex justify-between text-xs mb-1 font-mono">
                          <span className="text-slate-500 font-medium">Progresso</span>
                          <span className="text-sky-700 font-semibold">{aluno.questoesRespondidas} respondidas ({aluno.percentualConcluido}%)</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-sky-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${aluno.percentualConcluido}%` }}
                          />
                        </div>
                      </div>

                      {/* Time remaining */}
                      <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <span className="text-slate-600 flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-sky-600" />
                          Tempo Restante:
                        </span>
                        <span className="font-mono font-bold text-sky-700">
                          {formatSec(aluno.tempoRestanteSegundos)}
                        </span>
                      </div>
                    </div>
                  ) : isDelivered ? (
                    <div className="my-3 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-emerald-800 font-semibold">
                        <span>Prova Entregue</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <p className="text-slate-600">
                        {aluno.questoesRespondidas} questões preenchidas.
                      </p>
                      {aluno.notaFinal !== null && (
                        <p className="text-slate-900 font-mono font-bold">
                          Nota Computada: {aluno.notaFinal.toFixed(1)} pts
                        </p>
                      )}
                    </div>
                  ) : isSuspended ? (
                    <div className="my-3 p-3.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs space-y-1">
                      <div className="flex items-center justify-between text-rose-800 font-semibold">
                        <span>Prova Suspensa</span>
                        <Shield className="w-4 h-4 text-rose-600" />
                      </div>
                      <p className="text-slate-600">Aguardando liberação do professor supervisor.</p>
                    </div>
                  ) : (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', margin: '12px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', fontSize: '12px', fontWeight: 600 }}>
                        <Clock size={14} color="#64748b" />
                        <span>Aguardando acesso do estudante</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                        O progresso e os dados de telemetria serão exibidos em tempo real assim que a prova for iniciada.
                      </p>
                    </div>
                  )}

                  {/* Incidents badge */}
                  {aluno.ocorrenciasCount > 0 && (
                    <button
                      onClick={() => handleOpenIncidentLogs(aluno)}
                      className="mb-3 w-full py-1.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        {aluno.ocorrenciasCount} ocorrência(s) de tela
                      </span>
                      <span className="text-[11px] underline font-bold">Ver Logs</span>
                    </button>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  {isSuspended ? (
                    <button
                      onClick={() => handleUnlockStudent(aluno)}
                      className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <Unlock className="w-3.5 h-3.5" />
                      Liberar Retomada
                    </button>
                  ) : isTaking ? (
                    <>
                      <button
                        onClick={() => setAddTimeModal({ open: true, aluno })}
                        title="Adicionar Tempo Extra"
                        className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-200 transition-colors cursor-pointer"
                      >
                        <Plus className="w-3 h-3 text-sky-600" />
                        + Tempo
                      </button>

                      <button
                        onClick={() => setMessageModal({ open: true, target: 'individual', aluno })}
                        title="Enviar Mensagem Privada"
                        className="py-1.5 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center border border-slate-200 transition-colors cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                      </button>

                      <button
                        onClick={() => handleForceSubmit(aluno)}
                        title="Encerrar Tentativa Imediatamente"
                        className="py-1.5 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center justify-center border border-rose-200 transition-colors cursor-pointer"
                      >
                        <Square className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <div className="w-full flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        Não iniciada
                      </span>
                      <button
                        type="button"
                        onClick={() => setMessageModal({ open: true, target: 'individual', aluno })}
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          color: '#334155',
                          fontSize: '11px',
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          cursor: 'pointer'
                        }}
                        className="hover:bg-slate-200 transition-colors"
                      >
                        <MessageSquare size={12} color="#0284c7" />
                        Avisar Aluno
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {/* 5. MODAL: ADICIONAR TEMPO EXTRA */}
      <AnimatePresence>
        {addTimeModal.open && addTimeModal.aluno && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '480px',
                margin: '0 auto',
                background: '#ffffff',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-200 shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Conceder Tempo Adicional</h3>
                  <p className="text-xs text-slate-500">Aluno: {addTimeModal.aluno.alunoNome}</p>
                </div>
              </div>

              {/* Minute selection pills */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">Selecione os minutos a acrescentar:</label>
                <div className="grid grid-cols-4 gap-2">
                  {[5, 10, 15, 30].map(mins => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setExtraMinutes(mins)}
                      className={`py-2 rounded-xl text-xs font-bold font-mono border transition-all cursor-pointer ${
                        extraMinutes === mins
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      +{mins} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Justification input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Justificativa da Exceção (Registrada em auditoria):
                </label>
                <textarea
                  rows={3}
                  value={timeJustification}
                  onChange={e => setTimeJustification(e.target.value)}
                  placeholder="Ex: Aluno apresentou instabilidade de conexão autorizada pela coordenação..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddTimeModal({ open: false, aluno: null })}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddTime}
                  disabled={submittingAction}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {submittingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Confirmar e Conceder
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 6. MODAL: ENVIAR COMUNICADO / AVISO */}
      <AnimatePresence>
        {messageModal.open && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '480px',
                margin: '0 auto',
                background: '#ffffff',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-200 shrink-0">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {messageModal.target === 'geral' ? 'Transmitir Aviso Geral' : 'Enviar Mensagem Individual'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {messageModal.target === 'geral'
                      ? 'A mensagem aparecerá imediatamente na tela de todos os alunos em prova.'
                      : `Destinatário: ${messageModal.aluno?.alunoNome}`}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Texto do Comunicado:
                </label>
                <textarea
                  rows={4}
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  placeholder="Ex: Atenção turma: restam 10 minutos para o término da avaliação..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMessageModal({ open: false, target: 'geral', aluno: null })}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={submittingAction}
                  className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {submittingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Transmitir Agora
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 7. MODAL: LOGS DE OCORRÊNCIAS DE MONITORAMENTO */}
      <AnimatePresence>
        {incidentLogsModal.open && incidentLogsModal.aluno && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '560px',
                maxHeight: '85vh',
                margin: '0 auto',
                background: '#ffffff',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Log de Supervisão Digital</h3>
                    <p className="text-xs text-slate-500">Aluno: {incidentLogsModal.aluno.alunoNome}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIncidentLogsModal({ open: false, aluno: null, logs: [], loading: false })}
                  className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer p-1"
                >
                  Fechar
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {incidentLogsModal.loading ? (
                  <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-sky-600" />
                    <span className="text-xs">Carregando histórico de auditoria...</span>
                  </div>
                ) : incidentLogsModal.logs.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs py-8">Nenhuma ocorrência registrada para este aluno.</p>
                ) : (
                  incidentLogsModal.logs.map((log: any, idx: number) => (
                    <div
                      key={log.id || idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-rose-700 capitalize">
                          {log.tipo?.replace('_', ' ')}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px]">
                          {log.createdAt ? new Date(log.createdAt).toLocaleTimeString('pt-BR') : '--'}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-relaxed">{log.descricao}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setIncidentLogsModal({ open: false, aluno: null, logs: [], loading: false })}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer border border-slate-200"
                >
                  Concluir Visualização
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* BATCH ADD TIME MODAL (ALL ACTIVE STUDENTS) */}
        {batchTimeModal.open && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              backgroundColor: 'rgba(15, 23, 42, 0.55)',
              backdropFilter: 'blur(4px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '480px',
                background: '#ffffff',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px',
              }}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Tempo Coletivo para a Turma</h3>
                    <p className="text-xs text-slate-500">Estender cronômetro de todos os alunos em prova</p>
                  </div>
                </div>
                <button
                  onClick={() => setBatchTimeModal({ open: false, minutes: 10, justification: '' })}
                  className="text-slate-400 hover:text-slate-700 text-xs cursor-pointer p-1"
                >
                  Fechar
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Minutos a adicionar para todos os alunos em andamento:
                </label>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[5, 10, 15, 20].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBatchTimeModal(prev => ({ ...prev, minutes: m }))}
                      style={{
                        padding: '8px 0',
                        borderRadius: '10px',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: batchTimeModal.minutes === m ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                        background: batchTimeModal.minutes === m ? '#fff7ed' : '#ffffff',
                        color: batchTimeModal.minutes === m ? '#c2410c' : '#475569',
                        transition: 'all 0.15s'
                      }}
                    >
                      +{m} min
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={batchTimeModal.minutes}
                  onChange={(e) => setBatchTimeModal(prev => ({ ...prev, minutes: parseInt(e.target.value) || 0 }))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 focus:outline-none focus:border-amber-500"
                  placeholder="Minutos personalizados..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Justificativa Pedagógica / Ocorrência Geral:
                </label>
                <textarea
                  rows={3}
                  value={batchTimeModal.justification}
                  onChange={(e) => setBatchTimeModal(prev => ({ ...prev, justification: e.target.value }))}
                  placeholder="Ex: Instabilidade temporária na conexão de internet da escola ou tolerância geral concedida pela coordenação."
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-amber-500 placeholder:text-slate-400"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-800 leading-relaxed">
                <strong>Atenção Pedagógica:</strong> Esta ação adiciona tempo imediatamente para todos os estudantes que estão respondendo a prova e registra a ocorrência formal no histórico da avaliação.
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBatchTimeModal({ open: false, minutes: 10, justification: '' })}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer border border-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAddBatchTime}
                  disabled={submittingAction}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: submittingAction ? 'not-allowed' : 'pointer',
                    border: 'none',
                    background: '#ea580c',
                    color: '#ffffff',
                    boxShadow: '0 2px 6px rgba(234, 88, 12, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {submittingAction ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                  {submittingAction ? 'Concedendo...' : 'Conceder Tempo Coletivo'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
