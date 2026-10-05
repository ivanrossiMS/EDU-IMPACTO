'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileCheck2, Check, ArrowRight, ArrowLeft, Save, Eye, Plus,
  Trash2, Copy, BookOpen, Clock, Calendar, Shield,
  Layers, Users, HelpCircle, CheckCircle2, AlertCircle, X,
  ChevronDown, ChevronUp, GripVertical, FileText, Image as ImageIcon,
  Calculator, AlertTriangle, RefreshCw, Search, UserCheck, Link2,
  UploadCloud, Edit3, Loader2
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
  CriterioAvaliacao,
  StatusProva
} from '@/types/provas-online'
import { QuestionEditorModal } from './QuestionEditorModal'
import { ImportQuestionsModal } from './ImportQuestionsModal'
import { toLocalDateTimeInputValue, toUtcIsoString } from '@/lib/provas-online/dateTimeUtils'

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
  const [savingExam, setSavingExam] = useState(false)
  const [lastDraftSaved, setLastDraftSaved] = useState<string | null>(null)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [editingQuestionModalOpen, setEditingQuestionModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [currentEditingQuestion, setCurrentEditingQuestion] = useState<QuestaoProva | null>(null)

  const isSubmittingRef = useRef(false)
  const autosaveAbortControllerRef = useRef<AbortController | null>(null)

  // Students selection state for Step 4
  const [allStudents, setAllStudents] = useState<any[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [searchStudent, setSearchStudent] = useState('')
  const [studentTurmaFilter, setStudentTurmaFilter] = useState('todas')
  const [alunosModo, setAlunosModo] = useState<'todos' | 'especificos'>(() => {
    if (initialExam?.alunosModo) return initialExam.alunosModo
    return (initialExam?.alunosEspecificos && initialExam.alunosEspecificos.length > 0) ? 'especificos' : 'todos'
  })

  // Main Exam State
  const [exam, setExam] = useState<ProvaOnline>(() => {
    if (initialExam) {
      const cleanQuestoes = (initialExam.questoes || []).map(q => {
        const clean = { ...q }
        if (clean.tipo === 'dissertativa') {
          delete clean.alternativas
          delete clean.itensVF
        } else if (clean.tipo === 'verdadeiro_falso') {
          delete clean.alternativas
        } else if (clean.tipo === 'multipla_escolha' || clean.tipo === 'multipla_selecao') {
          delete clean.itensVF
        }
        return clean
      })
      return {
        ...initialExam,
        configuracaoLayout: initialExam.configuracaoLayout ? { ...initialExam.configuracaoLayout } : {
          questaoPorPagina: true,
          navegacaoLivre: true,
          permitirVoltar: true,
          embaralharQuestoes: false,
          embaralharAlternativas: false
        },
        configuracaoMonitoramento: initialExam.configuracaoMonitoramento ? { ...initialExam.configuracaoMonitoramento } : {
          solicitarTelaCheia: false,
          registrarSaidaTela: true,
          bloquearColar: true,
          acaoOcorrencia: 'suspender'
        },
        questoes: cleanQuestoes,
        dataAbertura: toLocalDateTimeInputValue(initialExam.dataAbertura),
        dataEncerramento: toLocalDateTimeInputValue(initialExam.dataEncerramento)
      }
    }

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
      status: 'rascunho',
      aprovacaoRequerida: false,
      statusAprovacao: 'aprovada',
      valorTotal: 10.0,
      quantidadeTentativas: 1,
      politicaTentativas: 'maior_nota',
      dataAbertura: toLocalDateTimeInputValue(tomorrow),
      dataEncerramento: toLocalDateTimeInputValue(nextWeek),
      duracaoMinutos: 60,
      codigoLiberacao: '',
      configuracaoLayout: {
        questaoPorPagina: true,
        navegacaoLivre: true,
        permitirVoltar: true,
        embaralharQuestoes: false,
        embaralharAlternativas: false
      },
      configuracaoMonitoramento: {
        solicitarTelaCheia: false,
        registrarSaidaTela: true,
        bloquearColar: true,
        acaoOcorrencia: 'suspender'
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
    // Never autosave if already submitting or if exam is not a draft (e.g. agendada, em_aplicacao)
    if (isSubmittingRef.current) return
    if (exam.status && exam.status !== 'rascunho') return
    if (!exam.titulo.trim()) return

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(async () => {
      if (isSubmittingRef.current) return
      if (exam.status && exam.status !== 'rascunho') return

      try {
        setSavingDraft(true)
        if (autosaveAbortControllerRef.current) {
          autosaveAbortControllerRef.current.abort()
        }
        autosaveAbortControllerRef.current = new AbortController()

        await fetch('/api/provas-online', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: autosaveAbortControllerRef.current.signal,
          body: JSON.stringify({
            ...exam,
            dataAbertura: toUtcIsoString(exam.dataAbertura),
            dataEncerramento: toUtcIsoString(exam.dataEncerramento),
            status: 'rascunho',
            statusAprovacao: exam.aprovacaoRequerida ? 'pendente' : 'aprovada'
          })
        })
        setLastDraftSaved(new Date().toLocaleTimeString('pt-BR'))
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          console.warn('Autosave draft error', e)
        }
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

  const isDatesInvalid = useMemo(() => {
    if (!exam.dataAbertura || !exam.dataEncerramento) return false
    const a = new Date(exam.dataAbertura).getTime()
    const b = new Date(exam.dataEncerramento).getTime()
    return !isNaN(a) && !isNaN(b) && b <= a
  }, [exam.dataAbertura, exam.dataEncerramento])

  const windowDurationMinutes = useMemo(() => {
    if (!exam.dataAbertura || !exam.dataEncerramento) return null
    const a = new Date(exam.dataAbertura).getTime()
    const b = new Date(exam.dataEncerramento).getTime()
    if (isNaN(a) || isNaN(b) || b <= a) return null
    return Math.floor((b - a) / (1000 * 60))
  }, [exam.dataAbertura, exam.dataEncerramento])

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
    const cleanQ = { ...updatedQ }
    if (cleanQ.tipo === 'dissertativa') {
      delete cleanQ.alternativas
      delete cleanQ.itensVF
    } else if (cleanQ.tipo === 'verdadeiro_falso') {
      delete cleanQ.alternativas
    } else if (cleanQ.tipo === 'multipla_escolha' || cleanQ.tipo === 'multipla_selecao') {
      delete cleanQ.itensVF
    }

    setExam(prev => {
      const list = prev.questoes || []
      const idx = list.findIndex(q => q.id === cleanQ.id)
      if (idx >= 0) {
        const nextList = [...list]
        nextList[idx] = cleanQ
        return { ...prev, questoes: nextList }
      } else {
        return { ...prev, questoes: [...list, { ...cleanQ, ordem: list.length }] }
      }
    })
    setEditingQuestionModalOpen(false)
    setCurrentEditingQuestion(null)
    toast.success('Questão salva com sucesso!')
  }

  // Import questions from file or text
  const handleImportQuestions = (imported: QuestaoProva[]) => {
    setExam(prev => {
      const current = prev.questoes || []
      const startIndex = current.length
      const renumbered = imported.map((q, i) => ({
        ...q,
        ordem: startIndex + i
      }))
      return {
        ...prev,
        questoes: [...current, ...renumbered]
      }
    })
  }

  // Save / Publish Exam
  const handleSaveExam = async (publish: boolean) => {
    if (savingExam) return

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

      // Check dates and application window
      if (!exam.dataAbertura || !exam.dataEncerramento) {
        toast.error('Informe a data de abertura e de encerramento da avaliação na Etapa 3.')
        setStep(3)
        return
      }
      const aTime = new Date(exam.dataAbertura).getTime()
      const bTime = new Date(exam.dataEncerramento).getTime()
      if (isNaN(aTime) || isNaN(bTime) || bTime <= aTime) {
        toast.error('A data de encerramento deve ser posterior à data de abertura na Etapa 3.')
        setStep(3)
        return
      }
      if (!exam.duracaoMinutos || exam.duracaoMinutos < 5) {
        toast.error('A duração individual da prova deve ser de pelo menos 5 minutos.')
        setStep(3)
        return
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

    // Cancel any pending or in-flight autosave IMMEDIATELY
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current)
      draftTimerRef.current = null
    }
    if (autosaveAbortControllerRef.current) {
      autosaveAbortControllerRef.current.abort()
      autosaveAbortControllerRef.current = null
    }
    isSubmittingRef.current = true
    setSavingExam(true)

    try {
      const allTurmaStudentIds = availableStudentsForTurmas.map(s => String(s.id))
      const finalAlunosEspecificos = alunosModo === 'especificos'
        ? (exam.alunosEspecificos || [])
        : (allTurmaStudentIds.length > 0 ? allTurmaStudentIds : (exam.alunosEspecificos || []))

      const derivedSeries = Array.from(new Set(
        turmas
          .filter(t => (exam.turmas || []).includes(t.nome) || (exam.turmas || []).includes(String(t.id)))
          .map(t => t.serie)
          .filter(Boolean)
      ))

      const cleanQuestoes = (exam.questoes || []).map(q => {
        const clean = { ...q }
        if (clean.tipo === 'dissertativa') {
          delete clean.alternativas
          delete clean.itensVF
        } else if (clean.tipo === 'verdadeiro_falso') {
          delete clean.alternativas
        } else if (clean.tipo === 'multipla_escolha' || clean.tipo === 'multipla_selecao') {
          delete clean.itensVF
        }
        return clean
      })
      const hasPinCode = Boolean(exam.codigoLiberacao && exam.codigoLiberacao.trim() !== '')

      let targetStatus: StatusProva = 'rascunho'
      if (publish) {
        const now = Date.now()
        const aTime = new Date(toUtcIsoString(exam.dataAbertura)).getTime()
        const bTime = new Date(toUtcIsoString(exam.dataEncerramento)).getTime()
        if (!isNaN(aTime) && !isNaN(bTime) && now >= aTime && now <= bTime) {
          targetStatus = 'em_aplicacao'
        } else {
          targetStatus = 'agendada'
        }
      }
      const targetStatusAprovacao = exam.aprovacaoRequerida ? 'pendente' : 'aprovada'

      const payload: ProvaOnline = {
        ...exam,
        dataAbertura: toUtcIsoString(exam.dataAbertura),
        dataEncerramento: toUtcIsoString(exam.dataEncerramento),
        codigoLiberacao: hasPinCode && exam.codigoLiberacao ? exam.codigoLiberacao.trim().toUpperCase() : '',
        exigeCodigoAcesso: hasPinCode,
        series: derivedSeries.length > 0 ? derivedSeries : (exam.series || []),
        questoes: cleanQuestoes,
        alunosModo: alunosModo,
        alunosEspecificos: finalAlunosEspecificos,
        status: targetStatus,
        statusAprovacao: targetStatusAprovacao,
        publicadoEm: publish ? (exam.publicadoEm || new Date().toISOString()) : undefined,
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

      const savedData = await res.json()
      const savedProva = savedData?.prova || savedData || payload

      setExam(prev => ({
        ...prev,
        ...savedProva,
        status: targetStatus,
        statusAprovacao: targetStatusAprovacao
      }))

      toast.success(publish 
        ? (exam.aprovacaoRequerida ? 'Prova enviada para aprovação com sucesso!' : 'Prova publicada com sucesso!') 
        : 'Rascunho salvo com sucesso!')

      router.refresh()
      router.push('/provas-online')
    } catch (e: any) {
      isSubmittingRef.current = false
      toast.error(e.message || 'Erro ao salvar prova')
    } finally {
      setSavingExam(false)
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
    } else if (step === 3) {
      if (!exam.dataAbertura || !exam.dataEncerramento) {
        toast.error('Informe a data e horário de abertura e de encerramento da prova.')
        return
      }
      const a = new Date(exam.dataAbertura).getTime()
      const b = new Date(exam.dataEncerramento).getTime()
      if (isNaN(a) || isNaN(b) || b <= a) {
        toast.error('A data e horário de encerramento deve ser posterior à data de abertura.')
        return
      }
      if (!exam.duracaoMinutos || exam.duracaoMinutos < 5) {
        toast.error('A duração individual da prova deve ser de no mínimo 5 minutos.')
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

  const handleDuplicateQuestion = (idx: number) => {
    const target = (exam.questoes || [])[idx]
    if (!target) return
    const dup: QuestaoProva = {
      ...target,
      id: crypto.randomUUID(),
      ordem: (exam.questoes || []).length,
      alternativas: target.alternativas?.map(a => ({ ...a, id: crypto.randomUUID() })),
      itensVF: target.itensVF?.map(it => ({ ...it, id: crypto.randomUUID() })),
      criteriosAvaliacao: target.criteriosAvaliacao?.map(c => ({ ...c, id: crypto.randomUUID() }))
    }
    setExam(p => ({
      ...p,
      questoes: [...(p.questoes || []), dup]
    }))
    toast.success(`Questão #${idx + 1} duplicada com sucesso!`)
  }

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-4 sm:gap-5 p-2 sm:p-4 md:p-6 text-slate-800">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/provas-online')}
            className="w-10 h-10 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Voltar ao Painel"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="m-0 text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight truncate">
              {isEditing ? 'Editar Prova Online' : 'Assistente de Criação de Prova'}
            </h1>
            <p className="m-0 text-xs text-slate-500 mt-0.5 line-clamp-1">
              Configure as informações pedagógicas, questões, regras de tempo e publique a avaliação.
            </p>
          </div>
        </div>

        {/* Save Draft / Status & Header Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full md:w-auto justify-end">
          {savingDraft ? (
            <span className="text-xs text-sky-600 font-bold flex items-center gap-1.5 mr-auto md:mr-1">
              <RefreshCw size={12} className="animate-spin" /> Salvando...
            </span>
          ) : lastDraftSaved ? (
            <span className="text-[11px] text-slate-400 mr-auto md:mr-1">
              Salvo às {lastDraftSaved}
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => setPreviewModalOpen(true)}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 h-10 px-3.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <Eye size={14} className="text-sky-600" /> Pré-visualizar
          </button>

          <button
            type="button"
            onClick={() => handleSaveExam(false)}
            disabled={savingExam}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 text-xs font-bold hover:bg-sky-100 transition-colors shadow-2xs cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {savingExam ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Rascunho
          </button>
        </div>
      </div>

      {/* 5-Step Stepper Navigation */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-2 sm:p-2.5 shadow-xs space-y-2">
        {/* Mobile progress indicator */}
        <div className="block md:hidden px-2 pt-1 pb-1">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-extrabold text-sky-900 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-md bg-sky-600 text-white flex items-center justify-center text-[10px] font-black">
                {step}
              </span>
              Etapa {step} de 5: {[
                'Geral',
                'Questões',
                'Regras',
                'Alunos',
                'Revisão'
              ][step - 1]}
            </span>
            <span className="font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full text-[11px] border border-sky-100">
              {Math.round((step / 5) * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-sky-600 rounded-full transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Stepper buttons: responsive grid that adapts across mobile, tablet, and desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 sm:gap-2">
          {[
            { num: 1, label: '1. Geral', desc: 'Informações Básicas' },
            { num: 2, label: '2. Questões', desc: `${(exam.questoes || []).length} cadastradas` },
            { num: 3, label: '3. Regras', desc: `${exam.duracaoMinutos}m • ${exam.quantidadeTentativas} tent.` },
            { num: 4, label: '4. Alunos', desc: `${exam.turmas.length} turmas` },
            { num: 5, label: '5. Revisão', desc: 'Auditoria & Publicar' },
          ].map(s => {
            const isActive = step === s.num
            const isDone = step > s.num
            return (
              <button
                key={s.num}
                type="button"
                onClick={() => setStep(s.num as any)}
                className={`flex items-center gap-2.5 p-2 sm:p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                  s.num === 5 ? 'col-span-2 sm:col-span-1' : ''
                } ${
                  isActive
                    ? 'bg-sky-50/90 border border-sky-300 ring-2 ring-sky-100 shadow-2xs'
                    : isDone
                    ? 'bg-emerald-50/30 border border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    : 'bg-slate-50/60 border border-slate-200/60 hover:border-slate-300 hover:bg-white'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 transition-colors ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : isDone
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isDone ? <Check size={14} strokeWidth={3} /> : s.num}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-xs font-extrabold truncate ${
                      isActive ? 'text-sky-900' : isDone ? 'text-slate-900' : 'text-slate-600'
                    }`}
                  >
                    {s.label}
                  </div>
                  <div
                    className={`text-[10px] truncate mt-0.5 ${
                      isActive ? 'text-sky-700 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {s.desc}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* STEP CONTENT CONTAINERS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-7 md:p-8 shadow-2xs">
        {/* ── STEP 1: INFORMAÇÕES GERAIS ───────────────────────── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="border-b border-slate-100 pb-4">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">Etapa 1: Informações Gerais</h2>
              <p className="text-xs text-slate-500 mt-0.5">Defina o título, disciplina, professor responsável e orientações gerais da avaliação.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-5">
              {/* Título */}
              <div className="sm:col-span-12 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Título da Prova *</label>
                <input
                  type="text"
                  placeholder="Ex: Avaliação Bimestral de Matemática - 1º Bimestre"
                  value={exam.titulo}
                  onChange={e => setExam(p => ({ ...p, titulo: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Disciplina */}
              <div className="sm:col-span-6 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Disciplina *</label>
                <select
                  value={exam.disciplina}
                  onChange={e => setExam(p => ({ ...p, disciplina: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all cursor-pointer"
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

              {/* Professor Responsável */}
              <div className="sm:col-span-6 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Professor Responsável</label>
                <input
                  type="text"
                  placeholder="Nome do professor responsável"
                  value={exam.professorNome}
                  onChange={e => setExam(p => ({ ...p, professorNome: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all placeholder:text-slate-400"
                />
              </div>

              {/* Finalidade Pedagógica */}
              <div className="sm:col-span-12 md:col-span-5 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Finalidade Pedagógica *</label>
                <select
                  value={exam.finalidade}
                  onChange={e => setExam(p => ({ ...p, finalidade: e.target.value as any }))}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all cursor-pointer"
                >
                  <option value="avaliacao">Avaliação Oficial</option>
                  <option value="simulado">Simulado Preparatório</option>
                  <option value="diagnostica">Avaliação Diagnóstica</option>
                  <option value="recuperacao">Prova de Recuperação</option>
                </select>
              </div>

              {/* Ano Letivo */}
              <div className="sm:col-span-6 md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Ano Letivo</label>
                <input
                  type="number"
                  value={exam.anoLetivo}
                  onChange={e => setExam(p => ({ ...p, anoLetivo: Number(e.target.value) }))}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-sm font-semibold text-center focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
                />
              </div>

              {/* Bimestre */}
              <div className="sm:col-span-6 md:col-span-2 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Bimestre</label>
                <select
                  value={exam.bimestre}
                  onChange={e => setExam(p => ({ ...p, bimestre: Number(e.target.value) }))}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-sm font-semibold focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all cursor-pointer"
                >
                  <option value={1}>1º Bimestre</option>
                  <option value={2}>2º Bimestre</option>
                  <option value={3}>3º Bimestre</option>
                  <option value={4}>4º Bimestre</option>
                </select>
              </div>

              {/* Valor Total da Prova */}
              <div className="sm:col-span-12 md:col-span-3 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Valor Total *</span>
                  <span className="text-[10px] text-sky-600 font-extrabold uppercase">Pontuação</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="1000"
                    value={exam.valorTotal}
                    onChange={e => setExam(p => ({ ...p, valorTotal: Math.max(0.5, Number(e.target.value)) }))}
                    className="w-full h-11 pl-3.5 pr-12 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
                  />
                  <span className="absolute right-3.5 top-3 text-xs font-extrabold text-slate-400 select-none">pts</span>
                </div>
              </div>

              {/* Instruções para o Aluno */}
              <div className="sm:col-span-12 space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Instruções para o Aluno</label>
                <textarea
                  rows={3}
                  placeholder="Orientações exibidas na tela de entrada do estudante antes de iniciar..."
                  value={exam.instrucoes}
                  onChange={e => setExam(p => ({ ...p, instrucoes: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-xs font-medium focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all placeholder:text-slate-400 leading-relaxed"
                />
              </div>


              {/* Aprovação pela Coordenação */}
              <div
                onClick={() => setExam(p => ({ ...p, aprovacaoRequerida: !p.aprovacaoRequerida }))}
                className={`sm:col-span-12 p-4 sm:p-5 rounded-2xl border flex items-center justify-between gap-4 cursor-pointer transition-all select-none ${
                  exam.aprovacaoRequerida
                    ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-100/80 shadow-2xs'
                    : 'bg-slate-50/60 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">Requer Aprovação Prévia da Coordenação</span>
                    {exam.aprovacaoRequerida && (
                      <span className="text-[10px] uppercase font-extrabold tracking-wider bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                        Ativado
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Se ativado, a prova só poderá ser iniciada pelos alunos após o aval e homologação da coordenação pedagógica.
                  </p>
                </div>
                {/* iOS Switch */}
                <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                  exam.aprovacaoRequerida ? 'bg-amber-600' : 'bg-slate-300'
                }`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    exam.aprovacaoRequerida ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: QUESTÕES ─────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">Etapa 2: Questões da Prova</h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 flex-wrap">
                  <span className="font-medium text-slate-600">Total acumulado:</span>
                  <span className="font-extrabold text-sky-800 bg-sky-50 px-2.5 py-0.5 rounded-lg border border-sky-200">
                    {totalPointsAllocated} pts / {exam.valorTotal} pts
                  </span>
                  {Math.abs(pointsDifference) > 0.01 ? (
                    <span className="font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200 inline-flex items-center gap-1">
                      <AlertCircle size={12} />
                      {pointsDifference > 0 ? `Faltam ${pointsDifference} pts` : `Excedeu ${Math.abs(pointsDifference)} pts`}
                    </span>
                  ) : (
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 inline-flex items-center gap-1">
                      <Check size={12} strokeWidth={2.5} /> Pontuação balanceada
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all shadow-2xs cursor-pointer whitespace-nowrap"
                  title="Importar de arquivo Word (.docx), PDF ou copiar e colar texto com imagens"
                >
                  <UploadCloud size={16} className="text-emerald-600 shrink-0" />
                  <span>Importar Questões</span>
                </button>

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
                  className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 h-10 px-4 sm:px-5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold transition-all shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus size={16} strokeWidth={2.5} className="shrink-0" />
                  <span>Nova Questão</span>
                </button>
              </div>
            </div>

            {/* Questions List */}
            {(exam.questoes || []).length === 0 ? (
              <div className="py-12 px-6 sm:py-16 sm:px-10 text-center rounded-2xl bg-slate-50/70 border-2 border-dashed border-slate-200 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                  <BookOpen size={26} className="text-sky-600" />
                </div>
                <div className="text-base font-extrabold text-slate-900">
                  Nenhuma questão cadastrada ainda
                </div>
                <p className="text-xs text-slate-500 max-w-md leading-relaxed">
                  Crie questões objetivas de escolha única, múltipla seleção, verdadeiro ou falso e dissertativas com critérios de correção, ou importe diretamente de arquivos Word (.docx) ou textos colados com imagens.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 pt-3 w-full sm:w-auto justify-center">
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
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold transition-all shadow-sm cursor-pointer"
                  >
                    <Plus size={16} strokeWidth={2.5} /> Adicionar Primeira Questão
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 h-11 px-5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    <UploadCloud size={16} className="text-emerald-600" /> Importar do Word ou Colar Texto
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {(exam.questoes || []).map((q, idx) => (
                  <div
                    key={q.id}
                    className="bg-white border border-slate-200 hover:border-slate-300 rounded-2xl p-4 sm:p-5 shadow-2xs transition-all space-y-3.5"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2.5 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-7 h-7 rounded-lg bg-sky-100/70 border border-sky-200 text-sky-800 font-extrabold text-xs flex items-center justify-center shadow-2xs">
                          {idx + 1}
                        </span>
                        <span className="text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200/80 px-2.5 py-1 rounded-lg">
                          {q.tipo === 'multipla_escolha' && 'Objetiva (Única)'}
                          {q.tipo === 'multipla_selecao' && 'Múltipla Seleção'}
                          {q.tipo === 'verdadeiro_falso' && 'Verdadeiro ou Falso'}
                          {q.tipo === 'dissertativa' && 'Dissertativa'}
                        </span>
                        {q.habilidadeBNCC && (
                          <span className="text-[11px] font-bold font-mono px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {q.habilidadeBNCC}
                          </span>
                        )}
                        {q.dificuldade && (
                          <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            q.dificuldade === 'facil' ? 'bg-emerald-100 text-emerald-800' :
                            q.dificuldade === 'dificil' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {q.dificuldade}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                          <span className="text-xs text-slate-500 font-medium">Pontos:</span>
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            value={q.pontuacao}
                            onChange={e => {
                              const val = Math.max(0, Number(e.target.value))
                              setExam(p => ({
                                ...p,
                                questoes: p.questoes?.map((item, i) => i === idx ? { ...item, pontuacao: val } : item)
                              }))
                            }}
                            className="w-14 h-6 px-1 rounded bg-white border border-slate-300 text-slate-900 text-xs font-bold text-center focus:outline-none focus:border-sky-500"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setCurrentEditingQuestion(q)
                            setEditingQuestionModalOpen(true)
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="Editar Questão"
                        >
                          <Edit3 size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDuplicateQuestion(idx)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
                          title="Duplicar Questão"
                        >
                          <Copy size={14} />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setExam(p => ({
                              ...p,
                              questoes: p.questoes?.filter((_, i) => i !== idx)
                            }))
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 transition-colors cursor-pointer"
                          title="Excluir Questão"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Enunciado preview */}
                    <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs sm:text-sm text-slate-800 leading-relaxed max-h-60 overflow-y-auto">
                      <HtmlContent html={q.enunciado} />
                    </div>

                    {/* Alternativas preview (Apenas Múltipla Escolha e Seleção) */}
                    {(q.tipo === 'multipla_escolha' || q.tipo === 'multipla_selecao') && q.alternativas && q.alternativas.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {q.alternativas.map(a => (
                          <div
                            key={a.id}
                            className={`p-2.5 rounded-xl flex items-center gap-2.5 text-xs transition-colors ${
                              a.correta
                                ? 'bg-emerald-50/70 border border-emerald-300 text-emerald-950 font-semibold'
                                : 'bg-white border border-slate-200 text-slate-700'
                            }`}
                          >
                            <span className={`w-6 h-6 rounded-md flex items-center justify-center font-extrabold text-[11px] shrink-0 ${
                              a.correta
                                ? 'bg-emerald-200/80 text-emerald-900'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {a.letra}
                            </span>
                            <div className="flex-1 min-w-0">
                              <HtmlContent html={a.texto || '(Em branco)'} />
                            </div>
                            {a.correta && <Check size={14} className="text-emerald-600 shrink-0" />}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Verdadeiro ou Falso preview */}
                    {q.tipo === 'verdadeiro_falso' && q.itensVF && q.itensVF.length > 0 && (
                      <div className="space-y-1.5">
                        {q.itensVF.map((it, i) => (
                          <div
                            key={it.id || i}
                            className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs flex items-center justify-between gap-3"
                          >
                            <div className="flex-1 min-w-0 text-slate-800">
                              <HtmlContent html={it.afirmacao || '(Afirmação pendente)'} />
                            </div>
                            <span className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] shrink-0 border ${
                              it.correta
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border-rose-200'
                            }`}>
                              Gabarito: {it.correta ? 'V' : 'F'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dissertativa preview */}
                    {q.tipo === 'dissertativa' && (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <FileText size={14} className="text-sky-600" />
                          <strong className="text-slate-800">Resposta Dissertativa</strong>
                          {q.limitePalavras && (
                            <span className="ml-auto text-[11px] text-slate-500">
                              Limite: até {q.limitePalavras} palavras
                            </span>
                          )}
                        </div>
                        {q.respostaEsperada && (
                          <div className="text-xs text-slate-700 italic">
                            <strong className="not-italic text-slate-900">Padrão de Resposta:</strong> {q.respostaEsperada}
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
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">Etapa 3: Datas, Duração e Regras de Aplicação</h2>
              <p className="text-xs text-slate-500 mt-0.5">Configure os prazos, cronômetro, políticas de navegação e monitoramento.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-5">
              {/* Data de Abertura */}
              <div className="sm:col-span-6 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar size={14} className="text-sky-600" /> Data e Horário de Abertura *
                </label>
                <input
                  type="datetime-local"
                  value={exam.dataAbertura}
                  onChange={e => setExam(p => ({ ...p, dataAbertura: e.target.value }))}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all cursor-pointer"
                />
              </div>

              {/* Data de Encerramento */}
              <div className="sm:col-span-6 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar size={14} className="text-sky-600" /> Data e Horário de Encerramento *
                </label>
                <input
                  type="datetime-local"
                  value={exam.dataEncerramento}
                  onChange={e => setExam(p => ({ ...p, dataEncerramento: e.target.value }))}
                  className={`w-full h-11 px-3.5 rounded-xl bg-slate-50/60 border ${
                    isDatesInvalid ? 'border-rose-400 focus:border-rose-500' : 'border-slate-200 focus:border-sky-500'
                  } text-slate-900 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all cursor-pointer`}
                />
              </div>

              {/* Date Validation Alerts */}
              {isDatesInvalid && (
                <div className="sm:col-span-12 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-800 font-semibold animate-in fade-in duration-200">
                  <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                  <span>Atenção: A data e horário de encerramento deve ser posterior à data e horário de abertura.</span>
                </div>
              )}

              {!isDatesInvalid && windowDurationMinutes !== null && exam.duracaoMinutos > windowDurationMinutes && (
                <div className="sm:col-span-12 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-xs text-amber-900 font-semibold animate-in fade-in duration-200">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <span>
                    Atenção: A duração individual ({exam.duracaoMinutos} min) excede a janela total da prova ({windowDurationMinutes} min). Os alunos que iniciarem terão seu tempo limitado ao horário de encerramento oficial.
                  </span>
                </div>
              )}

              {/* Duração Individual (minutos) */}
              <div className="sm:col-span-6 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Clock size={14} className="text-sky-600" /> Duração Individual após Início *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="5"
                    max="480"
                    value={exam.duracaoMinutos}
                    onChange={e => setExam(p => ({ ...p, duracaoMinutos: Math.max(0, Number(e.target.value) || 0) }))}
                    className="w-full h-11 pl-3.5 pr-16 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-sm font-bold focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all"
                  />
                  <span className="absolute right-3.5 top-3 text-xs font-bold text-slate-400 select-none">minutos</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  O cronômetro começa estritamente quando o servidor confirma o início da tentativa.
                </p>
              </div>

              {/* Quantidade de Tentativas */}
              <div className="sm:col-span-6 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <RefreshCw size={14} className="text-sky-600" /> Tentativas Permitidas *
                </label>
                <select
                  value={exam.quantidadeTentativas}
                  onChange={e => setExam(p => ({ ...p, quantidadeTentativas: Number(e.target.value) }))}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all cursor-pointer"
                >
                  <option value={1}>1 Tentativa (Padrão)</option>
                  <option value={2}>2 Tentativas</option>
                  <option value={3}>3 Tentativas</option>
                  <option value={5}>5 Tentativas</option>
                </select>
              </div>

              {/* Política de Múltiplas Tentativas */}
              {exam.quantidadeTentativas > 1 && (
                <div className="sm:col-span-12 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Critério para Nota Final</label>
                  <select
                    value={exam.politicaTentativas}
                    onChange={e => setExam(p => ({ ...p, politicaTentativas: e.target.value as any }))}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all cursor-pointer"
                  >
                    <option value="maior_nota">Considerar a Maior Nota</option>
                    <option value="ultima_nota">Considerar a Última Nota Enviada</option>
                    <option value="media">Considerar a Média Aritmética das Tentativas</option>
                  </select>
                </div>
              )}

              {/* Código de Liberação Presencial (PIN) */}
              <div className="sm:col-span-12 space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Shield size={14} className="text-sky-600" /> Código de Liberação Presencial (PIN Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: SALA-402 (Deixe em branco para liberar sem senha presencial)"
                  value={exam.codigoLiberacao || ''}
                  onChange={e => {
                    const upper = e.target.value.toUpperCase()
                    setExam(p => ({
                      ...p,
                      codigoLiberacao: upper,
                      exigeCodigoAcesso: Boolean(upper.trim())
                    }))
                  }}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-xs font-mono uppercase focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 transition-all placeholder:normal-case placeholder:font-sans placeholder:text-slate-400"
                />
                <p className="text-[11px] text-slate-400">
                  Para avaliações em laboratório ou sala: o aluno só poderá iniciar após o professor ditar este código.
                </p>
              </div>

              {/* Layout e Navegação Interativo */}
              <div className="sm:col-span-12 p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Layers size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Layout e Navegação do Aluno</h3>
                    <p className="text-[11px] text-slate-500">Controle a experiência de visualização e ordem das questões.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Questão por Página */}
                  <div
                    onClick={() => setExam(p => {
                      const nextQPP = !p.configuracaoLayout.questaoPorPagina
                      return {
                        ...p,
                        configuracaoLayout: {
                          ...p.configuracaoLayout,
                          questaoPorPagina: nextQPP,
                          // Se desativar (mostrar todas na mesma página), a navegação é livre
                          navegacaoLivre: !nextQPP ? true : p.configuracaoLayout.navegacaoLivre
                        }
                      }
                    })}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                      exam.configuracaoLayout.questaoPorPagina
                        ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-100 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900">Uma Questão por Página</div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {exam.configuracaoLayout.questaoPorPagina
                          ? 'Ativo: Exibe uma pergunta por vez, com paginação e foco concentrado.'
                          : 'Inativo: Exibe todas as questões em página única contínua com rolagem.'}
                      </p>
                    </div>
                    {/* iOS Switch */}
                    <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                      exam.configuracaoLayout.questaoPorPagina ? 'bg-sky-600' : 'bg-slate-300'
                    }`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        exam.configuracaoLayout.questaoPorPagina ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>

                  {/* 2. Navegação Livre */}
                  <div
                    onClick={() => setExam(p => {
                      const nextNL = !p.configuracaoLayout.navegacaoLivre
                      return {
                        ...p,
                        configuracaoLayout: {
                          ...p.configuracaoLayout,
                          navegacaoLivre: nextNL,
                          // Se for sequencial (não livre), obrigatoriamente exige uma questão por página
                          questaoPorPagina: !nextNL ? true : p.configuracaoLayout.questaoPorPagina
                        }
                      }
                    })}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                      exam.configuracaoLayout.navegacaoLivre
                        ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-100 shadow-2xs'
                        : 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-100 shadow-2xs'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900">
                        {exam.configuracaoLayout.navegacaoLivre ? 'Navegação Livre entre Questões' : 'Navegação Sequencial Obrigatória'}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {exam.configuracaoLayout.navegacaoLivre
                          ? 'Permite ao estudante pular questões, retornar e revisar respostas livremente.'
                          : 'Modo sequencial: o estudante avança em ordem estrita sem pular etapas.'}
                      </p>
                    </div>
                    {/* iOS Switch */}
                    <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                      exam.configuracaoLayout.navegacaoLivre ? 'bg-sky-600' : 'bg-slate-300'
                    }`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        exam.configuracaoLayout.navegacaoLivre ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>

                  {/* 2.1 Permitir Retornar a Questões Anteriores (Sub-opção quando sequencial) */}
                  {!exam.configuracaoLayout.navegacaoLivre && (
                    <div
                      onClick={() => setExam(p => ({
                        ...p,
                        configuracaoLayout: { ...p.configuracaoLayout, permitirVoltar: !p.configuracaoLayout.permitirVoltar }
                      }))}
                      className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none sm:col-span-2 ${
                        exam.configuracaoLayout.permitirVoltar
                          ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-100 shadow-2xs'
                          : 'bg-rose-50/70 border-rose-300 ring-2 ring-rose-100 shadow-2xs'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900">
                          {exam.configuracaoLayout.permitirVoltar ? 'Permitir Retornar a Questões Anteriores' : 'Bloquear Retorno a Questões Anteriores'}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          {exam.configuracaoLayout.permitirVoltar
                            ? 'O estudante avança em ordem, mas pode voltar a questões respondidas para conferência.'
                            : 'Bloqueio estrito: uma vez avançada a questão, a resposta é consolidada e não pode mais ser alterada.'}
                        </p>
                      </div>
                      {/* iOS Switch */}
                      <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                        exam.configuracaoLayout.permitirVoltar ? 'bg-sky-600' : 'bg-slate-300'
                      }`}>
                        <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                          exam.configuracaoLayout.permitirVoltar ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </div>
                    </div>
                  )}

                  {/* 3. Embaralhar Questões */}
                  <div
                    onClick={() => setExam(p => ({
                      ...p,
                      configuracaoLayout: { ...p.configuracaoLayout, embaralharQuestoes: !p.configuracaoLayout.embaralharQuestoes }
                    }))}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                      exam.configuracaoLayout.embaralharQuestoes
                        ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-100 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900">Embaralhar Ordem das Questões</div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Cada estudante recebe a avaliação com as questões em ordem aleatória.
                      </p>
                    </div>
                    {/* iOS Switch */}
                    <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                      exam.configuracaoLayout.embaralharQuestoes ? 'bg-sky-600' : 'bg-slate-300'
                    }`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        exam.configuracaoLayout.embaralharQuestoes ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>

                  {/* 4. Embaralhar Alternativas */}
                  <div
                    onClick={() => setExam(p => ({
                      ...p,
                      configuracaoLayout: { ...p.configuracaoLayout, embaralharAlternativas: !p.configuracaoLayout.embaralharAlternativas }
                    }))}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                      exam.configuracaoLayout.embaralharAlternativas
                        ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-100 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900">Embaralhar Alternativas (A, B, C, D)</div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Permuta as alternativas nas questões objetivas para coibir cópia entre alunos.
                      </p>
                    </div>
                    {/* iOS Switch */}
                    <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                      exam.configuracaoLayout.embaralharAlternativas ? 'bg-sky-600' : 'bg-slate-300'
                    }`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        exam.configuracaoLayout.embaralharAlternativas ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Monitoramento e Segurança Interativo */}
              <div className="sm:col-span-12 p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <Shield size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">Monitoramento e Integridade Digital</h3>
                    <p className="text-[11px] text-slate-500">Políticas anti-fraude e supervisão durante a execução.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Tela Cheia */}
                  <div
                    onClick={() => setExam(p => ({
                      ...p,
                      configuracaoMonitoramento: { ...p.configuracaoMonitoramento, solicitarTelaCheia: !p.configuracaoMonitoramento.solicitarTelaCheia }
                    }))}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                      exam.configuracaoMonitoramento.solicitarTelaCheia
                        ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-100 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900">Exigir Modo Tela Cheia</div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Solicita que o estudante ative o modo tela cheia ao iniciar a avaliação.
                      </p>
                    </div>
                    {/* iOS Switch */}
                    <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                      exam.configuracaoMonitoramento.solicitarTelaCheia ? 'bg-sky-600' : 'bg-slate-300'
                    }`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        exam.configuracaoMonitoramento.solicitarTelaCheia ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>

                  {/* 2. Registrar Saída de Tela */}
                  <div
                    onClick={() => setExam(p => ({
                      ...p,
                      configuracaoMonitoramento: { ...p.configuracaoMonitoramento, registrarSaidaTela: !p.configuracaoMonitoramento.registrarSaidaTela }
                    }))}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                      exam.configuracaoMonitoramento.registrarSaidaTela
                        ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-100 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900">Monitorar Troca de Abas e Saídas</div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Detecta e grava registros de perda de foco quando o aluno troca de janela.
                      </p>
                    </div>
                    {/* iOS Switch */}
                    <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                      exam.configuracaoMonitoramento.registrarSaidaTela ? 'bg-sky-600' : 'bg-slate-300'
                    }`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        exam.configuracaoMonitoramento.registrarSaidaTela ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>

                  {/* 3. Bloquear Colar */}
                  <div
                    onClick={() => setExam(p => ({
                      ...p,
                      configuracaoMonitoramento: { ...p.configuracaoMonitoramento, bloquearColar: !p.configuracaoMonitoramento.bloquearColar }
                    }))}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                      exam.configuracaoMonitoramento.bloquearColar
                        ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-100 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-slate-900">Restringir Copiar e Colar</div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        Impede colar textos externos em respostas dissertativas.
                      </p>
                    </div>
                    {/* iOS Switch */}
                    <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5 ${
                      exam.configuracaoMonitoramento.bloquearColar ? 'bg-sky-600' : 'bg-slate-300'
                    }`}>
                      <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                        exam.configuracaoMonitoramento.bloquearColar ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </div>
                  </div>

                  {/* 4. Ação ao detectar ocorrência */}
                  <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200 flex flex-col justify-between gap-1.5 shadow-2xs">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-500" /> Ação ao Detectar Infração
                    </label>
                    <select
                      value={exam.configuracaoMonitoramento.acaoOcorrencia}
                      onChange={e => setExam(p => ({
                        ...p,
                        configuracaoMonitoramento: { ...p.configuracaoMonitoramento, acaoOcorrencia: e.target.value as any }
                      }))}
                      className="w-full h-11 px-3.5 rounded-xl bg-slate-50/60 border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-100 cursor-pointer transition-all"
                    >
                      <option value="registrar">Apenas Registrar no Relatório</option>
                      <option value="alertar">Registrar e Alertar o Aluno em Tela</option>
                      <option value="suspender">Suspender Prova e Exigir Liberação do Professor</option>
                      <option value="cancelar">Registrar e Cancelar Prova por Infringir Regras (Não Minimizar)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: ALUNOS PARTICIPANTES ────────────────────── */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                Etapa 4: Alunos Participantes
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Selecione as turmas e escolha se a prova será aplicada para todos os alunos ou apenas estudantes selecionados.
              </p>
            </div>

            {/* Sub-seção: Turmas Participantes */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  1. Turmas da Prova ({exam.turmas.length} selecionada{exam.turmas.length === 1 ? '' : 's'})
                </span>
                {exam.turmas.length > 0 && (
                  <span className="text-xs text-sky-700 font-bold bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                    {availableStudentsForTurmas.length} estudantes matriculados
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {turmas.map(t => {
                  const isSelected = exam.turmas.includes(t.nome)
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        setExam(p => {
                          const nextTurmas = isSelected
                            ? p.turmas.filter(x => x !== t.nome)
                            : [...p.turmas, t.nome]
                          
                          const nextSeries = Array.from(new Set(
                            turmas
                              .filter(item => nextTurmas.includes(item.nome))
                              .map(item => item.serie)
                              .filter(Boolean)
                          ))

                          return {
                            ...p,
                            turmas: nextTurmas,
                            series: nextSeries
                          }
                        })
                      }}
                      className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-all shadow-2xs ${
                        isSelected
                          ? 'bg-sky-50/80 border-sky-300 ring-1 ring-sky-200'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className={`text-xs sm:text-sm font-bold truncate ${isSelected ? 'text-sky-900' : 'text-slate-900'}`}>
                          {t.nome}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {t.serie || 'Série Geral'} {t.turno ? `• ${t.turno}` : ''}
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-transparent'
                      }`}>
                        <Check size={13} strokeWidth={3} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {exam.turmas.length === 0 && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2.5 text-xs text-amber-800">
                  <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  <span>Selecione pelo menos uma turma acima para configurar os alunos da avaliação.</span>
                </div>
              )}
            </div>

            {/* Sub-seção: Modo de Participação */}
            {exam.turmas.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  2. Escopo de Aplicação dos Alunos
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Modo Todos */}
                  <div
                    onClick={() => {
                      setAlunosModo('todos')
                      setExam(p => ({ ...p, alunosModo: 'todos' }))
                    }}
                    className={`p-4 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                      alunosModo === 'todos'
                        ? 'bg-sky-50/80 border-sky-300 ring-1 ring-sky-200 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full mt-0.5 shrink-0 border flex items-center justify-center ${
                      alunosModo === 'todos' ? 'border-sky-600 bg-sky-600' : 'border-slate-300 bg-white'
                    }`}>
                      {alunosModo === 'todos' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900">
                        Toda a Turma (Padrão)
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        A prova estará liberada para todos os {availableStudentsForTurmas.length} estudantes matriculados nas turmas selecionadas.
                      </p>
                    </div>
                  </div>

                  {/* Modo Específicos */}
                  <div
                    onClick={() => {
                      setAlunosModo('especificos')
                      setExam(p => ({ ...p, alunosModo: 'especificos' }))
                    }}
                    className={`p-4 rounded-xl border cursor-pointer flex items-start gap-3 transition-all ${
                      alunosModo === 'especificos'
                        ? 'bg-sky-50/80 border-sky-300 ring-1 ring-sky-200 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full mt-0.5 shrink-0 border flex items-center justify-center ${
                      alunosModo === 'especificos' ? 'border-sky-600 bg-sky-600' : 'border-slate-300 bg-white'
                    }`}>
                      {alunosModo === 'especificos' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="text-xs sm:text-sm font-bold text-slate-900">
                        Selecionar Alunos Específicos
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Escolha individualmente quem realizará a avaliação (ideal para recuperação, segunda chamada ou grupos seletos).
                      </p>
                    </div>
                  </div>
                </div>

                {/* Painel de Seleção Individual de Alunos */}
                {alunosModo === 'especificos' && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-4">
                    {/* Barra de Filtros e Busca */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                      <div className="relative flex-1 sm:max-w-xs">
                        <Search
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                        <input
                          type="text"
                          placeholder="Buscar aluno por nome ou matrícula..."
                          value={searchStudent}
                          onChange={e => setSearchStudent(e.target.value)}
                          className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-medium focus:outline-none focus:border-sky-500 shadow-2xs placeholder:text-slate-400"
                        />
                        {searchStudent && (
                          <button
                            type="button"
                            onClick={() => setSearchStudent('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {/* Filtro por Turma */}
                      {exam.turmas.length > 1 && (
                        <select
                          value={studentTurmaFilter}
                          onChange={e => setStudentTurmaFilter(e.target.value)}
                          className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-semibold focus:outline-none focus:border-sky-500 cursor-pointer"
                        >
                          <option value="todas">Todas as Turmas Selecionadas ({availableStudentsForTurmas.length})</option>
                          {exam.turmas.map(t => (
                            <option key={t} value={t}>Turma {t}</option>
                          ))}
                        </select>
                      )}

                      {/* Botões de Ação Rápida */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={selectAllFilteredStudents}
                          className="h-8 px-3 rounded-lg bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
                        >
                          <Check size={13} /> Selecionar Todos ({filteredStudents.length})
                        </button>
                        <button
                          type="button"
                          onClick={deselectAllFilteredStudents}
                          className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition-colors cursor-pointer"
                        >
                          Desmarcar Todos
                        </button>

                        <div className="h-8 px-3 rounded-lg bg-sky-100 text-sky-800 text-xs font-extrabold inline-flex items-center gap-1.5 border border-sky-200">
                          <Users size={13} />
                          <span>{(exam.alunosEspecificos || []).length} selecionado{(exam.alunosEspecificos || []).length === 1 ? '' : 's'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Lista / Grid de Alunos */}
                    {loadingStudents ? (
                      <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-slate-500">
                        <RefreshCw className="animate-spin text-sky-600" size={22} />
                        <span className="text-xs">Carregando lista de estudantes...</span>
                      </div>
                    ) : filteredStudents.length === 0 ? (
                      <div className="py-10 px-4 text-center bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center gap-2">
                        <Users size={26} className="text-slate-400" />
                        <div className="text-xs font-bold text-slate-700">
                          Nenhum aluno encontrado
                        </div>
                        <p className="text-[11px] text-slate-500 max-w-sm">
                          {searchStudent
                            ? `Não localizamos nenhum aluno correspondente a "${searchStudent}" nas turmas selecionadas.`
                            : `Não há estudantes cadastrados nas turmas selecionadas (${exam.turmas.join(', ')}).`}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-96 overflow-y-auto pr-1 no-scrollbar">
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
                              className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2.5 transition-all select-none shadow-2xs ${
                                isSelected
                                  ? 'bg-sky-50/90 border-sky-300 ring-1 ring-sky-200'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {/* Avatar com Iniciais */}
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                                isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {initials}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className={`text-xs font-bold truncate ${isSelected ? 'text-sky-950' : 'text-slate-800'}`}>
                                  {student.nome}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate mt-0.5">
                                  <span>{student.turma_nome || student.turma || 'Turma'}</span>
                                  {(student.matricula || student.dados?.matricula || student.codigo) && (
                                    <span>• Mat: {student.matricula || student.dados?.matricula || student.codigo}</span>
                                  )}
                                </div>
                              </div>

                              <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors ${
                                isSelected ? 'bg-sky-600 border-sky-600 text-white' : 'bg-white border-slate-300 text-transparent'
                              }`}>
                                <Check size={11} strokeWidth={3} />
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
          <div className="space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                Etapa 5: Revisão Final e Publicação
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Audite os dados da avaliação e confirme as configurações antes de liberar para os estudantes.
              </p>
            </div>

            {/* Checklist de Auditoria */}
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-3">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Checklist de Validação Pedagógica
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {/* Título */}
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                  exam.titulo.trim()
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 font-semibold'
                    : 'bg-rose-50 border-rose-200 text-rose-950 font-semibold'
                }`}>
                  {exam.titulo.trim() ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  )}
                  <div className="truncate">
                    <strong>Título:</strong> {exam.titulo || 'Pendente'}
                  </div>
                </div>

                {/* Questões */}
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                  (exam.questoes || []).length > 0
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 font-semibold'
                    : 'bg-rose-50 border-rose-200 text-rose-950 font-semibold'
                }`}>
                  {(exam.questoes || []).length > 0 ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  )}
                  <div className="truncate">
                    <strong>Questões:</strong> {(exam.questoes || []).length} cadastradas
                  </div>
                </div>

                {/* Pontuação */}
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                  Math.abs(pointsDifference) <= 0.01
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 font-semibold'
                    : 'bg-rose-50 border-rose-200 text-rose-950 font-semibold'
                }`}>
                  {Math.abs(pointsDifference) <= 0.01 ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  )}
                  <div className="truncate">
                    <strong>Pontuação:</strong> {totalPointsAllocated} / {exam.valorTotal} pts
                  </div>
                </div>

                {/* Prazos */}
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                  (!isDatesInvalid && exam.dataAbertura && exam.dataEncerramento && exam.duracaoMinutos >= 5)
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 font-semibold'
                    : 'bg-rose-50 border-rose-200 text-rose-950 font-semibold'
                }`}>
                  {(!isDatesInvalid && exam.dataAbertura && exam.dataEncerramento && exam.duracaoMinutos >= 5) ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  )}
                  <div className="truncate">
                    <strong>Prazos:</strong> {isDatesInvalid ? 'Datas Inválidas' : `${exam.duracaoMinutos} min • ${new Date(exam.dataAbertura).toLocaleDateString('pt-BR')} às ${new Date(exam.dataAbertura).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} até ${new Date(exam.dataEncerramento).toLocaleDateString('pt-BR')} às ${new Date(exam.dataEncerramento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`}
                  </div>
                </div>

                {/* Turmas */}
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                  exam.turmas.length > 0
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 font-semibold'
                    : 'bg-rose-50 border-rose-200 text-rose-950 font-semibold'
                }`}>
                  {exam.turmas.length > 0 ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  )}
                  <div className="truncate">
                    <strong>Turmas:</strong> {exam.turmas.length} selecionadas
                  </div>
                </div>

                {/* Alunos */}
                <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
                  (exam.turmas.length > 0 && (alunosModo === 'todos' || (exam.alunosEspecificos || []).length > 0))
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950 font-semibold'
                    : 'bg-rose-50 border-rose-200 text-rose-950 font-semibold'
                }`}>
                  {(exam.turmas.length > 0 && (alunosModo === 'todos' || (exam.alunosEspecificos || []).length > 0)) ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle size={16} className="text-rose-600 shrink-0" />
                  )}
                  <div className="truncate">
                    <strong>Público:</strong> {alunosModo === 'todos' ? `Toda a turma (${availableStudentsForTurmas.length} alunos)` : `${(exam.alunosEspecificos || []).length} alunos selecionados`}
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <div>
                <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-md border border-sky-200 uppercase tracking-wider">
                  {exam.disciplina}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-2">
                  {exam.titulo || 'Prova Sem Título'}
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Duração Individual</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">{exam.duracaoMinutos} minutos</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tentativas</span>
                  <span className="text-xs sm:text-sm font-bold text-slate-900">{exam.quantidadeTentativas} ({exam.politicaTentativas})</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Valor Total</span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-700">{exam.valorTotal} pontos</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Turmas Vinculadas</span>
                  <span className="text-xs sm:text-sm font-bold text-sky-800 truncate block">{exam.turmas.length > 0 ? exam.turmas.join(', ') : 'Nenhuma'}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Público Alvo</span>
                  <span className="text-xs sm:text-sm font-bold text-sky-800 truncate block">
                    {exam.turmas.length === 0
                      ? 'Nenhuma turma'
                      : alunosModo === 'todos'
                      ? `Todos (${availableStudentsForTurmas.length})`
                      : `${(exam.alunosEspecificos || []).length} selecionados`}
                  </span>
                </div>
              </div>

              {exam.aprovacaoRequerida && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2.5">
                  <AlertCircle size={16} className="text-amber-600 shrink-0" />
                  <span>Esta prova exige homologação e aprovação da Coordenação antes de ser liberada aos alunos.</span>
                </div>
              )}

              {exam.id && (
                <div className="p-3.5 sm:p-4 rounded-xl bg-sky-50/70 border border-dashed border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Link2 size={16} className="text-sky-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-sky-950">
                        Link Direto para os Alunos Fazerem a Avaliação
                      </div>
                      <div className="text-[11px] text-sky-700 truncate mt-0.5">
                        {typeof window !== 'undefined' ? `${window.location.origin}/provas-online/fazer/${exam.id}` : `/provas-online/fazer/${exam.id}`}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const origin = typeof window !== 'undefined' ? window.location.origin : ''
                      const link = `${origin}/provas-online/fazer/${exam.id}`
                      navigator?.clipboard?.writeText(link)
                      toast.success('Link direto copiado para a área de transferência!')
                    }}
                    className="h-8 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Copy size={13} />
                    Copiar Link
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stepper Footer Controls */}
        <div className="pt-6 mt-8 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep(s => Math.max(1, s - 1) as any)}
              className="flex-1 sm:flex-initial h-11 sm:h-10 px-4 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0"
            >
              <ArrowLeft size={15} /> Voltar
            </button>

            <button
              type="button"
              onClick={() => setPreviewModalOpen(true)}
              className="flex-1 sm:flex-initial h-11 sm:h-10 px-4 rounded-xl border border-sky-200 bg-sky-50/80 hover:bg-sky-100 text-sky-700 text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0"
            >
              <Eye size={15} className="text-sky-600" /> Pré-visualizar
            </button>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => handleSaveExam(false)}
              disabled={savingExam}
              className="flex-1 sm:flex-initial h-11 sm:h-10 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 shadow-2xs whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingExam ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} className="text-slate-500" />} Salvar Rascunho
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={handleNextStep}
                className="flex-1 sm:flex-initial h-11 sm:h-10 px-6 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
              >
                Avançar <ArrowRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSaveExam(true)}
                disabled={savingExam}
                className="flex-1 sm:flex-initial h-11 sm:h-10 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-sm transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingExam ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{exam.aprovacaoRequerida ? 'Submetendo...' : 'Publicando...'}</span>
                  </>
                ) : (
                  <>
                    <Check size={16} strokeWidth={2.5} />
                    <span>{exam.aprovacaoRequerida ? 'Submeter para Aprovação' : 'Publicar Prova'}</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL: PRÉ-VISUALIZAÇÃO COMO ALUNO ─────────────────── */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl bg-white sm:rounded-3xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
              <div className="flex items-center gap-2">
                <Eye size={17} className="text-sky-600" />
                <span className="text-xs font-extrabold text-sky-900 uppercase tracking-wider">
                  Modo Pré-visualização do Aluno (Simulação)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* Header preview */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-sky-700 bg-sky-100/70 px-2 py-0.5 rounded-md uppercase tracking-wider inline-block">
                  {exam.disciplina}
                </span>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  {exam.titulo}
                </h2>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {exam.instrucoes || 'Leia atentamente cada questão. Responda com calma.'}
                </p>
                <div className="pt-3 border-t border-slate-200/80 flex items-center gap-3 sm:gap-4 flex-wrap text-xs text-slate-600">
                  <span><strong>Duração:</strong> {exam.duracaoMinutos} min</span>
                </div>
              </div>

              {/* Questions list or Empty State */}
              {(exam.questoes || []).length === 0 ? (
                <div className="p-8 sm:p-12 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-300 flex flex-col items-center gap-2.5">
                  <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-2xs">
                    <BookOpen size={22} className="text-slate-400" />
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    Nenhuma questão adicionada ainda
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Adicione questões na Etapa 2 para pré-visualizar a experiência completa do aluno nesta tela.
                  </p>
                </div>
              ) : (
                (exam.questoes || []).map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-bold text-slate-900">Questão {idx + 1}</span>
                      <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                        {q.pontuacao} pts
                      </span>
                    </div>

                    <div className="text-xs sm:text-sm text-slate-800 leading-relaxed">
                      <HtmlContent html={q.enunciado} />
                    </div>

                    {/* Alternativas (Apenas múltipla escolha ou múltipla seleção) */}
                    {(q.tipo === 'multipla_escolha' || q.tipo === 'multipla_selecao') && q.alternativas && q.alternativas.length > 0 && (
                      <div className="space-y-2">
                        {q.alternativas.map(a => (
                          <div
                            key={a.id}
                            className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 text-xs text-slate-800 flex items-center gap-3 hover:bg-slate-100/70 transition-colors"
                          >
                            <span className="w-6 h-6 rounded-md border border-slate-300 bg-white flex items-center justify-center font-extrabold text-[11px] text-slate-600 shrink-0">
                              {a.letra}
                            </span>
                            <div className="flex-1 min-w-0">
                              <HtmlContent html={a.texto || '(Em branco)'} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Verdadeiro ou Falso (Apenas verdadeiro_falso) */}
                    {q.tipo === 'verdadeiro_falso' && q.itensVF && q.itensVF.length > 0 && (
                      <div className="space-y-2">
                        {q.itensVF.map(item => (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl bg-slate-50/70 border border-slate-200 text-xs text-slate-800 flex items-center justify-between gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <HtmlContent html={item.afirmacao} />
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <span className="px-2.5 py-1 rounded-md bg-white border border-slate-300 font-extrabold text-xs text-slate-700">V</span>
                              <span className="px-2.5 py-1 rounded-md bg-white border border-slate-300 font-extrabold text-xs text-slate-700">F</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Dissertativa */}
                    {q.tipo === 'dissertativa' && (
                      <div className="space-y-1.5">
                        <textarea
                          disabled
                          placeholder="Espaço para digitação da resposta pelo aluno..."
                          className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-400 h-24 resize-none cursor-not-allowed"
                        />
                        {q.limitePalavras && (
                          <span className="text-[11px] text-slate-400 block">Limite: até {q.limitePalavras} palavras</span>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3.5 sm:px-6 sm:py-4 border-t border-slate-200 flex items-center justify-end bg-slate-50/80 shrink-0">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="w-full sm:w-auto h-10 px-6 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors shadow-2xs cursor-pointer"
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

      {/* ── MODAL: IMPORTAR QUESTÕES (ARQUIVO / COPIAR E COLAR) ── */}
      <ImportQuestionsModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImport={handleImportQuestions}
        totalExamPoints={exam.valorTotal}
        currentQuestionsCount={(exam.questoes || []).length}
      />
    </div>
  )
}
