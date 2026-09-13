'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  AlertTriangle, AlertCircle, CheckCircle2, ShieldCheck, FileText, 
  Filter, Search, Users, X, Clock, Sparkles, ChevronRight, Calendar, 
  ArrowRight, Eye, Check, Layers, UserCheck, ShieldAlert, MessageSquare
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useApiQuery } from '@/hooks/useApi'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'
import { UserAvatar } from '@/components/UserAvatar'
import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils'
import { useCollaboratorTurmas } from '../hooks/useCollaboratorTurmas'
import { TurmaDropdown } from '../components/TurmaDropdown'

export default function ColaboradorOcorrenciasPage() {
  const {
    effectiveUser,
    isMirrorMode,
    isMasterAdmin,
    turmas,
    activeTurmas,
    turmaOptions,
    selectedTurmaId,
    setSelectedTurmaId,
    selectedTurmaName,
    selectedAno,
    setSelectedAno,
    anosLetivos,
    anoVigente
  } = useCollaboratorTurmas()

  const queryClient = useQueryClient()
  const [mounted, setMounted] = useState(false)
  const [viewMode, setViewMode] = useState<'alunos' | 'timeline'>('alunos')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<any | null>(null)
  const [modalAno, setModalAno] = useState<string>('')
  const [expandedDescIds, setExpandedDescIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock body scroll when modal is open
  useEffect(() => {
    if (selectedStudentForModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [selectedStudentForModal])

  // Realtime updates
  useAgendaRealtime({
    table: 'ocorrencias',
    toastConfig: {
      enabled: true,
      insertMessage: () => 'Nova ocorrência registrada na turma!',
      updateMessage: () => 'Ocorrência disciplinar atualizada!',
      icon: <AlertTriangle size={18} color="#ef4444" />
    },
    onInsert: () => {
      queryClient.invalidateQueries({ queryKey: ['ocorrencias-colaborador'] })
    },
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['ocorrencias-colaborador'] })
    },
    onDelete: () => {
      queryClient.invalidateQueries({ queryKey: ['ocorrencias-colaborador'] })
    }
  })

  // 1. Fetch Students
  const { data: rawAlunos, isLoading: isLoadingAlunos } = useApiQuery<any>(
    ['alunos-colaborador-ocorrencias'],
    '/api/alunos?lightweight=true&all=true&limit=2000'
  )
  const allAlunos: any[] = useMemo(() => {
    if (!rawAlunos) return []
    if (Array.isArray(rawAlunos)) return rawAlunos
    if (Array.isArray(rawAlunos.data)) return rawAlunos.data
    return []
  }, [rawAlunos])

  // 2. Fetch Ocorrências
  const ocorrenciasQueryKey = useMemo(() => ['ocorrencias-colaborador'], [])
  const ocorrenciasEndpoint = '/api/ocorrencias?limit=3000'

  const { data: rawOcorrencias, isLoading: isLoadingOcorrencias, refetch: refetchOcorrencias } = useApiQuery<any>(
    ocorrenciasQueryKey,
    ocorrenciasEndpoint,
    undefined,
    { enabled: activeTurmas.length > 0 || isMasterAdmin, noCache: true }
  )

  useAgendaRealtime({
    table: 'ocorrencias',
    toastConfig: { enabled: false },
    onInsert: () => {
      queryClient.invalidateQueries({ queryKey: ['ocorrencias-colaborador'] })
      refetchOcorrencias()
    },
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['ocorrencias-colaborador'] })
      refetchOcorrencias()
    },
    onDelete: () => {
      queryClient.invalidateQueries({ queryKey: ['ocorrencias-colaborador'] })
      refetchOcorrencias()
    }
  })

  const allOcorrencias: any[] = useMemo(() => {
    if (!rawOcorrencias) return []
    const list = Array.isArray(rawOcorrencias) ? rawOcorrencias : (rawOcorrencias.data || [])
    return list.map((o: any) => {
      const ano = o.ano || (o.data ? o.data.substring(0, 4) : new Date(o.created_at || Date.now()).getFullYear().toString())
      const lowerGrav = (o.gravidade || '').toLowerCase()
      const gravidadeNorm = lowerGrav.includes('grav') ? 'grave' : lowerGrav.includes('med') ? 'media' : 'leve'
      const lowerTipo = (o.tipo || '').toLowerCase()
      const isElogio = lowerTipo.includes('elogio') || lowerTipo.includes('parabens') || lowerTipo.includes('parabéns')

      // Extrair linhas de lançamento
      const lines = (o.descricao || '').split('\n')
      let lancadoPor = ''
      const descLines: string[] = []
      lines.forEach((line: string) => {
        if (line.startsWith('[Lançado por:')) {
          lancadoPor = line.replace('[Lançado por: ', '').replace(']', '')
        } else if (!line.startsWith('[Editado por:') && !line.startsWith('[Confirmado por:')) {
          descLines.push(line)
        }
      })
      const cleanedDesc = descLines.join('\n').trim()

      return {
        ...o,
        anoStr: String(ano),
        gravidadeNorm,
        isElogio,
        cleanedDesc: cleanedDesc || o.descricao || '',
        lancadoPor: lancadoPor || o.responsavel || 'Coordenação',
        alunoIdStr: String(o.aluno_id || o.alunoId || '')
      }
    })
  }, [rawOcorrencias])

  // Filter students linked to collaborator's active/selected turmas
  const filteredTurmaStudents = useMemo(() => {
    if (!allAlunos.length || !activeTurmas.length) return []

    return allAlunos.filter(aluno => {
      if (aluno.status === 'inativo' || aluno.status === 'cancelado' || aluno.status === 'transferido') return false

      if (selectedTurmaId !== 'all') {
        const targetTurma = turmas.find(t => String(t.id) === String(selectedTurmaId))
        if (!targetTurma) return false
        return isAlunoCursandoTurma(aluno, targetTurma, targetTurma.ano || selectedAno, turmas)
      }

      return activeTurmas.some(t => isAlunoCursandoTurma(aluno, t, t.ano || selectedAno, turmas))
    })
  }, [allAlunos, selectedTurmaId, activeTurmas, selectedAno, turmas])

  // Map each student to their occurrences
  const studentsWithOcorrencias = useMemo(() => {
    return filteredTurmaStudents.map(aluno => {
      const alunoIdStr = String(aluno.id)
      const alunoSemZero = alunoIdStr.replace(/^0+/, '')

      // Find occurrences for this student
      const studentOcs = allOcorrencias.filter(o => 
        o.alunoIdStr === alunoIdStr || 
        o.alunoIdStr === alunoSemZero ||
        String(o.aluno_id) === alunoIdStr
      )

      // Filter by selected year
      const yearOcs = selectedAno && selectedAno !== 'todos'
        ? studentOcs.filter(o => o.anoStr === String(selectedAno))
        : studentOcs

      const sortedOcs = [...yearOcs].sort((a, b) => 
        new Date(b.created_at || b.data || 0).getTime() - new Date(a.created_at || a.data || 0).getTime()
      )

      const total = sortedOcs.length
      const graves = sortedOcs.filter(o => o.gravidadeNorm === 'grave').length
      const medias = sortedOcs.filter(o => o.gravidadeNorm === 'media').length
      const leves = sortedOcs.filter(o => o.gravidadeNorm === 'leve').length
      const pendentesCiencia = sortedOcs.filter(o => !o.ciencia_responsavel).length

      const latestOc = sortedOcs[0] || null

      const studentTurmaObj = activeTurmas.find(t => isAlunoCursandoTurma(aluno, t, t.ano || selectedAno, turmas)) ||
        turmas.find(t => String(t.id) === String(aluno.turma_id || aluno.turmaId || aluno.turma))
      const turmaDisplay = studentTurmaObj?.nome || aluno.turma_nome || aluno.turma || 'Turma não informada'

      return {
        ...aluno,
        turmaDisplay,
        ocorrencias: sortedOcs,
        allOcorrencias: studentOcs,
        totalOcorrencias: total,
        graves,
        medias,
        leves,
        pendentesCiencia,
        latestOc,
        hasOcorrencias: total > 0
      }
    })
  }, [filteredTurmaStudents, allOcorrencias, selectedAno, activeTurmas, turmas])

  // Filtered students for "Por Aluno" view
  const displayedStudents = useMemo(() => {
    return studentsWithOcorrencias.filter(st => {
      // 1. Search text filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase()
        const name = (st.nome || '').toLowerCase()
        const matricula = String(st.matricula || '').toLowerCase()
        const turma = (st.turmaDisplay || '').toLowerCase()
        const matchOcDesc = st.ocorrencias.some((o: any) => 
          (o.descricao || '').toLowerCase().includes(q) || (o.tipo || '').toLowerCase().includes(q)
        )
        if (!name.includes(q) && !matricula.includes(q) && !turma.includes(q) && !matchOcDesc) {
          return false
        }
      }

      return true
    }).sort((a, b) => {
      // Sort students with occurrences first, then by name
      if (b.totalOcorrencias !== a.totalOcorrencias) {
        return b.totalOcorrencias - a.totalOcorrencias
      }
      return (a.nome || '').localeCompare(b.nome || '')
    })
  }, [studentsWithOcorrencias, searchTerm])

  // Occurrences list for "Linha do Tempo da Turma" view
  const turmaTimelineOccurrences = useMemo(() => {
    // Collect all occurrences belonging to students in the active/selected turma
    const validStudentIds = new Set(filteredTurmaStudents.map(s => String(s.id)))
    const validStudentSemZero = new Set(filteredTurmaStudents.map(s => String(s.id).replace(/^0+/, '')))

    const matchedOcs = allOcorrencias.filter(o => 
      validStudentIds.has(o.alunoIdStr) || 
      validStudentSemZero.has(o.alunoIdStr) ||
      validStudentIds.has(String(o.aluno_id))
    )

    // Filter by selected year
    const yearFiltered = selectedAno && selectedAno !== 'todos'
      ? matchedOcs.filter(o => o.anoStr === String(selectedAno))
      : matchedOcs

    // Search filter
    const searched = yearFiltered.filter(o => {
      if (!searchTerm.trim()) return true
      const q = searchTerm.toLowerCase()
      const aluno = allAlunos.find(a => String(a.id) === o.alunoIdStr || String(a.id).replace(/^0+/, '') === o.alunoIdStr)
      const alunoNome = (aluno?.nome || '').toLowerCase()
      const tipo = (o.tipo || '').toLowerCase()
      const desc = (o.descricao || '').toLowerCase()
      const lanc = (o.lancadoPor || '').toLowerCase()
      return alunoNome.includes(q) || tipo.includes(q) || desc.includes(q) || lanc.includes(q)
    })

    // Sort by date desc
    return searched.sort((a, b) => {
      const dateA = a.data || a.created_at || ''
      const dateB = b.data || b.created_at || ''
      return new Date(dateB).getTime() - new Date(dateA).getTime()
    })
  }, [allOcorrencias, filteredTurmaStudents, selectedAno, searchTerm, allAlunos])

  // Group timeline by date
  const groupedTimeline = useMemo(() => {
    const groups: { date: string, items: any[] }[] = []
    turmaTimelineOccurrences.forEach(o => {
      const oDate = o.data || (o.created_at ? o.created_at.split('T')[0] : 'Data não informada')
      let group = groups.find(g => g.date === oDate)
      if (!group) {
        group = { date: oDate, items: [] }
        groups.push(group)
      }
      group.items.push(o)
    })
    return groups
  }, [turmaTimelineOccurrences])

  // Overall Statistics
  const stats = useMemo(() => {
    const validStudentIds = new Set(filteredTurmaStudents.map(s => String(s.id)))
    const validStudentSemZero = new Set(filteredTurmaStudents.map(s => String(s.id).replace(/^0+/, '')))

    const matchedOcs = allOcorrencias.filter(o => 
      validStudentIds.has(o.alunoIdStr) || 
      validStudentSemZero.has(o.alunoIdStr) ||
      validStudentIds.has(String(o.aluno_id))
    )

    const yearOcs = selectedAno && selectedAno !== 'todos'
      ? matchedOcs.filter(o => o.anoStr === String(selectedAno))
      : matchedOcs

    const total = yearOcs.length
    const graves = yearOcs.filter(o => o.gravidadeNorm === 'grave').length
    const medias = yearOcs.filter(o => o.gravidadeNorm === 'media').length
    const leves = yearOcs.filter(o => o.gravidadeNorm === 'leve').length
    const pendentes = yearOcs.filter(o => !o.ciencia_responsavel).length
    const exemplares = studentsWithOcorrencias.filter(s => s.totalOcorrencias === 0).length

    return { total, graves, medias, leves, pendentes, exemplares }
  }, [filteredTurmaStudents, allOcorrencias, selectedAno, studentsWithOcorrencias])

  // Student Drilldown Modal Data
  const modalStudentOcorrencias = useMemo(() => {
    if (!selectedStudentForModal) return []
    const alunoIdStr = String(selectedStudentForModal.id)
    const alunoSemZero = alunoIdStr.replace(/^0+/, '')
    return allOcorrencias.filter(o => 
      o.alunoIdStr === alunoIdStr || 
      o.alunoIdStr === alunoSemZero ||
      String(o.aluno_id) === alunoIdStr
    )
  }, [selectedStudentForModal, allOcorrencias])

  const modalAnosDisponiveis = useMemo(() => {
    const anos = modalStudentOcorrencias.map(o => o.anoStr)
    const unique = Array.from(new Set(anos)).sort((a, b) => b.localeCompare(a))
    if (!unique.length) {
      unique.push(selectedAno || new Date().getFullYear().toString())
    }
    return unique
  }, [modalStudentOcorrencias, selectedAno])

  useEffect(() => {
    if (selectedStudentForModal) {
      if (modalAnosDisponiveis.length > 0 && !modalAno) {
        setModalAno(modalAnosDisponiveis[0])
      }
    } else {
      setModalAno('')
    }
  }, [selectedStudentForModal, modalAnosDisponiveis, modalAno])

  const modalFilteredOcorrencias = useMemo(() => {
    if (!selectedStudentForModal) return []
    const filtered = modalStudentOcorrencias.filter(o => !modalAno || o.anoStr === modalAno)
    return [...filtered].sort((a, b) => 
      new Date(b.created_at || b.data || 0).getTime() - new Date(a.created_at || a.data || 0).getTime()
    )
  }, [selectedStudentForModal, modalStudentOcorrencias, modalAno])

  const formatDateSeparator = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00')
      const today = new Date()
      const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
      const parts = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).split(' de ')
      let monthShort = (parts[1] || '').replace('.', '').substring(0, 3)
      const formatted = `${parts[0]} de ${monthShort}.`
      if (isToday) return `Hoje, ${formatted}`
      return formatted
    } catch {
      return dateStr
    }
  }

  return (
    <div className="ocorrencias-page-container" style={{ padding: '24px 20px 100px 20px', minHeight: '100vh', background: 'transparent', fontFamily: 'Outfit, Inter, sans-serif' }}>
      
      {/* 1. Header & Turma Selector */}
      <div className="ocorrencias-header-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div className="ocorrencias-header-icon" style={{ 
              width: 38, 
              height: 38, 
              borderRadius: 12, 
              background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(249,115,22,0.15)' 
            }}>
              <AlertTriangle size={22} color="#f97316" />
            </div>
            <h1 className="ocorrencias-header-title" style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Ocorrências Disciplinares
            </h1>
          </div>
          <p className="ocorrencias-header-subtitle" style={{ margin: 0, fontSize: 14, color: '#64748b', fontWeight: 500 }}>
            {selectedTurmaName} • Ano Letivo {selectedAno}
          </p>
        </div>

        {/* Dropdown de Turmas e Ano Letivo */}
        <div style={{ minWidth: 260, maxWidth: 380, width: '100%' }}>
          <TurmaDropdown
            turmaOptions={turmaOptions}
            selectedTurmaId={selectedTurmaId}
            setSelectedTurmaId={setSelectedTurmaId}
            selectedTurmaName={selectedTurmaName}
            anosLetivos={anosLetivos}
            selectedAno={selectedAno}
            setSelectedAno={setSelectedAno}
            anoVigente={anoVigente}
            allLabel="Todas as Minhas Turmas"
          />
        </div>
      </div>



      {/* 3. View Switcher & Filter Toolbar */}
      <div className="ocorrencias-filter-card" style={{
        background: '#ffffff',
        borderRadius: 20,
        padding: '16px 20px',
        border: '1px solid #f1f5f9',
        boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
        marginBottom: 24,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        {/* Left: View Mode Segmented Control */}
        <div style={{
          display: 'flex',
          background: '#f1f5f9',
          padding: 4,
          borderRadius: 14,
          gap: 4
        }}>
          <button
            onClick={() => setViewMode('alunos')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 11,
              border: 'none',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              background: viewMode === 'alunos' ? '#ffffff' : 'transparent',
              color: viewMode === 'alunos' ? '#0f172a' : '#64748b',
              boxShadow: viewMode === 'alunos' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Users size={16} color={viewMode === 'alunos' ? '#2563eb' : '#64748b'} />
            <span>Por Aluno da Turma</span>
          </button>

          <button
            onClick={() => setViewMode('timeline')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 11,
              border: 'none',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              background: viewMode === 'timeline' ? '#ffffff' : 'transparent',
              color: viewMode === 'timeline' ? '#0f172a' : '#64748b',
              boxShadow: viewMode === 'timeline' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            <Clock size={16} color={viewMode === 'timeline' ? '#2563eb' : '#64748b'} />
            <span>Linha do Tempo Geral</span>
          </button>
        </div>

        {/* Right: Search Input */}
        <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 400 }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder={viewMode === 'alunos' ? "Buscar aluno por nome ou matrícula..." : "Buscar por aluno, tipo ou motivo..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 42px',
              borderRadius: 14,
              border: '1px solid #e2e8f0',
              fontSize: 14,
              fontWeight: 500,
              color: '#0f172a',
              background: '#f8fafc',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8'
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 4. CONTENT AREA */}
      {isLoadingAlunos || isLoadingOcorrencias ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
          <div style={{ 
            width: 44, 
            height: 44, 
            border: '4px solid rgba(249,115,22,0.15)', 
            borderTopColor: '#f97316', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite' 
          }} />
          <span style={{ color: '#64748b', fontSize: 15, fontWeight: 600 }}>
            Carregando registros disciplinares da turma...
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : viewMode === 'alunos' ? (
        /* MODE 1: LISTAR POR ALUNO DA TURMA */
        displayedStudents.length === 0 ? (
          <div style={{
            background: '#ffffff',
            borderRadius: 24,
            padding: '60px 20px',
            textAlign: 'center',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <ShieldCheck size={32} color="#059669" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
              Nenhum aluno encontrado
            </h3>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0, maxWidth: 440, lineHeight: 1.6 }}>
              {turmas.length === 0
                ? 'Você não possui turmas vinculadas ao seu usuário no momento. As ocorrências serão exibidas assim que suas turmas forem associadas ao seu perfil.'
                : searchTerm 
                  ? `Nenhum aluno com os critérios pesquisados.`
                  : 'Não há registros disciplinares para os filtros selecionados.'}
            </p>
          </div>
        ) : (
          <div className="ocorrencias-students-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16
          }}>
            {displayedStudents.map((st, idx) => {
              const hasGraves = st.graves > 0
              const hasMedias = st.medias > 0
              const badgeBg = hasGraves ? '#fee2e2' : hasMedias ? '#ffedd5' : st.hasOcorrencias ? '#fef3c7' : '#ecfdf5'
              const badgeColor = hasGraves ? '#dc2626' : hasMedias ? '#ea580c' : st.hasOcorrencias ? '#d97706' : '#059669'

              return (
                <motion.div
                  key={st.id}
                  className="ocorrencias-student-card"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(idx * 0.03, 0.5) }}
                  whileHover={{ y: -3, boxShadow: '0 12px 28px rgba(0,0,0,0.06)' }}
                  onClick={() => setSelectedStudentForModal(st)}
                  style={{
                    background: '#ffffff',
                    borderRadius: 22,
                    border: '1px solid #f1f5f9',
                    padding: '20px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 16,
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Top Info */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div className="ocorrencias-student-avatar">
                      <UserAvatar
                        userId={st.id}
                        name={st.nome || 'Aluno'}
                        fotoUrl={st.foto || st.avatar_url || st.avatar}
                        size={46}
                        className="shadow-sm"
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 className="ocorrencias-student-name" style={{ 
                        fontSize: 16, 
                        fontWeight: 800, 
                        color: '#0f172a', 
                        margin: '0 0 4px 0',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {st.nome}
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ 
                          fontSize: 12, 
                          fontWeight: 700, 
                          color: '#2563eb', 
                          background: '#eff6ff', 
                          padding: '2px 8px', 
                          borderRadius: 6 
                        }}>
                          {st.turmaDisplay}
                        </span>
                        {st.matricula && (
                          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                            Matr: {st.matricula}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Occurrences Pill Section */}
                  <div className="ocorrencias-pill-section" style={{
                    background: '#f8fafc',
                    borderRadius: 16,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid #f1f5f9'
                  }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Histórico Disciplinar
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <span style={{
                          fontSize: 12,
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: badgeBg,
                          color: badgeColor
                        }}>
                          {st.totalOcorrencias === 0 ? 'Exemplar (0)' : `${st.totalOcorrencias} ${st.totalOcorrencias === 1 ? 'ocorrência' : 'ocorrências'}`}
                        </span>

                        {st.pendentesCiencia > 0 && (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: '#fee2e2',
                            color: '#dc2626'
                          }}>
                            {st.pendentesCiencia} sem ciência
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ocorrencias-action-btn" style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#0f172a',
                      background: '#ffffff',
                      padding: '8px 12px',
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                    }}>
                      <span>Ver Histórico</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )
      ) : (
        /* MODE 2: LINHA DO TEMPO GERAL DA TURMA */
        turmaTimelineOccurrences.length === 0 ? (
          <div style={{
            background: '#ffffff',
            borderRadius: 24,
            padding: '60px 20px',
            textAlign: 'center',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16
            }}>
              <ShieldCheck size={32} color="#059669" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
              Nenhuma ocorrência registrada
            </h3>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0, maxWidth: 400 }}>
              Os alunos desta turma não possuem registros disciplinares para os filtros aplicados. Excelente sinal de comportamento!
            </p>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Linha vertical da Timeline */}
            <div style={{ position: 'absolute', top: 32, bottom: 0, left: 16, width: 2, background: '#e2e8f0', zIndex: 0 }} />

            {groupedTimeline.map((group) => (
              <div key={group.date} style={{ marginBottom: 28 }}>
                {/* Separador de Data */}
                <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0 20px 0', position: 'relative', zIndex: 1 }}>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                  <div style={{ 
                    padding: '4px 16px', 
                    fontSize: 13, 
                    fontWeight: 800, 
                    color: '#475569',
                    background: '#f8fafc',
                    borderRadius: 20,
                    border: '1px solid #e2e8f0'
                  }}>
                    {formatDateSeparator(group.date)}
                  </div>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>

                {/* Itens do grupo */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {group.items.map((o) => {
                    const aluno = allAlunos.find(a => String(a.id) === o.alunoIdStr || String(a.id).replace(/^0+/, '') === o.alunoIdStr)
                    const isGrave = o.gravidadeNorm === 'grave'
                    const isMedia = o.gravidadeNorm === 'media'
                    const dotColor = isGrave ? '#ef4444' : isMedia ? '#f97316' : '#f59e0b'
                    const badgeBg = isGrave ? '#fee2e2' : isMedia ? '#ffedd5' : '#fef3c7'
                    const badgeColor = isGrave ? '#dc2626' : isMedia ? '#ea580c' : '#d97706'
                    const isExpanded = !!expandedDescIds[o.id]
                    const descText = o.cleanedDesc || ''
                    const shouldTruncate = descText.length > 120 && !isExpanded

                    return (
                      <motion.div
                        key={o.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        style={{ position: 'relative', paddingLeft: 44 }}
                      >
                        {/* Dot */}
                        <div style={{
                          position: 'absolute',
                          left: 16,
                          top: 26,
                          transform: 'translate(-50%, -50%)',
                          zIndex: 2,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: '#ffffff',
                          border: `2px solid ${dotColor}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 0 0 4px #ffffff'
                        }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor }} />
                        </div>

                        {/* Card */}
                        <div style={{
                          background: '#ffffff',
                          borderRadius: 20,
                          border: '1px solid #f1f5f9',
                          padding: '20px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
                        }}>
                          {/* Header: Aluno + Gravidade */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                            <div 
                              style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: aluno ? 'pointer' : 'default' }}
                              onClick={() => aluno && setSelectedStudentForModal(aluno)}
                            >
                              <UserAvatar
                                userId={aluno?.id}
                                name={aluno?.nome || 'Aluno'}
                                fotoUrl={aluno?.foto || aluno?.avatar_url || aluno?.avatar}
                                size={40}
                              />
                              <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                                  {aluno?.nome || 'Aluno'}
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                                  {o.turmaNome || 'Turma'} • Matr: {aluno?.matricula || '-'}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{
                                fontSize: 11,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                padding: '4px 10px',
                                borderRadius: 8,
                                background: badgeBg,
                                color: badgeColor
                              }}>
                                {o.gravidade ? o.gravidade.toUpperCase() : (isGrave ? 'GRAVE' : isMedia ? 'MÉDIA' : 'LEVE')}
                              </span>

                              {o.ciencia_responsavel ? (
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '4px 8px',
                                  borderRadius: 8,
                                  background: '#ecfdf5',
                                  color: '#059669',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}>
                                  <Check size={12} strokeWidth={3} />
                                  <span>Ciência assinada</span>
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: '4px 8px',
                                  borderRadius: 8,
                                  background: '#fee2e2',
                                  color: '#dc2626',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}>
                                  <Clock size={12} />
                                  <span>Sem ciência</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Tipo e Lançador */}
                          <div style={{
                            background: '#f8fafc',
                            borderRadius: 14,
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: 12,
                            flexWrap: 'wrap',
                            gap: 8
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <FileText size={16} color="#6366f1" />
                              <strong style={{ fontSize: 13, color: '#0f172a' }}>{o.tipo || 'Ocorrência'}</strong>
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b' }}>
                              Registrado por: <strong style={{ color: '#475569' }}>{o.lancadoPor}</strong>
                            </div>
                          </div>

                          {/* Descrição */}
                          <div style={{ fontSize: 14, color: '#334155', lineHeight: 1.6, background: '#ffffff', padding: '4px 0' }}>
                            {shouldTruncate ? descText.slice(0, 120).trim() + '...' : descText}
                            {descText.length > 120 && (
                              <button
                                onClick={() => setExpandedDescIds(prev => ({ ...prev, [o.id]: !prev[o.id] }))}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#2563eb',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  padding: 0,
                                  marginLeft: 6
                                }}
                              >
                                {isExpanded ? 'Ver menos' : 'Ver mais'}
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* 5. MODAL: DETALHES DAS OCORRÊNCIAS DO ALUNO SELECIONADO */}
      {mounted && selectedStudentForModal && createPortal(
        <AnimatePresence>
          <div className="ocorrencias-modal-container" style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)'
          }}>
            {/* Backdrop click */}
            <div 
              style={{ position: 'absolute', inset: 0 }} 
              onClick={() => setSelectedStudentForModal(null)} 
            />

            {/* Modal Box */}
            <motion.div
              className="ocorrencias-modal-card"
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 780,
                maxHeight: '90vh',
                backgroundColor: '#ffffff',
                borderRadius: 28,
                boxShadow: '0 25px 60px -15px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 10
              }}
            >
              {/* Modal Header */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#ffffff'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <UserAvatar
                    userId={selectedStudentForModal.id}
                    name={selectedStudentForModal.nome || 'Aluno'}
                    fotoUrl={selectedStudentForModal.foto || selectedStudentForModal.avatar_url || selectedStudentForModal.avatar}
                    size={48}
                  />
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                      {selectedStudentForModal.nome}
                    </h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: 6 }}>
                        {selectedStudentForModal.turmaDisplay}
                      </span>
                      {selectedStudentForModal.matricula && (
                        <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
                          Matrícula: {selectedStudentForModal.matricula}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedStudentForModal(null)}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Subheader: Ano Selector */}
              <div style={{
                padding: '12px 24px',
                background: '#f8fafc',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>
                  Histórico de Registros Disciplinares
                </div>
                {modalAnosDisponiveis.length > 1 ? (
                  <select
                    value={modalAno}
                    onChange={(e) => setModalAno(e.target.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#0f172a',
                      background: '#ffffff',
                      outline: 'none'
                    }}
                  >
                    {modalAnosDisponiveis.map(ano => (
                      <option key={ano} value={ano}>{ano}</option>
                    ))}
                  </select>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
                    Ano: <strong style={{ color: '#0f172a' }}>{modalAno || selectedAno}</strong>
                  </span>
                )}
              </div>

              {/* Modal Body */}
              <div style={{
                padding: '24px',
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}>
                {modalFilteredOcorrencias.length === 0 ? (
                  /* HISTÓRICO EXEMPLAR (Igual família) */
                  <div style={{
                    padding: '50px 20px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'linear-gradient(145deg, #ffffff 0%, #f0fdf4 100%)',
                    borderRadius: 24,
                    border: '1px solid #dcfce7'
                  }}>
                    <div style={{
                      width: 72,
                      height: 72,
                      borderRadius: '50%',
                      background: '#ecfdf5',
                      border: '2px solid #a7f3d0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16,
                      position: 'relative'
                    }}>
                      <ShieldCheck size={36} color="#059669" />
                      <div style={{
                        position: 'absolute',
                        top: -4,
                        right: -4,
                        background: '#ffffff',
                        borderRadius: '50%',
                        padding: 4,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                      }}>
                        <Sparkles size={14} color="#10b981" />
                      </div>
                    </div>

                    <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', margin: '0 0 8px 0' }}>
                      Histórico Exemplar
                    </h3>
                    <p style={{ fontSize: 14, color: '#64748b', margin: 0, maxWidth: 380, lineHeight: 1.5 }}>
                      Tudo certo por aqui! Não existem ocorrências registradas para este aluno no período {modalAno || selectedAno}.
                    </p>
                  </div>
                ) : (
                  /* Timeline do Aluno */
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 20, bottom: 0, left: 14, width: 2, background: '#e2e8f0', zIndex: 0 }} />

                    {modalFilteredOcorrencias.map((o) => {
                      const isGrave = o.gravidadeNorm === 'grave'
                      const isMedia = o.gravidadeNorm === 'media'
                      const dotColor = isGrave ? '#ef4444' : isMedia ? '#f97316' : '#f59e0b'
                      const badgeBg = isGrave ? '#fee2e2' : isMedia ? '#ffedd5' : '#fef3c7'
                      const badgeColor = isGrave ? '#dc2626' : isMedia ? '#ea580c' : '#d97706'
                      const isExpanded = !!expandedDescIds[o.id]
                      const descText = o.cleanedDesc || ''
                      const shouldTruncate = descText.length > 140 && !isExpanded

                      return (
                        <div key={o.id} style={{ position: 'relative', paddingLeft: 40, marginBottom: 20 }}>
                          {/* Dot */}
                          <div style={{
                            position: 'absolute',
                            left: 14,
                            top: 24,
                            transform: 'translate(-50%, -50%)',
                            zIndex: 2,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: '#ffffff',
                            border: `2px solid ${dotColor}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 0 3px #ffffff'
                          }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
                          </div>

                          {/* Card */}
                          <div style={{
                            background: '#ffffff',
                            borderRadius: 18,
                            border: '1px solid #f1f5f9',
                            padding: '18px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ 
                                  width: 32, 
                                  height: 32, 
                                  borderRadius: 10, 
                                  background: isGrave ? '#fee2e2' : '#ffedd5', 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  justifyContent: 'center' 
                                }}>
                                  <AlertTriangle size={16} color={dotColor} />
                                </div>
                                <div>
                                  <h4 style={{ fontSize: 15, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                                    {o.tipo || 'Ocorrência'}
                                  </h4>
                                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                                    {o.data ? formatDateSeparator(o.data) : ''}
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  textTransform: 'uppercase',
                                  padding: '3px 8px',
                                  borderRadius: 6,
                                  background: badgeBg,
                                  color: badgeColor
                                }}>
                                  {o.gravidade ? o.gravidade.toUpperCase() : (isGrave ? 'GRAVE' : isMedia ? 'MÉDIA' : 'LEVE')}
                                </span>

                                {o.ciencia_responsavel ? (
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '3px 6px',
                                    borderRadius: 6,
                                    background: '#ecfdf5',
                                    color: '#059669',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 3
                                  }}>
                                    <Check size={11} strokeWidth={3} />
                                    <span>Ciência</span>
                                  </span>
                                ) : (
                                  <span style={{
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: '3px 6px',
                                    borderRadius: 6,
                                    background: '#fee2e2',
                                    color: '#dc2626'
                                  }}>
                                    Sem ciência
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Lançado por */}
                            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10, background: '#f8fafc', padding: '6px 12px', borderRadius: 8 }}>
                              Lançado por: <strong style={{ color: '#334155' }}>{o.lancadoPor}</strong>
                            </div>

                            {/* Descrição */}
                            <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.6, margin: 0 }}>
                              {shouldTruncate ? descText.slice(0, 140).trim() + '...' : descText}
                              {descText.length > 140 && (
                                <button
                                  onClick={() => setExpandedDescIds(prev => ({ ...prev, [o.id]: !prev[o.id] }))}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#2563eb',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    padding: 0,
                                    marginLeft: 6
                                  }}
                                >
                                  {isExpanded ? 'Ver menos' : 'Ver mais'}
                                </button>
                              )}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* Responsive Styles */}
      <style dangerouslySetInnerHTML={{__html:`
        @media (max-width: 640px) {
          .ocorrencias-page-container {
            padding: 12px 10px 80px 10px !important;
          }
          .ocorrencias-header-wrapper {
            margin-bottom: 12px !important;
            gap: 10px !important;
          }
          .ocorrencias-header-title {
            font-size: 18px !important;
          }
          .ocorrencias-header-subtitle {
            font-size: 12px !important;
          }
          .ocorrencias-header-icon {
            width: 32px !important;
            height: 32px !important;
            border-radius: 10px !important;
          }
          .ocorrencias-header-icon svg {
            width: 18px !important;
            height: 18px !important;
          }

          /* Filter & view switcher */
          .ocorrencias-filter-card {
            padding: 10px 10px !important;
            border-radius: 14px !important;
            margin-bottom: 12px !important;
            gap: 8px !important;
          }

          /* Students grid */
          .ocorrencias-students-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .ocorrencias-student-card {
            padding: 10px 12px !important;
            border-radius: 14px !important;
            gap: 8px !important;
          }
          .ocorrencias-student-name {
            font-size: 14.5px !important;
          }
          .ocorrencias-pill-section {
            padding: 8px 10px !important;
            border-radius: 12px !important;
          }
          .ocorrencias-action-btn {
            padding: 6px 10px !important;
            font-size: 11px !important;
            border-radius: 9px !important;
          }

          /* Modal bottom sheet on mobile */
          .ocorrencias-modal-container {
            padding: 0 !important;
            align-items: flex-end !important;
          }
          .ocorrencias-modal-card {
            max-height: 92vh !important;
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
          }
        }
      `}} />
    </div>
  )
}
