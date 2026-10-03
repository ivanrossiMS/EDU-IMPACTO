'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity, Shield, Users, Clock, Wifi, AlertTriangle, CheckCircle2,
  Search, RefreshCw, Copy, ExternalLink, ArrowRight, Play, Eye,
  Calendar, Layers, Filter, Check, AlertCircle, FileText,
  ChevronRight, Radio, Sparkles, BookOpen, QrCode, X, Share2
} from 'lucide-react'
import { toast } from 'sonner'
import { ProvaOnline } from '@/types/provas-online'

export default function SupervisaoProvasPage() {
  const router = useRouter()
  const [provas, setProvas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Quick Share / QR Modal
  const [shareModalProva, setShareModalProva] = useState<any | null>(null)

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'ao_vivo' | 'todas' | 'com_alertas' | 'agendadas' | 'encerradas'>('ao_vivo')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTurma, setSelectedTurma] = useState('')
  const [selectedDisciplina, setSelectedDisciplina] = useState('')
  const [selectedBimestre, setSelectedBimestre] = useState('')

  // Fetch Exams
  const fetchProvas = async (silent = false) => {
    try {
      if (!silent) setRefreshing(true)
      const res = await fetch('/api/provas-online')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setProvas(data)
          setLastUpdated(new Date())
        }
      }
    } catch (err) {
      console.error('Erro ao carregar provas na supervisão:', err)
      if (!silent) toast.error('Falha ao sincronizar dados das salas')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchProvas()
  }, [])

  // Auto-refresh interval (every 15s when active)
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        fetchProvas(true)
      }
    }, 15000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  // Copy Student Link Handler
  const handleCopyLink = async (prova: any) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const url = `${origin}/provas-online/fazer/${prova.id}`
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        const ta = document.createElement('textarea')
        ta.value = url
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopiedId(prova.id)
      toast.success(`Link de acesso para "${prova.titulo}" copiado!`)
      setTimeout(() => setCopiedId(null), 3000)
    } catch (e) {
      toast.error('Erro ao copiar link')
    }
  }

  // Filter lists for select inputs
  const turmasList = useMemo(() => {
    const set = new Set<string>()
    provas.forEach(p => (p.turmas || []).forEach((t: string) => set.add(t)))
    return Array.from(set).sort()
  }, [provas])

  const disciplinasList = useMemo(() => {
    const set = new Set<string>()
    provas.forEach(p => { if (p.disciplina) set.add(p.disciplina) })
    return Array.from(set).sort()
  }, [provas])

  const bimestresList = useMemo(() => {
    const set = new Set<string>()
    provas.forEach(p => { if (p.bimestre) set.add(String(p.bimestre)) })
    return Array.from(set).sort()
  }, [provas])

  // Real-time KPIs
  const stats = useMemo(() => {
    const now = Date.now()
    let emAplicacaoCount = 0
    let totalAlunosOnline = 0
    let totalEntregas = 0
    let provasComAlertas = 0
    let agendadasCount = 0

    provas.forEach(p => {
      const isLive = p.status === 'em_aplicacao' || (p.stats && p.stats.emAndamento > 0)
      if (isLive) {
        emAplicacaoCount++
        totalAlunosOnline += (p.stats?.emAndamento || 0)
      }
      totalEntregas += (p.stats?.entregues || 0)

      if (p.status === 'agendada') {
        agendadasCount++
      }

      // Check occurrences
      const ocorrencias = p.ocorrenciasCount || p.stats?.ocorrenciasCount || 0
      if (ocorrencias > 0) {
        provasComAlertas++
      }
    })

    return {
      emAplicacaoCount,
      totalAlunosOnline,
      totalEntregas,
      provasComAlertas,
      agendadasCount,
      totalProvas: provas.length
    }
  }, [provas])

  // Filtered Exam List
  const filteredProvas = useMemo(() => {
    return provas.filter(p => {
      const isLive = p.status === 'em_aplicacao' || (p.stats && p.stats.emAndamento > 0)
      const ocorrencias = p.ocorrenciasCount || p.stats?.ocorrenciasCount || 0

      // Tab filtering
      if (activeTab === 'ao_vivo' && !isLive) return false
      if (activeTab === 'com_alertas' && ocorrencias === 0) return false
      if (activeTab === 'agendadas' && p.status !== 'agendada') return false
      if (activeTab === 'encerradas' && p.status !== 'encerrada' && p.status !== 'publicada') return false

      // Search term
      if (searchTerm) {
        const q = searchTerm.toLowerCase()
        const matchTitle = (p.titulo || '').toLowerCase().includes(q)
        const matchDisc = (p.disciplina || '').toLowerCase().includes(q)
        const matchProf = (p.professorNome || '').toLowerCase().includes(q)
        if (!matchTitle && !matchDisc && !matchProf) return false
      }

      // Turma filter
      if (selectedTurma) {
        const matchTurma = (p.turmas || []).some((t: string) => t.toLowerCase() === selectedTurma.toLowerCase())
        if (!matchTurma) return false
      }

      // Disciplina filter
      if (selectedDisciplina) {
        if ((p.disciplina || '').toLowerCase() !== selectedDisciplina.toLowerCase()) return false
      }

      // Bimestre filter
      if (selectedBimestre) {
        if (String(p.bimestre) !== selectedBimestre) return false
      }

      return true
    }).sort((a, b) => {
      // Prioritize live exams first, then by opening date descending
      const aLive = a.status === 'em_aplicacao' || (a.stats && a.stats.emAndamento > 0)
      const bLive = b.status === 'em_aplicacao' || (b.stats && b.stats.emAndamento > 0)
      if (aLive && !bLive) return -1
      if (!aLive && bLive) return 1
      return new Date(b.dataAbertura || 0).getTime() - new Date(a.dataAbertura || 0).getTime()
    })
  }, [provas, activeTab, searchTerm, selectedTurma, selectedDisciplina, selectedBimestre])

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. TOP HEADER & LIVE STATUS */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        padding: '24px 28px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px -2px rgba(5, 150, 105, 0.35)',
            flexShrink: 0
          }}>
            <Activity size={24} color="#ffffff" className="animate-pulse" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Central de Supervisão Digital
              </h1>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '3px 10px',
                borderRadius: '99px',
                fontSize: '11px',
                fontWeight: 800,
                background: '#ecfdf5',
                color: '#059669',
                border: '1px solid #a7f3d0'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                TEMPO REAL ATIVO
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Monitoramento instantâneo de alunos conectados, salas ativas e auditoria anti-fraude.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Auto-refresh toggle */}
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            style={{
              height: '38px',
              padding: '0 14px',
              borderRadius: '11px',
              border: `1px solid ${autoRefresh ? '#a7f3d0' : '#e2e8f0'}`,
              background: autoRefresh ? '#f0fdf4' : '#ffffff',
              color: autoRefresh ? '#047857' : '#64748b',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
            title={autoRefresh ? 'Atualização automática a cada 15s ativada' : 'Ativar auto-refresh'}
          >
            <Radio size={14} className={autoRefresh ? 'animate-pulse text-emerald-500' : 'text-slate-400'} />
            <span>Auto-Sync 15s: {autoRefresh ? 'Ligado' : 'Pausado'}</span>
          </button>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => fetchProvas()}
            disabled={refreshing}
            style={{
              height: '38px',
              padding: '0 16px',
              borderRadius: '11px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '12px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-emerald-600' : 'text-slate-600'} />
            <span>{refreshing ? 'Sincronizando...' : 'Atualizar'}</span>
          </button>

          {/* Quick link to create new exam */}
          <Link
            href="/provas-online/nova"
            style={{
              height: '38px',
              padding: '0 18px',
              borderRadius: '11px',
              background: '#0284c7',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              textDecoration: 'none',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
              transition: 'background 0.15s'
            }}
          >
            <span>+ Nova Prova</span>
          </Link>
        </div>
      </div>

      {/* 2. REAL-TIME SUPERVISION KPIS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        {/* Ao Vivo Agora */}
        <div style={{
          background: stats.emAplicacaoCount > 0 ? 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)' : '#ffffff',
          border: `1px solid ${stats.emAplicacaoCount > 0 ? '#86efac' : '#e2e8f0'}`,
          borderRadius: '16px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: stats.emAplicacaoCount > 0 ? '#15803d' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Ao Vivo Agora
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: stats.emAplicacaoCount > 0 ? '#dcfce7' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={16} color={stats.emAplicacaoCount > 0 ? '#16a34a' : '#94a3b8'} className={stats.emAplicacaoCount > 0 ? 'animate-pulse' : ''} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: stats.emAplicacaoCount > 0 ? '#15803d' : '#0f172a', lineHeight: 1 }}>
            {stats.emAplicacaoCount}
          </div>
          <span style={{ fontSize: '11px', color: stats.emAplicacaoCount > 0 ? '#166534' : '#94a3b8' }}>
            {stats.emAplicacaoCount === 1 ? '1 sala em aplicação ativa' : `${stats.emAplicacaoCount} salas ativas`}
          </span>
        </div>

        {/* Estudantes Conectados */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Alunos em Prova
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#0284c7', lineHeight: 1 }}>
            {stats.totalAlunosOnline}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {stats.totalAlunosOnline === 1 ? '1 aluno com prova em andamento' : `${stats.totalAlunosOnline} alunos realizando`}
          </span>
        </div>

        {/* Alertas de Integridade */}
        <div style={{
          background: stats.provasComAlertas > 0 ? '#fff1f2' : '#ffffff',
          border: `1px solid ${stats.provasComAlertas > 0 ? '#fecdd3' : '#e2e8f0'}`,
          borderRadius: '16px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: stats.provasComAlertas > 0 ? '#be123c' : '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Integridade Digital
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: stats.provasComAlertas > 0 ? '#ffe4e6' : '#f0fdf4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Shield size={16} color={stats.provasComAlertas > 0 ? '#e11d48' : '#16a34a'} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: stats.provasComAlertas > 0 ? '#e11d48' : '#16a34a', lineHeight: 1 }}>
            {stats.provasComAlertas}
          </div>
          <span style={{ fontSize: '11px', color: stats.provasComAlertas > 0 ? '#be123c' : '#64748b' }}>
            {stats.provasComAlertas === 0 ? 'Nenhuma infração registrada' : `${stats.provasComAlertas} prova(s) com alerta`}
          </span>
        </div>

        {/* Provas Agendadas */}
        <div style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Agendadas / Próximas
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#fffbeb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={16} color="#d97706" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#334155', lineHeight: 1 }}>
            {stats.agendadasCount}
          </div>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            {stats.agendadasCount === 1 ? '1 avaliação programada' : `${stats.agendadasCount} avaliações programadas`}
          </span>
        </div>
      </div>

      {/* 3. TABS DE NAVEGAÇÃO RÁPIDA */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#f1f5f9',
        border: '1px solid #e2e8f0',
        padding: '4px',
        borderRadius: '14px',
        gap: '4px',
        width: 'fit-content',
        flexWrap: 'wrap'
      }}>
        {[
          { id: 'ao_vivo', label: 'Ao Vivo Agora', count: stats.emAplicacaoCount, highlight: true },
          { id: 'todas', label: 'Todas as Provas', count: stats.totalProvas },
          { id: 'com_alertas', label: 'Alertas de Integridade', count: stats.provasComAlertas, alert: true },
          { id: 'agendadas', label: 'Agendadas', count: stats.agendadasCount },
          { id: 'encerradas', label: 'Encerradas / Histórico' },
        ].map(t => {
          const isSelected = activeTab === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: isSelected ? 800 : 600,
                background: isSelected ? '#ffffff' : 'transparent',
                color: isSelected ? '#0f172a' : '#64748b',
                border: 'none',
                boxShadow: isSelected ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s'
              }}
            >
              {t.highlight && stats.emAplicacaoCount > 0 && (
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} className="animate-pulse" />
              )}
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '99px',
                  background: isSelected ? (t.alert && (t.count || 0) > 0 ? '#ffe4e6' : '#f1f5f9') : '#e2e8f0',
                  color: t.alert && (t.count || 0) > 0 ? '#e11d48' : (isSelected ? '#0284c7' : '#64748b')
                }}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 4. BARRA DE BUSCA E FILTROS */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '14px 18px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {/* Search Input */}
        <div style={{
          position: 'relative',
          flex: '1 1 240px',
          minWidth: '220px'
        }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Buscar por prova, disciplina ou professor..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              height: '38px',
              paddingLeft: '36px',
              paddingRight: '12px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontSize: '13px',
              color: '#0f172a',
              outline: 'none'
            }}
          />
        </div>

        {/* Turma filter */}
        <select
          value={selectedTurma}
          onChange={e => setSelectedTurma(e.target.value)}
          style={{
            height: '38px',
            padding: '0 12px',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            fontSize: '12px',
            fontWeight: 600,
            color: '#334155',
            outline: 'none',
            minWidth: '130px'
          }}
        >
          <option value="">Todas as Turmas</option>
          {turmasList.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Disciplina filter */}
        <select
          value={selectedDisciplina}
          onChange={e => setSelectedDisciplina(e.target.value)}
          style={{
            height: '38px',
            padding: '0 12px',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            fontSize: '12px',
            fontWeight: 600,
            color: '#334155',
            outline: 'none',
            minWidth: '140px'
          }}
        >
          <option value="">Todas Disciplinas</option>
          {disciplinasList.map(d => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {/* Bimestre filter */}
        <select
          value={selectedBimestre}
          onChange={e => setSelectedBimestre(e.target.value)}
          style={{
            height: '38px',
            padding: '0 12px',
            borderRadius: '10px',
            border: '1px solid #cbd5e1',
            background: '#f8fafc',
            fontSize: '12px',
            fontWeight: 600,
            color: '#334155',
            outline: 'none',
            minWidth: '120px'
          }}
        >
          <option value="">Todos Bimestres</option>
          {bimestresList.map(b => (
            <option key={b} value={b}>{b}º Bimestre</option>
          ))}
        </select>

        {/* Clear Filters Button if any active */}
        {(searchTerm || selectedTurma || selectedDisciplina || selectedBimestre) && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('')
              setSelectedTurma('')
              setSelectedDisciplina('')
              setSelectedBimestre('')
            }}
            style={{
              height: '38px',
              padding: '0 14px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#ffffff',
              color: '#ef4444',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Limpar Filtros
          </button>
        )}
      </div>

      {/* 5. LISTAGEM DE SALAS E PROVAS EM SUPERVISÃO */}
      {loading ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '60px 20px',
          textAlign: 'center',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px'
        }}>
          <RefreshCw size={28} className="animate-spin text-sky-600" />
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#64748b' }}>
            Sintonizando salas de avaliação em tempo real...
          </span>
        </div>
      ) : filteredProvas.length === 0 ? (
        <div style={{
          background: '#ffffff',
          borderRadius: '20px',
          padding: '60px 20px',
          textAlign: 'center',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '18px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8'
          }}>
            <Activity size={26} />
          </div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
            Nenhuma prova encontrada nesta visão
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '420px', lineHeight: 1.5 }}>
            {activeTab === 'ao_vivo' 
              ? 'Não há nenhuma prova sendo realizada pelos alunos neste instante. Verifique a aba "Agendadas" ou "Todas as Provas".'
              : activeTab === 'com_alertas'
              ? 'Parabéns! Nenhuma infração de integridade digital foi detectada nas avaliações recentes.'
              : 'Nenhuma avaliação atende aos filtros pesquisados. Tente ajustar os termos de busca.'}
          </p>
          {activeTab !== 'todas' && (
            <button
              type="button"
              onClick={() => { setActiveTab('todas'); setSearchTerm(''); }}
              style={{
                marginTop: '8px',
                padding: '8px 18px',
                borderRadius: '10px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Ver Todas as Avaliações
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filteredProvas.map((prova) => {
            const isLive = prova.status === 'em_aplicacao' || (prova.stats && prova.stats.emAndamento > 0)
            const emAndamento = prova.stats?.emAndamento || 0
            const entregues = prova.stats?.entregues || 0
            const totalTentativas = prova.stats?.totalTentativas || (emAndamento + entregues)
            const ocorrencias = prova.ocorrenciasCount || prova.stats?.ocorrenciasCount || 0

            return (
              <motion.div
                key={prova.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: '#ffffff',
                  border: `1px solid ${isLive ? '#86efac' : ocorrencias > 0 ? '#fecdd3' : '#e2e8f0'}`,
                  borderRadius: '18px',
                  padding: '20px 24px',
                  boxShadow: isLive ? '0 4px 18px -4px rgba(16, 185, 129, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Visual strip for live exam */}
                {isLive && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, #10b981 0%, #34d399 50%, #10b981 100%)'
                  }} />
                )}

                {/* Top Bar: Badges & Status */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 800,
                      padding: '3px 10px',
                      borderRadius: '8px',
                      background: '#f0f9ff',
                      color: '#0284c7',
                      border: '1px solid #bae6fd',
                      textTransform: 'uppercase'
                    }}>
                      {prova.disciplina || 'Disciplina'}
                    </span>
                    {prova.bimestre && (
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '8px', background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' }}>
                        {prova.bimestre}º Bimestre
                      </span>
                    )}
                    {prova.anoLetivo && (
                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#94a3b8' }}>
                        {prova.anoLetivo}
                      </span>
                    )}
                  </div>

                  {/* Status Indicator */}
                  <div>
                    {isLive ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '99px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#ecfdf5',
                        color: '#047857',
                        border: '1px solid #a7f3d0',
                        boxShadow: '0 0 12px rgba(16, 185, 129, 0.2)'
                      }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} className="animate-pulse" />
                        AO VIVO • EM ANDAMENTO
                      </span>
                    ) : prova.status === 'agendada' ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '99px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: '#fffbeb',
                        color: '#b45309',
                        border: '1px solid #fde68a'
                      }}>
                        <Clock size={12} />
                        AGENDADA
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '4px 10px',
                        borderRadius: '99px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: '#f1f5f9',
                        color: '#475569',
                        border: '1px solid #cbd5e1'
                      }}>
                        <CheckCircle2 size={12} />
                        FINALIZADA
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Metadata Details */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', alignItems: 'center' }}>
                  <div>
                    <h2 style={{ margin: '0 0 6px 0', fontSize: '17px', fontWeight: 800, color: '#0f172a', lineHeight: 1.3 }}>
                      {prova.titulo}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: '#64748b' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={13} color="#94a3b8" />
                        Turma(s): <strong style={{ color: '#334155' }}>{(prova.turmas || []).join(', ') || 'Geral'}</strong>
                      </span>
                      {prova.duracaoMinutos && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={13} color="#94a3b8" />
                          Duração: <strong style={{ color: '#334155' }}>{prova.duracaoMinutos} min</strong>
                        </span>
                      )}
                      <span>
                        Questões: <strong style={{ color: '#334155' }}>{prova.questoes?.length || 0}</strong> ({prova.valorTotal || 10} pts)
                      </span>
                    </div>
                  </div>

                  {/* Real-time stats box */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '12px 16px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '12px',
                    textAlign: 'center'
                  }}>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Em Prova Agora
                      </span>
                      <span style={{ fontSize: '18px', fontWeight: 900, color: isLive ? '#15803d' : '#0f172a', fontFamily: 'monospace' }}>
                        {emAndamento}
                      </span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Entregues
                      </span>
                      <span style={{ fontSize: '18px', fontWeight: 900, color: '#0284c7', fontFamily: 'monospace' }}>
                        {entregues}
                      </span>
                    </div>
                    <div>
                      <span style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                        Integridade
                      </span>
                      {ocorrencias > 0 ? (
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#e11d48' }}>
                          ⚠️ {ocorrencias} alerta(s)
                        </span>
                      ) : (
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#16a34a' }}>
                          ✓ Regular
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Schedule window & quick alerts */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  paddingTop: '12px',
                  borderTop: '1px solid #f1f5f9',
                  fontSize: '11px',
                  color: '#64748b'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={13} color="#94a3b8" />
                    <span>
                      Janela: <strong>{prova.dataAbertura ? new Date(prova.dataAbertura).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--'}</strong> até <strong>{prova.dataEncerramento ? new Date(prova.dataEncerramento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '--'}</strong>
                    </span>
                  </div>

                  {/* Actions buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Copy Link Button */}
                    <button
                      type="button"
                      onClick={() => handleCopyLink(prova)}
                      style={{
                        height: '34px',
                        padding: '0 12px',
                        borderRadius: '9px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: copiedId === prova.id ? '#059669' : '#334155',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                      title="Copiar link de acesso para os alunos"
                    >
                      {copiedId === prova.id ? <Check size={13} color="#059669" /> : <Copy size={13} />}
                      <span>{copiedId === prova.id ? 'Copiado!' : 'Link Alunos'}</span>
                    </button>

                    {/* Share Modal Trigger */}
                    <button
                      type="button"
                      onClick={() => setShareModalProva(prova)}
                      style={{
                        height: '34px',
                        padding: '0 12px',
                        borderRadius: '9px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        color: '#334155',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer'
                      }}
                      title="Ver opções de compartilhamento e QR Code"
                    >
                      <Share2 size={13} />
                      <span>Compartilhar</span>
                    </button>

                    {/* Report & Audit Link */}
                    <Link
                      href={`/provas-online/${prova.id}/relatorio`}
                      style={{
                        height: '34px',
                        padding: '0 12px',
                        borderRadius: '9px',
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        color: '#334155',
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none'
                      }}
                    >
                      <FileText size={13} />
                      <span>Relatório & Ata</span>
                    </Link>

                    {/* Primary Button: Entrar na Sala de Supervisão */}
                    <Link
                      href={`/provas-online/${prova.id}/monitorar`}
                      style={{
                        height: '34px',
                        padding: '0 16px',
                        borderRadius: '9px',
                        background: isLive ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : '#0284c7',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        boxShadow: isLive ? '0 2px 8px rgba(5, 150, 105, 0.3)' : '0 2px 8px rgba(2, 132, 199, 0.25)'
                      }}
                    >
                      <Activity size={14} className={isLive ? 'animate-pulse' : ''} />
                      <span>{isLive ? 'Supervisão ao Vivo' : 'Abrir Sala de Supervisão'}</span>
                    </Link>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* 6. MODAL DE COMPARTILHAMENTO RÁPIDO */}
      <AnimatePresence>
        {shareModalProva && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(6px)'
            }}
            onClick={() => setShareModalProva(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '520px',
                background: '#ffffff',
                borderRadius: '20px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Share2 size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                      Compartilhar com os Alunos
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                      {shareModalProva.titulo}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShareModalProva(null)}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
                >
                  <X size={16} color="#64748b" />
                </button>
              </div>

              {/* Link Box */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Link Direto da Prova:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}/provas-online/fazer/${shareModalProva.id}` : ''}
                    style={{
                      flex: 1,
                      height: '38px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      padding: '0 12px',
                      color: '#0f172a'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyLink(shareModalProva)}
                    style={{
                      height: '38px',
                      padding: '0 16px',
                      borderRadius: '10px',
                      background: '#0284c7',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Copiar
                  </button>
                </div>
              </div>

              {/* Instruções */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                Envie o link para os estudantes pelo WhatsApp, Google Classroom ou Agenda Digital. Ao abrir, o aluno visualizará a tela de identificação e terá início a contagem de tempo de acordo com a política definida.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShareModalProva(null)}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '10px',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: 700,
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
    </div>
  )
}
