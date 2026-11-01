'use client'

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Send,
  Sparkles,
  Users,
  GraduationCap,
  ShieldCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Smartphone,
  Monitor,
  Play,
  Pause,
  RotateCcw,
  CheckSquare,
  Square,
  ExternalLink,
  Loader2,
  Eye,
  Info,
  Clock,
  Filter,
  Save,
} from 'lucide-react'
import {
  DEFAULT_APP_STORE_URL,
  DEFAULT_GOOGLE_PLAY_URL,
  gerarHtmlConvitePrimeiroAcessoApp,
  type AlunoVinculadoConvite,
} from '@/lib/utils/firstAccessEmailTemplate'

export type CampaignCategoryFilter = 'responsavel' | 'aluno' | 'colaborador' | 'todos'

export interface PreselectedInviteUser {
  nome: string
  email: string
  categoria?: 'responsavel' | 'aluno' | 'colaborador'
  alunosVinculados?: AlunoVinculadoConvite[]
}

interface PendingInviteRecipient {
  id: string
  nome: string
  email: string
  categoria: 'responsavel' | 'aluno' | 'colaborador'
  cargoLabel: string
  cpf?: string
  telefone?: string
  alunosVinculados: AlunoVinculadoConvite[]
  turmas: string[]
  ultimoConviteEnviadoEm?: string | null
  totalConvitesEnviados?: number
}

interface MissingEmailPendingUser {
  id: string
  nome: string
  categoria: 'responsavel' | 'aluno' | 'colaborador'
  detalhe: string
}

interface CategorySummary {
  total: number
  ativos: number
  pendentesTotal: number
  elegiveisComEmail: number
  semEmail: number
  jaConvidados: number
}

interface FirstAccessInviteCampaignModalProps {
  isOpen: boolean
  onClose: () => void
  defaultCategory?: CampaignCategoryFilter
  preselectedUser?: PreselectedInviteUser | null
  onCampaignSuccess?: () => void
}

export function FirstAccessInviteCampaignModal({
  isOpen,
  onClose,
  defaultCategory = 'responsavel',
  preselectedUser = null,
  onCampaignSuccess,
}: FirstAccessInviteCampaignModalProps) {
  const [activeTab, setActiveTab] = useState<'publico' | 'preview' | 'disparo'>('publico')
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [loadError, setLoadError] = useState('')

  const [summary, setSummary] = useState<{
    responsaveis: CategorySummary
    alunos: CategorySummary
    colaboradores: CategorySummary
  } | null>(null)

  const [recipients, setRecipients] = useState<PendingInviteRecipient[]>([])
  const [missingEmailUsers, setMissingEmailUsers] = useState<MissingEmailPendingUser[]>([])
  const [availableTurmas, setAvailableTurmas] = useState<string[]>([])
  const [showMissingEmailsModal, setShowMissingEmailsModal] = useState(false)

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<CampaignCategoryFilter>(defaultCategory)
  const [turmaFilter, setTurmaFilter] = useState<string>('Todas')
  const [inviteStatusFilter, setInviteStatusFilter] = useState<'todos' | 'nao_enviados' | 'ja_enviados'>('todos')
  const [searchQuery, setSearchQuery] = useState('')

  // Selection
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())

  // Store Links & Test Email
  const [googlePlayUrl, setGooglePlayUrl] = useState(DEFAULT_GOOGLE_PLAY_URL)
  const [appStoreUrl, setAppStoreUrl] = useState(DEFAULT_APP_STORE_URL)
  const [isSavingLinks, setIsSavingLinks] = useState(false)
  const [linksSavedSuccess, setLinksSavedSuccess] = useState(false)

  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('mobile')
  const [testEmailInput, setTestEmailInput] = useState('')
  const [isSendingTest, setIsSendingTest] = useState(false)
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Single quick send state
  const [sendingSingleEmail, setSendingSingleEmail] = useState<string | null>(null)

  // Batch Dispatch State
  const [dispatchMode, setDispatchMode] = useState<'safe' | 'fast'>('safe')
  const [dispatchStatus, setDispatchStatus] = useState<
    'idle' | 'running' | 'cooldown' | 'paused' | 'completed'
  >('idle')
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0)
  const [cooldownReason, setCooldownReason] = useState('')
  const [dispatchProgress, setDispatchProgress] = useState({
    total: 0,
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  })
  const [failedQueueItems, setFailedQueueItems] = useState<PendingInviteRecipient[]>([])
  const [dispatchLogs, setDispatchLogs] = useState<
    Array<{
      email: string
      nome: string
      status:
        | 'sent'
        | 'simulated'
        | 'skipped_already_accessed'
        | 'skipped_invalid_email'
        | 'rate_limited'
        | 'failed'
      error?: string
      timestamp: string
    }>
  >([])

  const pauseRef = useRef(false)
  const abortRef = useRef(false)
  const skipCooldownRef = useRef(false)
  const activeQueueRef = useRef<PendingInviteRecipient[]>([])
  const currentIndexRef = useRef<number>(0)

  const fetchPendingUsers = async (initialCat?: CampaignCategoryFilter, preUser?: PreselectedInviteUser | null) => {
    setIsLoadingData(true)
    setLoadError('')
    try {
      const res = await fetch('/api/comunicacao/primeiro-acesso-pendentes', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível carregar a lista de usuários pendentes.')
      }

      setSummary(data.summary || null)
      const list: PendingInviteRecipient[] = Array.isArray(data.recipients) ? data.recipients : []
      setRecipients(list)
      setMissingEmailUsers(Array.isArray(data.missingEmailUsers) ? data.missingEmailUsers : [])
      setAvailableTurmas(Array.isArray(data.turmas) ? data.turmas : [])

      if (data.storeLinks?.googlePlayUrl) setGooglePlayUrl(data.storeLinks.googlePlayUrl)
      if (data.storeLinks?.appStoreUrl) setAppStoreUrl(data.storeLinks.appStoreUrl)

      const targetCat = preUser?.categoria || initialCat || defaultCategory
      setCategoryFilter(targetCat)

      if (preUser?.email) {
        const cleanPre = preUser.email.trim().toLowerCase()
        setSearchQuery(cleanPre)
        setSelectedEmails(new Set([cleanPre]))
      } else {
        // Seleciona inteligentemente apenas quem AINDA NÃO recebeu o convite (se houver inéditos),
        // evitando reenviar por engano para quem já recebeu na campanha anterior
        const initialMatching = list.filter(r =>
          targetCat === 'todos' ? true : r.categoria === targetCat
        )
        const uninvitedMatching = initialMatching.filter(r => !r.ultimoConviteEnviadoEm)
        const targetToSelect = uninvitedMatching.length > 0 ? uninvitedMatching : initialMatching
        const dedupedSet = new Set<string>()
        targetToSelect.forEach(r => dedupedSet.add(r.email))
        setSelectedEmails(dedupedSet)
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Erro de conexão ao buscar pendentes.')
    } finally {
      setIsLoadingData(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setActiveTab('publico')
      setTurmaFilter('Todas')
      setInviteStatusFilter('todos')
      setSearchQuery(preselectedUser?.email || '')
      setTestFeedback(null)
      setDispatchStatus('idle')
      setDispatchLogs([])
      pauseRef.current = false
      abortRef.current = false
      fetchPendingUsers(defaultCategory, preselectedUser)
    }
  }, [isOpen, defaultCategory, preselectedUser])

  // Filtered list based on active filters
  const filteredRecipients = useMemo(() => {
    // Quando a categoria for 'todos', deduplicamos por e-mail priorizando o registro de responsável
    let baseList = recipients
    if (categoryFilter !== 'todos') {
      baseList = recipients.filter(r => r.categoria === categoryFilter)
    } else {
      const byEmail = new Map<string, PendingInviteRecipient>()
      for (const r of recipients) {
        const existing = byEmail.get(r.email)
        if (!existing || (existing.categoria !== 'responsavel' && r.categoria === 'responsavel')) {
          byEmail.set(r.email, r)
        }
      }
      baseList = Array.from(byEmail.values())
    }

    return baseList.filter(r => {
      if (turmaFilter !== 'Todas') {
        if (!r.turmas.includes(turmaFilter)) return false
      }
      if (inviteStatusFilter === 'nao_enviados' && r.ultimoConviteEnviadoEm) return false
      if (inviteStatusFilter === 'ja_enviados' && !r.ultimoConviteEnviadoEm) return false

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const matchNome = r.nome.toLowerCase().includes(q)
        const matchEmail = r.email.toLowerCase().includes(q)
        const matchAluno = r.alunosVinculados.some(a => a.nome.toLowerCase().includes(q))
        const matchCpf = r.cpf && r.cpf.toLowerCase().includes(q)
        if (!matchNome && !matchEmail && !matchAluno && !matchCpf) return false
      }

      return true
    })
  }, [recipients, categoryFilter, turmaFilter, inviteStatusFilter, searchQuery])

  // Contadores ao vivo por categoria e para a categoria atual
  const categoryBaseRecipients = useMemo(() => {
    if (categoryFilter !== 'todos') {
      return recipients.filter(r => r.categoria === categoryFilter)
    }
    const byEmail = new Map<string, PendingInviteRecipient>()
    for (const r of recipients) {
      const existing = byEmail.get(r.email)
      if (!existing || (existing.categoria !== 'responsavel' && r.categoria === 'responsavel')) {
        byEmail.set(r.email, r)
      }
    }
    return Array.from(byEmail.values())
  }, [recipients, categoryFilter])

  const liveCounts = useMemo(() => {
    const total = categoryBaseRecipients.length
    const jaEnviados = categoryBaseRecipients.filter(r => Boolean(r.ultimoConviteEnviadoEm)).length
    const faltaEnviar = total - jaEnviados
    return { total, jaEnviados, faltaEnviar }
  }, [categoryBaseRecipients])

  // Change category filter and auto-update selection for convenience
  const handleCategoryChange = (cat: CampaignCategoryFilter) => {
    setCategoryFilter(cat)
    setTurmaFilter('Todas')
    const matching = recipients.filter(r => (cat === 'todos' ? true : r.categoria === cat))
    const uninvited = matching.filter(r => !r.ultimoConviteEnviadoEm)
    const targetList = uninvited.length > 0 ? uninvited : matching
    const nextSet = new Set<string>()
    targetList.forEach(r => nextSet.add(r.email))
    setSelectedEmails(nextSet)
  }

  const selectOnlyUninvitedInCategory = () => {
    const uninvited = categoryBaseRecipients.filter(r => !r.ultimoConviteEnviadoEm)
    const nextSet = new Set<string>()
    uninvited.forEach(r => nextSet.add(r.email))
    setSelectedEmails(nextSet)
    setInviteStatusFilter('nao_enviados')
  }

  const toggleSelectAllFiltered = () => {
    const allFilteredSelected =
      filteredRecipients.length > 0 && filteredRecipients.every(r => selectedEmails.has(r.email))

    const next = new Set(selectedEmails)
    if (allFilteredSelected) {
      filteredRecipients.forEach(r => next.delete(r.email))
    } else {
      filteredRecipients.forEach(r => next.add(r.email))
    }
    setSelectedEmails(next)
  }

  const toggleSingleRecipient = (email: string) => {
    const next = new Set(selectedEmails)
    if (next.has(email)) next.delete(email)
    else next.add(email)
    setSelectedEmails(next)
  }

  // Selected recipient objects (deduplicated by email)
  const selectedRecipientObjects = useMemo(() => {
    const map = new Map<string, PendingInviteRecipient>()
    for (const r of recipients) {
      if (!selectedEmails.has(r.email)) continue
      const existing = map.get(r.email)
      if (!existing || (existing.categoria !== 'responsavel' && r.categoria === 'responsavel')) {
        map.set(r.email, r)
      }
    }
    return Array.from(map.values())
  }, [recipients, selectedEmails])

  // Sample user for live email preview
  const samplePreviewUser = useMemo(() => {
    const firstSelected = selectedRecipientObjects[0] || filteredRecipients[0]
    if (firstSelected) return firstSelected
    return {
      id: 'preview-sample',
      nome: preselectedUser?.nome || 'Maria Clara Oliveira (Mãe)',
      email: preselectedUser?.email || 'familia.exemplo@gmail.com',
      categoria: (preselectedUser?.categoria || 'responsavel') as 'responsavel' | 'aluno' | 'colaborador',
      cargoLabel: 'Responsável / Família',
      alunosVinculados: preselectedUser?.alunosVinculados || [
        { nome: 'Lucas Oliveira', turma: '6º Ano A' },
      ],
      turmas: ['6º Ano A'],
    }
  }, [selectedRecipientObjects, filteredRecipients, preselectedUser])

  const previewHtml = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://impacto-edu.net'
    return gerarHtmlConvitePrimeiroAcessoApp({
      nomeDestinatario: samplePreviewUser.nome,
      emailDestinatario: samplePreviewUser.email,
      categoria: samplePreviewUser.categoria,
      alunosVinculados: samplePreviewUser.alunosVinculados,
      firstAccessUrl: `${origin}/login?step=first_access_verify&email=${encodeURIComponent(
        samplePreviewUser.email
      )}`,
      googlePlayUrl,
      appStoreUrl,
    })
  }, [samplePreviewUser, googlePlayUrl, appStoreUrl])

  const handleSaveStoreLinks = async () => {
    setIsSavingLinks(true)
    setLinksSavedSuccess(false)
    try {
      const res = await fetch('/api/comunicacao/primeiro-acesso-pendentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_links',
          googlePlayUrl,
          appStoreUrl,
        }),
      })
      if (res.ok) {
        setLinksSavedSuccess(true)
        setTimeout(() => setLinksSavedSuccess(false), 2500)
      }
    } finally {
      setIsSavingLinks(false)
    }
  }

  const handleSendTestEmail = async () => {
    const clean = testEmailInput.trim().toLowerCase()
    if (!clean || !clean.includes('@')) {
      setTestFeedback({ type: 'error', message: 'Digite um e-mail válido para enviar o teste.' })
      return
    }
    setIsSendingTest(true)
    setTestFeedback(null)
    try {
      const res = await fetch('/api/comunicacao/primeiro-acesso-pendentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_test',
          testEmail: clean,
          testNome: samplePreviewUser.nome,
          alunosVinculados: samplePreviewUser.alunosVinculados,
          googlePlayUrl,
          appStoreUrl,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTestFeedback({
          type: 'error',
          message: data.error || 'Falha ao enviar e-mail de teste.',
        })
        return
      }
      setTestFeedback({
        type: 'success',
        message: `E-mail de teste enviado com sucesso para ${clean}! Verifique sua caixa de entrada.`,
      })
    } catch (err: any) {
      setTestFeedback({
        type: 'error',
        message: err?.message || 'Erro de conexão ao disparar teste.',
      })
    } finally {
      setIsSendingTest(false)
    }
  }

  const handleSendSingleImmediate = async (recipient: PendingInviteRecipient) => {
    setSendingSingleEmail(recipient.email)
    try {
      const res = await fetch('/api/comunicacao/primeiro-acesso-pendentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_batch',
          recipients: [recipient],
          googlePlayUrl,
          appStoreUrl,
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Erro ao enviar convite.')
        return
      }
      const itemResult = data.results?.[0]
      if (itemResult?.status === 'sent' || itemResult?.status === 'simulated') {
        const nowIso = new Date().toISOString()
        setRecipients(prev =>
          prev.map(r =>
            r.email === recipient.email
              ? {
                  ...r,
                  ultimoConviteEnviadoEm: nowIso,
                  totalConvitesEnviados: (r.totalConvitesEnviados || 0) + 1,
                }
              : r
          )
        )
        if (onCampaignSuccess) onCampaignSuccess()
      } else if (itemResult?.status === 'skipped_already_accessed') {
        alert(`${recipient.nome} já realizou o primeiro acesso! Removendo da lista de pendentes.`)
        setRecipients(prev => prev.filter(r => r.email !== recipient.email))
      } else {
        alert(`Falha ao enviar para ${recipient.email}: ${itemResult?.error || 'Erro desconhecido'}`)
      }
    } catch {
      alert('Erro de comunicação com o servidor.')
    } finally {
      setSendingSingleEmail(null)
    }
  }

  const formatDateTimePtBr = (iso?: string | null) => {
    if (!iso) return ''
    try {
      const d = new Date(iso)
      if (isNaN(d.getTime())) return ''
      const dateStr = d.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
      const timeStr = d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
      return `${dateStr} às ${timeStr}`
    } catch {
      return ''
    }
  }

  // Espera inteligente com cronômetro regressivo visível na tela (sem travar a UI)
  const waitWithCountdown = async (seconds: number, reason: string) => {
    skipCooldownRef.current = false
    setCooldownReason(reason)
    setCooldownSecondsLeft(seconds)
    setDispatchStatus('cooldown')

    for (let rem = seconds; rem > 0; rem--) {
      if (abortRef.current || skipCooldownRef.current) break
      while (pauseRef.current && !abortRef.current) {
        setDispatchStatus('paused')
        await new Promise(r => setTimeout(r, 400))
      }
      if (abortRef.current || skipCooldownRef.current) break
      setDispatchStatus('cooldown')
      setCooldownSecondsLeft(rem)
      await new Promise(r => setTimeout(r, 1000))
    }

    setCooldownSecondsLeft(0)
    setCooldownReason('')
    if (!abortRef.current && !pauseRef.current) {
      setDispatchStatus('running')
    }
  }

  // Batch Campaign Execution Engine (Anti-Travamento + Auto-Cooldown Locaweb 452 4.7.1)
  const runBatchDispatch = async (queue: PendingInviteRecipient[], isResume = false) => {
    if (queue.length === 0) return

    setActiveTab('disparo')
    setDispatchStatus('running')
    pauseRef.current = false
    abortRef.current = false
    skipCooldownRef.current = false
    activeQueueRef.current = queue

    if (!isResume) {
      setDispatchProgress({
        total: queue.length,
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
      })
      setFailedQueueItems([])
      setDispatchLogs([])
    }

    const BATCH_SIZE = dispatchMode === 'safe' ? 2 : 3
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined
    let idx = 0
    let sentInSession = 0
    let consecutiveRateLimits = 0

    while (idx < queue.length) {
      currentIndexRef.current = idx
      if (abortRef.current) break

      while (pauseRef.current && !abortRef.current) {
        setDispatchStatus('paused')
        await new Promise(r => setTimeout(r, 400))
      }
      if (abortRef.current) break
      setDispatchStatus('running')

      const chunk = queue.slice(idx, idx + BATCH_SIZE)

      try {
        const res = await fetch('/api/comunicacao/primeiro-acesso-pendentes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_batch',
            recipients: chunk,
            googlePlayUrl,
            appStoreUrl,
            origin,
          }),
        })

        const data = await res.json().catch(() => ({}))
        const batchResults: any[] = Array.isArray(data?.results) ? data.results : []

        if (!res.ok || batchResults.length === 0) {
          const fallbackErr = data?.error || 'Falha no lote de envio'
          const isRateLimitMsg =
            fallbackErr.includes('452') ||
            fallbackErr.includes('4.7.1') ||
            fallbackErr.toLowerCase().includes('too many')

          if (isRateLimitMsg) {
            consecutiveRateLimits++
            const waitSecs = Math.min(240, 90 + (consecutiveRateLimits - 1) * 45)
            setDispatchLogs(prev => [
              {
                email: chunk[0].email,
                nome: chunk[0].nome,
                status: 'rate_limited',
                error: `Pausa automática anti-bloqueio Locaweb (${waitSecs}s) — o e-mail permanece na fila e será enviado automaticamente.`,
                timestamp: new Date().toLocaleTimeString('pt-BR'),
              },
              ...prev,
            ])
            await waitWithCountdown(
              waitSecs,
              `Servidor SMTP da Locaweb solicitou pausa temporária de rajada (452 4.7.1). Retomando automaticamente o envio para ${chunk[0].nome} sem perder nenhum e-mail...`
            )
            continue
          }

          const failedEntries = chunk.map(c => ({
            email: c.email,
            nome: c.nome,
            status: 'failed' as const,
            error: fallbackErr,
            timestamp: new Date().toLocaleTimeString('pt-BR'),
          }))
          setFailedQueueItems(prev => [...prev, ...chunk])
          setDispatchLogs(prev => [...failedEntries, ...prev])
          setDispatchProgress(prev => ({
            ...prev,
            processed: prev.processed + chunk.length,
            failed: prev.failed + chunk.length,
          }))
          idx += chunk.length
        } else {
          const nowIso = new Date().toISOString()
          const nowTime = new Date().toLocaleTimeString('pt-BR')
          let sentDelta = 0
          let skippedDelta = 0
          let failedDelta = 0
          let hitRateLimitInBatch = false
          let consumedCount = 0

          const sentUpdates = new Map<string, { sentAt: string; count?: number }>()
          const newFailedItems: PendingInviteRecipient[] = []
          const newLogItems: Array<{
            email: string
            nome: string
            status:
              | 'sent'
              | 'simulated'
              | 'skipped_already_accessed'
              | 'skipped_invalid_email'
              | 'rate_limited'
              | 'failed'
            error?: string
            timestamp: string
          }> = []

          for (let j = 0; j < batchResults.length; j++) {
            const br = batchResults[j]
            if (br.status === 'rate_limited') {
              hitRateLimitInBatch = true
              consecutiveRateLimits++
              const waitSecs = Math.min(240, 90 + (consecutiveRateLimits - 1) * 45)
              newLogItems.push({
                email: br.email,
                nome: br.nome,
                status: 'rate_limited',
                error: `Limite de rajada Locaweb (452 4.7.1) — aguardando ${waitSecs}s para reenviar automaticamente`,
                timestamp: nowTime,
              })
              break
            }

            consumedCount++
            if (br.status === 'sent' || br.status === 'simulated') {
              sentDelta++
              sentInSession++
              consecutiveRateLimits = 0
              sentUpdates.set(br.email, {
                sentAt: br.sentAt || nowIso,
                count: br.count,
              })
            } else if (String(br.status).startsWith('skipped_')) {
              skippedDelta++
            } else {
              failedDelta++
              const origItem = chunk.find(c => c.email === br.email)
              if (origItem) newFailedItems.push(origItem)
            }

            newLogItems.push({
              email: br.email,
              nome: br.nome,
              status: br.status,
              error: br.error,
              timestamp: nowTime,
            })
          }

          if (sentUpdates.size > 0) {
            setRecipients(prev =>
              prev.map(r => {
                const up = sentUpdates.get(r.email)
                if (!up) return r
                return {
                  ...r,
                  ultimoConviteEnviadoEm: up.sentAt,
                  totalConvitesEnviados: up.count || (r.totalConvitesEnviados || 0) + 1,
                }
              })
            )
            // Desmarca os e-mails já enviados da seleção para manter a fila limpa
            setSelectedEmails(prev => {
              const next = new Set(prev)
              sentUpdates.forEach((_, em) => next.delete(em))
              return next
            })
            if (onCampaignSuccess) onCampaignSuccess()
          }

          if (newFailedItems.length > 0) {
            setFailedQueueItems(prev => [...prev, ...newFailedItems])
          }

          if (newLogItems.length > 0) {
            setDispatchLogs(prev => [...newLogItems, ...prev])
          }

          if (consumedCount > 0) {
            setDispatchProgress(prev => ({
              ...prev,
              processed: prev.processed + consumedCount,
              sent: prev.sent + sentDelta,
              skipped: prev.skipped + skippedDelta,
              failed: prev.failed + failedDelta,
            }))
            idx += consumedCount
          }

          if (hitRateLimitInBatch) {
            const waitSecs = Math.min(240, 90 + (consecutiveRateLimits - 1) * 45)
            await waitWithCountdown(
              waitSecs,
              `Limite temporário de rajada da Locaweb (452 4.7.1) detectado. Os e-mails restantes estão protegidos na fila e o envio retomará sozinho após o resfriamento.`
            )
            continue
          }

          // Pausa preventiva a cada 35 envios no Modo Blindado Locaweb para evitar atingir 452
          if (
            dispatchMode === 'safe' &&
            idx < queue.length &&
            sentInSession > 0 &&
            sentInSession % 35 === 0
          ) {
            await waitWithCountdown(
              25,
              `Respiro preventivo anti-bloqueio (a cada 35 e-mails enviados) para estabilizar a conexão com o servidor SMTP da Locaweb...`
            )
          } else if (idx < queue.length) {
            const interBatchDelay = dispatchMode === 'safe' ? 1400 : 400
            await new Promise(r => setTimeout(r, interBatchDelay))
          }
        }
      } catch (err: any) {
        const failedEntries = chunk.map(c => ({
          email: c.email,
          nome: c.nome,
          status: 'failed' as const,
          error: err?.message || 'Erro de rede',
          timestamp: new Date().toLocaleTimeString('pt-BR'),
        }))
        setFailedQueueItems(prev => [...prev, ...chunk])
        setDispatchLogs(prev => [...failedEntries, ...prev])
        setDispatchProgress(prev => ({
          ...prev,
          processed: prev.processed + chunk.length,
          failed: prev.failed + chunk.length,
        }))
        idx += chunk.length
      }
    }

    if (!abortRef.current) {
      setDispatchStatus('completed')
      if (onCampaignSuccess) onCampaignSuccess()
    } else {
      setDispatchStatus('idle')
    }
  }

  if (!isOpen) return null

  const pctProgress =
    dispatchProgress.total > 0
      ? Math.min(100, Math.round((dispatchProgress.processed / dispatchProgress.total) * 100))
      : 0

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          overflow: 'hidden',
          overscrollBehavior: 'contain',
        }}
        onClick={() => {
          if (dispatchStatus !== 'running') onClose()
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 1080,
            maxHeight: '92vh',
            background: '#ffffff',
            borderRadius: 24,
            border: '1px solid #e2e8f0',
            boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            overscrollBehavior: 'contain',
            color: '#0f172a',
          }}
        >
          {/* ── TOP GRADIENT HEADER ── */}
          <div
            style={{
              background: 'linear-gradient(135deg, #07122b 0%, #0f2557 50%, #1d4ed8 100%)',
              padding: '22px 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              color: '#ffffff',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: -40,
                right: -40,
                width: 180,
                height: 180,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.14)',
                  border: '1px solid rgba(255, 255, 255, 0.28)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 20px rgba(0, 0, 0, 0.2)',
                  flexShrink: 0,
                }}
              >
                <Mail size={24} color="#60a5fa" />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: 'rgba(16, 185, 129, 0.22)',
                      border: '1px solid rgba(52, 211, 153, 0.4)',
                      color: '#6ee7b7',
                    }}
                  >
                    🔒 Filtro Estrito: Apenas Sem 1º Acesso
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      padding: '3px 10px',
                      borderRadius: 999,
                      background: 'rgba(255, 255, 255, 0.12)',
                      color: '#bfdbfe',
                    }}
                  >
                    iOS App Store &amp; Google Play Inclusos
                  </span>
                </div>
                <h2
                  style={{
                    margin: '6px 0 2px 0',
                    fontSize: 20,
                    fontWeight: 900,
                    color: '#ffffff',
                    letterSpacing: '-0.02em',
                    fontFamily: 'Outfit, sans-serif',
                  }}
                >
                  Central de Convite para 1º Acesso • App &amp; Agenda Digital
                </h2>
                <p style={{ margin: 0, fontSize: 12.5, color: '#cbd5e1', fontWeight: 500 }}>
                  Dispare o convite oficial apresentando todas as funções da Agenda Digital exclusivamente para quem nunca acessou.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (dispatchStatus === 'running') {
                  if (!confirm('Um disparo em lote está em andamento. Deseja realmente interromper e fechar?')) {
                    return
                  }
                  abortRef.current = true
                }
                onClose()
              }}
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.14)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* ── NAVIGATION TABS ── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 28px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                {
                  id: 'publico' as const,
                  label: '1. Público Sem 1º Acesso',
                  icon: <Users size={15} />,
                  badge: selectedRecipientObjects.length,
                },
                {
                  id: 'preview' as const,
                  label: '2. Preview Ultra-Moderno & Lojas',
                  icon: <Eye size={15} />,
                },
                {
                  id: 'disparo' as const,
                  label: '3. Disparo Inteligente em Lotes',
                  icon: <Send size={15} />,
                  badge:
                    dispatchStatus === 'running'
                      ? `${pctProgress}%`
                      : dispatchStatus === 'completed'
                      ? 'Concluído'
                      : undefined,
                },
              ].map(t => {
                const active = activeTab === t.id
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '9px 16px',
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: active ? 800 : 600,
                      border: active ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      background: active ? '#2563eb' : '#ffffff',
                      color: active ? '#ffffff' : '#334155',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      boxShadow: active ? '0 4px 12px rgba(37, 99, 235, 0.25)' : 'none',
                    }}
                  >
                    {t.icon}
                    <span>{t.label}</span>
                    {t.badge !== undefined && (
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 800,
                          background: active ? 'rgba(255,255,255,0.22)' : '#e2e8f0',
                          color: active ? '#ffffff' : '#0f172a',
                        }}
                      >
                        {t.badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {missingEmailUsers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowMissingEmailsModal(prev => !prev)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    background: 'rgba(245, 158, 11, 0.08)',
                    color: '#b45309',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <AlertTriangle size={13} />
                  <span>
                    {showMissingEmailsModal
                      ? 'Voltar para Lista de Envio'
                      : `${
                          (summary?.responsaveis.semEmail || 0) + (summary?.alunos.semEmail || 0)
                        } pendentes sem e-mail`}
                  </span>
                </button>
              )}

              {activeTab !== 'disparo' && selectedRecipientObjects.length > 0 && (
                <button
                  type="button"
                  onClick={() => runBatchDispatch(selectedRecipientObjects)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 18px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 6px 16px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <Send size={14} />
                  <span>Disparar para {selectedRecipientObjects.length} Selecionado(s)</span>
                </button>
              )}
            </div>
          </div>

          {/* ── BODY CONTENT ── */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '22px 28px',
              overscrollBehavior: 'contain',
              background: '#ffffff',
            }}
          >
            {isLoadingData ? (
              <div
                style={{
                  padding: '64px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                <Loader2 size={36} className="animate-spin" color="#2563eb" />
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
                  Auditando telemetria de acessos em tempo real...
                </div>
                <div style={{ fontSize: 13, color: '#64748b' }}>
                  Filtrando exclusivamente usuários com zero login registrado e validando endereços de e-mail.
                </div>
              </div>
            ) : loadError ? (
              <div
                style={{
                  padding: 28,
                  borderRadius: 16,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  textAlign: 'center',
                }}
              >
                <AlertTriangle size={28} style={{ margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>{loadError}</div>
                <button
                  type="button"
                  onClick={() => fetchPendingUsers(categoryFilter, preselectedUser)}
                  className="btn btn-primary btn-sm"
                >
                  Tentar Novamente
                </button>
              </div>
            ) : showMissingEmailsModal ? (
              /* ── VIEW: USUÁRIOS PENDENTES SEM E-MAIL CADASTRADO ── */
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                    padding: '14px 18px',
                    borderRadius: 14,
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#92400e' }}>
                      ⚠️ Cadastros Aguardando 1º Acesso sem E-mail Válido
                    </div>
                    <div style={{ fontSize: 12.5, color: '#b45309', marginTop: 2 }}>
                      Estes usuários ainda não fizeram o primeiro acesso, porém não possuem endereço de e-mail cadastrado na secretaria. Cadastre o e-mail na aba de Responsáveis/Alunos para habilitá-los.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMissingEmailsModal(false)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: 10,
                      border: '1px solid #d97706',
                      background: '#ffffff',
                      color: '#b45309',
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: 'pointer',
                    }}
                  >
                    ← Voltar aos Elegíveis
                  </button>
                </div>

                <div
                  style={{
                    maxHeight: 420,
                    overflowY: 'auto',
                    border: '1px solid #e2e8f0',
                    borderRadius: 14,
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569' }}>Nome</th>
                        <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569' }}>Categoria</th>
                        <th style={{ padding: '12px 16px', fontWeight: 800, color: '#475569' }}>Vínculo / Detalhe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {missingEmailUsers.map(u => (
                        <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 16px', fontWeight: 700, color: '#0f172a' }}>{u.nome}</td>
                          <td style={{ padding: '10px 16px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 700,
                                background: u.categoria === 'responsavel' ? '#d1fae5' : '#dbeafe',
                                color: u.categoria === 'responsavel' ? '#047857' : '#1d4ed8',
                              }}
                            >
                              {u.categoria === 'responsavel' ? 'Responsável' : 'Aluno'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 16px', color: '#64748b' }}>{u.detalhe}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : activeTab === 'publico' ? (
              /* ════════════════════════════════════════════════════════════════
                 ABA 1: PÚBLICO SEM PRIMEIRO ACESSO & FILTROS
                 ════════════════════════════════════════════════════════════════ */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {/* Cards de Resumo de Telemetria por Perfil */}
                {summary && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
                      gap: 12,
                    }}
                  >
                    {[
                      {
                        key: 'responsavel' as const,
                        title: 'Responsáveis (Pais)',
                        icon: <Users size={16} />,
                        color: '#059669',
                        bg: '#ecfdf5',
                        border: '#a7f3d0',
                        data: summary.responsaveis,
                      },
                      {
                        key: 'aluno' as const,
                        title: 'Alunos (Corpo Discente)',
                        icon: <GraduationCap size={16} />,
                        color: '#2563eb',
                        bg: '#eff6ff',
                        border: '#bfdbfe',
                        data: summary.alunos,
                      },
                      {
                        key: 'colaborador' as const,
                        title: 'Colaboradores & Equipe',
                        icon: <ShieldCheck size={16} />,
                        color: '#7c3aed',
                        bg: '#f5f3ff',
                        border: '#ddd6fe',
                        data: summary.colaboradores,
                      },
                    ].map(card => {
                      const isSelectedCat = categoryFilter === card.key
                      const catList = recipients.filter(r => r.categoria === card.key)
                      const liveSentCount = catList.filter(r => Boolean(r.ultimoConviteEnviadoEm)).length
                      const liveUnsentCount = Math.max(0, catList.length - liveSentCount)
                      return (
                        <div
                          key={card.key}
                          onClick={() => handleCategoryChange(card.key)}
                          style={{
                            padding: '14px 16px',
                            borderRadius: 16,
                            background: isSelectedCat ? card.bg : '#f8fafc',
                            border: isSelectedCat ? `2px solid ${card.color}` : '1px solid #e2e8f0',
                            cursor: 'pointer',
                            transition: 'all 0.18s',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                fontSize: 13,
                                fontWeight: 800,
                                color: card.color,
                              }}
                            >
                              {card.icon}
                              {card.title}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 800,
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: '#ffffff',
                                color: card.color,
                                border: `1px solid ${card.border}`,
                              }}
                            >
                              {card.data.pendentesTotal} s/ acesso
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'baseline',
                              gap: 6,
                              marginTop: 10,
                            }}
                          >
                            <span style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                              {catList.length || card.data.elegiveisComEmail}
                            </span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>
                              com e-mail ({liveUnsentCount} faltam enviar)
                            </span>
                          </div>

                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              flexWrap: 'wrap',
                              gap: 4,
                              marginTop: 8,
                              fontSize: 11,
                              color: '#64748b',
                              fontWeight: 600,
                            }}
                          >
                            <span>✓ {card.data.ativos} já acessaram</span>
                            {liveSentCount > 0 ? (
                              <span
                                style={{
                                  padding: '2px 7px',
                                  borderRadius: 999,
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  fontWeight: 800,
                                }}
                              >
                                📨 {liveSentCount} já enviados (s/ acesso)
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8' }}>0 enviados</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Abas Rápidas de Filtro por Status do Envio (Visão Clara de Quem Já Recebeu vs Quem Falta) */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    flexWrap: 'wrap',
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setInviteStatusFilter('todos')}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: inviteStatusFilter === 'todos' ? '1px solid #1d4ed8' : '1px solid #cbd5e1',
                        background: inviteStatusFilter === 'todos' ? '#1d4ed8' : '#ffffff',
                        color: inviteStatusFilter === 'todos' ? '#ffffff' : '#334155',
                      }}
                    >
                      📋 Todos Sem 1º Acesso ({liveCounts.total})
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteStatusFilter('nao_enviados')}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: inviteStatusFilter === 'nao_enviados' ? '1px solid #d97706' : '1px solid #fde68a',
                        background: inviteStatusFilter === 'nao_enviados' ? '#d97706' : '#fffbeb',
                        color: inviteStatusFilter === 'nao_enviados' ? '#ffffff' : '#b45309',
                      }}
                    >
                      ⏳ Ainda Não Enviados ({liveCounts.faltaEnviar})
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteStatusFilter('ja_enviados')}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                        border: inviteStatusFilter === 'ja_enviados' ? '1px solid #059669' : '1px solid #a7f3d0',
                        background: inviteStatusFilter === 'ja_enviados' ? '#059669' : '#ecfdf5',
                        color: inviteStatusFilter === 'ja_enviados' ? '#ffffff' : '#047857',
                      }}
                    >
                      📨 Convite Já Enviado • Aguardando Acesso ({liveCounts.jaEnviados})
                    </button>
                  </div>

                  {liveCounts.faltaEnviar > 0 && (
                    <button
                      type="button"
                      onClick={selectOnlyUninvitedInCategory}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '7px 14px',
                        borderRadius: 10,
                        border: '1px solid #059669',
                        background: '#ffffff',
                        color: '#047857',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      🎯 Selecionar Apenas os {liveCounts.faltaEnviar} Não Enviados
                    </button>
                  )}
                </div>

                {/* Barra de Filtros e Busca */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    flexWrap: 'wrap',
                    padding: '14px 16px',
                    background: '#f8fafc',
                    borderRadius: 14,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: 1 }}>
                    <div style={{ position: 'relative', minWidth: 250, flex: 1 }}>
                      <Search
                        size={15}
                        style={{
                          position: 'absolute',
                          left: 12,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          color: '#94a3b8',
                        }}
                      />
                      <input
                        type="text"
                        placeholder="Buscar por nome do pai, aluno ou e-mail..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px 8px 34px',
                          borderRadius: 10,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          fontSize: 13,
                          color: '#0f172a',
                          fontWeight: 500,
                        }}
                      />
                    </div>

                    <select
                      value={categoryFilter}
                      onChange={e => handleCategoryChange(e.target.value as CampaignCategoryFilter)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: '#0f172a',
                      }}
                    >
                      <option value="responsavel">Público: Apenas Responsáveis (Pais)</option>
                      <option value="aluno">Público: Apenas Alunos</option>
                      <option value="colaborador">Público: Apenas Colaboradores</option>
                      <option value="todos">Público: Todos os Pendentes (Unificado)</option>
                    </select>

                    <select
                      value={turmaFilter}
                      onChange={e => setTurmaFilter(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: '#0f172a',
                      }}
                    >
                      <option value="Todas">Turma: Todas as Turmas</option>
                      {availableTurmas.map(t => (
                        <option key={t} value={t}>
                          Turma: {t}
                        </option>
                      ))}
                    </select>

                    <select
                      value={inviteStatusFilter}
                      onChange={e => setInviteStatusFilter(e.target.value as any)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: '#0f172a',
                      }}
                    >
                      <option value="todos">Envio: Todos s/ 1º acesso</option>
                      <option value="nao_enviados">Envio: Apenas inéditos (ainda não convidados)</option>
                      <option value="ja_enviados">Envio: Apenas quem já recebeu antes</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      onClick={toggleSelectAllFiltered}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <CheckSquare size={14} color="#2563eb" />
                      <span>
                        {filteredRecipients.length > 0 &&
                        filteredRecipients.every(r => selectedEmails.has(r.email))
                          ? 'Desmarcar Filtrados'
                          : `Selecionar Filtrados (${filteredRecipients.length})`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Tabela de Destinatários Elegíveis (Sem 1º Acesso) */}
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 16,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ maxHeight: 370, overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead>
                        <tr
                          style={{
                            background: '#f8fafc',
                            borderBottom: '1px solid #e2e8f0',
                            textAlign: 'left',
                            position: 'sticky',
                            top: 0,
                            zIndex: 1,
                          }}
                        >
                          <th style={{ padding: '12px 14px', width: 40 }}>
                            <input
                              type="checkbox"
                              checked={
                                filteredRecipients.length > 0 &&
                                filteredRecipients.every(r => selectedEmails.has(r.email))
                              }
                              onChange={toggleSelectAllFiltered}
                              style={{ cursor: 'pointer', width: 15, height: 15 }}
                            />
                          </th>
                          <th style={{ padding: '12px 14px', fontWeight: 800, color: '#475569' }}>
                            Destinatário (Sem 1º Acesso)
                          </th>
                          <th style={{ padding: '12px 14px', fontWeight: 800, color: '#475569' }}>
                            E-mail de Login
                          </th>
                          <th style={{ padding: '12px 14px', fontWeight: 800, color: '#475569' }}>
                            Aluno(s) / Turma
                          </th>
                          <th style={{ padding: '12px 14px', fontWeight: 800, color: '#475569' }}>
                            Status do Convite
                          </th>
                          <th style={{ padding: '12px 14px', fontWeight: 800, color: '#475569', textAlign: 'right' }}>
                            Ação Rápida
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecipients.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ padding: 42, textAlign: 'center', color: '#64748b' }}>
                              Nenhum usuário pendente de 1º acesso encontrado para este filtro.
                            </td>
                          </tr>
                        ) : (
                          filteredRecipients.map(r => {
                            const isChecked = selectedEmails.has(r.email)
                            const isSendingThis = sendingSingleEmail === r.email
                            return (
                              <tr
                                key={`${r.categoria}-${r.email}`}
                                onClick={() => toggleSingleRecipient(r.email)}
                                style={{
                                  borderBottom: '1px solid #f1f5f9',
                                  background: isChecked ? 'rgba(37, 99, 235, 0.04)' : '#ffffff',
                                  cursor: 'pointer',
                                }}
                              >
                                <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleSingleRecipient(r.email)}
                                    style={{ cursor: 'pointer', width: 15, height: 15 }}
                                  />
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <div style={{ fontWeight: 800, color: '#0f172a' }}>{r.nome}</div>
                                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                                    {r.cargoLabel} • <span style={{ color: '#d97706', fontWeight: 700 }}>Nunca acessou</span>
                                  </div>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  <code
                                    style={{
                                      fontSize: 12,
                                      background: '#f1f5f9',
                                      padding: '3px 7px',
                                      borderRadius: 6,
                                      color: '#1e3a8a',
                                      fontWeight: 700,
                                    }}
                                  >
                                    {r.email}
                                  </code>
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  {r.alunosVinculados.length === 0 ? (
                                    <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                      {r.alunosVinculados.map((a, idx) => (
                                        <div key={idx} style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>
                                          {a.nome}
                                          {a.turma && (
                                            <span
                                              style={{
                                                marginLeft: 6,
                                                padding: '1px 6px',
                                                borderRadius: 6,
                                                background: '#dbeafe',
                                                color: '#1d4ed8',
                                                fontSize: 10.5,
                                                fontWeight: 700,
                                              }}
                                            >
                                              {a.turma}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '10px 14px' }}>
                                  {r.ultimoConviteEnviadoEm ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                      <span
                                        style={{
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: 5,
                                          padding: '3px 9px',
                                          borderRadius: 999,
                                          background: '#dcfce7',
                                          color: '#15803d',
                                          fontSize: 11,
                                          fontWeight: 800,
                                          width: 'fit-content',
                                        }}
                                      >
                                        <CheckCircle2 size={11} />
                                        📨 Enviado em {formatDateTimePtBr(r.ultimoConviteEnviadoEm)}
                                      </span>
                                      <span style={{ fontSize: 10.5, color: '#047857', fontWeight: 700, paddingLeft: 4 }}>
                                        {r.totalConvitesEnviados && r.totalConvitesEnviados > 1
                                          ? `${r.totalConvitesEnviados}x enviado • Ainda sem 1º acesso`
                                          : '1x enviado • Aguardando pai acessar'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        padding: '4px 9px',
                                        borderRadius: 999,
                                        background: '#fffbeb',
                                        border: '1px solid #fde68a',
                                        color: '#b45309',
                                        fontSize: 11,
                                        fontWeight: 700,
                                      }}
                                    >
                                      <Clock size={11} />
                                      Ainda não enviado
                                    </span>
                                  )}
                                </td>
                                <td
                                  style={{ padding: '10px 14px', textAlign: 'right' }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    disabled={isSendingThis}
                                    onClick={() => handleSendSingleImmediate(r)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      padding: '6px 12px',
                                      borderRadius: 8,
                                      border: '1px solid #bfdbfe',
                                      background: '#eff6ff',
                                      color: '#1d4ed8',
                                      fontSize: 11.5,
                                      fontWeight: 800,
                                      cursor: isSendingThis ? 'wait' : 'pointer',
                                    }}
                                  >
                                    {isSendingThis ? (
                                      <>
                                        <Loader2 size={12} className="animate-spin" /> Enviando...
                                      </>
                                    ) : (
                                      <>
                                        <Send size={11} /> {r.ultimoConviteEnviadoEm ? 'Reenviar' : 'Convidar'}
                                      </>
                                    )}
                                  </button>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : activeTab === 'preview' ? (
              /* ════════════════════════════════════════════════════════════════
                 ABA 2: PREVIEW ULTRA-MODERNO & LINKS DAS LOJAS (iOS / ANDROID)
                 ════════════════════════════════════════════════════════════════ */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '360px 1fr',
                  gap: 20,
                  alignItems: 'start',
                }}
              >
                {/* Coluna Esquerda: Configurações das Lojas + Disparo de Teste */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div
                    style={{
                      padding: 18,
                      borderRadius: 16,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                      📲 Links Oficiais das Lojas no E-mail
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>
                      Estes botões aparecerão no topo e no rodapé do convite para download direto no iPhone e Android.
                    </div>

                    <div style={{ marginBottom: 12 }}>
                      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                        🍏 Link iPhone / iPad (Apple App Store)
                      </label>
                      <input
                        type="url"
                        value={appStoreUrl}
                        onChange={e => setAppStoreUrl(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          color: '#0f172a',
                          background: '#ffffff',
                        }}
                      />
                    </div>

                    <div style={{ marginBottom: 14 }}>
                      <label style={{ display: 'block', fontSize: 11.5, fontWeight: 800, color: '#334155', marginBottom: 4 }}>
                        ▶️ Link Android (Google Play Store)
                      </label>
                      <input
                        type="url"
                        value={googlePlayUrl}
                        onChange={e => setGooglePlayUrl(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          fontSize: 12,
                          color: '#0f172a',
                          background: '#ffffff',
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveStoreLinks}
                      disabled={isSavingLinks}
                      style={{
                        width: '100%',
                        padding: '9px 14px',
                        borderRadius: 10,
                        border: '1px solid #cbd5e1',
                        background: linksSavedSuccess ? '#dcfce7' : '#ffffff',
                        color: linksSavedSuccess ? '#15803d' : '#0f172a',
                        fontSize: 12.5,
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                      }}
                    >
                      {linksSavedSuccess ? (
                        <>
                          <CheckCircle2 size={14} /> Links Salvos com Sucesso!
                        </>
                      ) : (
                        <>
                          <Save size={14} /> Salvar Links Padrão
                        </>
                      )}
                    </button>
                  </div>

                  {/* Card de Envio de E-mail de Teste */}
                  <div
                    style={{
                      padding: 18,
                      borderRadius: 16,
                      background: '#eff6ff',
                      border: '1px solid #bfdbfe',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a8a', marginBottom: 4 }}>
                      🧪 Testar no Seu E-mail Agora
                    </div>
                    <div style={{ fontSize: 12, color: '#3b82f6', marginBottom: 12 }}>
                      Envie uma demonstração real para o seu próprio e-mail e veja como o pai receberá no celular.
                    </div>

                    <input
                      type="email"
                      placeholder="Digite seu e-mail (ex: direcao@colegioimpacto.net)"
                      value={testEmailInput}
                      onChange={e => setTestEmailInput(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: 10,
                        border: '1px solid #93c5fd',
                        fontSize: 12.5,
                        background: '#ffffff',
                        color: '#0f172a',
                        marginBottom: 10,
                      }}
                    />

                    <button
                      type="button"
                      onClick={handleSendTestEmail}
                      disabled={isSendingTest}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: 'none',
                        background: '#2563eb',
                        color: '#ffffff',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: isSendingTest ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      {isSendingTest ? (
                        <>
                          <Loader2 size={14} className="animate-spin" /> Disparando Teste...
                        </>
                      ) : (
                        <>
                          <Send size={14} /> Enviar E-mail de Teste
                        </>
                      )}
                    </button>

                    {testFeedback && (
                      <div
                        style={{
                          marginTop: 10,
                          padding: '8px 12px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 600,
                          background: testFeedback.type === 'success' ? '#dcfce7' : '#fee2e2',
                          color: testFeedback.type === 'success' ? '#166534' : '#991b1b',
                        }}
                      >
                        {testFeedback.message}
                      </div>
                    )}
                  </div>
                </div>

                {/* Coluna Direita: Visualizador Ao Vivo do E-mail */}
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 16,
                    overflow: 'hidden',
                    background: '#f1f5f9',
                  }}
                >
                  <div
                    style={{
                      padding: '10px 16px',
                      background: '#ffffff',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
                      Simulando visualização para: <strong style={{ color: '#2563eb' }}>{samplePreviewUser.nome}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('mobile')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '5px 10px',
                          borderRadius: 8,
                          fontSize: 11.5,
                          fontWeight: 700,
                          border: '1px solid #cbd5e1',
                          background: previewDevice === 'mobile' ? '#0f172a' : '#ffffff',
                          color: previewDevice === 'mobile' ? '#ffffff' : '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        <Smartphone size={13} /> Celular
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewDevice('desktop')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '5px 10px',
                          borderRadius: 8,
                          fontSize: 11.5,
                          fontWeight: 700,
                          border: '1px solid #cbd5e1',
                          background: previewDevice === 'desktop' ? '#0f172a' : '#ffffff',
                          color: previewDevice === 'desktop' ? '#ffffff' : '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        <Monitor size={13} /> Desktop
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: 16,
                      display: 'flex',
                      justifyContent: 'center',
                      background: '#cbd5e1',
                    }}
                  >
                    <iframe
                      title="Preview do E-mail de Primeiro Acesso"
                      srcDoc={previewHtml}
                      style={{
                        width: previewDevice === 'mobile' ? 390 : '100%',
                        height: 490,
                        border: 'none',
                        borderRadius: 16,
                        background: '#ffffff',
                        boxShadow: '0 12px 32px rgba(15, 23, 42, 0.18)',
                        transition: 'width 0.25s ease',
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ════════════════════════════════════════════════════════════════
                 ABA 3: CENTRAL DE DISPARO EM LOTES (TEMPO REAL)
                 ════════════════════════════════════════════════════════════════ */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Painel de Status e Barra de Progresso */}
                <div
                  style={{
                    padding: 24,
                    borderRadius: 18,
                    background: 'linear-gradient(145deg, #f8fafc 0%, #eff6ff 100%)',
                    border: '1px solid #bfdbfe',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 16,
                      flexWrap: 'wrap',
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                        {dispatchStatus === 'idle' &&
                          `Pronto para enviar convite a ${selectedRecipientObjects.length} destinatário(s) sem 1º acesso`}
                        {dispatchStatus === 'running' &&
                          `Disparando convites em lotes seguros... (${dispatchProgress.processed} de ${dispatchProgress.total})`}
                        {dispatchStatus === 'cooldown' &&
                          `⏳ Auto-Resfriamento Anti-Bloqueio SMTP (${cooldownSecondsLeft}s restantes)`}
                        {dispatchStatus === 'paused' && 'Disparo pausado temporariamente'}
                        {dispatchStatus === 'completed' && '🎉 Disparo de convites finalizado com sucesso!'}
                      </div>
                      <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
                        {dispatchStatus === 'cooldown'
                          ? cooldownReason
                          : 'Proteção ativa contra limite de rajada da Locaweb (452 4.7.1): se o servidor pedir pausa, o sistema aguarda e retoma sozinho sem perder nenhum e-mail.'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Seletor de Cadência Anti-Bloqueio */}
                      <select
                        value={dispatchMode}
                        onChange={e => setDispatchMode(e.target.value as 'safe' | 'fast')}
                        disabled={dispatchStatus === 'running'}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 10,
                          border: '1px solid #93c5fd',
                          background: '#ffffff',
                          color: '#1e3a8a',
                          fontSize: 12.5,
                          fontWeight: 800,
                        }}
                      >
                        <option value="safe">🛡️ Modo Blindado Locaweb (Anti-Bloqueio)</option>
                        <option value="fast">⚡ Modo Rápido c/ Auto-Espera</option>
                      </select>

                      {dispatchStatus === 'idle' && (
                        <button
                          type="button"
                          disabled={selectedRecipientObjects.length === 0}
                          onClick={() => runBatchDispatch(selectedRecipientObjects)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '12px 24px',
                            borderRadius: 12,
                            border: 'none',
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                            color: '#ffffff',
                            fontSize: 14,
                            fontWeight: 800,
                            cursor: selectedRecipientObjects.length === 0 ? 'not-allowed' : 'pointer',
                            boxShadow: '0 8px 20px rgba(37, 99, 235, 0.3)',
                          }}
                        >
                          <Play size={16} /> Iniciar Envio Agora ({selectedRecipientObjects.length})
                        </button>
                      )}

                      {dispatchStatus === 'cooldown' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              skipCooldownRef.current = true
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '10px 16px',
                              borderRadius: 10,
                              border: 'none',
                              background: '#2563eb',
                              color: '#ffffff',
                              fontSize: 12.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            <Play size={14} /> Testar Liberação Agora ({cooldownSecondsLeft}s)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              pauseRef.current = true
                              setDispatchStatus('paused')
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '10px 16px',
                              borderRadius: 10,
                              border: '1px solid #f59e0b',
                              background: '#fffbeb',
                              color: '#b45309',
                              fontSize: 12.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            <Pause size={14} /> Pausar
                          </button>
                        </>
                      )}

                      {dispatchStatus === 'running' && (
                        <button
                          type="button"
                          onClick={() => {
                            pauseRef.current = true
                            setDispatchStatus('paused')
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '10px 18px',
                            borderRadius: 10,
                            border: '1px solid #f59e0b',
                            background: '#fffbeb',
                            color: '#b45309',
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          <Pause size={15} /> Pausar
                        </button>
                      )}

                      {dispatchStatus === 'paused' && (
                        <button
                          type="button"
                          onClick={() => {
                            pauseRef.current = false
                            setDispatchStatus('running')
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '10px 18px',
                            borderRadius: 10,
                            border: 'none',
                            background: '#10b981',
                            color: '#ffffff',
                            fontSize: 13,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          <Play size={15} /> Retomar
                        </button>
                      )}

                      {(dispatchStatus === 'paused' || dispatchStatus === 'completed') &&
                        failedQueueItems.length > 0 && (
                          <button
                            type="button"
                            onClick={() => runBatchDispatch(failedQueueItems)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '10px 16px',
                              borderRadius: 10,
                              border: '1px solid #dc2626',
                              background: '#fef2f2',
                              color: '#b91c1c',
                              fontSize: 12.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            <RotateCcw size={14} /> Reenviar Apenas Falhas ({failedQueueItems.length})
                          </button>
                        )}

                      {(dispatchStatus === 'paused' || dispatchStatus === 'completed') &&
                        liveCounts.faltaEnviar > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const uninvited = categoryBaseRecipients.filter(
                                r => !r.ultimoConviteEnviadoEm
                              )
                              runBatchDispatch(uninvited)
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '10px 16px',
                              borderRadius: 10,
                              border: '1px solid #059669',
                              background: '#ecfdf5',
                              color: '#047857',
                              fontSize: 12.5,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            <Send size={14} /> Enviar Faltantes Inéditos ({liveCounts.faltaEnviar})
                          </button>
                        )}
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div
                    style={{
                      width: '100%',
                      height: 14,
                      background: '#e2e8f0',
                      borderRadius: 999,
                      overflow: 'hidden',
                      marginBottom: 14,
                    }}
                  >
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pctProgress}%` }}
                      style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, #2563eb 0%, #10b981 100%)',
                        borderRadius: 999,
                      }}
                    />
                  </div>

                  {/* Contadores do Lote */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Total na Fila</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a' }}>
                        {dispatchProgress.total || selectedRecipientObjects.length}
                      </div>
                    </div>
                    <div style={{ background: '#f0fdf4', padding: '10px 14px', borderRadius: 12, border: '1px solid #bbf7d0' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>Enviados c/ Sucesso</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#166534' }}>{dispatchProgress.sent}</div>
                    </div>
                    <div style={{ background: '#fffbeb', padding: '10px 14px', borderRadius: 12, border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Ignorados (Já Ativos)</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#92400e' }}>{dispatchProgress.skipped}</div>
                    </div>
                    <div style={{ background: '#fef2f2', padding: '10px 14px', borderRadius: 12, border: '1px solid #fecaca' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase' }}>Falhas SMTP</div>
                      <div style={{ fontSize: 20, fontWeight: 900, color: '#991b1b' }}>{dispatchProgress.failed}</div>
                    </div>
                  </div>
                </div>

                {/* Log de Auditoria em Tempo Real */}
                <div
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 16,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      padding: '12px 16px',
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      fontWeight: 800,
                      fontSize: 13,
                      color: '#334155',
                    }}
                  >
                    📋 Relatório de Transmissão em Tempo Real ({dispatchLogs.length})
                  </div>
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    {dispatchLogs.length === 0 ? (
                      <div style={{ padding: 36, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                        Clique em &ldquo;Iniciar Envio Agora&rdquo; para acompanhar cada e-mail disparado em tempo real.
                      </div>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                        <tbody>
                          {dispatchLogs.map((log, index) => (
                            <tr key={`${log.email}-${index}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '8px 14px', color: '#64748b', width: 85 }}>{log.timestamp}</td>
                              <td style={{ padding: '8px 14px', fontWeight: 700, color: '#0f172a' }}>{log.nome}</td>
                              <td style={{ padding: '8px 14px', fontFamily: 'monospace', color: '#1e3a8a' }}>{log.email}</td>
                              <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                                {log.status === 'sent' || log.status === 'simulated' ? (
                                  <span style={{ color: '#059669', fontWeight: 800 }}>✓ Entregue</span>
                                ) : log.status === 'rate_limited' ? (
                                  <span style={{ color: '#d97706', fontWeight: 800 }}>
                                    ⏳ {log.error || 'Aguardando janela SMTP Locaweb (protegido na fila)'}
                                  </span>
                                ) : log.status === 'skipped_already_accessed' ? (
                                  <span style={{ color: '#d97706', fontWeight: 700 }}>Pulado (Já possui 1º acesso)</span>
                                ) : (
                                  <span style={{ color: '#dc2626', fontWeight: 700 }}>
                                    ✕ Falhou ({log.error || 'Erro'})
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
