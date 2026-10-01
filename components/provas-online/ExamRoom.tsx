'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Shield, AlertTriangle, CheckCircle2, Bookmark,
  ChevronLeft, ChevronRight, Send, Wifi, WifiOff, RefreshCw,
  Maximize2, Minimize2, FileCheck2, AlertCircle, HelpCircle,
  Hash, Calendar, User, BookOpen, Printer, Check, Info, Bell,
  Calculator, Copy, CheckCheck, X
} from 'lucide-react'
import { toast } from 'sonner'
import { HtmlContent } from '@/components/HtmlContent'
import {
  ProvaOnline,
  QuestaoProva,
  TentativaAluno,
  RespostaQuestaoTentativa,
  ComprovanteEntrega
} from '@/types/provas-online'

interface ExamRoomProps {
  prova: ProvaOnline
  initialTentativa?: TentativaAluno | null
  currentUserId?: string
  alunoNome?: string
}

type SaveState = 'saved' | 'saving' | 'offline_queued' | 'error'

export function ExamRoom({ prova, initialTentativa, currentUserId, alunoNome }: ExamRoomProps) {
  const router = useRouter()

  // Briefing vs Taking vs Submitted
  const [tentativa, setTentativa] = useState<TentativaAluno | null>(initialTentativa || null)
  const [started, setStarted] = useState<boolean>(!!initialTentativa && initialTentativa.status === 'em_andamento')
  const [submittedVoucher, setSubmittedVoucher] = useState<ComprovanteEntrega | null>(
    initialTentativa?.comprovanteEntrega || null
  )

  // PIN input for proctored sessions
  const [pinCode, setPinCode] = useState('')
  const [startingLoading, setStartingLoading] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  // Current Question
  const [currentIndex, setCurrentIndex] = useState(0)

  // Answers Map: questionId -> RespostaQuestaoTentativa
  const [respostas, setRespostas] = useState<Record<string, RespostaQuestaoTentativa>>(() => {
    if (!initialTentativa?.respostas) return {}
    return { ...initialTentativa.respostas }
  })

  // Flagged for review set
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => {
    return new Set(initialTentativa?.questoesRevisao || [])
  })

  // Version counter for optimistic locking
  const [versaoRespostas, setVersaoRespostas] = useState<number>(initialTentativa?.versaoRespostas || 1)

  // Autosave status
  const [saveStatus, setSaveStatus] = useState<SaveState>('saved')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(new Date())
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // Timer & Clock
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(() => {
    if (!initialTentativa?.prazoLimite) return (prova.duracaoMinutos || 60) * 60
    const diff = Math.floor((new Date(initialTentativa.prazoLimite).getTime() - Date.now()) / 1000)
    return Math.max(0, diff)
  })

  // Fullscreen & Proctoring state
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [suspensionAlert, setSuspensionAlert] = useState<string | null>(
    initialTentativa?.status === 'suspensa' ? (initialTentativa.motivoSuspensao || 'Sessão suspensa pelo professor.') : null
  )
  const [teacherBroadcast, setTeacherBroadcast] = useState<string | null>(null)

  // Submission Modal
  const [submitModalOpen, setSubmitModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Pedagogical & Accessibility Enhancements
  const [pledgeAccepted, setPledgeAccepted] = useState(false)
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base')
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const [calcDisplay, setCalcDisplay] = useState('0')
  const [calcPrev, setCalcPrev] = useState('')
  const [copiedVoucher, setCopiedVoucher] = useState(false)

  const handleCalcClick = (val: string) => {
    if (val === 'C') {
      setCalcDisplay('0')
      setCalcPrev('')
      return
    }
    if (val === 'DEL') {
      setCalcDisplay(prev => prev.length > 1 ? prev.slice(0, -1) : '0')
      return
    }
    if (val === '√') {
      try {
        const num = parseFloat(calcDisplay)
        if (num < 0) {
          setCalcDisplay('Erro')
        } else {
          setCalcDisplay(String(Math.round(Math.sqrt(num) * 100000) / 100000))
        }
      } catch {
        setCalcDisplay('Erro')
      }
      return
    }
    if (val === '=') {
      try {
        const sanitized = calcDisplay.replace(/×/g, '*').replace(/÷/g, '/').replace(/,/g, '.')
        if (/^[0-9+\-*/.() ]+$/.test(sanitized)) {
          // eslint-disable-next-line no-new-func
          const res = Function(`"use strict"; return (${sanitized})`)()
          if (isFinite(res) && !isNaN(res)) {
            setCalcPrev(`${calcDisplay} =`)
            setCalcDisplay(String(Math.round(res * 100000) / 100000))
          } else {
            setCalcDisplay('Erro')
          }
        } else {
          setCalcDisplay('Erro')
        }
      } catch {
        setCalcDisplay('Erro')
      }
      return
    }
    // Append char
    setCalcDisplay(prev => {
      if (prev === '0' && !['+', '-', '×', '÷', '.'].includes(val)) return val
      if (prev === 'Erro') return val
      return prev + val
    })
  }

  // Questions ordered according to attempt (if shuffled)
  const orderedQuestions: QuestaoProva[] = useMemo(() => {
    const list = prova.questoes || []
    if (!tentativa?.ordemQuestoesSorteada || tentativa.ordemQuestoesSorteada.length === 0) {
      return list
    }
    const map = new Map(list.map(q => [q.id, q]))
    const ordered: QuestaoProva[] = []
    tentativa.ordemQuestoesSorteada.forEach(qid => {
      const q = map.get(qid)
      if (q) ordered.push(q)
    })
    // Append any missing
    list.forEach(q => {
      if (!ordered.find(o => o.id === q.id)) ordered.push(q)
    })
    return ordered
  }, [prova.questoes, tentativa?.ordemQuestoesSorteada])

  const currentQuestion = orderedQuestions[currentIndex] || orderedQuestions[0]

  // Offline queue storage key
  const storageQueueKey = useMemo(() => `impacto_offline_respostas_${prova.id}_${tentativa?.id || 'draft'}`, [prova.id, tentativa?.id])

  // Refs for autosave debounce & anti-cheat debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastIncidentTimeRef = useRef<number>(0)

  // --- Network Online / Offline Listeners ---
  useEffect(() => {
    function handleOnline() {
      setIsOnline(true)
      toast.success('Conexão restabelecida. Sincronizando respostas...')
      syncPendingAnswers()
    }
    function handleOffline() {
      setIsOnline(false)
      setSaveStatus('offline_queued')
      toast.warning('Sem conexão à internet. Respostas estão sendo salvas no dispositivo.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [tentativa?.id, versaoRespostas])

  // --- Autosave Debounce Sync to Server ---
  const syncPendingAnswers = useCallback(async () => {
    if (!tentativa || !started || tentativa.status !== 'em_andamento') return

    // Collect answers
    const answersArray = Object.values(respostas)
    const revisaoArray = Array.from(flaggedIds)

    setSaveStatus('saving')

    try {
      const newVersion = versaoRespostas + 1
      const res = await fetch(`/api/provas-online/tentativas/${tentativa.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respostas: answersArray,
          questoesRevisao: revisaoArray,
          versaoRespostas: newVersion,
          tempoGastoSegundos: Math.max(0, (prova.duracaoMinutos * 60) - timeRemainingSeconds)
        })
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          toast.info('Respostas sincronizadas com versão mais recente do servidor.')
        } else {
          throw new Error(data.error || 'Erro ao sincronizar respostas')
        }
      }

      setVersaoRespostas(newVersion)
      setSaveStatus('saved')
      setLastSavedAt(new Date())
      setPendingSyncCount(0)

      // Clear local queue if succeeded
      if (typeof window !== 'undefined') {
        localStorage.removeItem(storageQueueKey)
      }
    } catch (err: any) {
      console.warn('Falha no salvamento remoto:', err)
      // Save to local storage as fallback
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageQueueKey, JSON.stringify({
          respostas: answersArray,
          questoesRevisao: revisaoArray,
          savedAt: new Date().toISOString()
        }))
      }
      setSaveStatus('offline_queued')
      setPendingSyncCount(answersArray.length)
    }
  }, [tentativa, started, respostas, flaggedIds, versaoRespostas, prova.duracaoMinutos, timeRemainingSeconds, storageQueueKey])

  // Trigger autosave when answers change with 900ms debounce
  const scheduleAutosave = useCallback(() => {
    setSaveStatus('saving')
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      syncPendingAnswers()
    }, 900)
  }, [syncPendingAnswers])

  // --- Heartbeat & Polling Timer (syncs remaining time & fetches teacher broadcast) ---
  useEffect(() => {
    if (!started || !tentativa || tentativa.status !== 'em_andamento') return

    const interval = setInterval(async () => {
      setTimeRemainingSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval)
          handleForceAutoSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Polling every 25 seconds for teacher updates / extra time / unlock
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`/api/provas-online/tentativas/${tentativa.id}`)
        if (res.ok) {
          const data = await res.json()
          if (data.tentativa) {
            // Update deadline if extra time was granted
            if (data.tentativa.prazoLimite) {
              const diff = Math.floor((new Date(data.tentativa.prazoLimite).getTime() - Date.now()) / 1000)
              if (diff > 0) setTimeRemainingSeconds(diff)
            }

            // Check suspension status
            if (data.tentativa.status === 'suspensa') {
              setSuspensionAlert(data.tentativa.motivoSuspensao || 'Sessão suspensa para verificação do professor.')
            } else if (data.tentativa.status === 'em_andamento' && suspensionAlert) {
              setSuspensionAlert(null)
              toast.success('Sua prova foi liberada pelo professor!')
            }

            // Check if teacher forced submission
            if (data.tentativa.status === 'entregue' && !submittedVoucher) {
              setSubmittedVoucher(data.tentativa.comprovanteEntrega || null)
              setStarted(false)
            }
          }

          // Check teacher messages
          if (data.mensagensNaoLidas && data.mensagensNaoLidas.length > 0) {
            const latest = data.mensagensNaoLidas[data.mensagensNaoLidas.length - 1]
            setTeacherBroadcast(latest.conteudo)
          }
        }
      } catch (err) {
        // silent fail on poll
      }
    }, 25000)

    return () => {
      clearInterval(interval)
      clearInterval(pollInterval)
    }
  }, [started, tentativa, suspensionAlert, submittedVoucher])

  // --- Anti-Cheat Event Logger ---
  const recordIncident = useCallback(async (tipo: string, descricao: string) => {
    if (!tentativa || !started || tentativa.status !== 'em_andamento') return

    const now = Date.now()
    if (now - lastIncidentTimeRef.current < 3000) return
    lastIncidentTimeRef.current = now

    try {
      const res = await fetch(`/api/provas-online/tentativas/${tentativa.id}/ocorrencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, descricao })
      })
      const data = await res.json()

      if (data.suspensa) {
        setSuspensionAlert('Prova suspensa automaticamente por múltiplos eventos de saída da tela.')
      }
    } catch (err) {
      // Ignore network errors in incident logging
    }
  }, [tentativa, started])

  // Setup Anti-Cheat Listeners
  useEffect(() => {
    if (!started || !tentativa || tentativa.status !== 'em_andamento') return

    function handleVisibilityChange() {
      if (document.hidden) {
        recordIncident('troca_aba', 'Aluno saiu da aba ou minimizou a janela da prova.')
      } else {
        toast.warning('Atenção: A mudança de aba durante a prova foi registrada pela supervisão.')
      }
    }

    function handleFullscreenChange() {
      const isFull = !!document.fullscreenElement
      setIsFullscreen(isFull)
      if (!isFull && prova.exigirTelaCheia) {
        recordIncident('saida_tela_cheia', 'Aluno saiu do modo de tela cheia obrigatório.')
        toast.error('Você saiu do modo tela cheia. Retorne para prosseguir.')
      }
    }

    function handleCopy(e: ClipboardEvent) {
      if (prova.bloquearColar) {
        e.preventDefault()
        recordIncident('tentativa_copia', 'Tentativa de cópia de texto bloqueada.')
        toast.warning('Ação desabilitada pela política da prova.')
      }
    }

    function handlePaste(e: ClipboardEvent) {
      if (prova.bloquearColar) {
        e.preventDefault()
        recordIncident('tentativa_cola', 'Tentativa de colar conteúdo externo bloqueada.')
        toast.warning('Ação desabilitada pela política da prova.')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    window.addEventListener('copy', handleCopy)
    window.addEventListener('paste', handlePaste)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      window.removeEventListener('copy', handleCopy)
      window.removeEventListener('paste', handlePaste)
    }
  }, [started, tentativa, prova.exigirTelaCheia, prova.bloquearColar, recordIncident])

  // Request Fullscreen helper
  const enterFullscreen = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      }
    } catch (err) {
      console.warn('Fullscreen request denied or not supported')
    }
  }

  // --- Start Exam Action ---
  const handleStartExam = async () => {
    setStartingLoading(true)
    setStartError(null)

    try {
      const res = await fetch(`/api/provas-online/${prova.id}/iniciar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigoAcesso: pinCode.trim() })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível iniciar a prova')
      }

      setTentativa(data.tentativa)
      setStarted(true)

      // Initialize answers from attempt
      if (data.tentativa.respostas) {
        const map: Record<string, RespostaQuestaoTentativa> = {}
        data.tentativa.respostas.forEach((r: RespostaQuestaoTentativa) => {
          map[r.questaoId] = r
        })
        setRespostas(map)
      }

      // Initialize flags
      if (data.tentativa.questoesRevisao) {
        setFlaggedIds(new Set(data.tentativa.questoesRevisao))
      }

      // Compute remaining time
      if (data.tentativa.prazoLimite) {
        const diff = Math.floor((new Date(data.tentativa.prazoLimite).getTime() - Date.now()) / 1000)
        setTimeRemainingSeconds(Math.max(0, diff))
      }

      // Enter fullscreen if required
      if (prova.exigirTelaCheia) {
        await enterFullscreen()
      }

      toast.success(data.retomada ? 'Prova retomada com sucesso!' : 'Prova iniciada! Boa sorte!')
    } catch (err: any) {
      setStartError(err.message || 'Falha ao iniciar prova')
      toast.error(err.message || 'Falha ao iniciar prova')
    } finally {
      setStartingLoading(false)
    }
  }

  // --- Answer Change Handlers ---
  const handleSelectSingleChoice = (questionId: string, choiceId: string) => {
    setRespostas(prev => {
      const updated: RespostaQuestaoTentativa = {
        questaoId: questionId,
        tipo: 'multipla_escolha',
        alternativaIdSelecionada: choiceId,
        respostaOpcaoId: choiceId,
        versao: versaoRespostas,
        salvoEm: new Date().toISOString(),
        respondidaEm: new Date().toISOString()
      }
      return { ...prev, [questionId]: updated }
    })
    scheduleAutosave()
  }

  const handleToggleMultipleChoice = (questionId: string, choiceId: string) => {
    setRespostas(prev => {
      const current = prev[questionId]?.alternativasIdsSelecionadas || []
      const isSelected = current.includes(choiceId)
      const nextSelected = isSelected
        ? current.filter(id => id !== choiceId)
        : [...current, choiceId]

      const updated: RespostaQuestaoTentativa = {
        questaoId: questionId,
        tipo: 'multipla_selecao',
        alternativasIdsSelecionadas: nextSelected,
        respostaOpcoesIds: nextSelected,
        versao: versaoRespostas,
        salvoEm: new Date().toISOString(),
        respondidaEm: new Date().toISOString()
      }
      return { ...prev, [questionId]: updated }
    })
    scheduleAutosave()
  }

  const handleToggleTrueFalse = (questionId: string, itemId: string, value: boolean) => {
    setRespostas(prev => {
      const currentItems = prev[questionId]?.itensVouF || []
      const filtered = currentItems.filter(i => i.id !== itemId)
      const nextItems = [...filtered, { id: itemId, respostaAluno: value }]

      const updated: RespostaQuestaoTentativa = {
        questaoId: questionId,
        tipo: 'verdadeiro_falso',
        itensVouF: nextItems,
        versao: versaoRespostas,
        salvoEm: new Date().toISOString(),
        respondidaEm: new Date().toISOString()
      }
      return { ...prev, [questionId]: updated }
    })
    scheduleAutosave()
  }

  const handleEssayChange = (questionId: string, text: string) => {
    setRespostas(prev => {
      const updated: RespostaQuestaoTentativa = {
        questaoId: questionId,
        tipo: 'dissertativa',
        textoDissertativo: text,
        respostaDissertativa: text,
        versao: versaoRespostas,
        salvoEm: new Date().toISOString(),
        respondidaEm: new Date().toISOString()
      }
      return { ...prev, [questionId]: updated }
    })
    scheduleAutosave()
  }

  // Toggle review flag
  const handleToggleFlag = (questionId: string) => {
    setFlaggedIds(prev => {
      const next = new Set(prev)
      if (next.has(questionId)) {
        next.delete(questionId)
        toast.info('Questão desmarcada da revisão')
      } else {
        next.add(questionId)
        toast.info('Questão marcada para revisar antes de entregar')
      }
      return next
    })
    scheduleAutosave()
  }

  // Switch Question (triggers immediate save of previous)
  const goToQuestion = (index: number) => {
    if (index < 0 || index >= orderedQuestions.length) return
    if (prova.bloquearRetorno && index < currentIndex) {
      toast.warning('A configuração desta prova não permite retornar a questões anteriores.')
      return
    }
    if (saveStatus === 'saving') {
      void syncPendingAnswers()
    }
    setCurrentIndex(index)
  }

  // --- Final Delivery Submit Handler ---
  const handleFinalSubmit = async () => {
    if (!tentativa) return
    setSubmitting(true)

    try {
      const answersArray = Object.values(respostas)
      const revisaoArray = Array.from(flaggedIds)

      const res = await fetch(`/api/provas-online/tentativas/${tentativa.id}/entregar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respostas: answersArray,
          questoesRevisao: revisaoArray,
          tempoGastoSegundos: Math.max(0, (prova.duracaoMinutos * 60) - timeRemainingSeconds)
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao realizar entrega da avaliação')
      }

      setSubmittedVoucher(data.comprovante)
      setStarted(false)
      setSubmitModalOpen(false)

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }

      toast.success('Prova entregue com sucesso! Comprovante gerado.')
    } catch (err: any) {
      toast.error(err.message || 'Falha na entrega da prova')
    } finally {
      setSubmitting(false)
    }
  }

  // Auto-submit when time strictly expires
  const handleForceAutoSubmit = async () => {
    if (!tentativa || !started) return
    toast.error('Tempo esgotado! Realizando entrega automática...')
    await handleFinalSubmit()
  }

  // Format seconds to mm:ss or hh:mm:ss
  const formatTimer = (totalSec: number) => {
    const hours = Math.floor(totalSec / 3600)
    const minutes = Math.floor((totalSec % 3600) / 60)
    const seconds = totalSec % 60

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  }

  // Summary counts for review palette
  const answeredCount = useMemo(() => {
    return orderedQuestions.filter(q => {
      const ans = respostas[q.id]
      if (!ans) return false
      if (q.tipo === 'multipla_escolha') return !!ans.alternativaIdSelecionada
      if (q.tipo === 'multipla_selecao') return (ans.alternativasIdsSelecionadas || []).length > 0
      if (q.tipo === 'verdadeiro_falso') return (ans.itensVouF || []).length === (q.itensVouF || []).length
      if (q.tipo === 'dissertativa') return !!ans.textoDissertativo && ans.textoDissertativo.trim().length > 0
      return false
    }).length
  }, [orderedQuestions, respostas])

  const blankCount = orderedQuestions.length - answeredCount

  // =========================================================================
  // VIEW 1: VOUCHER / SUBMITTED SCREEN
  // =========================================================================
  if (submittedVoucher || (initialTentativa && initialTentativa.status === 'entregue')) {
    const voucher = submittedVoucher || initialTentativa?.comprovanteEntrega
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white border border-slate-200/90 rounded-3xl p-8 shadow-sm text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 mx-auto flex items-center justify-center mb-5 shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-black text-slate-900 mb-2">Comprovante Oficial de Entrega</h1>
          <p className="text-slate-500 text-sm mb-6">Sua avaliação foi recebida e registrada pelo servidor com autenticidade garantida.</p>

          {/* Voucher Details Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left space-y-4 mb-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <span className="text-xs uppercase font-mono tracking-wider text-slate-500 font-semibold">Código Autenticador</span>
              <div className="flex items-center gap-2">
                <span className="text-emerald-700 font-mono font-bold text-sm tracking-widest bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200">
                  {voucher?.hash || initialTentativa?.id?.slice(0, 16)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const code = voucher?.hash || initialTentativa?.id || ''
                    navigator.clipboard.writeText(code)
                    setCopiedVoucher(true)
                    toast.success('Código autenticador copiado!')
                    setTimeout(() => setCopiedVoucher(false), 2000)
                  }}
                  title="Copiar código autenticador"
                  className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors"
                >
                  {copiedVoucher ? <CheckCheck className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block mb-1">Avaliação</span>
                <span className="text-slate-900 font-semibold">{prova.titulo}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Disciplina</span>
                <span className="text-slate-900 font-semibold">{prova.disciplinaNome || prova.disciplina}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Aluno</span>
                <span className="text-slate-900 font-semibold">{alunoNome || voucher?.alunoNome || 'Aluno'}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Data / Horário de Entrega</span>
                <span className="text-slate-900 font-semibold">
                  {new Date(voucher?.dataHoraEntrega || Date.now()).toLocaleString('pt-BR')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Total de Questões</span>
                <span className="text-slate-900 font-semibold">{(prova.questoes || []).length} questões</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-1">Respostas Registradas</span>
                <span className="text-emerald-700 font-semibold">{voucher?.totalRespostasRegistradas || answeredCount} recebidas</span>
              </div>
            </div>

            {/* If instant grade published */}
            {initialTentativa?.statusCorrecao === 'corrigida' && initialTentativa.notaFinal !== undefined && (
              <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-600 font-medium">Nota Final Obtida:</span>
                <span className="text-lg font-bold text-sky-700 font-mono">
                  {initialTentativa.notaFinal.toFixed(1)} / {prova.valorTotal.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => window.print()}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 border border-slate-200 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir Comprovante
            </button>
            <button
              onClick={() => router.push('/provas-online')}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold transition-colors shadow-sm"
            >
              Voltar para Minhas Provas
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // =========================================================================
  // VIEW 2: BRIEFING & INSTRUCTIONS (BEFORE STARTING)
  // =========================================================================
  if (!started) {
    const deadlineStr = prova.dataHoraFim || prova.dataEncerramento || new Date().toISOString()
    const effectiveDeadlineMs = new Date(deadlineStr).getTime() - Date.now()
    const effectiveDurationMinutes = Math.min(
      prova.duracaoMinutos,
      Math.max(1, Math.floor(effectiveDeadlineMs / 60000))
    )
    const isEndingSoon = effectiveDurationMinutes < prova.duracaoMinutos

    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-sm relative"
        >
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
                  {prova.disciplinaNome || prova.disciplina}
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  {prova.finalidade.toUpperCase()}
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{prova.titulo}</h1>
              <p className="text-xs text-slate-500 mt-1">Professor Responsável: {prova.professorNome}</p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-medium">Valor Total</span>
              <span className="text-2xl font-mono font-bold text-sky-700">{prova.valorTotal.toFixed(1)} pts</span>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-sky-600" />
                Duração
              </div>
              <p className="text-base font-bold text-slate-900 font-mono">{prova.duracaoMinutos} min</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1 font-medium">
                <FileCheck2 className="w-3.5 h-3.5 text-blue-600" />
                Questões
              </div>
              <p className="text-base font-bold text-slate-900 font-mono">{(prova.questoes || []).length} itens</p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1 font-medium">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                Encerramento
              </div>
              <p className="text-xs font-semibold text-slate-800">
                {new Date(deadlineStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-slate-500 text-xs mb-1 font-medium">
                <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                Conexão
              </div>
              <p className={`text-xs font-semibold ${isOnline ? 'text-emerald-700' : 'text-rose-600'}`}>
                {isOnline ? 'Conectado' : 'Offline'}
              </p>
            </div>
          </div>

          {/* Near-Closing Warning if applicable */}
          {isEndingSoon && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-800 text-xs leading-relaxed">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <strong className="block font-semibold mb-1">Atenção ao horário de encerramento da prova:</strong>
                O encerramento oficial da prova ocorre às {new Date(deadlineStr).toLocaleTimeString('pt-BR')}. Caso inicie agora, seu tempo real disponível será de aproximadamente <strong>{effectiveDurationMinutes} minutos</strong> (o término oficial prevalece sobre a duração individual).
              </div>
            </div>
          )}

          {/* Instructions & Guidelines */}
          <div className="space-y-4 mb-6">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Info className="w-4 h-4 text-sky-600" />
                Instruções Gerais
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                {prova.instrucoes || 'Leia com atenção cada questão antes de responder. Suas respostas são salvas automaticamente pelo sistema.'}
              </p>
              {prova.materiaisPermitidos && (
                <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Materiais permitidos: </span>
                  {prova.materiaisPermitidos}
                </div>
              )}
            </div>

            {/* Monitoring Rules Disclaimer */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4 text-sky-600" />
                Regras de Navegação e Supervisão
              </h3>
              <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-5">
                <li>O cronômetro é gerenciado e sincronizado pelo servidor e começa assim que você clica em Iniciar.</li>
                <li>Recarregar a página, fechar o navegador ou trocar de aparelho não pausa ou amplia o tempo.</li>
                {prova.bloquearRetorno && (
                  <li className="text-amber-700 font-semibold">Nesta prova, não é permitido retornar a questões anteriores após avançar.</li>
                )}
                {prova.exigirTelaCheia && (
                  <li>A prova solicita modo de tela cheia para evitar distrações. Saídas de tela serão registradas.</li>
                )}
                {prova.bloquearColar && (
                  <li>Copiar e colar conteúdos externos está desabilitado durante a realização.</li>
                )}
                <li>Suas respostas possuem salvamento automático com tolerância a oscilações temporárias de rede.</li>
              </ul>
            </div>
          </div>

          {/* PIN Verification (Presential Mode) */}
          {prova.exigeCodigoAcesso && (
            <div className="mb-6 p-5 rounded-2xl bg-sky-50 border border-sky-200">
              <label className="block text-xs font-semibold text-sky-900 mb-2">
                Código de Liberação da Aplicação (Fornecido pelo Professor)
              </label>
              <input
                type="text"
                value={pinCode}
                onChange={e => setPinCode(e.target.value.toUpperCase())}
                placeholder="Ex: PROVA123"
                className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-mono tracking-widest text-center text-lg placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>
          )}

          {/* Start Error */}
          {startError && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{startError}</span>
            </div>
          )}

          {/* Academic Integrity Pledge */}
          <div className="mb-6 p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={pledgeAccepted}
                onChange={e => setPledgeAccepted(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer shrink-0"
              />
              <span className="text-xs text-slate-700 leading-relaxed">
                <strong className="text-amber-900 block font-semibold mb-0.5">Termo de Integridade Acadêmica e Responsabilidade Escolar:</strong>
                Declaro que compreendi todas as regras de realização desta prova. Comprometo-me a realizar esta avaliação com estrita honestidade, de maneira estritamente individual, sem consulta a materiais não permitidos e sem comunicação com terceiros.
              </span>
            </label>
          </div>

          {/* Action Button */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              onClick={() => router.push('/provas-online')}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold transition-colors border border-slate-200"
            >
              Voltar
            </button>

            <button
              onClick={handleStartExam}
              disabled={startingLoading || !isOnline || !pledgeAccepted || (prova.exigeCodigoAcesso && !pinCode.trim())}
              className="px-8 py-3.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold text-sm shadow-sm flex items-center gap-3 transition-colors cursor-pointer"
            >
              {startingLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Iniciando tentativa...
                </>
              ) : (
                <>
                  Iniciar Prova Agora
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // =========================================================================
  // VIEW 3: ACTIVE EXAM ROOM (TAKING THE EXAM)
  // =========================================================================
  const isTimeCritical = timeRemainingSeconds <= 300 // under 5 min
  const isFlagged = flaggedIds.has(currentQuestion.id)
  const currentAnswer = respostas[currentQuestion.id]

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col pb-16">
      {/* 1. STICKY TOPBAR */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Title & Subject */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shrink-0">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 truncate">{prova.titulo}</h2>
              <span className="text-xs text-slate-500 truncate block">{prova.disciplinaNome || prova.disciplina}</span>
            </div>
          </div>

          {/* Center: Save Status & Sync */}
          <div className="hidden md:flex items-center gap-2">
            {saveStatus === 'saved' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Salvo {lastSavedAt && `(${lastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`}
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                Salvando respostas...
              </span>
            )}
            {saveStatus === 'offline_queued' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                Sem conexão — {pendingSyncCount} alterações locais
              </span>
            )}
            {saveStatus === 'error' && (
              <button
                onClick={() => syncPendingAnswers()}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                Falha ao salvar — Tentar novamente
              </button>
            )}
          </div>

          {/* Right: Timer & Final Submit Button */}
          <div className="flex items-center gap-3">
            {/* Sticky Timer */}
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-sm font-bold border transition-all ${
                isTimeCritical
                  ? 'bg-rose-50 border-rose-300 text-rose-700 animate-pulse shadow-xs'
                  : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              <Clock className={`w-4 h-4 ${isTimeCritical ? 'text-rose-600' : 'text-sky-600'}`} />
              <span>{formatTimer(timeRemainingSeconds)}</span>
            </div>

            {/* Accessibility Font Size Zoom */}
            <div className="hidden md:flex items-center rounded-xl bg-slate-100 border border-slate-200 p-0.5 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setFontSize(prev => prev === 'lg' ? 'base' : 'sm')}
                title="Diminuir tamanho da fonte (A-)"
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${fontSize === 'sm' ? 'bg-white text-sky-700 shadow-xs' : 'hover:text-slate-900'}`}
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontSize('base')}
                title="Tamanho padrão de fonte (A)"
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${fontSize === 'base' ? 'bg-white text-sky-700 shadow-xs' : 'hover:text-slate-900'}`}
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontSize(prev => prev === 'sm' ? 'base' : 'lg')}
                title="Aumentar tamanho da fonte (A+)"
                className={`px-2 py-1 rounded-lg transition-colors cursor-pointer ${fontSize === 'lg' ? 'bg-white text-sky-700 shadow-xs' : 'hover:text-slate-900'}`}
              >
                A+
              </button>
            </div>

            {/* Calculator Toggle */}
            <button
              type="button"
              onClick={() => setCalculatorOpen(!calculatorOpen)}
              title="Calculadora Básica Integrada"
              className={`p-2 rounded-xl border transition-colors hidden sm:flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${
                calculatorOpen
                  ? 'bg-sky-50 text-sky-700 border-sky-300 ring-1 ring-sky-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
              }`}
            >
              <Calculator className="w-4 h-4 text-slate-600" />
              <span className="hidden xl:inline">Calculadora</span>
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={enterFullscreen}
              title="Tela Cheia"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors hidden sm:flex"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Deliver Exam Button */}
            <button
              onClick={() => setSubmitModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Entregar Prova
            </button>
          </div>
        </div>
      </header>

      {/* 2. BROADCAST MESSAGE BANNER FROM TEACHER (IF ANY) */}
      <AnimatePresence>
        {teacherBroadcast && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-sky-600 text-white px-4 py-2.5 text-xs flex items-center justify-between shadow-xs"
          >
            <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
              <Bell className="w-4 h-4 shrink-0 animate-bounce" />
              <span><strong>Aviso do Professor:</strong> {teacherBroadcast}</span>
            </div>
            <button
              onClick={() => setTeacherBroadcast(null)}
              className="text-white/80 hover:text-white text-xs underline cursor-pointer"
            >
              Fechar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. SUSPENSION FULLSCREEN BLOCKER IF SUSPENDED */}
      {suspensionAlert && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              margin: '0 auto',
              background: '#ffffff',
              borderRadius: '24px',
              border: '1px solid #fecdd3',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              padding: '32px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                color: '#e11d48',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shield className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 m-0">Prova Suspensa para Supervisão</h2>
            <p className="text-slate-600 text-xs m-0 leading-relaxed">
              {suspensionAlert}
            </p>
            <p className="text-[11px] text-slate-400 m-0">
              Aguarde a liberação pelo professor supervisor. O cronômetro da sua prova permanece protegido.
            </p>
            <button
              onClick={() => {
                syncPendingAnswers()
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              className="hover:bg-slate-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-sky-600" />
              Verificar se já fui liberado
            </button>
          </div>
        </div>
      )}

      {/* 4. MAIN EXAM BODY (Split: Question View + Navigation Palette) */}
      <div className="max-w-7xl mx-auto w-full px-4 py-6 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Current Question Content (8 cols) */}
        <div className="lg:col-span-8 flex flex-col">
          <motion.div
            key={currentQuestion.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-xs flex-1 flex flex-col"
          >
            {/* Question Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 font-bold font-mono text-sm flex items-center justify-center border border-sky-200">
                  {currentIndex + 1}
                </span>
                <div>
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Questão {currentIndex + 1} de {orderedQuestions.length}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Valor: {(currentQuestion.valorPontos || currentQuestion.pontuacao || 0).toFixed(1)} {((currentQuestion.valorPontos || currentQuestion.pontuacao) === 1) ? 'ponto' : 'pontos'}
                  </span>
                </div>
              </div>

              {/* Flag for Review Button */}
              <button
                onClick={() => handleToggleFlag(currentQuestion.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                  isFlagged
                    ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-xs'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:text-slate-900'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isFlagged ? 'fill-amber-500 text-amber-500' : ''}`} />
                {isFlagged ? 'Marcada para Revisar' : 'Marcar para Revisar'}
              </button>
            </div>

            {/* Question Enunciado / Statement */}
            <div className={`py-6 text-slate-800 leading-relaxed border-b border-slate-100 ${
              fontSize === 'sm' ? 'text-xs md:text-sm' : fontSize === 'lg' ? 'text-base md:text-lg' : 'text-sm md:text-base'
            }`}>
              <HtmlContent html={currentQuestion.enunciado} />
            </div>

            {/* Question Input Section */}
            <div className="py-6 flex-1">
              {/* TYPE 1: Single Choice (Multipla Escolha) */}
              {currentQuestion.tipo === 'multipla_escolha' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 font-medium mb-3">Selecione apenas uma alternativa:</p>
                  {(currentQuestion.alternativas || []).map((alt, altIdx) => {
                    const isSelected = currentAnswer?.alternativaIdSelecionada === alt.id || currentAnswer?.respostaOpcaoId === alt.id
                    const letter = String.fromCharCode(65 + altIdx)

                    return (
                      <div
                        key={alt.id}
                        onClick={() => handleSelectSingleChoice(currentQuestion.id, alt.id)}
                        className={`group p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                          isSelected
                            ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-200 shadow-xs'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                        }`}
                      >
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs font-mono transition-all shrink-0 mt-0.5 ${
                            isSelected
                              ? 'bg-sky-600 text-white font-bold'
                              : 'bg-white text-slate-600 border border-slate-200 group-hover:bg-slate-200'
                          }`}
                        >
                          {letter}
                        </div>
                        <div className={`flex-1 leading-relaxed pt-0.5 text-slate-800 ${
                          fontSize === 'sm' ? 'text-xs' : fontSize === 'lg' ? 'text-base md:text-lg' : 'text-sm'
                        }`}>
                          <HtmlContent html={alt.texto} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* TYPE 2: Multiple Choice (Multipla Seleção) */}
              {currentQuestion.tipo === 'multipla_selecao' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-3 text-xs">
                    <p className="text-slate-500 font-medium">Selecione todas as alternativas corretas:</p>
                    <span className="text-sky-700 font-mono font-medium">
                      {currentQuestion.permitePontuacaoParcial ? 'Pontuação parcial admitida' : 'Exige todas as corretas'}
                    </span>
                  </div>
                  {(currentQuestion.alternativas || []).map((alt, altIdx) => {
                    const selectedList = currentAnswer?.alternativasIdsSelecionadas || currentAnswer?.respostaOpcoesIds || []
                    const isSelected = selectedList.includes(alt.id)
                    const letter = String.fromCharCode(65 + altIdx)

                    return (
                      <div
                        key={alt.id}
                        onClick={() => handleToggleMultipleChoice(currentQuestion.id, alt.id)}
                        className={`group p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                          isSelected
                            ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-200 shadow-xs'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
                        }`}
                      >
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-all shrink-0 mt-0.5 border ${
                            isSelected
                              ? 'bg-sky-600 border-sky-600 text-white'
                              : 'bg-white border-slate-300 text-transparent'
                          }`}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                        <div className={`flex-1 leading-relaxed pt-0.5 text-slate-800 ${
                          fontSize === 'sm' ? 'text-xs' : fontSize === 'lg' ? 'text-base md:text-lg' : 'text-sm'
                        }`}>
                          <span className="font-mono font-bold text-slate-500 mr-2">{letter})</span>
                          <HtmlContent html={alt.texto} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* TYPE 3: True / False (Verdadeiro ou Falso) */}
              {currentQuestion.tipo === 'verdadeiro_falso' && (
                <div className="space-y-3">
                  <p className="text-xs text-slate-500 font-medium mb-3">Classifique cada afirmação como Verdadeira (V) ou Falsa (F):</p>
                  {((currentQuestion.itensVF || currentQuestion.itensVouF || []) as any[]).map((item, itemIdx) => {
                    const itemAnswer = (currentAnswer?.itensVouF || []).find(i => i.id === item.id)

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="flex-1 text-sm text-slate-800 leading-relaxed">
                          <span className="font-mono font-bold text-slate-500 mr-2">{itemIdx + 1}.</span>
                          <HtmlContent html={item.afirmacao} />
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleToggleTrueFalse(currentQuestion.id, item.id, true)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all border cursor-pointer ${
                              itemAnswer?.respostaAluno === true
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            V (Verdadeiro)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleTrueFalse(currentQuestion.id, item.id, false)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all border cursor-pointer ${
                              itemAnswer?.respostaAluno === false
                                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            F (Falso)
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* TYPE 4: Essay (Dissertativa) */}
              {currentQuestion.tipo === 'dissertativa' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Digite sua resposta fundamentada no campo abaixo:</span>
                    {currentQuestion.limitePalavras && (
                      <span className="font-mono text-sky-700 font-medium">
                        Limite sugerido: {currentQuestion.limitePalavras} palavras
                      </span>
                    )}
                  </div>

                  <textarea
                    rows={8}
                    value={currentAnswer?.textoDissertativo || ''}
                    onChange={e => handleEssayChange(currentQuestion.id, e.target.value)}
                    placeholder="Escreva sua resolução aqui de forma clara e objetiva..."
                    className="w-full bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white rounded-2xl p-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-100 transition-all resize-y leading-relaxed font-sans"
                  />

                  {/* Word / Char counter */}
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>
                      {(currentAnswer?.textoDissertativo || '').trim().split(/\s+/).filter(Boolean).length} palavras • {(currentAnswer?.textoDissertativo || '').length} caracteres
                    </span>
                    <span className="text-slate-400 italic">Salvamento contínuo durante a digitação</span>
                  </div>

                  {/* Evaluation Rubrics info for student transparency */}
                  {currentQuestion.criteriosAvaliacao && currentQuestion.criteriosAvaliacao.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                      <span className="font-semibold text-slate-700 block mb-2">Critérios de Correção da Questão:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {currentQuestion.criteriosAvaliacao.map(crit => (
                          <div key={crit.id} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                            <span className="text-slate-700">{crit.descricao}</span>
                            <span className="text-sky-700 font-mono font-semibold">{(crit.pesoPontos || crit.pontosMaximos || 0).toFixed(1)} pts</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Bottom Footer */}
            <div style={{
              paddingTop: '20px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              marginTop: 'auto'
            }}>
              <button
                type="button"
                onClick={() => goToQuestion(currentIndex - 1)}
                disabled={currentIndex === 0 || !!prova.bloquearRetorno}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '40px',
                  padding: '0 20px',
                  borderRadius: '10px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: (currentIndex === 0 || !!prova.bloquearRetorno) ? '#94a3b8' : '#334155',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: (currentIndex === 0 || !!prova.bloquearRetorno) ? 'not-allowed' : 'pointer',
                  opacity: (currentIndex === 0 || !!prova.bloquearRetorno) ? 0.5 : 1,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'all 0.15s'
                }}
              >
                <ChevronLeft size={16} />
                Anterior
              </button>

              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, fontFamily: 'monospace' }}>
                {currentIndex + 1} de {orderedQuestions.length}
              </span>

              {currentIndex < orderedQuestions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => goToQuestion(currentIndex + 1)}
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
                    boxShadow: '0 2px 6px rgba(2, 132, 199, 0.28)',
                    transition: 'all 0.15s'
                  }}
                >
                  Próxima Questão
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '40px',
                    padding: '0 24px',
                    borderRadius: '10px',
                    background: '#10b981',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.15s'
                  }}
                >
                  Revisar e Entregar
                  <Send size={15} />
                </button>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column: Question Palette Drawer / Summary (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Navegação de Questões</span>
              <span className="font-mono text-sky-700">{answeredCount}/{orderedQuestions.length} respondidas</span>
            </h3>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 mb-5 overflow-hidden">
              <div
                className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(answeredCount / orderedQuestions.length) * 100}%` }}
              />
            </div>

            {/* Question Quick Access Grid */}
            <div className="grid grid-cols-5 gap-2 mb-6">
              {orderedQuestions.map((q, idx) => {
                const ans = respostas[q.id]
                const vfCount = (q.itensVF || q.itensVouF || []).length
                const isAnswered = !!(
                  (q.tipo === 'multipla_escolha' && (ans?.alternativaIdSelecionada || ans?.respostaOpcaoId)) ||
                  (q.tipo === 'multipla_selecao' && ((ans?.alternativasIdsSelecionadas || ans?.respostaOpcoesIds || []).length > 0)) ||
                  (q.tipo === 'verdadeiro_falso' && (ans?.itensVouF || Object.keys(ans?.respostaVF || {})).length === vfCount) ||
                  (q.tipo === 'dissertativa' && (ans?.textoDissertativo || ans?.respostaDissertativa) && (ans?.textoDissertativo || ans?.respostaDissertativa || '').trim().length > 0)
                )
                const isCurrent = idx === currentIndex
                const isFlag = flaggedIds.has(q.id)

                let btnClass = 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                if (isAnswered) {
                  btnClass = 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                }
                if (isCurrent) {
                  btnClass = 'ring-2 ring-sky-500 text-sky-900 font-bold bg-sky-100 border-sky-300'
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => goToQuestion(idx)}
                    disabled={!!prova.bloquearRetorno && idx < currentIndex}
                    className={`h-10 rounded-xl font-mono text-xs font-semibold border flex items-center justify-center relative transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${btnClass}`}
                  >
                    {idx + 1}
                    {isFlag && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full shadow-xs" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div className="border-t border-slate-100 pt-4 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-700">
                <span className="w-3 h-3 rounded-md bg-emerald-50 border border-emerald-300" />
                <span>Respondida ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <span className="w-3 h-3 rounded-md bg-slate-50 border border-slate-200" />
                <span>Em branco ({blankCount})</span>
              </div>
              <div className="flex items-center gap-2 text-amber-700">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span>Marcada para revisar ({flaggedIds.size})</span>
              </div>
            </div>

            {/* Ready to submit card */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <button
                onClick={() => setSubmitModalOpen(true)}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Finalizar e Entregar Prova
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. SUBMISSION CONFIRMATION MODAL */}
      <AnimatePresence>
        {submitModalOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              background: 'rgba(15, 23, 42, 0.6)',
              backdropFilter: 'blur(6px)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{
                width: '100%',
                maxWidth: '480px',
                margin: '0 auto',
                background: '#ffffff',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  color: '#0284c7',
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Send className="w-6 h-6" />
              </div>

              <div style={{ textAlign: 'center' }}>
                <h2 className="text-lg font-bold text-slate-900 m-0">Confirmar Entrega da Avaliação</h2>
                <p className="text-xs text-slate-500 mt-1 mb-0">
                  Revise os dados da sua tentativa antes de confirmar o encerramento definitivo:
                </p>
              </div>

              {/* Status summary list */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  fontSize: '12px',
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Total de Questões:</span>
                  <span className="font-bold text-slate-900 font-mono">{orderedQuestions.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Questões Respondidas:</span>
                  <span className="font-bold text-emerald-700 font-mono">{answeredCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Questões em Branco:</span>
                  <span className={`font-bold font-mono ${blankCount > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                    {blankCount}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Marcadas para Revisão:</span>
                  <span className="font-bold text-amber-700 font-mono">{flaggedIds.size}</span>
                </div>
              </div>

              {blankCount > 0 && (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Você ainda tem {blankCount} questão(ões) sem resposta preenchida.</span>
                </div>
              )}

              <p className="text-xs text-slate-500 text-center m-0 leading-relaxed">
                Após confirmar, suas respostas serão computadas pelo servidor e um comprovante digital de entrega será gerado. Não será possível alterar respostas após o envio.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(false)}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    color: '#334155',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  className="hover:bg-slate-200 transition-colors"
                >
                  Continuar Respondendo
                </button>

                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '12px',
                    background: '#059669',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  className="hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Entregando...
                    </>
                  ) : (
                    <>
                      Confirmar Entrega
                      <Check className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. BUILT-IN FLOATING CALCULATOR WIDGET */}
      {calculatorOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 50,
            width: '290px',
            background: '#ffffff',
            borderRadius: '22px',
            border: '1px solid #cbd5e1',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.18), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-200">
                <Calculator className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-800">Calculadora de Apoio</span>
            </div>
            <button
              type="button"
              onClick={() => setCalculatorOpen(false)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Calculator Screen */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-right">
            <div className="text-[11px] font-mono text-slate-400 h-4 truncate">
              {calcPrev || ' '}
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 tracking-tight truncate">
              {calcDisplay}
            </div>
          </div>

          {/* Buttons Grid */}
          <div className="grid grid-cols-4 gap-1.5 text-xs font-semibold">
            {/* Row 1 */}
            <button
              type="button"
              onClick={() => handleCalcClick('C')}
              className="p-2.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-mono transition-colors cursor-pointer"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleCalcClick('DEL')}
              className="p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 font-mono transition-colors cursor-pointer"
            >
              ⌫
            </button>
            <button
              type="button"
              onClick={() => handleCalcClick('√')}
              className="p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 font-mono transition-colors cursor-pointer"
            >
              √
            </button>
            <button
              type="button"
              onClick={() => handleCalcClick('÷')}
              className="p-2.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 font-mono font-bold transition-colors cursor-pointer"
            >
              ÷
            </button>

            {/* Row 2 */}
            {['7', '8', '9'].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => handleCalcClick(n)}
                className="p-2.5 rounded-xl bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 font-mono font-bold transition-colors cursor-pointer shadow-xs"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleCalcClick('×')}
              className="p-2.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 font-mono font-bold transition-colors cursor-pointer"
            >
              ×
            </button>

            {/* Row 3 */}
            {['4', '5', '6'].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => handleCalcClick(n)}
                className="p-2.5 rounded-xl bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 font-mono font-bold transition-colors cursor-pointer shadow-xs"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleCalcClick('-')}
              className="p-2.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 font-mono font-bold transition-colors cursor-pointer"
            >
              -
            </button>

            {/* Row 4 */}
            {['1', '2', '3'].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => handleCalcClick(n)}
                className="p-2.5 rounded-xl bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 font-mono font-bold transition-colors cursor-pointer shadow-xs"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleCalcClick('+')}
              className="p-2.5 rounded-xl bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 font-mono font-bold transition-colors cursor-pointer"
            >
              +
            </button>

            {/* Row 5 */}
            <button
              type="button"
              onClick={() => handleCalcClick('0')}
              className="p-2.5 rounded-xl bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 font-mono font-bold transition-colors cursor-pointer shadow-xs col-span-2"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleCalcClick('.')}
              className="p-2.5 rounded-xl bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 font-mono font-bold transition-colors cursor-pointer shadow-xs"
            >
              .
            </button>
            <button
              type="button"
              onClick={() => handleCalcClick('=')}
              className="p-2.5 rounded-xl bg-sky-600 text-white hover:bg-sky-700 border border-sky-600 font-mono font-bold transition-colors cursor-pointer shadow-xs"
            >
              =
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
