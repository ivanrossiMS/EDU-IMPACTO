'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Shield, AlertTriangle, CheckCircle2, Bookmark,
  ChevronLeft, ChevronRight, Send, Wifi, WifiOff, RefreshCw,
  Maximize2, Minimize2, FileCheck2, AlertCircle, HelpCircle,
  Hash, Calendar, User, BookOpen, Printer, Check, Info, Bell,
  Calculator, Copy, CheckCheck, X, ArrowLeft, Flame, Sparkles,
  FileText, AlertOctagon, LogOut, RotateCcw, XCircle,
  CameraOff, ShieldAlert, EyeOff
} from 'lucide-react'
import { toast } from 'sonner'
import { HtmlContent } from '@/components/HtmlContent'
import {
  ProvaOnline,
  QuestaoProva,
  AlternativaQuestao,
  TentativaAluno,
  RespostaQuestaoTentativa,
  ComprovanteEntrega
} from '@/types/provas-online'

interface ExamRoomProps {
  prova: ProvaOnline
  initialTentativa?: TentativaAluno | null
  currentUserId?: string
  alunoNome?: string
  returnUrl?: string
}

type SaveState = 'saved' | 'saving' | 'offline_queued' | 'error'

// Helper function to build deterministic storage key for offline attempts
function getOfflineStorageKey(provaId: string, tentativaId?: string): string {
  return `impacto_offline_respostas_${provaId}_${tentativaId || 'draft'}`
}

// Safely retrieve offline cached responses across localStorage and sessionStorage
function safeGetOfflineQueue(key: string): { respostas?: Record<string, RespostaQuestaoTentativa>; questoesRevisao?: string[] } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(key) || sessionStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.warn('[ExamRoom] Erro ao recuperar fila offline:', e)
  }
  return null
}

// Safely save offline responses handling QuotaExceededError, automatic cleanup, and sessionStorage fallback
function safeSaveOfflineQueue(key: string, data: any): void {
  if (typeof window === 'undefined') return
  const serialized = JSON.stringify(data)

  // 1. Tentar gravar diretamente no localStorage
  try {
    localStorage.setItem(key, serialized)
    return
  } catch (err: any) {
    console.warn('[ExamRoom] localStorage indisponível ou quota excedida. Executando purga de tentativas antigas:', err)
  }

  // 2. Se a quota foi atingida, purga rascunhos de outras provas/tentativas antigas para liberar espaço
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k && k.startsWith('impacto_offline_respostas_') && k !== key) {
        localStorage.removeItem(k)
      }
    }
    // Tenta gravar novamente após a limpeza
    localStorage.setItem(key, serialized)
    return
  } catch (err: any) {
    console.warn('[ExamRoom] localStorage continua indisponível após limpeza:', err)
  }

  // 3. Fallback para sessionStorage (possui quota isolada de ~5MB e persiste durante o ciclo de vida da aba)
  try {
    sessionStorage.setItem(key, serialized)
    return
  } catch (err: any) {
    console.warn('[ExamRoom] sessionStorage também indisponível:', err)
  }

  // 4. Contingência final segura: dados mantidos com integridade no estado React em memória
}

// Safely remove key from both local and session storage
function safeRemoveOfflineQueue(key: string): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(key) } catch {}
  try { sessionStorage.removeItem(key) } catch {}
}

const ExamRoomStyles = () => (
  <style dangerouslySetInnerHTML={{__html: `
    /* Global Rules for ExamRoom */
    html, body {
      overflow-x: clip !important;
    }
    .er-question-card, .exam-room-grid {
      overflow-anchor: none !important;
    }

    /* Print & Screenshot Security Protection */
    @media print {
      body * {
        visibility: hidden !important;
        display: none !important;
      }
      body::before {
        content: "ATENÇÃO: A captura de tela e a impressão desta avaliação estão estritamente bloqueadas por diretrizes de integridade acadêmica.";
        visibility: visible !important;
        display: block !important;
        text-align: center !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        font-size: 18px !important;
        font-weight: 800 !important;
        color: #e11d48 !important;
        padding: 100px 24px !important;
        background: #ffffff !important;
      }
    }

    /* Responsive Global Rules for ExamRoom */
    @media (max-width: 640px) {
      .er-briefing-wrap {
        padding: 12px 10px 48px !important;
      }
      .er-briefing-card {
        padding: 16px 14px !important;
        border-radius: 18px !important;
        gap: 16px !important;
      }
      .er-briefing-header {
        gap: 12px !important;
        padding-bottom: 16px !important;
      }
      .er-briefing-logo {
        width: 40px !important;
        height: 40px !important;
        border-radius: 12px !important;
        padding: 4px !important;
      }
      .er-briefing-title {
        font-size: 18px !important;
        line-height: 1.3 !important;
        margin-bottom: 4px !important;
      }
      .er-valor-total-card {
        width: 100% !important;
        min-width: 100% !important;
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 8px 14px !important;
        border-radius: 12px !important;
        text-align: left !important;
        margin-top: 4px !important;
      }
      .er-valor-total-card .er-valor-label {
        margin: 0 !important;
        font-size: 10.5px !important;
      }
      .er-valor-total-card .er-valor-num {
        font-size: 18px !important;
        margin-top: 0 !important;
      }
      .er-metrics-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        gap: 8px !important;
      }
      .er-metric-box {
        padding: 10px 10px !important;
        border-radius: 12px !important;
        gap: 8px !important;
      }
      .er-metric-icon {
        width: 32px !important;
        height: 32px !important;
        border-radius: 9px !important;
      }
      .er-metric-icon svg {
        width: 16px !important;
        height: 16px !important;
      }
      .er-metric-label {
        font-size: 10px !important;
        margin-bottom: 1px !important;
      }
      .er-metric-val {
        font-size: 13px !important;
      }
      .er-banner {
        padding: 12px 12px !important;
        border-radius: 14px !important;
        gap: 10px !important;
        font-size: 12px !important;
      }
      .er-banner-icon {
        width: 30px !important;
        height: 30px !important;
        border-radius: 9px !important;
      }
      .er-banner-icon svg {
        width: 16px !important;
        height: 16px !important;
      }
      .er-instructions-box {
        padding: 14px 14px !important;
        border-radius: 14px !important;
      }
      .er-pledge-card {
        padding: 12px 12px !important;
        border-radius: 14px !important;
        gap: 10px !important;
      }
      .er-briefing-actions {
        flex-direction: row !important;
        gap: 8px !important;
      }
      .er-briefing-btn-back {
        height: 44px !important;
        padding: 0 16px !important;
        font-size: 13px !important;
      }
      .er-briefing-btn-start {
        height: 44px !important;
        padding: 0 14px !important;
        font-size: 13.5px !important;
        flex: 1 !important;
        justify-content: center !important;
      }

      /* Active Exam Room Topbar */
      .er-topbar {
        padding: 8px 10px !important;
      }
      .er-topbar-inner {
        gap: 8px !important;
      }
      .er-topbar-logo {
        width: 32px !important;
        height: 32px !important;
        border-radius: 8px !important;
        padding: 2px !important;
      }
      .er-topbar-title {
        font-size: 13px !important;
        max-width: 120px !important;
      }
      .er-topbar-subtitle {
        font-size: 10.5px !important;
        max-width: 105px !important;
      }
      .er-topbar-save-status {
        padding: 4px 8px !important;
        font-size: 11px !important;
      }
      .er-topbar-timer {
        padding: 4px 8px !important;
        font-size: 12px !important;
        border-radius: 8px !important;
      }
      .er-topbar-btn-exit {
        padding: 6px 8px !important;
        font-size: 11.5px !important;
        border-radius: 8px !important;
      }
      .er-topbar-btn-deliver {
        padding: 6px 10px !important;
        font-size: 11.5px !important;
        border-radius: 8px !important;
      }

      /* Active Exam Room Question Card */
      .er-question-card {
        padding: 14px 12px !important;
        border-radius: 16px !important;
        min-height: auto !important;
      }
      .er-question-header {
        padding-bottom: 12px !important;
        gap: 8px !important;
      }
      .er-qnum-badge {
        width: 30px !important;
        height: 30px !important;
        border-radius: 9px !important;
        font-size: 13px !important;
      }
      .er-qbtn-review {
        padding: 5px 8px !important;
        font-size: 11px !important;
        border-radius: 8px !important;
      }
      .er-enunciado {
        padding: 14px 0 !important;
        font-size: 14px !important;
        line-height: 1.55 !important;
      }
      .er-enunciado img {
        max-width: 100% !important;
        height: auto !important;
        border-radius: 10px !important;
        display: block !important;
        margin: 10px auto !important;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
      }
      .er-enunciado svg {
        max-width: 100% !important;
        height: auto !important;
      }
      .er-enunciado table {
        display: block !important;
        max-width: 100% !important;
        overflow-x: auto !important;
      }
      .er-alt-row {
        padding: 10px 12px !important;
        border-radius: 12px !important;
        gap: 10px !important;
      }
      .er-alt-letter {
        width: 26px !important;
        height: 26px !important;
        border-radius: 7px !important;
        font-size: 12px !important;
      }
      .er-vf-row {
        flex-direction: column !important;
        align-items: stretch !important;
        padding: 12px 12px !important;
        gap: 10px !important;
      }
      .er-vf-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
        width: 100% !important;
      }
      .er-vf-actions button {
        justify-content: center !important;
        padding: 8px !important;
        font-size: 12px !important;
      }
      .er-pagination-bar {
        padding-top: 14px !important;
        gap: 8px !important;
      }
      .er-pagination-bar button {
        height: 38px !important;
        padding: 0 12px !important;
        font-size: 12px !important;
        border-radius: 10px !important;
      }
      .er-pagination-pill {
        padding: 4px 10px !important;
        font-size: 11px !important;
      }

      /* Navigation Sidebar on Mobile */
      .er-nav-card {
        padding: 14px 12px !important;
        border-radius: 16px !important;
      }
      .er-nav-qbtn {
        width: 36px !important;
        height: 36px !important;
        border-radius: 9px !important;
        font-size: 12px !important;
      }

      /* Modals on Mobile */
      .er-modal-box {
        padding: 18px 16px !important;
        border-radius: 18px !important;
        max-width: calc(100vw - 24px) !important;
      }

      /* Voucher Card on Mobile */
      .er-voucher-wrap {
        padding: 12px 10px 48px !important;
      }
      .er-voucher-box {
        padding: 16px 14px !important;
        border-radius: 18px !important;
      }
      .er-voucher-grid {
        grid-template-columns: 1fr !important;
        gap: 10px !important;
      }
    }

    @media (max-width: 1024px) {
      .exam-room-grid {
        grid-template-columns: 1fr !important;
        gap: 16px !important;
        padding: 12px 12px 40px !important;
      }
      .exam-room-sidebar {
        position: static !important;
        order: 2;
      }
    }
  `}} />
)

interface PrintBlockedModalProps {
  isOpen: boolean
  onClose: () => void
  triggerSource: string
  timestamp: string
}

function PrintBlockedModal({ isOpen, onClose, triggerSource, timestamp }: PrintBlockedModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(15, 23, 42, 0.78)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)'
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '520px',
              background: '#ffffff',
              borderRadius: '26px',
              border: '1.5px solid rgba(244, 63, 94, 0.28)',
              boxShadow: '0 25px 65px -12px rgba(15, 23, 42, 0.45), 0 0 0 1px rgba(225, 29, 72, 0.08)',
              padding: '30px 26px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {/* Top decorative accent gradient */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '5px',
              background: 'linear-gradient(90deg, #e11d48 0%, #f43f5e 50%, #f59e0b 100%)'
            }} />

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Fechar aviso"
            >
              <X size={16} />
            </button>

            {/* Central Icon */}
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '22px',
              background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
              border: '1.5px solid #fecdd3',
              color: '#e11d48',
              margin: '2px auto 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 25px -4px rgba(225, 29, 72, 0.22)',
              position: 'relative'
            }}>
              <CameraOff size={34} strokeWidth={2.2} />
              <div style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#be123c',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #ffffff'
              }}>
                <ShieldAlert size={13} strokeWidth={2.6} />
              </div>
            </div>

            {/* Title & Badge */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#be123c',
                background: '#ffe4e6',
                border: '1px solid #fecdd3',
                padding: '3px 12px',
                borderRadius: '20px',
                marginBottom: '10px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e11d48', animation: 'pulse 1.8s infinite' }} />
                Segurança Anti-Fraude Ativa
              </div>

              <h2 style={{
                fontSize: '20px',
                fontWeight: 900,
                color: '#0f172a',
                margin: '0 0 6px',
                letterSpacing: '-0.02em',
                lineHeight: 1.25
              }}>
                Captura de Tela Bloqueada
              </h2>

              <p style={{
                fontSize: '13px',
                color: '#64748b',
                margin: 0,
                lineHeight: 1.5
              }}>
                A captura de imagem (print screen) e a impressão desta avaliação foram desabilitadas pela coordenação para preservar a confidencialidade e a integridade da prova.
              </p>
            </div>

            {/* Organized Telemetry & Audit Box */}
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '18px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span>Auditoria da Sessão</span>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  color: '#be123c',
                  background: '#fff1f2',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  border: '1px solid #fecdd3'
                }}>
                  {timestamp || '--:--:--'}
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '8px'
              }}>
                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '10px 12px'
                }}>
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 600 }}>Gatilho Detectado</span>
                  <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                    <EyeOff size={13} className="text-rose-500 shrink-0" />
                    {triggerSource}
                  </span>
                </div>

                <div style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '10px 12px'
                }}>
                  <span style={{ fontSize: '10px', color: '#64748b', display: 'block', fontWeight: 600 }}>Status do Exame</span>
                  <span style={{ fontSize: '12px', color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                    <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                    Respostas Salvas
                  </span>
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '9px 11px',
                borderRadius: '10px',
                background: '#fffbeb',
                border: '1px solid #fef3c7',
                fontSize: '11.5px',
                color: '#92400e',
                lineHeight: 1.45
              }}>
                <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  O registro de infração foi encaminhado ao painel de supervisão do professor. Mantenha o foco exclusivo na realização das questões.
                </span>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: '100%',
                  height: '46px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                  transition: 'all 0.15s ease'
                }}
              >
                <Check size={18} strokeWidth={2.6} />
                <span>Entendi e Desejo Continuar a Prova</span>
              </button>

              <p style={{
                fontSize: '11px',
                color: '#94a3b8',
                textAlign: 'center',
                margin: 0
              }}>
                Pressione <kbd style={{ padding: '2px 5px', borderRadius: '4px', background: '#f1f5f9', border: '1px solid #cbd5e1', fontSize: '10px', fontFamily: 'monospace' }}>ESC</kbd> ou clique no botão para voltar.
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

export function ExamRoom({ prova, initialTentativa, currentUserId, alunoNome, returnUrl }: ExamRoomProps) {
  const router = useRouter()

  // Briefing vs Taking vs Submitted
  const [tentativa, setTentativa] = useState<TentativaAluno | null>(initialTentativa || null)
  const [started, setStarted] = useState<boolean>(
    !!initialTentativa && (initialTentativa.status === 'em_andamento' || initialTentativa.status === 'suspensa')
  )
  const [submittedVoucher, setSubmittedVoucher] = useState<ComprovanteEntrega | null>(
    initialTentativa?.comprovanteEntrega || null
  )

  // PIN input for proctored sessions
  const [pinCode, setPinCode] = useState('')
  const [startingLoading, setStartingLoading] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  // Current Question
  const [currentIndex, setCurrentIndex] = useState(0)

  // Answers Map: questionId -> RespostaQuestaoTentativa (safely parses array or object)
  const [respostas, setRespostas] = useState<Record<string, RespostaQuestaoTentativa>>(() => {
    const map: Record<string, RespostaQuestaoTentativa> = {}
    if (initialTentativa?.respostas) {
      if (Array.isArray(initialTentativa.respostas)) {
        initialTentativa.respostas.forEach((r: any) => {
          if (r && r.questaoId) map[r.questaoId] = r
        })
      } else if (typeof initialTentativa.respostas === 'object') {
        Object.assign(map, initialTentativa.respostas)
      }
    }

    // Hydrate offline fallback if present
    if (typeof window !== 'undefined' && prova?.id) {
      const qKey = getOfflineStorageKey(prova.id, initialTentativa?.id)
      const offlineData = safeGetOfflineQueue(qKey)
      if (offlineData?.respostas && typeof offlineData.respostas === 'object') {
        for (const [qId, offAns] of Object.entries(offlineData.respostas)) {
          const currentAns = map[qId]
          if (!currentAns || (offAns.versao || 0) >= (currentAns.versao || 0)) {
            map[qId] = offAns
          }
        }
      }
    }

    return map
  })

  // Flagged for review set
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(() => {
    const initialFlags = new Set(initialTentativa?.questoesRevisao || [])
    if (typeof window !== 'undefined' && prova?.id) {
      const qKey = getOfflineStorageKey(prova.id, initialTentativa?.id)
      const offlineData = safeGetOfflineQueue(qKey)
      if (Array.isArray(offlineData?.questoesRevisao)) {
        offlineData.questoesRevisao.forEach(id => initialFlags.add(id))
      }
    }
    return initialFlags
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
  const [cancelledModalOpen, setCancelledModalOpen] = useState(false)
  const [cancellationReason, setCancellationReason] = useState<string | null>(
    initialTentativa?.motivoCancelamento || null
  )

  // Submission & Exit Modals
  const [submitModalOpen, setSubmitModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [exitModalOpen, setExitModalOpen] = useState(false)

  // Print & Screenshot Block Modal
  const [printBlockedModalOpen, setPrintBlockedModalOpen] = useState(false)
  const [lastPrintSource, setLastPrintSource] = useState('PrintScreen / Captura')
  const [lastPrintTimestamp, setLastPrintTimestamp] = useState('')
  const lastPrintTriggerRef = useRef(0)

  const handleExitExam = useCallback(() => {
    if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {})
    }
    const targetUrl = returnUrl || '/agenda-digital'
    router.push(targetUrl)
  }, [returnUrl, router])

  // Derived Exam Configuration Properties
  const isSingleQuestionPage = prova.configuracaoLayout?.questaoPorPagina !== false
  const isFreeNavigation = prova.configuracaoLayout?.navegacaoLivre !== false
  const allowReturn = prova.configuracaoLayout?.permitirVoltar !== false && !prova.bloquearRetorno
  const requiresFullscreen = Boolean(prova.configuracaoMonitoramento?.solicitarTelaCheia || prova.exigirTelaCheia)
  const monitorTabSwitch = prova.configuracaoMonitoramento?.registrarSaidaTela !== false
  const blockCopyPaste = Boolean(prova.configuracaoMonitoramento?.bloquearColar || prova.bloquearColar)
  const blockPrint = prova.configuracaoMonitoramento?.bloquearPrint !== false && (prova as any).bloquearPrint !== false
  const actionOnIncident = prova.configuracaoMonitoramento?.acaoOcorrencia || 'alertar'
  const hasPinRequirement = Boolean(
    (prova.codigoLiberacao && String(prova.codigoLiberacao).trim() !== '') ||
    (prova.exigeCodigoAcesso === true && (prova.codigoLiberacao === undefined || String(prova.codigoLiberacao).trim() !== ''))
  )

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
    const sortOrder = tentativa?.ordemQuestoesSorteada || tentativa?.ordemQuestoes?.map(o => o.questaoId)
    if (!sortOrder || sortOrder.length === 0) {
      return list
    }
    const map = new Map(list.map(q => [q.id, q]))
    const ordered: QuestaoProva[] = []
    sortOrder.forEach(qid => {
      const q = map.get(qid)
      if (q) ordered.push(q)
    })
    // Append any missing
    list.forEach(q => {
      if (!ordered.find(o => o.id === q.id)) ordered.push(q)
    })
    return ordered.length > 0 ? ordered : list
  }, [prova.questoes, tentativa?.ordemQuestoesSorteada, tentativa?.ordemQuestoes])

  // Get shuffled alternatives according to tentativa.ordemQuestoes
  const getQuestionAlternatives = useCallback((q: QuestaoProva) => {
    const alts = q.alternativas || []
    if (alts.length === 0) return []
    const qOrder = tentativa?.ordemQuestoes?.find(o => o.questaoId === q.id)
    if (!qOrder?.alternativasOrdem || qOrder.alternativasOrdem.length === 0) {
      return alts
    }
    const altMap = new Map(alts.map(a => [a.id, a]))
    const sorted: AlternativaQuestao[] = []
    qOrder.alternativasOrdem.forEach(id => {
      const found = altMap.get(id)
      if (found) sorted.push(found)
    })
    alts.forEach(a => {
      if (!sorted.find(s => s.id === a.id)) sorted.push(a)
    })
    return sorted
  }, [tentativa?.ordemQuestoes])

  const currentQuestion = orderedQuestions[currentIndex] || orderedQuestions[0]

  // Offline queue storage key
  const storageQueueKey = useMemo(() => getOfflineStorageKey(prova.id, tentativa?.id), [prova.id, tentativa?.id])

  // Refs for autosave debounce & anti-cheat debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastIncidentTimeRef = useRef<number>(0)

  // Proactively clean up obsolete offline caches on mount to preserve browser quota
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (k && k.startsWith('impacto_offline_respostas_') && k !== storageQueueKey) {
          localStorage.removeItem(k)
        }
      }
    } catch {}
  }, [storageQueueKey])

  // --- Autosave Debounce Sync to Server ---
  const syncPendingAnswers = useCallback(async () => {
    if (!tentativa || !started || tentativa.status !== 'em_andamento') return

    const revisaoArray = Array.from(flaggedIds)
    setSaveStatus('saving')

    try {
      const newVersion = versaoRespostas + 1
      const res = await fetch(`/api/provas-online/tentativas/${tentativa.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respostas: respostas, // Envia o mapa indexado por questaoId
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

      setVersaoRespostas(data.versao || newVersion)
      setSaveStatus('saved')
      setLastSavedAt(new Date())
      setPendingSyncCount(0)

      // Clear local queue if succeeded
      safeRemoveOfflineQueue(storageQueueKey)
    } catch (err: any) {
      console.warn('Falha no salvamento remoto:', err)
      // Save to local storage as fallback (guarded against QuotaExceededError)
      safeSaveOfflineQueue(storageQueueKey, {
        respostas: respostas,
        questoesRevisao: revisaoArray,
        savedAt: new Date().toISOString()
      })
      setSaveStatus('offline_queued')
      setPendingSyncCount(Object.keys(respostas).length)
    }
  }, [tentativa, started, respostas, flaggedIds, versaoRespostas, prova.duracaoMinutos, timeRemainingSeconds, storageQueueKey])

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
      toast.warning('Sem conexão à internet. Respostas sendo salvas localmente.')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncPendingAnswers])

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

            // Check if teacher forced submission / ended exam
            if ((data.tentativa.status === 'entregue' || data.tentativa.status === 'expirada') && !submittedVoucher) {
              setTentativa(data.tentativa)
              setSubmittedVoucher(data.tentativa.comprovanteEntrega || {
                hash: data.tentativa.comprovanteCodigo || `COMP-${(data.tentativa.id || '').slice(0, 16)}`,
                provaId: prova.id,
                alunoId: data.tentativa.alunoId,
                alunoNome: data.tentativa.alunoNome,
                matricula: data.tentativa.alunoMatricula || '',
                dataHoraEntrega: data.tentativa.entregueEm || new Date().toISOString(),
                totalQuestoes: prova.questoes?.length || 0,
                totalRespostasRegistradas: Object.keys(data.tentativa.respostas || {}).length,
                protocolo: data.tentativa.comprovanteCodigo || `PRT-${Date.now().toString(36).toUpperCase()}`
              })
              setSuspensionAlert(null)
              if (data.tentativa.motivoCancelamento) {
                setCancellationReason(data.tentativa.motivoCancelamento)
                setCancelledModalOpen(true)
              }
              setStarted(false)
            }
          }

          // Check teacher messages
          if (data.mensagensNaoLidas && data.mensagensNaoLidas.length > 0) {
            const latest = data.mensagensNaoLidas[data.mensagensNaoLidas.length - 1]
            setTeacherBroadcast(latest.mensagem || latest.conteudo)
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
    if (now - lastIncidentTimeRef.current < 2500) return
    lastIncidentTimeRef.current = now

    try {
      const res = await fetch(`/api/provas-online/tentativas/${tentativa.id}/ocorrencias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          descricao,
          respostas
        })
      })
      const data = await res.json()

      if (data.cancelada || actionOnIncident === 'cancelar') {
        const updatedAttempt: TentativaAluno = data.tentativa || {
          ...tentativa,
          status: 'entregue',
          entregueEm: new Date().toISOString(),
          motivoCancelamento: 'Prova encerrada e cancelada por infringir a regra de não minimizar ou sair da tela da avaliação.'
        }
        setTentativa(updatedAttempt)
        setSubmittedVoucher(updatedAttempt.comprovanteEntrega || {
          hash: updatedAttempt.comprovanteCodigo || `COMP-${(updatedAttempt.id || '').slice(0, 16)}`,
          provaId: prova.id,
          alunoId: updatedAttempt.alunoId,
          alunoNome: updatedAttempt.alunoNome,
          matricula: updatedAttempt.alunoMatricula || '',
          dataHoraEntrega: updatedAttempt.entregueEm || new Date().toISOString(),
          totalQuestoes: prova.questoes?.length || 0,
          totalRespostasRegistradas: Object.keys(updatedAttempt.respostas || respostas || {}).length,
          protocolo: updatedAttempt.comprovanteCodigo || `PRT-${Date.now().toString(36).toUpperCase()}`
        })
        setCancellationReason(
          updatedAttempt.motivoCancelamento ||
          'A prova foi encerrada porque você minimizou a janela ou trocou de aba durante a avaliação.'
        )
        setCancelledModalOpen(true)
        setSuspensionAlert(null)
        setStarted(false)
        return
      }

      if (data.suspensa || actionOnIncident === 'suspender') {
        setSuspensionAlert('Prova suspensa automaticamente pela supervisão da prova.')
      }
    } catch (err) {
      // Ignore network errors in incident logging
    }
  }, [tentativa, started, actionOnIncident, prova.id, prova.questoes?.length, respostas])

  // Handler for print & screenshot blocking attempt
  const handlePrintAttempt = useCallback((triggerSource: string = 'PrintScreen / Captura') => {
    if (!blockPrint) return
    const now = Date.now()
    if (now - lastPrintTriggerRef.current < 1200) return
    lastPrintTriggerRef.current = now

    // Wipe clipboard to prevent pasting captured image
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText('Conteúdo protegido contra captura de tela. - EDU IMPACTO').catch(() => {})
    }

    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLastPrintSource(triggerSource)
    setLastPrintTimestamp(timeStr)
    setPrintBlockedModalOpen(true)

    if (tentativa?.id) {
      recordIncident('captura_tela', `Tentativa de captura de tela/print bloqueada. [Gatilho: ${triggerSource}]`)
    }
  }, [blockPrint, tentativa?.id, recordIncident])

  // Setup Dedicated Screenshot & Print Blocking Listeners
  useEffect(() => {
    if (!blockPrint) return

    function handleKeyDown(e: KeyboardEvent) {
      // 1. PrintScreen key
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.key === 'Snapshot') {
        e.preventDefault()
        e.stopPropagation()
        handlePrintAttempt('Tecla PrintScreen')
        return
      }

      // 2. Windows Snipping / Capture: Win + Shift + S or Ctrl + Shift + S
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        e.stopPropagation()
        handlePrintAttempt('Atalho de Recorte (Shift+S)')
        return
      }

      // 3. macOS screenshot: Cmd + Shift + 3, 4, 5
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        handlePrintAttempt('Atalho de Captura macOS')
        return
      }

      // 4. Print shortcut: Ctrl + P / Cmd + P
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault()
        e.stopPropagation()
        handlePrintAttempt('Atalho de Impressão (Ctrl+P)')
        return
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || e.key === 'Snapshot') {
        e.preventDefault()
        e.stopPropagation()
        handlePrintAttempt('Tecla PrintScreen')
      }
    }

    function handleBeforePrint(e: Event) {
      e.preventDefault()
      handlePrintAttempt('Impressão do Navegador')
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('beforeprint', handleBeforePrint)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('beforeprint', handleBeforePrint)
    }
  }, [blockPrint, handlePrintAttempt])

  // Setup Anti-Cheat Listeners
  useEffect(() => {
    if (!started || !tentativa || tentativa.status !== 'em_andamento') return

    function handleVisibilityChange() {
      if (!monitorTabSwitch && actionOnIncident !== 'cancelar') return
      if (document.hidden) {
        recordIncident('saida_tela', 'Aluno saiu da aba ou minimizou a janela da prova.')
      } else {
        if (actionOnIncident === 'alertar') {
          toast.warning('Atenção: A mudança de aba durante a prova foi registrada pela supervisão.')
        }
      }
    }

    function handleWindowBlur() {
      if (actionOnIncident === 'cancelar') {
        setTimeout(() => {
          if (!document.hasFocus() || document.hidden) {
            recordIncident('saida_tela', 'Aluno minimizou a janela ou perdeu o foco da tela da avaliação.')
          }
        }, 300)
      }
    }

    function handleFullscreenChange() {
      const isFull = !!document.fullscreenElement
      setIsFullscreen(isFull)
      if (!isFull && requiresFullscreen) {
        recordIncident('saida_tela_cheia', 'Aluno saiu do modo de tela cheia obrigatório.')
      }
    }

    function handleCopy(e: ClipboardEvent) {
      if (blockCopyPaste) {
        e.preventDefault()
        recordIncident('tentativa_colar', 'Tentativa de cópia de texto bloqueada.')
        if (actionOnIncident === 'alertar') {
          toast.warning('Ação de copiar desabilitada pela política de integridade da prova.')
        }
      }
    }

    function handlePaste(e: ClipboardEvent) {
      if (blockCopyPaste) {
        e.preventDefault()
        recordIncident('tentativa_colar', 'Tentativa de colar conteúdo externo bloqueada.')
        if (actionOnIncident === 'alertar') {
          toast.warning('Ação de colar desabilitada pela política de integridade da prova.')
        }
      }
    }

    function handleContextMenu(e: MouseEvent) {
      if (blockCopyPaste || blockPrint) {
        e.preventDefault()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleWindowBlur)
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    window.addEventListener('copy', handleCopy)
    window.addEventListener('paste', handlePaste)
    window.addEventListener('contextmenu', handleContextMenu)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleWindowBlur)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      window.removeEventListener('copy', handleCopy)
      window.removeEventListener('paste', handlePaste)
      window.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [started, tentativa, requiresFullscreen, blockCopyPaste, blockPrint, monitorTabSwitch, actionOnIncident, recordIncident])

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
    if (hasPinRequirement && !pinCode.trim()) {
      toast.error('Informe o código de liberação presencial fornecido pelo professor para iniciar.')
      return
    }

    setStartingLoading(true)
    setStartError(null)

    try {
      const codeUpper = pinCode.trim().toUpperCase()
      const res = await fetch(`/api/provas-online/${prova.id}/iniciar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          codigoAcesso: codeUpper,
          codigoLiberacao: codeUpper
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Não foi possível iniciar a prova')
      }

      setTentativa(data.tentativa)
      setStarted(true)

      // Enter fullscreen if mandated
      if (requiresFullscreen) {
        void enterFullscreen()
      }

      // Initialize answers from attempt safely (resolves data.tentativa.respostas.forEach is not a function)
      if (data.tentativa?.respostas) {
        const map: Record<string, RespostaQuestaoTentativa> = {}
        if (Array.isArray(data.tentativa.respostas)) {
          data.tentativa.respostas.forEach((r: any) => {
            if (r && r.questaoId) map[r.questaoId] = r
          })
        } else if (typeof data.tentativa.respostas === 'object') {
          Object.entries(data.tentativa.respostas).forEach(([key, val]: [string, any]) => {
            if (val && typeof val === 'object') {
              const qId = val.questaoId || key
              map[qId] = { ...val, questaoId: qId }
            }
          })
        }
        setRespostas(map)
      }

      // Initialize flags
      if (data.tentativa?.questoesRevisao) {
        setFlaggedIds(new Set(data.tentativa.questoesRevisao))
      }

      // Compute remaining time
      if (data.tentativa?.prazoLimite) {
        const diff = Math.floor((new Date(data.tentativa.prazoLimite).getTime() - Date.now()) / 1000)
        setTimeRemainingSeconds(Math.max(0, diff))
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

  // Scroll utility to guarantee the view starts at the very top of the question
  const scrollToExamTop = () => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior })
    if (document.scrollingElement) {
      document.scrollingElement.scrollTop = 0
    }
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }

  // Switch Question (triggers immediate save of previous)
  const goToQuestion = (index: number) => {
    if (index < 0 || index >= orderedQuestions.length) return
    if (!allowReturn && index < currentIndex) {
      toast.warning('A configuração desta avaliação não permite retornar a questões anteriores.')
      return
    }
    if (!isFreeNavigation && index > currentIndex + 1) {
      toast.warning('Navegação sequencial ativa: responda a questão atual antes de avançar.')
      return
    }
    if (saveStatus === 'saving') {
      void syncPendingAnswers()
    }
    setCurrentIndex(index)
    if (!isSingleQuestionPage) {
      const el = document.getElementById(`question-card-${index}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      scrollToExamTop()
    }
  }

  // Sempre reiniciar a barra de rolagem no início do topo ao mudar de pergunta no modo pergunta única
  useEffect(() => {
    if (started && isSingleQuestionPage) {
      scrollToExamTop()
      const raf = requestAnimationFrame(() => {
        scrollToExamTop()
      })
      return () => cancelAnimationFrame(raf)
    }
  }, [currentIndex, started, isSingleQuestionPage])

  // --- Final Delivery Submit Handler ---
  const handleFinalSubmit = async () => {
    if (!tentativa) return
    setSubmitting(true)

    try {
      const revisaoArray = Array.from(flaggedIds)

      const res = await fetch(`/api/provas-online/tentativas/${tentativa.id}/entregar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respostas: respostas, // Envia o mapa direto indexado por questaoId
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
      safeRemoveOfflineQueue(storageQueueKey)

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

  // --- Confirm Exit & Finalize Early Handler ---
  const handleConfirmExitAndSubmit = async () => {
    if (!tentativa) {
      handleExitExam()
      return
    }
    setSubmitting(true)

    try {
      const revisaoArray = Array.from(flaggedIds)

      const res = await fetch(`/api/provas-online/tentativas/${tentativa.id}/entregar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respostas: respostas,
          questoesRevisao: revisaoArray,
          tempoGastoSegundos: Math.max(0, (prova.duracaoMinutos * 60) - timeRemainingSeconds),
          motivoEntrega: 'saida_antecipada'
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao finalizar avaliação')
      }

      setSubmittedVoucher(data.comprovante)
      setStarted(false)
      setExitModalOpen(false)
      safeRemoveOfflineQueue(storageQueueKey)

      if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {})
      }

      toast.info('Avaliação finalizada com sucesso! Suas respostas foram salvas e consolidadas.')

      const targetUrl = returnUrl || '/agenda-digital'
      router.push(targetUrl)
    } catch (err: any) {
      toast.error(err.message || 'Falha ao encerrar a avaliação')
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
      if (q.tipo === 'multipla_escolha') {
        return !!(ans.alternativaIdSelecionada || ans.respostaOpcaoId)
      }
      if (q.tipo === 'multipla_selecao') {
        return (ans.alternativasIdsSelecionadas || ans.respostaOpcoesIds || []).length > 0
      }
      if (q.tipo === 'verdadeiro_falso') {
        const vfCount = (q.itensVF || q.itensVouF || []).length
        return (ans.itensVouF || Object.keys(ans.respostaVF || {})).length === vfCount
      }
      if (q.tipo === 'dissertativa') {
        return (ans.textoDissertativo || ans.respostaDissertativa || '').trim().length > 0
      }
      return false
    }).length
  }, [orderedQuestions, respostas])

  const blankCount = orderedQuestions.length - answeredCount

  // =========================================================================
  // VIEW 1: VOUCHER / SUBMITTED RECEIPT (COMPROVANTE DIGITAL DE ENTREGA)
  // =========================================================================
  if (submittedVoucher || (tentativa && (tentativa.status === 'entregue' || tentativa.status === 'expirada')) || (initialTentativa && (initialTentativa.status === 'entregue' || initialTentativa.status === 'expirada'))) {
    const voucher: ComprovanteEntrega = submittedVoucher || tentativa?.comprovanteEntrega || initialTentativa?.comprovanteEntrega || {
      hash: tentativa?.comprovanteCodigo || initialTentativa?.comprovanteCodigo || `COMP-${(tentativa?.id || initialTentativa?.id || '').slice(0, 16)}`,
      provaId: prova.id,
      alunoId: tentativa?.alunoId || initialTentativa?.alunoId || '',
      alunoNome: tentativa?.alunoNome || initialTentativa?.alunoNome || '',
      matricula: tentativa?.alunoMatricula || initialTentativa?.alunoMatricula || '',
      dataHoraEntrega: tentativa?.entregueEm || initialTentativa?.entregueEm || new Date().toISOString(),
      totalQuestoes: prova.questoes?.length || 0,
      totalRespostasRegistradas: Object.keys(tentativa?.respostas || initialTentativa?.respostas || {}).length,
      protocolo: tentativa?.comprovanteCodigo || initialTentativa?.comprovanteCodigo || `PRT-${Date.now().toString(36).toUpperCase()}`
    }

    const isCancelled = Boolean(tentativa?.motivoCancelamento || initialTentativa?.motivoCancelamento)

    return (
      <div className="er-voucher-wrap" style={{ maxWidth: '840px', margin: '0 auto', padding: '40px 20px' }}>
        <ExamRoomStyles />
        {/* MODAL DE ENCERRAMENTO POR INFRAÇÃO (NÃO MINIMIZAR) */}
        <AnimatePresence>
          {cancelledModalOpen && (
            <div style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)'
            }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                className="er-modal-box"
                style={{
                  width: '100%',
                  maxWidth: '520px',
                  background: '#ffffff',
                  borderRadius: '24px',
                  border: '2px solid #fecdd3',
                  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.35)',
                  padding: '32px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  textAlign: 'center'
                }}
              >
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '20px',
                  background: '#fff1f2',
                  border: '1.5px solid #fecdd3',
                  color: '#e11d48',
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 8px 20px rgba(225, 29, 72, 0.15)'
                }}>
                  <AlertOctagon size={34} />
                </div>

                <div>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#e11d48',
                    background: '#ffe4e6',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    display: 'inline-block',
                    marginBottom: '10px'
                  }}>
                    Infração de Regra Detectada
                  </span>
                  <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
                    Avaliação Encerrada Automaticamente
                  </h2>
                  <p style={{ fontSize: '13.5px', color: '#64748b', margin: 0, lineHeight: 1.55 }}>
                    Você minimizou a janela do navegador, trocou de aba ou perdeu o foco da tela durante a realização da prova.
                  </p>
                </div>

                {/* Card informativo de respostas computadas */}
                <div style={{
                  background: '#f8fafc',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '18px 20px',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '13px', fontWeight: 700 }}>
                    <CheckCircle2 size={16} color="#059669" />
                    <span>Suas respostas foram contabilizadas até onde você parou:</span>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '12px',
                    marginTop: '4px',
                    padding: '12px',
                    background: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Respostas Computadas</span>
                      <strong style={{ fontSize: '16px', color: '#059669' }}>
                        {voucher?.totalRespostasRegistradas || answeredCount} registradas
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Total da Avaliação</span>
                      <strong style={{ fontSize: '16px', color: '#0f172a' }}>
                        {(prova.questoes || []).length} questões
                      </strong>
                    </div>
                  </div>

                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0', lineHeight: 1.45 }}>
                    {cancellationReason || tentativa?.motivoCancelamento || 'Conforme a regra configurada pelo colégio, o encerramento foi concluído e as respostas assinaladas até o momento da infração foram preservadas e enviadas para correção.'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setCancelledModalOpen(false)}
                  style={{
                    width: '100%',
                    padding: '13px 20px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <FileText size={16} />
                  Entendido, Ver Comprovante da Avaliação
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="er-voucher-box"
          style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '24px',
            padding: '36px 32px',
            textAlign: 'center',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)'
          }}
        >
          {/* Logo do Colégio Impacto & Badge de Sucesso */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', margin: '0 auto 20px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)',
              overflow: 'hidden'
            }}>
              <img
                src="/logo-impacto.png"
                alt="Colégio Impacto"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: isCancelled ? '#fff1f2' : '#ecfdf5',
              border: isCancelled ? '1.5px solid #fecdd3' : '1.5px solid #a7f3d0',
              color: isCancelled ? '#e11d48' : '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {isCancelled ? <AlertOctagon size={28} /> : <CheckCircle2 size={28} />}
            </div>
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
            {isCancelled ? 'Avaliação Encerrada e Respostas Computadas' : 'Avaliação Entregue com Sucesso!'}
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', maxWidth: '540px', margin: '0 auto 28px', lineHeight: 1.5 }}>
            {isCancelled
              ? 'Esta avaliação foi encerrada por infração às regras de foco/janela. Todas as suas respostas foram computadas e consolidadas até onde você parou.'
              : 'Suas respostas foram processadas e armazenadas com segurança nos servidores da instituição.'}
          </p>

          {/* Voucher Details Card */}
          <div style={{
            background: '#f8fafc',
            border: '1.5px solid #e2e8f0',
            borderRadius: '20px',
            padding: '24px',
            textAlign: 'left',
            marginBottom: '32px'
          }}>
            {isCancelled && (
              <div style={{
                marginBottom: '18px',
                padding: '14px 18px',
                borderRadius: '14px',
                background: '#fff1f2',
                border: '1.5px solid #fecdd3',
                color: '#9f1239',
                fontSize: '12.5px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}>
                <AlertOctagon size={18} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ display: 'block', color: '#881337', marginBottom: '2px' }}>
                    Encerramento por Infração de Regras (Não Minimizar):
                  </strong>
                  <span>{tentativa?.motivoCancelamento || initialTentativa?.motivoCancelamento || 'Prova encerrada por infringir a regra de não minimizar ou sair da tela da avaliação.'}</span>
                  <div style={{ marginTop: '4px', fontWeight: 600, color: '#059669' }}>
                    ✓ Todas as {voucher?.totalRespostasRegistradas || answeredCount} respostas preenchidas até a saída foram computadas.
                  </div>
                </div>
              </div>
            )}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '16px',
              borderBottom: '1px solid #e2e8f0',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Código Autenticador Digital
                </span>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  Guarde este código para comprovação oficial
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 800,
                  color: '#059669',
                  background: '#ecfdf5',
                  padding: '6px 14px',
                  borderRadius: '10px',
                  border: '1px solid #a7f3d0',
                  letterSpacing: '0.05em'
                }}>
                  {voucher?.hash || initialTentativa?.id?.slice(0, 16)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const code = voucher?.hash || initialTentativa?.id || ''
                    if (navigator?.clipboard?.writeText) {
                      navigator.clipboard.writeText(code)
                    }
                    setCopiedVoucher(true)
                    toast.success('Código autenticador copiado com sucesso!')
                    setTimeout(() => setCopiedVoucher(false), 2000)
                  }}
                  title="Copiar código autenticador"
                  style={{
                    padding: '8px',
                    borderRadius: '10px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {copiedVoucher ? <CheckCheck size={16} color="#059669" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="er-voucher-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginTop: '18px',
              fontSize: '13px'
            }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '2px' }}>Avaliação</span>
                <strong style={{ color: '#0f172a' }}>{prova.titulo}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '2px' }}>Disciplina</span>
                <strong style={{ color: '#0f172a' }}>{prova.disciplinaNome || prova.disciplina}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '2px' }}>Aluno Participante</span>
                <strong style={{ color: '#0f172a' }}>{alunoNome || voucher?.alunoNome || 'Aluno'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '2px' }}>Data / Horário de Envio</span>
                <strong style={{ color: '#0f172a' }}>
                  {new Date(voucher?.dataHoraEntrega || Date.now()).toLocaleString('pt-BR')}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '2px' }}>Total de Questões</span>
                <strong style={{ color: '#0f172a' }}>{(prova.questoes || []).length} questões</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px', display: 'block', marginBottom: '2px' }}>Respostas Registradas</span>
                <strong style={{ color: '#059669' }}>{voucher?.totalRespostasRegistradas || answeredCount} computadas</strong>
              </div>
            </div>

            {/* Instant Grade Result if available */}
            {initialTentativa?.statusCorrecao === 'corrigida' && initialTentativa.notaFinal !== undefined && (
              <div style={{
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>Nota Final Obtida:</span>
                <span style={{ fontSize: '20px', fontWeight: 900, color: '#0284c7' }}>
                  {initialTentativa.notaFinal.toFixed(1)} / {prova.valorTotal.toFixed(1)} pts
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <button
              onClick={() => window.print()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 22px',
                borderRadius: '12px',
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                color: '#334155',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Printer size={16} />
              Imprimir Comprovante
            </button>
            <button
              onClick={() => router.push(returnUrl || '/provas-online')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 26px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                border: 'none',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)'
              }}
            >
              Voltar para Minhas Provas
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  // =========================================================================
  // VIEW 2: BRIEFING & INSTRUCTIONS (SALA DE ACOLHIMENTO PRÉ-PROVA)
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
      <div className="er-briefing-wrap" style={{ maxWidth: '960px', margin: '0 auto', padding: '36px 20px 60px' }}>
        <ExamRoomStyles />
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="er-briefing-card"
          style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}
        >
          {/* Header Card */}
          <div className="er-briefing-header" style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '18px',
            paddingBottom: '22px',
            borderBottom: '1px solid #f1f5f9'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flex: 1, minWidth: '260px' }}>
              {/* Logo do Colégio Impacto */}
              <div className="er-briefing-logo" style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.05)',
                flexShrink: 0,
                overflow: 'hidden'
              }}>
                <img
                  src="/logo-impacto.png"
                  alt="Colégio Impacto"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 800,
                    background: '#f0f9ff',
                    color: '#0284c7',
                    border: '1px solid #bae6fd'
                  }}>
                    <BookOpen size={13} />
                    {prova.disciplinaNome || prova.disciplina}
                  </span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '11px',
                    fontWeight: 800,
                    background: '#f8fafc',
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    textTransform: 'uppercase'
                  }}>
                    {prova.finalidade === 'avaliacao' ? 'Avaliação Oficial' : prova.finalidade}
                  </span>
                </div>

              <h1 className="er-briefing-title" style={{
                fontSize: '24px',
                fontWeight: 900,
                color: '#0f172a',
                margin: '0 0 6px',
                letterSpacing: '-0.02em',
                lineHeight: 1.3
              }}>
                {prova.titulo}
              </h1>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '13px' }}>
                <User size={14} color="#94a3b8" />
                <span>Docente Responsável: <strong style={{ color: '#334155' }}>{prova.professorNome || 'Professor da Turma'}</strong></span>
              </div>
            </div>
            </div>

            <div className="er-valor-total-card" style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '16px',
              padding: '12px 20px',
              textAlign: 'right',
              minWidth: '130px'
            }}>
              <span className="er-valor-label" style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block' }}>
                Valor Total
              </span>
              <div className="er-valor-num" style={{ fontSize: '26px', fontWeight: 900, color: '#0284c7', lineHeight: 1.1, marginTop: '2px' }}>
                {prova.valorTotal.toFixed(1)} <span style={{ fontSize: '14px', fontWeight: 800, color: '#38bdf8' }}>pts</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div className="er-metrics-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px'
          }}>
            {/* Duração */}
            <div className="er-metric-box" style={{
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div className="er-metric-icon" style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Clock size={20} />
              </div>
              <div>
                <span className="er-metric-label" style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                  Duração
                </span>
                <strong className="er-metric-val" style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                  {prova.duracaoMinutos} min
                </strong>
              </div>
            </div>

            {/* Questões */}
            <div className="er-metric-box" style={{
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div className="er-metric-icon" style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#eef2ff',
                border: '1px solid #c7d2fe',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <FileCheck2 size={20} />
              </div>
              <div>
                <span className="er-metric-label" style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                  Questões
                </span>
                <strong className="er-metric-val" style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                  {(prova.questoes || []).length} itens
                </strong>
              </div>
            </div>

            {/* Encerramento */}
            <div className="er-metric-box" style={{
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div className="er-metric-icon" style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#faf5ff',
                border: '1px solid #e9d5ff',
                color: '#7e22ce',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Calendar size={20} />
              </div>
              <div>
                <span className="er-metric-label" style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                  Encerramento
                </span>
                <strong className="er-metric-val" style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a' }}>
                  <span className="hidden sm:inline">
                    {new Date(deadlineStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às {new Date(deadlineStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="sm:hidden">
                    {new Date(deadlineStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, {new Date(deadlineStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </strong>
              </div>
            </div>

            {/* Conexão */}
            <div className="er-metric-box" style={{
              background: '#ffffff',
              border: '1.5px solid #e2e8f0',
              borderRadius: '16px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px'
            }}>
              <div className="er-metric-icon" style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: isOnline ? '#f0fdf4' : '#fff1f2',
                border: `1px solid ${isOnline ? '#bbf7d0' : '#fecdd3'}`,
                color: isOnline ? '#16a34a' : '#e11d48',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Wifi size={20} />
              </div>
              <div>
                <span className="er-metric-label" style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                  Conexão
                </span>
                <strong className="er-metric-val" style={{ fontSize: '15px', fontWeight: 900, color: isOnline ? '#15803d' : '#e11d48' }}>
                  <span className="hidden sm:inline">{isOnline ? 'Online e Sincronizado' : 'Offline'}</span>
                  <span className="sm:hidden">{isOnline ? 'Online' : 'Offline'}</span>
                </strong>
              </div>
            </div>
          </div>

          {/* Near-Closing Warning if applicable */}
          {isEndingSoon && (
            <div className="er-banner" style={{
              padding: '14px 18px',
              borderRadius: '14px',
              background: '#fffbeb',
              border: '1.5px solid #fde68a',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              color: '#92400e',
              fontSize: '13px',
              lineHeight: 1.5
            }}>
              <AlertTriangle size={18} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ display: 'block', color: '#78350f', marginBottom: '2px' }}>
                  Atenção ao horário de encerramento da prova:
                </strong>
                O encerramento oficial da prova ocorre às {new Date(deadlineStr).toLocaleTimeString('pt-BR')}. Caso inicie agora, seu tempo real disponível será de aproximadamente <strong>{effectiveDurationMinutes} minutos</strong> (o encerramento geral prevalece sobre a duração individual).
              </div>
            </div>
          )}

          {/* Warning banner when 'cancelar' action is enabled */}
          {actionOnIncident === 'cancelar' && (
            <div className="er-banner" style={{
              padding: '16px 20px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
              border: '2px solid #fda4af',
              boxShadow: '0 4px 14px rgba(225, 29, 72, 0.08)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              color: '#9f1239',
              fontSize: '13px',
              lineHeight: 1.5
            }}>
              <div className="er-banner-icon" style={{
                width: '38px',
                height: '38px',
                borderRadius: '12px',
                background: '#ffffff',
                border: '1.5px solid #fecdd3',
                color: '#e11d48',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 8px rgba(225, 29, 72, 0.12)'
              }}>
                <AlertOctagon size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', color: '#881337', fontSize: '14px', fontWeight: 900, marginBottom: '3px' }}>
                  Aviso Importante: Prova com Cancelamento Automático ao Minimizar
                </strong>
                Esta avaliação possui monitoramento estrito de integridade. É expressamente proibido <strong>minimizar a janela, alternar de aba ou trocar de aplicativo</strong> durante a realização da prova. Caso você saia ou minimize a tela, <strong>sua avaliação será imediatamente cancelada e encerrada</strong>, e suas respostas serão <strong>contabilizadas e consolidadas apenas até onde você parou</strong>. Mantenha o navegador focado em tela cheia até a entrega.
              </div>
            </div>
          )}

          {/* Instructions & Guidelines Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Instruções Gerais */}
            <div className="er-instructions-box" style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '18px',
              padding: '18px 22px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Info size={16} color="#0284c7" />
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Instruções Gerais
                </h3>
              </div>
              <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, margin: 0 }}>
                {prova.instrucoes || 'Leia com atenção cada questão antes de responder. Suas respostas são salvas automaticamente pelo sistema.'}
              </p>
            </div>

            {/* Regras de Navegação e Supervisão */}
            <div className="er-instructions-box" style={{
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              borderRadius: '18px',
              padding: '18px 22px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <Shield size={16} color="#7e22ce" />
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                  Regras de Navegação e Supervisão
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12.5px', color: '#475569' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} color="#0284c7" strokeWidth={3} />
                  <span>O cronômetro é sincronizado com o servidor e inicia assim que você clicar em "Iniciar Prova Agora".</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} color="#0284c7" strokeWidth={3} />
                  <span>Recarregar a página, fechar o navegador ou trocar de dispositivo <strong>não pausa</strong> seu tempo.</span>
                </div>
                {!allowReturn && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309' }}>
                    <AlertTriangle size={14} color="#d97706" />
                    <span><strong>Atenção:</strong> Esta avaliação não permite retornar a questões anteriores após avançar.</span>
                  </div>
                )}
                {!isFreeNavigation && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309' }}>
                    <AlertTriangle size={14} color="#d97706" />
                    <span><strong>Navegação Sequencial:</strong> As questões devem ser respondidas na ordem apresentada.</span>
                  </div>
                )}
                {requiresFullscreen && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#0284c7" strokeWidth={3} />
                    <span>Modo de tela cheia obrigatório para evitar distrações. Saídas são monitoradas.</span>
                  </div>
                )}
                {monitorTabSwitch && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#0284c7" strokeWidth={3} />
                    <span>Monitoramento de abas ativo: saídas da página do exame são registradas pela supervisão.</span>
                  </div>
                )}
                {blockCopyPaste && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#0284c7" strokeWidth={3} />
                    <span>Proteção de integridade: cópia e colagem de conteúdo bloqueadas nesta prova.</span>
                  </div>
                )}
                {blockPrint && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={14} color="#0284c7" strokeWidth={3} />
                    <span>Bloqueio de Captura: capturas de tela (Print Screen), atalhos de gravação e impressão estão desabilitadas por segurança.</span>
                  </div>
                )}
                {actionOnIncident === 'suspender' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309' }}>
                    <AlertTriangle size={14} color="#d97706" />
                    <span><strong>Suspensão Automática:</strong> Infrações não autorizadas suspenderão a prova imediatamente.</span>
                  </div>
                )}
                {actionOnIncident === 'cancelar' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    background: '#fff1f2',
                    border: '1px solid #fecdd3',
                    color: '#9f1239',
                    fontWeight: 600
                  }}>
                    <AlertOctagon size={15} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>
                      <strong>Regra de Não Minimizar Ativa:</strong> Sair da aba ou minimizar a janela cancela e encerra a avaliação na hora, computando as respostas até o momento da infração.
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} color="#0284c7" strokeWidth={3} />
                  <span>Suas respostas possuem salvamento automático e tolerância a oscilações temporárias de rede.</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={14} color="#0284c7" strokeWidth={3} />
                  <span>Ao optar por sair da prova, a avaliação é finalizada definitivamente: as questões respondidas são computadas e as não respondidas anuladas (sem pontuação).</span>
                </div>
              </div>
            </div>
          </div>

          {/* PIN Verification if required */}
          {hasPinRequirement && (
            <div className="er-instructions-box" style={{
              background: '#f0f9ff',
              border: '1.5px solid #bae6fd',
              borderRadius: '18px',
              padding: '18px 22px'
            }}>
              <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 800, color: '#0369a1', marginBottom: '8px' }}>
                Código de Liberação da Aplicação (Fornecido pelo Professor)
              </label>
              <input
                type="text"
                value={pinCode}
                onChange={e => setPinCode(e.target.value.toUpperCase())}
                placeholder="Ex: PROVA123"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '1.5px solid #7dd3fc',
                  background: '#ffffff',
                  color: '#0f172a',
                  fontWeight: 800,
                  fontSize: '16px',
                  letterSpacing: '0.1em',
                  textAlign: 'center',
                  outline: 'none'
                }}
              />
            </div>
          )}

          {/* Start Error Alert */}
          {startError && (
            <div style={{
              padding: '14px 18px',
              borderRadius: '14px',
              background: '#fff1f2',
              border: '1.5px solid #fecdd3',
              color: '#be123c',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={18} color="#e11d48" />
                <span>{startError}</span>
              </div>
              <button
                type="button"
                onClick={handleStartExam}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid #fecdd3',
                  color: '#be123c',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Tentar Novamente
              </button>
            </div>
          )}

          {/* Academic Integrity Pledge Box */}
          <div
            onClick={() => setPledgeAccepted(!pledgeAccepted)}
            className="er-pledge-card"
            style={{
              padding: '18px 20px',
              borderRadius: '18px',
              background: pledgeAccepted
                ? 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)'
                : 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: `1.5px solid ${pledgeAccepted ? '#86efac' : '#fde68a'}`,
              boxShadow: pledgeAccepted ? '0 4px 14px rgba(16, 185, 129, 0.12)' : 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              type="checkbox"
              checked={pledgeAccepted}
              onChange={e => {
                e.stopPropagation()
                setPledgeAccepted(e.target.checked)
              }}
              style={{
                width: '20px',
                height: '20px',
                accentColor: '#059669',
                marginTop: '3px',
                cursor: 'pointer'
              }}
            />
            <div style={{ flex: 1, fontSize: '13px', lineHeight: 1.5, color: '#334155' }}>
              <strong style={{
                display: 'block',
                color: pledgeAccepted ? '#166534' : '#92400e',
                fontSize: '13.5px',
                fontWeight: 800,
                marginBottom: '3px'
              }}>
                Termo de Integridade Acadêmica e Responsabilidade Escolar:
              </strong>
              Declaro que compreendi todas as regras desta avaliação. Comprometo-me a realizar este exame com integridade e dedicação, de forma estritamente individual, sem consulta a materiais não autorizados e sem comunicação com terceiros.
              {actionOnIncident === 'cancelar' && (
                <div style={{
                  marginTop: '8px',
                  paddingTop: '8px',
                  borderTop: '1px dashed rgba(225, 29, 72, 0.3)',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  color: '#be123c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <AlertOctagon size={14} color="#e11d48" style={{ flexShrink: 0 }} />
                  <span>Estou ciente de que não posso minimizar a janela ou sair da tela, sob pena de encerramento imediato e cômputo apenas das respostas até onde parei.</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Navigation & Start Button */}
          <div className="er-briefing-actions" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '16px',
            borderTop: '1px solid #f1f5f9',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <button
              onClick={() => router.push(returnUrl || '/provas-online')}
              className="er-briefing-btn-back"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '11px 22px',
                borderRadius: '12px',
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#94a3b8'
                e.currentTarget.style.color = '#0f172a'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#cbd5e1'
                e.currentTarget.style.color = '#475569'
              }}
            >
              <ArrowLeft size={16} />
              Voltar
            </button>

            <button
              onClick={handleStartExam}
              disabled={startingLoading || !isOnline || !pledgeAccepted || (hasPinRequirement && !pinCode.trim())}
              className="er-briefing-btn-start"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '10px',
                padding: '13px 32px',
                borderRadius: '14px',
                background: (!pledgeAccepted || startingLoading)
                  ? '#cbd5e1'
                  : 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 800,
                cursor: (!pledgeAccepted || startingLoading) ? 'not-allowed' : 'pointer',
                boxShadow: (!pledgeAccepted || startingLoading) ? 'none' : '0 6px 20px rgba(16, 185, 129, 0.35)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => {
                if (pledgeAccepted && !startingLoading) {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.45)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                if (pledgeAccepted && !startingLoading) {
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.35)'
                }
              }}
            >
              {startingLoading ? (
                <>
                  <RefreshCw size={18} className="animate-spin" />
                  Carregando Sala...
                </>
              ) : (
                <>
                  <Flame size={18} />
                  Iniciar Prova Agora
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>
        </motion.div>
        {/* Modal Ultra Moderno de Bloqueio de Print Screen */}
        <PrintBlockedModal
          isOpen={printBlockedModalOpen}
          onClose={() => setPrintBlockedModalOpen(false)}
          triggerSource={lastPrintSource}
          timestamp={lastPrintTimestamp}
        />
      </div>
    )
  }

  // =========================================================================
  // VIEW 3: ACTIVE EXAM ROOM (REALIZAÇÃO DA PROVA)
  // =========================================================================
  const isTimeCritical = timeRemainingSeconds <= 300 // under 5 min
  const isFlagged = flaggedIds.has(currentQuestion.id)
  const currentAnswer = respostas[currentQuestion.id]

  const renderQuestionCard = (q: QuestaoProva, qIndex: number, showPaginationFooter = false) => {
    const qAnswer = respostas[q.id]
    const isQFlagged = flaggedIds.has(q.id)
    const alternatives = getQuestionAlternatives(q)

    return (
      <div
        className="er-question-card"
        style={{
          background: '#ffffff',
          border: '1.5px solid #e2e8f0',
          borderRadius: '24px',
          padding: '28px 32px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: showPaginationFooter ? '480px' : 'auto'
        }}
      >
        {/* Question Header */}
        <div className="er-question-header" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: '16px',
          borderBottom: '1px solid #f1f5f9',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="er-qnum-badge" style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              background: '#f0f9ff',
              color: '#0284c7',
              fontWeight: 900,
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1.5px solid #bae6fd'
            }}>
              {qIndex + 1}
            </span>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                Questão {qIndex + 1} de {orderedQuestions.length}
              </span>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Valor: <strong style={{ color: '#0284c7' }}>{(q.valorPontos || q.pontuacao || 0).toFixed(1)}</strong> {((q.valorPontos || q.pontuacao) === 1) ? 'ponto' : 'pontos'}
              </span>
            </div>
          </div>

          {/* Flag for Review Button */}
          <button
            type="button"
            onClick={() => handleToggleFlag(q.id)}
            className="er-qbtn-review"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 700,
              border: isQFlagged ? '1.5px solid #fcd34d' : '1px solid #e2e8f0',
              background: isQFlagged ? '#fffbeb' : '#f8fafc',
              color: isQFlagged ? '#b45309' : '#64748b',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <Bookmark size={14} color={isQFlagged ? '#f59e0b' : '#94a3b8'} fill={isQFlagged ? '#f59e0b' : 'none'} />
            <span className="hidden sm:inline">{isQFlagged ? 'Marcada para Revisar' : 'Marcar para Revisar'}</span>
            <span className="sm:hidden">{isQFlagged ? 'Revisando' : 'Revisar'}</span>
          </button>
        </div>

        {/* Question Statement / Enunciado */}
        <div className="er-enunciado" style={{
          padding: '24px 0',
          borderBottom: '1px solid #f1f5f9',
          color: '#0f172a',
          lineHeight: 1.6,
          fontSize: fontSize === 'sm' ? '13.5px' : fontSize === 'lg' ? '17px' : '15px'
        }}>
          <HtmlContent html={q.enunciado} style={{ textAlign: 'left' }} />
        </div>

        {/* Question Input Section */}
        <div style={{ padding: '24px 0', flex: 1 }}>
          {/* TYPE 1: Single Choice (Múltipla Escolha) */}
          {q.tipo === 'multipla_escolha' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>
                Selecione apenas uma alternativa:
              </p>
              {alternatives.map((alt, altIdx) => {
                const isSelected = qAnswer?.alternativaIdSelecionada === alt.id || qAnswer?.respostaOpcaoId === alt.id
                const letter = String.fromCharCode(65 + altIdx)

                return (
                  <div
                    key={alt.id}
                    onClick={() => handleSelectSingleChoice(q.id, alt.id)}
                    className="er-alt-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 18px',
                      borderRadius: '16px',
                      border: isSelected ? '2px solid #0284c7' : '1.5px solid #e2e8f0',
                      background: isSelected ? '#f0f9ff' : '#ffffff',
                      boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#bae6fd'
                        e.currentTarget.style.background = '#f8fafc'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#e2e8f0'
                        e.currentTarget.style.background = '#ffffff'
                      }
                    }}
                  >
                    <div className="er-alt-letter" style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '13px',
                      background: isSelected ? '#0284c7' : '#f1f5f9',
                      color: isSelected ? '#ffffff' : '#475569',
                      border: isSelected ? 'none' : '1px solid #cbd5e1',
                      flexShrink: 0,
                      transition: 'all 0.15s'
                    }}>
                      {letter}
                    </div>
                    <div className="er-alt-text" style={{
                      flex: 1,
                      fontSize: fontSize === 'sm' ? '13px' : fontSize === 'lg' ? '16px' : '14px',
                      color: isSelected ? '#0369a1' : '#1e293b',
                      fontWeight: isSelected ? 600 : 400,
                      lineHeight: 1.5,
                      textAlign: 'left'
                    }}>
                      <HtmlContent html={alt.texto} style={{ textAlign: 'left' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* TYPE 2: Multiple Choice (Múltipla Seleção) */}
          {q.tipo === 'multipla_selecao' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b', margin: 0 }}>
                  Selecione todas as alternativas corretas:
                </p>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0284c7' }}>
                  {q.permitePontuacaoParcial ? 'Pontuação parcial admitida' : 'Exige todas as corretas'}
                </span>
              </div>
              {alternatives.map((alt, altIdx) => {
                const selectedList = qAnswer?.alternativasIdsSelecionadas || qAnswer?.respostaOpcoesIds || []
                const isSelected = selectedList.includes(alt.id)
                const letter = String.fromCharCode(65 + altIdx)

                return (
                  <div
                    key={alt.id}
                    onClick={() => handleToggleMultipleChoice(q.id, alt.id)}
                    className="er-alt-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 18px',
                      borderRadius: '16px',
                      border: isSelected ? '2px solid #0284c7' : '1.5px solid #e2e8f0',
                      background: isSelected ? '#f0f9ff' : '#ffffff',
                      boxShadow: isSelected ? '0 4px 12px rgba(2, 132, 199, 0.12)' : '0 1px 3px rgba(0,0,0,0.02)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div className="er-alt-letter" style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isSelected ? '#0284c7' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#64748b',
                      border: isSelected ? 'none' : '1.5px solid #cbd5e1',
                      flexShrink: 0
                    }}>
                      {isSelected ? <Check size={16} strokeWidth={3} /> : <span style={{ fontSize: '12px', fontWeight: 800 }}>{letter}</span>}
                    </div>
                    <div className="er-alt-text" style={{
                      flex: 1,
                      fontSize: fontSize === 'sm' ? '13px' : fontSize === 'lg' ? '16px' : '14px',
                      color: isSelected ? '#0369a1' : '#1e293b',
                      fontWeight: isSelected ? 600 : 400,
                      lineHeight: 1.5,
                      textAlign: 'left'
                    }}>
                      <HtmlContent html={alt.texto} style={{ textAlign: 'left' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* TYPE 3: True / False (Verdadeiro ou Falso) */}
          {q.tipo === 'verdadeiro_falso' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '12.5px', fontWeight: 600, color: '#64748b', margin: '0 0 4px' }}>
                Classifique cada afirmação como Verdadeira (V) ou Falsa (F):
              </p>
              {((q.itensVF || q.itensVouF || []) as any[]).map((item, itemIdx) => {
                const itemAnswer = (qAnswer?.itensVouF || []).find(i => i.id === item.id)

                return (
                  <div
                    key={item.id}
                    className="er-vf-row"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 18px',
                      borderRadius: '16px',
                      background: itemAnswer?.respostaAluno !== undefined ? '#f8fafc' : '#ffffff',
                      border: `1.5px solid ${itemAnswer?.respostaAluno !== undefined ? '#cbd5e1' : '#e2e8f0'}`,
                      gap: '16px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minWidth: '26px',
                        height: '26px',
                        borderRadius: '8px',
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        color: '#475569',
                        fontWeight: 800,
                        fontSize: '12px',
                        marginTop: '1px'
                      }}>
                        {itemIdx + 1}
                      </span>
                      <div style={{ flex: 1, fontSize: '14px', color: '#0f172a', lineHeight: 1.5, textAlign: 'left' }}>
                        <HtmlContent html={item.afirmacao} style={{ textAlign: 'left' }} />
                      </div>
                    </div>

                    <div className="er-vf-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => handleToggleTrueFalse(q.id, item.id, true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '10px',
                          border: itemAnswer?.respostaAluno === true ? '1.5px solid #10b981' : '1px solid #cbd5e1',
                          background: itemAnswer?.respostaAluno === true ? '#10b981' : '#ffffff',
                          color: itemAnswer?.respostaAluno === true ? '#ffffff' : '#334155',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: 'pointer',
                          boxShadow: itemAnswer?.respostaAluno === true ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
                          transition: 'all 0.15s'
                        }}
                      >
                        <Check size={13} strokeWidth={3} />
                        V (Verdadeiro)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleTrueFalse(q.id, item.id, false)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '8px 16px',
                          borderRadius: '10px',
                          border: itemAnswer?.respostaAluno === false ? '1.5px solid #ef4444' : '1px solid #cbd5e1',
                          background: itemAnswer?.respostaAluno === false ? '#ef4444' : '#ffffff',
                          color: itemAnswer?.respostaAluno === false ? '#ffffff' : '#334155',
                          fontWeight: 800,
                          fontSize: '12px',
                          cursor: 'pointer',
                          boxShadow: itemAnswer?.respostaAluno === false ? '0 2px 8px rgba(239, 68, 68, 0.3)' : 'none',
                          transition: 'all 0.15s'
                        }}
                      >
                        <X size={13} strokeWidth={3} />
                        F (Falso)
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* TYPE 4: Essay (Dissertativa) */}
          {q.tipo === 'dissertativa' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12.5px', color: '#64748b' }}>
                <span>Digite sua resposta fundamentada no campo abaixo:</span>
                {q.limitePalavras && (
                  <span style={{ fontWeight: 700, color: '#0284c7' }}>
                    Limite sugerido: {q.limitePalavras} palavras
                  </span>
                )}
              </div>

              <textarea
                rows={7}
                value={qAnswer?.textoDissertativo || ''}
                onChange={e => handleEssayChange(q.id, e.target.value)}
                placeholder="Escreva sua resolução aqui de forma clara e fundamentada..."
                className="er-essay-textarea"
                style={{
                  width: '100%',
                  minHeight: '160px',
                  padding: '16px',
                  borderRadius: '16px',
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: fontSize === 'sm' ? '13px' : fontSize === 'lg' ? '16px' : '14px',
                  lineHeight: '1.6',
                  resize: 'vertical',
                  outline: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'border-color 0.15s, box-shadow 0.15s'
                }}
                onFocus={e => {
                  e.currentTarget.style.borderColor = '#0284c7'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(2, 132, 199, 0.15)'
                }}
                onBlur={e => {
                  e.currentTarget.style.borderColor = '#cbd5e1'
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'
                }}
              />

              {/* Word / Char counter */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ color: '#334155' }}>
                    {(qAnswer?.textoDissertativo || '').trim().split(/\s+/).filter(Boolean).length} palavras
                  </strong>
                  <span>•</span>
                  <span>{(qAnswer?.textoDissertativo || '').length} caracteres</span>
                </div>
                <span style={{ color: '#059669', fontSize: '11.5px', fontWeight: 600 }}>
                  ✓ Salvamento contínuo durante a digitação
                </span>
              </div>

              {/* Evaluation Rubrics info */}
              {q.criteriosAvaliacao && q.criteriosAvaliacao.length > 0 && (
                <div style={{
                  marginTop: '8px',
                  padding: '14px 18px',
                  borderRadius: '14px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <FileText size={15} color="#0284c7" />
                    <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>
                      Critérios de Correção da Questão:
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px' }}>
                    {q.criteriosAvaliacao.map(crit => (
                      <div key={crit.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px'
                      }}>
                        <span style={{ color: '#334155' }}>{crit.descricao}</span>
                        <strong style={{ color: '#0284c7' }}>{(crit.pesoPontos || crit.pontosMaximos || 0).toFixed(1)} pts</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Bottom Footer (only for single question mode) */}
        {showPaginationFooter && (
          <div className="er-pagination-bar" style={{
            paddingTop: '20px',
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginTop: 'auto'
          }}>
            <button
              type="button"
              onClick={() => goToQuestion(qIndex - 1)}
              disabled={qIndex === 0 || !allowReturn}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: '42px',
                padding: '0 20px',
                borderRadius: '12px',
                background: '#ffffff',
                border: '1.5px solid #cbd5e1',
                color: (qIndex === 0 || !allowReturn) ? '#94a3b8' : '#334155',
                fontSize: '13px',
                fontWeight: 800,
                cursor: (qIndex === 0 || !allowReturn) ? 'not-allowed' : 'pointer',
                opacity: (qIndex === 0 || !allowReturn) ? 0.4 : 1,
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                transition: 'all 0.15s'
              }}
            >
              <ChevronLeft size={16} />
              Anterior
            </button>

            <span className="er-pagination-pill" style={{
              fontSize: '12.5px',
              color: '#64748b',
              fontWeight: 800,
              background: '#f8fafc',
              padding: '6px 14px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0'
            }}>
              {qIndex + 1} de {orderedQuestions.length}
            </span>

            {qIndex < orderedQuestions.length - 1 ? (
              <button
                type="button"
                onClick={() => goToQuestion(qIndex + 1)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  height: '42px',
                  padding: '0 24px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <span>Próxima<span className="hidden sm:inline"> Questão</span></span>
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
                  height: '42px',
                  padding: '0 24px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                Revisar e Entregar
                <Send size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', display: 'flex', flexDirection: 'column', paddingBottom: '60px' }}>
      <ExamRoomStyles />
      {/* 1. STICKY TOPBAR COM GRADIENTE ULTRA MODERNO */}
      <header className="er-topbar" style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'linear-gradient(135deg, #070d1e 0%, #0d1a3a 35%, #18153d 70%, #0b112c 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        padding: '12px 20px',
        boxShadow: '0 4px 24px -2px rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)'
      }}>
        {/* Linha decorativa de brilho ultra moderna na borda inferior */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, #0ea5e9 0%, #6366f1 35%, #a855f7 70%, #ec4899 100%)',
          opacity: 0.85
        }} />

        <div className="er-topbar-inner" style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          
          {/* Left: School Logo & Exam Title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: '1 1 auto' }}>
            {/* Logo do Colégio Impacto */}
            <div className="er-topbar-logo" style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.4)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              flexShrink: 0,
              overflow: 'hidden'
            }}>
              <img
                src="/logo-impacto.png"
                alt="Colégio Impacto"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain'
                }}
              />
            </div>

            {/* School Tag / Branding */}
            <div className="hidden sm:flex" style={{ flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '0.08em',
                color: '#38bdf8',
                textTransform: 'uppercase',
                textShadow: '0 0 12px rgba(56, 189, 248, 0.4)'
              }}>
                Colégio Impacto
              </span>
              <span style={{
                fontSize: '9.5px',
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.6)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                Ambiente de Avaliação
              </span>
            </div>

            {/* Subtle Divider */}
            <div className="hidden sm:block" style={{
              width: '1px',
              height: '28px',
              background: 'rgba(255, 255, 255, 0.15)',
              flexShrink: 0,
              margin: '0 2px'
            }} />

            {/* Exam Title & Discipline */}
            <div style={{ minWidth: 0, flex: '1 1 auto' }}>
              <h2 className="er-topbar-title" style={{
                fontSize: '14.5px',
                fontWeight: 800,
                color: '#ffffff',
                margin: 0,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: '-0.01em',
                lineHeight: 1.25,
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)'
              }} title={prova.titulo}>
                {prova.titulo}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span className="er-topbar-subtitle" style={{
                  fontSize: '12px',
                  color: '#94a3b8',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {prova.disciplinaNome || prova.disciplina}
                </span>
                {prova.finalidade && (
                  <span style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    color: '#bae6fd',
                    background: 'rgba(14, 165, 233, 0.18)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    padding: '1px 7px',
                    borderRadius: '6px',
                    textTransform: 'uppercase'
                  }} className="hidden md:inline">
                    {prova.finalidade === 'avaliacao' ? 'Avaliação' : prova.finalidade}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Center: Autosave Status Pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {saveStatus === 'saved' && (
              <span className="er-topbar-save-status" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 13px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 700,
                background: 'rgba(16, 185, 129, 0.16)',
                color: '#34d399',
                border: '1px solid rgba(52, 211, 153, 0.4)',
                boxShadow: '0 0 14px rgba(16, 185, 129, 0.2)',
                backdropFilter: 'blur(8px)',
                letterSpacing: '0.01em'
              }}>
                <Check size={13} strokeWidth={3} color="#34d399" />
                <span className="hidden md:inline">Salvo {lastSavedAt && `(${lastSavedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`}</span>
                <span className="md:hidden">Salvo</span>
              </span>
            )}
            {saveStatus === 'saving' && (
              <span className="er-topbar-save-status" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 13px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 700,
                background: 'rgba(14, 165, 233, 0.18)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                boxShadow: '0 0 14px rgba(14, 165, 233, 0.25)',
                backdropFilter: 'blur(8px)',
                letterSpacing: '0.01em'
              }}>
                <RefreshCw size={13} className="animate-spin" color="#38bdf8" />
                <span className="hidden md:inline">Salvando respostas...</span>
                <span className="md:hidden">Salvando...</span>
              </span>
            )}
            {saveStatus === 'offline_queued' && (
              <span className="er-topbar-save-status" style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 13px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 700,
                background: 'rgba(245, 158, 11, 0.18)',
                color: '#fbbf24',
                border: '1px solid rgba(251, 191, 36, 0.45)',
                boxShadow: '0 0 14px rgba(245, 158, 11, 0.22)',
                backdropFilter: 'blur(8px)',
                letterSpacing: '0.01em'
              }}>
                <WifiOff size={13} color="#fbbf24" />
                <span className="hidden md:inline">Sem conexão — {pendingSyncCount} alterações</span>
                <span className="md:hidden">Offline ({pendingSyncCount})</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <button
                onClick={() => syncPendingAnswers()}
                className="er-topbar-save-status"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '5px 13px',
                  borderRadius: '20px',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  background: 'rgba(239, 68, 68, 0.22)',
                  color: '#f87171',
                  border: '1px solid rgba(248, 113, 113, 0.5)',
                  boxShadow: '0 0 14px rgba(239, 68, 68, 0.25)',
                  backdropFilter: 'blur(8px)',
                  cursor: 'pointer',
                  letterSpacing: '0.01em',
                  transition: 'all 0.15s ease'
                }}
              >
                <AlertCircle size={13} color="#f87171" />
                <span className="hidden md:inline">Falha ao sincronizar • Clique para reenviar</span>
                <span className="md:hidden">Reenviar</span>
              </button>
            )}
          </div>

          {/* Right: Timer, Accessibility, Calculator, Fullscreen & Deliver Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Countdown Timer */}
            <div className="er-topbar-timer" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '12px',
              fontWeight: 800,
              fontSize: '14px',
              border: isTimeCritical ? '1.5px solid rgba(239, 68, 68, 0.65)' : '1px solid rgba(255, 255, 255, 0.16)',
              background: isTimeCritical ? 'rgba(239, 68, 68, 0.22)' : 'rgba(255, 255, 255, 0.08)',
              color: isTimeCritical ? '#fca5a5' : '#ffffff',
              letterSpacing: '0.04em',
              backdropFilter: 'blur(10px)',
              boxShadow: isTimeCritical ? '0 0 16px rgba(239, 68, 68, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
              transition: 'all 0.2s ease'
            }}>
              <Clock size={15} color={isTimeCritical ? '#ef4444' : '#38bdf8'} className={isTimeCritical ? 'animate-pulse' : ''} />
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 800 }}>{formatTimer(timeRemainingSeconds)}</span>
            </div>

            {/* Accessibility Font Size Zoom */}
            <div className="hidden md:inline-flex" style={{
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.07)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '10px',
              padding: '2px',
              backdropFilter: 'blur(10px)'
            }}>
              <button
                type="button"
                onClick={() => setFontSize(prev => prev === 'lg' ? 'base' : 'sm')}
                title="Diminuir fonte (A-)"
                style={{
                  padding: '4px 9px',
                  borderRadius: '7px',
                  fontSize: '11px',
                  fontWeight: 800,
                  border: 'none',
                  background: fontSize === 'sm' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
                  color: fontSize === 'sm' ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  boxShadow: fontSize === 'sm' ? '0 1px 4px rgba(0, 0, 0, 0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontSize('base')}
                title="Fonte padrão (A)"
                style={{
                  padding: '4px 9px',
                  borderRadius: '7px',
                  fontSize: '11px',
                  fontWeight: 800,
                  border: 'none',
                  background: fontSize === 'base' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
                  color: fontSize === 'base' ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  boxShadow: fontSize === 'base' ? '0 1px 4px rgba(0, 0, 0, 0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontSize(prev => prev === 'sm' ? 'base' : 'lg')}
                title="Aumentar fonte (A+)"
                style={{
                  padding: '4px 9px',
                  borderRadius: '7px',
                  fontSize: '11px',
                  fontWeight: 800,
                  border: 'none',
                  background: fontSize === 'lg' ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
                  color: fontSize === 'lg' ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)',
                  cursor: 'pointer',
                  boxShadow: fontSize === 'lg' ? '0 1px 4px rgba(0, 0, 0, 0.3)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                A+
              </button>
            </div>

            {/* Calculator Toggle */}
            <button
              type="button"
              onClick={() => setCalculatorOpen(!calculatorOpen)}
              title="Calculadora Integrada"
              className="hidden md:inline-flex"
              style={{
                padding: '7px 13px',
                borderRadius: '10px',
                border: calculatorOpen ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.15)',
                background: calculatorOpen ? 'rgba(56, 189, 248, 0.22)' : 'rgba(255, 255, 255, 0.08)',
                color: calculatorOpen ? '#38bdf8' : '#e2e8f0',
                cursor: 'pointer',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 700,
                backdropFilter: 'blur(10px)',
                boxShadow: calculatorOpen ? '0 0 14px rgba(56, 189, 248, 0.35)' : '0 2px 6px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.15s ease'
              }}
            >
              <Calculator size={15} color={calculatorOpen ? '#38bdf8' : '#7dd3fc'} />
              <span className="hidden xl:inline">Calculadora</span>
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={enterFullscreen}
              title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
              className="hidden md:inline-flex"
              style={{
                padding: '7px 10px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.08)',
                color: '#e2e8f0',
                cursor: 'pointer',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
              }}
            >
              {isFullscreen ? <Minimize2 size={16} color="#7dd3fc" /> : <Maximize2 size={16} color="#7dd3fc" />}
            </button>

            {/* Exit / Return Button in Topbar */}
            <button
              type="button"
              onClick={() => setExitModalOpen(true)}
              title="Sair para a Agenda Digital"
              className="er-topbar-btn-exit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '7px 12px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#e2e8f0',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.35)'
                e.currentTarget.style.color = '#ffffff'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'
                e.currentTarget.style.color = '#e2e8f0'
              }}
            >
              <LogOut size={13} color="#94a3b8" />
              <span className="hidden sm:inline">Sair</span>
            </button>

            {/* Deliver Exam Top Button */}
            <button
              onClick={() => setSubmitModalOpen(true)}
              className="er-topbar-btn-deliver"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                transition: 'all 0.15s ease',
                letterSpacing: '0.02em',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 6px 18px rgba(16, 185, 129, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.45)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.35)'
              }}
            >
              <Send size={12} color="#ffffff" />
              <span>Entregar<span className="hidden sm:inline"> Prova</span></span>
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
            style={{
              background: '#0284c7',
              color: '#ffffff',
              padding: '10px 20px',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
              <Bell size={16} className="animate-bounce" />
              <span><strong>Mensagem do Professor:</strong> {teacherBroadcast}</span>
            </div>
            <button
              onClick={() => setTeacherBroadcast(null)}
              style={{ background: 'none', border: 'none', color: '#ffffff', textDecoration: 'underline', fontSize: '12px', cursor: 'pointer' }}
            >
              Dispensar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. SUSPENSION FULLSCREEN BLOCKER IF SUSPENDED */}
      {suspensionAlert && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)'
        }}>
          <div className="er-modal-box" style={{
            width: '100%',
            maxWidth: '480px',
            background: '#ffffff',
            borderRadius: '24px',
            border: '1.5px solid #fecdd3',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)',
            padding: '32px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '18px',
              background: '#fff1f2',
              border: '1px solid #fecdd3',
              color: '#e11d48',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Shield size={28} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Sessão Temporariamente Suspensa
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              {suspensionAlert}
            </p>
            <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: 0 }}>
              O tempo restante da sua prova permanece pausado e protegido no servidor.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => syncPendingAnswers()}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  background: '#f0f9ff',
                  border: '1.5px solid #bae6fd',
                  color: '#0369a1',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
              >
                <RefreshCw size={15} color="#0284c7" />
                Verificar se já fui liberado
              </button>
              <button
                type="button"
                onClick={() => setExitModalOpen(true)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  border: '1.5px solid #cbd5e1',
                  color: '#475569',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#94a3b8'
                  e.currentTarget.style.color = '#0f172a'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = '#cbd5e1'
                  e.currentTarget.style.color = '#475569'
                }}
              >
                <LogOut size={15} />
                Sair e Finalizar Prova
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3.1 FULLSCREEN ENFORCEMENT OVERLAY */}
      {requiresFullscreen && started && !isFullscreen && !submittedVoucher && !suspensionAlert && !cancelledModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(10px)'
        }}>
          <div className="er-modal-box" style={{
            width: '100%',
            maxWidth: '480px',
            background: '#ffffff',
            borderRadius: '24px',
            border: '1.5px solid #bae6fd',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.4)',
            padding: '32px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '18px',
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              color: '#0284c7',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Maximize2 size={28} />
            </div>
            <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              Modo Tela Cheia Obrigatório
            </h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
              Esta avaliação exige execução em tela cheia para garantir a integridade do processo avaliativo. Clique no botão abaixo para retornar à tela cheia e prosseguir.
            </p>
            <button
              type="button"
              onClick={enterFullscreen}
              style={{
                width: '100%',
                padding: '13px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                border: 'none',
                color: '#ffffff',
                fontSize: '13.5px',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.3)',
                transition: 'transform 0.15s'
              }}
            >
              <Maximize2 size={16} />
              Retornar para Tela Cheia
            </button>
          </div>
        </div>
      )}

      {/* 4. MAIN EXAM BODY (Split: Question View + Navigation Palette) */}
      <div className="exam-room-grid" style={{
        maxWidth: '1440px',
        margin: '0 auto',
        width: '100%',
        padding: '24px 20px',
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 300px',
        gap: '24px',
        alignItems: 'start'
      }}>
        {/* Left Column: Questions Content */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, gap: '24px' }}>
          {isSingleQuestionPage ? (
            <motion.div
              key={currentQuestion.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              {renderQuestionCard(currentQuestion, currentIndex, true)}
            </motion.div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {orderedQuestions.map((q, idx) => (
                <div key={q.id} id={`question-card-${idx}`} style={{ scrollMarginTop: '90px' }}>
                  {renderQuestionCard(q, idx, false)}
                </div>
              ))}
              {/* Continuous view completion card */}
              <div style={{
                background: '#ffffff',
                border: '1.5px solid #e2e8f0',
                borderRadius: '24px',
                padding: '24px 32px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                    Fim das questões da avaliação
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                    Revise suas respostas no painel de navegação antes de confirmar o envio definitivo.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: '44px',
                    padding: '0 28px',
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '13.5px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <Send size={15} />
                  Revisar e Entregar Prova
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Question Navigation Palette (Sticky) */}
        <div className="exam-room-sidebar" style={{
          position: 'sticky',
          top: '80px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div className="er-nav-card" style={{
            background: '#ffffff',
            border: '1.5px solid #e2e8f0',
            borderRadius: '24px',
            padding: '22px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Palette Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Navegação
              </span>
              <span style={{
                fontSize: '11.5px',
                fontWeight: 800,
                color: '#0284c7',
                background: '#f0f9ff',
                padding: '3px 8px',
                borderRadius: '8px',
                border: '1px solid #bae6fd'
              }}>
                {answeredCount}/{orderedQuestions.length} respondidas
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '6px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{
                width: `${(answeredCount / orderedQuestions.length) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #0284c7, #10b981)',
                borderRadius: '999px',
                transition: 'width 0.3s ease'
              }} />
            </div>

            {/* Question Quick Access Grid (Fixed neat pills) */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px'
            }}>
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
                const isNavDisabled = isSingleQuestionPage && (
                  (!allowReturn && idx < currentIndex) ||
                  (!isFreeNavigation && idx > currentIndex + 1)
                )

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => goToQuestion(idx)}
                    disabled={isNavDisabled}
                    className="er-nav-qbtn"
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: isNavDisabled ? 'not-allowed' : 'pointer',
                      opacity: isNavDisabled ? 0.35 : 1,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.15s ease',
                      border: isCurrent
                        ? '2px solid #0284c7'
                        : isAnswered
                        ? '1.5px solid #86efac'
                        : '1.5px solid #e2e8f0',
                      background: isCurrent
                        ? '#e0f2fe'
                        : isAnswered
                        ? '#f0fdf4'
                        : '#f8fafc',
                      color: isCurrent
                        ? '#0284c7'
                        : isAnswered
                        ? '#15803d'
                        : '#475569',
                      boxShadow: isCurrent ? '0 0 0 3px rgba(2, 132, 199, 0.15)' : 'none'
                    }}
                  >
                    {idx + 1}
                    {isFlag && (
                      <span style={{
                        position: 'absolute',
                        top: '-3px',
                        right: '-3px',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: '#f59e0b',
                        border: '2px solid #ffffff'
                      }} />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Legend */}
            <div style={{
              borderTop: '1px solid #f1f5f9',
              paddingTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '11.5px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '4px', background: '#bbf7d0', border: '1px solid #86efac' }} />
                <span>Respondida ({answeredCount})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '4px', background: '#f8fafc', border: '1px solid #cbd5e1' }} />
                <span>Em branco ({blankCount})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#b45309' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                <span>Marcada para revisar ({flaggedIds.size})</span>
              </div>
            </div>

            {/* Final Submit Button */}
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setSubmitModalOpen(true)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
                  transition: 'transform 0.15s, box-shadow 0.15s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.35)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.25)'
                }}
              >
                <CheckCircle2 size={16} />
                Finalizar e Entregar Prova
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. SUBMISSION CONFIRMATION MODAL */}
      <AnimatePresence>
        {submitModalOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="er-modal-box"
              style={{
                width: '100%',
                maxWidth: '480px',
                background: '#ffffff',
                borderRadius: '24px',
                border: '1.5px solid #e2e8f0',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.25)',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '16px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#15803d',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Send size={22} />
              </div>

              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>
                  Confirmar Entrega da Avaliação
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                  Revise o resumo das suas respostas antes de realizar o envio definitivo:
                </p>
              </div>

              {/* Status summary list */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '13px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Total de Questões:</span>
                  <strong style={{ color: '#0f172a' }}>{orderedQuestions.length}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Questões Respondidas:</span>
                  <strong style={{ color: '#15803d' }}>{answeredCount}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Questões em Branco:</span>
                  <strong style={{ color: blankCount > 0 ? '#b45309' : '#94a3b8' }}>
                    {blankCount}
                  </strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Marcadas para Revisão:</span>
                  <strong style={{ color: '#b45309' }}>{flaggedIds.size}</strong>
                </div>
              </div>

              {blankCount > 0 && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  fontSize: '12.5px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0 }} />
                  <span>Você ainda possui <strong>{blankCount} questão(ões)</strong> sem resposta preenchida.</span>
                </div>
              )}

              <p style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                Após confirmar, suas respostas serão registradas e um comprovante digital oficial será gerado. Não será possível alterar respostas após a entrega.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '4px' }}>
                <button
                  type="button"
                  onClick={() => setSubmitModalOpen(false)}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '11px 14px',
                    borderRadius: '12px',
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    color: '#334155',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Continuar Respondendo
                </button>

                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '11px 14px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Entregando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      Sim, Entregar Prova
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5.1 EXIT CONFIRMATION MODAL */}
      <AnimatePresence>
        {exitModalOpen && (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="er-modal-box"
              style={{
                width: '100%',
                maxWidth: '460px',
                background: '#ffffff',
                borderRadius: '24px',
                border: '1.5px solid #fecdd3',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)',
                padding: '28px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}
            >
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: '#fff1f2',
                border: '1.5px solid #fecdd3',
                color: '#e11d48',
                margin: '0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(225, 29, 72, 0.15)'
              }}>
                <AlertTriangle size={26} />
              </div>

              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>
                  Encerrar e Sair da Avaliação?
                </h2>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0, lineHeight: 1.5 }}>
                  Atenção: Ao sair, a prova será <strong>concluída definitivamente</strong> no sistema.
                </p>
              </div>

              {/* Box de alerta bem evidente */}
              <div style={{
                background: '#fff7ed',
                border: '1.5px solid #fed7aa',
                borderRadius: '16px',
                padding: '14px 16px',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#c2410c', fontWeight: 800, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <AlertTriangle size={15} />
                  Aviso Importante de Encerramento
                </div>
                <p style={{ fontSize: '12.5px', color: '#9a3412', margin: 0, lineHeight: 1.55 }}>
                  As perguntas que você respondeu <strong>ficarão salvas</strong> e serão computadas na sua nota. Porém, <strong>as questões não respondidas serão anuladas (sem pontuação)</strong>. Você <strong>não poderá retornar</strong> à prova após sair.
                </p>
              </div>

              {/* Resumo das questões */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '12.5px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <CheckCircle2 size={15} color="#16a34a" />
                    {answeredCount} questão(ões) respondida(s)
                  </span>
                  <span style={{ fontSize: '11px', color: '#166534', fontWeight: 800, background: '#dcfce7', padding: '2px 8px', borderRadius: '6px' }}>
                    Ficarão salvas
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: blankCount > 0 ? '#b91c1c' : '#64748b', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                    <XCircle size={15} color={blankCount > 0 ? '#dc2626' : '#94a3b8'} />
                    {blankCount} questão(ões) em branco
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: blankCount > 0 ? '#991b1b' : '#64748b',
                    fontWeight: 800,
                    background: blankCount > 0 ? '#fee2e2' : '#f1f5f9',
                    padding: '2px 8px',
                    borderRadius: '6px'
                  }}>
                    {blankCount > 0 ? 'Serão anuladas (0 pts)' : 'Nenhuma em branco'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setExitModalOpen(false)}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '11px 14px',
                    borderRadius: '12px',
                    background: '#ffffff',
                    border: '1.5px solid #cbd5e1',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer'
                  }}
                >
                  Continuar na Prova
                </button>
                <button
                  type="button"
                  onClick={handleConfirmExitAndSubmit}
                  disabled={submitting}
                  style={{
                    flex: 1,
                    padding: '11px 14px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #e11d48, #be123c)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 800,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 14px rgba(225, 29, 72, 0.3)'
                  }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      Encerrando...
                    </>
                  ) : (
                    <>
                      <LogOut size={15} />
                      Encerrar e Sair
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5.2 MODAL ULTRA MODERNO DE BLOQUEIO DE CAPTURA DE PRINT */}
      <PrintBlockedModal
        isOpen={printBlockedModalOpen}
        onClose={() => setPrintBlockedModalOpen(false)}
        triggerSource={lastPrintSource}
        timestamp={lastPrintTimestamp}
      />

      {/* 6. POPUP FLOATING CALCULATOR */}
      {calculatorOpen && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 50,
          background: '#ffffff',
          border: '1.5px solid #cbd5e1',
          borderRadius: '20px',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.18)',
          padding: '16px',
          width: '260px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calculator size={15} color="#0284c7" />
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>Calculadora</span>
            </div>
            <button
              type="button"
              onClick={() => setCalculatorOpen(false)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Calculator Screen */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '10px 12px',
            textAlign: 'right'
          }}>
            <div style={{ fontSize: '11px', color: '#94a3b8', height: '16px', overflow: 'hidden' }}>
              {calcPrev || ' '}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.04em' }}>
              {calcDisplay}
            </div>
          </div>

          {/* Calculator Buttons Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
            <button
              type="button"
              onClick={() => handleCalcClick('C')}
              style={{ padding: '8px', borderRadius: '10px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleCalcClick('DEL')}
              style={{ padding: '8px', borderRadius: '10px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
            >
              ⌫
            </button>
            <button
              type="button"
              onClick={() => handleCalcClick('√')}
              style={{ padding: '8px', borderRadius: '10px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', fontWeight: 800, fontSize: '12px', cursor: 'pointer' }}
            >
              √
            </button>
            <button
              type="button"
              onClick={() => handleCalcClick('÷')}
              style={{ padding: '8px', borderRadius: '10px', background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}
            >
              ÷
            </button>

            {['7', '8', '9'].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => handleCalcClick(n)}
                style={{ padding: '8px', borderRadius: '10px', background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleCalcClick('×')}
              style={{ padding: '8px', borderRadius: '10px', background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}
            >
              ×
            </button>

            {['4', '5', '6'].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => handleCalcClick(n)}
                style={{ padding: '8px', borderRadius: '10px', background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleCalcClick('-')}
              style={{ padding: '8px', borderRadius: '10px', background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}
            >
              -
            </button>

            {['1', '2', '3'].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => handleCalcClick(n)}
                style={{ padding: '8px', borderRadius: '10px', background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleCalcClick('+')}
              style={{ padding: '8px', borderRadius: '10px', background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}
            >
              +
            </button>

            <button
              type="button"
              onClick={() => handleCalcClick('0')}
              style={{ gridColumn: 'span 2', padding: '8px', borderRadius: '10px', background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleCalcClick('.')}
              style={{ padding: '8px', borderRadius: '10px', background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }}
            >
              .
            </button>
            <button
              type="button"
              onClick={() => handleCalcClick('=')}
              style={{ padding: '8px', borderRadius: '10px', background: '#0284c7', color: '#ffffff', border: 'none', fontWeight: 800, fontSize: '14px', cursor: 'pointer' }}
            >
              =
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 1024px) {
          .exam-room-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .exam-room-sidebar {
            position: static !important;
            order: 2;
          }
        }
      `}} />
    </div>
  )
}
