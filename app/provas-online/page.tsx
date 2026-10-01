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
  GraduationCap, AlertCircle, Printer
} from 'lucide-react'
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
  const [filterTurma, setFilterTurma] = useState('')
  const [filterDisciplina, setFilterDisciplina] = useState('')
  const [filterPeriodo, setFilterPeriodo] = useState('')

  // Determine user role
  const cargo = currentUser?.cargo || ''
  const perfil = currentUser?.perfil || ''
  const isStudent = cargo === 'Aluno' || perfil === 'Aluno' || Boolean(currentUser?.aluno_id && cargo !== 'Responsável')
  const isResponsible = cargo === 'Responsável' || perfil === 'Família' || perfil === 'Responsável'
  const isTeacherOrStaff = !isStudent && !isResponsible

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

  // Options for filters
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
      if (filterTurma && !(p.turmas || []).includes(filterTurma)) return false
      if (filterDisciplina && p.disciplina !== filterDisciplina) return false
      if (filterPeriodo && String(p.bimestre) !== filterPeriodo) return false

      return true
    })
  }, [provas, activeTab, search, filterTurma, filterDisciplina, filterPeriodo])

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
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 800,
            background: '#ecfdf5',
            color: '#059669',
            border: '1px solid #a7f3d0'
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
            Em Aplicação
          </span>
        )
      case 'agendada':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            background: '#eff6ff',
            color: '#2563eb',
            border: '1px solid #bfdbfe'
          }}>
            <Calendar size={12} />
            Agendada
          </span>
        )
      case 'rascunho':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            background: '#fffbeb',
            color: '#d97706',
            border: '1px solid #fde68a'
          }}>
            <FileText size={12} />
            Rascunho
          </span>
        )
      case 'encerrada':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            background: '#f1f5f9',
            color: '#64748b',
            border: '1px solid #e2e8f0'
          }}>
            <Clock size={12} />
            Encerrada
          </span>
        )
      case 'publicada':
        return (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 800,
            background: '#f0fdfa',
            color: '#0d9488',
            border: '1px solid #99f6e4'
          }}>
            <Award size={12} />
            Resultados Publicados
          </span>
        )
      default:
        return (
          <span style={{
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            background: '#f1f5f9',
            color: '#64748b'
          }}>
            {status}
          </span>
        )
    }
  }

  return (
    <div style={{ padding: '32px 32px', display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1400, margin: '0 auto' }}>
      
      {/* 1. HERO HEADER (CLEAN & LIGHT) */}
      <div style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 24,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        padding: '28px 32px',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 24
      }}>
        {/* Title and subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, minWidth: 280 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(2, 132, 199, 0.25)',
            flexShrink: 0
          }}>
            <FileCheck2 size={28} color="#ffffff" />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 900,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                lineHeight: 1.2
              }}>
                Provas Online
              </h1>
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                padding: '3px 9px',
                borderRadius: 20,
                background: '#e0f2fe',
                color: '#0284c7',
                border: '1px solid #bae6fd'
              }}>
                Módulo Oficial
              </span>
            </div>
            <p style={{
              margin: '6px 0 0',
              fontSize: 13,
              color: '#64748b',
              fontWeight: 500,
              maxWidth: 620
            }}>
              {isStudent
                ? 'Ambiente de avaliação individual, seguro e auditado com sincronização em tempo real.'
                : isResponsible
                ? 'Acompanhamento detalhado de desempenho, resultados e devolutivas dos dependentes.'
                : 'Gestão de provas, aplicação supervisionada, monitoramento em tempo real e correção automatizada.'}
            </p>
          </div>
        </div>

        {/* Action buttons (Teachers / Admins) */}
        {isTeacherOrStaff && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => router.push('/provas-online/nova')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                borderRadius: 14,
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                border: 'none',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 6px 16px rgba(2, 132, 199, 0.28)'
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(2, 132, 199, 0.35)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(2, 132, 199, 0.28)' }}
            >
              <Plus size={18} strokeWidth={3} />
              Nova Avaliação
            </button>

            <button
              onClick={fetchProvas}
              disabled={refreshing}
              title="Atualizar lista"
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#0284c7'; e.currentTarget.style.borderColor = '#0284c7' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#cbd5e1' }}
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        )}
      </div>

      {/* 2. KPI METRICS CARDS (LIGHT & SPACIOUS) */}
      {isTeacherOrStaff && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16
        }}>
          {/* Total Provas */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: 20,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Total de Avaliações
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileCheck2 size={18} color="#2563eb" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                {tabCounts.todas}
              </div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                Todas as disciplinas cadastradas
              </div>
            </div>
          </div>

          {/* Em Aplicação */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #a7f3d0',
            borderRadius: 20,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 10px rgba(16, 185, 129, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Em Aplicação Agora
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={18} color="#059669" className="animate-pulse" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#059669', lineHeight: 1 }}>
                {tabCounts.em_aplicacao}
              </div>
              <div style={{ fontSize: 12, color: '#10b981', marginTop: 4, fontWeight: 600 }}>
                Monitoramento ao vivo ativo
              </div>
            </div>
          </div>

          {/* Correções Pendentes */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #fde68a',
            borderRadius: 20,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 10px rgba(245, 158, 11, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Correções Pendentes
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={18} color="#d97706" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#d97706', lineHeight: 1 }}>
                {tabCounts.correcao}
              </div>
              <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>
                Dissertativas para pontuar
              </div>
            </div>
          </div>

          {/* Resultados Publicados */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #e9d5ff',
            borderRadius: 20,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 10px rgba(168, 85, 247, 0.08)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#7e22ce', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Resultados Publicados
              </span>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: '#faf5ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={18} color="#7e22ce" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#7e22ce', lineHeight: 1 }}>
                {tabCounts.publicada}
              </div>
              <div style={{ fontSize: 12, color: '#9333ea', marginTop: 4, fontWeight: 600 }}>
                Notas e boletins divulgados
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Metrics (Light) */}
      {isStudent && studentMetrics && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #a7f3d0',
            borderRadius: 20,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Disponíveis para Iniciar</span>
              <CheckCircle2 size={18} color="#059669" />
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#059669' }}>{studentMetrics.disponiveis}</div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #e9d5ff',
            borderRadius: 20,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#7e22ce', textTransform: 'uppercase' }}>Em Andamento</span>
              <Timer size={18} color="#7e22ce" />
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#7e22ce' }}>{studentMetrics.emAndamento}</div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #bfdbfe',
            borderRadius: 20,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#2563eb', textTransform: 'uppercase' }}>Provas Entregues</span>
              <FileCheck2 size={18} color="#2563eb" />
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#2563eb' }}>{studentMetrics.entregues}</div>
          </div>

          <div style={{
            background: '#ffffff',
            border: '1px solid #fbcfe8',
            borderRadius: 20,
            padding: '20px 22px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            boxShadow: '0 2px 10px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#db2777', textTransform: 'uppercase' }}>Notas Divulgadas</span>
              <Award size={18} color="#db2777" />
            </div>
            <div style={{ fontSize: 32, fontWeight: 900, color: '#db2777' }}>{studentMetrics.resultados}</div>
          </div>
        </div>
      )}

      {/* Responsible Mode Notice */}
      {isResponsible && (
        <div style={{
          padding: '16px 20px',
          borderRadius: 16,
          background: '#faf5ff',
          border: '1px solid #e9d5ff',
          display: 'flex',
          alignItems: 'center',
          gap: 14
        }}>
          <Shield size={24} color="#7e22ce" style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#581c87' }}>
              Visualização de Responsável (Modo Acompanhamento)
            </div>
            <div style={{ fontSize: 12, color: '#6b21a8', marginTop: 2 }}>
              A realização da prova deve ocorrer exclusivamente na conta do aluno. Aqui você acompanha as provas realizadas e as devolutivas liberadas.
            </div>
          </div>
        </div>
      )}

      {/* 3. TABS & FILTERS (LIGHT & CLEAN) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        
        {/* Navigation Tabs */}
        {isTeacherOrStaff && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            overflowX: 'auto',
            padding: 4,
            background: '#e2e8f0',
            borderRadius: 16
          }} className="no-scrollbar">
            {[
              { id: 'todas', label: 'Todas as Provas', count: tabCounts.todas },
              { id: 'em_aplicacao', label: 'Em Aplicação', count: tabCounts.em_aplicacao, isLive: true },
              { id: 'agendada', label: 'Agendadas', count: tabCounts.agendada },
              { id: 'rascunho', label: 'Rascunhos', count: tabCounts.rascunho },
              { id: 'correcao', label: 'Correção Pendente', count: tabCounts.correcao },
              { id: 'encerrada', label: 'Encerradas', count: tabCounts.encerrada },
              { id: 'publicada', label: 'Publicadas', count: tabCounts.publicada },
            ].map(tab => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 14px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: active ? 800 : 600,
                    cursor: 'pointer',
                    border: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s',
                    background: active ? '#ffffff' : 'transparent',
                    color: active ? '#0284c7' : '#475569',
                    boxShadow: active ? '0 2px 8px rgba(0, 0, 0, 0.08)' : 'none'
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)'
                      e.currentTarget.style.color = '#0f172a'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = '#475569'
                    }
                  }}
                >
                  {tab.isLive && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                  )}
                  {tab.label}
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 10,
                    background: active ? '#e0f2fe' : 'rgba(0, 0, 0, 0.06)',
                    color: active ? '#0284c7' : '#64748b'
                  }}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Filter Toolbar (Search + Selects) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          padding: 14,
          borderRadius: 18,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)'
        }}>
          {/* Search bar */}
          <div style={{ position: 'relative', minWidth: 220 }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Buscar por título, matéria, professor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                height: 40,
                paddingLeft: 38,
                paddingRight: 12,
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                fontSize: 13,
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#0284c7'}
              onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
            />
          </div>

          {/* Turma filter */}
          {turmasList.length > 0 && (
            <select
              value={filterTurma}
              onChange={e => setFilterTurma(e.target.value)}
              style={{
                height: 40,
                padding: '0 12px',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: filterTurma ? '#0284c7' : '#334155',
                fontSize: 13,
                outline: 'none',
                cursor: 'pointer'
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
                height: 40,
                padding: '0 12px',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: filterDisciplina ? '#0284c7' : '#334155',
                fontSize: 13,
                outline: 'none',
                cursor: 'pointer'
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
              height: 40,
              padding: '0 12px',
              borderRadius: 10,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: filterPeriodo ? '#0284c7' : '#334155',
              fontSize: 13,
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

          {/* Reset button if filter is active */}
          {(search || filterTurma || filterDisciplina || filterPeriodo) && (
            <button
              onClick={() => {
                setSearch('')
                setFilterTurma('')
                setFilterDisciplina('')
                setFilterPeriodo('')
              }}
              style={{
                height: 40,
                padding: '0 14px',
                borderRadius: 10,
                background: '#fee2e2',
                border: '1px solid #fca5a5',
                color: '#dc2626',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer'
              }}
            >
              <X size={14} /> Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* 4. MAIN EXAM CARDS GRID (LIGHT & ELEGANT) */}
      {loading ? (
        <div style={{
          padding: '80px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16
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
            Carregando avaliações...
          </span>
          <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        </div>
      ) : filteredProvas.length === 0 ? (
        <div style={{
          padding: '60px 24px',
          borderRadius: 24,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28
          }}>
            📋
          </div>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Nenhuma avaliação encontrada
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0', maxWidth: 440 }}>
              Não há provas correspondentes aos filtros selecionados ou nenhuma prova foi agendada para o seu perfil no momento.
            </p>
          </div>
          {isTeacherOrStaff && (
            <button
              onClick={() => router.push('/provas-online/nova')}
              style={{
                marginTop: 8,
                padding: '10px 20px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                border: 'none',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.25)'
              }}
            >
              <Plus size={16} /> Criar Nova Avaliação
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 24
        }}>
          {filteredProvas.map(prova => {
            const openDate = new Date(prova.dataAbertura)
            const closeDate = new Date(prova.dataEncerramento)
            const questionsCount = (prova.questoes || []).length
            const isLive = prova.status === 'em_aplicacao'

            // Student specific status tags
            const studentInfo = prova.studentInfo
            const canTakeExam = isStudent && isLive && (!studentInfo?.submetida || studentInfo?.tentativasRealizadas < prova.quantidadeTentativas)
            const hasActiveAttempt = Boolean(studentInfo?.tentativaAtivaId)

            return (
              <motion.div
                key={prova.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  borderRadius: 22,
                  background: isLive
                    ? 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 35%)'
                    : '#ffffff',
                  border: isLive
                    ? '1px solid #86efac'
                    : '1px solid #e2e8f0',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 18,
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.25s ease',
                  boxShadow: isLive
                    ? '0 6px 20px rgba(16, 185, 129, 0.12)'
                    : '0 4px 16px -2px rgba(0, 0, 0, 0.05)'
                }}
                whileHover={{
                  y: -4,
                  boxShadow: isLive
                    ? '0 14px 28px rgba(16, 185, 129, 0.18)'
                    : '0 12px 28px rgba(2, 132, 199, 0.12)',
                  borderColor: isLive ? '#4ade80' : '#93c5fd'
                }}
              >
                {/* Live Top Glow Stripe */}
                {isLive && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: 'linear-gradient(90deg, #10b981, #34d399, #10b981)'
                  }} />
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Card Header: Tags & Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '4px 10px',
                        borderRadius: 8,
                        background: '#e0f2fe',
                        color: '#0369a1',
                        border: '1px solid #bae6fd'
                      }}>
                        {prova.disciplina || 'Geral'}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        padding: '4px 8px',
                        borderRadius: 8,
                        background: '#f1f5f9',
                        color: '#475569'
                      }}>
                        {prova.bimestre ? `${prova.bimestre}º Bimestre` : 'Geral'}
                      </span>
                    </div>

                    {getStatusBadge(prova.status)}
                  </div>

                  {/* Exam Title */}
                  <h3 style={{
                    margin: 0,
                    fontSize: 17,
                    fontWeight: 900,
                    color: '#0f172a',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}>
                    {prova.titulo}
                  </h3>

                  {/* Specs & Metadata */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    fontSize: 12
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 600 }}>
                      <Clock size={14} color="#0284c7" />
                      <span>{prova.duracaoMinutos} min</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 600 }}>
                      <FileCheck2 size={14} color="#0284c7" />
                      <span>{questionsCount} questões ({prova.valorTotal || 10} pts)</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', gridColumn: 'span 2', fontWeight: 500 }}>
                      <Layers size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Turmas: {(prova.turmas || []).join(', ') || 'Todas'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', gridColumn: 'span 2', fontWeight: 500 }}>
                      <UserCheck size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        Prof. {prova.professorNome || 'Docente'}
                      </span>
                    </div>
                  </div>

                  {/* Schedule Box */}
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    fontSize: 11,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
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

                  {/* Teacher stats progress bar */}
                  {isTeacherOrStaff && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                        <span style={{ color: '#64748b', fontWeight: 600 }}>Entregas Realizadas</span>
                        <strong style={{ color: '#0284c7' }}>
                          {prova.stats?.entregues || 0} entregas
                        </strong>
                      </div>
                      <div style={{
                        width: '100%',
                        height: 6,
                        borderRadius: 6,
                        background: '#e2e8f0',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          height: '100%',
                          background: 'linear-gradient(90deg, #0ea5e9, #0284c7)',
                          width: `${Math.min(100, ((prova.stats?.entregues || 0) / Math.max(1, prova.stats?.totalTentativas || 1)) * 100)}%`
                        }} />
                      </div>
                      {prova.stats?.emAndamento > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#059669', fontWeight: 700 }}>
                          <Activity size={12} className="animate-pulse" />
                          <span>{prova.stats.emAndamento} aluno(s) em prova agora</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Student Attempt status pill */}
                  {isStudent && (
                    <div style={{
                      padding: '10px 14px',
                      borderRadius: 12,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      fontSize: 12
                    }}>
                      {studentInfo?.submetida ? (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669', fontWeight: 800 }}>
                            <CheckCircle2 size={16} />
                            Prova Entregue com Sucesso
                          </div>
                          {studentInfo.resultadoLiberado ? (
                            <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900, color: '#0f172a' }}>
                              Nota: <span style={{ color: '#059669' }}>{studentInfo.ultimaTentativa?.notaFinal} / {prova.valorTotal}</span>
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                              Aguardando liberação das correções pelo professor.
                            </div>
                          )}
                        </div>
                      ) : hasActiveAttempt ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#7e22ce', fontWeight: 800 }}>
                          <Timer size={16} className="animate-pulse" />
                          Tentativa em andamento
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748b' }}>
                          <Clock size={14} />
                          {studentInfo?.tentativasRealizadas > 0
                            ? `${studentInfo.tentativasRealizadas} de ${prova.quantidadeTentativas} tentativas usadas`
                            : 'Ainda não iniciada'}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons Footer */}
                <div style={{
                  paddingTop: 14,
                  borderTop: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10
                }}>
                  {/* STUDENT ACTIONS */}
                  {isStudent && (
                    <div style={{ width: '100%' }}>
                      {hasActiveAttempt ? (
                        <button
                          onClick={() => router.push(`/provas-online/fazer/${studentInfo.tentativaAtivaId}`)}
                          style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #a855f7, #7e22ce)',
                            border: 'none',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)'
                          }}
                        >
                          <Timer size={16} /> Continuar Prova
                        </button>
                      ) : canTakeExam ? (
                        <button
                          onClick={() => router.push(`/provas-online/fazer/${prova.id}?briefing=true`)}
                          style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none',
                            color: '#ffffff',
                            fontWeight: 800,
                            fontSize: 13,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          <Flame size={16} /> Iniciar Prova
                        </button>
                      ) : studentInfo?.submetida ? (
                        <button
                          onClick={() => router.push(`/provas-online/fazer/${studentInfo.ultimaTentativa?.id}?comprovante=true`)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            borderRadius: 12,
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#334155',
                            fontWeight: 700,
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            cursor: 'pointer'
                          }}
                        >
                          <FileText size={14} /> Ver Comprovante de Entrega
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
                          Indisponível no Momento
                        </button>
                      )}
                    </div>
                  )}

                  {/* TEACHER / STAFF ACTIONS */}
                  {isTeacherOrStaff && (
                    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => router.push(`/provas-online/${prova.id}/monitorar`)}
                        style={{
                          flex: 1,
                          height: 38,
                          borderRadius: 10,
                          background: isLive ? '#ecfdf5' : '#f8fafc',
                          border: isLive ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                          color: isLive ? '#059669' : '#334155',
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = isLive ? '#d1fae5' : '#f1f5f9'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = isLive ? '#ecfdf5' : '#f8fafc'
                        }}
                      >
                        <Activity size={14} className={isLive ? 'animate-pulse' : ''} />
                        Monitorar
                      </button>

                      <button
                        onClick={() => router.push(`/provas-online/${prova.id}/corrigir`)}
                        style={{
                          flex: 1,
                          height: 38,
                          borderRadius: 10,
                          background: '#faf5ff',
                          border: '1px solid #e9d5ff',
                          color: '#7e22ce',
                          fontWeight: 700,
                          fontSize: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f3e8ff'}
                        onMouseLeave={e => e.currentTarget.style.background = '#faf5ff'}
                      >
                        <CheckCircle2 size={14} />
                        Corrigir
                      </button>

                      <button
                        onClick={() => router.push(`/provas-online/${prova.id}/relatorio`)}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#0284c7'; e.currentTarget.style.background = '#f0f9ff' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = '#f8fafc' }}
                        title="Relatórios e Diário"
                      >
                        <BarChart3 size={16} />
                      </button>

                      <button
                        onClick={() => router.push(`/provas-online/${prova.id}/imprimir`)}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#0284c7'; e.currentTarget.style.background = '#f0f9ff' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = '#f8fafc' }}
                        title="Imprimir Caderno de Prova / Gabarito / Cartão-Resposta"
                      >
                        <Printer size={16} />
                      </button>

                      <button
                        onClick={() => router.push(`/provas-online/${prova.id}/editar`)}
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          color: '#475569',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#0284c7'; e.currentTarget.style.background = '#f0f9ff' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = '#f8fafc' }}
                        title="Editar Avaliação"
                      >
                        <Edit3 size={15} />
                      </button>
                    </div>
                  )}

                  {/* RESPONSIBLE ACTIONS */}
                  {isResponsible && (
                    <button
                      onClick={() => router.push(`/provas-online/${prova.id}/relatorio`)}
                      style={{
                        width: '100%',
                        height: 38,
                        borderRadius: 10,
                        background: '#faf5ff',
                        border: '1px solid #e9d5ff',
                        color: '#7e22ce',
                        fontWeight: 700,
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
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
    </div>
  )
}
