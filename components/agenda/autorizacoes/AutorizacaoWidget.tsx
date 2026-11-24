'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef, useId } from 'react'
import { 
  FileCheck2, Check, Lock, Unlock, Clock, Users, RefreshCw, 
  AlertCircle, CheckCircle2, XCircle, X, Shield, Sparkles, 
  MapPin, Calendar, DollarSign, HeartPulse, ShieldCheck, 
  Printer, Search, ChevronRight, Loader2, Filter
} from 'lucide-react'
import Portal from '@/components/Portal'
import { AutorizacaoData, AutorizacaoResposta } from '@/lib/autorizacoes/types'

let supportsAutDisplayTransition: boolean | undefined
function canAutTransitionDisplay(): boolean {
  if (supportsAutDisplayTransition !== undefined) return supportsAutDisplayTransition
  if (typeof window === 'undefined' || !window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false
  }
  const probe = document.createElement('div')
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;'
  document.body.appendChild(probe)
  getComputedStyle(probe).display
  probe.style.display = 'none'
  supportsAutDisplayTransition = getComputedStyle(probe).display === 'block'
  probe.remove()
  return supportsAutDisplayTransition
}

function supportsAutTopLayerExit(): boolean {
  return typeof window !== 'undefined' && Boolean(window.CSS?.supports?.('overlay', 'auto')) && canAutTransitionDisplay()
}
import { 
  calculateAutorizacaoStats, 
  getUserAutorizacaoResposta, 
  getAutorizacaoVoterKey, 
  isAutorizacaoClosed, 
  formatTimeRemaining,
  formatDateTimeBR,
  formatDataEventoBR,
  validarCPF,
  formatarCPF,
  formatAutorizacaoTermoHtml,
  sanitizeAutorizacaoForViewer
} from '@/lib/autorizacoes/autorizacaoUtils'
import { supabase } from '@/lib/supabase'
import { apiFetch } from '@/lib/api/apiClient'
import { useData } from '@/lib/dataContext'
import { isCobrancaPaidStatus } from '@/lib/cobrancasUtils'

interface AutorizacaoWidgetProps {
  autorizacao: AutorizacaoData
  comunicadoId: string
  currentUser?: any
  currentAluno?: any
  turmas?: any[]
  alunos?: any[]
  cobrancas?: any[]
  isAdminMode?: boolean
  isAlunoView?: boolean
  canManagePrazo?: boolean
  onUpdateSuccess?: (updatedAutorizacao: AutorizacaoData) => void
}

export function AutorizacaoWidget({
  autorizacao: initialAutorizacao,
  comunicadoId,
  currentUser,
  currentAluno,
  turmas: turmasProp = [],
  alunos: alunosProp = [],
  cobrancas: cobrancasProp,
  isAdminMode = false,
  isAlunoView = false,
  canManagePrazo = false,
  onUpdateSuccess
}: AutorizacaoWidgetProps) {
  const dataContext = useData() as any
  const contextTurmas: any[] = dataContext?.turmas || []
  const contextAlunos: any[] = dataContext?.alunos || []

  const resolveTurmaNome = useCallback((rawTurma?: string | null, alunoId?: string | null): string => {
    const allTurmas = turmasProp.length > 0 ? [...turmasProp, ...contextTurmas] : contextTurmas
    const allAlunos = alunosProp.length > 0 ? [...alunosProp, ...contextAlunos] : contextAlunos

    let candidate = String(rawTurma || '').trim()
    if ((!candidate || /^\d+$/.test(candidate)) && alunoId) {
      const cleanAid = String(alunoId).trim().replace(/^(a_|_ALU|_)/i, '').trim()
      const foundStudent = allAlunos.find((a: any) => a && String(a.id).trim() === cleanAid)
      if (foundStudent) {
        const stTurma = foundStudent.turma_nome || foundStudent.turmaNome || foundStudent.dados?.turma_nome || foundStudent.turma || foundStudent.dados?.turma
        if (stTurma) candidate = String(stTurma).trim()
      }
    }

    if (!candidate) return ''

    const matchedTurma = allTurmas.find((t: any) =>
      t && (
        String(t.id).trim() === candidate ||
        String(t.codigo || '').trim() === candidate ||
        String(t.dados?.codigo || '').trim() === candidate
      )
    )

    if (matchedTurma) {
      return String(matchedTurma.nome || matchedTurma.dados?.nome || candidate).trim()
    }

    return candidate
  }, [turmasProp, contextTurmas, alunosProp, contextAlunos])

  const [autorizacao, setAutorizacao] = useState<AutorizacaoData>(initialAutorizacao)
  const [selectedOpcaoId, setSelectedOpcaoId] = useState<string>('')
  const [observacoes, setObservacoes] = useState<string>('')
  const [cpfResponsavel, setCpfResponsavel] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isChangingResposta, setIsChangingResposta] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'aprova' | 'recusa' | 'obs'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [prazoDialogMode, setPrazoDialogMode] = useState<'reopen' | 'deadline' | null>(null)
  const [draftDataLimite, setDraftDataLimite] = useState<string>('')
  const [draftSemPrazo, setDraftSemPrazo] = useState<boolean>(false)
  const [prazoError, setPrazoError] = useState<string | null>(null)
  const prazoDialogRef = useRef<HTMLDialogElement>(null)
  const pressedOutsideDialogRef = useRef<boolean>(false)
  const detailsDialogRef = useRef<HTMLDialogElement>(null)
  const pressedOutsideDetailsRef = useRef<boolean>(false)
  const detailsDialogTitleId = useId()
  const prazoDialogTitleId = useId()
  const prazoDateInputId = useId()
  const prazoNoDeadlineId = useId()
  const prazoErrorId = useId()
  const [fetchedCobrancas, setFetchedCobrancas] = useState<any[]>([])
  const [fetchedAlunosDir, setFetchedAlunosDir] = useState<Record<string, any>>({})
  const channelRef = useRef<any>(null)

  const closeDetailsDialog = useCallback(async () => {
    const dialog = detailsDialogRef.current
    if (!dialog || !dialog.open) {
      setShowDetailsModal(false)
      return
    }
    if (!supportsAutTopLayerExit() && typeof dialog.getAnimations === 'function') {
      dialog.setAttribute('data-closing', '')
      const animations = dialog.getAnimations({ subtree: true })
      if (animations.length > 0) {
        await Promise.race([
          Promise.allSettled(animations.map(a => a.finished)),
          new Promise(r => setTimeout(r, 260))
        ])
      }
      if (!dialog.hasAttribute('data-closing')) return
      dialog.removeAttribute('data-closing')
    }
    setShowDetailsModal(false)
  }, [])

  useEffect(() => {
    const dialog = detailsDialogRef.current
    if (!dialog) return
    if (showDetailsModal) {
      dialog.removeAttribute('data-closing')
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal()
        } else {
          dialog.setAttribute('open', '')
        }
      }
    } else if (dialog.open) {
      dialog.removeAttribute('data-closing')
      if (typeof dialog.close === 'function') {
        dialog.close()
      } else {
        dialog.removeAttribute('open')
      }
    }
  }, [showDetailsModal])

  useEffect(() => {
    const dialog = prazoDialogRef.current
    if (!dialog) return
    if (prazoDialogMode) {
      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal()
        } else {
          dialog.setAttribute('open', '')
        }
      }
    } else if (dialog.open) {
      if (typeof dialog.close === 'function') {
        dialog.close()
      } else {
        dialog.removeAttribute('open')
      }
    }
  }, [prazoDialogMode])

  useEffect(() => {
    if (!isAdminMode || !comunicadoId) return
    if (cobrancasProp !== undefined) return
    let active = true
    apiFetch(`/api/cobrancas?comunicado_id=${encodeURIComponent(String(comunicadoId))}`)
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (!active || !json) return
        if (Array.isArray(json.cobrancas)) setFetchedCobrancas(json.cobrancas)
        if (json.alunosDirectory) setFetchedAlunosDir(json.alunosDirectory)
      })
      .catch(() => {})
    return () => { active = false }
  }, [isAdminMode, comunicadoId, cobrancasProp])

  const effectiveCobrancas = useMemo(
    () => (cobrancasProp !== undefined ? cobrancasProp : fetchedCobrancas),
    [cobrancasProp, fetchedCobrancas]
  )

  const hasCobranca = useMemo(
    () => effectiveCobrancas.length > 0 || Boolean(autorizacao.valor && String(autorizacao.valor).trim()),
    [effectiveCobrancas, autorizacao.valor]
  )

  const paymentLookup = useMemo(() => {
    const byId = new Map<string, boolean>()
    const byName = new Map<string, boolean>()
    const cleanId = (v?: string | null) => String(v || '').trim().replace(/^(a_|_ALU|_)/i, '').trim()
    const normName = (v?: string | null) =>
      String(v || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ')

    const allAlunos = alunosProp.length > 0 ? [...alunosProp, ...contextAlunos] : contextAlunos
    const idToNormName = new Map<string, string>()
    allAlunos.forEach((a: any) => {
      if (!a) return
      const cid = cleanId(a.id)
      const nm = normName(a.nome || a.dados?.nome)
      if (cid && nm) idToNormName.set(cid, nm)
    })
    Object.entries(fetchedAlunosDir || {}).forEach(([k, v]: [string, any]) => {
      const cid = cleanId(k)
      const nm = normName(v?.nome)
      if (cid && nm && !idToNormName.has(cid)) idToNormName.set(cid, nm)
    })

    effectiveCobrancas.forEach((cob: any) => {
      const dests = Array.isArray(cob?.agenda_cobrancas_destinatarios) ? cob.agenda_cobrancas_destinatarios : []
      dests.forEach((d: any) => {
        const paid = isCobrancaPaidStatus(d?.status)
        const did = cleanId(d?.destinatario_id || d?.aluno_id)
        if (did) {
          byId.set(did, Boolean(byId.get(did)) || paid)
          const mappedNm = idToNormName.get(did)
          if (mappedNm) byName.set(mappedNm, Boolean(byName.get(mappedNm)) || paid)
        }
        const dnm = normName(d?.destinatario_nome || d?.aluno_nome)
        if (dnm) {
          byName.set(dnm, Boolean(byName.get(dnm)) || paid)
        }
      })
    })

    return { byId, byName, cleanId, normName }
  }, [effectiveCobrancas, alunosProp, contextAlunos, fetchedAlunosDir])

  const getRespostaPaymentStatus = useCallback((r: AutorizacaoResposta): 'paid' | 'pending' | 'none' => {
    if (!hasCobranca) return 'none'
    const cid = paymentLookup.cleanId(r.alunoId)
    if (cid && paymentLookup.byId.has(cid)) {
      return paymentLookup.byId.get(cid) ? 'paid' : 'pending'
    }
    const nm = paymentLookup.normName(r.alunoNome)
    if (nm && paymentLookup.byName.has(nm)) {
      return paymentLookup.byName.get(nm) ? 'paid' : 'pending'
    }
    return 'pending'
  }, [hasCobranca, paymentLookup])

  const currentUserId = currentUser?.id || currentUser?.uid || ''
  const currentAlunoId = currentAluno?.id || null
  const currentAlunoNome = currentAluno?.nome || null
  const rawCurrentAlunoTurma = currentAluno?.turma_nome || currentAluno?.turmaNome || currentAluno?.turma || null
  const currentAlunoTurma = resolveTurmaNome(rawCurrentAlunoTurma, currentAlunoId) || rawCurrentAlunoTurma

  // Sync prop changes safely without overwriting an already-recorded local signature or newer update with a stale snapshot
  useEffect(() => {
    if (initialAutorizacao) {
      setAutorizacao(prev => {
        if (!prev || prev.id !== initialAutorizacao.id) return initialAutorizacao
        const prevTime = prev.atualizadoEm ? new Date(prev.atualizadoEm).getTime() : 0
        const nextTime = initialAutorizacao.atualizadoEm ? new Date(initialAutorizacao.atualizadoEm).getTime() : 0
        if (prevTime > nextTime) return prev
        const ownKey = getAutorizacaoVoterKey(currentUserId, currentAlunoId)
        const ownResp = getUserAutorizacaoResposta(prev, currentUserId, currentAlunoId)
        const incomingResp = getUserAutorizacaoResposta(initialAutorizacao, currentUserId, currentAlunoId)
        if (ownResp && !incomingResp && ownKey) {
          return {
            ...initialAutorizacao,
            respostas: {
              ...(initialAutorizacao.respostas || {}),
              [ownKey]: ownResp
            }
          }
        }
        return initialAutorizacao
      })
    }
  }, [initialAutorizacao, currentUserId, currentAlunoId])

  const stats = useMemo(() => calculateAutorizacaoStats(autorizacao), [autorizacao])
  const isClosed = useMemo(() => isAutorizacaoClosed(autorizacao), [autorizacao])
  const timeRemaining = useMemo(() => formatTimeRemaining(autorizacao.dataLimite), [autorizacao.dataLimite])

  const isStudentViewer = useMemo(() => {
    if (isAdminMode) return false
    if (isAlunoView) return true
    if (typeof window !== 'undefined') {
      try {
        const sp = new URLSearchParams(window.location.search)
        if (sp.get('espelhar_aluno') === 'true') return true
      } catch (_) {}
    }
    if (
      currentUser?.cargo === 'Aluno' ||
      currentUser?.perfil === 'Aluno' ||
      currentUser?.userType === 'aluno' ||
      (currentUser?.aluno_id && currentUser?.cargo !== 'Responsável' && currentUser?.perfil !== 'Responsável' && currentUser?.perfil !== 'Família' && !currentUser?.responsavel_id)
    ) {
      return true
    }
    return false
  }, [isAdminMode, isAlunoView, currentUser])

  const userResposta: AutorizacaoResposta | null = useMemo(() => {
    return getUserAutorizacaoResposta(autorizacao, currentUserId, currentAlunoId)
  }, [autorizacao, currentUserId, currentAlunoId])

  const hasResponded = !!userResposta

  const isCpfRequired = !!(autorizacao.exigirCpfResponsavel ?? autorizacao.exigirDocumentoResponsavel)
  const isCpfValid = useMemo(() => validarCPF(cpfResponsavel), [cpfResponsavel])
  const canSubmit = !isStudentViewer && !isClosed && !!selectedOpcaoId && (!isCpfRequired || isCpfValid)

  // Sync user's previous answer into input fields
  useEffect(() => {
    if (userResposta) {
      setSelectedOpcaoId(userResposta.opcaoId)
      setObservacoes(userResposta.observacoes || '')
      const prevCpf = userResposta.cpfResponsavel || userResposta.documentoResponsavel || ''
      setCpfResponsavel(formatarCPF(prevCpf))
    } else {
      setSelectedOpcaoId('')
      setObservacoes('')
      setCpfResponsavel('')
    }
  }, [userResposta])

  // ==========================================
  // REALTIME SYNCHRONIZATION VIA SUPABASE
  // ==========================================
  useEffect(() => {
    if (!autorizacao?.id) return

    const channelName = `autorizacao_live_${autorizacao.id}`
    const channel = supabase.channel(channelName)
    channelRef.current = channel

    const applyRemoteAutorizacao = (incoming: AutorizacaoData) => {
      setAutorizacao(prev => {
        const ownKey = getAutorizacaoVoterKey(currentUserId, currentAlunoId)
        const ownResp = getUserAutorizacaoResposta(prev, currentUserId, currentAlunoId)
        const incomingHasResp = !!getUserAutorizacaoResposta(incoming, currentUserId, currentAlunoId)
        const mergedRespostas = { ...(incoming.respostas || {}) }
        if (ownResp && ownKey && !mergedRespostas[ownKey] && !incomingHasResp) {
          mergedRespostas[ownKey] = ownResp
        }
        return { ...incoming, respostas: mergedRespostas }
      })
    }

    channel
      .on('broadcast', { event: 'resposta_update' }, (payload: any) => {
        if (payload?.payload?.autorizacao) {
          applyRemoteAutorizacao(payload.payload.autorizacao)
        }
      })
      .on('broadcast', { event: 'status_update' }, (payload: any) => {
        if (payload?.payload?.autorizacao) {
          applyRemoteAutorizacao(payload.payload.autorizacao)
        }
      })
      .subscribe()

    const handleComunicadosUpdate = (event: any) => {
      if (event?.detail?.source === 'autorizacao-widget') return
      const item = event?.detail?.item || event?.detail?.new
      if (item && String(item.id) === String(comunicadoId)) {
        const remoteAut = item.dados?.autorizacao || item.autorizacao
        if (remoteAut) {
          applyRemoteAutorizacao(remoteAut)
        }
      }
    }
    window.addEventListener('ad:comunicados-update', handleComunicadosUpdate)

    return () => {
      channelRef.current = null
      try { supabase.removeChannel(channel) } catch (_) {}
      window.removeEventListener('ad:comunicados-update', handleComunicadosUpdate)
    }
  }, [autorizacao?.id, comunicadoId, currentUserId, currentAlunoId])

  const broadcastUpdate = useCallback(async (updated: AutorizacaoData, eventName = 'resposta_update') => {
    try {
      const safeAutorizacao = sanitizeAutorizacaoForViewer(updated, []) || updated
      const activeChannel = channelRef.current
      if (activeChannel) {
        await activeChannel.send({
          type: 'broadcast',
          event: eventName,
          payload: { autorizacao: safeAutorizacao, comunicadoId }
        })
      }
    } catch (_) {}
  }, [comunicadoId])

  // Handle Response Submission (Sign)
  const handleSubmitResposta = async () => {
    if (isStudentViewer) return
    if (!selectedOpcaoId) {
      setFeedbackMessage({ type: 'error', text: 'Por favor, selecione uma opção de autorização.' })
      return
    }

    if (isCpfRequired) {
      if (!cpfResponsavel.trim()) {
        setFeedbackMessage({ type: 'error', text: 'Por favor, informe seu CPF para confirmação da assinatura digital.' })
        return
      }
      if (!validarCPF(cpfResponsavel)) {
        setFeedbackMessage({ type: 'error', text: 'O CPF informado é inválido. Verifique os 11 dígitos e o cálculo verificador.' })
        return
      }
    }

    setIsSubmitting(true)
    setFeedbackMessage(null)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const payload = {
        comunicadoId,
        autorizacaoId: autorizacao.id,
        opcaoId: selectedOpcaoId,
        usuarioId: currentUserId,
        usuarioNome: currentUser?.nome || 'Responsável',
        usuarioFoto: currentUser?.foto || null,
        usuarioTipo: currentUser?.perfil === 'Família' || currentUser?.perfil === 'Responsável' ? 'responsavel' : 'responsavel',
        alunoId: currentAlunoId,
        alunoNome: currentAlunoNome,
        alunoTurma: currentAlunoTurma,
        observacoes: observacoes.trim() || undefined,
        cpfResponsavel: cpfResponsavel.trim() ? formatarCPF(cpfResponsavel) : undefined,
        documentoResponsavel: cpfResponsavel.trim() ? formatarCPF(cpfResponsavel) : undefined
      }

      const res = await apiFetch('/api/agenda/autorizacoes/responder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar autorização')
      }

      if (data.autorizacao) {
        let nextAutorizacao: AutorizacaoData = data.autorizacao
        if (data.userResposta && !getUserAutorizacaoResposta(nextAutorizacao, currentUserId, currentAlunoId)) {
          const localVoterKey = getAutorizacaoVoterKey(currentUserId, currentAlunoId) || data.userResposta.usuarioId || 'own'
          nextAutorizacao = {
            ...nextAutorizacao,
            respostas: {
              ...(nextAutorizacao.respostas || {}),
              [localVoterKey]: data.userResposta
            }
          }
        }
        setAutorizacao(nextAutorizacao)
        setIsChangingResposta(false)
        setFeedbackMessage({ type: 'success', text: 'Autorização assinada e registrada com sucesso!' })
        if (onUpdateSuccess) onUpdateSuccess(nextAutorizacao)
        broadcastUpdate(nextAutorizacao, 'resposta_update')

        setTimeout(() => setFeedbackMessage(null), 4000)
      }
    } catch (err: any) {
      const msg = err?.name === 'AbortError'
        ? 'A conexão demorou mais que o esperado. Verifique sua internet e tente novamente.'
        : (err?.message || 'Erro ao registrar autorização. Tente novamente.')
      setFeedbackMessage({ type: 'error', text: msg })
    } finally {
      clearTimeout(timeoutId)
      setIsSubmitting(false)
    }
  }

  const getLocalYmd = useCallback((daysOffset = 0): string => {
    const d = new Date()
    d.setDate(d.getDate() + daysOffset)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }, [])

  const todayYmd = getLocalYmd(0)

  const updateAutorizacaoStatus = async (
    payload: { encerrada: boolean; dataLimite?: string | null },
    successText?: string
  ): Promise<boolean> => {
    if (!canManagePrazo) return false
    setIsUpdatingStatus(true)
    setPrazoError(null)

    try {
      const res = await apiFetch('/api/agenda/autorizacoes/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comunicadoId,
          ...payload
        })
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok || !data.autorizacao) {
        const errMsg = data?.error || 'Não foi possível atualizar a autorização.'
        setPrazoError(errMsg)
        if (!prazoDialogMode) {
          setFeedbackMessage({ type: 'error', text: errMsg })
          setTimeout(() => setFeedbackMessage(null), 5000)
        }
        return false
      }

      setAutorizacao(data.autorizacao)
      if (onUpdateSuccess) onUpdateSuccess(data.autorizacao)
      broadcastUpdate(data.autorizacao, 'status_update')
      if (successText) {
        setFeedbackMessage({ type: 'success', text: successText })
        setTimeout(() => setFeedbackMessage(null), 4000)
      }
      return true
    } catch (err: any) {
      const errMsg = err?.message || 'Erro ao atualizar status da autorização.'
      setPrazoError(errMsg)
      if (!prazoDialogMode) {
        setFeedbackMessage({ type: 'error', text: errMsg })
        setTimeout(() => setFeedbackMessage(null), 5000)
      }
      return false
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const openPrazoDialog = (mode: 'reopen' | 'deadline') => {
    if (!canManagePrazo) return
    const today = getLocalYmd(0)
    const existingYmd = autorizacao.dataLimite ? String(autorizacao.dataLimite).trim().slice(0, 10) : ''
    const hasValidFutureOrToday = /^\d{4}-\d{2}-\d{2}$/.test(existingYmd) && existingYmd >= today

    setDraftDataLimite(hasValidFutureOrToday ? existingYmd : '')
    setDraftSemPrazo(mode === 'deadline' && !autorizacao.dataLimite)
    setPrazoError(null)
    setPrazoDialogMode(mode)
  }

  const handleCloseAutorizacao = async () => {
    await updateAutorizacaoStatus(
      { encerrada: true },
      'Prazo da autorização encerrado.'
    )
  }

  const handleConfirmPrazoDialog = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canManagePrazo || isUpdatingStatus) return
    const today = getLocalYmd(0)

    if (!draftSemPrazo) {
      const trimmed = draftDataLimite.trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || trimmed < today) {
        setPrazoError('Informe uma data de prazo válida (hoje ou futura) ou selecione a opção sem prazo limite.')
        return
      }
    }

    const ok = await updateAutorizacaoStatus(
      {
        encerrada: false,
        dataLimite: draftSemPrazo ? null : draftDataLimite.trim()
      },
      prazoDialogMode === 'reopen'
        ? (draftSemPrazo ? 'Autorização reaberta sem prazo limite!' : 'Autorização reaberta e novo prazo definido com sucesso!')
        : (draftSemPrazo ? 'Prazo limite removido!' : 'Data do prazo atualizada com sucesso!')
    )

    if (ok) {
      setPrazoDialogMode(null)
    }
  }

  // Filtered responses list for Admin Detailed Modal
  const filteredRespostas = useMemo(() => {
    let list = stats.respostasList

    if (selectedFilter === 'aprova') {
      list = list.filter(r => r.tipoDecisao === 'aprova')
    } else if (selectedFilter === 'recusa') {
      list = list.filter(r => r.tipoDecisao === 'recusa')
    } else if (selectedFilter === 'obs') {
      list = list.filter(r => r.observacoes && r.observacoes.trim().length > 0)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter(r => {
        const displayTurma = resolveTurmaNome(r.alunoTurma, r.alunoId)
        return (
          (r.alunoNome && r.alunoNome.toLowerCase().includes(q)) ||
          (r.usuarioNome && r.usuarioNome.toLowerCase().includes(q)) ||
          (displayTurma && displayTurma.toLowerCase().includes(q)) ||
          (r.alunoTurma && r.alunoTurma.toLowerCase().includes(q)) ||
          (r.observacoes && r.observacoes.toLowerCase().includes(q))
        )
      })
    }

    return list
  }, [stats.respostasList, selectedFilter, searchQuery, resolveTurmaNome])

  // Print summary sheet for excursion bus
  const handlePrintSummary = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const escapeHtml = (val?: string | null) =>
      String(val || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')

    const totalPagosAut = hasCobranca
      ? stats.respostasList.filter(r => getRespostaPaymentStatus(r) === 'paid').length
      : 0
    const percentPagosAut =
      hasCobranca && stats.totalRespostas > 0
        ? ((totalPagosAut / stats.totalRespostas) * 100).toFixed(1)
        : '0.0'

    const colgroupHtml = hasCobranca
      ? `
        <colgroup>
          <col style="width: 3.5%;" />
          <col style="width: 21.5%;" />
          <col style="width: 11%;" />
          <col style="width: 9.5%;" />
          <col style="width: 9.5%;" />
          <col style="width: 19%;" />
          <col style="width: 11%;" />
          <col style="width: 15%;" />
        </colgroup>
      `
      : `
        <colgroup>
          <col style="width: 3.5%;" />
          <col style="width: 23.5%;" />
          <col style="width: 12%;" />
          <col style="width: 10.5%;" />
          <col style="width: 21.5%;" />
          <col style="width: 12%;" />
          <col style="width: 17%;" />
        </colgroup>
      `

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8" />
        <title>Lista de Autorizações - ${escapeHtml(autorizacao.titulo)}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 16px;
            margin: 0;
            color: #1e293b;
            background: #ffffff;
          }
          @media print {
            body {
              padding: 0;
              margin: 0;
            }
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            gap: 12px;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 8px;
            margin-bottom: 10px;
          }
          h1 {
            font-size: 16px;
            margin: 0 0 3px 0;
            color: #0f172a;
          }
          .subtitle {
            margin: 0;
            font-size: 11px;
            color: #475569;
          }
          .generated {
            font-size: 10px;
            color: #64748b;
            text-align: right;
            white-space: nowrap;
          }
          .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 8px;
            margin-bottom: 12px;
          }
          .metric-card {
            border: 1px solid #e2e8f0;
            background: #f8fafc;
            padding: 7px 10px;
            border-radius: 8px;
            font-size: 10.5px;
            font-weight: 700;
          }
          .metric-value {
            font-size: 16px;
            font-weight: 800;
            margin-top: 2px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 10.5px;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
          }
          th, td {
            border: 1px solid #cbd5e1;
            padding: 5px 7px;
            text-align: left;
            vertical-align: middle;
            overflow-wrap: anywhere;
            word-break: break-word;
          }
          th {
            background: #f1f5f9;
            font-weight: 800;
            font-size: 9.5px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
            color: #334155;
          }
          tbody tr:nth-child(even) td {
            background: #f8fafc;
          }
          .col-center {
            text-align: center;
          }
          .badge {
            display: inline-block;
            padding: 2px 7px;
            border-radius: 999px;
            font-size: 9.5px;
            font-weight: 800;
            white-space: nowrap;
          }
          .badge-aprova {
            color: #166534;
            background: #dcfce7;
          }
          .badge-recusa {
            color: #991b1b;
            background: #fee2e2;
          }
          .badge-pago {
            color: #065f46;
            background: #d1fae5;
          }
          .badge-pendente {
            color: #92400e;
            background: #fef3c7;
          }
          .obs-box {
            background: #fef3c7;
            border-left: 3px solid #f59e0b;
            padding: 2px 6px;
            font-size: 10px;
            color: #92400e;
            font-weight: 700;
            border-radius: 3px;
          }
          .muted {
            color: #94a3b8;
            font-size: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>Colégio Impacto — Lista de Autorizações</h1>
            <p class="subtitle">
              <strong>Atividade:</strong> ${escapeHtml(autorizacao.titulo)}
              ${autorizacao.localEvento ? ` | <strong>Local:</strong> ${escapeHtml(autorizacao.localEvento)}` : ''}
              ${autorizacao.dataEvento ? ` | <strong>Data:</strong> ${escapeHtml(formatDataEventoBR(autorizacao.dataEvento))}` : ''}
            </p>
          </div>
          <div class="generated">
            Gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}<br/>
            Conferência pedagógica
          </div>
        </div>
        
        <div class="metrics">
          <div class="metric-card">Total Respondidos: <div class="metric-value">${stats.totalRespostas}</div></div>
          <div class="metric-card" style="color: #166534; background: #f0fdf4; border-color: #bbf7d0;">Autorizados (Sim): <div class="metric-value">${stats.totalAprovados} (${stats.percentAprovados}%)</div></div>
          <div class="metric-card" style="color: #991b1b; background: #fef2f2; border-color: #fecaca;">Não Autorizados: <div class="metric-value">${stats.totalRecusados} (${stats.percentRecusados}%)</div></div>
          ${hasCobranca ? `<div class="metric-card" style="color: #047857; background: #ecfdf5; border-color: #a7f3d0;">Pagos: <div class="metric-value">${totalPagosAut} (${percentPagosAut}%)</div></div>` : ''}
          <div class="metric-card" style="color: #b45309; background: #fffbeb; border-color: #fde68a;">Com Alergias/Obs: <div class="metric-value">${stats.respostasComObservacoes.length}</div></div>
        </div>

        <table>
          ${colgroupHtml}
          <thead>
            <tr>
              <th class="col-center">#</th>
              <th>Aluno</th>
              <th>Turma</th>
              <th class="col-center">Decisão</th>
              ${hasCobranca ? '<th class="col-center">Pagamento</th>' : ''}
              <th>Responsável Assinante</th>
              <th>Data/Hora</th>
              <th>Observações Médicas / Restrições</th>
            </tr>
          </thead>
          <tbody>
            ${stats.respostasList.map((r, i) => {
              const payStatus = getRespostaPaymentStatus(r)
              const cpfDoc = r.cpfResponsavel || r.documentoResponsavel
              return `
              <tr>
                <td class="col-center">${i + 1}</td>
                <td><strong>${escapeHtml(r.alunoNome || 'Não informado')}</strong></td>
                <td style="font-size: 10px;">${escapeHtml(resolveTurmaNome(r.alunoTurma, r.alunoId) || '-')}</td>
                <td class="col-center">
                  <span class="badge ${r.tipoDecisao === 'aprova' ? 'badge-aprova' : r.tipoDecisao === 'recusa' ? 'badge-recusa' : ''}">
                    ${escapeHtml(r.opcaoTexto)}
                  </span>
                </td>
                ${hasCobranca ? `
                  <td class="col-center">
                    <span class="badge ${payStatus === 'paid' ? 'badge-pago' : 'badge-pendente'}">
                      ${payStatus === 'paid' ? 'Pago' : 'Não pago'}
                    </span>
                  </td>
                ` : ''}
                <td>${escapeHtml(r.usuarioNome)}${cpfDoc ? `<br/><small style="color:#64748b;">CPF: ${escapeHtml(cpfDoc)}</small>` : ''}</td>
                <td style="font-size: 10px;">${escapeHtml(formatDateTimeBR(r.respondidoEm))}</td>
                <td>
                  ${r.observacoes ? `<div class="obs-box">⚠️ ${escapeHtml(r.observacoes)}</div>` : '<span class="muted">Nenhuma</span>'}
                </td>
              </tr>
              `
            }).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `
    printWindow.document.write(htmlContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 400)
  }

  const selectedOpcaoObj = (autorizacao.opcoes || []).find(o => o.id === (userResposta?.opcaoId || selectedOpcaoId))

  return (
    <div style={{
      width: '100%',
      boxSizing: 'border-box',
      background: '#FFFFFF',
      borderRadius: '20px',
      border: '1.5px solid rgba(16, 185, 129, 0.3)',
      boxShadow: '0 8px 30px -4px rgba(16, 185, 129, 0.08), 0 2px 6px rgba(0, 0, 0, 0.02)',
      overflow: 'hidden',
      transition: 'all 0.2s',
      position: 'relative'
    }}>
      {/* GLOW DECORATIVO TOPO */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
        background: 'linear-gradient(90deg, #10B981 0%, #059669 50%, #06B6D4 100%)'
      }} />

      {/* HEADER DO WIDGET */}
      <div style={{
        padding: '18px 20px 14px',
        borderBottom: '1px solid #F1F5F9',
        background: 'linear-gradient(180deg, rgba(240, 253, 244, 0.6) 0%, rgba(255, 255, 255, 0.95) 100%)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
            }}>
              <FileCheck2 size={20} strokeWidth={2.4} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  background: hasResponded 
                    ? userResposta?.tipoDecisao === 'aprova' ? 'rgba(16, 185, 129, 0.15)' : userResposta?.tipoDecisao === 'recusa' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)'
                    : isStudentViewer
                      ? isClosed ? 'rgba(100, 116, 139, 0.15)' : 'rgba(245, 158, 11, 0.15)'
                      : 'rgba(16, 185, 129, 0.12)',
                  color: hasResponded 
                    ? userResposta?.tipoDecisao === 'aprova' ? '#047857' : userResposta?.tipoDecisao === 'recusa' ? '#B91C1C' : '#4338CA'
                    : isStudentViewer
                      ? isClosed ? '#475569' : '#B45309'
                      : '#047857',
                  padding: '2px 8px',
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <ShieldCheck size={11} />
                  {hasResponded 
                    ? userResposta?.tipoDecisao === 'aprova' ? 'Autorizado' : userResposta?.tipoDecisao === 'recusa' ? 'Não Autorizado' : 'Respondido'
                    : isStudentViewer
                      ? isClosed ? 'Sem Resposta' : 'Aguardando Responsável'
                      : 'Autorização Requerida'}
                </span>

                {isClosed && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: '#F1F5F9',
                    color: '#64748B',
                    padding: '2px 8px',
                    borderRadius: 999,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3
                  }}>
                    <Lock size={10} /> Encerrada
                  </span>
                )}
              </div>

              <h4 style={{
                fontSize: 16,
                fontWeight: 800,
                color: '#0F172A',
                margin: '3px 0 0 0',
                letterSpacing: '-0.02em'
              }}>
                {autorizacao.titulo}
              </h4>
            </div>
          </div>

          {/* PRAZO RESTANTE / ACTIONS */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {timeRemaining && !isClosed && (
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#D97706',
                background: 'rgba(245, 158, 11, 0.1)',
                padding: '4px 10px',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}>
                <Clock size={12} />
                <span>{timeRemaining}</span>
              </div>
            )}

            {canManagePrazo && (
              isClosed ? (
                <button
                  type="button"
                  onClick={() => openPrazoDialog('reopen')}
                  disabled={isUpdatingStatus}
                  style={{
                    background: '#F0FDF4',
                    border: '1px solid #86EFAC',
                    color: '#15803D',
                    borderRadius: 10,
                    padding: '6px 12px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: isUpdatingStatus ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5
                  }}
                >
                  <Unlock size={13} />
                  <span>Reabrir e Definir Prazo</span>
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => openPrazoDialog('deadline')}
                    disabled={isUpdatingStatus}
                    style={{
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      color: '#334155',
                      borderRadius: 10,
                      padding: '5px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: isUpdatingStatus ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5
                    }}
                  >
                    <Calendar size={12} />
                    <span>{autorizacao.dataLimite ? 'Alterar Prazo' : 'Definir Prazo'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseAutorizacao}
                    disabled={isUpdatingStatus}
                    style={{
                      background: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      color: '#DC2626',
                      borderRadius: 10,
                      padding: '5px 10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: isUpdatingStatus ? 'wait' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5
                    }}
                  >
                    <Lock size={12} />
                    <span>Encerrar Prazo</span>
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        {/* PILLS DE EVENTO (LOCAL, DATA, VALOR, PRAZO) */}
        {(autorizacao.localEvento || autorizacao.dataEvento || autorizacao.valor || autorizacao.dataLimite) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {autorizacao.localEvento && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '3px 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <MapPin size={12} color="#059669" /> {autorizacao.localEvento}
              </span>
            )}
            {autorizacao.dataEvento && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '3px 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Calendar size={12} color="#059669" /> {formatDataEventoBR(autorizacao.dataEvento)}
              </span>
            )}
            {autorizacao.valor && (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#065F46', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 10px', borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <DollarSign size={12} color="#059669" /> {autorizacao.valor}
              </span>
            )}
            {autorizacao.dataLimite && (
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: isClosed ? '#B91C1C' : '#92400E',
                background: isClosed ? '#FEF2F2' : '#FFFBEB',
                border: `1px solid ${isClosed ? '#FECACA' : '#FDE68A'}`,
                padding: '3px 10px',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}>
                <Clock size={12} color={isClosed ? '#DC2626' : '#D97706'} />
                {isClosed ? 'Prazo encerrado:' : 'Prazo:'} {formatDataEventoBR(String(autorizacao.dataLimite).slice(0, 10))}
              </span>
            )}
          </div>
        )}
      </div>

      {/* BODY DO WIDGET */}
      <div style={{ padding: '18px 20px' }}>
        <style>{`
          .autorizacao-prazo-dialog {
            border: 1px solid #E2E8F0;
            border-radius: 22px;
            padding: 0;
            width: min(460px, calc(100vw - 32px));
            max-width: 100%;
            background: #FFFFFF;
            box-shadow: 0 25px 50px -12px rgba(15, 23, 42, 0.28);
            margin: auto;
            color: #0F172A;
          }
          .autorizacao-prazo-dialog:modal {
            overscroll-behavior: contain;
          }
          .autorizacao-prazo-dialog::backdrop {
            background: rgba(15, 23, 42, 0.65);
            backdrop-filter: blur(4px);
            overflow: hidden;
            overscroll-behavior: contain;
          }
          .autorizacao-prazo-dialog button:focus-visible,
          .autorizacao-prazo-dialog input:focus-visible {
            outline: 2px solid #10B981;
            outline-offset: 2px;
          }
          .autorizacao-termo-content {
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 13px;
            line-height: 1.6;
            color: #334155;
          }
          .autorizacao-termo-content div:empty::before {
            content: '\\200b';
          }
          .autorizacao-termo-content b, .autorizacao-termo-content strong {
            font-weight: 700;
          }
          .autorizacao-termo-content i, .autorizacao-termo-content em {
            font-style: italic;
          }
          .autorizacao-termo-content u {
            text-decoration: underline;
          }
          .autorizacao-termo-content ul {
            list-style-type: disc;
            padding-left: 20px;
            margin: 6px 0;
          }
          .autorizacao-termo-content ol {
            list-style-type: decimal;
            padding-left: 20px;
            margin: 6px 0;
          }
          .autorizacao-termo-content li {
            margin: 2px 0;
          }
          .autorizacao-termo-content p {
            margin: 0 0 8px 0;
          }
          .autorizacao-termo-content p:last-child {
            margin-bottom: 0;
          }
          .autorizacao-termo-content [align="left"], .autorizacao-termo-content [style*="text-align: left"] {
            text-align: left;
          }
          .autorizacao-termo-content [align="center"], .autorizacao-termo-content [style*="text-align: center"] {
            text-align: center;
          }
          .autorizacao-termo-content [align="right"], .autorizacao-termo-content [style*="text-align: right"] {
            text-align: right;
          }
          .autorizacao-termo-content [align="justify"], .autorizacao-termo-content [style*="text-align: justify"] {
            text-align: justify;
            text-justify: inter-word;
          }
        `}</style>
        {/* TERMO JURÍDICO FORMATADO */}
        <div style={{
          background: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: 14,
          padding: '14px 16px',
          fontSize: 13,
          lineHeight: 1.6,
          color: '#334155',
          marginBottom: 16,
          position: 'relative'
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#64748B', marginBottom: 6 }}>
            Termo de Consentimento
          </div>
          <div
            className="autorizacao-termo-content"
            dangerouslySetInnerHTML={{ __html: formatAutorizacaoTermoHtml(autorizacao.termoTexto) }}
          />
        </div>

        {/* FEEDBACK MSG */}
        {feedbackMessage && (
          <div style={{
            background: feedbackMessage.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${feedbackMessage.type === 'success' ? '#86EFAC' : '#FCA5A5'}`,
            borderRadius: 12,
            padding: '10px 14px',
            fontSize: 13,
            fontWeight: 600,
            color: feedbackMessage.type === 'success' ? '#15803D' : '#B91C1C',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            {feedbackMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* VISÃO DO RESPONSÁVEL / ALUNO */}
        {(!isAdminMode || isChangingResposta) ? (
          <div>
            {/* SE JÁ RESPONDEU E NÃO ESTÁ EM MODO DE EDIÇÃO (OU SE FOR ALUNO VISUALIZANDO RESULTADO) */}
            {hasResponded && (!isChangingResposta || isStudentViewer) ? (
              <div style={{
                background: userResposta?.tipoDecisao === 'aprova' ? '#F0FDF4' : '#FEF2F2',
                border: `1.5px solid ${userResposta?.tipoDecisao === 'aprova' ? '#86EFAC' : '#FCA5A5'}`,
                borderRadius: 16,
                padding: '16px',
                position: 'relative'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      background: userResposta?.tipoDecisao === 'aprova' ? '#10B981' : '#EF4444',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      flexShrink: 0
                    }}>
                      {userResposta?.tipoDecisao === 'aprova' ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                    </div>

                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: userResposta?.tipoDecisao === 'aprova' ? '#166534' : '#991B1B', textTransform: 'uppercase' }}>
                        Resultado da Autorização — {userResposta?.tipoDecisao === 'aprova' ? 'Participação Autorizada' : userResposta?.tipoDecisao === 'recusa' ? 'Participação Não Autorizada' : 'Resposta Registrada'}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: userResposta?.tipoDecisao === 'aprova' ? '#065F46' : '#991B1B' }}>
                        {userResposta?.opcaoTexto}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                        Assinado por <strong>{userResposta?.usuarioNome}</strong> em {formatDateTimeBR(userResposta?.respondidoEm)}
                      </div>
                    </div>
                  </div>

                  {!isStudentViewer && autorizacao.permitirAlterarResposta && !isClosed && (
                    <button
                      type="button"
                      onClick={() => setIsChangingResposta(true)}
                      style={{
                        padding: '6px 12px',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      Alterar Resposta
                    </button>
                  )}
                </div>

                {/* CERTIFICADO DIGITAL */}
                <div style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.85)',
                  borderRadius: 12,
                  border: '1px solid rgba(226, 232, 240, 0.8)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#64748B' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, color: '#0F172A' }}>
                      <ShieldCheck size={13} color="#059669" /> Assinatura Digital Verificada
                    </span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#059669' }}>
                      {userResposta?.assinaturaDigital?.token || 'IMP-AUT-OK'}
                    </span>
                  </div>

                  {(userResposta?.cpfResponsavel || userResposta?.documentoResponsavel) && (
                    <div style={{ fontSize: 11, color: '#475569' }}>
                      CPF do Responsável: <strong>{userResposta.cpfResponsavel || userResposta.documentoResponsavel}</strong>
                    </div>
                  )}

                  {userResposta?.observacoes && (
                    <div style={{
                      marginTop: 4,
                      padding: '8px 10px',
                      background: '#FFFBEB',
                      borderLeft: '3px solid #F59E0B',
                      borderRadius: 6,
                      fontSize: 12,
                      color: '#92400E',
                      fontWeight: 600
                    }}>
                      🩺 <strong>Observações / Alergias:</strong> {userResposta.observacoes}
                    </div>
                  )}
                </div>
              </div>
            ) : isStudentViewer ? (
              /* VISÃO DO ALUNO QUANDO AINDA NÃO HÁ RESPOSTA DO RESPONSÁVEL (SOMENTE RESULTADO, SEM OPÇÃO DE RESPONDER) */
              <div style={{
                background: isClosed ? '#F8FAFC' : '#FFFBEB',
                border: `1.5px solid ${isClosed ? '#E2E8F0' : '#FDE68A'}`,
                borderRadius: 16,
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: '50%',
                  background: isClosed ? '#E2E8F0' : 'rgba(245, 158, 11, 0.16)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isClosed ? '#64748B' : '#D97706',
                  flexShrink: 0
                }}>
                  {isClosed ? <Lock size={20} /> : <Clock size={20} />}
                </div>
                <div>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: isClosed ? '#475569' : '#B45309',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}>
                    Resultado da Autorização
                  </div>
                  <div style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: isClosed ? '#1E293B' : '#92400E',
                    marginTop: 2
                  }}>
                    {isClosed ? 'Autorização encerrada sem resposta registrada' : 'Aguardando resposta do responsável'}
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: isClosed ? '#64748B' : '#B45309',
                    marginTop: 2
                  }}>
                    {isClosed
                      ? 'O prazo desta autorização foi encerrado sem assinatura do responsável.'
                      : 'Apenas os responsáveis podem responder e assinar digitalmente esta autorização.'}
                  </div>
                </div>
              </div>
            ) : (
              /* FORMULÁRIO DE SELEÇÃO E ASSINATURA (EXCLUSIVO PARA RESPONSÁVEIS) */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>
                  Selecione sua resposta:
                </label>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(autorizacao.opcoes || []).map(op => {
                    const isSelected = selectedOpcaoId === op.id
                    const isAprova = op.tipo === 'aprova'
                    const isRecusa = op.tipo === 'recusa'

                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setSelectedOpcaoId(op.id)}
                        disabled={isClosed}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 16px',
                          borderRadius: 14,
                          border: isSelected
                            ? `2px solid ${isAprova ? '#10B981' : isRecusa ? '#EF4444' : '#6366F1'}`
                            : '1.5px solid #E2E8F0',
                          background: isSelected
                            ? isAprova ? '#F0FDF4' : isRecusa ? '#FEF2F2' : '#F5F3FF'
                            : '#FFFFFF',
                          cursor: isClosed ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: isSelected ? '0 4px 14px rgba(0,0,0,0.06)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 18 }}>{op.emoji || (isAprova ? '✅' : '❌')}</span>
                          <span style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: isSelected
                              ? isAprova ? '#15803D' : isRecusa ? '#B91C1C' : '#4F46E5'
                              : '#1E293B'
                          }}>
                            {op.texto}
                          </span>
                        </div>

                        <div style={{
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          border: `2px solid ${isSelected ? (isAprova ? '#10B981' : isRecusa ? '#EF4444' : '#6366F1') : '#CBD5E1'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isSelected && (
                            <div style={{
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              background: isAprova ? '#10B981' : isRecusa ? '#EF4444' : '#6366F1'
                            }} />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* OBSERVAÇÕES MÉDICAS SE REQUERIDO */}
                {autorizacao.exigirObservacoes && (
                  <div style={{ marginTop: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <HeartPulse size={15} color="#EF4444" />
                      <span>{autorizacao.observacoesLabel || 'Alergias, restrições alimentares ou recomendações médicas'}</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Alérgico a corantes; necessita de medicação caso ocorra..."
                      value={observacoes}
                      onChange={e => setObservacoes(e.target.value)}
                      disabled={isClosed}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: '1.5px solid #E2E8F0',
                        fontSize: 13,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}

                {/* CPF SE REQUERIDO */}
                {isCpfRequired && (
                  <div style={{ marginTop: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShieldCheck size={15} color="#059669" />
                        <span>CPF do Responsável (Assinatura Digital) <span style={{ color: '#EF4444' }}>*</span></span>
                      </label>
                      {cpfResponsavel.length > 0 && (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: isCpfValid ? '#15803D' : '#DC2626',
                          background: isCpfValid ? '#DCFCE7' : '#FEE2E2',
                          padding: '2px 8px',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          {isCpfValid ? '✓ CPF Válido' : '✕ CPF Inválido'}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      maxLength={14}
                      value={cpfResponsavel}
                      onChange={e => setCpfResponsavel(formatarCPF(e.target.value))}
                      disabled={isClosed}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 12,
                        border: `1.5px solid ${cpfResponsavel.length > 0 ? (isCpfValid ? '#10B981' : '#FCA5A5') : '#E2E8F0'}`,
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#0F172A',
                        boxSizing: 'border-box',
                        outline: 'none',
                        letterSpacing: '0.04em'
                      }}
                    />
                    {cpfResponsavel.length > 0 && !isCpfValid && (
                      <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                        Insira os 11 dígitos e o cálculo verificador correto do CPF para conseguir assinar.
                      </p>
                    )}
                  </div>
                )}

                {/* BOTÕES DE ENVIO */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {isChangingResposta && (
                      <button
                        type="button"
                        onClick={() => setIsChangingResposta(false)}
                        style={{
                          padding: '12px 18px',
                          background: '#FFFFFF',
                          border: '1px solid #CBD5E1',
                          borderRadius: 14,
                          fontSize: 13,
                          fontWeight: 700,
                          color: '#475569',
                          cursor: 'pointer'
                        }}
                      >
                        Cancelar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleSubmitResposta}
                      disabled={isSubmitting || !canSubmit}
                      style={{
                        flex: 1,
                        padding: '14px',
                        borderRadius: 14,
                        background: !canSubmit
                          ? '#E2E8F0'
                          : selectedOpcaoObj?.tipo === 'recusa'
                            ? 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)'
                            : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        color: !canSubmit ? '#94A3B8' : '#FFFFFF',
                        border: 'none',
                        fontSize: 14,
                        fontWeight: 800,
                        cursor: !canSubmit ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: !canSubmit ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.25)',
                        transition: 'all 0.2s'
                      }}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>Registrando assinatura...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={18} />
                          <span>Confirmar e Assinar Digitalmente</span>
                        </>
                      )}
                    </button>
                  </div>

                  {isCpfRequired && !isCpfValid && selectedOpcaoId && (
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                        ⚠️ Preencha um CPF válido com os 11 dígitos para conseguir assinar
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* VISÃO GESTÃO / PROFESSOR / ADMIN */}
        {isAdminMode && (
          <div style={{ marginTop: hasResponded ? 20 : 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Painel de Apuração e Controle de Saída</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#059669' }}>
                {stats.totalRespostas} confirmações recebidas
              </span>
            </div>

            {/* METRICS CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 14 }}>
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B' }}>TOTAL RESPOSTAS</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginTop: 2 }}>{stats.totalRespostas}</div>
              </div>

              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#166534' }}>AUTORIZADOS ✅</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#15803D', marginTop: 2 }}>
                  {stats.totalAprovados} <span style={{ fontSize: 12, fontWeight: 600 }}>({stats.percentAprovados}%)</span>
                </div>
              </div>

              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#991B1B' }}>NÃO AUTORIZADOS ❌</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#B91C1C', marginTop: 2 }}>
                  {stats.totalRecusados} <span style={{ fontSize: 12, fontWeight: 600 }}>({stats.percentRecusados}%)</span>
                </div>
              </div>

              {autorizacao.exigirObservacoes && (
                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 12, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E' }}>COM ALERGIAS / OBS ⚠️</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#B45309', marginTop: 2 }}>
                    {stats.respostasComObservacoes.length}
                  </div>
                </div>
              )}
            </div>

            {/* PROGRESS BAR DIVIDIDA */}
            {stats.totalRespostas > 0 && (
              <div style={{ width: '100%', height: 10, background: '#E2E8F0', borderRadius: 999, overflow: 'hidden', display: 'flex', marginBottom: 16 }}>
                <div style={{ width: `${stats.percentAprovados}%`, background: '#10B981', transition: 'width 0.5s ease' }} title={`Autorizados: ${stats.percentAprovados}%`} />
                <div style={{ width: `${stats.percentRecusados}%`, background: '#EF4444', transition: 'width 0.5s ease' }} title={`Não autorizados: ${stats.percentRecusados}%`} />
              </div>
            )}

            {/* BOTÕES DE AÇÃO DO ADMIN */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setShowDetailsModal(true)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
                }}
              >
                <Users size={16} />
                <span>Ver Lista Completa ({stats.totalRespostas})</span>
              </button>

              <button
                type="button"
                onClick={handlePrintSummary}
                style={{
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: '#FFFFFF',
                  border: '1.5px solid #E2E8F0',
                  color: '#334155',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
                title="Imprimir lista para o ônibus / passeio"
              >
                <Printer size={16} />
                <span>Imprimir Lista</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PORTAL PARA MODAIS DE TOP-LAYER (EVITA CONFLITOS DE STACKING CONTEXT NO MOBILE) */}
      <Portal>
        <style>{`
          dialog.aut-details-dialog {
            border: none;
            padding: 0;
            background: #FFFFFF;
            color: #0F172A;
            overflow: hidden;
            box-sizing: border-box;
            box-shadow: 0 25px 60px -12px rgba(15, 23, 42, 0.35);
            opacity: 0;
            transition-property: opacity, transform, display, overlay;
            transition-duration: 0.24s;
            transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1);
            transition-behavior: allow-discrete;
          }
          dialog.aut-details-dialog[open] {
            display: flex;
            flex-direction: column;
          }
          dialog.aut-details-dialog[open]:not(:modal) {
            position: fixed;
            inset: 0;
            z-index: 100100;
          }
          dialog.aut-details-dialog:modal {
            overscroll-behavior: contain;
          }
          dialog.aut-details-dialog::backdrop {
            background-color: rgba(15, 23, 42, 0);
            backdrop-filter: blur(6px);
            -webkit-backdrop-filter: blur(6px);
            overflow: hidden;
            overscroll-behavior: contain;
            transition-property: background-color, display, overlay;
            transition-duration: 0.24s;
            transition-timing-function: ease-out;
            transition-behavior: allow-discrete;
          }
          @media (max-width: 639px) {
            dialog.aut-details-dialog {
              width: 100%;
              max-width: 100%;
              margin: auto 0 0 0;
              border-radius: 22px 22px 0 0;
              border-top: 1px solid #E2E8F0;
              height: 90vh;
              height: min(90dvh, calc(100dvh - max(12px, env(safe-area-inset-top, 0px))));
              max-height: 92vh;
              max-height: min(92dvh, calc(100dvh - max(12px, env(safe-area-inset-top, 0px))));
            }
          }
          @media (max-width: 639px) and (prefers-reduced-motion: no-preference) {
            dialog.aut-details-dialog {
              transform: translateY(28px);
            }
          }
          @media (min-width: 640px) {
            dialog.aut-details-dialog {
              width: min(780px, calc(100vw - 32px));
              max-width: 780px;
              max-height: 88vh;
              max-height: min(88dvh, 840px);
              margin: auto;
              border-radius: 22px;
              border: 1px solid #E2E8F0;
            }
            .aut-sheet-handle {
              display: none !important;
            }
          }
          @media (min-width: 640px) and (prefers-reduced-motion: no-preference) {
            dialog.aut-details-dialog {
              transform: scale(0.96);
            }
          }
          dialog.aut-details-dialog[open]:where(:not([data-closing])) {
            opacity: 1;
          }
          @media (prefers-reduced-motion: no-preference) {
            dialog.aut-details-dialog[open]:where(:not([data-closing])) {
              transform: none;
            }
          }
          dialog.aut-details-dialog[open]:where(:not([data-closing]))::backdrop {
            background-color: rgba(15, 23, 42, 0.68);
          }
          @starting-style {
            dialog.aut-details-dialog[open]:where(:not([data-closing])) {
              opacity: 0;
            }
            dialog.aut-details-dialog[open]:where(:not([data-closing]))::backdrop {
              background-color: rgba(15, 23, 42, 0);
            }
          }
          @media (max-width: 639px) and (prefers-reduced-motion: no-preference) {
            @starting-style {
              dialog.aut-details-dialog[open]:where(:not([data-closing])) {
                transform: translateY(28px);
              }
            }
          }
          @media (min-width: 640px) and (prefers-reduced-motion: no-preference) {
            @starting-style {
              dialog.aut-details-dialog[open]:where(:not([data-closing])) {
                transform: scale(0.96);
              }
            }
          }
          @media (prefers-reduced-motion: reduce) {
            dialog.aut-details-dialog,
            dialog.aut-details-dialog::backdrop {
              transition-duration: 0.1s;
            }
          }
          .aut-sheet-handle {
            width: 36px;
            height: 4px;
            border-radius: 999px;
            background: #CBD5E1;
            margin: 8px auto 2px;
            flex-shrink: 0;
          }
          .aut-details-header {
            padding: 10px 14px 12px;
            border-bottom: 1px solid #F1F5F9;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.06) 0%, rgba(6, 182, 212, 0.04) 100%);
            flex-shrink: 0;
          }
          .aut-details-toolbar {
            padding: 10px 14px;
            border-bottom: 1px solid #E2E8F0;
            background: #FFFFFF;
            display: flex;
            flex-direction: column;
            gap: 8px;
            flex-shrink: 0;
          }
          .aut-filter-strip {
            display: flex;
            align-items: center;
            gap: 6px;
            overflow-x: auto;
            scrollbar-width: none;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 1px;
          }
          .aut-filter-strip::-webkit-scrollbar {
            display: none;
          }
          .aut-filter-chip {
            padding: 6px 11px;
            min-height: 34px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
          }
          .aut-search-wrap {
            position: relative;
            width: 100%;
            display: flex;
            align-items: center;
          }
          .aut-search-input {
            width: 100%;
            padding: 8px 32px 8px 34px;
            border-radius: 11px;
            border: 1px solid #CBD5E1;
            background: #F8FAFC;
            color: #0F172A;
            font-size: 16px;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
          }
          .aut-search-input:focus {
            background: #FFFFFF;
            border-color: #10B981;
            box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.14);
          }
          .aut-details-list {
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            overscroll-behavior: contain;
            background: #F8FAFC;
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            container: aut-list / inline-size;
          }
          .aut-student-card {
            background: #FFFFFF;
            border: 1px solid #E2E8F0;
            border-left-width: 3px;
            border-radius: 13px;
            padding: 11px 13px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
          }
          .aut-student-card-main {
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          @container aut-list (inline-size > 520px) {
            .aut-student-card-main {
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
            }
          }
          .aut-icon-hit {
            position: relative;
          }
          @media (pointer: coarse) {
            .aut-icon-hit::after {
              content: "";
              position: absolute;
              inset: -6px;
            }
            .aut-filter-chip {
              min-height: 36px;
            }
          }
          @media (min-width: 640px) {
            .aut-details-header {
              padding: 16px 22px;
            }
            .aut-details-toolbar {
              padding: 12px 22px;
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
            }
            .aut-search-wrap {
              width: 245px;
              flex-shrink: 0;
            }
            .aut-search-input {
              font-size: 12.5px;
              padding: 7px 28px 7px 32px;
            }
            .aut-details-list {
              padding: 14px 22px;
              gap: 10px;
            }
          }
        `}</style>

        {/* MODAL DETALHADA COM LISTA DE ALUNOS E OBSERVAÇÕES MÉDICAS */}
        <dialog
          ref={detailsDialogRef}
          className="aut-details-dialog"
          aria-labelledby={detailsDialogTitleId}
          {...({ closedby: 'any' } as any)}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => {
            e.stopPropagation()
            if (typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype) return
            const dialog = detailsDialogRef.current
            if (!dialog) return
            const r = dialog.getBoundingClientRect()
            pressedOutsideDetailsRef.current =
              e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
          }}
          onPointerUp={e => {
            e.stopPropagation()
            if (typeof HTMLDialogElement !== 'undefined' && 'closedBy' in HTMLDialogElement.prototype) return
            const dialog = detailsDialogRef.current
            if (!dialog) {
              pressedOutsideDetailsRef.current = false
              return
            }
            const r = dialog.getBoundingClientRect()
            const releasedOutside =
              e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
            if (pressedOutsideDetailsRef.current && releasedOutside) {
              void closeDetailsDialog()
            }
            pressedOutsideDetailsRef.current = false
          }}
          onCancel={e => {
            e.preventDefault()
            void closeDetailsDialog()
          }}
          onClose={() => {
            if (detailsDialogRef.current) {
              detailsDialogRef.current.returnValue = ''
            }
            setShowDetailsModal(false)
          }}
        >
          {showDetailsModal && (
            <>
              <div className="aut-sheet-handle" aria-hidden="true" />

              {/* MODAL HEADER */}
              <div className="aut-details-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 11,
                    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFFFFF',
                    flexShrink: 0
                  }} aria-hidden="true">
                    <Users size={18} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h1 id={detailsDialogTitleId} style={{ fontSize: 15.5, fontWeight: 800, color: '#0F172A', margin: 0, lineHeight: 1.25, textWrap: 'balance' as any }}>
                      Lista de Autorizações
                    </h1>
                    <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0 0', overflowWrap: 'break-word' }}>
                      {autorizacao.titulo}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={handlePrintSummary}
                    style={{
                      minHeight: 36,
                      padding: '0 11px',
                      background: '#FFFFFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#334155',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5
                    }}
                  >
                    <Printer size={14} aria-hidden="true" />
                    <span>Imprimir</span>
                  </button>

                  <button
                    type="button"
                    className="aut-icon-hit"
                    aria-label="Fechar lista de autorizações"
                    onClick={() => void closeDetailsDialog()}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: '#F1F5F9',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#475569',
                      flexShrink: 0
                    }}
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* FILTROS COMPACTOS EM PILLS + BUSCA FULL-WIDTH */}
              <div className="aut-details-toolbar">
                <div className="aut-filter-strip" role="group" aria-label="Filtrar respostas">
                  {[
                    { key: 'all', label: 'Todos', count: stats.totalRespostas, activeBorder: '#0F172A', activeBg: '#0F172A', activeColor: '#FFFFFF' },
                    { key: 'aprova', label: 'Autorizados', count: stats.totalAprovados, activeBorder: '#059669', activeBg: '#ECFDF5', activeColor: '#065F46' },
                    { key: 'recusa', label: 'Não Autorizados', count: stats.totalRecusados, activeBorder: '#DC2626', activeBg: '#FEF2F2', activeColor: '#991B1B' },
                    { key: 'obs', label: 'Alergias/Obs', count: stats.respostasComObservacoes.length, activeBorder: '#D97706', activeBg: '#FFFBEB', activeColor: '#92400E' }
                  ].map(tab => {
                    const isActive = selectedFilter === tab.key
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        className="aut-filter-chip"
                        aria-pressed={isActive}
                        onClick={() => setSelectedFilter(tab.key as any)}
                        style={{
                          border: isActive ? `1.5px solid ${tab.activeBorder}` : '1px solid #E2E8F0',
                          background: isActive ? tab.activeBg : '#F8FAFC',
                          color: isActive ? tab.activeColor : '#475569'
                        }}
                      >
                        {tab.key === 'aprova' && <CheckCircle2 size={13} aria-hidden="true" />}
                        {tab.key === 'recusa' && <XCircle size={13} aria-hidden="true" />}
                        {tab.key === 'obs' && <HeartPulse size={13} aria-hidden="true" />}
                        <span>{tab.label}</span>
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 800,
                          background: isActive ? (tab.key === 'all' ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.08)') : '#E2E8F0',
                          color: isActive ? tab.activeColor : '#334155'
                        }}>
                          {tab.count}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="aut-search-wrap">
                  <Search size={15} color="#94A3B8" aria-hidden="true" style={{ position: 'absolute', left: 11, pointerEvents: 'none' }} />
                  <input
                    type="search"
                    className="aut-search-input"
                    aria-label="Buscar aluno, turma ou responsável"
                    placeholder="Buscar aluno, turma ou responsável..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="aut-icon-hit"
                      aria-label="Limpar busca"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: 8,
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        border: 'none',
                        background: '#E2E8F0',
                        color: '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        padding: 0
                      }}
                    >
                      <X size={12} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {/* LISTA OTIMIZADA */}
              <div className="aut-details-list">
                {filteredRespostas.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '36px 20px',
                    color: '#64748B',
                    background: '#FFFFFF',
                    borderRadius: 14,
                    border: '1px dashed #CBD5E1'
                  }}>
                    <Users size={34} strokeWidth={1.6} aria-hidden="true" style={{ margin: '0 auto 8px', opacity: 0.45 }} />
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: '#334155', margin: 0 }}>
                      Nenhuma resposta encontrada para este filtro.
                    </p>
                  </div>
                ) : (
                  filteredRespostas.map(r => {
                    const isAprova = r.tipoDecisao === 'aprova'
                    const isRecusa = r.tipoDecisao === 'recusa'
                    const displayTurma = resolveTurmaNome(r.alunoTurma, r.alunoId)
                    const payStatus = getRespostaPaymentStatus(r)
                    const borderAccent = isAprova ? '#10B981' : isRecusa ? '#EF4444' : '#CBD5E1'

                    return (
                      <div
                        key={r.usuarioId + (r.alunoId || '')}
                        className="aut-student-card"
                        style={{ borderLeftColor: borderAccent }}
                      >
                        <div className="aut-student-card-main">
                          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', overflowWrap: 'break-word' }}>
                                {r.alunoNome || 'Aluno(a)'}
                              </span>
                              {displayTurma && (
                                <span style={{
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: '#4F46E5',
                                  background: '#EEF2FF',
                                  padding: '2px 7px',
                                  borderRadius: 6,
                                  whiteSpace: 'nowrap'
                                }}>
                                  {displayTurma}
                                </span>
                              )}
                            </div>

                            <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.4, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '2px 6px' }}>
                              <span>
                                Resp: <strong style={{ color: '#334155' }}>{r.usuarioNome}</strong>
                                {(r.cpfResponsavel || r.documentoResponsavel) ? ` (${r.cpfResponsavel || r.documentoResponsavel})` : ''}
                              </span>
                              <span style={{ whiteSpace: 'nowrap', color: '#94A3B8', fontSize: 11.5 }}>
                                • {formatDateTimeBR(r.respondidoEm)}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
                            {payStatus !== 'none' && (
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: 999,
                                background: payStatus === 'paid' ? '#D1FAE5' : '#FEF3C7',
                                color: payStatus === 'paid' ? '#065F46' : '#92400E',
                                fontSize: 11,
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                whiteSpace: 'nowrap'
                              }}>
                                <DollarSign size={11} aria-hidden="true" />
                                <span>{payStatus === 'paid' ? 'Pago' : 'Não pago'}</span>
                              </span>
                            )}
                            <span style={{
                              padding: '3px 9px',
                              borderRadius: 999,
                              background: isAprova ? '#DCFCE7' : isRecusa ? '#FEE2E2' : '#F1F5F9',
                              color: isAprova ? '#15803D' : isRecusa ? '#B91C1C' : '#475569',
                              fontSize: 11.5,
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              whiteSpace: 'nowrap'
                            }}>
                              {isAprova ? <CheckCircle2 size={13} aria-hidden="true" /> : isRecusa ? <XCircle size={13} aria-hidden="true" /> : null}
                              <span>{r.opcaoTexto}</span>
                            </span>
                          </div>
                        </div>

                        {/* ALERTA DE OBSERVAÇÕES MÉDICAS / ALERGIAS */}
                        {r.observacoes && (
                          <div style={{
                            background: '#FFFBEB',
                            borderLeft: '3px solid #F59E0B',
                            borderRadius: 7,
                            padding: '7px 10px',
                            fontSize: 12,
                            color: '#92400E',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 7
                          }}>
                            <HeartPulse size={14} color="#D97706" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
                            <span style={{ overflowWrap: 'break-word' }}><strong>Alergia / Obs:</strong> {r.observacoes}</span>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* FOOTER COMPACTO COM SAFE-AREA */}
              <div style={{
                padding: '9px 14px',
                paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
                borderTop: '1px solid #E2E8F0',
                background: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexShrink: 0
              }}>
                <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>
                  Exibindo <strong style={{ color: '#0F172A' }}>{filteredRespostas.length}</strong> de <strong style={{ color: '#0F172A' }}>{stats.totalRespostas}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => void closeDetailsDialog()}
                  style={{
                    minHeight: 34,
                    padding: '0 16px',
                    borderRadius: 9,
                    border: 'none',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Fechar
                </button>
              </div>
            </>
          )}
        </dialog>

        {/* DIALOG NATIVO: REABRIR AUTORIZAÇÃO E DEFINIR PRAZO */}
        <dialog
          ref={prazoDialogRef}
        className="autorizacao-prazo-dialog"
        aria-labelledby={prazoDialogTitleId}
        {...({ closedby: 'any' } as any)}
        onClick={e => e.stopPropagation()}
        onPointerDown={e => {
          e.stopPropagation()
          const dialog = prazoDialogRef.current
          if (!dialog) return
          const r = dialog.getBoundingClientRect()
          pressedOutsideDialogRef.current =
            e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
        }}
        onPointerUp={e => {
          e.stopPropagation()
          const dialog = prazoDialogRef.current
          if (!dialog || isUpdatingStatus) {
            pressedOutsideDialogRef.current = false
            return
          }
          const r = dialog.getBoundingClientRect()
          const releasedOutside =
            e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom
          if (pressedOutsideDialogRef.current && releasedOutside) {
            setPrazoDialogMode(null)
          }
          pressedOutsideDialogRef.current = false
        }}
        onCancel={e => {
          if (isUpdatingStatus) {
            e.preventDefault()
            return
          }
          setPrazoDialogMode(null)
        }}
        onClose={() => {
          if (prazoDialogRef.current) {
            prazoDialogRef.current.returnValue = ''
          }
          setPrazoDialogMode(null)
        }}
      >
        <form onSubmit={handleConfirmPrazoDialog} style={{ padding: 0, margin: 0 }}>
          <div style={{
            padding: '18px 22px',
            borderBottom: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(6, 182, 212, 0.06) 100%)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                flexShrink: 0
              }}>
                {prazoDialogMode === 'reopen' ? <Unlock size={18} /> : <Calendar size={18} />}
              </div>
              <div>
                <h1 id={prazoDialogTitleId} style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  {prazoDialogMode === 'reopen' ? 'Reabrir e Definir Prazo' : 'Definir Data do Prazo'}
                </h1>
                <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0 0' }}>
                  {autorizacao.titulo}
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label="Fechar janela de prazo"
              disabled={isUpdatingStatus}
              onClick={() => setPrazoDialogMode(null)}
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: '#F1F5F9',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
                color: '#64748B'
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {autorizacao.dataLimite && (
              <div style={{
                fontSize: 12,
                color: '#475569',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <Clock size={13} color="#64748B" />
                <span>
                  Prazo atual: <strong>{formatDataEventoBR(String(autorizacao.dataLimite).slice(0, 10))}</strong>
                </span>
              </div>
            )}

            <div>
              <label
                htmlFor={prazoDateInputId}
                style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', display: 'block', marginBottom: 6 }}
              >
                Nova data limite para resposta dos responsáveis
              </label>

              <input
                id={prazoDateInputId}
                type="date"
                min={todayYmd}
                value={draftSemPrazo ? '' : draftDataLimite}
                disabled={draftSemPrazo || isUpdatingStatus}
                autoFocus
                aria-invalid={prazoError ? true : undefined}
                aria-describedby={prazoError ? prazoErrorId : undefined}
                onChange={e => {
                  setDraftSemPrazo(false)
                  setDraftDataLimite(e.target.value)
                  if (prazoError) setPrazoError(null)
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: `1.5px solid ${prazoError ? '#FCA5A5' : '#CBD5E1'}`,
                  fontSize: 14,
                  fontWeight: 600,
                  color: draftSemPrazo ? '#94A3B8' : '#0F172A',
                  background: draftSemPrazo ? '#F8FAFC' : '#FFFFFF',
                  boxSizing: 'border-box'
                }}
              />

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {[
                  { label: 'Hoje', days: 0 },
                  { label: '+2 dias', days: 2 },
                  { label: '+5 dias', days: 5 },
                  { label: '+1 semana', days: 7 }
                ].map(preset => {
                  const presetVal = getLocalYmd(preset.days)
                  const isActive = !draftSemPrazo && draftDataLimite === presetVal
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => {
                        setDraftSemPrazo(false)
                        setDraftDataLimite(presetVal)
                        if (prazoError) setPrazoError(null)
                      }}
                      style={{
                        padding: '6px 11px',
                        borderRadius: 8,
                        border: isActive ? '1.5px solid #10B981' : '1px solid #CBD5E1',
                        background: isActive ? '#ECFDF5' : '#FFFFFF',
                        color: isActive ? '#047857' : '#475569',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: isUpdatingStatus ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <label
              htmlFor={prazoNoDeadlineId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#334155',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 10,
                padding: '9px 12px',
                cursor: 'pointer'
              }}
            >
              <input
                id={prazoNoDeadlineId}
                type="checkbox"
                checked={draftSemPrazo}
                disabled={isUpdatingStatus}
                onChange={e => {
                  setDraftSemPrazo(e.target.checked)
                  if (prazoError) setPrazoError(null)
                }}
                style={{ width: 16, height: 16, accentColor: '#10B981', cursor: 'pointer' }}
              />
              <span>Manter aberta sem data limite (até encerrar manualmente)</span>
            </label>

            {prazoError && (
              <div
                id={prazoErrorId}
                role="alert"
                style={{
                  background: '#FEF2F2',
                  border: '1px solid #FCA5A5',
                  borderRadius: 10,
                  padding: '9px 12px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: '#B91C1C',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{prazoError}</span>
              </div>
            )}
          </div>

          <div style={{
            padding: '14px 22px',
            borderTop: '1px solid #F1F5F9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 10,
            background: '#F8FAFC'
          }}>
            <button
              type="button"
              disabled={isUpdatingStatus}
              onClick={() => setPrazoDialogMode(null)}
              style={{
                padding: '9px 16px',
                borderRadius: 10,
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                color: '#475569',
                fontSize: 13,
                fontWeight: 700,
                cursor: isUpdatingStatus ? 'not-allowed' : 'pointer'
              }}
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isUpdatingStatus}
              style={{
                padding: '9px 18px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: '#FFFFFF',
                fontSize: 13,
                fontWeight: 700,
                cursor: isUpdatingStatus ? 'wait' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
              }}
            >
              {isUpdatingStatus ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Unlock size={15} />
                  <span>{prazoDialogMode === 'reopen' ? 'Confirmar e Reabrir' : 'Salvar Prazo'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </dialog>
      </Portal>
    </div>
  )
}
