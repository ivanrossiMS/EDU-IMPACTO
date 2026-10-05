'use client'

import { useEffect } from 'react'
import { startupDiagnostics } from '@/lib/diagnostics/startupDiagnostics'

const CHUNK_RELOAD_KEY = 'edu_chunk_reload_attempt'
const CHUNK_RELOAD_COOLDOWN_MS = 45000 // 45s de proteção contra reload loop

export function GlobalCrashShield() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const isChunkFailure = (message: string): boolean => {
      const msg = message.toLowerCase()
      return (
        msg.includes('chunkloaderror') ||
        msg.includes('loading chunk') ||
        msg.includes('failed to fetch dynamically imported module') ||
        msg.includes('error loading dynamic library') ||
        msg.includes('importing a module script failed') ||
        (msg.includes('unexpected token') && msg.includes('<')) // HTML 404 retornado no lugar do JS chunk
      )
    }

    const handleChunkErrorRecovery = (errorMsg: string) => {
      try {
        const lastAttempt = Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0')
        const now = Date.now()

        startupDiagnostics.recordError('chunk_load_failure', {
          error: errorMsg.substring(0, 150),
          lastAttempt,
        })

        if (now - lastAttempt > CHUNK_RELOAD_COOLDOWN_MS) {
          console.warn('[CrashShield] Detectada falha de chunk após atualização. Executando reload de auto-recuperação...')
          sessionStorage.setItem(CHUNK_RELOAD_KEY, String(now))
          // Pequeno delay para registrar log antes de recarregar
          setTimeout(() => {
            const url = new URL(window.location.href)
            url.searchParams.set('_v', String(now))
            window.location.href = url.toString()
          }, 150)
          return true
        } else {
          console.error('[CrashShield] Falha de chunk repetida dentro do cooldown. Evitando loop de recarregamento.')
        }
      } catch {}
      return false
    }

    // 1. Interceptar erros globais de script
    const handleWindowError = (event: ErrorEvent) => {
      const msg = event?.message || event?.error?.message || ''
      if (isChunkFailure(msg)) {
        const recovered = handleChunkErrorRecovery(msg)
        if (recovered) {
          event.preventDefault()
          return
        }
      }

      startupDiagnostics.recordError('window_uncaught_error', {
        message: msg.substring(0, 120),
        filename: event?.filename || 'unknown',
        lineno: event?.lineno || 0,
      })
    }

    // 2. Interceptar Promises rejeitadas não tratadas (ex: falhas de importação dinâmica)
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason
      const msg = reason?.message || (typeof reason === 'string' ? reason : '')

      if (isChunkFailure(msg)) {
        const recovered = handleChunkErrorRecovery(msg)
        if (recovered) {
          event.preventDefault()
          return
        }
      }

      startupDiagnostics.recordError('unhandled_rejection', {
        reason: msg.substring(0, 150),
      })
    }

    window.addEventListener('error', handleWindowError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)

    return () => {
      window.removeEventListener('error', handleWindowError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  return null
}
