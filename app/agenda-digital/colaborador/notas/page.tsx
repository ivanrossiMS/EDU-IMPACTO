'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  GraduationCap, Download, ChevronRight, ChevronDown, TrendingUp, TrendingDown, 
  AlertCircle, FileText, BarChart2, Sparkles, Search, Filter, Users, X,
  CheckCircle2, ArrowRight, Printer, AlertTriangle, BookOpen
} from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useApiQuery } from '@/hooks/useApi'
import { useAgendaRealtime } from '@/hooks/useAgendaRealtime'
import { UserAvatar } from '@/components/UserAvatar'
import { isAlunoCursandoTurma } from '@/lib/studentTurmaUtils'
import { useCollaboratorTurmas } from '../hooks/useCollaboratorTurmas'
import { TurmaDropdown } from '../components/TurmaDropdown'

export default function ColaboradorNotasPage() {
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
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPerformance, setFilterPerformance] = useState<'todos' | 'com_boletim' | 'acima' | 'abaixo' | 'sem_boletim'>('todos')
  const [selectedStudentForModal, setSelectedStudentForModal] = useState<any | null>(null)
  const [modalBimestreId, setModalBimestreId] = useState<string | null>(null)
  const [modalAno, setModalAno] = useState<string>('')

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

  // Realtime updates on boletins table
  useAgendaRealtime({
    table: 'boletins',
    toastConfig: {
      enabled: true,
      insertMessage: () => 'Novo boletim lançado!',
      updateMessage: () => 'Boletim escolar atualizado!',
      icon: <GraduationCap size={18} color="#2563eb" />
    },
    onInsert: () => {
      queryClient.invalidateQueries({ queryKey: ['boletins-colaborador'] })
    },
    onUpdate: () => {
      queryClient.invalidateQueries({ queryKey: ['boletins-colaborador'] })
    },
    onDelete: () => {
      queryClient.invalidateQueries({ queryKey: ['boletins-colaborador'] })
    }
  })

  // 1. Fetch Students
  const { data: rawAlunos, isLoading: isLoadingAlunos } = useApiQuery<any>(
    ['alunos-colaborador-notas'],
    '/api/alunos?lightweight=true&all=true&limit=2000'
  )
  const allAlunos: any[] = useMemo(() => {
    if (!rawAlunos) return []
    if (Array.isArray(rawAlunos)) return rawAlunos
    if (Array.isArray(rawAlunos.data)) return rawAlunos.data
    return []
  }, [rawAlunos])

  // 2. Fetch Boletins
  // When specific turma is selected, query by turma_id. Otherwise query all.
  const boletinsQueryKey = useMemo(() => ['boletins-colaborador', selectedTurmaId, selectedAno], [selectedTurmaId, selectedAno])
  const boletinsEndpoint = useMemo(() => {
    if (selectedTurmaId !== 'all') {
      return `/api/boletins?turma_id=${selectedTurmaId}`
    }
    if (activeTurmas.length > 0) {
      const ids = activeTurmas.map(t => t.id).join(',')
      return `/api/boletins?turma_ids=${ids}`
    }
    return '/api/boletins'
  }, [selectedTurmaId, activeTurmas])

  const { data: rawBoletins, isLoading: isLoadingBoletins } = useApiQuery<any>(
    boletinsQueryKey,
    boletinsEndpoint,
    undefined,
    { enabled: activeTurmas.length > 0 || isMasterAdmin }
  )

  const allBoletins: any[] = useMemo(() => {
    if (!rawBoletins) return []
    const list = Array.isArray(rawBoletins) ? rawBoletins : (rawBoletins.data || [])
    return list.map((b: any) => {
      let parsedDados = b.dados
      if (typeof parsedDados === 'string') {
        try {
          parsedDados = JSON.parse(parsedDados)
        } catch {
          parsedDados = {}
        }
      } else if (!parsedDados) {
        parsedDados = {}
      }

      const ano = parsedDados.ano || (b.created_at ? new Date(b.created_at).getFullYear().toString() : '2026')
      const tId = b.turma_id || b.turma
      const tObj = turmas.find(t => String(t.id) === String(tId) || String(t.codigo) === String(tId) || String(t.nome) === String(tId))
      const nomeTurma = b.turmaNome || tObj?.nome || b.turma || 'Sem Turma'

      return {
        ...b,
        parsedDados,
        anoStr: String(ano),
        nomeTurma,
        alunoIdStr: String(b.aluno_id || b.alunoId || '')
      }
    })
  }, [rawBoletins, turmas])

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

      // 'all' active turmas
      return activeTurmas.some(t => isAlunoCursandoTurma(aluno, t, t.ano || selectedAno, turmas))
    })
  }, [allAlunos, selectedTurmaId, activeTurmas, selectedAno, turmas])

  // Map each student to their latest boletim summary
  const studentsWithGrades = useMemo(() => {
    return filteredTurmaStudents.map(aluno => {
      const alunoIdStr = String(aluno.id)
      const alunoSemZero = alunoIdStr.replace(/^0+/, '')

      // Find all boletins for this student
      const studentBoletins = allBoletins.filter(b => 
        b.alunoIdStr === alunoIdStr || 
        b.alunoIdStr === alunoSemZero || 
        String(b.aluno_id) === alunoIdStr
      )

      // Filter by current selected year if specified
      const yearBoletins = selectedAno 
        ? studentBoletins.filter(b => b.anoStr === String(selectedAno))
        : studentBoletins

      // Get latest or primary boletim
      const latestBoletim = yearBoletins.sort((a, b) => 
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      )[0] || null

      let mediaGeral: number | null = null
      let totalDisciplinas = 0
      let disciplinasList: any[] = []

      if (latestBoletim && latestBoletim.parsedDados?.disciplinas) {
        disciplinasList = latestBoletim.parsedDados.disciplinas.map((d: any) => {
          let num = 0
          const val = String(d.mediaF || '').trim()
          if (val.toLowerCase() === 'dez') {
            num = 10
          } else {
            num = parseFloat(val.replace(',', '.')) || 0
          }
          return { ...d, mediaFNum: num }
        })

        if (disciplinasList.length > 0) {
          totalDisciplinas = disciplinasList.length
          const sum = disciplinasList.reduce((acc: number, curr: any) => acc + curr.mediaFNum, 0)
          mediaGeral = parseFloat((sum / disciplinasList.length).toFixed(1))
        }
      }

      // Determine turma name for student
      const studentTurmaObj = activeTurmas.find(t => isAlunoCursandoTurma(aluno, t, t.ano || selectedAno, turmas)) ||
        turmas.find(t => String(t.id) === String(aluno.turma_id || aluno.turmaId || aluno.turma))
      const turmaDisplay = studentTurmaObj?.nome || aluno.turma_nome || aluno.turma || 'Turma não informada'

      return {
        ...aluno,
        turmaDisplay,
        hasBoletim: !!latestBoletim,
        latestBoletim,
        allBoletins: studentBoletins,
        mediaGeral,
        totalDisciplinas,
        isAcima: mediaGeral !== null ? mediaGeral >= 7.0 : false
      }
    })
  }, [filteredTurmaStudents, allBoletins, selectedAno, activeTurmas, turmas])

  // Search and Performance Filtering
  const displayedStudents = useMemo(() => {
    return studentsWithGrades.filter(st => {
      // 1. Search text filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const name = (st.nome || '').toLowerCase()
        const matricula = String(st.matricula || '').toLowerCase()
        const turma = (st.turmaDisplay || '').toLowerCase()
        if (!name.includes(query) && !matricula.includes(query) && !turma.includes(query)) {
          return false
        }
      }

      // 2. Performance filter
      if (filterPerformance === 'com_boletim') {
        return st.hasBoletim
      }
      if (filterPerformance === 'acima') {
        return st.hasBoletim && st.mediaGeral !== null && st.mediaGeral >= 7.0
      }
      if (filterPerformance === 'abaixo') {
        return st.hasBoletim && st.mediaGeral !== null && st.mediaGeral < 7.0
      }
      if (filterPerformance === 'sem_boletim') {
        return !st.hasBoletim
      }

      return true
    }).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''))
  }, [studentsWithGrades, searchTerm, filterPerformance])

  // Overall Class Statistics
  const stats = useMemo(() => {
    const total = studentsWithGrades.length
    const withBoletim = studentsWithGrades.filter(s => s.hasBoletim)
    const above = withBoletim.filter(s => s.mediaGeral !== null && s.mediaGeral >= 7.0)
    const below = withBoletim.filter(s => s.mediaGeral !== null && s.mediaGeral < 7.0)

    let globalAvg = 0
    if (withBoletim.length > 0) {
      const sum = withBoletim.reduce((acc, curr) => acc + (curr.mediaGeral || 0), 0)
      globalAvg = parseFloat((sum / withBoletim.length).toFixed(1))
    }

    return {
      total,
      withBoletimCount: withBoletim.length,
      aboveCount: above.length,
      abovePercent: total > 0 ? Math.round((above.length / total) * 100) : 0,
      belowCount: below.length,
      belowPercent: total > 0 ? Math.round((below.length / total) * 100) : 0,
      globalAvg
    }
  }, [studentsWithGrades])

  // Modal Student Boletins Handling
  const modalStudentBoletins = useMemo(() => {
    if (!selectedStudentForModal) return []
    const alunoIdStr = String(selectedStudentForModal.id)
    const alunoSemZero = alunoIdStr.replace(/^0+/, '')
    return allBoletins.filter(b => 
      b.alunoIdStr === alunoIdStr || 
      b.alunoIdStr === alunoSemZero || 
      String(b.aluno_id) === alunoIdStr
    )
  }, [selectedStudentForModal, allBoletins])

  const modalAnosDisponiveis = useMemo(() => {
    const anos = modalStudentBoletins.map(b => b.anoStr)
    const unique = Array.from(new Set(anos)).sort((a, b) => b.localeCompare(a))
    if (!unique.length) {
      unique.push(selectedAno || new Date().getFullYear().toString())
    }
    return unique
  }, [modalStudentBoletins, selectedAno])

  useEffect(() => {
    if (selectedStudentForModal) {
      if (modalAnosDisponiveis.length > 0 && !modalAno) {
        setModalAno(modalAnosDisponiveis[0])
      }
    } else {
      setModalAno('')
      setModalBimestreId(null)
    }
  }, [selectedStudentForModal, modalAnosDisponiveis, modalAno])

  const modalBimestresDisponiveis = useMemo(() => {
    if (!selectedStudentForModal) return []
    const filtered = modalStudentBoletins.filter(b => !modalAno || b.anoStr === modalAno)
    const sorted = [...filtered].sort((a, b) => 
      new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )

    const list = sorted.map(b => ({
      id: b.id,
      nome: b.parsedDados.bimestre || 'Bimestre',
      dados: b.parsedDados,
      originalTitle: b.parsedDados.bimestre || 'Bimestre',
      nomeTurma: b.nomeTurma
    }))

    return list.sort((a, b) => a.originalTitle.localeCompare(b.originalTitle))
  }, [selectedStudentForModal, modalStudentBoletins, modalAno])

  // Auto-select first available bimestre in modal
  useEffect(() => {
    if (modalBimestresDisponiveis.length > 0) {
      const exists = modalBimestresDisponiveis.some(b => b.id === modalBimestreId)
      if (!exists || !modalBimestreId) {
        setModalBimestreId(modalBimestresDisponiveis[0].id)
      }
    } else {
      setModalBimestreId(null)
    }
  }, [modalBimestresDisponiveis, modalBimestreId])

  const currentModalBoletim = useMemo(() => {
    if (!modalBimestreId) return null
    return modalBimestresDisponiveis.find(b => b.id === modalBimestreId) || null
  }, [modalBimestreId, modalBimestresDisponiveis])

  const modalDisciplinas = useMemo(() => {
    if (!currentModalBoletim || !currentModalBoletim.dados.disciplinas) return []
    return currentModalBoletim.dados.disciplinas.map((d: any) => {
      let num = 0
      const val = String(d.mediaF || '').trim()
      if (val.toLowerCase() === 'dez') {
        num = 10
      } else {
        num = parseFloat(val.replace(',', '.')) || 0
      }
      return { ...d, mediaFNum: num }
    })
  }, [currentModalBoletim])

  const modalMediaGlobal = useMemo(() => {
    if (!modalDisciplinas.length) return 0
    const sum = modalDisciplinas.reduce((acc: number, curr: any) => acc + curr.mediaFNum, 0)
    return parseFloat((sum / modalDisciplinas.length).toFixed(1))
  }, [modalDisciplinas])

  const isModalMediaAcima = modalMediaGlobal >= 7.0

  return (
    <div className="notas-page-container" style={{ padding: '24px 20px 100px 20px', minHeight: '100vh', background: 'transparent', fontFamily: 'Outfit, Inter, sans-serif' }}>
      
      {/* 1. Header & Turma Selector */}
      <div className="notas-header-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div className="notas-header-icon" style={{ 
              width: 38, 
              height: 38, 
              borderRadius: 12, 
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(37,99,235,0.12)' 
            }}>
              <GraduationCap size={22} color="#2563eb" />
            </div>
            <h1 className="notas-header-title" style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
              Boletins e Rendimento Escolar
            </h1>
          </div>
          <p className="notas-header-subtitle" style={{ margin: 0, fontSize: 14, color: '#64748b', fontWeight: 500 }}>
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

      {/* 2. KPI Cards */}
      <div className="notas-kpi-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
        gap: 16, 
        marginBottom: 28 
      }}>
        {/* Total Alunos */}
        <motion.div 
          className="notas-kpi-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: '18px 20px',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}
        >
          <div className="notas-kpi-icon-box" style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 14, 
            background: '#f8fafc', 
            border: '1px solid #e2e8f0', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Users size={22} color="#475569" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="notas-kpi-label" style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Alunos na Turma
            </div>
            <div className="notas-kpi-value" style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
              {isLoadingAlunos ? '...' : stats.total}
            </div>
            <div className="notas-kpi-sub" style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              {stats.withBoletimCount} com boletim lançado
            </div>
          </div>
        </motion.div>

        {/* Média da Turma */}
        <motion.div 
          className="notas-kpi-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          style={{
            background: stats.globalAvg >= 7.0 
              ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)' 
              : 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
            borderRadius: 20,
            padding: '18px 20px',
            border: stats.globalAvg >= 7.0 ? '1px solid #bbf7d0' : '1px solid #fed7aa',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}
        >
          <div className="notas-kpi-icon-box" style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 14, 
            background: '#ffffff', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            flexShrink: 0
          }}>
            {stats.globalAvg >= 7.0 ? (
              <TrendingUp size={24} color="#16a34a" />
            ) : (
              <TrendingDown size={24} color="#ea580c" />
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="notas-kpi-label" style={{ 
              fontSize: 12, 
              fontWeight: 800, 
              color: stats.globalAvg >= 7.0 ? '#15803d' : '#c2410c', 
              textTransform: 'uppercase', 
              letterSpacing: 0.5 
            }}>
              Média da Turma
            </div>
            <div className="notas-kpi-value" style={{ 
              fontSize: 28, 
              fontWeight: 900, 
              color: stats.globalAvg >= 7.0 ? '#166534' : '#9a3412', 
              lineHeight: 1.1 
            }}>
              {isLoadingBoletins ? '...' : (stats.withBoletimCount > 0 ? stats.globalAvg.toFixed(1) : '-')}
              <span style={{ fontSize: 14, fontWeight: 600, opacity: 0.7, marginLeft: 4 }}>/ 10</span>
            </div>
            <div className="notas-kpi-sub" style={{ fontSize: 12, color: stats.globalAvg >= 7.0 ? '#166534' : '#9a3412', marginTop: 2, fontWeight: 600 }}>
              {stats.globalAvg >= 7.0 ? 'Satisfatório' : 'Abaixo da meta'}
            </div>
          </div>
        </motion.div>

        {/* Rendimento Esperado >= 7.0 */}
        <motion.div 
          className="notas-kpi-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: '18px 20px',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}
        >
          <div className="notas-kpi-icon-box" style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 14, 
            background: '#ecfdf5', 
            border: '1px solid #d1fae5', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <CheckCircle2 size={24} color="#10b981" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="notas-kpi-label" style={{ fontSize: 12, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Média ≥ 7.0
            </div>
            <div className="notas-kpi-value" style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
              {stats.aboveCount}
              <span style={{ fontSize: 14, color: '#059669', fontWeight: 700, marginLeft: 6 }}>
                ({stats.abovePercent}%)
              </span>
            </div>
            <div className="notas-kpi-sub" style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Alunos adequados
            </div>
          </div>
        </motion.div>

        {/* Em Alerta / Recuperação < 7.0 */}
        <motion.div 
          className="notas-kpi-card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          style={{
            background: '#ffffff',
            borderRadius: 20,
            padding: '18px 20px',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}
        >
          <div className="notas-kpi-icon-box" style={{ 
            width: 48, 
            height: 48, 
            borderRadius: 14, 
            background: '#fef2f2', 
            border: '1px solid #fee2e2', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <AlertTriangle size={24} color="#ef4444" />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="notas-kpi-label" style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Média &lt; 7.0
            </div>
            <div className="notas-kpi-value" style={{ fontSize: 28, fontWeight: 900, color: '#0f172a', lineHeight: 1.1 }}>
              {stats.belowCount}
              <span style={{ fontSize: 14, color: '#dc2626', fontWeight: 700, marginLeft: 6 }}>
                ({stats.belowPercent}%)
              </span>
            </div>
            <div className="notas-kpi-sub" style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
              Requer atenção
            </div>
          </div>
        </motion.div>
      </div>

      {/* 3. Filter Bar & Search */}
      <div className="notas-filter-card" style={{
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
        {/* Search Input */}
        <div className="notas-search-box" style={{ position: 'relative', flex: '1 1 280px', maxWidth: 450 }}>
          <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Buscar aluno por nome, matrícula ou turma..."
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

        {/* Filter Pills */}
        <div className="notas-pills-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'com_boletim', label: 'Com Boletim' },
            { id: 'acima', label: 'Média ≥ 7.0' },
            { id: 'abaixo', label: 'Média < 7.0' },
            { id: 'sem_boletim', label: 'Sem Lançamento' },
          ].map(f => {
            const isSelected = filterPerformance === f.id
            return (
              <button
                key={f.id}
                className="notas-pill-btn"
                onClick={() => setFilterPerformance(f.id as any)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 12,
                  border: isSelected ? '1px solid #2563eb' : '1px solid #e2e8f0',
                  background: isSelected ? '#2563eb' : '#ffffff',
                  color: isSelected ? '#ffffff' : '#475569',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.2)' : 'none'
                }}
              >
                {f.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 4. Student Directory / Cards Grid */}
      {isLoadingAlunos || isLoadingBoletins ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
          <div style={{ 
            width: 44, 
            height: 44, 
            border: '4px solid rgba(37,99,235,0.1)', 
            borderTopColor: '#2563eb', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite' 
          }} />
          <span style={{ color: '#64748b', fontSize: 15, fontWeight: 600 }}>
            Carregando alunos e notas das turmas vinculadas...
          </span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : displayedStudents.length === 0 ? (
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
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16
          }}>
            <BookOpen size={28} color="#94a3b8" />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
            Nenhum aluno encontrado
          </h3>
          <p style={{ fontSize: 14, color: '#64748b', margin: 0, maxWidth: 440, lineHeight: 1.6 }}>
            {turmas.length === 0
              ? 'Você não possui turmas vinculadas ao seu usuário no momento. As notas serão exibidas assim que suas turmas forem associadas ao seu perfil.'
              : searchTerm 
                ? `Não foram encontrados alunos correspondentes ao termo "${searchTerm}".`
                : 'Nenhum aluno cadastrado ou vinculado para os filtros selecionados.'}
          </p>
        </div>
      ) : (
        <div className="notas-students-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16
        }}>
          {displayedStudents.map((st, idx) => {
            return (
              <motion.div
                key={st.id}
                className="notas-student-card"
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
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Top Info */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div className="notas-student-avatar">
                    <UserAvatar
                      userId={st.id}
                      name={st.nome || 'Aluno'}
                      fotoUrl={st.foto || st.avatar_url || st.avatar}
                      size={46}
                      className="shadow-sm"
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 className="notas-student-name" style={{ 
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

                {/* Bottom Grade Section */}
                <div className="notas-student-grade-box" style={{
                  background: '#f8fafc',
                  borderRadius: 16,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '1px solid #f1f5f9'
                }}>
                  {st.hasBoletim && st.mediaGeral !== null ? (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {st.latestBoletim?.parsedDados?.bimestre || 'Média Recente'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                        <span style={{ 
                          fontSize: 22, 
                          fontWeight: 900, 
                          color: st.isAcima ? '#15803d' : '#dc2626',
                          lineHeight: 1
                        }}>
                          {st.mediaGeral.toFixed(1)}
                        </span>
                        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                          / 10
                        </span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: st.isAcima ? '#dcfce7' : '#fee2e2',
                          color: st.isAcima ? '#166534' : '#991b1b',
                          marginLeft: 4
                        }}>
                          {st.isAcima ? 'Adequado' : 'Atenção'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Status Boletim
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginTop: 2 }}>
                        Aguardando notas
                      </div>
                    </div>
                  )}

                  {/* Button Action */}
                  <div className="notas-grade-btn" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#2563eb',
                    background: '#ffffff',
                    padding: '8px 12px',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                  }}>
                    <span>Ver Notas</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* 5. MODAL: DETALHES DO BOLETIM DO ALUNO */}
      {mounted && selectedStudentForModal && createPortal(
        <AnimatePresence>
          <div className="notas-modal-container" style={{
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

            {/* Modal Card */}
            <motion.div
              className="notas-modal-card"
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 820,
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
              {/* Modal Top Header */}
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

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => window.print()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 12,
                      padding: '8px 14px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#475569',
                      cursor: 'pointer'
                    }}
                    title="Imprimir Boletim"
                  >
                    <Printer size={16} color="#2563eb" />
                    <span className="hide-on-mobile">Imprimir</span>
                  </button>

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
              </div>

              {/* Bimestres & Year Segmented Switcher */}
              <div style={{
                padding: '14px 24px',
                background: '#f8fafc',
                borderBottom: '1px solid #f1f5f9',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}>
                {/* Year Selection if multiple */}
                {modalAnosDisponiveis.length > 1 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>Ano:</span>
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
                  </div>
                ) : (
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>
                    Ano Letivo: <strong style={{ color: '#0f172a' }}>{modalAno || selectedAno}</strong>
                  </div>
                )}

                {/* Bimestres Buttons */}
                {modalBimestresDisponiveis.length > 0 && (
                  <div style={{
                    display: 'flex',
                    gap: 6,
                    background: '#e2e8f0',
                    padding: 4,
                    borderRadius: 14,
                    overflowX: 'auto'
                  }}>
                    {modalBimestresDisponiveis.map(b => {
                      const isSelected = modalBimestreId === b.id
                      return (
                        <button
                          key={b.id}
                          onClick={() => setModalBimestreId(b.id)}
                          style={{
                            padding: '6px 14px',
                            borderRadius: 10,
                            border: 'none',
                            fontWeight: 700,
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                            cursor: 'pointer',
                            background: isSelected ? '#2563eb' : 'transparent',
                            color: isSelected ? '#ffffff' : '#475569',
                            boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.25)' : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {b.nome.replace('Bimestre', 'Bim')}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Modal Body - Scrollable */}
              <div style={{
                padding: '24px',
                overflowY: 'auto',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 20
              }}>
                {!currentModalBoletim ? (
                  <div style={{
                    padding: '60px 20px',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      background: '#eff6ff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 16
                    }}>
                      <GraduationCap size={32} color="#2563eb" />
                    </div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
                      Nenhum boletim lançado
                    </h3>
                    <p style={{ fontSize: 14, color: '#64748b', margin: 0, maxWidth: 360 }}>
                      Não há notas registradas para este aluno no período selecionado ({modalAno || selectedAno}).
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Card Resumo Global */}
                    <div className="notas-modal-resumo" style={{
                      padding: '22px 24px',
                      background: isModalMediaAcima 
                        ? 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)' 
                        : 'linear-gradient(135deg, #f8fafc 0%, #fef2f2 100%)',
                      color: '#0f172a',
                      borderRadius: 22,
                      border: isModalMediaAcima ? '1px solid #e0e7ff' : '1px solid #fee2e2',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 16
                    }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: 8,
                            background: isModalMediaAcima ? '#dbeafe' : '#fee2e2',
                            color: isModalMediaAcima ? '#2563eb' : '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <GraduationCap size={16} />
                          </div>
                          <span style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11, color: '#64748b' }}>
                            Média Global do Período
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                          <span style={{
                            fontSize: 48,
                            fontWeight: 900,
                            fontFamily: 'Outfit, sans-serif',
                            lineHeight: 1,
                            color: isModalMediaAcima ? '#1e3a8a' : '#991b1b',
                            letterSpacing: '-1px'
                          }}>
                            {modalMediaGlobal.toFixed(1)}
                          </span>
                          <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                            / 10.0
                          </span>
                        </div>

                        <div style={{ fontSize: 13, color: '#64748b', marginTop: 6, fontWeight: 500 }}>
                          {currentModalBoletim.originalTitle} • Turma: {currentModalBoletim.nomeTurma || selectedStudentForModal.turmaDisplay}
                        </div>
                      </div>

                      {/* Status pill right */}
                      <div style={{
                        padding: '12px 18px',
                        background: '#ffffff',
                        borderRadius: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        border: '1px solid rgba(0,0,0,0.06)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
                      }}>
                        {isModalMediaAcima ? <TrendingUp size={24} color="#10b981" /> : <TrendingDown size={24} color="#ef4444" />}
                        <span style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: isModalMediaAcima ? '#059669' : '#b91c1c',
                          textAlign: 'center'
                        }}>
                          {isModalMediaAcima ? 'Desempenho Adequado' : 'Requer Atenção'}
                        </span>
                      </div>
                    </div>

                    {/* Rendimento por Disciplina Grid */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <BarChart2 size={16} />
                        </div>
                        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#0f172a' }}>
                          Rendimento por Disciplina ({modalDisciplinas.length})
                        </h3>
                      </div>

                      <div className="notas-modal-disciplinas-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                        gap: 14
                      }}>
                        {modalDisciplinas.map((d: any, i: number) => {
                          const isPassed = d.mediaFNum >= 7.0
                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2, delay: i * 0.03 }}
                              style={{
                                padding: '14px 16px',
                                background: '#f8fafc',
                                borderRadius: 16,
                                border: '1px solid #f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                              }}
                            >
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: 13 }}>
                                  {d.nome}
                                </div>
                                <div style={{ fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                                  <span>AVM: <strong style={{ color: '#334155' }}>{d.avm ?? '-'}</strong></span>
                                  <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1' }} />
                                  <span>AVB: <strong style={{ color: '#334155' }}>{d.avb ?? '-'}</strong></span>
                                </div>
                                {/* Progress bar */}
                                <div style={{ marginTop: 4, height: 4, background: '#e2e8f0', borderRadius: 2, overflow: 'hidden', width: '80%' }}>
                                  <div 
                                    style={{
                                      width: `${Math.min(d.mediaFNum * 10, 100)}%`,
                                      height: '100%',
                                      background: isPassed ? '#10b981' : '#ef4444',
                                      borderRadius: 2
                                    }}
                                  />
                                </div>
                              </div>

                              <div style={{ textAlign: 'right' }}>
                                <div style={{
                                  fontSize: 20,
                                  fontWeight: 900,
                                  fontFamily: 'Outfit, sans-serif',
                                  color: isPassed ? '#059669' : '#dc2626',
                                  lineHeight: 1
                                }}>
                                  {d.mediaF}
                                </div>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}

      {/* Responsive & Print Styles */}
      <style dangerouslySetInnerHTML={{__html:`
        @media (max-width: 640px) {
          .hide-on-mobile { display: none !important; }

          .notas-page-container {
            padding: 12px 10px 80px 10px !important;
          }

          .notas-header-wrapper {
            margin-bottom: 12px !important;
            gap: 10px !important;
          }
          .notas-header-title {
            font-size: 18px !important;
          }
          .notas-header-subtitle {
            font-size: 12px !important;
          }
          .notas-header-icon {
            width: 32px !important;
            height: 32px !important;
            border-radius: 10px !important;
          }
          .notas-header-icon svg {
            width: 18px !important;
            height: 18px !important;
          }

          /* ─── 2x2 COMPACT KPI GRID ON MOBILE ─── */
          .notas-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
            margin-bottom: 12px !important;
          }
          .notas-kpi-card {
            padding: 10px 10px !important;
            border-radius: 14px !important;
            gap: 8px !important;
            align-items: center !important;
          }
          .notas-kpi-icon-box {
            width: 32px !important;
            height: 32px !important;
            min-width: 32px !important;
            border-radius: 9px !important;
          }
          .notas-kpi-icon-box svg {
            width: 16px !important;
            height: 16px !important;
          }
          .notas-kpi-label {
            font-size: 9.5px !important;
            letter-spacing: 0.2px !important;
            line-height: 1.15 !important;
          }
          .notas-kpi-value {
            font-size: 18px !important;
            line-height: 1.1 !important;
            margin-top: 1px !important;
          }
          .notas-kpi-value span {
            font-size: 11px !important;
            margin-left: 2px !important;
          }
          .notas-kpi-sub {
            font-size: 9.5px !important;
            line-height: 1.15 !important;
            margin-top: 1px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          /* ─── FILTER & SEARCH ON MOBILE ─── */
          .notas-filter-card {
            padding: 10px 10px !important;
            border-radius: 14px !important;
            margin-bottom: 12px !important;
            gap: 8px !important;
          }
          .notas-search-box {
            flex: 1 1 100% !important;
            max-width: 100% !important;
          }
          .notas-search-box input {
            padding: 8px 12px 8px 36px !important;
            font-size: 13px !important;
            border-radius: 12px !important;
          }
          .notas-pills-row {
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            width: 100% !important;
            padding-bottom: 4px !important;
            gap: 6px !important;
            scrollbar-width: none !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .notas-pills-row::-webkit-scrollbar {
            display: none !important;
          }
          .notas-pill-btn {
            white-space: nowrap !important;
            padding: 6px 12px !important;
            font-size: 11.5px !important;
            border-radius: 10px !important;
            flex-shrink: 0 !important;
          }

          /* ─── STUDENTS GRID ON MOBILE ─── */
          .notas-students-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
          .notas-student-card {
            padding: 10px 12px !important;
            border-radius: 14px !important;
            gap: 8px !important;
          }
          .notas-student-name {
            font-size: 14.5px !important;
          }
          .notas-student-grade-box {
            padding: 8px 10px !important;
            border-radius: 12px !important;
          }
          .notas-grade-btn {
            padding: 6px 10px !important;
            font-size: 11px !important;
            border-radius: 9px !important;
          }

          /* ─── MODAL ON MOBILE ─── */
          .notas-modal-container {
            padding: 0 !important;
            align-items: flex-end !important;
          }
          .notas-modal-card {
            max-height: 92vh !important;
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
          }
          .notas-modal-resumo {
            padding: 14px 16px !important;
            border-radius: 16px !important;
            gap: 10px !important;
          }
          .notas-modal-disciplinas-grid {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
        }

        @media print {
          @page {
            margin: 15mm;
            size: A4 portrait;
          }
          .ad-sidebar-container,
          .ad-banner-global,
          .ad-right-section,
          button,
          select,
          input,
          ::-webkit-scrollbar {
            display: none !important;
          }
          body, html {
            background: white !important;
          }
        }
      `}} />
    </div>
  )
}
