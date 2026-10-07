/**
 * lib/diagnostics/startupDiagnostics.ts
 *
 * Módulo seguro e resiliente de auditoria e diagnóstico do ciclo de abertura do Impacto EDU.
 * - Registra cada etapa com duração relativa (ms) e identificador de correlação único.
 * - NUNCA registra senhas, tokens, dados pessoais ou de alunos (LGPD compliant).
 * - Totalmente isolado: qualquer erro interno de storage ou serialization é silenciado
 *   para garantir que o sistema de logs JAMAIS impeça ou atrase a abertura da aplicação.
 */

import { Capacitor } from '@capacitor/core'

export interface StartupMilestone {
  step: string
  milestone: string
  timestamp: number
  elapsedMs: number
  meta?: Record<string, any>
  data?: Record<string, any>
}

export interface StartupDiagnosticRecord {
  correlationId: string
  startedAt: string
  platform: 'ios' | 'android' | 'web'
  isNative: boolean
  appVersion: string
  isOnline: boolean
  milestones: StartupMilestone[]
  completedAt?: string
  totalDurationMs?: number
  hasError: boolean
  errorSummary?: string
}

const STORAGE_KEY = 'edu_startup_diagnostics_history'
const MAX_HISTORY_RECORDS = 8
const APP_VERSION = '1.0.11'
const SENSITIVE_KEY_REGEX = /password|token|secret|aluno|nome|matricula|cpf|email|rg|telefone|auth|bearer/i

function sanitizeMeta(meta?: any): Record<string, any> | undefined {
  if (!meta || typeof meta !== 'object') return undefined
  try {
    const clean: Record<string, any> = {}
    for (const [key, value] of Object.entries(meta)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        clean[key] = '[REDACTED]'
      } else if (typeof value === 'object' && value !== null) {
        clean[key] = '[OBJECT]'
      } else {
        clean[key] = value
      }
    }
    return clean
  } catch {
    return { sanitized: true }
  }
}

class StartupDiagnostics {
  private static instance: StartupDiagnostics
  private record: StartupDiagnosticRecord | null = null
  private startPerfTime: number = 0

  private constructor() {
    this.initSession()
  }

  public static getInstance(): StartupDiagnostics {
    if (!StartupDiagnostics.instance) {
      StartupDiagnostics.instance = new StartupDiagnostics()
    }
    return StartupDiagnostics.instance
  }

  public initSession(): string {
    try {
      this.startPerfTime = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const randomSuffix = Math.random().toString(36).substring(2, 8)
      const correlationId = `start_${Date.now()}_${randomSuffix}`

      let platform: 'ios' | 'android' | 'web' = 'web'
      let isNative = false
      try {
        isNative = Capacitor.isNativePlatform()
        const raw = isNative ? Capacitor.getPlatform() : 'web'
        platform = raw === 'ios' ? 'ios' : raw === 'android' ? 'android' : 'web'
      } catch {}

      const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

      this.record = {
        correlationId,
        startedAt: new Date().toISOString(),
        platform,
        isNative,
        appVersion: APP_VERSION,
        isOnline,
        milestones: [],
        hasError: false,
      }

      this.recordMilestone('app_lifecycle_init', {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 100) : 'unknown',
        viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 0,
      })
      return correlationId
    } catch {
      return 'unknown'
    }
  }

  public init(): string {
    return this.initSession()
  }

  public getCorrelationId(): string {
    return this.record?.correlationId || 'unknown'
  }

  public recordMilestone(
    step: string | null | undefined,
    meta?: any
  ): void {
    if (!this.record) {
      this.initSession()
    }
    if (!this.record) return
    try {
      const stepName = String(step || 'unnamed_step')
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      const elapsedMs = Math.round(now - this.startPerfTime)
      const sanitized = sanitizeMeta(meta)

      const milestone: StartupMilestone = {
        step: stepName,
        milestone: stepName,
        timestamp: Date.now(),
        elapsedMs,
        meta: sanitized,
        data: sanitized,
      }

      this.record.milestones.push(milestone)

      if (process.env.NODE_ENV !== 'production' && typeof console !== 'undefined') {
        console.log(`⏱️ [Startup][${this.record.correlationId}][+${elapsedMs}ms] ${stepName}`, sanitized || '')
      }

      this.persistSafely()
    } catch {}
  }

  public mark(step: string | null | undefined, meta?: any): void {
    this.recordMilestone(step, meta)
  }

  public getLogs(): StartupMilestone[] {
    return this.record?.milestones || []
  }

  public recordError(step: string | null | undefined, error: any, meta?: any): void {
    if (!this.record) {
      this.initSession()
    }
    if (!this.record) return
    try {
      const stepName = String(step || 'unknown_error')
      const errMsg = error?.message || (typeof error === 'string' ? error : 'Unknown error')
      this.record.hasError = true
      this.record.errorSummary = `[${stepName}] ${errMsg.substring(0, 180)}`

      const sanitizedMeta = sanitizeMeta(meta) || {}
      this.recordMilestone(`error_${stepName}`, {
        ...sanitizedMeta,
        errorName: error?.name || 'Error',
        errorMessage: errMsg.substring(0, 120),
      })

      if (typeof console !== 'undefined' && console.warn) {
        console.warn(`⚠️ [Startup Error][${this.record.correlationId}] in ${stepName}:`, error)
      }
      this.persistSafely()
    } catch {}
  }

  public markUsable(destinationRoute?: string): void {
    if (!this.record) return
    try {
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
      this.record.totalDurationMs = Math.round(now - this.startPerfTime)
      this.record.completedAt = new Date().toISOString()

      this.recordMilestone('first_usable_screen', {
        destination: destinationRoute || 'unknown',
        totalMs: this.record.totalDurationMs,
      })

      this.persistSafely()
    } catch {}
  }

  private persistSafely(): void {
    if (typeof window === 'undefined' || !this.record) return
    try {
      if (window.sessionStorage) {
        window.sessionStorage.setItem('edu_current_startup_diagnostic', JSON.stringify(this.record))
      }

      if (window.localStorage) {
        let history: StartupDiagnosticRecord[] = []
        try {
          const raw = window.localStorage.getItem(STORAGE_KEY)
          if (raw) history = JSON.parse(raw)
        } catch {}

        if (!Array.isArray(history)) history = []

        history = history.filter(h => h.correlationId !== this.record?.correlationId)
        history.unshift(this.record)

        if (history.length > MAX_HISTORY_RECORDS) {
          history = history.slice(0, MAX_HISTORY_RECORDS)
        }

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
      }
    } catch {}
  }

  public getHistory(): StartupDiagnosticRecord[] {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    } catch {}
    return []
  }

  public getCurrentRecord(): StartupDiagnosticRecord | null {
    return this.record
  }
}

export const startupDiagnostics = StartupDiagnostics.getInstance()
