'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Check,
  AlertCircle,
  Lock,
  Send,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Star,
  ArrowUp,
  ArrowDown,
  Eraser,
  Sparkles,
  UserCheck,
  UserPlus,
  Calendar,
  Clock,
  Info,
  RotateCcw,
  FileCheck2,
  FileText,
  ShieldCheck,
  Printer,
  Plus,
  Search,
  Image as ImageIcon,
  Globe,
  Eye,
  EyeOff,
  X,
  User,
  LogIn,
  Copy,
  Edit3,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

const GoogleIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      fill="#EA4335"
    />
  </svg>
)
import {
  GPForm,
  FormField,
  GPFormResponse,
  MOOD_OPTIONS,
} from '@/lib/gestao-pessoas/formulariosTypes'
import { RenderMediaCollection } from './FormMediaHelper'
import { FormRichTextRenderer } from './FormRichTextEditor'

interface ColaboradorOption {
  id: string
  nome: string
  cargo?: string
  departamento?: string
  unidade?: string
  email?: string
}

interface FormRendererProps {
  form: GPForm
  currentUser?: any
  isAdmin?: boolean
  isPreview?: boolean
  initialManualMode?: boolean
  editingResponse?: GPFormResponse | null
  colaboradoresList?: ColaboradorOption[]
  onSubmitSuccess?: (response: GPFormResponse, addAnother?: boolean) => void
  onCancel?: () => void
}

export function evaluateConditionalRule(
  field: FormField,
  answers: Record<string, any>
): boolean {
  if (!field.conditional || !field.conditional.enabled || !field.conditional.sourceFieldId) {
    return true
  }
  const { sourceFieldId, operator, value } = field.conditional
  const rawAns = answers[sourceFieldId]
  const targetVal = String(value ?? '').trim().toLowerCase()

  if (Array.isArray(rawAns)) {
    const normalizedArr = rawAns.map(x => String(x).trim().toLowerCase())
    if (operator === 'equals') return normalizedArr.includes(targetVal)
    if (operator === 'not_equals') return !normalizedArr.includes(targetVal)
    if (operator === 'contains') return normalizedArr.some(x => x.includes(targetVal))
    return true
  }

  const strAns = String(rawAns ?? '').trim().toLowerCase()
  switch (operator) {
    case 'equals':
      return strAns === targetVal
    case 'not_equals':
      return strAns !== targetVal
    case 'contains':
      return strAns.includes(targetVal)
    case 'greater_than':
      return Number(rawAns) > Number(value)
    case 'less_than':
      return Number(rawAns) < Number(value)
    default:
      return true
  }
}

function SignaturePad({
  value,
  onChange,
  primaryColor,
}: {
  value: string
  onChange: (dataUrl: string) => void
  primaryColor: string
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = '#0f172a'
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0]
      return {
        x: (t.clientX - rect.left) * scaleX,
        y: (t.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { x, y } = getCoords(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const { x, y } = getCoords(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const endDraw = () => {
    if (!isDrawing) return
    setIsDrawing(false)
    const canvas = canvasRef.current
    if (canvas) {
      onChange(canvas.toDataURL('image/png'))
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          position: 'relative',
          border: `2px dashed ${value ? primaryColor : '#cbd5e1'}`,
          borderRadius: 16,
          background: '#ffffff',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          width={640}
          height={180}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
          style={{
            width: '100%',
            height: 160,
            display: 'block',
            cursor: 'crosshair',
          }}
        />
        {!value && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              color: '#94a3b8',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Assine aqui usando o mouse ou o toque na tela
          </div>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: value ? '#16a34a' : '#64748b', fontWeight: 600 }}>
          {value ? '✓ Assinatura capturada' : 'Aguardando rubrica/assinatura'}
        </span>
        <button
          type="button"
          onClick={clearCanvas}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            background: '#f8fafc',
            color: '#475569',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Eraser size={14} /> Limpar Assinatura
        </button>
      </div>
    </div>
  )
}

function decodeGoogleJwt(token: string): any {
  try {
    const base64Url = token.split('.')[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

function loadGoogleGsiScript(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('Window not available'))
    if ((window as any).google?.accounts?.oauth2 || (window as any).google?.accounts?.id) {
      return resolve((window as any).google)
    }
    const existing = document.getElementById('google-gsi-client')
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).google))
      existing.addEventListener('error', () =>
        reject(new Error('Falha ao carregar biblioteca de login do Google'))
      )
      return
    }
    const script = document.createElement('script')
    script.id = 'google-gsi-client'
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = () => resolve((window as any).google)
    script.onerror = () => reject(new Error('Falha ao carregar Google Identity Services'))
    document.head.appendChild(script)
  })
}

export function FormRenderer({
  form,
  currentUser,
  isAdmin = false,
  isPreview = false,
  initialManualMode = false,
  editingResponse = null,
  colaboradoresList = [],
  onSubmitSuccess,
  onCancel,
}: FormRendererProps) {
  // Effective User state (supports login via Google or IMPACTO EDU)
  const [sessionUser, setSessionUser] = useState<any>(currentUser || null)
  useEffect(() => {
    if (currentUser) {
      setSessionUser(currentUser)
    }
  }, [currentUser])

  const effectiveUser = sessionUser || currentUser || null

  // Auth Modal State (Login via Google or IMPACTO EDU)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [showAuthPassword, setShowAuthPassword] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [authSuccessToast, setAuthSuccessToast] = useState('')
  const [manualNameOverride, setManualNameOverride] = useState(false)

  const draftStorageKey = `gp_form_draft_${form.id}_${effectiveUser?.id || 'anon'}`
  const startTimeRef = useRef<number>(Date.now())
  const isPublicForm = Boolean(form.settings?.publicLink || form.settings?.requireLogin === false)

  const [answers, setAnswers] = useState<Record<string, any>>(() => {
    if (editingResponse?.answers) {
      return { ...editingResponse.answers }
    }
    return {}
  })

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({})
  const [hoverStarMap, setHoverStarMap] = useState<Record<string, number>>({})

  // Display mode override (allows respondent to switch if desired or uses form.theme.displayMode)
  const [activeDisplayMode, setActiveDisplayMode] = useState<
    'classic_all' | 'section_wizard' | 'focus_one_by_one'
  >(form.theme?.displayMode || 'classic_all')

  useEffect(() => {
    if (form.theme?.displayMode) {
      setActiveDisplayMode(form.theme.displayMode)
    }
  }, [form.theme?.displayMode])

  const [currentSectionIdx, setCurrentSectionIdx] = useState(0)
  const [currentFocusIdx, setCurrentFocusIdx] = useState(0)

  // Manual Admin Entry State ("Mas tambem posso adicionar respostas")
  const [isManualMode, setIsManualMode] = useState<boolean>(
    Boolean(initialManualMode || editingResponse?.source === 'inserido_pelo_gestor')
  )

  useEffect(() => {
    if (initialManualMode) {
      setIsManualMode(true)
      setSubmittedResponse(null)
    }
  }, [initialManualMode])

  const [selectedColabId, setSelectedColabId] = useState<string>(
    editingResponse?.respondentId || ''
  )
  const [colabSearch, setColabSearch] = useState('')
  const [manualName, setManualName] = useState(editingResponse?.respondentName || '')
  const [manualEmail, setManualEmail] = useState(editingResponse?.respondentEmail || '')
  const [manualRole, setManualRole] = useState(editingResponse?.respondentRole || '')
  const [manualDept, setManualDept] = useState(editingResponse?.respondentDepartment || '')
  const [manualUnit, setManualUnit] = useState(editingResponse?.respondentUnit || '')
  const [manualDate, setManualDate] = useState(
    editingResponse?.submittedAt
      ? editingResponse.submittedAt.slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  )
  const [manualNotes, setManualNotes] = useState(editingResponse?.adminNotes || '')

  // Inline Login State when collaborator is not logged in
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Check if there is an existing response: from form.myResponse or localStorage
  const localSavedResponse = useMemo<GPFormResponse | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const s = localStorage.getItem(`gp_form_completed_${form.id}`)
      if (s) {
        const parsed = JSON.parse(s)
        if (parsed && parsed.id) return parsed
      }
    } catch {}
    return null
  }, [form.id])

  const initialExistingResponse =
    !editingResponse && !initialManualMode && !form.settings?.allowMultipleResponses
      ? (form.myResponse || localSavedResponse)
      : null

  const [submittedResponse, setSubmittedResponse] = useState<GPFormResponse | null>(initialExistingResponse)
  const [editingSelfResponse, setEditingSelfResponse] = useState<GPFormResponse | null>(null)
  const [isJustUpdated, setIsJustUpdated] = useState(false)
  const [isReturningRespondent, setIsReturningRespondent] = useState<boolean>(Boolean(initialExistingResponse))
  const [copiedProtocol, setCopiedProtocol] = useState(false)
  const [showAnswersSummary, setShowAnswersSummary] = useState(false)

  useEffect(() => {
    const existing = form.myResponse || localSavedResponse
    if (
      existing &&
      !form.settings?.allowMultipleResponses &&
      !editingResponse &&
      !isManualMode &&
      !submittedResponse &&
      !editingSelfResponse
    ) {
      setSubmittedResponse(existing)
      setIsReturningRespondent(true)
    }
  }, [form.myResponse, localSavedResponse, form.settings?.allowMultipleResponses, editingResponse, isManualMode, submittedResponse, editingSelfResponse])

  const handleStartEditing = () => {
    const targetResp = submittedResponse || form.myResponse || localSavedResponse
    if (!targetResp) return
    setEditingSelfResponse(targetResp)
    if (targetResp.answers) {
      setAnswers({ ...targetResp.answers })
    }
    setSubmittedResponse(null)
    setIsJustUpdated(false)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleCancelEditing = () => {
    if (editingSelfResponse) {
      setSubmittedResponse(editingSelfResponse)
      setEditingSelfResponse(null)
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
  }

  const handleSendAnotherResponse = () => {
    setSubmittedResponse(null)
    setEditingSelfResponse(null)
    setAnswers({})
    startTimeRef.current = Date.now()
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)

  // Load saved draft for collaborator mode
  useEffect(() => {
    if (editingResponse || isPreview || isManualMode) return
    try {
      const saved = localStorage.getItem(draftStorageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          setAnswers(prev => ({ ...parsed, ...prev }))
        }
      }
    } catch {}
  }, [draftStorageKey, editingResponse, isPreview, isManualMode])

  // Initialize default ranking order for ranking fields
  useEffect(() => {
    setAnswers(prev => {
      const next = { ...prev }
      let changed = false
      for (const sec of form.sections || []) {
        for (const f of sec.fields || []) {
          if (f.type === 'ranking' && Array.isArray(f.options) && !Array.isArray(next[f.id])) {
            next[f.id] = [...f.options]
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [form.sections])

  // Aplica identificação do respondente (via Google ou sessão) sem cadastrar usuário no Supabase
  const applyGoogleRespondent = (userData: {
    nome: string
    email: string
    sub?: string
    avatarUrl?: string
  }) => {
    const identifiedUser = {
      id: `google-${userData.sub || Date.now()}`,
      nome: userData.nome,
      email: userData.email,
      cargo: 'Respondente Identificado (Google)',
      perfil: 'Público / Google',
      provider: 'google',
      avatarUrl: userData.avatarUrl || '',
      verified: true,
      sub: userData.sub,
    }

    setSessionUser(identifiedUser)
    setManualNameOverride(false)

    try {
      window.sessionStorage.setItem(`gp_form_google_user_${form.id}`, JSON.stringify(identifiedUser))
      window.localStorage.setItem(`gp_form_google_user_${form.id}`, JSON.stringify(identifiedUser))
    } catch {}

    setAnswers(prev => {
      const next = { ...prev }
      for (const sec of form.sections || []) {
        for (const f of sec.fields || []) {
          if (
            f.type === 'usuario_logado' ||
            f.autoFillUser === 'nome' ||
            /nome completo|seu nome/i.test(f.title)
          ) {
            next[f.id] = identifiedUser.nome
          }
          if (
            (f.autoFillUser === 'email' ||
              (f.type === 'texto_curto' && /e-?mail/i.test(f.title))) &&
            identifiedUser.email
          ) {
            next[f.id] = identifiedUser.email
          }
        }
      }
      return next
    })

    setIsAuthModalOpen(false)
    setAuthSuccessToast(`Identificado via Conta Google: ${identifiedUser.nome}`)
    setTimeout(() => setAuthSuccessToast(''), 4500)
  }

  // 1. Pré-carrega a biblioteca oficial Google Identity Services (GIS) no background
  useEffect(() => {
    loadGoogleGsiScript().catch(() => {})
  }, [])

  // 2. Restaura identificação Google prévia salva no navegador deste formulário
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedGoogle =
        window.sessionStorage?.getItem(`gp_form_google_user_${form.id}`) ||
        window.localStorage?.getItem(`gp_form_google_user_${form.id}`)
      if (savedGoogle) {
        const parsed = JSON.parse(savedGoogle)
        if (parsed?.email && parsed?.provider === 'google') {
          setSessionUser(parsed)
          setAnswers(prev => {
            const next = { ...prev }
            let changed = false
            for (const sec of form.sections || []) {
              for (const f of sec.fields || []) {
                if (
                  (f.type === 'usuario_logado' ||
                    f.autoFillUser === 'nome' ||
                    /nome completo|seu nome/i.test(f.title)) &&
                  !next[f.id]
                ) {
                  next[f.id] = parsed.nome
                  changed = true
                }
                if (
                  (f.autoFillUser === 'email' ||
                    (f.type === 'texto_curto' && /e-?mail/i.test(f.title))) &&
                  !next[f.id] &&
                  parsed.email
                ) {
                  next[f.id] = parsed.email
                  changed = true
                }
              }
            }
            return changed ? next : prev
          })
        }
      }
    } catch {}
  }, [form.id, form.sections])

  // 3. Verifica retorno de token do Google via hash de URL (caso fallback direto tenha sido usado)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const rawHash = window.location.hash || ''
    if (!rawHash) return
    const hashParams = new URLSearchParams(rawHash.startsWith('#') ? rawHash.slice(1) : rawHash)

    const idToken = hashParams.get('id_token')
    const accessToken = hashParams.get('access_token')

    if (idToken || accessToken) {
      try {
        window.history.replaceState(null, '', window.location.pathname)
        window.sessionStorage.removeItem('gp_form_auth_pending')
        window.localStorage.removeItem('gp_form_auth_pending')
        window.sessionStorage.removeItem('gp_form_return_url')
        window.localStorage.removeItem('gp_form_return_url')
      } catch {}

      if (idToken) {
        const payload = decodeGoogleJwt(idToken)
        if (payload?.email) {
          const resolvedName = payload.name || payload.given_name || payload.email.split('@')[0]
          applyGoogleRespondent({
            nome: resolvedName,
            email: payload.email,
            sub: payload.sub,
            avatarUrl: payload.picture,
          })
          return
        }
      }

      if (accessToken) {
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then(r => r.json())
          .then(profile => {
            if (profile?.email) {
              const resolvedName = profile.name || profile.given_name || profile.email.split('@')[0]
              applyGoogleRespondent({
                nome: resolvedName,
                email: profile.email,
                sub: profile.sub,
                avatarUrl: profile.picture,
              })
            }
          })
          .catch(() => {})
        return
      }
    }
  }, [form.sections])

  // 4. Verifica se já existe sessão de colaborador do IMPACTO EDU logado no navegador
  useEffect(() => {
    async function checkImpactoSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user && !sessionUser) {
          const u = session.user
          const meta = u.user_metadata || {}
          const resolvedName =
            meta.full_name || meta.name || meta.nome || u.email?.split('@')[0]
          const isGoogle =
            u.app_metadata?.provider === 'google' ||
            (Array.isArray(u.identities) && u.identities.some((i: any) => i.provider === 'google'))

          const newUser = {
            id: u.id,
            nome: resolvedName,
            email: u.email,
            cargo: meta.cargo || (isGoogle ? 'Conta Google' : 'Colaborador'),
            perfil: meta.perfil || 'Usuário',
            provider: isGoogle ? 'google' : 'impacto_edu',
          }
          setSessionUser(newUser)

          setAnswers(prev => {
            const next = { ...prev }
            let changed = false
            for (const sec of form.sections || []) {
              for (const f of sec.fields || []) {
                if (
                  (f.type === 'usuario_logado' ||
                    f.autoFillUser === 'nome' ||
                    /nome completo|seu nome/i.test(f.title)) &&
                  !next[f.id]
                ) {
                  next[f.id] = resolvedName
                  changed = true
                }
                if (
                  (f.autoFillUser === 'email' ||
                    (f.type === 'texto_curto' && /e-?mail/i.test(f.title))) &&
                  !next[f.id] &&
                  u.email
                ) {
                  next[f.id] = u.email
                  changed = true
                }
              }
            }
            return changed ? next : prev
          })
        }
      } catch (err) {
        console.warn('Erro ao verificar sessão do Supabase no formulário:', err)
      }
    }
    checkImpactoSession()
  }, [form.sections, sessionUser])

  // Login Handler: Identificação direta com a Conta Google (sem cadastrar no Supabase)
  const handleGoogleLogin = async () => {
    setAuthLoading(true)
    setAuthError('')
    try {
      if (isPreview) {
        const simulatedName = 'Usuário Google (Teste)'
        applyGoogleRespondent({
          nome: simulatedName,
          email: 'usuario.google@gmail.com',
          avatarUrl: '',
        })
        setAuthLoading(false)
        return
      }

      // 1. Obtém o Client ID do Google
      let clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
      if (!clientId) {
        try {
          const res = await fetch('/api/auth/google-status', { cache: 'no-store' })
          const data = await res.json()
          if (data?.clientId) clientId = data.clientId
        } catch {}
      }
      if (!clientId) {
        clientId = '805517903971-dage2hg6l432538c9tncgtb37c74jje0.apps.googleusercontent.com'
      }

      // 2. Carrega biblioteca oficial do Google (GIS)
      const googleObj = await loadGoogleGsiScript().catch(() => null)

      if (googleObj?.accounts?.oauth2) {
        const tokenClient = googleObj.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: 'email profile openid',
          prompt: 'select_account',
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.error) {
              setAuthLoading(false)
              if (tokenResponse.error === 'popup_closed_by_user') return
              if (tokenResponse.error === 'access_denied') {
                setAuthError('Autorização da Conta Google cancelada.')
                return
              }
              setAuthError(
                `Não foi possível conectar com o Google (${tokenResponse.error}). Você pode preencher seu nome manualmente.`
              )
              return
            }

            if (tokenResponse?.access_token) {
              try {
                const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                  headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                })
                if (!userRes.ok) throw new Error('Falha ao obter perfil Google')
                const profile = await userRes.json()
                const resolvedName = profile.name || profile.given_name || profile.email?.split('@')[0]
                applyGoogleRespondent({
                  nome: resolvedName,
                  email: profile.email,
                  sub: profile.sub,
                  avatarUrl: profile.picture,
                })
              } catch (fetchErr) {
                console.error('[Google Auth] Erro ao buscar userinfo:', fetchErr)
                setAuthError('Falha ao carregar perfil do Google. Você pode preencher seu nome manualmente.')
              } finally {
                setAuthLoading(false)
              }
            }
          },
        })

        tokenClient.requestAccessToken()
        return
      }

      // 3. Fallback: Redirecionamento direto via OAuth2 do Google (caso GIS popup não esteja disponível)
      try {
        window.sessionStorage.setItem('gp_form_auth_pending', form.id)
        window.localStorage.setItem('gp_form_auth_pending', form.id)
        window.sessionStorage.setItem('gp_form_return_url', window.location.href)
        window.localStorage.setItem('gp_form_return_url', window.location.href)
      } catch {}
      const callbackUrl = `${window.location.origin}/auth/callback`
      const redirectUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        callbackUrl
      )}&response_type=token%20id_token&scope=email%20profile%20openid&nonce=${Date.now()}`
      window.location.href = redirectUrl
    } catch (err: any) {
      console.error('[Google Login Error]:', err)
      setAuthError(err.message || 'Não foi possível conectar com o Google no momento. Preencha seu nome manualmente.')
      setAuthLoading(false)
    }
  }

  const handleImpactoLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!authEmail.trim() || !authPassword.trim()) {
      setAuthError('Informe seu e-mail e sua senha de acesso.')
      return
    }
    setAuthLoading(true)
    setAuthError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
          keepConnected: true,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Credenciais inválidas. Verifique seu e-mail e senha.')
      }

      const data = await res.json()
      const u = data.user
      const meta = u.user_metadata || {}
      const resolvedName = meta.nome || u.email?.split('@')[0]
      const newUser = {
        id: u.id,
        nome: resolvedName,
        email: u.email,
        cargo: meta.cargo || 'Colaborador',
        perfil: meta.perfil || 'Usuário',
        provider: 'impacto_edu',
      }
      setSessionUser(newUser)
      setManualNameOverride(false)

      setAnswers(prev => {
        const next = { ...prev }
        for (const sec of form.sections || []) {
          for (const f of sec.fields || []) {
            if (
              f.type === 'usuario_logado' ||
              f.autoFillUser === 'nome' ||
              /nome completo|seu nome/i.test(f.title)
            ) {
              next[f.id] = resolvedName
            }
            if (
              (f.autoFillUser === 'email' ||
                (f.type === 'texto_curto' && /e-?mail/i.test(f.title))) &&
              u.email
            ) {
              next[f.id] = u.email
            }
            if (f.autoFillUser === 'cargo' && meta.cargo) {
              next[f.id] = meta.cargo
            }
          }
        }
        return next
      })

      setIsAuthModalOpen(false)
      setAuthSuccessToast(`Identificado com sucesso como ${resolvedName}!`)
      setTimeout(() => setAuthSuccessToast(''), 3500)
    } catch (err: any) {
      setAuthError(err.message || 'Erro ao realizar login no sistema.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleClearUser = () => {
    setSessionUser(null)
    setManualNameOverride(true)
    try {
      window.sessionStorage.removeItem(`gp_form_google_user_${form.id}`)
      window.localStorage.removeItem(`gp_form_google_user_${form.id}`)
      window.sessionStorage.removeItem('gp_form_auth_pending')
      window.localStorage.removeItem('gp_form_auth_pending')
      window.sessionStorage.removeItem('gp_form_return_url')
      window.localStorage.removeItem('gp_form_return_url')
    } catch {}
    setAnswers(prev => {
      const next = { ...prev }
      for (const sec of form.sections || []) {
        for (const f of sec.fields || []) {
          if (f.type === 'usuario_logado' || f.autoFillUser === 'nome') {
            next[f.id] = ''
          }
        }
      }
      return next
    })
    setIsAuthModalOpen(false)
    setAuthSuccessToast(
      'Identificação desvinculada. Agora você pode digitar um nome manualmente ou entrar com outra conta.'
    )
    setTimeout(() => setAuthSuccessToast(''), 4000)
  }

  // Auto-fill fields configured for logged-in user or manual respondent
  useEffect(() => {
    if (manualNameOverride) return
    const activeUserName = isManualMode
      ? manualName
      : effectiveUser?.nome || (isPreview ? 'Ivan Rossi' : '')
    const activeUserEmail = isManualMode
      ? manualEmail
      : effectiveUser?.email || (isPreview ? 'ivan.rossi@impactoedu.com.br' : '')
    const activeUserRole = isManualMode
      ? manualRole
      : effectiveUser?.cargo || (isPreview ? 'Administrador Master' : '')
    const activeUserDept = isManualMode
      ? manualDept
      : effectiveUser?.departamento || (isPreview ? 'Tecnologia / Gestão' : '')

    if (!activeUserName && !activeUserEmail) return

    setAnswers(prev => {
      let changed = false
      const next = { ...prev }

      for (const sec of form.sections || []) {
        for (const f of sec.fields || []) {
          if (f.type === 'usuario_logado' || f.autoFillUser) {
            const fillType = f.autoFillUser || 'nome'
            let valToFill = activeUserName
            if (fillType === 'email') valToFill = activeUserEmail
            else if (fillType === 'cargo') valToFill = activeUserRole
            else if (fillType === 'departamento') valToFill = activeUserDept

            if (valToFill && next[f.id] !== valToFill) {
              next[f.id] = valToFill
              changed = true
            }
          }
        }
      }

      return changed ? next : prev
    })
  }, [effectiveUser, isManualMode, manualName, manualEmail, manualRole, manualDept, form.sections, isPreview, manualNameOverride])

  // Auto-save draft on change
  useEffect(() => {
    if (editingResponse || isPreview || isManualMode) return
    const timer = setTimeout(() => {
      try {
        if (Object.keys(answers).length > 0) {
          localStorage.setItem(draftStorageKey, JSON.stringify(answers))
          setDraftSavedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
        }
      } catch {}
    }, 800)
    return () => clearTimeout(timer)
  }, [answers, draftStorageKey, editingResponse, isPreview, isManualMode])

  const primaryColor = form.theme?.primaryColor || '#4f46e5'
  const accentColor = form.theme?.accentColor || '#eef2ff'
  const fontFamily =
    form.theme?.fontFamily === 'editorial'
      ? "'Georgia', serif"
      : form.theme?.fontFamily === 'technical'
      ? "'JetBrains Mono', monospace"
      : "'Inter', sans-serif"

  // Flatten visible interactive fields for progress calculation and Focus Mode
  const allVisibleInteractiveFields = useMemo(() => {
    const list: { field: FormField; sectionTitle: string; globalIndex: number }[] = []
    let counter = 1
    for (const sec of form.sections || []) {
      for (const f of sec.fields || []) {
        if (!evaluateConditionalRule(f, answers)) continue
        if (f.type !== 'bloco_informativo' && f.type !== 'bloco_imagem') {
          list.push({ field: f, sectionTitle: sec.title, globalIndex: counter++ })
        }
      }
    }
    return list
  }, [form.sections, answers])

  const answeredCount = useMemo(() => {
    let count = 0
    for (const item of allVisibleInteractiveFields) {
      const f = item.field
      const val = answers[f.id]
      if (f.type === 'grade_multipla' || f.type === 'grade_caixas') {
        const rows = f.gridRows || []
        if (
          val &&
          typeof val === 'object' &&
          rows.every(r =>
            Array.isArray(val[r]) ? val[r].length > 0 : Boolean(val[r])
          )
        ) {
          count++
        }
      } else if (Array.isArray(val)) {
        if (val.length > 0) count++
      } else if (val !== undefined && val !== null && String(val).trim() !== '') {
        count++
      }
    }
    return count
  }, [allVisibleInteractiveFields, answers])

  const progressPercent =
    allVisibleInteractiveFields.length > 0
      ? Math.round((answeredCount / allVisibleInteractiveFields.length) * 100)
      : 100

  const validateSingleField = (field: FormField, currentAnswers: Record<string, any>): string => {
    if (!evaluateConditionalRule(field, currentAnswers)) return ''
    if (field.type === 'bloco_informativo' || field.type === 'bloco_imagem') return ''

    const val = currentAnswers[field.id]
    const isEmpty =
      val === undefined ||
      val === null ||
      (typeof val === 'string' && val.trim() === '') ||
      (Array.isArray(val) && val.length === 0)

    if (field.type === 'grade_multipla' || field.type === 'grade_caixas') {
      const rows = field.gridRows || []
      if (field.required) {
        const missingRow = rows.find(r => {
          const rVal = val?.[r]
          return Array.isArray(rVal) ? rVal.length === 0 : !rVal
        })
        if (missingRow) {
          return `Responda todas as linhas (pendente: "${missingRow}").`
        }
      }
      return ''
    }

    if (field.required && isEmpty) {
      return field.validation?.customErrorText || 'Este campo é obrigatório.'
    }

    if (isEmpty) return ''

    // Check "Outro" text if __other__ selected
    if (field.allowOther) {
      const hasOther =
        val === '__other__' || (Array.isArray(val) && val.includes('__other__'))
      if (hasOther && !String(currentAnswers[`${field.id}__other`] || '').trim()) {
        return 'Por favor, especifique sua resposta na opção "Outro".'
      }
    }

    const v = field.validation
    if (!v) return ''

    const strVal = String(val).trim()
    if (v.minLength && strVal.length < v.minLength) {
      return `Mínimo de ${v.minLength} caracteres (atual: ${strVal.length}).`
    }
    if (v.maxLength && strVal.length > v.maxLength) {
      return `Máximo de ${v.maxLength} caracteres.`
    }
    if (v.minValue !== undefined && Number(val) < v.minValue) {
      return `O valor mínimo permitido é ${v.minValue}.`
    }
    if (v.maxValue !== undefined && Number(val) > v.maxValue) {
      return `O valor máximo permitido é ${v.maxValue}.`
    }
    if (Array.isArray(val)) {
      if (v.minSelect && val.length < v.minSelect) {
        return `Selecione pelo menos ${v.minSelect} opções.`
      }
      if (v.maxSelect && val.length > v.maxSelect) {
        return `Selecione no máximo ${v.maxSelect} opções.`
      }
    }

    if (v.regexType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal)) {
      return v.customErrorText || 'Informe um endereço de e-mail válido.'
    }
    if (v.regexType === 'cpf') {
      const digits = strVal.replace(/\D/g, '')
      if (digits.length !== 11) {
        return v.customErrorText || 'Informe um CPF válido com 11 dígitos.'
      }
    }
    if (v.regexType === 'telefone') {
      const digits = strVal.replace(/\D/g, '')
      if (digits.length < 10 || digits.length > 11) {
        return v.customErrorText || 'Informe um telefone válido com DDD.'
      }
    }
    if (v.regexType === 'url') {
      try {
        new URL(strVal)
      } catch {
        return v.customErrorText || 'Informe uma URL válida (ex: https://...).'
      }
    }

    return ''
  }

  // Validate on blur (as required by modern-web-guidance: "Validate on blur (if edited) to avoid premature warnings while typing, and reset error states on input")
  const handleFieldBlur = (field: FormField) => {
    if (!touchedFields[field.id]) return
    const err = validateSingleField(field, answers)
    setFieldErrors(prev => ({ ...prev, [field.id]: err }))
  }

  const updateAnswer = (field: FormField, value: any) => {
    const nextAnswers = { ...answers, [field.id]: value }
    setAnswers(nextAnswers)
    setTouchedFields(prev => ({ ...prev, [field.id]: true }))
    // Clear error immediately on input when fixed
    if (fieldErrors[field.id]) {
      const recheck = validateSingleField(field, nextAnswers)
      if (!recheck) {
        setFieldErrors(prev => {
          const copy = { ...prev }
          delete copy[field.id]
          return copy
        })
      }
    }
  }

  const handleSelectColaborador = (colabId: string) => {
    setSelectedColabId(colabId)
    const found = colaboradoresList.find(c => c.id === colabId)
    if (found) {
      setManualName(found.nome || '')
      setManualEmail(found.email || '')
      setManualRole(found.cargo || 'Colaborador')
      setManualDept(found.departamento || '')
      setManualUnit(found.unidade || '')
    }
  }

  const validateAllVisible = (targetFields?: FormField[]): boolean => {
    const fieldsToCheck =
      targetFields || allVisibleInteractiveFields.map(item => item.field)
    const newErrors: Record<string, string> = {}
    let firstInvalidId: string | null = null

    for (const f of fieldsToCheck) {
      const err = validateSingleField(f, answers)
      if (err) {
        newErrors[f.id] = err
        if (!firstInvalidId) firstInvalidId = f.id
      }
    }

    setFieldErrors(prev => ({ ...prev, ...newErrors }))

    if (firstInvalidId) {
      const el = document.getElementById(`gp-field-card-${firstInvalidId}`)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return false
    }
    return true
  }

  const submitForm = async (addAnother = false) => {
    setSubmitError('')

    if (!validateAllVisible()) {
      setSubmitError('Por favor, revise os campos destacados antes de enviar.')
      return
    }

    if (isManualMode && !manualName.trim()) {
      setSubmitError('Informe ou selecione o nome do colaborador para o lançamento manual.')
      return
    }

    if (!effectiveUser && !isManualMode && !isPreview && !isPublicForm) {
      if (!loginEmail.trim() || !loginPassword.trim()) {
        setSubmitError('Informe seu e-mail e senha corporativos para confirmar o envio.')
        return
      }
    }

    if (isPreview) {
      const fakeResp: GPFormResponse = {
        id: `preview-${Date.now()}`,
        formId: form.id,
        protocol: 'PREVIEW-2026-0001',
        respondentId: effectiveUser?.id || 'preview',
        respondentName: isManualMode
          ? manualName || 'Colaborador Teste'
          : effectiveUser?.nome || 'Colaborador Visualização',
        respondentRole: isManualMode
          ? manualRole || 'Colaborador'
          : effectiveUser?.cargo || 'Colaborador',
        source: isManualMode ? 'inserido_pelo_gestor' : 'colaborador_logado',
        answers,
        submittedAt: new Date().toISOString(),
      }
      setSubmittedResponse(fakeResp)
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return
    }

    setIsSubmitting(true)
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000))

    try {
      const targetEditResp = editingResponse || editingSelfResponse
      const isEditingExisting = Boolean(targetEditResp?.id)
      const url = `/api/gestao-pessoas/formularios/${form.id}/respostas`
      const method = isEditingExisting ? 'PUT' : 'POST'

      const payload = isEditingExisting
        ? {
            responseId: targetEditResp!.id,
            answers,
            respondentName: isManualMode ? manualName : targetEditResp!.respondentName,
            respondentRole: isManualMode ? manualRole : targetEditResp!.respondentRole,
            respondentDepartment: isManualMode ? manualDept : targetEditResp!.respondentDepartment,
            respondentUnit: isManualMode ? manualUnit : targetEditResp!.respondentUnit,
            adminNotes: isManualMode ? manualNotes : targetEditResp!.adminNotes,
          }
        : {
            mode: isManualMode ? 'manual_admin' : 'collaborator',
            answers,
            completionTimeSeconds: elapsedSeconds,
            respondentName: effectiveUser?.nome || undefined,
            respondentEmail: effectiveUser?.email || undefined,
            googleRespondent:
              effectiveUser?.provider === 'google'
                ? {
                    id: effectiveUser.id,
                    name: effectiveUser.nome,
                    email: effectiveUser.email,
                    avatarUrl: (effectiveUser as any).avatarUrl,
                    sub: (effectiveUser as any).sub,
                  }
                : undefined,
            email: !effectiveUser && !isManualMode && !isPublicForm ? loginEmail : undefined,
            password: !effectiveUser && !isManualMode && !isPublicForm ? loginPassword : undefined,
            manualRespondent: isManualMode
              ? {
                  id: selectedColabId || undefined,
                  name: manualName,
                  email: manualEmail,
                  role: manualRole,
                  department: manualDept,
                  unit: manualUnit,
                  submittedAt: manualDate ? new Date(manualDate).toISOString() : undefined,
                  notes: manualNotes,
                }
              : undefined,
          }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error || 'Não foi possível registrar a resposta.')
        setIsSubmitting(false)
        return
      }

      // Clear draft
      try {
        localStorage.removeItem(draftStorageKey)
      } catch {}

      // Save completed response to localStorage for return visits
      try {
        localStorage.setItem(`gp_form_completed_${form.id}`, JSON.stringify(data))
      } catch {}

      if (addAnother && isManualMode) {
        // Reset for quick next entry
        setAnswers({})
        setSelectedColabId('')
        setManualName('')
        setManualEmail('')
        setManualRole('')
        setManualDept('')
        setManualUnit('')
        setManualNotes('')
        startTimeRef.current = Date.now()
        if (onSubmitSuccess) onSubmitSuccess(data, true)
      } else {
        const wasEditingSelf = Boolean(editingSelfResponse)
        setSubmittedResponse(data)
        setEditingSelfResponse(null)
        setIsJustUpdated(wasEditingSelf)
        setIsReturningRespondent(false)
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
        if (onSubmitSuccess) onSubmitSuccess(data, false)
      }
    } catch (err: any) {
      setSubmitError('Erro de conexão ao enviar respostas. Tente novamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const moveRankingItem = (field: FormField, index: number, direction: 'up' | 'down') => {
    const currentList: string[] = Array.isArray(answers[field.id])
      ? [...answers[field.id]]
      : [...(field.options || [])]
    const targetIdx = direction === 'up' ? index - 1 : index + 1
    if (targetIdx < 0 || targetIdx >= currentList.length) return
    const temp = currentList[index]
    currentList[index] = currentList[targetIdx]
    currentList[targetIdx] = temp
    updateAnswer(field, currentList)
  }

  const filteredColaboradores = useMemo(() => {
    if (!colabSearch.trim()) return colaboradoresList.slice(0, 60)
    const q = colabSearch.toLowerCase()
    return colaboradoresList
      .filter(
        c =>
          c.nome?.toLowerCase().includes(q) ||
          c.cargo?.toLowerCase().includes(q) ||
          c.departamento?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q)
      )
      .slice(0, 40)
  }, [colaboradoresList, colabSearch])

  // ---------------------------------------------------------------------------
  // CONFIRMATION / RECEIPT VIEW AFTER SUBMISSION
  // ---------------------------------------------------------------------------
  if (submittedResponse) {
    const isEditAllowed = form.settings?.allowEditOwnResponse !== false

    const headerBadgeText = isJustUpdated
      ? '✓ Resposta Atualizada com Sucesso'
      : isReturningRespondent
      ? '✓ Você já respondeu a este formulário'
      : '✓ Formulário Concluído com Sucesso'

    const headerTitleText = isJustUpdated
      ? 'Alterações salvas com sucesso!'
      : isReturningRespondent
      ? 'Você já respondeu a este formulário'
      : form.settings?.confirmationTitle || 'Muito obrigado pela sua participação!'

    const headerMessageText = isJustUpdated
      ? 'Suas novas respostas foram gravadas e atualizadas no sistema.'
      : isReturningRespondent
      ? `Identificamos que você já enviou suas respostas para este formulário em ${new Date(submittedResponse.submittedAt).toLocaleString('pt-BR')}.`
      : form.settings?.confirmationMessage || 'Sua resposta foi registrada e finalizada no sistema. Agradecemos sua colaboração!'

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          maxWidth: 720,
          margin: '24px auto',
          background: '#ffffff',
          borderRadius: 28,
          border: '1px solid #e2e8f0',
          boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
          overflow: 'hidden',
          fontFamily,
        }}
      >
        {/* Top Celebration / Thank You Header */}
        <div
          style={{
            background: form.theme?.headerGradient || primaryColor,
            padding: '40px 32px 36px',
            color: '#ffffff',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          {/* Status Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 18px',
              borderRadius: 99,
              background: 'rgba(255, 255, 255, 0.22)',
              backdropFilter: 'blur(10px)',
              fontSize: 12.5,
              fontWeight: 800,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: '#ffffff',
              marginBottom: 18,
              boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
              border: '1px solid rgba(255, 255, 255, 0.35)',
            }}
          >
            <CheckCircle2 size={16} /> {headerBadgeText}
          </div>

          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              border: '2px solid rgba(255,255,255,0.4)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            }}
          >
            <CheckCircle2 size={46} color="#ffffff" />
          </div>

          <h2 style={{ margin: 0, fontSize: 27, fontWeight: 900, lineHeight: 1.25 }}>
            {headerTitleText}
          </h2>

          <p style={{ margin: '12px auto 0', maxWidth: 540, fontSize: 15.5, opacity: 0.95, lineHeight: 1.55 }}>
            {headerMessageText}
          </p>
        </div>

        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Reassurance Notice Box */}
          <div
            style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: 18,
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: '#10b981',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileCheck2 size={22} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#065f46' }}>
                {isReturningRespondent ? 'Formulário Já Concluído' : 'Conclusão Confirmada · Nenhuma ação adicional é necessária'}
              </div>
              <div style={{ fontSize: 13.5, color: '#047857', marginTop: 4, lineHeight: 1.5 }}>
                {isReturningRespondent
                  ? `Identificamos que você já enviou sua resposta anteriormente em ${new Date(submittedResponse.submittedAt).toLocaleString('pt-BR')}. Seus dados estão salvos com segurança. Você pode editar suas respostas clicando no botão abaixo.`
                  : 'Todas as suas respostas foram computadas e gravadas com sucesso no banco de dados da instituição. Seu comprovante digital oficial foi gerado abaixo.'}
              </div>
            </div>
          </div>

          {/* Destaque de Edição: Botão grande para Editar Respostas */}
          {isEditAllowed && (
            <div
              style={{
                background: '#eff6ff',
                border: '2px dashed #60a5fa',
                borderRadius: 18,
                padding: '20px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Edit3 size={18} color="#2563eb" /> Deseja alterar suas respostas?
                </div>
                <div style={{ fontSize: 13, color: '#1e3a8a', marginTop: 4 }}>
                  Você pode revisar os campos e salvar novas respostas a qualquer momento.
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartEditing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 24px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(37, 99, 235, 0.28)',
                }}
              >
                <Edit3 size={16} /> Editar Minhas Respostas
              </button>
            </div>
          )}

          {/* Protocol & Authentication Receipt */}
          <div
            style={{
              background: '#f8fafc',
              borderRadius: 18,
              padding: 22,
              border: '1px solid #e2e8f0',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Protocolo Oficial
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 800, color: primaryColor }}>
                  #{submittedResponse.protocol}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof navigator !== 'undefined' && navigator.clipboard) {
                      navigator.clipboard.writeText(submittedResponse.protocol)
                      setCopiedProtocol(true)
                      setTimeout(() => setCopiedProtocol(false), 2500)
                    }
                  }}
                  title="Copiar protocolo"
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: copiedProtocol ? '#059669' : '#475569',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  {copiedProtocol ? (
                    <>
                      <Check size={12} /> Copiado!
                    </>
                  ) : (
                    <>
                      <Copy size={12} /> Copiar
                    </>
                  )}
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Colaborador
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginTop: 4 }}>
                {submittedResponse.respondentName}
              </div>
              {submittedResponse.respondentEmail && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {submittedResponse.respondentEmail}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Cargo / Origem
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 4 }}>
                {submittedResponse.respondentRole || 'Colaborador'} •{' '}
                {submittedResponse.source === 'inserido_pelo_gestor'
                  ? 'Lançamento Gestor'
                  : 'Autenticado'}
              </div>
              {submittedResponse.respondentDepartment && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                  {submittedResponse.respondentDepartment}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                Data e Horário
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginTop: 4 }}>
                {new Date(submittedResponse.submittedAt).toLocaleString('pt-BR')}
              </div>
            </div>
          </div>

          {/* Quiz Score Card if Quiz Mode is active */}
          {form.settings?.isQuizMode &&
            form.settings?.showScoreAtEnd &&
            submittedResponse.quizScore && (
              <div
                style={{
                  padding: 24,
                  borderRadius: 20,
                  background: submittedResponse.quizScore.passed ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${submittedResponse.quizScore.passed ? '#a7f3d0' : '#fecaca'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 16,
                }}
              >
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 800,
                      background: submittedResponse.quizScore.passed ? '#10b981' : '#ef4444',
                      color: '#fff',
                      marginBottom: 8,
                    }}
                  >
                    {submittedResponse.quizScore.passed ? 'APROVADO NO TESTE' : 'ABAIXO DA MÉDIA'}
                  </span>
                  <h4 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                    Resultado da Avaliação: {submittedResponse.quizScore.earned} de{' '}
                    {submittedResponse.quizScore.total} pontos
                  </h4>
                </div>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 900,
                    color: submittedResponse.quizScore.passed ? '#059669' : '#dc2626',
                  }}
                >
                  {submittedResponse.quizScore.percent}%
                </div>
              </div>
            )}

          {/* Collapsible Submitted Answers Summary */}
          {submittedResponse.answers && Object.keys(submittedResponse.answers).length > 0 && (
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 16, overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setShowAnswersSummary(prev => !prev)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 20px',
                  background: '#f8fafc',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: '#334155',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={16} color={primaryColor} />
                  Ver resumo das respostas enviadas ({Object.keys(submittedResponse.answers).length} campos preenchidos)
                </span>
                {showAnswersSummary ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showAnswersSummary && (
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, background: '#ffffff' }}>
                  {(form.sections || []).flatMap(s => s.fields || []).filter(f => f.type !== 'bloco_informativo' && f.type !== 'bloco_imagem').map((field, idx) => {
                    const ans = submittedResponse.answers[field.id]
                    if (ans === undefined || ans === null || ans === '') return null
                    let displayAns = ''
                    if (Array.isArray(ans)) {
                      displayAns = ans.join(', ')
                    } else if (typeof ans === 'object') {
                      displayAns = JSON.stringify(ans)
                    } else if (typeof ans === 'boolean') {
                      displayAns = ans ? 'Sim' : 'Não'
                    } else {
                      displayAns = String(ans)
                    }

                    return (
                      <div key={field.id} style={{ paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                          {idx + 1}. {field.title}
                        </div>
                        <div style={{ fontSize: 13.5, color: '#475569', marginTop: 4, fontWeight: 500 }}>
                          {displayAns}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center', marginTop: 4 }}>
            <button
              type="button"
              onClick={() => window.print()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 20px',
                borderRadius: 12,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Printer size={17} /> Imprimir Comprovante
            </button>

            {isEditAllowed && (
              <button
                type="button"
                onClick={handleStartEditing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 22px',
                  borderRadius: 12,
                  border: '1px solid #2563eb',
                  background: '#eff6ff',
                  color: '#2563eb',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <Edit3 size={17} /> Editar Minhas Respostas
              </button>
            )}

            {(form.settings?.allowMultipleResponses || isAdmin) && (
              <button
                type="button"
                onClick={handleSendAnotherResponse}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 22px',
                  borderRadius: 12,
                  border: 'none',
                  background: primaryColor,
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Plus size={17} /> Enviar Outra Resposta
              </button>
            )}

            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 22px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#0f172a',
                  color: '#ffffff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Voltar à Central de Formulários
              </button>
            )}
          </div>
        </div>
      </motion.div>
    )
  }

  // ---------------------------------------------------------------------------
  // RENDER SINGLE FIELD CARD
  // ---------------------------------------------------------------------------
  const renderFieldControl = (field: FormField, questionNum?: number) => {
    const val = answers[field.id]
    const errorMsg = fieldErrors[field.id]
    const errorId = `err-${field.id}`
    const descId = `desc-${field.id}`
    const inputId = `input-${field.id}`

    if (field.type === 'bloco_informativo' || field.type === 'bloco_imagem') {
      return (
        <div
          key={field.id}
          id={`gp-field-card-${field.id}`}
          style={{
            gridColumn: field.width === '50%' ? 'span 1' : '1 / -1',
            background: field.type === 'bloco_imagem' ? '#ffffff' : accentColor,
            borderLeft: `5px solid ${primaryColor}`,
            border: field.type === 'bloco_imagem' ? '1px solid #e2e8f0' : undefined,
            borderRadius: 16,
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minWidth: 0 }}>
            {field.type === 'bloco_imagem' ? (
              <ImageIcon size={20} color={primaryColor} style={{ flexShrink: 0 }} />
            ) : (
              <Info size={20} color={primaryColor} style={{ flexShrink: 0 }} />
            )}
            <h4
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 800,
                color: '#0f172a',
                flex: 1,
                minWidth: 0,
                lineHeight: 1.35,
                wordBreak: 'normal',
                overflowWrap: 'break-word',
              }}
            >
              {field.title}
            </h4>
          </div>
          <RenderMediaCollection media={field.media} filterPosition="above" />
          {field.description && (
            <FormRichTextRenderer
              content={field.description}
              primaryColor={primaryColor}
              style={{
                fontSize: 14,
                color: '#475569',
                lineHeight: 1.65,
              }}
            />
          )}
          <RenderMediaCollection media={field.media} filterPosition="below" />
        </div>
      )
    }

    const cardBorder = errorMsg
      ? '2px solid #ef4444'
      : form.theme?.cardStyle === 'bordered'
      ? '1px solid #cbd5e1'
      : '1px solid #e2e8f0'

    const isChoiceGroup =
      field.type === 'multipla_escolha' ||
      field.type === 'caixas_selecao' ||
      field.type === 'sim_nao' ||
      field.type === 'escala_linear' ||
      field.type === 'nps' ||
      field.type === 'avaliacao_estrelas' ||
      field.type === 'termometro_humor'

    const fieldTitleId = `gp-field-title-${field.id}`
    const labelContent = (
      <div
        style={{
          width: '100%',
          minWidth: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
        }}
      >
        <span
          style={{
            display: 'block',
            flex: 1,
            minWidth: 0,
            width: '100%',
            fontSize: 16,
            fontWeight: 700,
            color: '#0f172a',
            lineHeight: 1.45,
            wordBreak: 'normal',
            overflowWrap: 'break-word',
          }}
        >
          {form.theme?.showQuestionNumbers && questionNum !== undefined && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 26,
                height: 26,
                padding: '0 8px',
                borderRadius: 8,
                background: accentColor,
                color: primaryColor,
                fontSize: 13,
                fontWeight: 800,
                marginRight: 10,
                flexShrink: 0,
                verticalAlign: 'middle',
              }}
            >
              {questionNum}
            </span>
          )}
          <span style={{ verticalAlign: 'middle' }}>{String(field.title || '').trimEnd()}</span>
          {field.required && (
            <span
              aria-hidden="true"
              style={{
                color: '#ef4444',
                marginLeft: 5,
                fontWeight: 800,
                display: 'inline-block',
                whiteSpace: 'nowrap',
                verticalAlign: 'middle',
              }}
            >
              *
            </span>
          )}
        </span>
        {form.settings?.isQuizMode && field.quizPoints ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 99,
              background: '#f1f5f9',
              color: '#475569',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {field.quizPoints} pts
          </span>
        ) : null}
      </div>
    )

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        key={field.id}
        id={`gp-field-card-${field.id}`}
        style={{
          gridColumn: field.width === '50%' ? 'span 1' : '1 / -1',
          background:
            form.theme?.cardStyle === 'glass'
              ? 'rgba(255,255,255,0.88)'
              : '#ffffff',
          backdropFilter: form.theme?.cardStyle === 'glass' ? 'blur(16px)' : undefined,
          borderRadius: 20,
          border: cardBorder,
          borderTop:
            form.theme?.cardStyle === 'classic_top_bar'
              ? `4px solid ${errorMsg ? '#ef4444' : primaryColor}`
              : cardBorder,
          padding: form.theme?.density === 'compact' ? '20px 22px' : '26px 28px',
          boxShadow:
            form.theme?.cardStyle === 'bordered'
              ? 'none'
              : '0 4px 20px rgba(15, 23, 42, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          transition: 'border-color 0.2s, box-shadow 0.2s',
          width: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
        }}
      >
        {isChoiceGroup ? (
          <div
            role="group"
            aria-labelledby={fieldTitleId}
            style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', minWidth: 0 }}
          >
            <div id={fieldTitleId} style={{ width: '100%', minWidth: 0 }}>
              {labelContent}
            </div>
            <RenderMediaCollection media={field.media} filterPosition="above" />
            {field.description && (
              <FormRichTextRenderer
                id={descId}
                content={field.description}
                primaryColor={primaryColor}
                style={{
                  fontSize: 13.5,
                  color: '#64748b',
                  marginBottom: 14,
                  lineHeight: 1.55,
                }}
              />
            )}
            <RenderMediaCollection media={field.media} filterPosition="below" />

            {/* MULTIPLA ESCOLHA (RADIO) */}
            {field.type === 'multipla_escolha' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(field.options || []).map((opt, idx) => {
                  const optId = `${inputId}-opt-${idx}`
                  const isChecked = val === opt
                  const optImg = field.optionImages?.[idx]
                  return (
                    <div
                      key={optId}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        padding: '12px 16px',
                        borderRadius: 14,
                        border: isChecked ? `2px solid ${primaryColor}` : '1px solid #e2e8f0',
                        background: isChecked ? accentColor : '#f8fafc',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input
                          type="radio"
                          id={optId}
                          name={field.id}
                          value={opt}
                          checked={isChecked}
                          required={field.required && idx === 0 && !val}
                          onChange={() => updateAnswer(field, opt)}
                          style={{
                            width: 20,
                            height: 20,
                            accentColor: primaryColor,
                            cursor: 'pointer',
                            margin: 0,
                          }}
                        />
                        <label
                          htmlFor={optId}
                          style={{
                            flex: 1,
                            fontSize: 15,
                            fontWeight: isChecked ? 700 : 500,
                            color: '#1e293b',
                            cursor: 'pointer',
                          }}
                        >
                          {opt}
                        </label>
                      </div>
                      {optImg && (
                        <label htmlFor={optId} style={{ cursor: 'pointer', marginLeft: 32 }}>
                          <img
                            src={optImg}
                            alt={opt}
                            loading="lazy"
                            decoding="async"
                            style={{
                              maxHeight: 180,
                              maxWidth: '100%',
                              borderRadius: 10,
                              objectFit: 'contain',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              display: 'block',
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )
                })}

                {field.allowOther && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 16px',
                      borderRadius: 14,
                      border: val === '__other__' ? `2px solid ${primaryColor}` : '1px solid #e2e8f0',
                      background: val === '__other__' ? accentColor : '#f8fafc',
                    }}
                  >
                    <input
                      type="radio"
                      id={`${inputId}-other`}
                      name={field.id}
                      value="__other__"
                      checked={val === '__other__'}
                      onChange={() => updateAnswer(field, '__other__')}
                      style={{ width: 20, height: 20, accentColor: primaryColor, cursor: 'pointer' }}
                    />
                    <label
                      htmlFor={`${inputId}-other`}
                      style={{ fontSize: 14, fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                    >
                      Outro:
                    </label>
                    <input
                      type="text"
                      aria-label="Especificar outro"
                      placeholder="Especifique sua resposta..."
                      value={answers[`${field.id}__other`] || ''}
                      onFocus={() => updateAnswer(field, '__other__')}
                      onChange={e =>
                        setAnswers(prev => ({
                          ...prev,
                          [field.id]: '__other__',
                          [`${field.id}__other`]: e.target.value,
                        }))
                      }
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        background: '#ffffff',
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* CAIXAS DE SELEÇÃO (CHECKBOXES) */}
            {field.type === 'caixas_selecao' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(field.options || []).map((opt, idx) => {
                  const optId = `${inputId}-chk-${idx}`
                  const selectedArr: string[] = Array.isArray(val) ? val : []
                  const isChecked = selectedArr.includes(opt)
                  const optImg = field.optionImages?.[idx]
                  return (
                    <div
                      key={optId}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                        padding: '12px 16px',
                        borderRadius: 14,
                        border: isChecked ? `2px solid ${primaryColor}` : '1px solid #e2e8f0',
                        background: isChecked ? accentColor : '#f8fafc',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <input
                          type="checkbox"
                          id={optId}
                          name={`${field.id}[]`}
                          value={opt}
                          checked={isChecked}
                          onChange={() => {
                            const next = isChecked
                              ? selectedArr.filter(item => item !== opt)
                              : [...selectedArr, opt]
                            updateAnswer(field, next)
                          }}
                          style={{
                            width: 20,
                            height: 20,
                            accentColor: primaryColor,
                            cursor: 'pointer',
                            margin: 0,
                          }}
                        />
                        <label
                          htmlFor={optId}
                          style={{
                            flex: 1,
                            fontSize: 15,
                            fontWeight: isChecked ? 700 : 500,
                            color: '#1e293b',
                            cursor: 'pointer',
                          }}
                        >
                          {opt}
                        </label>
                      </div>
                      {optImg && (
                        <label htmlFor={optId} style={{ cursor: 'pointer', marginLeft: 32 }}>
                          <img
                            src={optImg}
                            alt={opt}
                            loading="lazy"
                            decoding="async"
                            style={{
                              maxHeight: 180,
                              maxWidth: '100%',
                              borderRadius: 10,
                              objectFit: 'contain',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              display: 'block',
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )
                })}

                {field.allowOther && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 16px',
                      borderRadius: 14,
                      border:
                        Array.isArray(val) && val.includes('__other__')
                          ? `2px solid ${primaryColor}`
                          : '1px solid #e2e8f0',
                      background:
                        Array.isArray(val) && val.includes('__other__') ? accentColor : '#f8fafc',
                    }}
                  >
                    <input
                      type="checkbox"
                      id={`${inputId}-chk-other`}
                      name={`${field.id}[]`}
                      value="__other__"
                      checked={Array.isArray(val) && val.includes('__other__')}
                      onChange={e => {
                        const selectedArr: string[] = Array.isArray(val) ? val : []
                        const next = e.target.checked
                          ? [...selectedArr, '__other__']
                          : selectedArr.filter(x => x !== '__other__')
                        updateAnswer(field, next)
                      }}
                      style={{ width: 20, height: 20, accentColor: primaryColor, cursor: 'pointer' }}
                    />
                    <label
                      htmlFor={`${inputId}-chk-other`}
                      style={{ fontSize: 14, fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                    >
                      Outro:
                    </label>
                    <input
                      type="text"
                      aria-label="Especificar outra opção"
                      placeholder="Especifique..."
                      value={answers[`${field.id}__other`] || ''}
                      onChange={e => {
                        const selectedArr: string[] = Array.isArray(val) ? val : []
                        const next = selectedArr.includes('__other__')
                          ? selectedArr
                          : [...selectedArr, '__other__']
                        setAnswers(prev => ({
                          ...prev,
                          [field.id]: next,
                          [`${field.id}__other`]: e.target.value,
                        }))
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid #cbd5e1',
                        fontSize: 14,
                        background: '#ffffff',
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* SIM / NÃO */}
            {field.type === 'sim_nao' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {['Sim', 'Não'].map(opt => {
                  const isSelected = val === opt
                  const activeColor = opt === 'Sim' ? '#10b981' : '#ef4444'
                  const activeBg = opt === 'Sim' ? '#ecfdf5' : '#fef2f2'
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => updateAnswer(field, opt)}
                      aria-pressed={isSelected}
                      style={{
                        padding: '14px 20px',
                        borderRadius: 14,
                        border: isSelected ? `2px solid ${activeColor}` : '1px solid #cbd5e1',
                        background: isSelected ? activeBg : '#f8fafc',
                        color: isSelected ? activeColor : '#334155',
                        fontSize: 15,
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {opt === 'Sim' ? '👍 Sim' : '👎 Não'}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ESCALA LINEAR */}
            {field.type === 'escala_linear' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Array.from(
                    {
                      length:
                        (field.scaleMax ?? 5) - (field.scaleMin ?? 1) + 1,
                    },
                    (_, i) => (field.scaleMin ?? 1) + i
                  ).map(num => {
                    const isSelected = Number(val) === num && val !== undefined && val !== ''
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => updateAnswer(field, num)}
                        aria-pressed={isSelected}
                        style={{
                          flex: '1 1 46px',
                          minHeight: 48,
                          borderRadius: 12,
                          border: isSelected ? `2px solid ${primaryColor}` : '1px solid #cbd5e1',
                          background: isSelected ? primaryColor : '#f8fafc',
                          color: isSelected ? '#ffffff' : '#1e293b',
                          fontSize: 16,
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {num}
                      </button>
                    )
                  })}
                </div>
                {(field.scaleMinLabel || field.scaleMaxLabel) && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#64748b',
                    }}
                  >
                    <span>{field.scaleMinLabel || ''}</span>
                    <span>{field.scaleMaxLabel || ''}</span>
                  </div>
                )}
              </div>
            )}

            {/* NPS (0 a 10 colorido) */}
            {field.type === 'nps' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, minmax(36px, 1fr))', gap: 6 }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => {
                    const isSelected = Number(val) === num && val !== undefined && val !== ''
                    const zoneColor =
                      num <= 6 ? '#ef4444' : num <= 8 ? '#f59e0b' : '#10b981'
                    const zoneBg =
                      num <= 6 ? '#fef2f2' : num <= 8 ? '#fffbeb' : '#ecfdf5'
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => updateAnswer(field, num)}
                        aria-pressed={isSelected}
                        style={{
                          minHeight: 48,
                          borderRadius: 12,
                          border: isSelected
                            ? `2px solid ${zoneColor}`
                            : '1px solid #e2e8f0',
                          background: isSelected ? zoneColor : zoneBg,
                          color: isSelected ? '#ffffff' : zoneColor,
                          fontSize: 15,
                          fontWeight: 800,
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {num}
                      </button>
                    )
                  })}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#64748b',
                  }}
                >
                  <span style={{ color: '#ef4444' }}>0–6: Pouco provável</span>
                  <span style={{ color: '#d97706' }}>7–8: Neutro</span>
                  <span style={{ color: '#10b981' }}>9–10: Muito provável</span>
                </div>
              </div>
            )}

            {/* AVALIAÇÃO POR ESTRELAS */}
            {field.type === 'avaliacao_estrelas' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {Array.from({ length: field.starCount || 5 }, (_, i) => i + 1).map(star => {
                  const hovered = hoverStarMap[field.id] || 0
                  const active = hovered ? star <= hovered : star <= Number(val || 0)
                  return (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() =>
                        setHoverStarMap(prev => ({ ...prev, [field.id]: star }))
                      }
                      onMouseLeave={() =>
                        setHoverStarMap(prev => ({ ...prev, [field.id]: 0 }))
                      }
                      onClick={() => updateAnswer(field, star)}
                      aria-label={`${star} estrelas`}
                      aria-pressed={Number(val) === star}
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 14,
                        border: active ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                        background: active ? '#fffbeb' : '#f8fafc',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'transform 0.15s',
                      }}
                    >
                      <Star
                        size={26}
                        color={active ? '#f59e0b' : '#cbd5e1'}
                        fill={active ? '#f59e0b' : 'none'}
                      />
                    </button>
                  )
                })}
                {val && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#b45309', marginLeft: 6 }}>
                    {val} de {field.starCount || 5} estrelas
                  </span>
                )}
              </div>
            )}

            {/* TERMÔMETRO DE HUMOR */}
            {field.type === 'termometro_humor' && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
                  gap: 10,
                }}
              >
                {MOOD_OPTIONS.map(mood => {
                  const isSelected = val === mood.label || String(val) === mood.value
                  return (
                    <button
                      key={mood.value}
                      type="button"
                      onClick={() => updateAnswer(field, mood.label)}
                      aria-pressed={isSelected}
                      style={{
                        padding: '14px 10px',
                        borderRadius: 16,
                        border: isSelected
                          ? `2px solid ${mood.color}`
                          : '1px solid #e2e8f0',
                        background: isSelected ? `${mood.color}14` : '#f8fafc',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <span style={{ fontSize: 28 }}>{mood.emoji}</span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? 800 : 600,
                          color: isSelected ? mood.color : '#475569',
                          textAlign: 'center',
                        }}
                      >
                        {mood.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            <label
              htmlFor={inputId}
              style={{ display: 'block', width: '100%', minWidth: 0, cursor: 'pointer' }}
            >
              {labelContent}
            </label>
            <RenderMediaCollection media={field.media} filterPosition="above" />
            {field.description && (
              <FormRichTextRenderer
                id={descId}
                content={field.description}
                primaryColor={primaryColor}
                style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.55 }}
              />
            )}
            <RenderMediaCollection media={field.media} filterPosition="below" />

            {/* USUÁRIO LOGADO AUTOMÁTICO / IDENTIFICAÇÃO DO PARTICIPANTE */}
            {(field.type === 'usuario_logado' || (field.autoFillUser && field.type === 'texto_curto')) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 14,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: effectiveUser || isPreview ? '#059669' : '#64748b',
                      pointerEvents: 'none',
                    }}
                  >
                    <UserCheck size={18} />
                  </div>
                  <input
                    id={inputId}
                    name={field.id}
                    type="text"
                    value={val || ''}
                    placeholder={
                      field.placeholder ||
                      (!effectiveUser && isPublicForm
                        ? 'Digite seu nome ou clique para fazer login...'
                        : 'Clique para fazer login com Google ou IMPACTO EDU...')
                    }
                    required={field.required}
                    readOnly={
                      field.lockAutoFill !== false &&
                      (Boolean(effectiveUser) || isPreview || isManualMode) &&
                      !manualNameOverride
                    }
                    aria-invalid={Boolean(errorMsg)}
                    aria-describedby={errorMsg ? errorId : field.description ? descId : undefined}
                    onClick={() => {
                      if (!isManualMode && (!manualNameOverride || field.lockAutoFill !== false)) {
                        setIsAuthModalOpen(true)
                      }
                    }}
                    onChange={e => updateAnswer(field, e.target.value)}
                    onBlur={() => handleFieldBlur(field)}
                    title="Clique para abrir as opções de login por Conta Google ou IMPACTO EDU"
                    style={{
                      width: '100%',
                      minHeight: 48,
                      padding: '12px 185px 12px 42px',
                      borderRadius: 12,
                      border: errorMsg
                        ? '1.5px solid #ef4444'
                        : field.lockAutoFill !== false &&
                          (Boolean(effectiveUser) || isPreview || isManualMode) &&
                          !manualNameOverride
                        ? '1.5px solid #a7f3d0'
                        : '1px solid #cbd5e1',
                      background:
                        field.lockAutoFill !== false &&
                        (Boolean(effectiveUser) || isPreview || isManualMode) &&
                        !manualNameOverride
                          ? '#f0fdf4'
                          : '#ffffff',
                      fontSize: 'max(1rem, 15px)',
                      fontWeight: 700,
                      color: '#0f172a',
                      boxSizing: 'border-box',
                      cursor:
                        !isManualMode && (!manualNameOverride || field.lockAutoFill !== false)
                          ? 'pointer'
                          : 'text',
                    }}
                  />

                  {/* INTERACTIVE LOGIN / SWITCH BUTTON ON INPUT */}
                  {!isManualMode && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation()
                        setIsAuthModalOpen(true)
                      }}
                      title="Clique para abrir as opções de login por Conta Google ou IMPACTO EDU"
                      style={{
                        position: 'absolute',
                        right: 8,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        color: effectiveUser || isPreview ? '#059669' : '#ffffff',
                        fontSize: 12,
                        fontWeight: 800,
                        background:
                          effectiveUser || isPreview
                            ? '#dcfce7'
                            : 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)',
                        border: effectiveUser || isPreview ? '1px solid #86efac' : 'none',
                        padding: effectiveUser || isPreview ? '5px 11px' : '6px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        boxShadow:
                          effectiveUser || isPreview
                            ? 'none'
                            : '0 2px 6px rgba(79, 70, 229, 0.25)',
                        zIndex: 2,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {effectiveUser?.provider === 'google' ? (
                        <GoogleIcon size={14} />
                      ) : effectiveUser || isPreview ? (
                        <Lock size={12} />
                      ) : (
                        <GoogleIcon size={13} />
                      )}
                      <span>
                        {effectiveUser?.provider === 'google'
                          ? 'Identificado via Google'
                          : effectiveUser || isPreview
                          ? 'Identificado via Login'
                          : 'Entrar com Google ou Sistema'}
                      </span>
                      {(effectiveUser || isPreview) && (
                        <span style={{ fontSize: 10, opacity: 0.75 }}>• Trocar ▾</span>
                      )}
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      color: effectiveUser || isPreview || isManualMode ? '#059669' : '#64748b',
                    }}
                  >
                    <CheckCircle2
                      size={13}
                      color={effectiveUser || isPreview || isManualMode ? '#059669' : '#64748b'}
                    />
                    <span>
                      {isManualMode
                        ? `Vinculado ao colaborador: ${val || manualName || 'Aguardando seleção'}`
                        : effectiveUser
                        ? `Preenchido automaticamente com sua conta: ${effectiveUser.nome || val}`
                        : isPreview
                        ? `Preenchido automaticamente com a conta ativa: ${currentUser?.nome || 'Ivan Rossi'}`
                        : isPublicForm
                        ? 'Informe seu nome ou clique para fazer login com Google ou IMPACTO EDU'
                        : 'Preenchido automaticamente com o usuário autenticado'}
                    </span>
                  </div>

                  {!isManualMode && (
                    <button
                      type="button"
                      onClick={() => setIsAuthModalOpen(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#4f46e5',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      {effectiveUser || isPreview
                        ? 'Trocar de conta / Fazer outro login'
                        : 'Entrar com Conta Google ou IMPACTO EDU'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TEXTO CURTO */}
            {field.type === 'texto_curto' && !field.autoFillUser && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  id={inputId}
                  name={field.id}
                  type={field.validation?.regexType === 'email' ? 'email' : 'text'}
                  inputMode={
                    field.validation?.regexType === 'cpf' ||
                    field.validation?.regexType === 'telefone' ||
                    field.validation?.regexType === 'numero'
                      ? 'numeric'
                      : undefined
                  }
                  value={val || ''}
                  placeholder={field.placeholder || 'Sua resposta...'}
                  required={field.required}
                  maxLength={field.validation?.maxLength}
                  aria-invalid={Boolean(errorMsg)}
                  aria-describedby={errorMsg ? errorId : field.description ? descId : undefined}
                  onChange={e => updateAnswer(field, e.target.value)}
                  onBlur={() => handleFieldBlur(field)}
                  style={{
                    width: '100%',
                    minHeight: 48,
                    padding: '12px 16px',
                    borderRadius: 12,
                    border: errorMsg ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: 'max(1rem, 15px)',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                />
                {field.validation?.maxLength && (
                  <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
                    {String(val || '').length} / {field.validation.maxLength} caracteres
                  </div>
                )}
              </div>
            )}

            {/* PARÁGRAFO */}
            {field.type === 'paragrafo' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <textarea
                  id={inputId}
                  name={field.id}
                  rows={4}
                  value={val || ''}
                  placeholder={field.placeholder || 'Digite sua resposta detalhada...'}
                  required={field.required}
                  maxLength={field.validation?.maxLength}
                  aria-invalid={Boolean(errorMsg)}
                  aria-describedby={errorMsg ? errorId : field.description ? descId : undefined}
                  onChange={e => updateAnswer(field, e.target.value)}
                  onBlur={() => handleFieldBlur(field)}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: errorMsg ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: 'max(1rem, 15px)',
                    color: '#0f172a',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                  }}
                />
                {field.validation?.maxLength && (
                  <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'right' }}>
                    {String(val || '').length} / {field.validation.maxLength} caracteres
                  </div>
                )}
              </div>
            )}

            {/* LISTA SUSPENSA (SELECT) */}
            {field.type === 'lista_suspensa' && (
              <select
                id={inputId}
                name={field.id}
                value={val || ''}
                required={field.required}
                aria-invalid={Boolean(errorMsg)}
                onChange={e => updateAnswer(field, e.target.value)}
                onBlur={() => handleFieldBlur(field)}
                style={{
                  width: '100%',
                  minHeight: 48,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: errorMsg ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: 'max(1rem, 15px)',
                  color: val ? '#0f172a' : '#64748b',
                  cursor: 'pointer',
                }}
              >
                <option value="">Selecione uma opção...</option>
                {(field.options || []).map(opt => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {/* DATA */}
            {field.type === 'data' && (
              <input
                id={inputId}
                name={field.id}
                type="date"
                value={val || ''}
                required={field.required}
                aria-invalid={Boolean(errorMsg)}
                onChange={e => updateAnswer(field, e.target.value)}
                onBlur={() => handleFieldBlur(field)}
                style={{
                  width: '100%',
                  minHeight: 48,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: errorMsg ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: 'max(1rem, 15px)',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                }}
              />
            )}

            {/* HORA */}
            {field.type === 'hora' && (
              <input
                id={inputId}
                name={field.id}
                type="time"
                value={val || ''}
                required={field.required}
                aria-invalid={Boolean(errorMsg)}
                onChange={e => updateAnswer(field, e.target.value)}
                onBlur={() => handleFieldBlur(field)}
                style={{
                  width: '100%',
                  minHeight: 48,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: errorMsg ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: 'max(1rem, 15px)',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                }}
              />
            )}

            {/* NÚMERO / MOEDA */}
            {field.type === 'numero_moeda' && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                {field.numberFormat === 'moeda_brl' && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 14,
                      fontWeight: 700,
                      color: '#64748b',
                      fontSize: 14,
                    }}
                  >
                    R$
                  </span>
                )}
                <input
                  id={inputId}
                  name={field.id}
                  type="number"
                  step={field.numberFormat === 'inteiro' ? '1' : '0.01'}
                  value={val ?? ''}
                  placeholder={field.placeholder || '0'}
                  required={field.required}
                  aria-invalid={Boolean(errorMsg)}
                  onChange={e => updateAnswer(field, e.target.value)}
                  onBlur={() => handleFieldBlur(field)}
                  style={{
                    width: '100%',
                    minHeight: 48,
                    padding:
                      field.numberFormat === 'moeda_brl'
                        ? '12px 16px 12px 42px'
                        : '12px 16px',
                    borderRadius: 12,
                    border: errorMsg ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: 'max(1rem, 15px)',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                />
                {field.numberFormat === 'percentual' && (
                  <span
                    style={{
                      position: 'absolute',
                      right: 16,
                      fontWeight: 700,
                      color: '#64748b',
                      fontSize: 14,
                    }}
                  >
                    %
                  </span>
                )}
              </div>
            )}

            {/* GRADE DE MÚLTIPLA ESCOLHA / CAIXAS */}
            {(field.type === 'grade_multipla' || field.type === 'grade_caixas') && (
              <div style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid #e2e8f0' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13.5,
                    minWidth: 520,
                  }}
                >
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th
                        style={{
                          textAlign: 'left',
                          padding: '12px 16px',
                          color: '#475569',
                          fontWeight: 700,
                        }}
                      >
                        Critério / Item
                      </th>
                      {(field.gridCols || []).map(col => (
                        <th
                          key={col}
                          style={{
                            textAlign: 'center',
                            padding: '12px 10px',
                            color: '#334155',
                            fontWeight: 700,
                          }}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(field.gridRows || []).map((row, rIdx) => {
                      const rowVal = val?.[row]
                      return (
                        <tr
                          key={row}
                          style={{
                            background: rIdx % 2 === 0 ? '#ffffff' : '#f8fafc',
                            borderBottom: '1px solid #f1f5f9',
                          }}
                        >
                          <td
                            style={{
                              padding: '12px 16px',
                              fontWeight: 600,
                              color: '#1e293b',
                            }}
                          >
                            {row}
                          </td>
                          {(field.gridCols || []).map(col => {
                            const isMulti = field.type === 'grade_caixas'
                            const checked = isMulti
                              ? Array.isArray(rowVal) && rowVal.includes(col)
                              : rowVal === col
                            return (
                              <td
                                key={col}
                                style={{ textAlign: 'center', padding: '10px' }}
                              >
                                <input
                                  type={isMulti ? 'checkbox' : 'radio'}
                                  name={`${field.id}_${row}`}
                                  aria-label={`${row} - ${col}`}
                                  checked={checked}
                                  onChange={() => {
                                    const currentGrid =
                                      val && typeof val === 'object' ? { ...val } : {}
                                    if (isMulti) {
                                      const prevRow: string[] = Array.isArray(currentGrid[row])
                                        ? currentGrid[row]
                                        : []
                                      currentGrid[row] = checked
                                        ? prevRow.filter(c => c !== col)
                                        : [...prevRow, col]
                                    } else {
                                      currentGrid[row] = col
                                    }
                                    updateAnswer(field, currentGrid)
                                  }}
                                  style={{
                                    width: 19,
                                    height: 19,
                                    accentColor: primaryColor,
                                    cursor: 'pointer',
                                  }}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* RANKING (ORDENAÇÃO POR PRIORIDADE) */}
            {field.type === 'ranking' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(Array.isArray(val) ? val : field.options || []).map((item: string, idx: number, arr: string[]) => (
                  <div
                    key={item}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 16px',
                      borderRadius: 14,
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                    }}
                  >
                    <span
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        background: idx === 0 ? primaryColor : '#e2e8f0',
                        color: idx === 0 ? '#ffffff' : '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: 13,
                        flexShrink: 0,
                      }}
                    >
                      {idx + 1}º
                    </span>
                    <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: '#1e293b' }}>
                      {item}
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveRankingItem(field, idx, 'up')}
                        aria-label={`Subir ${item}`}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: idx === 0 ? '#f1f5f9' : '#ffffff',
                          color: idx === 0 ? '#cbd5e1' : '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: idx === 0 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === arr.length - 1}
                        onClick={() => moveRankingItem(field, idx, 'down')}
                        aria-label={`Descer ${item}`}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: idx === arr.length - 1 ? '#f1f5f9' : '#ffffff',
                          color: idx === arr.length - 1 ? '#cbd5e1' : '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: idx === arr.length - 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ASSINATURA DIGITAL */}
            {field.type === 'assinatura_digital' && (
              <SignaturePad
                value={val || ''}
                onChange={dataUrl => updateAnswer(field, dataUrl)}
                primaryColor={primaryColor}
              />
            )}
          </>
        )}

        {/* Error Message with aria-live */}
        {errorMsg && (
          <div
            id={errorId}
            role="alert"
            aria-live="polite"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: '#dc2626',
              fontSize: 13,
              fontWeight: 600,
              background: '#fef2f2',
              padding: '8px 12px',
              borderRadius: 10,
              border: '1px solid #fecaca',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMsg}</span>
          </div>
        )}
      </motion.div>
    )
  }

  const sections = form.sections || []
  const activeSection = sections[currentSectionIdx] || sections[0]

  return (
    <div
      style={{
        maxWidth: 860,
        margin: '0 auto',
        fontFamily,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Top Bar: Identity & Display Mode Switcher */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          background: '#ffffff',
          padding: '12px 18px',
          borderRadius: 16,
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(15,23,42,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {effectiveUser ? (
            <>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: effectiveUser.provider === 'google' ? '#eff6ff' : '#ecfdf5',
                  color: effectiveUser.provider === 'google' ? '#2563eb' : '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {effectiveUser.provider === 'google' ? <GoogleIcon size={18} /> : <ShieldCheck size={19} />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                  <span>
                    {isManualMode
                      ? 'Modo de Lançamento Manual (Gestor / RH)'
                      : `Colaborador Autenticado: ${effectiveUser.nome}`}
                  </span>
                  {!isManualMode && (
                    <button
                      type="button"
                      onClick={() => setIsAuthModalOpen(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#4f46e5',
                        fontSize: 11.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                        textDecoration: 'underline',
                      }}
                    >
                      (Trocar Conta)
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: '#64748b' }}>
                  {isManualMode
                    ? 'Registre respostas em nome de colaboradores ou entrevistas presenciais'
                    : `${effectiveUser.cargo || effectiveUser.perfil || 'Colaborador'} • ${effectiveUser.email || 'Sessão verificada'}`}
                </div>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: isPublicForm ? '#15803d' : '#d97706', fontSize: 13, fontWeight: 700 }}>
                {isPublicForm ? <Globe size={16} /> : <Lock size={16} />}
                <span>{isPublicForm ? 'Link Público Aberto' : 'Autenticação de colaborador exigida'}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 11px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#1e293b',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                }}
              >
                <GoogleIcon size={13} /> Fazer Login (Google ou IMPACTO EDU)
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {draftSavedAt && !isManualMode && !isPreview && (
            <span style={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
              ✓ Rascunho salvo às {draftSavedAt}
            </span>
          )}

          {/* Admin Toggle between Collaborator Self-Answer and Manual Entry */}
          {isAdmin && form.settings?.allowManualAdminEntry !== false && (
            <button
              type="button"
              onClick={() => setIsManualMode(prev => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 10,
                border: isManualMode ? `1.5px solid #059669` : '1px solid #cbd5e1',
                background: isManualMode ? '#ecfdf5' : '#f8fafc',
                color: isManualMode ? '#059669' : '#334155',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <UserPlus size={15} />
              {isManualMode ? 'Lançando Manualmente (Ativo)' : 'Lançar Resposta por Outro Colaborador'}
            </button>
          )}

          {/* Display Mode Selector */}
          <div
            style={{
              display: 'inline-flex',
              background: '#f1f5f9',
              padding: 3,
              borderRadius: 10,
              gap: 2,
            }}
          >
            {[
              { id: 'classic_all', label: 'Lista' },
              ...(sections.length > 1 ? [{ id: 'section_wizard', label: 'Seções' }] : []),
              { id: 'focus_one_by_one', label: 'Modo Foco' },
            ].map(m => (
              <button
                key={m.id}
                type="button"
                onClick={() => setActiveDisplayMode(m.id as any)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 7,
                  border: 'none',
                  background: activeDisplayMode === m.id ? '#ffffff' : 'transparent',
                  color: activeDisplayMode === m.id ? '#0f172a' : '#64748b',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow:
                    activeDisplayMode === m.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MANUAL ADMIN ENTRY PANEL ("Mas tambem posso adicionar respostas") */}
      {isAdmin && isManualMode && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%)',
            borderRadius: 22,
            border: '2px solid #10b981',
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  background: '#10b981',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserPlus size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#064e3b' }}>
                  Adicionar Resposta Manual / Registrar por Colaborador
                </h3>
                <p style={{ margin: 0, fontSize: 12.5, color: '#047857' }}>
                  Selecione um colaborador cadastrado no sistema ou preencha os dados manualmente abaixo.
                </p>
              </div>
            </div>
          </div>

          {colaboradoresList.length > 0 && (
            <div
              style={{
                background: '#ffffff',
                padding: 14,
                borderRadius: 14,
                border: '1px solid #a7f3d0',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              <div>
                <label
                  htmlFor="manual-colab-search"
                  style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 6 }}
                >
                  Filtrar Colaborador do Sistema
                </label>
                <div style={{ position: 'relative' }}>
                  <Search
                    size={15}
                    color="#64748b"
                    style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
                  />
                  <input
                    id="manual-colab-search"
                    type="text"
                    value={colabSearch}
                    onChange={e => setColabSearch(e.target.value)}
                    placeholder="Buscar por nome ou cargo..."
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 34px',
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      fontSize: 13.5,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="manual-colab-select"
                  style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 6 }}
                >
                  Selecionar Colaborador ({filteredColaboradores.length} encontrados)
                </label>
                <select
                  id="manual-colab-select"
                  value={selectedColabId}
                  onChange={e => handleSelectColaborador(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 10,
                    border: '1px solid #10b981',
                    fontSize: 13.5,
                    background: '#f8fafc',
                    fontWeight: 600,
                  }}
                >
                  <option value="">-- Digitar manualmente ou escolher da lista --</option>
                  {filteredColaboradores.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nome} {c.cargo ? `(${c.cargo})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            <div>
              <label
                htmlFor="manual-resp-name"
                style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 4 }}
              >
                Nome do Respondente *
              </label>
              <input
                id="manual-resp-name"
                type="text"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="Nome completo do colaborador"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 13.5,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="manual-resp-role"
                style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 4 }}
              >
                Cargo / Função
              </label>
              <input
                id="manual-resp-role"
                type="text"
                value={manualRole}
                onChange={e => setManualRole(e.target.value)}
                placeholder="Ex: Professor, Coordenador..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 13.5,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="manual-resp-dept"
                style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 4 }}
              >
                Setor / Departamento
              </label>
              <input
                id="manual-resp-dept"
                type="text"
                value={manualDept}
                onChange={e => setManualDept(e.target.value)}
                placeholder="Ex: Pedagógico, Administrativo..."
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 13.5,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="manual-resp-date"
                style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 4 }}
              >
                Data/Hora da Resposta
              </label>
              <input
                id="manual-resp-date"
                type="datetime-local"
                value={manualDate}
                onChange={e => setManualDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  fontSize: 13.5,
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="manual-resp-notes"
              style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 4 }}
            >
              Observação Interna do RH (Opcional)
            </label>
            <input
              id="manual-resp-notes"
              type="text"
              value={manualNotes}
              onChange={e => setManualNotes(e.target.value)}
              placeholder="Ex: Resposta coletada em entrevista presencial / formulário impresso..."
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 10,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                fontSize: 13.5,
                boxSizing: 'border-box',
              }}
            />
          </div>
        </motion.div>
      )}

      {/* FORM HEADER BANNER */}
      <div
        style={{
          borderRadius: 24,
          overflow: 'hidden',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05)',
        }}
      >
        {/* Top Banner Image (Google Forms style full-bleed header image above title) */}
        {form.theme?.headerImageUrl &&
          (form.theme?.headerBannerMode || 'top_banner') === 'top_banner' && (
            <div
              style={{
                width: '100%',
                height: form.theme?.headerBannerHeight || 200,
                background: '#0f172a',
                overflow: 'hidden',
              }}
            >
              <img
                src={form.theme.headerImageUrl}
                alt={`Capa de ${form.title}`}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: form.theme?.headerBannerFit || 'cover',
                  display: 'block',
                }}
              />
            </div>
          )}

        <div
          style={{
            position: 'relative',
            overflow: 'hidden',
            background: form.theme?.headerGradient || primaryColor,
            minHeight:
              form.theme?.headerImageUrl && form.theme?.headerBannerMode === 'overlay'
                ? form.theme?.headerBannerHeight || 200
                : undefined,
            padding: form.theme?.headerStyle === 'minimal' ? '24px 32px' : '34px 36px',
            color: form.theme?.headerTitleColor || '#ffffff',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {/* Overlay Background Image Layer */}
          {form.theme?.headerImageUrl && form.theme?.headerBannerMode === 'overlay' && (
            <>
              <img
                src={form.theme.headerImageUrl}
                alt=""
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: form.theme?.headerBannerFit || 'cover',
                  objectPosition: 'center',
                  display: 'block',
                  zIndex: 0,
                  pointerEvents: 'none',
                }}
              />
              {/* Semi-transparent dark overlay for high contrast and readability */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(15,23,42,0.85) 100%)',
                  zIndex: 1,
                  pointerEvents: 'none',
                }}
              />
            </>
          )}

          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: 99,
                  background: 'rgba(255,255,255,0.22)',
                  backdropFilter: 'blur(8px)',
                  fontSize: 12,
                  fontWeight: 700,
                  color: form.theme?.headerTitleColor || '#ffffff',
                }}
              >
                {form.category || 'Gestão de Pessoas'}
              </span>
              {form.settings?.confidentialMode && (
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: 99,
                    background: 'rgba(16, 185, 129, 0.3)',
                    backdropFilter: 'blur(8px)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#ffffff',
                  }}
                >
                  🔒 Modo Confidencial no Relatório
                </span>
              )}
              {form.settings?.isQuizMode && (
                <span
                  style={{
                    padding: '4px 12px',
                    borderRadius: 99,
                    background: 'rgba(245, 158, 11, 0.35)',
                    backdropFilter: 'blur(8px)',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#ffffff',
                  }}
                >
                  🏆 Modo Avaliação / Quiz
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              {form.theme?.headerLogoUrl && (
                <img
                  src={form.theme.headerLogoUrl}
                  alt="Logo Institucional"
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 14,
                    objectFit: 'contain',
                    background: '#ffffff',
                    padding: 6,
                    boxShadow: '0 6px 18px rgba(0,0,0,0.2)',
                    flexShrink: 0,
                  }}
                />
              )}
              <div style={{ flex: 1, minWidth: 220 }}>
                <h1
                  id="gp-form-main-heading"
                  style={{
                    margin: 0,
                    fontSize: 28,
                    fontWeight: 900,
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
                    color: form.theme?.headerTitleColor || '#ffffff',
                    textShadow:
                      form.theme?.headerBannerMode === 'overlay'
                        ? '0 2px 4px rgba(0,0,0,0.5)'
                        : '0 1px 2px rgba(0,0,0,0.25)',
                  }}
                >
                  {form.title}
                </h1>

                {form.subtitle && (
                  <p
                    style={{
                      margin: '8px 0 0',
                      fontSize: 16,
                      fontWeight: 600,
                      opacity: 0.95,
                      color:
                        form.theme?.headerSubtitleColor ||
                        form.theme?.headerTitleColor ||
                        '#ffffff',
                      textShadow:
                        form.theme?.headerBannerMode === 'overlay'
                          ? '0 1px 3px rgba(0,0,0,0.45)'
                          : 'none',
                    }}
                  >
                    {form.subtitle}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {(form.description ||
          (form.instructionMedia && form.instructionMedia.length > 0) ||
          form.theme?.showProgressBar) && (
          <div
            style={{
              padding: '20px 32px',
              background: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <RenderMediaCollection media={form.instructionMedia} filterPosition="above" />

            {form.description && (
              <FormRichTextRenderer
                content={form.description}
                primaryColor={primaryColor}
                style={{
                  fontSize: 14.5,
                  color: '#475569',
                  lineHeight: 1.65,
                }}
              />
            )}

            <RenderMediaCollection media={form.instructionMedia} filterPosition="below" />

            {form.theme?.showProgressBar && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#475569',
                    marginBottom: 8,
                  }}
                >
                  <span>
                    Progresso de preenchimento: {answeredCount} de{' '}
                    {allVisibleInteractiveFields.length} questões
                  </span>
                  <span style={{ color: primaryColor }}>{progressPercent}%</span>
                </div>
                <div
                  style={{
                    height: 8,
                    borderRadius: 99,
                    background: '#f1f5f9',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progressPercent}%`,
                      height: '100%',
                      background: primaryColor,
                      borderRadius: 99,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION STEPPER NAV WHEN IN SECTION WIZARD MODE */}
      {activeDisplayMode === 'section_wizard' && sections.length > 1 && (
        <nav aria-label="Etapas do formulário">
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 12,
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #e2e8f0',
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
            }}
          >
            {sections.map((sec, idx) => {
              const isCurrent = idx === currentSectionIdx
              const isDone = idx < currentSectionIdx
              return (
                <li key={sec.id} style={{ flex: 1, minWidth: 140 }}>
                  <button
                    type="button"
                    aria-current={isCurrent ? 'step' : undefined}
                    onClick={() => setCurrentSectionIdx(idx)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 12,
                      border: isCurrent
                        ? `2px solid ${primaryColor}`
                        : '1px solid #e2e8f0',
                      background: isCurrent
                        ? accentColor
                        : isDone
                        ? '#f0fdf4'
                        : '#f8fafc',
                      color: isCurrent
                        ? primaryColor
                        : isDone
                        ? '#15803d'
                        : '#64748b',
                      fontSize: 13,
                      fontWeight: 700,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 11, opacity: 0.8 }}>Etapa {idx + 1}</div>
                    <div
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {sec.title}
                    </div>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      {/* FORM ELEMENT */}
      <form
        aria-labelledby="gp-form-main-heading"
        noValidate
        onSubmit={e => {
          e.preventDefault()
          submitForm(false)
        }}
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        {/* BANNER DE EDIÇÃO ATIVA */}
        {editingSelfResponse && (
          <div
            style={{
              background: '#eff6ff',
              border: '2px solid #3b82f6',
              borderRadius: 20,
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 14,
              boxShadow: '0 4px 16px rgba(59, 130, 246, 0.12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: '#3b82f6',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Edit3 size={22} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#1e3a8a' }}>
                  Modo de Edição Ativo
                </div>
                <div style={{ fontSize: 13, color: '#1d4ed8', marginTop: 3, lineHeight: 1.45 }}>
                  Você está alterando sua resposta anterior registrada no Protocolo <strong>#{editingSelfResponse.protocol}</strong>. Modifique os campos necessários e clique no botão <strong>"Salvar Alterações da Resposta"</strong> ao final.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleCancelEditing}
              style={{
                padding: '9px 18px',
                borderRadius: 12,
                border: '1px solid #bfdbfe',
                background: '#ffffff',
                color: '#1d4ed8',
                fontSize: 13.5,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Cancelar Edição
            </button>
          </div>
        )}
        {/* MODE A: FOCUS ONE BY ONE (TYPEFORM STYLE) */}
        {activeDisplayMode === 'focus_one_by_one' && allVisibleInteractiveFields.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(() => {
              const safeIdx = Math.min(
                currentFocusIdx,
                allVisibleInteractiveFields.length - 1
              )
              const currentItem = allVisibleInteractiveFields[safeIdx]
              return (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0 4px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#64748b',
                    }}
                  >
                    <span>{currentItem.sectionTitle}</span>
                    <span>
                      Questão {safeIdx + 1} de {allVisibleInteractiveFields.length}
                    </span>
                  </div>
                  {renderFieldControl(currentItem.field, currentItem.globalIndex)}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <button
                      type="button"
                      disabled={safeIdx === 0}
                      onClick={() => setCurrentFocusIdx(Math.max(0, safeIdx - 1))}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '12px 20px',
                        borderRadius: 12,
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: safeIdx === 0 ? '#cbd5e1' : '#334155',
                        fontWeight: 700,
                        cursor: safeIdx === 0 ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <ChevronLeft size={18} /> Pergunta Anterior
                    </button>

                    {safeIdx < allVisibleInteractiveFields.length - 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (validateAllVisible([currentItem.field])) {
                            setCurrentFocusIdx(safeIdx + 1)
                          }
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '12px 24px',
                          borderRadius: 12,
                          border: 'none',
                          background: primaryColor,
                          color: '#ffffff',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        Próxima Pergunta <ChevronRight size={18} />
                      </button>
                    ) : null}
                  </div>
                </>
              )
            })()}
          </div>
        ) : (
          /* MODE B & C: CLASSIC ALL OR SECTION WIZARD */
          (() => {
            let questionCounter = 1
            return sections.map((sec, sIdx) => {
              const isHiddenSection =
                activeDisplayMode === 'section_wizard' && sIdx !== currentSectionIdx
              const visibleFields = (sec.fields || []).filter(f =>
                evaluateConditionalRule(f, answers)
              )

              return (
                <div
                  key={sec.id}
                  hidden={isHiddenSection}
                  style={{
                    display: isHiddenSection ? 'none' : 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  {Boolean(
                    sec.title?.trim() ||
                      sec.description ||
                      (sec.media && sec.media.length > 0)
                  ) && (
                    <div
                      style={{
                        padding: '16px 22px',
                        borderRadius: 16,
                        background: '#ffffff',
                        borderLeft: `5px solid ${primaryColor}`,
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        width: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                      }}
                    >
                      {sec.title?.trim() && (
                        <h2
                          style={{
                            margin: 0,
                            fontSize: 18,
                            fontWeight: 800,
                            color: '#0f172a',
                            lineHeight: 1.35,
                            wordBreak: 'normal',
                            overflowWrap: 'break-word',
                          }}
                        >
                          {sec.title}
                        </h2>
                      )}
                      <RenderMediaCollection media={sec.media} filterPosition="above" />
                      {sec.description && (
                        <FormRichTextRenderer
                          content={sec.description}
                          primaryColor={primaryColor}
                          style={{
                            fontSize: 13.5,
                            color: '#64748b',
                            lineHeight: 1.55,
                          }}
                        />
                      )}
                      <RenderMediaCollection media={sec.media} filterPosition="below" />
                    </div>
                  )}

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 16,
                      width: '100%',
                      minWidth: 0,
                    }}
                  >
                    <AnimatePresence initial={false}>
                      {visibleFields.map(field => {
                        const qNum =
                          field.type !== 'bloco_informativo' &&
                          field.type !== 'bloco_imagem'
                            ? questionCounter++
                            : undefined
                        return renderFieldControl(field, qNum)
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )
            })
          })()
        )}

        {/* PUBLIC ACCESS NOTICE IF NOT AUTHENTICATED AND IS PUBLIC FORM */}
        {!effectiveUser && !isManualMode && !isPreview && isPublicForm && (
          <div
            style={{
              background: '#f0fdf4',
              borderRadius: 20,
              border: '1.5px solid #86efac',
              padding: '18px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 16,
              color: '#166534',
              boxShadow: '0 4px 14px rgba(22, 101, 52, 0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  background: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#15803d',
                }}
              >
                <Globe size={22} />
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 800 }}>
                  Link Público Aberto • Resposta sem Necessidade de Login
                </div>
                <div style={{ fontSize: 13, color: '#15803d', marginTop: 2 }}>
                  Você pode responder diretamente preenchendo seu nome ou se identificar com sua Conta Google / IMPACTO EDU.
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '9px 16px',
                borderRadius: 10,
                border: '1px solid #86efac',
                background: '#ffffff',
                color: '#166534',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              }}
            >
              <GoogleIcon size={15} /> Entrar com Google ou Sistema
            </button>
          </div>
        )}

        {/* INLINE COLLABORATOR LOGIN IF NOT AUTHENTICATED */}
        {!effectiveUser && !isManualMode && !isPreview && !isPublicForm && (
          <div
            style={{
              background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
              borderRadius: 24,
              padding: 28,
              color: '#ffffff',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              boxShadow: '0 14px 34px rgba(15, 23, 42, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                }}
              >
                <Lock size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>
                  Identificação Obrigatória de Colaborador
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#94a3b8' }}>
                  Informe seu e-mail e senha de acesso ao sistema para validar e enviar sua resposta.
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 14,
              }}
            >
              <div>
                <label
                  htmlFor="inline-login-email"
                  style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}
                >
                  E-mail Corporativo / Sistema *
                </label>
                <input
                  id="inline-login-email"
                  type="email"
                  autoComplete="username"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="seu.email@impacto.edu.br"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#ffffff',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="inline-login-password"
                  style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#cbd5e1', marginBottom: 6 }}
                >
                  Senha de Acesso *
                </label>
                <input
                  id="inline-login-password"
                  type="password"
                  autoComplete="current-password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Sua senha"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#ffffff',
                    fontSize: 14,
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* GLOBAL SUBMIT ERROR */}
        {submitError && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              padding: '14px 18px',
              borderRadius: 14,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: 14,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <AlertCircle size={18} />
            <span>{submitError}</span>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
            background: '#ffffff',
            padding: '18px 24px',
            borderRadius: 20,
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', gap: 10 }}>
            {activeDisplayMode === 'section_wizard' && currentSectionIdx > 0 && (
              <button
                type="button"
                onClick={() => setCurrentSectionIdx(prev => Math.max(0, prev - 1))}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 18px',
                  borderRadius: 12,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={17} /> Seção Anterior
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setAnswers({})
                setFieldErrors({})
                try {
                  localStorage.removeItem(draftStorageKey)
                } catch {}
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#64748b',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RotateCcw size={15} /> Limpar Formulário
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  padding: '12px 20px',
                  borderRadius: 12,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            )}

            {activeDisplayMode === 'section_wizard' &&
            currentSectionIdx < sections.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  const secFields = activeSection?.fields || []
                  if (validateAllVisible(secFields)) {
                    setCurrentSectionIdx(prev => prev + 1)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '13px 26px',
                  borderRadius: 14,
                  border: 'none',
                  background: primaryColor,
                  color: '#ffffff',
                  fontSize: 15,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Próxima Seção <ChevronRight size={18} />
              </button>
            ) : (
              <>
                {isAdmin && isManualMode && !editingResponse && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => submitForm(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '13px 20px',
                      borderRadius: 14,
                      border: '2px solid #059669',
                      background: '#ecfdf5',
                      color: '#059669',
                      fontSize: 14,
                      fontWeight: 800,
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Plus size={17} /> Salvar e Lançar Outra
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '13px 28px',
                    borderRadius: 14,
                    border: 'none',
                    background: isSubmitting ? '#94a3b8' : primaryColor,
                    color: '#ffffff',
                    fontSize: 15,
                    fontWeight: 800,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                    boxShadow: `0 8px 20px ${primaryColor}40`,
                  }}
                >
                  <Send size={18} />
                  {isSubmitting
                    ? 'Salvando alterações...'
                    : (editingResponse || editingSelfResponse)
                    ? 'Salvar Alterações da Resposta'
                    : isManualMode
                    ? 'Registrar Resposta Manual'
                    : 'Enviar Resposta'}
                </button>
              </>
            )}
          </div>
        </div>
      </form>

      {/* ===================================================================== */}
      {/* MODAL DE AUTENTICAÇÃO / LOGIN (CONTA GOOGLE OU IMPACTO EDU)          */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isAuthModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              background: 'rgba(15, 23, 42, 0.65)',
              backdropFilter: 'blur(6px)',
            }}
            onClick={e => {
              if (e.target === e.currentTarget) setIsAuthModalOpen(false)
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              style={{
                background: '#ffffff',
                borderRadius: 24,
                width: '100%',
                maxWidth: 480,
                maxHeight: '92vh',
                overflowY: 'auto',
                boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '24px 28px 18px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 16,
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 11.5,
                      fontWeight: 800,
                      color: '#4f46e5',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    <ShieldCheck size={14} /> Identificação do Respondente
                  </div>
                  <h3
                    id="auth-modal-title"
                    style={{
                      margin: '4px 0 0',
                      fontSize: 20,
                      fontWeight: 800,
                      color: '#0f172a',
                    }}
                  >
                    Opções de Identificação
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>
                    Entre com sua Conta Google ou com seu Login do Sistema IMPACTO EDU:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(false)}
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    border: '1px solid #e2e8f0',
                    background: '#f8fafc',
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* CURRENT LOGGED-IN IDENTITY (IF ACTIVE) */}
                {(effectiveUser || isPreview) && (
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                      borderRadius: 16,
                      border: '1.5px solid #86efac',
                      padding: '16px 18px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          background: '#15803d',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 16,
                          fontWeight: 800,
                          flexShrink: 0,
                        }}
                      >
                        {effectiveUser?.nome
                          ? effectiveUser.nome
                              .split(' ')
                              .map((w: string) => w[0])
                              .slice(0, 2)
                              .join('')
                              .toUpperCase()
                          : isPreview
                          ? 'IR'
                          : 'U'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14.5, fontWeight: 800, color: '#14532d' }}>
                            {effectiveUser?.nome || (isPreview ? 'Ivan Rossi' : 'Usuário Identificado')}
                          </span>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 800,
                              background: '#ffffff',
                              color: '#15803d',
                              padding: '2px 7px',
                              borderRadius: 99,
                              border: '1px solid #86efac',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            {effectiveUser?.provider === 'google' ? (
                              <>
                                <GoogleIcon size={11} /> Google
                              </>
                            ) : (
                              '✓ Conta Ativa'
                            )}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#166534', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {effectiveUser?.email || (isPreview ? 'ivan.rossi@impactoedu.com.br' : 'Conta verificada')}
                          {effectiveUser?.cargo ? ` • ${effectiveUser.cargo}` : isPreview ? ' • Administrador Master' : ''}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setIsAuthModalOpen(false)}
                        style={{
                          flex: 1,
                          padding: '9px 14px',
                          borderRadius: 10,
                          border: 'none',
                          background: '#15803d',
                          color: '#ffffff',
                          fontSize: 13,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        Continuar com esta conta
                      </button>
                      <button
                        type="button"
                        onClick={handleClearUser}
                        style={{
                          padding: '9px 14px',
                          borderRadius: 10,
                          border: '1px solid #86efac',
                          background: '#ffffff',
                          color: '#166534',
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                        title="Desconectar esta identificação para digitar outro nome ou entrar com outra conta"
                      >
                        Trocar / Sair
                      </button>
                    </div>
                  </div>
                )}

                {/* ERROR FEEDBACK */}
                {authError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      borderRadius: 12,
                      border: '1px solid #fecaca',
                      padding: '12px 14px',
                      color: '#991b1b',
                      fontSize: 12.5,
                      lineHeight: 1.45,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}
                  >
                    <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 2, color: '#dc2626' }} />
                    <span style={{ flex: 1 }}>{authError}</span>
                  </div>
                )}

                {/* OPTION 1: GOOGLE SIGN-IN */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>
                    Opção 1: Identificar-se com Conta Google
                  </div>
                  <button
                    type="button"
                    disabled={authLoading}
                    onClick={handleGoogleLogin}
                    style={{
                      width: '100%',
                      padding: '13px 18px',
                      borderRadius: 14,
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#1e293b',
                      fontSize: 14.5,
                      fontWeight: 700,
                      cursor: authLoading ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 12,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#4285F4'
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(66, 133, 244, 0.15)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#cbd5e1'
                      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.04)'
                    }}
                  >
                    <GoogleIcon size={20} />
                    <span>{authLoading ? 'Conectando ao Google...' : 'Continuar com a Conta Google'}</span>
                  </button>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6, textAlign: 'center' }}>
                    Identificação rápida com seu e-mail Google (apenas para preencher o formulário, sem criar acesso no sistema).
                  </div>
                </div>

                {/* DIVIDER */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>
                    OU
                  </span>
                  <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
                </div>

                {/* OPTION 2: IMPACTO EDU CREDENTIALS */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                    Opção 2: Login do Sistema IMPACTO EDU
                  </div>
                  <form onSubmit={handleImpactoLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        E-mail Cadastrado / Institucional *
                      </label>
                      <input
                        type="email"
                        autoComplete="username"
                        value={authEmail}
                        onChange={e => setAuthEmail(e.target.value)}
                        placeholder="seu.email@impactoedu.com.br"
                        required
                        style={{
                          width: '100%',
                          padding: '11px 14px',
                          borderRadius: 12,
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          fontSize: 13.5,
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                        Senha de Acesso *
                      </label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showAuthPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={authPassword}
                          onChange={e => setAuthPassword(e.target.value)}
                          placeholder="Sua senha no sistema"
                          required
                          style={{
                            width: '100%',
                            padding: '11px 40px 11px 14px',
                            borderRadius: 12,
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            fontSize: 13.5,
                            boxSizing: 'border-box',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAuthPassword(!showAuthPassword)}
                          style={{
                            position: 'absolute',
                            right: 12,
                            background: 'transparent',
                            border: 'none',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            padding: 0,
                          }}
                        >
                          {showAuthPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={authLoading}
                      style={{
                        marginTop: 4,
                        padding: '12px 18px',
                        borderRadius: 12,
                        border: 'none',
                        background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                        color: '#ffffff',
                        fontSize: 14,
                        fontWeight: 800,
                        cursor: authLoading ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
                      }}
                    >
                      <Lock size={15} />
                      <span>{authLoading ? 'Autenticando...' : 'Entrar com Login IMPACTO EDU'}</span>
                    </button>
                  </form>
                </div>

                {/* OPTION 3: MANUAL FILL (FOR PUBLIC FORMS) */}
                {(isPublicForm || isPreview) && (
                  <div
                    style={{
                      borderTop: '1px dashed #e2e8f0',
                      paddingTop: 14,
                      textAlign: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setManualNameOverride(true)
                        setIsAuthModalOpen(false)
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#64748b',
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Prefiro apenas digitar meu nome manualmente (Sem Login)
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AUTH SUCCESS TOAST */}
      <AnimatePresence>
        {authSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 10000,
              background: '#065f46',
              color: '#ffffff',
              padding: '12px 22px',
              borderRadius: 14,
              boxShadow: '0 10px 30px rgba(6, 95, 70, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 14,
              fontWeight: 800,
            }}
          >
            <CheckCircle2 size={18} />
            <span>{authSuccessToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
