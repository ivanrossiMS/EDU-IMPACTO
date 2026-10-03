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
  const isResponsible = (cargo === 'Responsável' || perfil === 'Família' || perfil === 'Responsável') && !isStudent
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
    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchProvas()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchProvas()
      }
    }, 30000)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(interval)
    }
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

    const hasActiveFilters = Boolean(search || filterAnoLetivo || filterTurma || filterDisciplina || filterPeriodo)

    const handleClearFilters = () => {
      setSearch('')
      setFilterAnoLetivo('')
      setFilterTurma('')
      setFilterDisciplina('')
      setFilterPeriodo('')
    }

    return (
    <div className="po-page-container">
      {/* 0. RESPONSIVE CSS STYLES FOR MOBILE AND DESKTOP */}
      <style>{`
        .po-page-container {
          padding: 20px 20px 28px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          min-height: 100vh;
          background: #f8fafc;
          color: #0f172a;
          box-sizing: border-box;
        }

        /* 1. HERO HEADER */
        .po-hero {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          flex-wrap: wrap;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .po-hero-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
          flex-shrink: 0;
        }
        .po-hero-title {
          font-size: 20px;
          font-weight: 900;
          color: #0f172a;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .po-hero-badge {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 3px 8px;
          border-radius: 99px;
          background: #e0f2fe;
          color: #0369a1;
          border: 1px solid #bae6fd;
        }
        .po-hero-desc {
          font-size: 12px;
          color: #64748b;
          margin: 3px 0 0;
          font-weight: 500;
        }
        .po-hero-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .po-hero-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 36px;
          padding: 0 16px;
          border-radius: 10px;
          border: none;
          background: #0284c7;
          color: #ffffff;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(2, 132, 199, 0.3);
          transition: all 0.15s;
          white-space: nowrap;
        }
        .po-hero-btn-refresh {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
          flex-shrink: 0;
        }

        /* 2. KPI METRICS CARDS (DESKTOP: 4 cols, MOBILE: 2x2 compact grid) */
        .po-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .po-kpi-card {
          cursor: pointer;
          border-radius: 14px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 8px;
          background: #ffffff;
          transition: all 0.15s;
          box-sizing: border-box;
        }
        .po-kpi-label {
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .po-kpi-icon-box {
          width: 30px;
          height: 30px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .po-kpi-value {
          font-size: 26px;
          font-weight: 900;
          line-height: 1;
        }
        .po-kpi-sub {
          font-size: 11px;
          margin-top: 4px;
          font-weight: 500;
        }

        /* STUDENT METRICS */
        .po-student-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        .po-student-card {
          background: #ffffff;
          border-radius: 14px;
          padding: 14px 16px;
        }
        .po-student-val {
          font-size: 26px;
          font-weight: 900;
          margin-top: 4px;
        }

        /* 3. FILTERS BAR */
        .po-filters-box {
          padding: 10px 12px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
          width: 100%;
          box-sizing: border-box;
        }
        .po-filters-desktop-flex {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
        }
        .po-search-wrapper {
          position: relative;
          flex: 1 1 200px;
          min-width: 160px;
        }
        .po-search-input {
          width: 100%;
          height: 36px;
          padding-left: 34px;
          padding-right: 28px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          font-size: 12px;
          color: #0f172a;
          outline: none;
          box-sizing: border-box;
        }
        .po-select-grid {
          display: flex;
          align-items: center;
          gap: 6px;
          flex: 2 1 auto;
          flex-wrap: wrap;
        }
        .po-select-item {
          height: 36px;
          padding: 0 8px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 600;
          outline: none;
          cursor: pointer;
          box-sizing: border-box;
          min-width: 80px;
          flex: 1 1 auto;
          max-width: 160px;
        }
        .po-clear-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 36px;
          padding: 0 10px;
          border-radius: 8px;
          background: #fee2e2;
          border: 1px solid #fca5a5;
          color: #991b1b;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
          flex-shrink: 0;
          white-space: nowrap;
        }

        /* 4. EXAM CARDS GRID */
        .po-exam-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(min(100%, 310px), 1fr));
          gap: 14px;
        }
        .po-exam-card {
          background: #ffffff;
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          gap: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: all 0.15s;
          box-sizing: border-box;
        }
        .po-exam-title {
          font-size: 14.5px;
          font-weight: 800;
          color: #0f172a;
          margin: 0;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }
        .po-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 8px;
        }
        .po-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 7px;
          border-radius: 7px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-size: 11px;
          color: #334155;
          font-weight: 600;
        }
        .po-schedule-box {
          padding: 8px 10px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          gap: 3px;
          font-size: 11px;
          color: #64748b;
        }
        .po-progress-box {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 8px 10px;
          border-radius: 10px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          font-size: 11px;
        }
        .po-pending-widget {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 10px;
          border-radius: 10px;
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
          border: 1px solid #fde68a;
          box-shadow: 0 1px 2px rgba(245, 158, 11, 0.08);
          font-size: 11px;
        }
        .po-btn-primary {
          flex: 1;
          height: 36px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .po-btn-toolbar {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s;
        }
        .po-btn-link {
          flex: 1;
          height: 32px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s;
        }

        /* ── MOBILE ADAPTATIONS (<= 768px) ────────────────────────────────── */
        @media (max-width: 768px) {
          .po-page-container {
            padding: 10px 8px 14px;
            gap: 10px;
          }

          /* HERO HEADER COMPACT */
          .po-hero {
            padding: 10px 12px;
            border-radius: 12px;
            gap: 8px;
          }
          .po-hero-icon-box {
            width: 34px;
            height: 34px;
            border-radius: 9px;
          }
          .po-hero-title {
            font-size: 16px;
          }
          .po-hero-badge {
            font-size: 9px;
            padding: 2px 6px;
          }
          .po-hero-desc {
            font-size: 10.5px;
            margin-top: 2px;
            line-height: 1.3;
          }
          .po-hero-btn {
            height: 30px;
            padding: 0 10px;
            font-size: 11px;
            border-radius: 8px;
            gap: 4px;
          }
          .po-hero-btn-refresh {
            width: 30px;
            height: 30px;
            border-radius: 8px;
          }

          /* KPI CARDS: 2x2 COMPACT GRID */
          .po-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 6px;
          }
          .po-kpi-card {
            padding: 8px 10px;
            border-radius: 10px;
            gap: 4px;
          }
          .po-kpi-label {
            font-size: 9px;
            letter-spacing: 0.02em;
          }
          .po-kpi-icon-box {
            width: 22px;
            height: 22px;
            border-radius: 6px;
          }
          .po-kpi-value {
            font-size: 19px;
          }
          .po-kpi-sub {
            font-size: 9px;
            margin-top: 2px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          /* STUDENT METRICS: 2x2 COMPACT GRID */
          .po-student-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 6px;
          }
          .po-student-card {
            padding: 8px 10px;
            border-radius: 10px;
          }
          .po-student-val {
            font-size: 19px;
            margin-top: 2px;
          }

          /* FILTERS: ROW 1 (SEARCH + CLEAR), ROW 2 (4 EQUAL FILTER DROPDOWNS) */
          .po-filters-box {
            padding: 7px 8px;
            border-radius: 10px;
            gap: 6px;
          }
          .po-filters-desktop-flex {
            flex-direction: column;
            align-items: stretch;
            gap: 6px;
          }
          .po-filters-top-row {
            display: flex;
            align-items: center;
            gap: 6px;
            width: 100%;
          }
          .po-search-wrapper {
            flex: 1;
            min-width: 0;
          }
          .po-search-input {
            height: 31px;
            padding-left: 28px;
            padding-right: 24px;
            font-size: 11px;
            border-radius: 7px;
          }
          .po-clear-btn {
            height: 31px;
            padding: 0 8px;
            font-size: 10px;
            border-radius: 7px;
            gap: 3px;
          }
          .po-select-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 4px;
            width: 100%;
            flex: none;
          }
          .po-select-item {
            height: 28px;
            padding: 0 3px;
            font-size: 9.5px;
            border-radius: 6px;
            min-width: 0;
            max-width: none;
            width: 100%;
            text-align: center;
          }

          /* EXAM CARDS: COMPACT & PROPORTIONAL */
          .po-exam-grid {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .po-exam-card {
            padding: 10px 11px;
            border-radius: 12px;
            gap: 8px;
          }
          .po-exam-title {
            font-size: 13.5px;
          }
          .po-badge {
            font-size: 9.5px;
            padding: 2px 6px;
            border-radius: 6px;
          }
          .po-chip {
            font-size: 9.5px;
            padding: 2px 5px;
            border-radius: 6px;
            gap: 3px;
          }
          .po-schedule-box {
            padding: 6px 8px;
            font-size: 9.5px;
            border-radius: 8px;
            gap: 2px;
          }
          .po-progress-box {
            padding: 6px 8px;
            border-radius: 8px;
            gap: 4px;
            font-size: 9.5px;
          }
          .po-pending-widget {
            padding: 5px 8px;
            border-radius: 8px;
            font-size: 9.5px;
          }
          .po-btn-primary {
            height: 32px;
            font-size: 11px;
            border-radius: 8px;
          }
          .po-btn-toolbar {
            height: 28px;
            width: 28px;
            border-radius: 6px;
          }
          .po-btn-link {
            height: 28px;
            font-size: 10px;
            border-radius: 6px;
          }
        }
      `}</style>
      
      {/* 1. HERO HEADER */}
      <div className="po-hero">
        {/* Title and subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: '1 1 auto' }}>
          <div className="po-hero-icon-box">
            <FileCheck2 size={20} />
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <h1 className="po-hero-title">
                Provas Online
              </h1>
              <span className="po-hero-badge">
                Módulo Oficial
              </span>
            </div>
            <p className="po-hero-desc">
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
          <div className="po-hero-actions">
            <button
              onClick={() => router.push('/provas-online/nova')}
              className="po-hero-btn"
            >
              <Plus size={15} strokeWidth={3} />
              <span>Nova Avaliação</span>
            </button>

            <button
              onClick={fetchProvas}
              disabled={refreshing}
              title="Atualizar lista"
              className="po-hero-btn-refresh"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        )}
      </div>

      {/* 2. KPI METRICS CARDS (Compact 2x2 on Mobile, 4 columns on Desktop) */}
      {isTeacherOrStaff && (
        <div className="po-kpi-grid">
          {/* Total Provas */}
          <div
            onClick={() => setActiveTab('todas')}
            className="po-kpi-card"
            style={{
              border: `1px solid ${activeTab === 'todas' ? '#0284c7' : '#e2e8f0'}`,
              boxShadow: activeTab === 'todas' ? '0 0 0 2px rgba(2,132,199,0.15)' : '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="po-kpi-label" style={{ color: '#64748b' }}>
                Total de Provas
              </span>
              <div className="po-kpi-icon-box" style={{ background: '#f1f5f9' }}>
                <FileCheck2 size={14} style={{ color: '#0284c7' }} />
              </div>
            </div>
            <div>
              <div className="po-kpi-value" style={{ color: '#0f172a' }}>{tabCounts.todas}</div>
              <div className="po-kpi-sub" style={{ color: '#94a3b8' }}>Todas as avaliações</div>
            </div>
          </div>

          {/* Em Aplicação */}
          <div
            onClick={() => setActiveTab('em_aplicacao')}
            className="po-kpi-card"
            style={{
              border: `1px solid ${activeTab === 'em_aplicacao' ? '#10b981' : '#e2e8f0'}`,
              boxShadow: activeTab === 'em_aplicacao' ? '0 0 0 2px rgba(16,185,129,0.15)' : '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="po-kpi-label" style={{ color: '#065f46', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} className="animate-ping" />
                Em Aplicação
              </span>
              <div className="po-kpi-icon-box" style={{ background: '#d1fae5' }}>
                <Activity size={14} style={{ color: '#059669' }} />
              </div>
            </div>
            <div>
              <div className="po-kpi-value" style={{ color: '#059669' }}>{tabCounts.em_aplicacao}</div>
              <div className="po-kpi-sub" style={{ color: '#10b981', fontWeight: 600 }}>Supervisão ao vivo</div>
            </div>
          </div>

          {/* Fila de Correção */}
          <div
            onClick={() => setActiveTab('correcao')}
            className="po-kpi-card"
            style={{
              border: `1px solid ${activeTab === 'correcao' ? '#f59e0b' : '#e2e8f0'}`,
              boxShadow: activeTab === 'correcao' ? '0 0 0 2px rgba(245,158,11,0.15)' : '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="po-kpi-label" style={{ color: '#92400e' }}>
                Fila Correção
              </span>
              <div className="po-kpi-icon-box" style={{ background: '#fef3c7' }}>
                <Clock size={14} style={{ color: '#b45309' }} />
              </div>
            </div>
            <div>
              <div className="po-kpi-value" style={{ color: '#b45309' }}>{tabCounts.correcao}</div>
              <div className="po-kpi-sub" style={{ color: '#b45309', fontWeight: 600 }}>Dissertativas pend.</div>
            </div>
          </div>

          {/* Resultados Publicados */}
          <div
            onClick={() => setActiveTab('publicada')}
            className="po-kpi-card"
            style={{
              border: `1px solid ${activeTab === 'publicada' ? '#8b5cf6' : '#e2e8f0'}`,
              boxShadow: activeTab === 'publicada' ? '0 0 0 2px rgba(139,92,246,0.15)' : '0 1px 3px rgba(0,0,0,0.03)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="po-kpi-label" style={{ color: '#5b21b6' }}>
                Resultados
              </span>
              <div className="po-kpi-icon-box" style={{ background: '#ede9fe' }}>
                <Award size={14} style={{ color: '#7c3aed' }} />
              </div>
            </div>
            <div>
              <div className="po-kpi-value" style={{ color: '#7c3aed' }}>{tabCounts.publicada}</div>
              <div className="po-kpi-sub" style={{ color: '#7c3aed', fontWeight: 600 }}>Gabaritos divulgados</div>
            </div>
          </div>
        </div>
      )}

      {/* Student Metrics */}
      {isStudent && studentMetrics && (
        <div className="po-student-grid">
          <div className="po-student-card" style={{ border: '1px solid #bbf7d0' }}>
            <span className="po-kpi-label" style={{ color: '#166534' }}>Disponíveis</span>
            <div className="po-student-val" style={{ color: '#16a34a' }}>{studentMetrics.disponiveis}</div>
          </div>
          <div className="po-student-card" style={{ border: '1px solid #ddd6fe' }}>
            <span className="po-kpi-label" style={{ color: '#5b21b6' }}>Em Andamento</span>
            <div className="po-student-val" style={{ color: '#7c3aed' }}>{studentMetrics.emAndamento}</div>
          </div>
          <div className="po-student-card" style={{ border: '1px solid #bae6fd' }}>
            <span className="po-kpi-label" style={{ color: '#0369a1' }}>Entregues</span>
            <div className="po-student-val" style={{ color: '#0284c7' }}>{studentMetrics.entregues}</div>
          </div>
          <div className="po-student-card" style={{ border: '1px solid #fbcfe8' }}>
            <span className="po-kpi-label" style={{ color: '#9d174d' }}>Notas Liberadas</span>
            <div className="po-student-val" style={{ color: '#db2777' }}>{studentMetrics.resultados}</div>
          </div>
        </div>
      )}

      {/* 3. SEARCH & FILTERS BAR (Compact text to fit all 4 dropdowns seamlessly) */}
      <div className="po-filters-box">
        <div className="po-filters-desktop-flex">
          {/* Top row: search + clear button */}
          <div className="po-filters-top-row">
            <div className="po-search-wrapper">
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Buscar prova, matéria ou professor..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="po-search-input"
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
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Clear filters button */}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="po-clear-btn"
                title="Limpar todos os filtros"
              >
                <X size={12} /> Limpar
              </button>
            )}
          </div>

          {/* 4 Equal Filter Dropdowns (Ano, Turma, Disciplina, Bimestre) */}
          <div className="po-select-grid">
            {/* Ano filter */}
            <select
              value={filterAnoLetivo}
              onChange={e => setFilterAnoLetivo(e.target.value)}
              className="po-select-item"
              title="Filtrar por Ano Letivo"
              style={{
                border: `1px solid ${filterAnoLetivo ? '#0284c7' : '#e2e8f0'}`,
                background: filterAnoLetivo ? '#e0f2fe' : '#f8fafc',
                color: filterAnoLetivo ? '#0369a1' : '#334155'
              }}
            >
              <option value="">Ano</option>
              {anosLetivosList.map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            {/* Turma filter */}
            <select
              value={filterTurma}
              onChange={e => setFilterTurma(e.target.value)}
              className="po-select-item"
              title="Filtrar por Turma"
              style={{
                border: `1px solid ${filterTurma ? '#0284c7' : '#e2e8f0'}`,
                background: filterTurma ? '#e0f2fe' : '#f8fafc',
                color: filterTurma ? '#0369a1' : '#334155'
              }}
            >
              <option value="">Turma</option>
              {turmasList.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>

            {/* Disciplina filter */}
            <select
              value={filterDisciplina}
              onChange={e => setFilterDisciplina(e.target.value)}
              className="po-select-item"
              title="Filtrar por Disciplina"
              style={{
                border: `1px solid ${filterDisciplina ? '#0284c7' : '#e2e8f0'}`,
                background: filterDisciplina ? '#e0f2fe' : '#f8fafc',
                color: filterDisciplina ? '#0369a1' : '#334155'
              }}
            >
              <option value="">Disciplina</option>
              {disciplinasList.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Bimestre filter */}
            <select
              value={filterPeriodo}
              onChange={e => setFilterPeriodo(e.target.value)}
              className="po-select-item"
              title="Filtrar por Bimestre"
              style={{
                border: `1px solid ${filterPeriodo ? '#0284c7' : '#e2e8f0'}`,
                background: filterPeriodo ? '#e0f2fe' : '#f8fafc',
                color: filterPeriodo ? '#0369a1' : '#334155'
              }}
            >
              <option value="">Bimestre</option>
              <option value="1">1º Bim</option>
              <option value="2">2º Bim</option>
              <option value="3">3º Bim</option>
              <option value="4">4º Bim</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. MAIN EXAM CARDS GRID */}
      {loading ? (
        <div style={{ padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <RefreshCw size={18} style={{ color: '#0284c7' }} className="animate-spin" />
          </div>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Carregando avaliações...</span>
        </div>
      ) : filteredProvas.length === 0 ? (
        <div style={{ padding: '48px 20px', borderRadius: 16, background: '#ffffff', border: '1px solid #e2e8f0', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f0f9ff', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BookOpen size={22} style={{ color: '#0284c7' }} />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', margin: '0 0 3px' }}>Nenhuma avaliação encontrada</h3>
            <p style={{ fontSize: 11.5, color: '#64748b', margin: 0 }}>Nenhuma prova corresponde aos filtros selecionados.</p>
          </div>
          {isTeacherOrStaff && (
            <button
              onClick={() => router.push('/provas-online/nova')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 34,
                padding: '0 14px',
                borderRadius: 8,
                border: 'none',
                background: '#0284c7',
                color: '#ffffff',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Plus size={14} /> Criar Nova Avaliação
            </button>
          )}
        </div>
      ) : (
        <div className="po-exam-grid">
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
                className="po-exam-card"
                style={{
                  border: `1px solid ${isLive ? '#86efac' : '#e2e8f0'}`
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Top Header: Subject + Period + Year + Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      <span className="po-badge" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}>
                        {prova.disciplina || 'Geral'}
                      </span>
                      <span className="po-badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                        {prova.bimestre ? `${prova.bimestre}º Bim` : 'Geral'}
                      </span>
                      <span className="po-badge" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#64748b', fontFamily: 'monospace' }}>
                        {prova.anoLetivo || (prova.dataAbertura ? new Date(prova.dataAbertura).getFullYear() : '2026')}
                      </span>
                    </div>

                    {getStatusBadge(prova.status)}
                  </div>

                  {/* Exam Title */}
                  <h3 className="po-exam-title" title={prova.titulo}>
                    {prova.titulo}
                  </h3>

                  {/* Chips: Duration, Questions, Turmas */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    <span className="po-chip">
                      <Clock size={11} style={{ color: '#0284c7' }} />
                      {prova.duracaoMinutos} min
                    </span>

                    <span className="po-chip">
                      <FileCheck2 size={11} style={{ color: '#0284c7' }} />
                      {questionsCount} quest. ({prova.valorTotal || 10} pts)
                    </span>

                    <span className="po-chip" style={{ color: '#64748b', fontWeight: 500 }}>
                      <Layers size={11} style={{ color: '#94a3b8' }} />
                      Turma: {(prova.turmas || []).join(', ') || 'Todas'}
                    </span>
                  </div>

                  {/* Schedule Box */}
                  <div className="po-schedule-box">
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div className="po-progress-box">
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>Entregas Realizadas</span>
                          <strong style={{ color: '#0369a1', fontFamily: 'monospace' }}>
                            {prova.stats?.entregues || 0} entregas
                          </strong>
                        </div>
                        <div style={{ height: 4, borderRadius: 99, background: '#e2e8f0', overflow: 'hidden' }}>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#059669', fontWeight: 700 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} className="animate-pulse" />
                            <span>{prova.stats.emAndamento} aluno(s) fazendo agora</span>
                          </div>
                        )}
                      </div>

                      {/* ULTRA-MODERN PENDING CORRECTIONS WIDGET */}
                      {prova.stats?.correcaoPendente > 0 ? (
                        <div className="po-pending-widget">
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ position: 'relative', display: 'flex', width: 7, height: 7 }}>
                              <span className="animate-ping" style={{ position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '50%', background: '#f59e0b', opacity: 0.75 }} />
                              <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', width: 7, height: 7, background: '#d97706' }} />
                            </span>
                            <span style={{ fontWeight: 800, color: '#92400e', letterSpacing: '0.01em' }}>
                              Faltam Corrigir:
                            </span>
                          </div>
                          <span style={{
                            fontWeight: 900,
                            fontFamily: 'monospace',
                            background: '#f59e0b',
                            color: '#ffffff',
                            padding: '1px 6px',
                            borderRadius: 99,
                            boxShadow: '0 1px 3px rgba(245, 158, 11, 0.35)'
                          }}>
                            {prova.stats.correcaoPendente} {prova.stats.correcaoPendente === 1 ? 'avaliação' : 'avaliações'}
                          </span>
                        </div>
                      ) : (prova.stats?.entregues > 0) ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: 10,
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          fontSize: 10.5
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#166534', fontWeight: 700 }}>
                            <CheckCircle2 size={12} style={{ color: '#16a34a' }} />
                            <span>Correções Concluídas</span>
                          </div>
                          <span style={{
                            fontWeight: 800,
                            background: '#dcfce7',
                            color: '#15803d',
                            padding: '1px 6px',
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
                    <div style={{ padding: '8px 10px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: 11 }}>
                      {studentInfo?.submetida ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#16a34a', fontWeight: 700 }}>
                            <CheckCircle2 size={13} /> Prova Entregue
                          </div>
                          {studentInfo.resultadoLiberado ? (
                            <div style={{ marginTop: 3, fontSize: 12, fontWeight: 900, color: '#0f172a' }}>
                              Nota: <span style={{ color: '#16a34a' }}>{studentInfo.ultimaTentativa?.notaFinal} / {prova.valorTotal}</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                              Aguardando liberação do gabarito.
                            </div>
                          )}
                        </div>
                      ) : hasActiveAttempt ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#7c3aed', fontWeight: 700 }}>
                          <Timer size={13} className="animate-pulse" /> Tentativa em andamento
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#64748b' }}>
                          <Clock size={12} />
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
                <div style={{ paddingTop: 10, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* STUDENT ACTIONS */}
                  {isStudent && (
                    <div style={{ width: '100%' }}>
                      {hasActiveAttempt ? (
                        <button
                          onClick={() => router.push(`/provas-online/fazer/${studentInfo.tentativaAtivaId}`)}
                          className="po-btn-primary"
                          style={{
                            width: '100%',
                            border: 'none',
                            background: '#7c3aed',
                            color: '#ffffff'
                          }}
                        >
                          <Timer size={14} /> Continuar Prova
                        </button>
                      ) : canTakeExam ? (
                        <button
                          onClick={() => router.push(`/provas-online/fazer/${prova.id}?briefing=true`)}
                          className="po-btn-primary"
                          style={{
                            width: '100%',
                            border: 'none',
                            background: '#059669',
                            color: '#ffffff'
                          }}
                        >
                          <Flame size={14} /> Iniciar Prova
                        </button>
                      ) : studentInfo?.submetida ? (
                        <button
                          onClick={() => router.push(`/provas-online/fazer/${studentInfo.ultimaTentativa?.id}?comprovante=true`)}
                          className="po-btn-primary"
                          style={{
                            width: '100%',
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            color: '#334155'
                          }}
                        >
                          <FileText size={13} /> Ver Comprovante
                        </button>
                      ) : (
                        <button
                          disabled
                          className="po-btn-primary"
                          style={{
                            width: '100%',
                            border: '1px solid #e2e8f0',
                            background: '#f1f5f9',
                            color: '#94a3b8',
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                      {/* Primary Actions Row: Monitorar & Corrigir */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
                        <button
                          onClick={() => router.push(`/provas-online/${prova.id}/monitorar`)}
                          className="po-btn-primary"
                          style={{
                            border: `1px solid ${isLive ? '#86efac' : '#e2e8f0'}`,
                            background: isLive ? '#ecfdf5' : '#ffffff',
                            color: isLive ? '#065f46' : '#334155'
                          }}
                        >
                          <Activity size={13} style={{ color: isLive ? '#10b981' : '#64748b' }} className={isLive ? 'animate-pulse' : ''} />
                          <span>Supervisão</span>
                        </button>

                        <button
                          onClick={() => router.push(`/provas-online/${prova.id}/corrigir`)}
                          className="po-btn-primary"
                          style={{
                            border: prova.stats?.correcaoPendente > 0 ? 'none' : '1px solid #e2e8f0',
                            background: prova.stats?.correcaoPendente > 0 ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : prova.stats?.entregues > 0 ? '#f0fdf4' : '#ffffff',
                            color: prova.stats?.correcaoPendente > 0 ? '#ffffff' : prova.stats?.entregues > 0 ? '#166534' : '#334155',
                            boxShadow: prova.stats?.correcaoPendente > 0 ? '0 2px 6px rgba(2, 132, 199, 0.25)' : 'none'
                          }}
                        >
                          <CheckCircle2 size={13} style={{ color: prova.stats?.correcaoPendente > 0 ? '#ffffff' : prova.stats?.entregues > 0 ? '#16a34a' : '#64748b' }} />
                          <span>{prova.stats?.correcaoPendente > 0 ? 'Corrigir' : prova.stats?.entregues > 0 ? 'Ver Correções' : 'Corrigir'}</span>
                          {prova.stats?.correcaoPendente > 0 && (
                            <span style={{
                              fontSize: 9.5,
                              fontWeight: 900,
                              background: '#f59e0b',
                              color: '#ffffff',
                              padding: '1px 5px',
                              borderRadius: 99,
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }}>
                              {prova.stats.correcaoPendente}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* Secondary Quick Toolbar: Copiar Link, Relatório, Imprimir, Editar, Excluir */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 5, paddingTop: 2 }}>
                        <button
                          type="button"
                          onClick={() => handleCopyStudentLink(prova.id, prova.titulo)}
                          className="po-btn-link"
                          style={{
                            border: `1px solid ${copiedId === prova.id ? '#a7f3d0' : '#e2e8f0'}`,
                            background: copiedId === prova.id ? '#ecfdf5' : '#f8fafc',
                            color: copiedId === prova.id ? '#065f46' : '#64748b'
                          }}
                          title="Copiar link direto para estudantes"
                        >
                          {copiedId === prova.id ? <Check size={11} /> : <Link2 size={11} />}
                          <span>{copiedId === prova.id ? 'Copiado!' : 'Link Alunos'}</span>
                        </button>

                        <button
                          onClick={() => router.push(`/provas-online/${prova.id}/relatorio`)}
                          className="po-btn-toolbar"
                          title="Relatórios e Diário Oficial"
                        >
                          <BarChart3 size={12} />
                        </button>

                        <button
                          onClick={() => router.push(`/provas-online/${prova.id}/imprimir`)}
                          className="po-btn-toolbar"
                          title="Imprimir Caderno de Prova / Gabarito"
                        >
                          <Printer size={12} />
                        </button>

                        <button
                          onClick={() => router.push(`/provas-online/${prova.id}/editar`)}
                          className="po-btn-toolbar"
                          title="Editar Avaliação"
                        >
                          <Edit3 size={12} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteProva(prova)}
                          className="po-btn-toolbar"
                          style={{
                            border: '1px solid #fee2e2',
                            background: '#fff1f2',
                            color: '#e11d48'
                          }}
                          title="Excluir Avaliação"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* RESPONSIBLE ACTIONS */}
                  {isResponsible && (
                    <button
                      onClick={() => router.push(`/provas-online/${prova.id}/relatorio`)}
                      className="po-btn-primary"
                      style={{
                        width: '100%',
                        border: '1px solid #ddd6fe',
                        background: '#f5f3ff',
                        color: '#5b21b6'
                      }}
                    >
                      <Eye size={13} /> Ver Notas e Devolutivas
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
