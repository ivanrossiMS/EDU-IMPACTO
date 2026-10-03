'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileCheck2,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Award,
  Search,
  RotateCw,
  Flame,
  FileText,
  Printer,
  X,
  ChevronRight,
  Sparkles,
  Timer,
  Check,
  Copy,
  ExternalLink,
  Shield,
  Layers,
  UserCheck,
  BarChart3,
  HelpCircle,
  Info,
  BookOpen,
  ArrowRight,
  XCircle,
  TrendingUp,
  AlertTriangle,
  GraduationCap
} from 'lucide-react'
import { toast } from 'sonner'
import { useSelectedStudent } from '@/lib/selectedStudentContext'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useApp } from '@/lib/context'
import { EmptyStateCard } from '../../components/EmptyStateCard'
import { apiFetch } from '@/lib/api/apiClient'
import { HtmlContent } from '@/components/HtmlContent'
import { cleanAlternativeText } from '@/lib/provas-online/textSanitizer'

interface ProvaStudentView {
  id: string
  titulo: string
  descricao?: string
  disciplina: string
  turmas: string[]
  series: string[]
  anoLetivo: number
  bimestre: number
  finalidade: string
  professorId: string
  professorNome: string
  status: 'rascunho' | 'agendada' | 'em_aplicacao' | 'encerrada' | 'publicada'
  valorTotal: number
  quantidadeTentativas: number
  dataAbertura: string
  dataEncerramento: string
  duracaoMinutos: number
  codigoLiberacao?: string
  configuracaoLayout?: any
  configuracaoMonitoramento?: any
  configuracaoDivulgacao?: any
  questoes?: any[]
  studentInfo?: {
    tentativasRealizadas: number
    tentativasPermitidas: number
    tentativaAtivaId: string | null
    ultimaTentativa: any | null
    submetida: boolean
    resultadoLiberado: boolean
  }
}

// Subject color helpers to give an ultra-modern aesthetic
function getSubjectTheme(disciplina: string = '') {
  const d = disciplina.toLowerCase()
  if (d.includes('matem') || d.includes('cálculo') || d.includes('fisica') || d.includes('física')) {
    return { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', pill: '#3b82f6', iconBg: 'rgba(59, 130, 246, 0.12)' }
  }
  if (d.includes('portug') || d.includes('redação') || d.includes('literat') || d.includes('língua') || d.includes('lingua')) {
    return { bg: '#ecfdf5', border: '#a7f3d0', text: '#047857', pill: '#10b981', iconBg: 'rgba(16, 185, 129, 0.12)' }
  }
  if (d.includes('histór') || d.includes('histor') || d.includes('filosof') || d.includes('sociolog')) {
    return { bg: '#faf5ff', border: '#e9d5ff', text: '#7e22ce', pill: '#a855f7', iconBg: 'rgba(168, 85, 247, 0.12)' }
  }
  if (d.includes('geograf') || d.includes('biolog') || d.includes('quím') || d.includes('quim') || d.includes('ciênc') || d.includes('cienc')) {
    return { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', pill: '#22c55e', iconBg: 'rgba(34, 197, 94, 0.12)' }
  }
  if (d.includes('ingl') || d.includes('espanh') || d.includes('art') || d.includes('educação física') || d.includes('ed. física')) {
    return { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c', pill: '#f97316', iconBg: 'rgba(249, 115, 22, 0.12)' }
  }
  return { bg: '#f1f5f9', border: '#cbd5e1', text: '#334155', pill: '#64748b', iconBg: 'rgba(100, 116, 139, 0.12)' }
}

function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])
  if (!mounted || typeof document === 'undefined') return null
  return createPortal(children, document.body)
}

export default function ADProvasOnlineStudentPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { aluno, userAccessRole } = useSelectedStudent()
  const { adConfig } = useAgendaDigital()
  const { currentUser } = useApp()

  const resolvedAlunoId = String(aluno?.id || params?.slug || '')

  const isMirroringAluno = searchParams?.get('espelhar_aluno') === 'true'
  const isAlunoLogado = Boolean(
    isMirroringAluno ||
    currentUser?.cargo === 'Aluno' ||
    currentUser?.perfil === 'Aluno' ||
    (currentUser as any)?.userType === 'aluno' ||
    ((currentUser as any)?.aluno_id && currentUser?.cargo !== 'Responsável' && !(currentUser as any)?.responsavel_id)
  )
  const isResponsavel = !isAlunoLogado
  const nomeEstudante = aluno?.nome || (currentUser as any)?.aluno_nome || 'Estudante'

  const [provas, setProvas] = useState<ProvaStudentView[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterAnoLetivo, setFilterAnoLetivo] = useState<string>(String(new Date().getFullYear()))
  const [filterDisciplina, setFilterDisciplina] = useState('')
  const [filterPeriodo, setFilterPeriodo] = useState('')
  const [activeTab, setActiveTab] = useState<'todas' | 'disponiveis' | 'andamento' | 'concluidas' | 'agendadas'>('todas')

  // Modals state
  const [selectedBriefingProva, setSelectedBriefingProva] = useState<ProvaStudentView | null>(null)
  const [selectedVoucherProva, setSelectedVoucherProva] = useState<ProvaStudentView | null>(null)
  const [selectedGabaritoProva, setSelectedGabaritoProva] = useState<ProvaStudentView | null>(null)
  const [detailedGabaritoProva, setDetailedGabaritoProva] = useState<any | null>(null)
  const [loadingGabarito, setLoadingGabarito] = useState(false)
  const [copiedVoucher, setCopiedVoucher] = useState(false)
  const [pledgeChecked, setPledgeChecked] = useState(false)

  // Fetch detailed exam for pedagogical gabarito if not all questions were loaded
  useEffect(() => {
    if (!selectedGabaritoProva) {
      setDetailedGabaritoProva(null)
      return
    }

    if (selectedGabaritoProva.questoes && selectedGabaritoProva.questoes.length > 0) {
      setDetailedGabaritoProva(selectedGabaritoProva)
      return
    }

    let active = true
    setLoadingGabarito(true)
    apiFetch(`/api/provas-online/${selectedGabaritoProva.id}?aluno_id=${encodeURIComponent(resolvedAlunoId)}`)
      .then(res => res.json())
      .then(data => {
        if (!active) return
        const p = data.prova || data
        setDetailedGabaritoProva({
          ...selectedGabaritoProva,
          ...p,
          questoes: p.questoes || selectedGabaritoProva.questoes || [],
          studentInfo: {
            ...selectedGabaritoProva.studentInfo,
            ultimaTentativa: data.myTentativa || selectedGabaritoProva.studentInfo?.ultimaTentativa
          }
        })
      })
      .catch(err => {
        console.error('Erro ao carregar gabarito detalhado:', err)
        if (active) setDetailedGabaritoProva(selectedGabaritoProva)
      })
      .finally(() => {
        if (active) setLoadingGabarito(false)
      })

    return () => { active = false }
  }, [selectedGabaritoProva, resolvedAlunoId])

  // Travar a rolagem da página (fundo estático) quando qualquer modal estiver aberto
  const isAnyModalOpen = Boolean(selectedBriefingProva || selectedVoucherProva || selectedGabaritoProva)

  useEffect(() => {
    if (typeof document === 'undefined') return

    if (isAnyModalOpen) {
      const originalOverflow = document.body.style.overflow
      const originalPaddingRight = document.body.style.paddingRight
      const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth

      document.body.style.overflow = 'hidden'
      if (scrollBarWidth > 0) {
        document.body.style.paddingRight = `${scrollBarWidth}px`
      }

      return () => {
        document.body.style.overflow = originalOverflow
        document.body.style.paddingRight = originalPaddingRight
      }
    }
  }, [isAnyModalOpen])

  // Fetch student exams from API
  const fetchProvas = useCallback(async (showRefreshing = false) => {
    if (!resolvedAlunoId) return
    try {
      if (showRefreshing) setRefreshing(true)
      const res = await apiFetch(`/api/provas-online?aluno_id=${encodeURIComponent(resolvedAlunoId)}`)
      if (res.ok) {
        const data = await res.json()
        setProvas(Array.isArray(data) ? data : [])
      } else {
        const errJson = await res.json().catch(() => ({}))
        console.error('Falha ao carregar provas online do aluno:', errJson?.error || res.status)
      }
    } catch (err) {
      console.error('Erro de conexão ao carregar provas:', err)
    } finally {
      setLoading(false)
      if (showRefreshing) setRefreshing(false)
    }
  }, [resolvedAlunoId])

  useEffect(() => {
    fetchProvas()
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchProvas(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    // Polling a cada 30 segundos apenas se a aba estiver visível
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchProvas(false)
      }
    }, 30000)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(interval)
    }
  }, [fetchProvas])

  // Extract unique subjects for filter dropdown
  const disciplinasDisponiveis = useMemo(() => {
    const set = new Set<string>()
    provas.forEach(p => {
      if (p.disciplina) set.add(p.disciplina.trim())
    })
    return Array.from(set).sort()
  }, [provas])

  // Extract unique school years for filter dropdown
  const anosLetivosDisponiveis = useMemo(() => {
    const currentYear = new Date().getFullYear().toString()
    const setYears = new Set<string>()
    setYears.add(currentYear)
    provas.forEach(p => {
      const year = p.anoLetivo || (p.dataAbertura ? new Date(p.dataAbertura).getFullYear() : undefined)
      if (year) setYears.add(String(year))
    })
    return Array.from(setYears).sort((a, b) => Number(b) - Number(a))
  }, [provas])

  // Filtered and sorted exams
  const filteredProvas = useMemo(() => {
    return provas.filter(prova => {
      const studentInfo = prova.studentInfo
      const hasActiveAttempt = Boolean(studentInfo?.tentativaAtivaId)
      const isSubmitted = Boolean(studentInfo?.submetida)
      const isAvailable = prova.status === 'em_aplicacao' && !hasActiveAttempt && (!isSubmitted || (studentInfo?.tentativasRealizadas || 0) < (prova.quantidadeTentativas || 1))
      const isScheduled = prova.status === 'agendada'
      const isDone = isSubmitted || prova.status === 'publicada' || (prova.status === 'encerrada' && (studentInfo?.tentativasRealizadas || 0) > 0)

      // Ano Letivo Filter
      if (filterAnoLetivo) {
        const pAno = String(prova.anoLetivo || (prova.dataAbertura ? new Date(prova.dataAbertura).getFullYear() : ''))
        if (pAno && pAno !== filterAnoLetivo) return false
      }

      // Tab Filtering
      if (activeTab === 'disponiveis' && !isAvailable) return false
      if (activeTab === 'andamento' && !hasActiveAttempt) return false
      if (activeTab === 'concluidas' && !isDone) return false
      if (activeTab === 'agendadas' && !isScheduled) return false

      // Keyword Search
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const matchTitle = prova.titulo?.toLowerCase().includes(q)
        const matchDisc = prova.disciplina?.toLowerCase().includes(q)
        const matchProf = prova.professorNome?.toLowerCase().includes(q)
        if (!matchTitle && !matchDisc && !matchProf) return false
      }

      // Dropdowns
      if (filterDisciplina && prova.disciplina !== filterDisciplina) return false
      if (filterPeriodo && String(prova.bimestre) !== filterPeriodo) return false

      return true
    }).sort((a, b) => {
      // Sorting priority: In-progress first, then available, then scheduled, then completed/closed
      const aActive = a.studentInfo?.tentativaAtivaId ? 1 : 0
      const bActive = b.studentInfo?.tentativaAtivaId ? 1 : 0
      if (aActive !== bActive) return bActive - aActive

      const aAvail = (a.status === 'em_aplicacao' && !a.studentInfo?.submetida) ? 1 : 0
      const bAvail = (b.status === 'em_aplicacao' && !b.studentInfo?.submetida) ? 1 : 0
      if (aAvail !== bAvail) return bAvail - aAvail

      return new Date(b.dataAbertura || 0).getTime() - new Date(a.dataAbertura || 0).getTime()
    })
  }, [provas, activeTab, searchTerm, filterDisciplina, filterPeriodo, filterAnoLetivo])

  // Aggregate metrics for KPIs
  const counts = useMemo(() => {
    let disponiveis = 0
    let andamento = 0
    let concluidas = 0
    let agendadas = 0

    const list = filterAnoLetivo
      ? provas.filter(p => {
          const y = String(p.anoLetivo || (p.dataAbertura ? new Date(p.dataAbertura).getFullYear() : ''))
          return !y || y === filterAnoLetivo
        })
      : provas

    list.forEach(p => {
      const studentInfo = p.studentInfo
      const hasActive = Boolean(studentInfo?.tentativaAtivaId)
      const submitted = Boolean(studentInfo?.submetida)

      if (hasActive) {
        andamento++
      } else if (p.status === 'em_aplicacao' && (!submitted || (studentInfo?.tentativasRealizadas || 0) < (p.quantidadeTentativas || 1))) {
        disponiveis++
      } else if (p.status === 'agendada') {
        agendadas++
      } else if (submitted || p.status === 'publicada') {
        concluidas++
      }
    })

    return {
      todas: list.length,
      disponiveis,
      andamento,
      concluidas,
      agendadas
    }
  }, [provas, filterAnoLetivo])

  const handleStartExam = (prova: ProvaStudentView) => {
    if (isResponsavel) {
      toast.error('Acesso restrito: Provas online só podem ser realizadas pelo estudante logado com sua conta de aluno.')
      return
    }
    const returnUrl = `/agenda-digital/${resolvedAlunoId}/provas-online`
    const targetUrl = `/provas-online/fazer/${prova.id}?briefing=true&returnUrl=${encodeURIComponent(returnUrl)}`
    router.push(targetUrl)
  }

  const handleContinueExam = (prova: ProvaStudentView) => {
    if (isResponsavel) {
      toast.error('Acesso restrito: Provas online só podem ser continuadas pelo estudante logado com sua conta de aluno.')
      return
    }
    const returnUrl = `/agenda-digital/${resolvedAlunoId}/provas-online`
    const targetUrl = `/provas-online/fazer/${prova.id}?returnUrl=${encodeURIComponent(returnUrl)}`
    router.push(targetUrl)
  }

  const handleCopyCode = async (code: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
      }
      setCopiedVoucher(true)
      toast.success('Código do comprovante copiado com sucesso!')
      setTimeout(() => setCopiedVoucher(false), 2500)
    } catch {
      toast.error('Não foi possível copiar automaticamente.')
    }
  }

  // Permission check
  if (adConfig?.permissoes?.visualizarProvasOnline === false) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', padding: 24 }}>
        <EmptyStateCard
          title="Acesso Temporariamente Restrito"
          description="A visualização do módulo de Provas Online está desativada no momento para este perfil ou sob manutenção pela coordenação pedagógica."
          icon={<AlertCircle size={48} style={{ color: '#ef4444', opacity: 0.8 }} />}
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 48 }}>
      
      {/* 1. HERO HEADER CONTAINER (DESIGN FIDELITY & ULTRA-MODERN) */}
      <div className="ad-provas-hero-card">
        {/* Subtle accent top border bar */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: 'linear-gradient(90deg, #0ea5e9, #6366f1, #a855f7)'
        }} />

        {/* Title & Actions Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 46,
              height: 46,
              borderRadius: 15,
              background: isResponsavel
                ? 'linear-gradient(135deg, #e0f2fe 0%, #e0e7ff 100%)'
                : 'linear-gradient(135deg, #ecfdf5 0%, #e0e7ff 100%)',
              border: '1.5px solid #ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 16px rgba(99, 102, 241, 0.16)',
              color: isResponsavel ? '#0284c7' : '#059669',
              flexShrink: 0
            }}>
              {isResponsavel ? <BookOpen size={24} strokeWidth={2.5} /> : <FileCheck2 size={24} strokeWidth={2.5} />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{
                  fontSize: 22,
                  fontWeight: 900,
                  fontFamily: 'Outfit, sans-serif',
                  margin: 0,
                  letterSpacing: '-0.02em',
                  background: isResponsavel
                    ? 'linear-gradient(135deg, #0f172a 40%, #0284c7 100%)'
                    : 'linear-gradient(135deg, #0f172a 40%, #059669 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1.2
                }}>
                  {isResponsavel ? 'Acompanhamento de Provas' : 'Provas Online'}
                </h1>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  padding: '3px 8px',
                  borderRadius: 20,
                  background: isResponsavel ? '#eff6ff' : '#f0fdf4',
                  color: isResponsavel ? '#1d4ed8' : '#15803d',
                  border: `1px solid ${isResponsavel ? '#bfdbfe' : '#bbf7d0'}`
                }}>
                  {isResponsavel ? 'Painel da Família' : 'Módulo Integrado'}
                </span>
              </div>
              <p style={{
                margin: '4px 0 0',
                fontSize: 13,
                color: '#64748b',
                fontWeight: 500
              }}>
                {isResponsavel
                  ? `Acompanhe datas, prazos de entrega, comprovantes e notas de ${nomeEstudante}`
                  : 'Relação de avaliações, simulados e testes digitais do Colégio Impacto'}
              </p>
            </div>
          </div>

          {/* Quick Refresh & Search Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Buscar avaliação ou matéria..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{
                  width: 220,
                  height: 38,
                  paddingLeft: 34,
                  paddingRight: 14,
                  borderRadius: 9999,
                  border: '1.5px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: '#0f172a',
                  outline: 'none',
                  transition: 'all 0.2s ease'
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = '#0284c7'
                  e.currentTarget.style.background = '#ffffff'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.12)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = '#cbd5e1'
                  e.currentTarget.style.background = '#f8fafc'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            <button
              onClick={() => fetchProvas(true)}
              disabled={refreshing}
              title="Atualizar lista de provas"
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#0284c7'
                e.currentTarget.style.color = '#0284c7'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#cbd5e1'
                e.currentTarget.style.color = '#475569'
              }}
            >
              <RotateCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Family Guidance Notice Banner */}
        {isResponsavel && (
          <div style={{
            padding: '14px 18px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%)',
            border: '1.5px solid #bae6fd',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 2px 8px rgba(2, 132, 199, 0.05)'
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: '#e0f2fe',
              color: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Shield size={20} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0369a1' }}>
                Acompanhamento Pedagógico Familiar
              </div>
              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
                Este módulo é exclusivo para acompanhamento dos pais e responsáveis. Aqui você consulta prazos, regras e notas de <strong>{nomeEstudante}</strong>. <em>A resolução e envio das provas devem ser feitas exclusivamente pelo acesso individual do aluno.</em>
              </div>
            </div>
          </div>
        )}

        {/* 2. KPI METRIC SUMMARY CARDS */}
        <div className="ad-provas-kpi-grid">
          {/* Disponíveis / Para Realizar */}
          <div
            onClick={() => setActiveTab('disponiveis')}
            className="ad-provas-kpi-card"
            style={{
              background: activeTab === 'disponiveis' ? '#ecfdf5' : '#f8fafc',
              border: `1.5px solid ${activeTab === 'disponiveis' ? '#10b981' : '#e2e8f0'}`
            }}
          >
            <div>
              <div className="ad-provas-kpi-label" style={{ color: '#059669' }}>
                {isResponsavel ? 'Para Realizar' : 'Disponíveis'}
              </div>
              <div className="ad-provas-kpi-val" style={{ color: '#065f46' }}>
                {counts.disponiveis}
              </div>
            </div>
            <div className="ad-provas-kpi-icon-box" style={{ background: '#d1fae5' }}>
              <Flame size={18} color="#059669" />
            </div>
          </div>

          {/* Em Andamento / Em Realização */}
          <div
            onClick={() => setActiveTab('andamento')}
            className="ad-provas-kpi-card"
            style={{
              background: activeTab === 'andamento' ? '#faf5ff' : '#f8fafc',
              border: `1.5px solid ${activeTab === 'andamento' ? '#a855f7' : '#e2e8f0'}`
            }}
          >
            <div>
              <div className="ad-provas-kpi-label" style={{ color: '#7e22ce' }}>
                {isResponsavel ? 'Em Realização' : 'Em Andamento'}
              </div>
              <div className="ad-provas-kpi-val" style={{ color: '#581c87' }}>
                {counts.andamento}
              </div>
            </div>
            <div className="ad-provas-kpi-icon-box" style={{ background: '#f3e8ff' }}>
              <Timer size={18} color="#7e22ce" className={counts.andamento > 0 ? 'animate-pulse' : ''} />
            </div>
          </div>

          {/* Entregues & Notas */}
          <div
            onClick={() => setActiveTab('concluidas')}
            className="ad-provas-kpi-card"
            style={{
              background: activeTab === 'concluidas' ? '#eff6ff' : '#f8fafc',
              border: `1.5px solid ${activeTab === 'concluidas' ? '#3b82f6' : '#e2e8f0'}`
            }}
          >
            <div>
              <div className="ad-provas-kpi-label" style={{ color: '#2563eb' }}>
                {isResponsavel ? 'Entregues & Notas' : 'Entregues / Notas'}
              </div>
              <div className="ad-provas-kpi-val" style={{ color: '#1e3a8a' }}>
                {counts.concluidas}
              </div>
            </div>
            <div className="ad-provas-kpi-icon-box" style={{ background: '#dbeafe' }}>
              <CheckCircle2 size={18} color="#2563eb" />
            </div>
          </div>

          {/* Agendadas */}
          <div
            onClick={() => setActiveTab('agendadas')}
            className="ad-provas-kpi-card"
            style={{
              background: activeTab === 'agendadas' ? '#fff7ed' : '#f8fafc',
              border: `1.5px solid ${activeTab === 'agendadas' ? '#f97316' : '#e2e8f0'}`
            }}
          >
            <div>
              <div className="ad-provas-kpi-label" style={{ color: '#c2410c' }}>
                {isResponsavel ? 'Próximas Provas' : 'Agendadas'}
              </div>
              <div className="ad-provas-kpi-val" style={{ color: '#7c2d12' }}>
                {counts.agendadas}
              </div>
            </div>
            <div className="ad-provas-kpi-icon-box" style={{ background: '#ffedd5' }}>
              <Calendar size={18} color="#ea580c" />
            </div>
          </div>
        </div>

        {/* 3. TABS AND DROPDOWN FILTERS */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12
        }}>
          {/* Navigation Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#f1f5f9',
            padding: 4,
            borderRadius: 14,
            overflowX: 'auto',
            maxWidth: '100%'
          }}>
            {[
              { id: 'todas', label: 'Todas', count: counts.todas },
              { id: 'disponiveis', label: isResponsavel ? 'Pendentes do Aluno' : 'Disponíveis', count: counts.disponiveis, pulse: counts.disponiveis > 0 },
              { id: 'andamento', label: isResponsavel ? 'Em Realização' : 'Em Andamento', count: counts.andamento, highlight: counts.andamento > 0 },
              { id: 'concluidas', label: isResponsavel ? 'Entregues & Notas' : 'Entregues', count: counts.concluidas },
              { id: 'agendadas', label: isResponsavel ? 'Próximas Agendadas' : 'Agendadas', count: counts.agendadas }
            ].map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 13px',
                    borderRadius: 10,
                    fontSize: 12,
                    fontWeight: active ? 800 : 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: active ? '#ffffff' : 'transparent',
                    color: active ? '#0284c7' : '#64748b',
                    boxShadow: active ? '0 2px 6px rgba(0, 0, 0, 0.06)' : 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.pulse && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
                  )}
                  {tab.highlight && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 6px #a855f7' }} />
                  )}
                  {tab.label}
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 5px',
                    borderRadius: 8,
                    background: active ? '#e0f2fe' : 'rgba(0,0,0,0.05)',
                    color: active ? '#0284c7' : '#64748b'
                  }}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Disciplina, Bimestre & Ano Letivo Selects */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Ano Letivo Filter */}
            <select
              value={filterAnoLetivo}
              onChange={e => setFilterAnoLetivo(e.target.value)}
              title="Filtrar por Ano Letivo"
              style={{
                height: 34,
                padding: '0 10px',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1.2px solid #cbd5e1',
                color: filterAnoLetivo ? '#0284c7' : '#475569',
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">Todos os Anos</option>
              {anosLetivosDisponiveis.map(ano => (
                <option key={ano} value={ano}>Ano Letivo {ano}</option>
              ))}
            </select>

            {disciplinasDisponiveis.length > 0 && (
              <select
                value={filterDisciplina}
                onChange={e => setFilterDisciplina(e.target.value)}
                style={{
                  height: 34,
                  padding: '0 10px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1.2px solid #cbd5e1',
                  color: filterDisciplina ? '#0284c7' : '#475569',
                  fontSize: 12,
                  fontWeight: 600,
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="">Todas as Disciplinas</option>
                {disciplinasDisponiveis.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            )}

            <select
              value={filterPeriodo}
              onChange={e => setFilterPeriodo(e.target.value)}
              style={{
                height: 34,
                padding: '0 10px',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1.2px solid #cbd5e1',
                color: filterPeriodo ? '#0284c7' : '#475569',
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="">Todos os Bimestres</option>
              <option value="1">1º Bimestre</option>
              <option value="2">2º Bimestre</option>
              <option value="3">3º Bimestre</option>
              <option value="4">4º Bimestre</option>
            </select>

            {(searchTerm || filterDisciplina || filterPeriodo || (filterAnoLetivo && filterAnoLetivo !== String(new Date().getFullYear()))) && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  setFilterDisciplina('')
                  setFilterPeriodo('')
                  setFilterAnoLetivo(String(new Date().getFullYear()))
                }}
                style={{
                  height: 34,
                  padding: '0 10px',
                  borderRadius: 10,
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer'
                }}
              >
                <X size={12} /> Limpar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4. ACTIVE EXAM URGENT BANNER (IF IN PROGRESS) */}
      {counts.andamento > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '16px 20px',
            borderRadius: 18,
            background: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
            border: '1.5px solid #d8b4fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            boxShadow: '0 6px 20px rgba(168, 85, 247, 0.12)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: '#a855f7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)'
            }}>
              <Timer size={22} className="animate-spin" style={{ animationDuration: '6s' }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#581c87' }}>
                {isResponsavel
                  ? `${nomeEstudante} possui uma avaliação em andamento!`
                  : 'Você tem uma avaliação em andamento!'}
              </div>
              <div style={{ fontSize: 12, color: '#7e22ce', marginTop: 2 }}>
                {isResponsavel
                  ? 'O cronômetro no servidor está ativo. O aluno deve enviar as respostas antes do término da duração estipulada.'
                  : 'O tempo do cronômetro do servidor continua ativo. Retome sua prova para não perder o prazo.'}
              </div>
            </div>
          </div>

          {isResponsavel ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 12,
              background: '#ffffff',
              border: '1.5px solid #d8b4fe',
              color: '#7e22ce',
              fontSize: 12,
              fontWeight: 800,
              boxShadow: '0 2px 8px rgba(168, 85, 247, 0.15)'
            }}>
              <UserCheck size={14} />
              Realização no Acesso do Aluno
            </div>
          ) : (() => {
            const provaAtiva = provas.find(p => p.studentInfo?.tentativaAtivaId)
            if (!provaAtiva) return null
            return (
              <button
                onClick={() => handleContinueExam(provaAtiva)}
                style={{
                  padding: '9px 18px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #a855f7, #7e22ce)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 12.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)',
                  transition: 'transform 0.15s ease'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Continuar Prova Agora
                <ArrowRight size={14} />
              </button>
            )
          })()}
        </motion.div>
      )}

      {/* 5. EXAM CARDS GRID */}
      {loading ? (
        <div style={{
          padding: '80px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: '#ffffff',
          borderRadius: 24,
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            border: '3px solid #e2e8f0',
            borderTopColor: '#0284c7',
            animation: 'spin 0.8s linear infinite'
          }} />
          <span style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>
            Sincronizando avaliações do aluno...
          </span>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
      ) : filteredProvas.length === 0 ? (
        <div style={{
          padding: '60px 24px',
          borderRadius: 24,
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.02)'
        }}>
          <div style={{
            width: 60,
            height: 60,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #e0f2fe, #f0fdf4)',
            border: '1px solid #bae6fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26
          }}>
            🎯
          </div>
          <div>
            <h3 style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              {activeTab === 'todas'
                ? 'Nenhuma avaliação agendada no momento'
                : `Nenhuma avaliação encontrada em "${activeTab}"`}
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0', maxWidth: 420 }}>
              {activeTab === 'disponiveis'
                ? 'Parabéns! Você não possui avaliações pendentes para realizar no momento.'
                : 'Quando novas avaliações forem publicadas para sua turma pelo corpo docente, elas aparecerão aqui automaticamente.'}
            </p>
          </div>
          {(searchTerm || filterDisciplina || filterPeriodo) && (
            <button
              onClick={() => {
                setSearchTerm('')
                setFilterDisciplina('')
                setFilterPeriodo('')
                setActiveTab('todas')
              }}
              style={{
                marginTop: 6,
                padding: '8px 16px',
                borderRadius: 10,
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Ver todas as avaliações
            </button>
          )}
        </div>
      ) : (
        <div className="ad-provas-cards-grid">
          {filteredProvas.map(prova => {
            const studentInfo = prova.studentInfo
            const hasActiveAttempt = Boolean(studentInfo?.tentativaAtivaId)
            const isSubmitted = Boolean(studentInfo?.submetida)
            const isLive = prova.status === 'em_aplicacao'
            const canTakeExam = isLive && !hasActiveAttempt && (!isSubmitted || (studentInfo?.tentativasRealizadas || 0) < (prova.quantidadeTentativas || 1))
            const questionsCount = (prova.questoes || []).length
            const subjectTheme = getSubjectTheme(prova.disciplina)

            const openDate = new Date(prova.dataAbertura)
            const closeDate = new Date(prova.dataEncerramento)

            return (
              <motion.div
                key={prova.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="ad-prova-card-item"
                style={{
                  background: hasActiveAttempt
                    ? 'linear-gradient(180deg, #faf5ff 0%, #ffffff 40%)'
                    : canTakeExam
                    ? 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 40%)'
                    : '#ffffff',
                  border: hasActiveAttempt
                    ? '1.5px solid #d8b4fe'
                    : canTakeExam
                    ? '1.5px solid #86efac'
                    : '1.5px solid #e2e8f0',
                  boxShadow: hasActiveAttempt
                    ? '0 10px 28px -4px rgba(168, 85, 247, 0.18)'
                    : canTakeExam
                    ? '0 10px 28px -4px rgba(16, 185, 129, 0.16)'
                    : '0 6px 20px -2px rgba(15, 23, 42, 0.04)'
                }}
              >
                {/* Active Top Glow Line */}
                {hasActiveAttempt && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: 'linear-gradient(90deg, #a855f7, #ec4899, #a855f7)'
                  }} />
                )}
                {canTakeExam && !hasActiveAttempt && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: 'linear-gradient(90deg, #10b981, #34d399, #10b981)'
                  }} />
                )}

                {/* Card Top: Badges */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10.5,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '3px 9px',
                        borderRadius: 8,
                        background: subjectTheme.bg,
                        color: subjectTheme.text,
                        border: `1px solid ${subjectTheme.border}`
                      }}>
                        {prova.disciplina || 'Geral'}
                      </span>
                      <span style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '3px 7px',
                        borderRadius: 8,
                        background: '#f1f5f9',
                        color: '#475569'
                      }}>
                        {prova.bimestre ? `${prova.bimestre}º Bimestre` : 'Geral'}
                      </span>
                    </div>

                    {/* Status Pill */}
                    {hasActiveAttempt ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: 20,
                        background: '#f3e8ff',
                        color: '#7e22ce',
                        border: '1px solid #d8b4fe'
                      }}>
                        <Timer size={12} className="animate-pulse" />
                        {isResponsavel ? 'Em Realização pelo Aluno' : 'Em Andamento'}
                      </span>
                    ) : canTakeExam ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 11,
                        fontWeight: 800,
                        padding: '3px 9px',
                        borderRadius: 20,
                        background: isResponsavel ? '#fefce8' : '#ecfdf5',
                        color: isResponsavel ? '#a16207' : '#059669',
                        border: `1px solid ${isResponsavel ? '#fef08a' : '#a7f3d0'}`
                      }}>
                        <span style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: isResponsavel ? '#eab308' : '#10b981',
                          boxShadow: `0 0 6px ${isResponsavel ? '#eab308' : '#10b981'}`
                        }} />
                        {isResponsavel ? 'Pendente • Aluno Deve Fazer' : 'Disponível Agora'}
                      </span>
                    ) : isSubmitted ? (
                      studentInfo?.resultadoLiberado ? (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 11,
                          fontWeight: 900,
                          padding: '3px 9px',
                          borderRadius: 20,
                          background: '#ecfdf5',
                          color: '#047857',
                          border: '1px solid #6ee7b7'
                        }}>
                          <Award size={13} color="#047857" />
                          Nota: {studentInfo.ultimaTentativa?.notaFinal ?? 0} / {prova.valorTotal || 10}
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '3px 9px',
                          borderRadius: 20,
                          background: '#eff6ff',
                          color: '#2563eb',
                          border: '1px solid #bfdbfe'
                        }}>
                          <CheckCircle2 size={12} />
                          {isResponsavel ? 'Entregue pelo Aluno' : 'Entregue'}
                        </span>
                      )
                    ) : prova.status === 'agendada' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 20,
                        background: '#f8fafc',
                        color: '#64748b',
                        border: '1px solid #e2e8f0'
                      }}>
                        <Calendar size={12} />
                        Agendada
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '3px 9px',
                        borderRadius: 20,
                        background: '#f1f5f9',
                        color: '#64748b'
                      }}>
                        Encerrada
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 style={{
                    margin: 0,
                    fontSize: 16.5,
                    fontWeight: 900,
                    color: '#0f172a',
                    lineHeight: 1.35,
                    fontFamily: 'Outfit, sans-serif'
                  }}>
                    {prova.titulo}
                  </h3>

                  {/* Description preview if exists */}
                  {prova.descricao && (
                    <p style={{
                      margin: 0,
                      fontSize: 12,
                      color: '#64748b',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden'
                    }}>
                      {prova.descricao}
                    </p>
                  )}

                  {/* Urgent deadline notice if pending and closing within 24 hours */}
                  {canTakeExam && (() => {
                    const msLeft = closeDate.getTime() - Date.now()
                    const isEndingSoon = msLeft > 0 && msLeft < 24 * 60 * 60 * 1000
                    if (!isEndingSoon) return null
                    return (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#b45309',
                        background: '#fffbeb',
                        padding: '4px 10px',
                        borderRadius: 8,
                        border: '1px solid #fde68a'
                      }}>
                        <AlertCircle size={12} />
                        Atenção: Prazo encerra hoje às {closeDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )
                  })()}

                  {/* Metadata Specs Grid */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 8,
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    fontSize: 11.5
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155', fontWeight: 600 }}>
                      <Clock size={13} color="#0284c7" />
                      <span>{prova.duracaoMinutos || 60} min</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#334155', fontWeight: 600 }}>
                      <FileCheck2 size={13} color="#0284c7" />
                      <span>{questionsCount} questões ({prova.valorTotal || 10} pts)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', gridColumn: 'span 2' }}>
                      <UserCheck size={13} color="#94a3b8" />
                      <span>Prof. {prova.professorNome || 'Docente da Turma'}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', gridColumn: 'span 2' }}>
                      <Layers size={13} color="#94a3b8" />
                      <span>
                        Tentativas: {studentInfo?.tentativasRealizadas || 0} de {prova.quantidadeTentativas || 1} permitida(s)
                      </span>
                    </div>
                  </div>

                  {/* Schedule Box */}
                  <div style={{
                    padding: '9px 12px',
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: 11,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Abertura:</span>
                      <strong style={{ color: '#0f172a' }}>
                        {openDate.toLocaleDateString('pt-BR')} às {openDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Encerramento:</span>
                      <strong style={{ color: '#0f172a' }}>
                        {closeDate.toLocaleDateString('pt-BR')} às {closeDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                  </div>

                  {/* Submission Info / Grade Feedback */}
                  {isSubmitted && (
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: studentInfo?.resultadoLiberado ? '#f0fdf4' : '#f8fafc',
                      border: `1px solid ${studentInfo?.resultadoLiberado ? '#bbf7d0' : '#e2e8f0'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: studentInfo?.resultadoLiberado ? '#15803d' : '#475569' }}>
                          {studentInfo?.resultadoLiberado ? 'Nota e Devolutiva Disponível' : 'Entrega Confirmada pelo Aluno'}
                        </span>
                        {studentInfo?.resultadoLiberado && (
                          <span style={{ fontSize: 14, fontWeight: 900, color: '#15803d' }}>
                            {studentInfo.ultimaTentativa?.notaFinal ?? 0} / {prova.valorTotal || 10} pts
                          </span>
                        )}
                      </div>

                      {studentInfo?.resultadoLiberado && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
                          {(() => {
                            const nota = Number(studentInfo.ultimaTentativa?.notaFinal || 0)
                            const total = Number(prova.valorTotal || 10)
                            const pct = Math.min(100, Math.max(0, Math.round((nota / total) * 100)))
                            const barColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#0284c7' : '#f59e0b'
                            return (
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>
                                  <span>Aproveitamento da Avaliação</span>
                                  <strong style={{ color: barColor }}>{pct}%</strong>
                                </div>
                                <div style={{ width: '100%', height: 6, borderRadius: 9999, background: '#e2e8f0', overflow: 'hidden' }}>
                                  <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 9999, transition: 'width 0.5s ease' }} />
                                </div>
                              </>
                            )
                          })()}
                        </div>
                      )}

                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {studentInfo?.resultadoLiberado
                          ? 'Gabarito e critérios de pontuação já liberados pelo professor.'
                          : 'Aguardando publicação do resultado pela equipe pedagógica.'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div style={{
                  paddingTop: 12,
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}>
                  {isResponsavel ? (
                    /* ------------------------------------------------------------- */
                    /* RESPONSÁVEL VIEW: NO INICIAR / CONTINUAR PROVA BUTTONS!       */
                    /* ------------------------------------------------------------- */
                    hasActiveAttempt ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                        <div style={{
                          padding: '8px 12px',
                          borderRadius: 10,
                          background: '#faf5ff',
                          border: '1px solid #e9d5ff',
                          color: '#7e22ce',
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6
                        }}>
                          <Timer size={13} className="animate-pulse" />
                          <span>Prova em andamento no acesso do aluno</span>
                        </div>
                        <button
                          onClick={() => setSelectedBriefingProva(prova)}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: 10,
                            background: '#f8fafc',
                            border: '1.2px solid #cbd5e1',
                            color: '#334155',
                            fontWeight: 700,
                            fontSize: 11.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#7e22ce'
                            e.currentTarget.style.color = '#7e22ce'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#cbd5e1'
                            e.currentTarget.style.color = '#334155'
                          }}
                        >
                          <BookOpen size={13} />
                          Ver Orientações & Regras
                        </button>
                      </div>
                    ) : canTakeExam ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                        <div style={{
                          padding: '7px 10px',
                          borderRadius: 8,
                          background: '#f8fafc',
                          border: '1px dashed #cbd5e1',
                          color: '#64748b',
                          fontSize: 10.5,
                          fontWeight: 600,
                          textAlign: 'center'
                        }}>
                          O aluno deve acessar com seu login para responder
                        </div>
                        <button
                          onClick={() => setSelectedBriefingProva(prova)}
                          style={{
                            width: '100%',
                            padding: '9px 12px',
                            borderRadius: 10,
                            background: '#f0fdf4',
                            border: '1.2px solid #a7f3d0',
                            color: '#047857',
                            fontWeight: 800,
                            fontSize: 11.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#059669'
                            e.currentTarget.style.background = '#dcfce7'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#a7f3d0'
                            e.currentTarget.style.background = '#f0fdf4'
                          }}
                        >
                          <BookOpen size={13} />
                          Ver Orientações & Conteúdo
                        </button>
                      </div>
                    ) : isSubmitted ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <button
                          onClick={() => setSelectedVoucherProva(prova)}
                          style={{
                            flex: 1,
                            padding: '9px 12px',
                            borderRadius: 10,
                            background: '#f8fafc',
                            border: '1.2px solid #cbd5e1',
                            color: '#334155',
                            fontWeight: 700,
                            fontSize: 11.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#0284c7'
                            e.currentTarget.style.color = '#0284c7'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#cbd5e1'
                            e.currentTarget.style.color = '#334155'
                          }}
                        >
                          <FileText size={13} />
                          Comprovante
                        </button>

                        {studentInfo?.resultadoLiberado ? (
                          <button
                            onClick={() => setSelectedGabaritoProva(prova)}
                            style={{
                              flex: 1,
                              padding: '9px 12px',
                              borderRadius: 10,
                              background: '#ecfdf5',
                              border: '1.2px solid #a7f3d0',
                              color: '#059669',
                              fontWeight: 800,
                              fontSize: 11.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              cursor: 'pointer'
                            }}
                          >
                            <Award size={13} />
                            Ver Gabarito
                          </button>
                        ) : (
                          <div style={{
                            flex: 1,
                            padding: '9px 8px',
                            borderRadius: 10,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#94a3b8',
                            fontSize: 11,
                            fontWeight: 600,
                            textAlign: 'center'
                          }}>
                            Aguardando Gabarito
                          </div>
                        )}
                      </div>
                    ) : prova.status === 'agendada' ? (
                      <button
                        disabled
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: 12,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          color: '#64748b',
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'not-allowed'
                        }}
                      >
                        <Calendar size={13} />
                        Abre em {openDate.toLocaleDateString('pt-BR')} às {openDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </button>
                    ) : (
                      <button
                        disabled
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: 12,
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          color: '#94a3b8',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'not-allowed'
                        }}
                      >
                        Avaliação Encerrada
                      </button>
                    )
                  ) : (
                    /* ------------------------------------------------------------- */
                    /* ALUNO VIEW: CAN TAKE EXAMS, INICIAR / CONTINUAR PROVA         */
                    /* ------------------------------------------------------------- */
                    hasActiveAttempt ? (
                      <button
                        onClick={() => handleContinueExam(prova)}
                        style={{
                          width: '100%',
                          padding: '11px',
                          borderRadius: 12,
                          background: 'linear-gradient(135deg, #a855f7, #7e22ce)',
                          border: 'none',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: 12.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)',
                          transition: 'transform 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        <Timer size={15} />
                        Continuar Avaliação Agora
                      </button>
                    ) : canTakeExam ? (
                      <button
                        onClick={() => setSelectedBriefingProva(prova)}
                        style={{
                          width: '100%',
                          padding: '11px',
                          borderRadius: 12,
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          border: 'none',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: 12.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 8,
                          cursor: 'pointer',
                          boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                          transition: 'transform 0.15s ease'
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                      >
                        <Flame size={15} />
                        Iniciar Prova
                      </button>
                    ) : isSubmitted ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <button
                          onClick={() => setSelectedVoucherProva(prova)}
                          style={{
                            flex: 1,
                            padding: '9px 12px',
                            borderRadius: 10,
                            background: '#f8fafc',
                            border: '1.2px solid #cbd5e1',
                            color: '#334155',
                            fontWeight: 700,
                            fontSize: 11.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.borderColor = '#0284c7'
                            e.currentTarget.style.color = '#0284c7'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.borderColor = '#cbd5e1'
                            e.currentTarget.style.color = '#334155'
                          }}
                        >
                          <FileText size={13} />
                          Comprovante
                        </button>

                        {studentInfo?.resultadoLiberado && (
                          <button
                            onClick={() => setSelectedGabaritoProva(prova)}
                            style={{
                              flex: 1,
                              padding: '9px 12px',
                              borderRadius: 10,
                              background: '#ecfdf5',
                              border: '1.2px solid #a7f3d0',
                              color: '#059669',
                              fontWeight: 800,
                              fontSize: 11.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              cursor: 'pointer'
                            }}
                          >
                            <Award size={13} />
                            Ver Devolutiva
                          </button>
                        )}
                      </div>
                    ) : prova.status === 'agendada' ? (
                      <button
                        disabled
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: 12,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          color: '#64748b',
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'not-allowed'
                        }}
                      >
                        <Calendar size={13} />
                        Abre em {openDate.toLocaleDateString('pt-BR')} às {openDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </button>
                    ) : (
                      <button
                        disabled
                        style={{
                          width: '100%',
                          padding: '10px',
                          borderRadius: 12,
                          background: '#f1f5f9',
                          border: '1px solid #e2e8f0',
                          color: '#94a3b8',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'not-allowed'
                        }}
                      >
                        Avaliação Encerrada
                      </button>
                    )
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: PRE-EXAM BRIEFING & COMMITMENT MODAL                             */}
      {/* ========================================================================= */}
      <ModalPortal>
        <AnimatePresence>
          {selectedBriefingProva && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 999999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                boxSizing: 'border-box',
                overscrollBehavior: 'contain',
                touchAction: 'none'
              }}
              onClick={() => {
                setSelectedBriefingProva(null)
                setPledgeChecked(false)
              }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                style={{
                  width: '100%',
                  maxWidth: 540,
                  maxHeight: 'calc(100vh - 40px)',
                  background: '#ffffff',
                  borderRadius: 24,
                  boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.35)',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  margin: 'auto'
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 100%)',
                  flexShrink: 0
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: isResponsavel ? '#e0f2fe' : '#ecfdf5',
                    border: `1px solid ${isResponsavel ? '#bae6fd' : '#a7f3d0'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isResponsavel ? '#0284c7' : '#059669'
                  }}>
                    {isResponsavel ? <BookOpen size={22} /> : <FileCheck2 size={22} />}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                      {isResponsavel ? 'Orientações e Regras da Avaliação' : 'Instruções da Avaliação'}
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                      {isResponsavel ? 'Guia informativo para acompanhamento da família' : 'Leia atentamente antes de iniciar sua tentativa'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSelectedBriefingProva(null)
                    setPledgeChecked(false)
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: 'none',
                    background: '#f1f5f9',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Family Guidance Alert Box if Responsavel */}
                {isResponsavel && (
                  <div style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: '#eff6ff',
                    border: '1.5px solid #bfdbfe',
                    fontSize: 12,
                    color: '#1e40af',
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10
                  }}>
                    <Info size={16} color="#2563eb" style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong>Aviso à Família:</strong> Esta avaliação deve ser respondida exclusivamente pelo(a) estudante através do seu login próprio de aluno. Pais e responsáveis podem acompanhar as regras e horários aqui, mas não devem iniciar ou responder a prova.
                    </div>
                  </div>
                )}

                {/* Exam Title Pill */}
                <div style={{
                  padding: '14px 16px',
                  borderRadius: 14,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#0284c7', textTransform: 'uppercase' }}>
                    {selectedBriefingProva.disciplina} • {selectedBriefingProva.bimestre ? `${selectedBriefingProva.bimestre}º Bimestre` : 'Geral'}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a', marginTop: 4 }}>
                    {selectedBriefingProva.titulo}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    Aplicado por: Prof. {selectedBriefingProva.professorNome || 'Docente'}
                  </div>
                </div>

                {/* Important Rules Checklist */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Regras e Diretrizes Importantes:
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: '#334155' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Clock size={13} color="#2563eb" />
                    </div>
                    <div>
                      <strong>Tempo de Prova:</strong> {isResponsavel ? 'O estudante terá' : 'Você terá'} <strong>{selectedBriefingProva.duracaoMinutos} minutos</strong> cronometrados no servidor a partir do momento em que a prova for iniciada.
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: '#334155' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <CheckCircle2 size={13} color="#059669" />
                    </div>
                    <div>
                      <strong>Salvamento Automático:</strong> Todas as respostas são salvas instantaneamente a cada clique ou digitação na nuvem.
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: '#334155' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Shield size={13} color="#7e22ce" />
                    </div>
                    <div>
                      <strong>Integridade & Auditoria:</strong> O aluno deve permanecer na aba da prova. Saídas de tela e ações suspeitas são registradas nos relatórios docentes.
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12.5, color: '#334155' }}>
                    <div style={{ width: 22, height: 22, borderRadius: 6, background: '#fff7ed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <Award size={13} color="#ea580c" />
                    </div>
                    <div>
                      <strong>Comprovante Digital:</strong> Ao finalizar, um protocolo criptográfico autenticado é emitido comprovando a data e horário exato da entrega.
                    </div>
                  </div>
                </div>

                {/* Honesty Commitment Pledge (Only for Student) */}
                {!isResponsavel && (
                  <label style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    border: `1.5px solid ${pledgeChecked ? '#0284c7' : '#cbd5e1'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}>
                    <input
                      type="checkbox"
                      checked={pledgeChecked}
                      onChange={e => setPledgeChecked(e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: '#0284c7', marginTop: 2, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 12, color: '#334155', lineHeight: 1.4, fontWeight: 500 }}>
                      Declaro que compreendi todas as instruções. Comprometo-me a realizar esta avaliação com integridade, de forma individual e sem consulta a materiais não autorizados.
                    </span>
                  </label>
                )}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '18px 24px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: isResponsavel ? 'flex-end' : 'space-between',
                background: '#f8fafc',
                gap: 12
              }}>
                {isResponsavel ? (
                  <button
                    onClick={() => {
                      setSelectedBriefingProva(null)
                      setPledgeChecked(false)
                    }}
                    style={{
                      padding: '11px 24px',
                      borderRadius: 12,
                      background: '#0284c7',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Check size={15} />
                    Fechar Orientações
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setSelectedBriefingProva(null)
                        setPledgeChecked(false)
                      }}
                      style={{
                        padding: '10px 18px',
                        borderRadius: 12,
                        background: '#ffffff',
                        border: '1.5px solid #cbd5e1',
                        color: '#475569',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Cancelar
                    </button>

                    <button
                      disabled={!pledgeChecked}
                      onClick={() => {
                        const prova = selectedBriefingProva
                        setSelectedBriefingProva(null)
                        setPledgeChecked(false)
                        handleStartExam(prova)
                      }}
                      style={{
                        padding: '11px 24px',
                        borderRadius: 12,
                        background: pledgeChecked
                          ? 'linear-gradient(135deg, #10b981, #059669)'
                          : '#cbd5e1',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: pledgeChecked ? 'pointer' : 'not-allowed',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        boxShadow: pledgeChecked ? '0 4px 14px rgba(16, 185, 129, 0.35)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Flame size={15} />
                      Entendi • Iniciar Avaliação Agora
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ModalPortal>

      {/* ========================================================================= */}
      {/* MODAL 2: OFFICIAL SUBMISSION VOUCHER RECEIPT                              */}
      {/* ========================================================================= */}
      <ModalPortal>
        <AnimatePresence>
          {selectedVoucherProva && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                zIndex: 999999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
                boxSizing: 'border-box',
                overscrollBehavior: 'contain',
                touchAction: 'none'
              }}
              onClick={() => setSelectedVoucherProva(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 15 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 15 }}
                transition={{ type: 'spring', damping: 28, stiffness: 350 }}
                style={{
                  width: '100%',
                  maxWidth: 520,
                  maxHeight: 'calc(100vh - 40px)',
                  background: '#ffffff',
                  borderRadius: 24,
                  boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.35)',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  margin: 'auto'
                }}
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{
                  padding: '20px 24px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
                  flexShrink: 0
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    background: '#d1fae5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                      Comprovante de Entrega
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                      Certificado digital de submissão de prova
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedVoucherProva(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: 'none',
                    background: '#f1f5f9',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Receipt Content */}
              <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* College Watermark Badge */}
                <div style={{
                  padding: '16px',
                  borderRadius: 16,
                  background: '#f8fafc',
                  border: '1.5px dashed #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      Colégio Impacto • Sistema Educacional
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: '#d1fae5',
                      color: '#047857'
                    }}>
                      ENTREGUE
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Aluno:</span>
                      <strong style={{ color: '#0f172a' }}>{aluno?.nome || 'Aluno'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Matrícula:</span>
                      <strong style={{ color: '#0f172a' }}>{aluno?.matricula || resolvedAlunoId}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Avaliação:</span>
                      <strong style={{ color: '#0f172a' }}>{selectedVoucherProva.titulo}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Disciplina:</span>
                      <strong style={{ color: '#0f172a' }}>{selectedVoucherProva.disciplina}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>Data de Entrega:</span>
                      <strong style={{ color: '#0f172a' }}>
                        {selectedVoucherProva.studentInfo?.ultimaTentativa?.entregueEm
                          ? new Date(selectedVoucherProva.studentInfo.ultimaTentativa.entregueEm).toLocaleString('pt-BR')
                          : new Date().toLocaleString('pt-BR')}
                      </strong>
                    </div>
                  </div>

                  {/* Hash voucher code box */}
                  <div style={{
                    marginTop: 6,
                    padding: '12px',
                    borderRadius: 10,
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                        Protocolo Autenticador Digital:
                      </span>
                      <span style={{
                        fontSize: 12,
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        color: '#0284c7',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {selectedVoucherProva.studentInfo?.ultimaTentativa?.comprovanteCodigo || `IMP-PRV-${selectedVoucherProva.id.substring(0, 8).toUpperCase()}-${resolvedAlunoId}`}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyCode(selectedVoucherProva.studentInfo?.ultimaTentativa?.comprovanteCodigo || `IMP-PRV-${selectedVoucherProva.id.substring(0, 8).toUpperCase()}-${resolvedAlunoId}`)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: copiedVoucher ? '#ecfdf5' : '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        color: copiedVoucher ? '#059669' : '#334155',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        flexShrink: 0
                      }}
                    >
                      {copiedVoucher ? <Check size={12} /> : <Copy size={12} />}
                      {copiedVoucher ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: 11.5, color: '#64748b', textAlign: 'center', lineHeight: 1.4 }}>
                  Este protocolo certifica a submissão no servidor seguro do Colégio Impacto. Guarde este código para conferência posterior caso necessário.
                </div>
              </div>

              {/* Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 10,
                background: '#f8fafc'
              }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 10,
                    background: '#ffffff',
                    border: '1.2px solid #cbd5e1',
                    color: '#334155',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Printer size={14} /> Imprimir Comprovante
                </button>

                <button
                  onClick={() => setSelectedVoucherProva(null)}
                  style={{
                    padding: '9px 18px',
                    borderRadius: 10,
                    background: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ModalPortal>

    {/* ========================================================================= */}
    {/* MODAL 3: PEDAGOGICAL RESULTS & OFFICIAL GABARITO MODAL                    */}
    {/* ========================================================================= */}
    <ModalPortal>
      <AnimatePresence>
        {selectedGabaritoProva && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100vh',
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              zIndex: 999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              boxSizing: 'border-box',
              overscrollBehavior: 'contain',
              touchAction: 'none'
            }}
            onClick={() => setSelectedGabaritoProva(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 28, stiffness: 350 }}
              style={{
                width: '100%',
                maxWidth: 780,
                maxHeight: 'calc(100vh - 40px)',
                background: '#ffffff',
                borderRadius: 24,
                boxShadow: '0 25px 70px -10px rgba(0, 0, 0, 0.35)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                margin: 'auto'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: '#d1fae5',
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Award size={24} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>
                        Gabarito & Devolutiva Pedagógica
                      </h3>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        padding: '2px 7px',
                        borderRadius: 6,
                        background: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0'
                      }}>
                        {isResponsavel ? 'Visão da Família' : 'Visão do Aluno'}
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                      {selectedGabaritoProva.titulo} • {selectedGabaritoProva.disciplina} • Prof. {selectedGabaritoProva.professorNome || 'Docente'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedGabaritoProva(null)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: 'none',
                    background: '#f1f5f9',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div style={{
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                maxHeight: 'calc(100vh - 180px)',
                overflowY: 'auto'
              }}>
                {loadingGabarito ? (
                  <div style={{
                    padding: '48px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12
                  }}>
                    <RotateCw size={28} className="animate-spin" color="#0284c7" />
                    <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                      Carregando critérios e respostas da avaliação...
                    </span>
                  </div>
                ) : (() => {
                  const activeProva = detailedGabaritoProva || selectedGabaritoProva
                  const tentativa = activeProva?.studentInfo?.ultimaTentativa
                  const respostasObj = tentativa?.respostas || {}
                  const notaFinal = Number(tentativa?.notaFinal ?? 0)
                  const valorTotal = Number(activeProva.valorTotal || 10)
                  const aproveitamentoPct = Math.min(100, Math.max(0, Math.round((notaFinal / (valorTotal || 1)) * 100)))
                  const questoesList = activeProva.questoes || []

                  return (
                    <>
                      {/* 1. Score Summary Banner */}
                      <div style={{
                        padding: '16px 20px',
                        borderRadius: 16,
                        background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                        border: '1.5px solid #e2e8f0',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                        gap: 14
                      }}>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Estudante
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
                            {aluno?.nome || nomeEstudante}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>
                            Matrícula: {aluno?.matricula || resolvedAlunoId}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Pontuação Obtida
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#047857', marginTop: 2 }}>
                            {notaFinal} <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>/ {valorTotal} pts</span>
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Aproveitamento
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 900, color: aproveitamentoPct >= 70 ? '#059669' : aproveitamentoPct >= 50 ? '#0284c7' : '#d97706', marginTop: 2 }}>
                            {aproveitamentoPct}%
                          </div>
                          <div style={{ width: '100%', height: 5, borderRadius: 4, background: '#e2e8f0', marginTop: 4, overflow: 'hidden' }}>
                            <div style={{
                              width: `${aproveitamentoPct}%`,
                              height: '100%',
                              background: aproveitamentoPct >= 70 ? '#10b981' : aproveitamentoPct >= 50 ? '#0284c7' : '#f59e0b',
                              borderRadius: 4
                            }} />
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Entrega
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginTop: 2 }}>
                            {tentativa?.entregueEm ? new Date(tentativa.entregueEm).toLocaleDateString('pt-BR') : 'Submetida'}
                          </div>
                          <div style={{ fontSize: 11, color: '#94a3b8' }}>
                            {tentativa?.entregueEm ? new Date(tentativa.entregueEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </div>
                        </div>
                      </div>

                      {/* 2. Questions & Answer Key List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Conferência Questão por Questão ({questoesList.length} questões):
                        </div>

                        {questoesList.length === 0 ? (
                          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: 13, background: '#f8fafc', borderRadius: 12 }}>
                            Os detalhes das questões desta avaliação ainda não foram disponibilizados pela coordenação.
                          </div>
                        ) : (
                          questoesList.map((q: any, idx: number) => {
                            const resp = Array.isArray(respostasObj)
                              ? respostasObj.find((r: any) => r?.questaoId === q.id)
                              : (respostasObj[q.id] || null)

                            const pontosQuestao = Number(q.pontuacao || q.valorPontos || 1)
                            const pontosGanhos = resp?.pontuacaoObtida ?? resp?.pontosAtribuidos ?? resp?.nota

                            return (
                              <div
                                key={q.id || idx}
                                style={{
                                  padding: '18px 20px',
                                  borderRadius: 16,
                                  border: '1.5px solid #e2e8f0',
                                  background: '#ffffff',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 12,
                                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.02)'
                                }}
                              >
                                {/* Question Header */}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{
                                      width: 26,
                                      height: 26,
                                      borderRadius: 8,
                                      background: '#0284c7',
                                      color: '#ffffff',
                                      fontSize: 12,
                                      fontWeight: 900,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}>
                                      {idx + 1}
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                                      {q.tipo === 'multipla_escolha' ? 'Múltipla Escolha' : q.tipo === 'verdadeiro_falso' ? 'Verdadeiro ou Falso' : 'Dissertativa'}
                                    </span>
                                    <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                      • Valor: {pontosQuestao} {pontosQuestao === 1 ? 'ponto' : 'pontos'}
                                    </span>
                                  </div>

                                  {pontosGanhos !== undefined && (
                                    <span style={{
                                      fontSize: 11.5,
                                      fontWeight: 800,
                                      padding: '3px 9px',
                                      borderRadius: 12,
                                      background: pontosGanhos >= pontosQuestao ? '#ecfdf5' : pontosGanhos > 0 ? '#eff6ff' : '#fef2f2',
                                      color: pontosGanhos >= pontosQuestao ? '#047857' : pontosGanhos > 0 ? '#1d4ed8' : '#b91c1c',
                                      border: `1px solid ${pontosGanhos >= pontosQuestao ? '#a7f3d0' : pontosGanhos > 0 ? '#bfdbfe' : '#fecaca'}`
                                    }}>
                                      Pontos: {pontosGanhos} / {pontosQuestao}
                                    </span>
                                  )}
                                </div>

                                {/* Statement (Enunciado) */}
                                <div style={{ fontSize: 13.5, color: '#1e293b', lineHeight: 1.5 }}>
                                  <HtmlContent html={q.enunciado} />
                                </div>

                                {/* Objective Alternatives */}
                                {q.tipo === 'multipla_escolha' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                                    {(q.alternativas || []).map((alt: any) => {
                                      const isSelected = resp?.respostaOpcaoId === alt.id ||
                                        resp?.alternativaIdSelecionada === alt.id ||
                                        alt.id === resp?.respostaTexto ||
                                        alt.letra === resp?.respostaTexto

                                      const isCorrect = alt.correta === true

                                      let itemBg = '#f8fafc'
                                      let itemBorder = '#e2e8f0'
                                      let itemTextColor = '#334155'
                                      let badgeText = ''
                                      let badgeBg = ''
                                      let badgeColor = ''

                                      if (isCorrect && isSelected) {
                                        itemBg = '#ecfdf5'
                                        itemBorder = '#6ee7b7'
                                        itemTextColor = '#065f46'
                                        badgeText = 'Resposta do Aluno • Correta'
                                        badgeBg = '#d1fae5'
                                        badgeColor = '#047857'
                                      } else if (isCorrect && !isSelected) {
                                        itemBg = '#f0fdf4'
                                        itemBorder = '#86efac'
                                        itemTextColor = '#15803d'
                                        badgeText = 'Gabarito Oficial'
                                        badgeBg = '#dcfce7'
                                        badgeColor = '#15803d'
                                      } else if (!isCorrect && isSelected) {
                                        itemBg = '#fef2f2'
                                        itemBorder = '#fca5a5'
                                        itemTextColor = '#991b1b'
                                        badgeText = 'Resposta do Aluno (Incorreta)'
                                        badgeBg = '#fee2e2'
                                        badgeColor = '#b91c1c'
                                      }

                                      return (
                                        <div
                                          key={alt.id}
                                          style={{
                                            padding: '10px 14px',
                                            borderRadius: 12,
                                            background: itemBg,
                                            border: `1.5px solid ${itemBorder}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 10
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                                            <span style={{
                                              width: 24,
                                              height: 24,
                                              borderRadius: '50%',
                                              background: isSelected ? (isCorrect ? '#10b981' : '#ef4444') : (isCorrect ? '#22c55e' : '#e2e8f0'),
                                              color: isSelected || isCorrect ? '#ffffff' : '#64748b',
                                              fontSize: 11,
                                              fontWeight: 800,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexShrink: 0
                                            }}>
                                              {alt.letra}
                                            </span>
                                            <div style={{ fontSize: 13, color: itemTextColor, fontWeight: isSelected || isCorrect ? 600 : 500 }}>
                                              <HtmlContent html={cleanAlternativeText(alt.texto)} />
                                            </div>
                                          </div>

                                          {badgeText && (
                                            <span style={{
                                              fontSize: 10.5,
                                              fontWeight: 800,
                                              padding: '3px 8px',
                                              borderRadius: 8,
                                              background: badgeBg,
                                              color: badgeColor,
                                              whiteSpace: 'nowrap'
                                            }}>
                                              {badgeText}
                                            </span>
                                          )}
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}

                                {/* True / False (V/F) Items */}
                                {q.tipo === 'verdadeiro_falso' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                                    {(q.itensVF || q.itensVouF || []).map((item: any, itemIdx: number) => {
                                      const alunoChoice = resp?.respostaVF?.[item.id] !== undefined
                                        ? resp.respostaVF[item.id]
                                        : resp?.itensVouF?.find((i: any) => i.id === item.id)?.respostaAluno

                                      const correctChoice = item.correta !== undefined ? item.correta : item.afirmacao
                                      const isMatch = alunoChoice !== undefined && alunoChoice === correctChoice

                                      return (
                                        <div
                                          key={item.id || itemIdx}
                                          style={{
                                            padding: '10px 14px',
                                            borderRadius: 12,
                                            background: alunoChoice !== undefined ? (isMatch ? '#ecfdf5' : '#fef2f2') : '#f8fafc',
                                            border: `1px solid ${alunoChoice !== undefined ? (isMatch ? '#86efac' : '#fca5a5') : '#e2e8f0'}`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: 10
                                          }}
                                        >
                                          <div style={{ fontSize: 13, color: '#334155', flex: 1 }}>
                                            <HtmlContent html={item.texto || item.afirmacao || `Item ${itemIdx + 1}`} />
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontSize: 11.5 }}>
                                            <span style={{ color: '#64748b' }}>
                                              Aluno: <strong>{alunoChoice === true ? 'V' : alunoChoice === false ? 'F' : 'Em branco'}</strong>
                                            </span>
                                            <span style={{ color: '#059669', fontWeight: 800 }}>
                                              Gabarito: <strong>{correctChoice === true ? 'V' : 'F'}</strong>
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )}

                                {/* Dissertative Answer Feedback */}
                                {q.tipo === 'dissertativa' && (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
                                    <div style={{
                                      padding: '12px 14px',
                                      borderRadius: 12,
                                      background: '#f8fafc',
                                      border: '1px solid #e2e8f0'
                                    }}>
                                      <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                                        Resposta Escrita pelo Estudante:
                                      </div>
                                      <div style={{ fontSize: 13, color: '#0f172a', marginTop: 4, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                                        {resp?.respostaDissertativa || resp?.textoDissertativo || resp?.respostaTexto || '(Nenhuma resposta escrita foi registrada)'}
                                      </div>
                                    </div>

                                    {/* Teacher Correction Commentary */}
                                    {(resp?.comentarioProfessor || resp?.comentarioCorrecao) && (
                                      <div style={{
                                        padding: '12px 14px',
                                        borderRadius: 12,
                                        background: '#fefce8',
                                        border: '1px solid #fef08a'
                                      }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: '#854d0e', textTransform: 'uppercase' }}>
                                          <UserCheck size={14} color="#a16207" />
                                          Comentário do Professor Corretor:
                                        </div>
                                        <div style={{ fontSize: 12.5, color: '#713f12', marginTop: 4, lineHeight: 1.45 }}>
                                          {resp.comentarioProfessor || resp.comentarioCorrecao}
                                        </div>
                                      </div>
                                    )}

                                    {/* Expected Rubric */}
                                    {q.respostaEsperada && (
                                      <div style={{
                                        padding: '12px 14px',
                                        borderRadius: 12,
                                        background: '#eff6ff',
                                        border: '1px solid #bfdbfe'
                                      }}>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8', textTransform: 'uppercase' }}>
                                          Resposta Esperada / Critérios do Gabarito:
                                        </div>
                                        <div style={{ fontSize: 12.5, color: '#1e3a8a', marginTop: 4, lineHeight: 1.45 }}>
                                          <HtmlContent html={q.respostaEsperada} />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Explanation / Resolução Comentada */}
                                {q.explicacaoResposta && (
                                  <div style={{
                                    marginTop: 4,
                                    padding: '12px 14px',
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                                    border: '1px solid #cbd5e1'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                                      <Sparkles size={14} color="#6366f1" />
                                      <span>Resolução Comentada pelo Professor:</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.45 }}>
                                      <HtmlContent html={q.explicacaoResposta} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>

              {/* Modal Footer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
                gap: 10,
                flexShrink: 0
              }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    padding: '9px 16px',
                    borderRadius: 10,
                    background: '#ffffff',
                    border: '1.2px solid #cbd5e1',
                    color: '#334155',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Printer size={14} /> Imprimir Gabarito
                </button>

                <button
                  onClick={() => setSelectedGabaritoProva(null)}
                  style={{
                    padding: '9px 20px',
                    borderRadius: 10,
                    background: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 12.5,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ModalPortal>
    </div>
  )
}
