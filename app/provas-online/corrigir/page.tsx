'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckSquare, FileCheck2, CheckCircle2, AlertTriangle, Search,
  RefreshCw, Award, BookOpen, Clock, Users, ArrowRight,
  Sparkles, Layers, Filter, Check, Eye, HelpCircle,
  FileText, Database, X, ChevronRight, BarChart3
} from 'lucide-react'
import { toast } from 'sonner'
import { HtmlContent } from '@/components/HtmlContent'

export default function CentralCorrecaoPage() {
  const router = useRouter()
  const [provas, setProvas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'pendentes' | 'todas' | 'com_dissertativas' | 'concluidas' | 'publicadas'>('pendentes')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTurma, setSelectedTurma] = useState('')
  const [selectedDisciplina, setSelectedDisciplina] = useState('')
  const [selectedBimestre, setSelectedBimestre] = useState('')

  // Answer Key & Rubric Preview Modal
  const [gabaritoModalProva, setGabaritoModalProva] = useState<any | null>(null)

  // Fetch Exams
  const fetchProvas = async (silent = false) => {
    try {
      if (!silent) setRefreshing(true)
      const res = await fetch('/api/provas-online')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          setProvas(data)
        }
      }
    } catch (err) {
      console.error('Erro ao carregar fila de correção:', err)
      if (!silent) toast.error('Falha ao sincronizar dados da fila de correção')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchProvas()
  }, [])

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

  // Real-time Grading Statistics
  const stats = useMemo(() => {
    let totalPendencias = 0
    let provasComPendencias = 0
    let provasConcluidas = 0
    let provas100Objetivas = 0
    let totalEntregasGeral = 0

    provas.forEach(p => {
      const pendentes = p.stats?.correcaoPendente || 0
      const entregues = p.stats?.entregues || 0
      totalEntregasGeral += entregues

      const dissertativas = (p.questoes || []).filter((q: any) => q.tipo === 'dissertativa').length
      if (dissertativas === 0) {
        provas100Objetivas++
      }

      if (pendentes > 0) {
        totalPendencias += pendentes
        provasComPendencias++
      } else if (entregues > 0) {
        provasConcluidas++
      }
    })

    return {
      totalPendencias,
      provasComPendencias,
      provasConcluidas,
      provas100Objetivas,
      totalEntregasGeral,
      totalProvas: provas.length
    }
  }, [provas])

  // Filtered Exam List
  const filteredProvas = useMemo(() => {
    return provas.filter(p => {
      const pendentes = p.stats?.correcaoPendente || 0
      const entregues = p.stats?.entregues || 0
      const dissertativas = (p.questoes || []).filter((q: any) => q.tipo === 'dissertativa').length

      // Tab filtering
      if (activeTab === 'pendentes' && pendentes === 0) return false
      if (activeTab === 'com_dissertativas' && dissertativas === 0) return false
      if (activeTab === 'concluidas' && (pendentes > 0 || entregues === 0)) return false
      if (activeTab === 'publicadas' && p.status !== 'publicada') return false

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
      // Prioritize exams with pending corrections first
      const aPending = a.stats?.correcaoPendente || 0
      const bPending = b.stats?.correcaoPendente || 0
      if (aPending > 0 && bPending === 0) return -1
      if (aPending === 0 && bPending > 0) return 1
      return bPending - aPending
    })
  }, [provas, activeTab, searchTerm, selectedTurma, selectedDisciplina, selectedBimestre])

  return (
    <div style={{ padding: '24px 20px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 1. TOP HEADER & PEDAGOGICAL STATUS */}
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
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 16px -2px rgba(2, 132, 199, 0.35)',
            flexShrink: 0
          }}>
            <CheckSquare size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
                Central de Correção Pedagógica
              </h1>
              {stats.totalPendencias > 0 ? (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '3px 10px',
                  borderRadius: '99px',
                  fontSize: '11px',
                  fontWeight: 800,
                  background: '#fffbeb',
                  color: '#b45309',
                  border: '1px solid #fde68a'
                }}>
                  <AlertTriangle size={12} />
                  {stats.totalPendencias} AVALIAÇÃO(ÕES) PENDENTE(S)
                </span>
              ) : (
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
                  <CheckCircle2 size={12} />
                  CORREÇÕES 100% EM DIA
                </span>
              )}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
              Fila de avaliação de questões dissertativas, auditoria de gabaritos e fechamento de notas escolares.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Refresh */}
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
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-sky-600' : 'text-slate-600'} />
            <span>{refreshing ? 'Atualizando...' : 'Atualizar Fila'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPIS DE CORREÇÃO PEDAGÓGICA */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        {/* Avaliações Pendentes na Fila */}
        <div style={{
          background: stats.totalPendencias > 0 ? '#fffbeb' : '#ffffff',
          border: `1px solid ${stats.totalPendencias > 0 ? '#fde68a' : '#e2e8f0'}`,
          borderRadius: '16px',
          padding: '18px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: stats.totalPendencias > 0 ? '#b45309' : '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Fila de Correção
            </span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: stats.totalPendencias > 0 ? '#fef3c7' : '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertTriangle size={16} color={stats.totalPendencias > 0 ? '#d97706' : '#94a3b8'} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: stats.totalPendencias > 0 ? '#b45309' : '#0f172a', lineHeight: 1 }}>
            {stats.totalPendencias}
          </div>
          <span style={{ fontSize: '11px', color: stats.totalPendencias > 0 ? '#92400e' : '#94a3b8' }}>
            {stats.totalPendencias === 0 ? 'Nenhuma prova pendente' : `${stats.totalPendencias} submissão(ões) dissertativa(s)`}
          </span>
        </div>

        {/* Provas com Pendências */}
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
              Provas c/ Pendências
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileCheck2 size={16} color="#0284c7" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#0284c7', lineHeight: 1 }}>
            {stats.provasComPendencias}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            {stats.provasComPendencias === 1 ? '1 avaliação aguardando nota' : `${stats.provasComPendencias} avaliações aguardando`}
          </span>
        </div>

        {/* Correções Concluídas */}
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
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              100% Corrigidas
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} color="#059669" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#059669', lineHeight: 1 }}>
            {stats.provasConcluidas}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Prontas para homologação e ata
          </span>
        </div>

        {/* 100% Objetivas (Autocorrigidas) */}
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
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Autocorrigidas
            </span>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={16} color="#6366f1" />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 900, color: '#4338ca', lineHeight: 1 }}>
            {stats.provas100Objetivas}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            100% questões objetivas
          </span>
        </div>
      </div>

      {/* 3. TABS DE NAVEGAÇÃO DA FILA DE CORREÇÃO */}
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
          { id: 'pendentes', label: 'Fila de Correção (Pendentes)', count: stats.provasComPendencias, alert: true },
          { id: 'todas', label: 'Todas as Provas', count: stats.totalProvas },
          { id: 'com_dissertativas', label: 'Com Dissertativas' },
          { id: 'concluidas', label: '100% Corrigidas', count: stats.provasConcluidas },
          { id: 'publicadas', label: 'Divulgadas no Diário' },
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
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '99px',
                  background: isSelected ? (t.alert && (t.count || 0) > 0 ? '#fef3c7' : '#f1f5f9') : '#e2e8f0',
                  color: t.alert && (t.count || 0) > 0 ? '#b45309' : (isSelected ? '#0284c7' : '#64748b')
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

        {/* Clear Filters Button */}
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

      {/* 5. LISTAGEM DAS PROVAS PARA CORREÇÃO */}
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
            Carregando fila de correções pedagógicas...
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
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#059669'
          }}>
            <CheckCircle2 size={26} />
          </div>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
            Nenhuma avaliação pendente de correção
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', maxWidth: '420px', lineHeight: 1.5 }}>
            {activeTab === 'pendentes'
              ? 'Todas as submissões entregues já tiveram suas notas atribuídas ou são 100% objetivas com correção automática.'
              : 'Nenhuma prova encontrada com os filtros selecionados.'}
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
            const questoes = prova.questoes || []
            const totalQuestoes = questoes.length
            const totalDissertativas = questoes.filter((q: any) => q.tipo === 'dissertativa').length
            const totalObjetivas = totalQuestoes - totalDissertativas

            const pendentes = prova.stats?.correcaoPendente || 0
            const entregues = prova.stats?.entregues || 0
            const corrigidas = Math.max(0, entregues - pendentes)
            const percentualConcluido = entregues > 0 ? Math.round((corrigidas / entregues) * 100) : 100

            return (
              <motion.div
                key={prova.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  background: '#ffffff',
                  border: `1px solid ${pendentes > 0 ? '#fde68a' : '#e2e8f0'}`,
                  borderRadius: '18px',
                  padding: '20px 24px',
                  boxShadow: pendentes > 0 ? '0 4px 18px -4px rgba(245, 158, 11, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Visual strip for pending corrections */}
                {pendentes > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 50%, #f59e0b 100%)'
                  }} />
                )}

                {/* Top Bar: Badges & Grading Status */}
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

                  {/* Status Badge */}
                  <div>
                    {pendentes > 0 ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '99px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#fffbeb',
                        color: '#b45309',
                        border: '1px solid #fde68a'
                      }}>
                        <AlertTriangle size={12} />
                        {pendentes} AVALIAÇÃO(ÕES) PENDENTE(S)
                      </span>
                    ) : totalDissertativas === 0 ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '99px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#f0fdf4',
                        color: '#15803d',
                        border: '1px solid #bbf7d0'
                      }}>
                        <Sparkles size={12} />
                        100% AUTOCORRIGIDA (OBJETIVA)
                      </span>
                    ) : entregues > 0 ? (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 12px',
                        borderRadius: '99px',
                        fontSize: '11px',
                        fontWeight: 800,
                        background: '#ecfdf5',
                        color: '#059669',
                        border: '1px solid #a7f3d0'
                      }}>
                        <CheckCircle2 size={12} />
                        100% CORRIGIDA EM DIA
                      </span>
                    ) : (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '99px',
                        fontSize: '11px',
                        fontWeight: 700,
                        background: '#f8fafc',
                        color: '#64748b',
                        border: '1px solid #e2e8f0'
                      }}>
                        SEM ENTREGAS AINDA
                      </span>
                    )}
                  </div>
                </div>

                {/* Title & Question Breakdown */}
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
                      <span>
                        Professor: <strong style={{ color: '#334155' }}>{prova.professorNome || 'Docente'}</strong>
                      </span>
                      <span>
                        Total: <strong style={{ color: '#334155' }}>{prova.valorTotal || 10} pts</strong>
                      </span>
                    </div>

                    {/* Breakdown of Question Types */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: '#f1f5f9',
                        color: '#475569'
                      }}>
                        {totalObjetivas} Objetiva(s) (Automática)
                      </span>
                      {totalDissertativas > 0 ? (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: '#fffbeb',
                          color: '#b45309',
                          border: '1px solid #fde68a'
                        }}>
                          {totalDissertativas} Dissertativa(s) (Manual / IA)
                        </span>
                      ) : (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: '#f0fdf4',
                          color: '#16a34a'
                        }}>
                          Sem dissertativas
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress of Grading Gauge */}
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                      <span style={{ fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                        Progresso de Correção
                      </span>
                      <span style={{ fontWeight: 800, color: pendentes > 0 ? '#b45309' : '#059669', fontFamily: 'monospace' }}>
                        {percentualConcluido}% ({corrigidas}/{entregues} entregas)
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{
                      width: '100%',
                      height: '8px',
                      borderRadius: '99px',
                      background: '#e2e8f0',
                      overflow: 'hidden'
                    }}>
                      <div
                        style={{
                          height: '100%',
                          borderRadius: '99px',
                          width: `${percentualConcluido}%`,
                          background: pendentes > 0 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : '#10b981',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                      <span>{entregues} avaliações entregues</span>
                      {pendentes > 0 && <span style={{ color: '#d97706', fontWeight: 700 }}>Faltam {pendentes}</span>}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
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
                  {/* Gabarito Quick Link */}
                  <button
                    type="button"
                    onClick={() => setGabaritoModalProva(prova)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#0284c7',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '11px',
                      padding: '4px 0'
                    }}
                  >
                    <BookOpen size={13} />
                    <span>Conferir Gabarito & Critérios ({totalQuestoes} questões)</span>
                  </button>

                  {/* Actions buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* View Report / Gradebook Link */}
                    <Link
                      href={`/provas-online/${prova.id}/relatorio`}
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
                        textDecoration: 'none'
                      }}
                      title="Ver notas consolidadas e transferir para o Diário Oficial"
                    >
                      <Database size={13} />
                      <span>Diário & Notas</span>
                    </Link>

                    {/* Primary Button: Corrigir (matching screenshot style!) */}
                    <Link
                      href={`/provas-online/${prova.id}/corrigir`}
                      style={{
                        height: '34px',
                        padding: '0 16px',
                        borderRadius: '9px',
                        background: pendentes > 0 ? '#0284c7' : '#059669',
                        color: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 800,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        textDecoration: 'none',
                        boxShadow: pendentes > 0 ? '0 2px 8px rgba(2, 132, 199, 0.3)' : '0 2px 8px rgba(5, 150, 105, 0.25)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <CheckCircle2 size={15} />
                      <span>{pendentes > 0 ? 'Corrigir' : 'Ver Correções'}</span>
                      {pendentes > 0 && (
                        <span style={{
                          background: '#d97706',
                          color: '#ffffff',
                          fontSize: '10px',
                          fontWeight: 900,
                          padding: '1px 6px',
                          borderRadius: '99px',
                          lineHeight: 1
                        }}>
                          {pendentes}
                        </span>
                      )}
                    </Link>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* 6. MODAL: GABARITO OFICIAL & CRITÉRIOS DE AVALIAÇÃO */}
      <AnimatePresence>
        {gabaritoModalProva && (
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
            onClick={() => setGabaritoModalProva(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '740px',
                maxHeight: '85vh',
                overflowY: 'auto',
                background: '#ffffff',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#f0f9ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <BookOpen size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                      Gabarito Oficial & Espelho de Respostas
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                      {gabaritoModalProva.titulo} • {gabaritoModalProva.disciplina}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGabaritoModalProva(null)}
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
                >
                  <X size={16} color="#64748b" />
                </button>
              </div>

              {/* Questions List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '550px', overflowY: 'auto' }}>
                {(gabaritoModalProva.questoes || []).map((q: any, idx: number) => {
                  const isDissertativa = q.tipo === 'dissertativa'
                  return (
                    <div
                      key={q.id || idx}
                      style={{
                        background: '#fafafa',
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                          Questão #{idx + 1}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '99px',
                            background: isDissertativa ? '#fffbeb' : '#f0f9ff',
                            color: isDissertativa ? '#b45309' : '#0284c7',
                            border: `1px solid ${isDissertativa ? '#fde68a' : '#bae6fd'}`
                          }}>
                            {isDissertativa ? 'Dissertativa' : 'Objetiva'}
                          </span>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', fontFamily: 'monospace' }}>
                            {q.pontuacao || q.valorPontos || 1} pt(s)
                          </span>
                        </div>
                      </div>

                      {/* Enunciado */}
                      <div style={{ fontSize: '13px', color: '#1e293b' }}>
                        <HtmlContent html={q.enunciado} />
                      </div>

                      {/* Answer Key */}
                      {isDissertativa ? (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 12px' }}>
                          <span style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}>
                            Resposta Esperada / Critério:
                          </span>
                          <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.4 }}>
                            {q.respostaEsperada ? <HtmlContent html={q.respostaEsperada} /> : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Nenhum critério dissertativo cadastrado.</span>}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {(q.alternativas || []).map((alt: any) => (
                            <div
                              key={alt.id || alt.letra}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                background: alt.correta ? '#ecfdf5' : '#ffffff',
                                border: `1px solid ${alt.correta ? '#86efac' : '#e2e8f0'}`,
                                fontSize: '12px',
                                color: alt.correta ? '#065f46' : '#475569',
                                fontWeight: alt.correta ? 700 : 500
                              }}
                            >
                              <span style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '6px',
                                background: alt.correta ? '#059669' : '#f1f5f9',
                                color: alt.correta ? '#ffffff' : '#64748b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '11px',
                                flexShrink: 0
                              }}>
                                {alt.letra}
                              </span>
                              <span style={{ flex: 1 }}>{alt.texto}</span>
                              {alt.correta && (
                                <span style={{ fontSize: '10px', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>
                                  Gabarito Oficial
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Modal Footer */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                <Link
                  href={`/provas-online/${gabaritoModalProva.id}/corrigir`}
                  style={{
                    height: '36px',
                    padding: '0 18px',
                    borderRadius: '10px',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none'
                  }}
                >
                  <CheckCircle2 size={15} />
                  <span>Ir para Sala de Correção Desta Prova</span>
                </Link>

                <button
                  type="button"
                  onClick={() => setGabaritoModalProva(null)}
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
