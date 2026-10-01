'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileCheck2, Plus, Search, Filter, BookOpen, Clock, Calendar,
  Users, CheckCircle2, AlertTriangle, Eye, Shield, Activity,
  BarChart3, RefreshCw, FileText, ChevronRight, Sparkles,
  BookMarked, HelpCircle, ArrowUpRight, Award, Lock, Unlock,
  Layers, UserCheck, Flame, Timer, Check, Send, Edit3, X,
  GraduationCap, AlertCircle, Printer, Link2, Copy, Share2,
  SlidersHorizontal, Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from '@/lib/context'
import { ProvaOnline } from '@/types/provas-online'

export default function ProvasOnlineDashboardPage() {
  const router = useRouter()
  const { currentUser } = useApp()

  const [provas, setProvas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<'todas' | 'em_aplicacao' | 'agendada' | 'rascunho' | 'correcao' | 'encerrada' | 'publicada'>('todas')
  const [search, setSearch] = useState('')
  const [filterAnoLetivo, setFilterAnoLetivo] = useState('')
  const [filterTurma, setFilterTurma] = useState('')
  const [filterDisciplina, setFilterDisciplina] = useState('')
  const [filterPeriodo, setFilterPeriodo] = useState('')

  // State for deleting an exam
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [provaToDelete, setProvaToDelete] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)

  // Determine user role
  const cargo = currentUser?.cargo || ''
  const perfil = currentUser?.perfil || ''
  const isStudent = cargo === 'Aluno' || perfil === 'Aluno' || Boolean(currentUser?.aluno_id && cargo !== 'Responsável')
  const isResponsible = cargo === 'Responsável' || perfil === 'Família' || perfil === 'Responsável'
  const isTeacherOrStaff = !isStudent && !isResponsible

  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleDeleteProva = (prova: any) => {
    setProvaToDelete(prova)
    setDeleteModalOpen(true)
  }

  const confirmDeleteProva = async () => {
    if (!provaToDelete) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/provas-online/${provaToDelete.id}?force=true`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir avaliação')

      toast.success('Avaliação excluída com sucesso!')
      setProvas(prev => prev.filter(p => p.id !== provaToDelete.id))
      setDeleteModalOpen(false)
      setProvaToDelete(null)
    } catch (err: any) {
      toast.error(err.message || 'Falha ao excluir prova')
    } finally {
      setDeleting(false)
    }
  }

  const handleCopyStudentLink = async (provaId: string, titulo?: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const link = `${origin}/provas-online/fazer/${provaId}`
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
      setCopiedId(provaId)
      toast.success(
        titulo
          ? `Link de "${titulo}" copiado! Compartilhe com os alunos.`
          : 'Link copiado com sucesso!'
      )
      setTimeout(() => setCopiedId(null), 3000)
    } catch (err) {
      toast.error('Não foi possível copiar o link.')
    }
  }

  const fetchProvas = async () => {
    try {
      setRefreshing(true)
      const res = await fetch('/api/provas-online')
      if (res.ok) {
        const data = await res.json()
        setProvas(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error('Erro ao carregar provas:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchProvas()
    const interval = setInterval(fetchProvas, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get('tab')
      if (tabParam && ['todas', 'em_aplicacao', 'agendada', 'rascunho', 'correcao', 'encerrada', 'publicada'].includes(tabParam)) {
        setActiveTab(tabParam as any)
      }
    }
  }, [])

  // Options for filters
  const anosLetivosList = useMemo(() => {
    const set = new Set<string>()
    provas.forEach(p => {
      const year = p.anoLetivo || (p.dataAbertura ? new Date(p.dataAbertura).getFullYear() : null)
      if (year) set.add(String(year))
    })
    if (set.size === 0) set.add(String(new Date().getFullYear()))
    return Array.from(set).sort((a, b) => Number(b) - Number(a))
  }, [provas])

  const turmasList = useMemo(() => {
    const set = new Set<string>()
    provas.forEach(p => (p.turmas || []).forEach((t: string) => set.add(t)))
    return Array.from(set)
  }, [provas])

  const disciplinasList = useMemo(() => {
    const set = new Set<string>()
    provas.forEach(p => { if (p.disciplina) set.add(p.disciplina) })
    return Array.from(set)
  }, [provas])

  // Filtered list
  const filteredProvas = useMemo(() => {
    return provas.filter(p => {
      // Tab filter
      if (activeTab === 'em_aplicacao' && p.status !== 'em_aplicacao') return false
      if (activeTab === 'agendada' && p.status !== 'agendada') return false
      if (activeTab === 'rascunho' && p.status !== 'rascunho') return false
      if (activeTab === 'encerrada' && p.status !== 'encerrada') return false
      if (activeTab === 'publicada' && p.status !== 'publicada') return false
      if (activeTab === 'correcao') {
        const hasPending = (p.stats?.correcaoPendente > 0) || p.status === 'em_correcao'
        if (!hasPending) return false
      }

      // Search keyword
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchTitle = p.titulo?.toLowerCase().includes(q)
        const matchDisc = p.disciplina?.toLowerCase().includes(q)
        const matchProf = p.professorNome?.toLowerCase().includes(q)
        if (!matchTitle && !matchDisc && !matchProf) return false
      }

      // Dropdown filters
      if (filterAnoLetivo) {
        const pYear = String(p.anoLetivo || (p.dataAbertura ? new Date(p.dataAbertura).getFullYear() : ''))
        if (pYear !== filterAnoLetivo) return false
      }
      if (filterTurma && !(p.turmas || []).includes(filterTurma)) return false
      if (filterDisciplina && p.disciplina !== filterDisciplina) return false
      if (filterPeriodo && String(p.bimestre) !== filterPeriodo) return false

      return true
    })
  }, [provas, activeTab, search, filterAnoLetivo, filterTurma, filterDisciplina, filterPeriodo])

  // Counts for tabs
  const tabCounts = useMemo(() => {
    return {
      todas: provas.length,
      em_aplicacao: provas.filter(p => p.status === 'em_aplicacao').length,
      agendada: provas.filter(p => p.status === 'agendada').length,
      rascunho: provas.filter(p => p.status === 'rascunho').length,
      correcao: provas.filter(p => (p.stats?.correcaoPendente > 0) || p.status === 'em_correcao').length,
      encerrada: provas.filter(p => p.status === 'encerrada').length,
      publicada: provas.filter(p => p.status === 'publicada').length,
    }
  }, [provas])

  // Student specific counts
  const studentMetrics = useMemo(() => {
    if (!isStudent) return null
    const disponiveis = provas.filter(p => {
      const info = p.studentInfo
      return p.status === 'em_aplicacao' && (!info || (!info.submetida && !info.tentativaAtivaId))
    }).length

    const emAndamento = provas.filter(p => p.studentInfo?.tentativaAtivaId).length
    const entregues = provas.filter(p => p.studentInfo?.submetida).length
    const resultados = provas.filter(p => p.studentInfo?.resultadoLiberado).length

    return { disponiveis, emAndamento, entregues, resultados }
  }, [provas, isStudent])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'em_aplicacao':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 99, background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: 11, fontWeight: 800 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} className="animate-pulse" />
            Em Aplicação
          </span>
        )
      case 'agendada':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', fontSize: 11, fontWeight: 700 }}>
            <Calendar size={11} /> Agendada
          </span>
        )
      case 'rascunho':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: 11, fontWeight: 700 }}>
            <FileText size={11} /> Rascunho
          </span>
        )
      case 'encerrada':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', fontSize: 11, fontWeight: 700 }}>
            <Clock size={11} /> Encerrada
          </span>
        )
      case 'publicada':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, background: '#f5f3ff', border: '1px solid #ddd6fe', color: '#5b21b6', fontSize: 11, fontWeight: 800 }}>
            <Award size={11} /> Publicada
          </span>
        )
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 99, background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#475569', fontSize: 11, fontWeight: 700 }}>
            {status}
          </span>
        )
    }
  }

  return (
    <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20, minHeight: '100vh', background: '#f8fafc', color: '#0f172a', boxSizing: 'border-box' }}>
      
      {/* 1. HERO HEADER */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 20,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
      }}>
        {/* Title and subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
            flexShrink: 0
          }}>
            <FileCheck2 size={24} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                Provas Online
              </h1>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '3px 8px', borderRadius: 99, background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
                Módulo Oficial
              </span>
            </div>
            <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0', fontWeight: 500 }}>
              {isStudent
                ? 'Ambiente de avaliação individual, seguro e auditado com sincronização em tempo real.'
                : isResponsible
                ? 'Acompanhamento detalhado de desempenho, resultados e devolutivas dos dependentes.'
                : 'Gestão de provas, supervisão em tempo real e central de correção pedagógica.'}
            </p>
          </div>
        </div>

        {/* Action buttons (Teachers / Admins) */}
        {isTeacherOrStaff && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <button
              onClick={() => router.push('/provas-online/nova')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 38,
                padding: '0 18px',
                borderRadius: 12,
                border: 'none',
                background: '#0284c7',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
                transition: 'all 0.15s'
              }}
            >
              <Plus size={16} strokeWidth={3} />
              <span>Nova Avaliação</span>
            </button>

            <button
              onClick={fetchProvas}
              disabled={refreshing}
              title="Atualizar lista"
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        )}
      </div>

      {/* 2. KPI METRICS CARDS */}
      {isTeacherOrStaff && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {/* Total Provas */}
          <div
            onClick={() => setActiveTab('todas')}
            style={{
              cursor: 'pointer',
              borderRadius: 16,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 12,
              background: '#ffffff',
              border: `1px solid ${activeTab === 'todas' ? '#0284c7' : '#e2e8f0'}`,
              boxShadow: activeTab === 'todas' ? '0 0 0 2px rgba(2,132,199,0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Total de Provas
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileCheck2 size={16} style={{ color: '#0284c7' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>{tabCounts.todas}</div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 5, fontWeight: 500 }}>Todas as avaliações</div>
            </div>
          </div>

          {/* Em Aplicação */}
          <div
            onClick={() => setActiveTab('em_aplicacao')}
            style={{
              cursor: 'pointer',
              borderRadius: 16,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 12,
              background: '#ffffff',
              border: `1px solid ${activeTab === 'em_aplicacao' ? '#10b981' : '#e2e8f0'}`,
              boxShadow: activeTab === 'em_aplicacao' ? '0 0 0 2px rgba(16,185,129,0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} className="animate-ping" />
                Em Aplicação
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={16} style={{ color: '#059669' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#059669', lineHeight: 1 }}>{tabCounts.em_aplicacao}</div>
              <div style={{ fontSize: 11, color: '#10b981', marginTop: 5, fontWeight: 600 }}>Supervisão ao vivo</div>
            </div>
          </div>

          {/* Fila de Correção */}
          <div
            onClick={() => setActiveTab('correcao')}
            style={{
              cursor: 'pointer',
              borderRadius: 16,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 12,
              background: '#ffffff',
              border: `1px solid ${activeTab === 'correcao' ? '#f59e0b' : '#e2e8f0'}`,
              boxShadow: activeTab === 'correcao' ? '0 0 0 2px rgba(245,158,11,0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Fila de Correção
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={16} style={{ color: '#b45309' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#b45309', lineHeight: 1 }}>{tabCounts.correcao}</div>
              <div style={{ fontSize: 11, color: '#b45309', marginTop: 5, fontWeight: 600 }}>Dissertativas pendentes</div>
            </div>
          </div>

          {/* Resultados Publicados */}
          <div
            onClick={() => setActiveTab('publicada')}
            style={{
              cursor: 'pointer',
              borderRadius: 16,
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 12,
              background: '#ffffff',
              border: `1px solid ${activeTab === 'publicada' ? '#8b5cf6' : '#e2e8f0'}`,
              boxShadow: activeTab === 'publicada' ? '0 0 0 2px rgba(139,92,246,0.15)' : '0 1px 3px rgba(0,0,0,0.03)',
              transition: 'all 0.15s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Resultados
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={16} style={{ color: '#7c3aed' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#7c3aed', lineHeight: 1 }}>{tabCounts.publicada}</div>
              <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 5, fontWeight: 600 }}>Gabaritos divulgados</div>
            </div>
          </div>
        </div>
      )}

      {/* Student Metrics */}
      {isStudent && studentMetrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: 16, padding: '16px 20px' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>Disponíveis</span>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#16a34a', marginTop: 4 }}>{studentMetrics.disponiveis}</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #ddd6fe', borderRadius: 16, padding: '16px 20px' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#5b21b6', textTransform: 'uppercase' }}>Em Andamento</span>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#7c3aed', marginTop: 4 }}>{studentMetrics.emAndamento}</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #bae6fd', borderRadius: 16, padding: '16px 20px' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>Entregues</span>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#0284c7', marginTop: 4 }}>{studentMetrics.entregues}</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #fbcfe8', borderRadius: 16, padding: '16px 20px' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#9d174d', textTransform: 'uppercase' }}>Notas Liberadas</span>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#db2777', marginTop: 4 }}>{studentMetrics.resultados}</div>
          </div>
        </div>
      )}

      {/* 3. TABS & FILTER BAR */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Navigation Tabs */}
        {isTeacherOrStaff && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', padding: 4, background: '#f1f5f9', borderRadius: 14 }}>
            {[
              { id: 'todas', label: 'Todas as Provas', count: tabCounts.todas },
              { id: 'em_aplicacao', label: 'Em Aplicação', count: tabCounts.em_aplicacao, isLive: true },
              { id: 'agendada', label: 'Agendadas', count: tabCounts.agendada },
              { id: 'correcao', label: 'Correção Pendente', count: tabCounts.correcao },
              { id: 'publicada', label: 'Publicadas', count: tabCounts.publicada },
              { id: 'rascunho', label: 'Rascunhos', count: tabCounts.rascunho },
              { id: 'encerrada', label: 'Encerradas', count: tabCounts.encerrada },
            ].map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: active ? '#ffffff' : 'transparent',
                    color: active ? '#0284c7' : '#64748b',
                    fontSize: 12,
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    flexShrink: 0,
                    transition: 'all 0.15s'
                  }}
                >
                  {tab.isLive && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} className="animate-pulse" />
                  )}
                  <span>{tab.label}</span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 6,
                    background: active ? '#e0f2fe' : '#e2e8f0',
                    color: active ? '#0369a1' : '#64748b'
                  }}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Search & Filters in 1 SINGLE ROW */}
        <div style={{
          padding: '8px 12px',
          borderRadius: 14,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'nowrap',
          overflowX: 'auto',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          {/* Search bar (takes remaining space) */}
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Buscar por título, matéria ou professor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: 38,
                paddingLeft: 36,
                paddingRight: search ? 30 : 12,
                borderRadius: 10,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                fontSize: 12,
                color: '#0f172a',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Ano Letivo filter */}
          {anosLetivosList.length > 0 && (
            <select
              value={filterAnoLetivo}
              onChange={e => setFilterAnoLetivo(e.target.value)}
              style={{
                width: 135,
                minWidth: 120,
                maxWidth: 150,
                flexShrink: 0,
                height: 38,
                padding: '0 10px',
                borderRadius: 10,
                border: `1px solid ${filterAnoLetivo ? '#0284c7' : '#e2e8f0'}`,
                background: filterAnoLetivo ? '#e0f2fe' : '#f8fafc',
                color: filterAnoLetivo ? '#0369a1' : '#334155',
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            >
              <option value="">Todos os Anos</option>
              {anosLetivosList.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          )}

          {/* Turma filter */}
          {turmasList.length > 0 && (
            <select
              value={filterTurma}
              onChange={e => setFilterTurma(e.target.value)}
              style={{
                width: 155,
                minWidth: 135,
                maxWidth: 175,
                flexShrink: 0,
                height: 38,
                padding: '0 12px',
                borderRadius: 10,
                border: `1px solid ${filterTurma ? '#0284c7' : '#e2e8f0'}`,
                background: filterTurma ? '#e0f2fe' : '#f8fafc',
                color: filterTurma ? '#0369a1' : '#334155',
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            >
              <option value="">Todas as Turmas</option>
              {turmasList.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}

          {/* Disciplina filter */}
          {disciplinasList.length > 0 && (
            <select
              value={filterDisciplina}
              onChange={e => setFilterDisciplina(e.target.value)}
              style={{
                width: 165,
                minWidth: 145,
                maxWidth: 190,
                flexShrink: 0,
                height: 38,
                padding: '0 12px',
                borderRadius: 10,
                border: `1px solid ${filterDisciplina ? '#0284c7' : '#e2e8f0'}`,
                background: filterDisciplina ? '#e0f2fe' : '#f8fafc',
                color: filterDisciplina ? '#0369a1' : '#334155',
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
                boxSizing: 'border-box'
              }}
            >
              <option value="">Todas as Disciplinas</option>
              {disciplinasList.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          {/* Bimestre filter */}
          <select
            value={filterPeriodo}
            onChange={e => setFilterPeriodo(e.target.value)}
            style={{
              width: 145,
              minWidth: 130,
              maxWidth: 160,
              flexShrink: 0,
              height: 38,
              padding: '0 12px',
              borderRadius: 10,
              border: `1px solid ${filterPeriodo ? '#0284c7' : '#e2e8f0'}`,
              background: filterPeriodo ? '#e0f2fe' : '#f8fafc',
              color: filterPeriodo ? '#0369a1' : '#334155',
              fontSize: 12,
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer',
              boxSizing: 'border-box'
            }}
          >
            <option value="">Todos os Bimestres</option>
            <option value="1">1º Bimestre</option>
            <option value="2">2º Bimestre</option>
            <option value="3">3º Bimestre</option>
            <option value="4">4º Bimestre</option>
          </select>

          {/* Reset button */}
          {(search || filterAnoLetivo || filterTurma || filterDisciplina || filterPeriodo) && (
            <button
              onClick={() => {
                setSearch('')
                setFilterAnoLetivo('')
                setFilterTurma('')
                setFilterDisciplina('')
                setFilterPeriodo('')
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 38,
                padding: '0 12px',
                borderRadius: 10,
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                color: '#991b1b',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
                whiteSpace: 'nowrap'
              }}
            >
              <X size={13} /> Limpar
            </button>
          )}
        </div>
      </div>

      {/* 4. MAIN EXAM CARDS GRID */}
      {loading ? (
        <div style={{ padding: '80px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={20} style={{ color: '#0284c7' }} className="animate-spin" />
          </div>
          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>Carregando avaliações...</span>
        </div>
      ) : filteredProvas.length === 0 ? (
        <div style={{ padding: '64px 24px', borderRadius: 20, background: '#ffffff', border: '1px solid #e2e8f0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#f0f9ff', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={24} style={{ color: '#0284c7' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', margin: '0 0 4px' }}>Nenhuma avaliação encontrada</h3>
            <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Nenhuma prova corresponde aos filtros selecionados.</p>
          </div>
          {isTeacherOrStaff && (
            <button
              onClick={() => router.push('/provas-online/nova')}
              style={{
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
                cursor: 'pointer'
              }}
            >
              <Plus size={15} /> Criar Nova Avaliação
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
          {filteredProvas.map(prova => {
            const openDate = new Date(prova.dataAbertura)
            const closeDate = new Date(prova.dataEncerramento)
            const questionsCount = (prova.questoes || []).length
            const isLive = prova.status === 'em_aplicacao'
            const studentInfo = prova.studentInfo
            const canTakeExam = isStudent && isLive && (!studentInfo?.submetida || studentInfo?.tentativasRealizadas < prova.quantidadeTentativas)
            const hasActiveAttempt = Boolean(studentInfo?.tentativaAtivaId)

            return (
              <motion.div
                key={prova.id}
                layout
                style={{
                  background: '#ffffff',
                  border: `1px solid ${isLive ? '#86efac' : '#e2e8f0'}`,
                  borderRadius: 18,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 16,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Top Header: Subject + Period + Year + Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '3px 8px', borderRadius: 8, background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>
                        {prova.disciplina || 'Geral'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8, background: '#f1f5f9', color: '#475569' }}>
                        {prova.bimestre ? `${prova.bimestre}º Bim` : 'Geral'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontFamily: 'monospace' }}>
                        {prova.anoLetivo || (prova.dataAbertura ? new Date(prova.dataAbertura).getFullYear() : '2026')}
                      </span>
                    </div>

                    {getStatusBadge(prova.status)}
                  </div>

                  {/* Exam Title */}
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: '#0f172a',
                      margin: 0,
                      lineHeight: 1.4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: '100%'
                    }}
                    title={prova.titulo}
                  >
                    {prova.titulo}
                  </h3>

                  {/* Chips: Duration, Questions, Turmas, Professor */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 11, color: '#334155', fontWeight: 600 }}>
                      <Clock size={12} style={{ color: '#0284c7' }} />
                      {prova.duracaoMinutos} min
                    </span>

                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 11, color: '#334155', fontWeight: 600 }}>
                      <FileCheck2 size={12} style={{ color: '#0284c7' }} />
                      {questionsCount} quest. ({prova.valorTotal || 10} pts)
                    </span>

                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 11, color: '#64748b', fontWeight: 500 }}>
                      <Layers size={12} style={{ color: '#94a3b8' }} />
                      Turma: {(prova.turmas || []).join(', ') || 'Todas'}
                    </span>
                  </div>

                  {/* Schedule Box */}
                  <div style={{ padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#64748b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Abertura:</span>
                      <strong style={{ color: '#1e293b' }}>
                        {openDate.toLocaleDateString('pt-BR')} às {openDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Encerramento:</span>
                      <strong style={{ color: '#1e293b' }}>
                        {closeDate.toLocaleDateString('pt-BR')} às {closeDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </strong>
                    </div>
                  </div>

                  {/* Delivery progress bar & Ultra-Modern Correction Status for Teachers */}
                  {isTeacherOrStaff && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>Entregas Realizadas</span>
                          <strong style={{ color: '#0369a1', fontFamily: 'monospace' }}>
                            {prova.stats?.entregues || 0} entregas
                          </strong>
                        </div>
                        <div style={{ height: 5, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              background: '#0284c7',
                              width: `${Math.min(100, ((prova.stats?.entregues || 0) / Math.max(1, prova.stats?.totalTentativas || 1)) * 100)}%`,
                              transition: 'width 0.4s'
                            }}
                          />
                        </div>
                        {prova.stats?.emAndamento > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#059669', fontWeight: 700 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} className="animate-pulse" />
                            <span>{prova.stats.emAndamento} aluno(s) fazendo a prova agora</span>
                          </div>
                        )}
                      </div>

                      {/* ULTRA-MODERN PENDING CORRECTIONS WIDGET */}
                      {prova.stats?.correcaoPendente > 0 ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '9px 12px',
                          borderRadius: 12,
                          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                          border: '1px solid #fde68a',
                          boxShadow: '0 1px 2px rgba(245, 158, 11, 0.08)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ position: 'relative', display: 'flex', width: 8, height: 8 }}>
                              <span className="animate-ping" style={{ position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', background: '#f59e0b', opacity: 0.75 }} />
                              <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', width: 8, height: 8, background: '#d97706' }} />
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 800, color: '#92400e', letterSpacing: '0.01em' }}>
                              Faltam Corrigir:
                            </span>
                          </div>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 900,
                            fontFamily: 'monospace',
                            background: '#f59e0b',
                            color: '#ffffff',
                            padding: '2px 8px',
                            borderRadius: 99,
                            boxShadow: '0 2px 4px rgba(245, 158, 11, 0.35)'
                          }}>
                            {prova.stats.correcaoPendente} {prova.stats.correcaoPendente === 1 ? 'avaliação' : 'avaliações'}
                          </span>
                        </div>
                      ) : (prova.stats?.entregues > 0) ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 12,
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          fontSize: 11
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 700 }}>
                            <CheckCircle2 size={13} style={{ color: '#16a34a' }} />
                            <span>Correções Concluídas</span>
                          </div>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 800,
                            background: '#dcfce7',
                            color: '#15803d',
                            padding: '2px 8px',
                            borderRadius: 99,
                            border: '1px solid #86efac'
                          }}>
                            100% em dia
                          </span>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Student Attempt status pill */}
                  {isStudent && (
                    <div style={{ padding: '10px 12px', borderRadius: 12, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 12 }}>
                      {studentInfo?.submetida ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#16a34a', fontWeight: 700 }}>
                            <CheckCircle2 size={14} /> Prova Entregue
                          </div>
                          {studentInfo.resultadoLiberado ? (
                            <div style={{ marginTop: 4, fontSize: 13, fontWeight: 900, color: '#0f172a' }}>
                              Nota: <span style={{ color: '#16a34a' }}>{studentInfo.ultimaTentativa?.notaFinal} / {prova.valorTotal}</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                              Aguardando liberação do gabarito.
                            </div>
                          )}
                        </div>
                      ) : hasActiveAttempt ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7c3aed', fontWeight: 700 }}>
                          <Timer size={14} className="animate-pulse" /> Tentativa em andamento
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
                          <Clock size={13} />
                          <span>
                            {studentInfo?.tentativasRealizadas > 0
                              ? `${studentInfo.tentativasRealizadas}/${prova.quantidadeTentativas} tentativas usadas`
                              : 'Ainda não iniciada'}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons Footer */}
                <div style={{ paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {/* STUDENT ACTIONS */}
                  {isStudent && (
                    <div style={{ width: '100%' }}>
                      {hasActiveAttempt ? (
                        <button
                          onClick={() => router.push(`/provas-online/fazer/${studentInfo.tentativaAtivaId}`)}
                          style={{
                            width: '100%',
                            height: 38,
                            borderRadius: 10,
                            border: 'none',
                            background: '#7c3aed',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            cursor: 'pointer'
                          }}
                        >
                          <Timer size={15} /> Continuar Prova
                        </button>
                      ) : canTakeExam ? (
                        <button
                          onClick={() => router.push(`/provas-online/fazer/${prova.id}?briefing=true`)}
                          style={{
                            width: '100%',
                            height: 38,
                            borderRadius: 10,
                            border: 'none',
                            background: '#059669',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            cursor: 'pointer'
                          }}
                        >
                          <Flame size={15} /> Iniciar Prova
                        </button>
                      ) : studentInfo?.submetida ? (
                        <button
                          onClick={() => router.push(`/provas-online/fazer/${studentInfo.ultimaTentativa?.id}?comprovante=true`)}
                          style={{
                            width: '100%',
                            height: 36,
                            borderRadius: 10,
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            color: '#334155',
                            fontWeight: 700,
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            cursor: 'pointer'
                          }}
                        >
                          <FileText size={14} /> Ver Comprovante
                        </button>
                      ) : (
                        <button
                          disabled
                          style={{
                            width: '100%',
                            height: 36,
                            borderRadius: 10,
                            border: '1px solid #e2e8f0',
                            background: '#f1f5f9',
                            color: '#94a3b8',
                            fontWeight: 700,
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'not-allowed'
                          }}
                        >
                          Indisponível no Momento
                        </button>
                      )}
                    </div>
                  )}

                  {/* TEACHER ACTIONS */}
                  {isTeacherOrStaff && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                      {/* Primary Actions Row: Monitorar & Corrigir */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <button
                          onClick={() => router.push(`/provas-online/${prova.id}/monitorar`)}
                          style={{
                            flex: 1,
                            height: 38,
                            borderRadius: 10,
                            border: `1px solid ${isLive ? '#86efac' : '#e2e8f0'}`,
                            background: isLive ? '#ecfdf5' : '#ffffff',
                            color: isLive ? '#065f46' : '#334155',
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Activity size={14} style={{ color: isLive ? '#10b981' : '#64748b' }} className={isLive ? 'animate-pulse' : ''} />
                          <span>Supervisão</span>
                        </button>

                        <button
                          onClick={() => router.push(`/provas-online/${prova.id}/corrigir`)}
                          style={{
                            flex: 1,
                            height: 38,
                            borderRadius: 10,
                            border: prova.stats?.correcaoPendente > 0 ? 'none' : '1px solid #e2e8f0',
                            background: prova.stats?.correcaoPendente > 0 ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : prova.stats?.entregues > 0 ? '#f0fdf4' : '#ffffff',
                            color: prova.stats?.correcaoPendente > 0 ? '#ffffff' : prova.stats?.entregues > 0 ? '#166534' : '#334155',
                            fontSize: 12,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            boxShadow: prova.stats?.correcaoPendente > 0 ? '0 2px 6px rgba(2, 132, 199, 0.25)' : 'none'
                          }}
                        >
                          <CheckCircle2 size={14} style={{ color: prova.stats?.correcaoPendente > 0 ? '#ffffff' : prova.stats?.entregues > 0 ? '#16a34a' : '#64748b' }} />
                          <span>{prova.stats?.correcaoPendente > 0 ? 'Corrigir' : prova.stats?.entregues > 0 ? 'Ver Correções' : 'Corrigir'}</span>
                          {prova.stats?.correcaoPendente > 0 && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 900,
                              background: '#f59e0b',
                              color: '#ffffff',
                              padding: '1px 7px',
                              borderRadius: 99,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }}>
                              {prova.stats.correcaoPendente}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Secondary Quick Toolbar: Copiar Link, Relatório, Imprimir, Editar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, paddingTop: 4 }}>
                        <button
                          type="button"
                          onClick={() => handleCopyStudentLink(prova.id, prova.titulo)}
                          style={{
                            flex: 1,
                            height: 32,
                            borderRadius: 8,
                            border: `1px solid ${copiedId === prova.id ? '#a7f3d0' : '#e2e8f0'}`,
                            background: copiedId === prova.id ? '#ecfdf5' : '#f8fafc',
                            color: copiedId === prova.id ? '#065f46' : '#64748b',
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 5,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          title="Copiar link direto para estudantes"
                        >
                          {copiedId === prova.id ? <Check size={12} /> : <Link2 size={12} />}
                          <span>{copiedId === prova.id ? 'Copiado!' : 'Link'}</span>
                        </button>

                        <button
                          onClick={() => router.push(`/provas-online/${prova.id}/relatorio`)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title="Relatórios e Diário Oficial"
                        >
                          <BarChart3 size={13} />
                        </button>

                        <button
                          onClick={() => router.push(`/provas-online/${prova.id}/imprimir`)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title="Imprimir Caderno de Prova / Gabarito"
                        >
                          <Printer size={13} />
                        </button>

                        <button
                          onClick={() => router.push(`/provas-online/${prova.id}/editar`)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            background: '#f8fafc',
                            color: '#64748b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                          title="Editar Avaliação"
                        >
                          <Edit3 size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteProva(prova)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 8,
                            border: '1px solid #fee2e2',
                            background: '#fff1f2',
                            color: '#e11d48',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          title="Excluir Avaliação"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* RESPONSIBLE ACTIONS */}
                  {isResponsible && (
                    <button
                      onClick={() => router.push(`/provas-online/${prova.id}/relatorio`)}
                      style={{
                        width: '100%',
                        height: 36,
                        borderRadius: 10,
                        border: '1px solid #ddd6fe',
                        background: '#f5f3ff',
                        color: '#5b21b6',
                        fontWeight: 700,
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer'
                      }}
                    >
                      <Eye size={14} /> Ver Notas e Devolutivas
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* ── MODAL: CONFIRMAR EXCLUSÃO DE PROVA ────────────────────────────── */}
      <AnimatePresence>
        {deleteModalOpen && provaToDelete && (
          <div
            onClick={e => e.target === e.currentTarget && !deleting && setDeleteModalOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              background: 'rgba(15,23,42,0.5)',
              backdropFilter: 'blur(4px)'
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: 440,
                background: '#ffffff',
                borderRadius: 20,
                border: '1px solid #e2e8f0',
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: '#fee2e2', border: '1px solid #fca5a5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 size={24} style={{ color: '#dc2626' }} />
                </div>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>Excluir Avaliação</h2>
                  <p style={{ fontSize: 13, color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                    Tem certeza que deseja excluir permanentemente a avaliação{' '}
                    <strong style={{ color: '#0f172a' }}>"{provaToDelete.titulo}"</strong>?
                  </p>
                </div>
              </div>

              {provaToDelete.stats?.entregues > 0 && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fff1f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <AlertTriangle size={18} style={{ color: '#dc2626', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
                    <strong>Atenção:</strong> Esta prova possui <strong>{provaToDelete.stats.entregues} entrega(s)</strong> de alunos. Ao excluir, todas as tentativas, notas e gabaritos associados serão removidos permanentemente.
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => setDeleteModalOpen(false)}
                  disabled={deleting}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    background: '#ffffff',
                    color: '#334155',
                    fontWeight: 700,
                    fontSize: 12,
                    cursor: deleting ? 'not-allowed' : 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteProva}
                  disabled={deleting}
                  style={{
                    flex: 1,
                    height: 38,
                    borderRadius: 10,
                    border: 'none',
                    background: '#dc2626',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: deleting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    opacity: deleting ? 0.7 : 1
                  }}
                >
                  {deleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  Sim, Excluir Prova
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
