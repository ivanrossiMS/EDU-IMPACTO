'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileCheck2, Check, ArrowRight, ArrowLeft, Save, Eye, Plus,
  Trash2, Copy, BookOpen, Clock, Calendar, Shield,
  Layers, Users, HelpCircle, CheckCircle2, AlertCircle, X,
  ChevronDown, ChevronUp, GripVertical, FileText, Image as ImageIcon,
  Calculator, AlertTriangle, RefreshCw, Search, UserCheck
} from 'lucide-react'
import { toast } from 'sonner'
import { HtmlContent } from '@/components/HtmlContent'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import {
  ProvaOnline,
  QuestaoProva,
  TipoQuestao,
  AlternativaQuestao,
  ItemVerdadeiroFalso,
  CriterioAvaliacao
} from '@/types/provas-online'
import { QuestionEditorModal } from './QuestionEditorModal'

interface ExamWizardProps {
  initialExam?: ProvaOnline | null
  isEditing?: boolean
}

export function ExamWizard({ initialExam, isEditing = false }: ExamWizardProps) {
  const router = useRouter()
  const { currentUser } = useApp()
  const { turmas = [], cfgDisciplinas = [] } = useData()

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [savingDraft, setSavingDraft] = useState(false)
  const [lastDraftSaved, setLastDraftSaved] = useState<string | null>(null)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [editingQuestionModalOpen, setEditingQuestionModalOpen] = useState(false)
  const [currentEditingQuestion, setCurrentEditingQuestion] = useState<QuestaoProva | null>(null)

  // Students selection state for Step 4
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [searchStudent, setSearchStudent] = useState('')
  const [studentTurmaFilter, setStudentTurmaFilter] = useState('todas')
  const [alunosModo, setAlunosModo] = useState<'todos' | 'especificos'>(() => {
    return (initialExam?.alunosEspecificos && initialExam.alunosEspecificos.length > 0) ? 'especificos' : 'todos'
  })

  // Main Exam State
  const [exam, setExam] = useState<ProvaOnline>(() => {
    if (initialExam) return initialExam

    const now = new Date()
    const tomorrow = new Date(now.getTime() + 86400000)
    const nextWeek = new Date(now.getTime() + 86400000 * 7)

    return {
      id: crypto.randomUUID(),
      titulo: '',
      descricao: '',
      disciplina: cfgDisciplinas[0]?.nome || 'Matemática',
      turmas: [],
      series: [],
      anoLetivo: 2026,
      bimestre: 1,
      finalidade: 'avaliacao',
      professorId: currentUser?.id || '',
      professorNome: currentUser?.nome || 'Professor',
      instrucoes: 'Leia atentamente cada questão. Responda com calma.',
      materiaisPermitidos: 'Caneta esferográfica azul ou preta.',
      status: 'rascunho',
      aprovacaoRequerida: false,
      statusAprovacao: 'aprovada',
      valorTotal: 10.0,
      quantidadeTentativas: 1,
      politicaTentativas: 'maior_nota',
      dataAbertura: tomorrow.toISOString().slice(0, 16),
      dataEncerramento: nextWeek.toISOString().slice(0, 16),
      duracaoMinutos: 60,
      codigoLiberacao: '',
      configuracaoLayout: {
        questaoPorPagina: false,
        navegacaoLivre: true,
        permitirVoltar: true,
        embaralharQuestoes: false,
        embaralharAlternativas: false
      },
      configuracaoMonitoramento: {
        solicitarTelaCheia: false,
        registrarSaidaTela: true,
        bloquearColar: false,
        acaoOcorrencia: 'alertar'
      },
      configuracaoDivulgacao: {
        liberarGabarito: 'apos_encerramento',
        liberarNota: 'apos_correcao',
        liberarComentarios: true
      },
      alunosEspecificos: [],
      questoes: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    }
  })

  // Autosave draft debounce
  const draftTimerRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    if (exam.status === 'publicada') return
    if (!exam.titulo.trim()) return

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(async () => {
      try {
        setSavingDraft(true)
        await fetch('/api/provas-online', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...exam, status: 'rascunho' })
        })
        setLastDraftSaved(new Date().toLocaleTimeString('pt-BR'))
      } catch (e) {
        console.warn('Autosave draft error', e)
      } finally {
        setSavingDraft(false)
      }
    }, 4000)

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    }
  }, [exam])

  // Calculated questions points sum
  const totalPointsAllocated = useMemo(() => {
    const sum = (exam.questoes || []).reduce((acc, q) => acc + Number(q.pontuacao || 0), 0)
    return Math.round(sum * 100) / 100
  }, [exam.questoes])

  const pointsDifference = useMemo(() => {
    return Math.round((exam.valorTotal - totalPointsAllocated) * 100) / 100
  }, [exam.valorTotal, totalPointsAllocated])

  // Fetch students for Step 4
  useEffect(() => {
    let isMounted = true
    async function loadStudents() {
      try {
        setLoadingStudents(true)
        const res = await fetch('/api/alunos?all=true&lightweight=true')
        if (res.ok) {
          const json = await res.json()
          const list = Array.isArray(json) ? json : (json?.data || [])
          if (isMounted) setAllStudents(list)
        }
      } catch (err) {
        console.warn('Erro ao carregar alunos para a prova', err)
      } finally {
        if (isMounted) setLoadingStudents(false)
      }
    }
    loadStudents()
    return () => { isMounted = false }
  }, [])

  // Students that belong to the turmas chosen in exam.turmas
  const availableStudentsForTurmas = useMemo(() => {
    if (!exam.turmas || exam.turmas.length === 0) return []
    const selectedTurmaNamesLower = exam.turmas.map(t => t.trim().toLowerCase())
    const matchingTurmaIds = turmas
      .filter(t => selectedTurmaNamesLower.includes(t.nome.trim().toLowerCase()))
      .map(t => String(t.id).trim().toLowerCase())

    return allStudents.filter(s => {
      const sTurmaName = (s.turma_nome || s.turma || '').trim().toLowerCase()
      const sTurmaRaw = String(s.turma || '').trim().toLowerCase()
      const matchesName = selectedTurmaNamesLower.includes(sTurmaName)
      const matchesId = matchingTurmaIds.includes(sTurmaRaw)
      return matchesName || matchesId
    })
  }, [allStudents, exam.turmas, turmas])

  // Filtered by search and turma sub-filter
  const filteredStudents = useMemo(() => {
    return availableStudentsForTurmas.filter(s => {
      if (studentTurmaFilter !== 'todas') {
        const sTurma = (s.turma_nome || s.turma || '').trim().toLowerCase()
        if (sTurma !== studentTurmaFilter.trim().toLowerCase()) return false
      }
      if (searchStudent.trim()) {
        const q = searchStudent.toLowerCase().trim()
        const matchName = (s.nome || '').toLowerCase().includes(q)
        const matricula = String(s.matricula || s.dados?.matricula || s.codigo || s.dados?.codigo || '')
        const matchMatricula = matricula.toLowerCase().includes(q)
        return matchName || matchMatricula
      }
      return true
    })
  }, [availableStudentsForTurmas, studentTurmaFilter, searchStudent])

  const toggleStudentSelection = (studentId: string) => {
    setExam(prev => {
      const currentList = prev.alunosEspecificos || []
      const isSelected = currentList.includes(studentId)
      const nextList = isSelected
        ? currentList.filter(id => id !== studentId)
        : [...currentList, studentId]
      return { ...prev, alunosEspecificos: nextList }
    })
  }

  const selectAllFilteredStudents = () => {
    const idsToAdd = filteredStudents.map(s => s.id)
    setExam(prev => {
      const currentSet = new Set(prev.alunosEspecificos || [])
      idsToAdd.forEach(id => currentSet.add(id))
      return { ...prev, alunosEspecificos: Array.from(currentSet) }
    })
  }

  const deselectAllFilteredStudents = () => {
    const idsToRemove = new Set(filteredStudents.map(s => s.id))
    setExam(prev => ({
      ...prev,
      alunosEspecificos: (prev.alunosEspecificos || []).filter(id => !idsToRemove.has(id))
    }))
  }

  // Save / Update question from QuestionEditorModal
  const handleSaveQuestion = (updatedQ: QuestaoProva) => {
    setExam(prev => {
      const list = prev.questoes || []
      const idx = list.findIndex(q => q.id === updatedQ.id)
      if (idx >= 0) {
        const nextList = [...list]
        nextList[idx] = updatedQ
        return { ...prev, questoes: nextList }
      } else {
        return { ...prev, questoes: [...list, { ...updatedQ, ordem: list.length }] }
      }
    })
    setEditingQuestionModalOpen(false)
    setCurrentEditingQuestion(null)
    toast.success('Questão salva com sucesso!')
  }

  // Save / Publish Exam
  const handleSaveExam = async (publish: boolean) => {
    if (!exam.titulo.trim()) {
      toast.error('Informe o título da prova na Etapa 1.')
      setStep(1)
      return
    }

    if ((exam.questoes || []).length === 0) {
      toast.error('A prova deve ter pelo menos uma questão na Etapa 2.')
      setStep(2)
      return
    }

    if (publish) {
      // Points validation
      if (Math.abs(pointsDifference) > 0.01) {
        toast.error(`A soma das questões (${totalPointsAllocated} pts) diverge do valor total da prova (${exam.valorTotal} pts). Ajuste os pontos na Etapa 2.`)
        setStep(2)
        return
      }

      // Check completeness of questions
      for (let i = 0; i < (exam.questoes || []).length; i++) {
        const q = exam.questoes![i]
        if (!q.enunciado || q.enunciado.trim() === '') {
          toast.error(`A questão #${i + 1} está com enunciado em branco.`)
          setStep(2)
          return
        }
        if (q.tipo === 'multipla_escolha' && !(q.alternativas || []).some(a => a.correta)) {
          toast.error(`A questão #${i + 1} não possui nenhuma alternativa marcada como correta.`)
          setStep(2)
          return
        }
        if (q.tipo === 'multipla_selecao' && !(q.alternativas || []).some(a => a.correta)) {
          toast.error(`A questão #${i + 1} de múltipla seleção não possui alternativas corretas.`)
          setStep(2)
          return
        }
      }

      if (exam.turmas.length === 0) {
        toast.error('Selecione ao menos uma turma participante na Etapa 4.')
        setStep(4)
        return
      }

      if (alunosModo === 'especificos' && (exam.alunosEspecificos || []).length === 0) {
        toast.error('Selecione ao menos um aluno específico na Etapa 4 ou alterne para "Toda a Turma".')
        setStep(4)
        return
      }
    }

    try {
      const finalAlunosEspecificos = alunosModo === 'especificos' ? (exam.alunosEspecificos || []) : []
      const payload: ProvaOnline = {
        ...exam,
        alunosEspecificos: finalAlunosEspecificos,
        status: publish ? (exam.aprovacaoRequerida ? 'agendada' : 'agendada') : 'rascunho',
        statusAprovacao: exam.aprovacaoRequerida ? 'pendente' : 'aprovada',
        publicadoEm: publish ? new Date().toISOString() : undefined,
        updatedAt: new Date().toISOString()
      }

      const res = await fetch('/api/provas-online', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar prova')
      }

      toast.success(publish ? 'Prova publicada com sucesso!' : 'Rascunho salvo com sucesso!')
      router.push('/provas-online')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao salvar prova')
    }
  }

  const handleNextStep = () => {
    if (step === 1) {
      if (!exam.titulo.trim()) {
        toast.error('Informe o título da avaliação antes de avançar.')
        return
      }
    } else if (step === 2) {
      if ((exam.questoes || []).length === 0) {
        toast.error('Adicione ao menos uma questão à avaliação.')
        return
      }
    } else if (step === 4) {
      if (exam.turmas.length === 0) {
        toast.error('Selecione ao menos uma turma para a prova.')
        return
      }
      if (alunosModo === 'especificos' && (exam.alunosEspecificos || []).length === 0) {
        toast.error('Selecione os alunos participantes ou marque a opção "Toda a Turma".')
        return
      }
    }
    setStep(s => Math.min(5, s + 1) as any)
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px 16px' }}>
      {/* Top Header Card */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '20px 24px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            onClick={() => router.push('/provas-online')}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#475569',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Voltar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
              {isEditing ? 'Editar Prova Online' : 'Assistente de Criação de Prova'}
            </h1>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              Configure as informações pedagógicas, questões, regras de tempo e publique a avaliação.
            </p>
          </div>
        </div>

        {/* Save Draft / Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {savingDraft ? (
            <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <RefreshCw size={12} className="animate-spin" /> Salvando rascunho...
            </span>
          ) : lastDraftSaved ? (
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              Rascunho salvo às {lastDraftSaved}
            </span>
          ) : null}

          <button
            onClick={() => setPreviewModalOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '10px',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Eye size={14} /> Pré-visualizar como Aluno
          </button>

          <button
            onClick={() => handleSaveExam(false)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '10px',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              color: '#0369a1',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Save size={14} /> Salvar Rascunho
          </button>
        </div>
      </div>

      {/* 5-Step Stepper Navigation */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '8px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '8px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
      }}>
        {[
          { num: 1, label: 'Geral', desc: 'Informações Básicas' },
          { num: 2, label: 'Questões', desc: `${(exam.questoes || []).length} cadastradas` },
          { num: 3, label: 'Regras', desc: `${exam.duracaoMinutos}m • ${exam.quantidadeTentativas} tent.` },
          { num: 4, label: 'Alunos', desc: `${exam.turmas.length} turmas` },
          { num: 5, label: 'Revisão', desc: 'Auditoria & Publicar' },
        ].map(s => {
          const isActive = step === s.num
          const isDone = step > s.num
          return (
            <button
              key={s.num}
              onClick={() => setStep(s.num as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '10px',
                border: isActive ? '1.5px solid #0284c7' : isDone ? '1px solid #e2e8f0' : '1px solid transparent',
                background: isActive ? '#f0f9ff' : isDone ? '#ffffff' : '#f8fafc',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s'
              }}
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 800,
                  flexShrink: 0,
                  background: isActive ? '#0284c7' : isDone ? '#ecfdf5' : '#e2e8f0',
                  color: isActive ? '#ffffff' : isDone ? '#047857' : '#64748b'
                }}
              >
                {isDone ? <Check size={14} /> : s.num}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: isActive ? 800 : 700, color: isActive ? '#0369a1' : isDone ? '#0f172a' : '#64748b', lineHeight: 1.2 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: '11px', color: isActive ? '#0284c7' : '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.desc}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* STEP CONTENT CONTAINERS */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {/* ── STEP 1: INFORMAÇÕES GERAIS ───────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Etapa 1: Informações Gerais</h2>
              <p className="text-xs text-slate-500 mt-0.5">Defina o título, disciplina, turmas e orientações gerais da avaliação.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Título */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Título da Prova *</label>
                <input
                  type="text"
                  placeholder="Ex: Avaliação Bimestral de Matemática - 1º Bimestre"
                  value={exam.titulo}
                  onChange={e => setExam(p => ({ ...p, titulo: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Disciplina */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Disciplina *</label>
                <select
                  value={exam.disciplina}
                  onChange={e => setExam(p => ({ ...p, disciplina: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
                >
                  {cfgDisciplinas.map(d => (
                    <option key={d.id} value={d.nome}>{d.nome}</option>
                  ))}
                  <option value="Matemática">Matemática</option>
                  <option value="Língua Portuguesa">Língua Portuguesa</option>
                  <option value="História">História</option>
                  <option value="Geografia">Geografia</option>
                  <option value="Ciências">Ciências</option>
                  <option value="Física">Física</option>
                  <option value="Química">Química</option>
                  <option value="Biologia">Biologia</option>
                  <option value="Redação">Redação</option>
                </select>
              </div>

              {/* Finalidade */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Finalidade Pedagógica *</label>
                <select
                  value={exam.finalidade}
                  onChange={e => setExam(p => ({ ...p, finalidade: e.target.value as any }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
                >
                  <option value="avaliacao">Avaliação Oficial</option>
                  <option value="simulado">Simulado Preparatório</option>
                  <option value="diagnostica">Avaliação Diagnóstica</option>
                  <option value="recuperacao">Prova de Recuperação</option>
                </select>
              </div>

              {/* Ano Letivo & Bimestre */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Ano Letivo</label>
                  <input
                    type="number"
                    value={exam.anoLetivo}
                    onChange={e => setExam(p => ({ ...p, anoLetivo: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Bimestre</label>
                  <select
                    value={exam.bimestre}
                    onChange={e => setExam(p => ({ ...p, bimestre: Number(e.target.value) }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-sky-500 focus:bg-white"
                  >
                    <option value={1}>1º Bimestre</option>
                    <option value={2}>2º Bimestre</option>
                    <option value={3}>3º Bimestre</option>
                    <option value={4}>4º Bimestre</option>
                  </select>
                </div>
              </div>

              {/* Professor Responsável */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Professor Responsável</label>
                <input
                  type="text"
                  value={exam.professorNome}
                  onChange={e => setExam(p => ({ ...p, professorNome: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              {/* Instruções para o Aluno */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Instruções para o Aluno</label>
                <textarea
                  rows={3}
                  placeholder="Orientações exibidas na tela de entrada do estudante antes de iniciar..."
                  value={exam.instrucoes}
                  onChange={e => setExam(p => ({ ...p, instrucoes: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Materiais Permitidos */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Materiais Permitidos</label>
                <input
                  type="text"
                  placeholder="Ex: Caneta esferográfica, régua e folha de rascunho. Proibido uso de calculadoras."
                  value={exam.materiaisPermitidos}
                  onChange={e => setExam(p => ({ ...p, materiaisPermitidos: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:bg-white placeholder:text-slate-400"
                />
              </div>

              {/* Aprovação pela Coordenação */}
              <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Requer Aprovação Prévia da Coordenação</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Se ativado, a prova só poderá ser iniciada pelos alunos após o aval e homologação da coordenação.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={exam.aprovacaoRequerida}
                  onChange={e => setExam(p => ({ ...p, aprovacaoRequerida: e.target.checked }))}
                  className="w-5 h-5 rounded accent-sky-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: QUESTÕES ─────────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              paddingBottom: '16px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  Etapa 2: Questões da Prova
                </h2>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                  Total acumulado: <strong style={{ color: '#0284c7', fontWeight: 800 }}>{totalPointsAllocated} pts</strong> de {exam.valorTotal} pts previstos.
                  {Math.abs(pointsDifference) > 0.01 && (
                    <span style={{ color: '#e11d48', marginLeft: '8px', fontWeight: 700 }}>
                      ({pointsDifference > 0 ? `Faltam ${pointsDifference} pts` : `Excedeu ${Math.abs(pointsDifference)} pts`})
                    </span>
                  )}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const newQ: QuestaoProva = {
                      id: crypto.randomUUID(),
                      ordem: (exam.questoes || []).length,
                      tipo: 'multipla_escolha',
                      enunciado: '',
                      pontuacao: 1.0,
                      alternativas: [
                        { id: 'alt-1', letra: 'A', texto: '', correta: true, ordem: 0 },
                        { id: 'alt-2', letra: 'B', texto: '', correta: false, ordem: 1 },
                        { id: 'alt-3', letra: 'C', texto: '', correta: false, ordem: 2 },
                        { id: 'alt-4', letra: 'D', texto: '', correta: false, ordem: 3 },
                      ]
                    }
                    setCurrentEditingQuestion(newQ)
                    setEditingQuestionModalOpen(true)
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '38px',
                    padding: '0 18px',
                    borderRadius: '10px',
                    background: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.28)',
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Plus size={16} color="#ffffff" /> Nova Questão
                </button>
              </div>
            </div>

            {/* Questions List */}
            {(exam.questoes || []).length === 0 ? (
              <div style={{
                padding: '48px 24px',
                textAlign: 'center',
                borderRadius: '16px',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <BookOpen size={24} color="#94a3b8" />
                </div>
                <div style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  Nenhuma questão adicionada ainda
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '440px', margin: 0, lineHeight: 1.5 }}>
                  Você pode criar questões objetivas com alternativa única, múltipla seleção, verdadeiro ou falso e dissertativas com critérios de avaliação.
                </p>
                <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const newQ: QuestaoProva = {
                        id: crypto.randomUUID(),
                        ordem: 0,
                        tipo: 'multipla_escolha',
                        enunciado: '',
                        pontuacao: 1.0,
                        alternativas: [
                          { id: 'alt-1', letra: 'A', texto: '', correta: true, ordem: 0 },
                          { id: 'alt-2', letra: 'B', texto: '', correta: false, ordem: 1 },
                          { id: 'alt-3', letra: 'C', texto: '', correta: false, ordem: 2 },
                          { id: 'alt-4', letra: 'D', texto: '', correta: false, ordem: 3 },
                        ]
                      }
                      setCurrentEditingQuestion(newQ)
                      setEditingQuestionModalOpen(true)
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      height: '40px',
                      padding: '0 22px',
                      borderRadius: '10px',
                      background: '#0284c7',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(2, 132, 199, 0.28)'
                    }}
                  >
                    <Plus size={16} color="#ffffff" /> Adicionar Primeira Questão
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {(exam.questoes || []).map((q, idx) => (
                  <div
                    key={q.id}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '16px',
                      padding: '20px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      paddingBottom: '12px',
                      borderBottom: '1px solid #f1f5f9'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: '#eff6ff',
                          color: '#0284c7',
                          fontWeight: 800,
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px solid #bfdbfe'
                        }}>
                          {idx + 1}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          color: '#334155',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          padding: '4px 10px',
                          borderRadius: '8px'
                        }}>
                          {q.tipo === 'multipla_escolha' && 'Objetiva (Única)'}
                          {q.tipo === 'multipla_selecao' && 'Múltipla Seleção'}
                          {q.tipo === 'verdadeiro_falso' && 'Verdadeiro ou Falso'}
                          {q.tipo === 'dissertativa' && 'Dissertativa'}
                        </span>
                        {q.habilidadeBNCC && (
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '8px',
                            background: '#f0fdf4',
                            color: '#15803d',
                            border: '1px solid #bbf7d0',
                            fontFamily: 'monospace'
                          }}>
                            {q.habilidadeBNCC}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '4px 8px'
                        }}>
                          <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Pontos:</span>
                          <input
                            type="number"
                            step="0.25"
                            value={q.pontuacao}
                            onChange={e => {
                              const val = Math.max(0, Number(e.target.value))
                              setExam(p => ({
                                ...p,
                                questoes: p.questoes?.map((item, i) => i === idx ? { ...item, pontuacao: val } : item)
                              }))
                            }}
                            style={{
                              width: '56px',
                              height: '28px',
                              padding: '0 6px',
                              borderRadius: '6px',
                              background: '#ffffff',
                              border: '1px solid #cbd5e1',
                              color: '#0f172a',
                              fontSize: '13px',
                              fontWeight: 800,
                              textAlign: 'center',
                              outline: 'none'
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCurrentEditingQuestion(q)
                            setEditingQuestionModalOpen(true)
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            background: '#f8fafc',
                            border: '1px solid #cbd5e1',
                            color: '#475569',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          title="Editar"
                        >
                          <Eye size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setExam(p => ({
                              ...p,
                              questoes: p.questoes?.filter((_, i) => i !== idx)
                            }))
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '34px',
                            height: '34px',
                            borderRadius: '10px',
                            background: '#fef2f2',
                            border: '1px solid #fecaca',
                            color: '#dc2626',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          title="Excluir"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Enunciado preview */}
                    <div style={{
                      padding: '14px 16px',
                      borderRadius: '12px',
                      background: '#f8fafc',
                      border: '1px solid #f1f5f9',
                      fontSize: '13px',
                      color: '#1e293b',
                      lineHeight: 1.6
                    }}>
                      <HtmlContent html={q.enunciado} />
                    </div>

                    {/* Alternativas preview (Múltipla Escolha e Seleção) */}
                    {q.alternativas && q.alternativas.length > 0 && (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: '8px'
                      }}>
                        {q.alternativas.map(a => (
                          <div
                            key={a.id}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              fontSize: '12px',
                              fontWeight: a.correta ? 700 : 500,
                              background: a.correta ? '#f0fdf4' : '#ffffff',
                              border: a.correta ? '1px solid #86efac' : '1px solid #e2e8f0',
                              color: a.correta ? '#15803d' : '#475569'
                            }}
                          >
                            <span style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '11px',
                              background: a.correta ? '#dcfce7' : '#f1f5f9',
                              color: a.correta ? '#166534' : '#475569',
                              flexShrink: 0
                            }}>
                              {a.letra}
                            </span>
                            <span style={{ flex: 1 }}>{a.texto || '(Em branco)'}</span>
                            {a.correta && <Check size={14} color="#16a34a" style={{ flexShrink: 0 }} />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Verdadeiro ou Falso preview */}
                    {q.tipo === 'verdadeiro_falso' && q.itensVF && q.itensVF.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {q.itensVF.map((it, i) => (
                          <div
                            key={it.id || i}
                            style={{
                              padding: '10px 14px',
                              borderRadius: '10px',
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              fontSize: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px'
                            }}
                          >
                            <span style={{ color: '#334155' }}>{it.afirmacao || '(Afirmação pendente)'}</span>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontWeight: 800,
                              fontSize: '11px',
                              background: it.correta ? '#dcfce7' : '#fee2e2',
                              color: it.correta ? '#166534' : '#991b1b',
                              border: it.correta ? '1px solid #bbf7d0' : '1px solid #fecaca'
                            }}>
                              Gabarito: {it.correta ? 'V' : 'F'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dissertativa preview */}
                    {q.tipo === 'dissertativa' && (
                      <div style={{
                        padding: '12px 14px',
                        borderRadius: '10px',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                        color: '#64748b',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={14} color="#0284c7" />
                          <strong style={{ color: '#0f172a' }}>Resposta Dissertativa</strong>
                          {q.limitePalavras && (
                            <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748b' }}>
                              Limite: até {q.limitePalavras} palavras
                            </span>
                          )}
                        </div>
                        {q.respostaEsperada && (
                          <div style={{ fontSize: '12px', color: '#475569', fontStyle: 'italic' }}>
                            <strong>Padrão de Resposta:</strong> {q.respostaEsperada}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: REGRAS DE APLICAÇÃO ─────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-lg font-bold text-slate-900">Etapa 3: Datas, Duração e Regras de Aplicação</h2>
              <p className="text-xs text-slate-500 mt-0.5">Configure os prazos, cronômetro, políticas de navegação e monitoramento.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Data de Abertura */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Data e Horário de Abertura *</label>
                <input
                  type="datetime-local"
                  value={exam.dataAbertura}
                  onChange={e => setExam(p => ({ ...p, dataAbertura: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              {/* Data de Encerramento */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Data e Horário de Encerramento *</label>
                <input
                  type="datetime-local"
                  value={exam.dataEncerramento}
                  onChange={e => setExam(p => ({ ...p, dataEncerramento: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              {/* Duração Individual (minutos) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Duração Individual após Início (minutos) *</label>
                <input
                  type="number"
                  min="10"
                  max="300"
                  value={exam.duracaoMinutos}
                  onChange={e => setExam(p => ({ ...p, duracaoMinutos: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-sky-500 focus:bg-white"
                />
                <p className="text-[11px] text-slate-400">
                  O cronômetro começa estritamente quando o servidor confirma o início da tentativa.
                </p>
              </div>

              {/* Quantidade de Tentativas */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Tentativas Permitidas *</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={exam.quantidadeTentativas}
                  onChange={e => setExam(p => ({ ...p, quantidadeTentativas: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              {/* Política de Múltiplas Tentativas */}
              {exam.quantidadeTentativas > 1 && (
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Critério para Nota Final</label>
                  <select
                    value={exam.politicaTentativas}
                    onChange={e => setExam(p => ({ ...p, politicaTentativas: e.target.value as any }))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:bg-white"
                  >
                    <option value="maior_nota">Considerar a Maior Nota</option>
                    <option value="ultima_nota">Considerar a Última Nota Enviada</option>
                    <option value="media">Considerar a Média Aritmética das Tentativas</option>
                  </select>
                </div>
              )}

              {/* Código de Liberação Presencial (PIN) */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Código de Liberação Presencial (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: SALA-402 (Deixe em branco para liberar sem senha presencial)"
                  value={exam.codigoLiberacao || ''}
                  onChange={e => setExam(p => ({ ...p, codigoLiberacao: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-xs focus:outline-none focus:border-sky-500 focus:bg-white placeholder:text-slate-400"
                />
                <p className="text-[11px] text-slate-400">
                  Para provas presenciais em laboratório ou sala: o aluno só poderá iniciar após o professor ditar este código.
                </p>
              </div>

              {/* Layout e Navegação */}
              <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Layout e Navegação</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exam.configuracaoLayout.questaoPorPagina}
                      onChange={e => setExam(p => ({
                        ...p,
                        configuracaoLayout: { ...p.configuracaoLayout, questaoPorPagina: e.target.checked }
                      }))}
                      className="w-4 h-4 rounded accent-sky-600"
                    />
                    <span>1 Questão por página (ao invés de todas juntas)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exam.configuracaoLayout.navegacaoLivre}
                      onChange={e => setExam(p => ({
                        ...p,
                        configuracaoLayout: { ...p.configuracaoLayout, navegacaoLivre: e.target.checked }
                      }))}
                      className="w-4 h-4 rounded accent-sky-600"
                    />
                    <span>Navegação livre (permite pular e voltar questões)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exam.configuracaoLayout.embaralharQuestoes}
                      onChange={e => setExam(p => ({
                        ...p,
                        configuracaoLayout: { ...p.configuracaoLayout, embaralharQuestoes: e.target.checked }
                      }))}
                      className="w-4 h-4 rounded accent-sky-600"
                    />
                    <span>Embaralhar ordem das questões por aluno</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exam.configuracaoLayout.embaralharAlternativas}
                      onChange={e => setExam(p => ({
                        ...p,
                        configuracaoLayout: { ...p.configuracaoLayout, embaralharAlternativas: e.target.checked }
                      }))}
                      className="w-4 h-4 rounded accent-sky-600"
                    />
                    <span>Embaralhar alternativas das questões objetivas</span>
                  </label>
                </div>
              </div>

              {/* Monitoramento e Segurança */}
              <div className="md:col-span-2 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Monitoramento e Supervisão</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exam.configuracaoMonitoramento.solicitarTelaCheia}
                      onChange={e => setExam(p => ({
                        ...p,
                        configuracaoMonitoramento: { ...p.configuracaoMonitoramento, solicitarTelaCheia: e.target.checked }
                      }))}
                      className="w-4 h-4 rounded accent-sky-600"
                    />
                    <span>Solicitar modo tela cheia no início</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exam.configuracaoMonitoramento.registrarSaidaTela}
                      onChange={e => setExam(p => ({
                        ...p,
                        configuracaoMonitoramento: { ...p.configuracaoMonitoramento, registrarSaidaTela: e.target.checked }
                      }))}
                      className="w-4 h-4 rounded accent-sky-600"
                    />
                    <span>Registrar saídas de tela e troca de abas</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exam.configuracaoMonitoramento.bloquearColar}
                      onChange={e => setExam(p => ({
                        ...p,
                        configuracaoMonitoramento: { ...p.configuracaoMonitoramento, bloquearColar: e.target.checked }
                      }))}
                      className="w-4 h-4 rounded accent-sky-600"
                    />
                    <span>Restringir copiar e colar em campos de resposta</span>
                  </label>

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-700 font-semibold">Ação ao detectar ocorrência</label>
                    <select
                      value={exam.configuracaoMonitoramento.acaoOcorrencia}
                      onChange={e => setExam(p => ({
                        ...p,
                        configuracaoMonitoramento: { ...p.configuracaoMonitoramento, acaoOcorrencia: e.target.value as any }
                      }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs"
                    >
                      <option value="registrar">Apenas Registrar no Relatório</option>
                      <option value="alertar">Registrar e Alertar o Aluno</option>
                      <option value="suspender">Suspender Prova e Exigir Liberação do Professor</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: ALUNOS PARTICIPANTES ────────────────────── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div style={{ paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                Etapa 4: Alunos Participantes
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Selecione as turmas e escolha se a prova será aplicada para todos os alunos ou apenas estudantes selecionados.
              </p>
            </div>

            {/* Sub-seção: Turmas Participantes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  1. Turmas da Prova ({exam.turmas.length} selecionada{exam.turmas.length === 1 ? '' : 's'})
                </span>
                {exam.turmas.length > 0 && (
                  <span style={{ fontSize: '12px', color: '#0284c7', fontWeight: 700 }}>
                    {availableStudentsForTurmas.length} estudantes matriculados
                  </span>
                )}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '10px'
              }}>
                {turmas.map(t => {
                  const isSelected = exam.turmas.includes(t.nome)
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setExam(p => ({
                          ...p,
                          turmas: isSelected
                            ? p.turmas.filter(x => x !== t.nome)
                            : [...p.turmas, t.nome]
                        }))
                      }}
                      style={{
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: isSelected ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                        background: isSelected ? '#f0f9ff' : '#ffffff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        transition: 'all 0.15s',
                        boxShadow: isSelected ? '0 1px 3px rgba(2, 132, 199, 0.1)' : '0 1px 2px rgba(0,0,0,0.02)'
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: isSelected ? '#0369a1' : '#0f172a' }}>
                          {t.nome}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          {t.serie || 'Série Geral'} {t.turno ? `• ${t.turno}` : ''}
                        </div>
                      </div>
                      <div style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '6px',
                        border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                        background: isSelected ? '#0284c7' : '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {isSelected && <Check size={14} color="#ffffff" strokeWidth={3} />}
                      </div>
                    </div>
                  )
                })}
              </div>

              {exam.turmas.length === 0 && (
                <div style={{
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '12px',
                  color: '#92400e'
                }}>
                  <AlertTriangle size={16} color="#d97706" />
                  <span>Selecione pelo menos uma turma acima para configurar os alunos da avaliação.</span>
                </div>
              )}
            </div>

            {/* Sub-seção: Modo de Participação */}
            {exam.turmas.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  2. Escopo de Aplicação dos Alunos
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '12px'
                }}>
                  {/* Modo Todos */}
                  <div
                    onClick={() => {
                      setAlunosModo('todos')
                      setExam(p => ({ ...p, alunosEspecificos: [] }))
                    }}
                    style={{
                      padding: '16px',
                      borderRadius: '14px',
                      border: alunosModo === 'todos' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                      background: alunosModo === 'todos' ? '#f0f9ff' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      transition: 'all 0.15s',
                      boxShadow: alunosModo === 'todos' ? '0 2px 6px rgba(2, 132, 199, 0.12)' : 'none'
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: alunosModo === 'todos' ? '6px solid #0284c7' : '2px solid #cbd5e1',
                      background: '#ffffff',
                      marginTop: '2px',
                      flexShrink: 0
                    }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                        Toda a Turma (Padrão)
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                        A prova estará liberada para todos os {availableStudentsForTurmas.length} estudantes matriculados nas turmas selecionadas.
                      </p>
                    </div>
                  </div>

                  {/* Modo Específicos */}
                  <div
                    onClick={() => {
                      setAlunosModo('especificos')
                    }}
                    style={{
                      padding: '16px',
                      borderRadius: '14px',
                      border: alunosModo === 'especificos' ? '2px solid #0284c7' : '1px solid #e2e8f0',
                      background: alunosModo === 'especificos' ? '#f0f9ff' : '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      transition: 'all 0.15s',
                      boxShadow: alunosModo === 'especificos' ? '0 2px 6px rgba(2, 132, 199, 0.12)' : 'none'
                    }}
                  >
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: alunosModo === 'especificos' ? '6px solid #0284c7' : '2px solid #cbd5e1',
                      background: '#ffffff',
                      marginTop: '2px',
                      flexShrink: 0
                    }} />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                        Selecionar Alunos Específicos
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                        Escolha individualmente quem realizará a avaliação (ideal para recuperação, segunda chamada ou grupos seletos).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Painel de Seleção Individual de Alunos */}
                {alunosModo === 'especificos' && (
                  <div style={{
                    marginTop: '8px',
                    padding: '20px',
                    borderRadius: '16px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px'
                  }}>
                    {/* Barra de Filtros e Busca */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      {/* Campo de Busca por Aluno */}
                      <div style={{
                        position: 'relative',
                        flex: '1 1 280px',
                        maxWidth: '400px'
                      }}>
                        <Search
                          size={16}
                          color="#94a3b8"
                          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                        />
                        <input
                          type="text"
                          placeholder="Buscar aluno por nome ou matrícula..."
                          value={searchStudent}
                          onChange={e => setSearchStudent(e.target.value)}
                          style={{
                            width: '100%',
                            height: '40px',
                            paddingLeft: '38px',
                            paddingRight: searchStudent ? '36px' : '14px',
                            borderRadius: '10px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '13px',
                            color: '#0f172a',
                            outline: 'none',
                            fontFamily: 'inherit'
                          }}
                        />
                        {searchStudent && (
                          <button
                            type="button"
                            onClick={() => setSearchStudent('')}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>

                      {/* Filtro por Turma (quando houver mais de uma turma selecionada) */}
                      {exam.turmas.length > 1 && (
                        <select
                          value={studentTurmaFilter}
                          onChange={e => setStudentTurmaFilter(e.target.value)}
                          style={{
                            height: '40px',
                            padding: '0 14px',
                            borderRadius: '10px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '12px',
                            color: '#334155',
                            fontWeight: 600,
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="todas">Todas as Turmas Selecionadas ({availableStudentsForTurmas.length})</option>
                          {exam.turmas.map(t => (
                            <option key={t} value={t}>Turma {t}</option>
                          ))}
                        </select>
                      )}

                      {/* Botões de Ação Rápida */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={selectAllFilteredStudents}
                          style={{
                            height: '34px',
                            padding: '0 14px',
                            borderRadius: '8px',
                            background: '#ffffff',
                            border: '1px solid #bae6fd',
                            color: '#0284c7',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <Check size={14} /> Selecionar Todos ({filteredStudents.length})
                        </button>
                        <button
                          type="button"
                          onClick={deselectAllFilteredStudents}
                          style={{
                            height: '34px',
                            padding: '0 14px',
                            borderRadius: '8px',
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            color: '#64748b',
                            fontSize: '12px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Desmarcar Todos
                        </button>

                        <div style={{
                          height: '34px',
                          padding: '0 12px',
                          borderRadius: '8px',
                          background: (exam.alunosEspecificos || []).length > 0 ? '#e0f2fe' : '#f1f5f9',
                          border: (exam.alunosEspecificos || []).length > 0 ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                          color: (exam.alunosEspecificos || []).length > 0 ? '#0369a1' : '#64748b',
                          fontSize: '12px',
                          fontWeight: 800,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}>
                          <Users size={14} />
                          <span>{(exam.alunosEspecificos || []).length} selecionado{(exam.alunosEspecificos || []).length === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Lista / Grid de Alunos */}
                    {loadingStudents ? (
                      <div style={{
                        padding: '40px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px',
                        color: '#64748b'
                      }}>
                        <RefreshCw className="animate-spin" size={24} color="#0284c7" />
                        <span style={{ fontSize: '13px' }}>Carregando lista de estudantes...</span>
                      </div>
                    ) : filteredStudents.length === 0 ? (
                      <div style={{
                        padding: '36px 20px',
                        textAlign: 'center',
                        background: '#ffffff',
                        borderRadius: '12px',
                        border: '1px dashed #cbd5e1',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <Users size={28} color="#94a3b8" />
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
                          Nenhum aluno encontrado
                        </div>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                          {searchStudent
                            ? `Não localizamos nenhum aluno correspondente a "${searchStudent}" nas turmas selecionadas.`
                            : `Não há estudantes cadastrados nas turmas selecionadas (${exam.turmas.join(', ')}).`}
                        </p>
                      </div>
                    ) : (
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                        gap: '8px',
                        maxHeight: '440px',
                        overflowY: 'auto',
                        paddingRight: '4px'
                      }}>
                        {filteredStudents.map(student => {
                          const isSelected = (exam.alunosEspecificos || []).includes(student.id)
                          const initials = (student.nome || 'A')
                            .split(' ')
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((p: string) => p[0].toUpperCase())
                            .join('')

                          return (
                            <div
                              key={student.id}
                              onClick={() => toggleStudentSelection(student.id)}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '12px',
                                border: isSelected ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                                background: isSelected ? '#f0f9ff' : '#ffffff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                transition: 'all 0.15s',
                                userSelect: 'none'
                              }}
                            >
                              {/* Avatar com Iniciais */}
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: isSelected ? '#0284c7' : '#f1f5f9',
                                color: isSelected ? '#ffffff' : '#475569',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 800,
                                flexShrink: 0
                              }}>
                                {initials}
                              </div>

                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{
                                  fontSize: '12px',
                                  fontWeight: 700,
                                  color: isSelected ? '#0369a1' : '#0f172a',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {student.nome}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                  <span style={{ fontSize: '10px', color: '#64748b' }}>
                                    {student.turma_nome || student.turma || 'Turma'}
                                  </span>
                                  {(student.matricula || student.dados?.matricula || student.codigo) && (
                                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                                      • Mat: {student.matricula || student.dados?.matricula || student.codigo}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Checkbox */}
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '6px',
                                border: isSelected ? '1px solid #0284c7' : '1px solid #cbd5e1',
                                background: isSelected ? '#0284c7' : '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {isSelected && <Check size={13} color="#ffffff" strokeWidth={3} />}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── STEP 5: REVISÃO E PUBLICAÇÃO ─────────────────────── */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                Etapa 5: Revisão Final e Publicação
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Audite os dados da avaliação e confirme as configurações antes de liberar para os estudantes.
              </p>
            </div>

            {/* Checklist de Auditoria */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div style={{ fontSize: '11px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Checklist de Validação Pedagógica
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '10px'
              }}>
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: exam.titulo.trim() ? '#f0fdf4' : '#fef2f2',
                  border: exam.titulo.trim() ? '1px solid #bbf7d0' : '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  {exam.titulo.trim() ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertCircle size={16} color="#dc2626" />}
                  <div style={{ fontSize: '12px', color: '#1e293b' }}>
                    <strong>Título:</strong> {exam.titulo || 'Pendente'}
                  </div>
                </div>

                <div style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: (exam.questoes || []).length > 0 ? '#f0fdf4' : '#fef2f2',
                  border: (exam.questoes || []).length > 0 ? '1px solid #bbf7d0' : '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  {(exam.questoes || []).length > 0 ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertCircle size={16} color="#dc2626" />}
                  <div style={{ fontSize: '12px', color: '#1e293b' }}>
                    <strong>Questões:</strong> {(exam.questoes || []).length} adicionadas
                  </div>
                </div>

                <div style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: Math.abs(pointsDifference) <= 0.01 ? '#f0fdf4' : '#fef2f2',
                  border: Math.abs(pointsDifference) <= 0.01 ? '1px solid #bbf7d0' : '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  {Math.abs(pointsDifference) <= 0.01 ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertCircle size={16} color="#dc2626" />}
                  <div style={{ fontSize: '12px', color: '#1e293b' }}>
                    <strong>Pontuação:</strong> {totalPointsAllocated} / {exam.valorTotal} pts
                  </div>
                </div>

                <div style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: exam.turmas.length > 0 ? '#f0fdf4' : '#fef2f2',
                  border: exam.turmas.length > 0 ? '1px solid #bbf7d0' : '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  {exam.turmas.length > 0 ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertCircle size={16} color="#dc2626" />}
                  <div style={{ fontSize: '12px', color: '#1e293b' }}>
                    <strong>Turmas:</strong> {exam.turmas.length} selecionadas
                  </div>
                </div>

                <div style={{
                  padding: '12px 14px',
                  borderRadius: '10px',
                  background: (exam.turmas.length > 0 && (alunosModo === 'todos' || (exam.alunosEspecificos || []).length > 0)) ? '#f0fdf4' : '#fef2f2',
                  border: (exam.turmas.length > 0 && (alunosModo === 'todos' || (exam.alunosEspecificos || []).length > 0)) ? '1px solid #bbf7d0' : '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  {(exam.turmas.length > 0 && (alunosModo === 'todos' || (exam.alunosEspecificos || []).length > 0)) ? <CheckCircle2 size={16} color="#16a34a" /> : <AlertCircle size={16} color="#dc2626" />}
                  <div style={{ fontSize: '12px', color: '#1e293b' }}>
                    <strong>Alunos:</strong> {alunosModo === 'todos' ? `Toda a turma (${availableStudentsForTurmas.length} alunos)` : `${(exam.alunosEspecificos || []).length} selecionados`}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Card */}
            <div style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {exam.disciplina}
                </span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  {exam.titulo || 'Prova Sem Título'}
                </h3>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
                paddingTop: '12px',
                borderTop: '1px solid #f1f5f9'
              }}>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>Duração Individual</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{exam.duracaoMinutos} minutos</span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>Tentativas</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{exam.quantidadeTentativas} ({exam.politicaTentativas})</span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>Valor Total</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#059669' }}>{exam.valorTotal} pontos</span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>Turmas Vinculadas</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0284c7' }}>{exam.turmas.length > 0 ? exam.turmas.join(', ') : 'Nenhuma'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>Público Alvo</span>
                  <span style={{ fontSize: '14px', fontWeight: 800, color: '#0284c7' }}>
                    {exam.turmas.length === 0
                      ? 'Nenhuma turma'
                      : alunosModo === 'todos'
                      ? `Todos (${availableStudentsForTurmas.length} alunos)`
                      : `${(exam.alunosEspecificos || []).length} alunos específicos`}
                  </span>
                </div>
              </div>

              {exam.aprovacaoRequerida && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  fontSize: '12px',
                  color: '#92400e',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={15} color="#d97706" />
                  Esta prova exige homologação e aprovação da Coordenação antes de ser liberada aos alunos.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stepper Footer Controls */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          paddingTop: '24px',
          marginTop: '24px',
          borderTop: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep(s => Math.max(1, s - 1) as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '42px',
                padding: '0 20px',
                borderRadius: '12px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: step === 1 ? '#94a3b8' : '#334155',
                fontSize: '13px',
                fontWeight: 700,
                cursor: step === 1 ? 'not-allowed' : 'pointer',
                opacity: step === 1 ? 0.5 : 1,
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s'
              }}
            >
              <ArrowLeft size={16} /> Voltar
            </button>

            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '42px',
                padding: '0 18px',
                borderRadius: '12px',
                background: '#ffffff',
                border: '1px solid #bae6fd',
                color: '#0284c7',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(2, 132, 199, 0.08)',
                transition: 'all 0.15s'
              }}
            >
              <Eye size={16} color="#0284c7" /> Pré-visualizar como Aluno
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {step < 5 ? (
              <>
                <button
                  type="button"
                  onClick={() => handleSaveExam(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '42px',
                    padding: '0 20px',
                    borderRadius: '12px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s'
                  }}
                >
                  <Save size={16} color="#64748b" /> Salvar Rascunho
                </button>

                <button
                  type="button"
                  onClick={handleNextStep}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '42px',
                    padding: '0 24px',
                    borderRadius: '12px',
                    background: '#0284c7',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.28)',
                    transition: 'all 0.15s'
                  }}
                >
                  Avançar <ArrowRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleSaveExam(false)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '42px',
                    padding: '0 20px',
                    borderRadius: '12px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s'
                  }}
                >
                  <Save size={16} color="#64748b" /> Salvar Rascunho
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveExam(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '42px',
                    padding: '0 26px',
                    borderRadius: '12px',
                    background: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 3px 8px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.15s'
                  }}
                >
                  <Check size={18} color="#ffffff" />
                  {exam.aprovacaoRequerida ? 'Submeter para Aprovação' : 'Publicar Prova'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL: PRÉ-VISUALIZAÇÃO COMO ALUNO ─────────────────── */}
      {previewModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          background: 'rgba(15, 23, 42, 0.5)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            width: '100%',
            maxWidth: '760px',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={18} color="#0284c7" />
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Modo Pré-visualização do Aluno (Simulação sem gravação)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header preview */}
              <div style={{
                padding: '20px',
                borderRadius: '16px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {exam.disciplina}
                </div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                  {exam.titulo}
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                  {exam.instrucoes || 'Leia atentamente cada questão. Responda com calma.'}
                </p>
                <div style={{
                  paddingTop: '12px',
                  marginTop: '4px',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  flexWrap: 'wrap',
                  fontSize: '12px',
                  color: '#64748b'
                }}>
                  <span><strong>Duração:</strong> {exam.duracaoMinutos} min</span>
                  <span><strong>Pontuação:</strong> {exam.valorTotal} pts</span>
                  <span><strong>Materiais:</strong> {exam.materiaisPermitidos || 'Caneta esferográfica azul ou preta.'}</span>
                </div>
              </div>

              {/* Questions list or Empty State */}
              {(exam.questoes || []).length === 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 24px',
                  background: '#f8fafc',
                  borderRadius: '16px',
                  border: '1px dashed #cbd5e1',
                  textAlign: 'center',
                  gap: '12px'
                }}>
                  <div style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '14px',
                    background: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #e2e8f0'
                  }}>
                    <BookOpen size={24} color="#94a3b8" />
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#334155' }}>
                    Nenhuma questão adicionada ainda
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', maxWidth: '380px', margin: 0 }}>
                    Adicione questões na Etapa 2 para pré-visualizar a experiência completa do aluno nesta tela.
                  </p>
                </div>
              ) : (
                (exam.questoes || []).map((q, idx) => (
                  <div
                    key={q.id}
                    style={{
                      padding: '20px',
                      borderRadius: '16px',
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Questão {idx + 1}</span>
                      <span style={{ fontSize: '12px', fontWeight: 800, color: '#0284c7' }}>{q.pontuacao} pts</span>
                    </div>

                    <div style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>
                      <HtmlContent html={q.enunciado} />
                    </div>

                    {/* Alternativas */}
                    {q.alternativas && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {q.alternativas.map(a => (
                          <div
                            key={a.id}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '12px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              fontSize: '13px',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px'
                            }}
                          >
                            <span style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              border: '1px solid #cbd5e1',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '11px',
                              color: '#475569',
                              background: '#ffffff',
                              flexShrink: 0
                            }}>
                              {a.letra}
                            </span>
                            <span>{a.texto}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Verdadeiro ou Falso */}
                    {q.itensVF && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {q.itensVF.map(item => (
                          <div
                            key={item.id}
                            style={{
                              padding: '12px 14px',
                              borderRadius: '12px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              fontSize: '13px',
                              color: '#334155',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '12px'
                            }}
                          >
                            <span>{item.afirmacao}</span>
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                              <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', fontWeight: 800, fontSize: '11px', color: '#475569' }}>V</span>
                              <span style={{ padding: '4px 10px', borderRadius: '6px', background: '#ffffff', border: '1px solid #cbd5e1', fontWeight: 800, fontSize: '11px', color: '#475569' }}>F</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dissertativa */}
                    {q.tipo === 'dissertativa' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <textarea
                          disabled
                          placeholder="Espaço para digitação da resposta pelo aluno..."
                          style={{
                            width: '100%',
                            padding: '12px',
                            borderRadius: '12px',
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                            color: '#94a3b8',
                            height: '90px',
                            resize: 'none',
                            cursor: 'not-allowed',
                            fontFamily: 'inherit'
                          }}
                        />
                        {q.limitePalavras && (
                          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Limite: até {q.limitePalavras} palavras</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              background: '#f8fafc'
            }}>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '12px',
                  background: '#0284c7',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
                }}
              >
                Fechar Pré-visualização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: EDITOR DE QUESTÃO (NOVA / EDITAR) ───────────── */}
      <QuestionEditorModal
        open={editingQuestionModalOpen}
        question={currentEditingQuestion}
        onClose={() => {
          setEditingQuestionModalOpen(false)
          setCurrentEditingQuestion(null)
        }}
        onSave={handleSaveQuestion}
      />
    </div>
  )
}
