'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[EDU-IMPACTO] Erro não tratado:', error)

    // Log to system_logs via API (fire-and-forget)
    fetch('/api/system-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        modulo: 'App',
        acao: 'ERRO_CRITICO',
        descricao: `${error.name}: ${error.message}`,
        dados: { digest: error.digest, stack: error.stack?.substring(0, 500) },
      }),
    }).catch(() => {})
  }, [error])

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: 32,
    }}>
      <div style={{
        background: 'hsl(var(--bg-elevated))',
        border: '1px solid hsl(var(--border-subtle))',
        borderRadius: 20,
        padding: '48px 40px',
        maxWidth: 480,
        width: '100%',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 4,
          background: 'linear-gradient(90deg, #f43f5e, #f59e0b)',
          borderRadius: '20px 20px 0 0',
        }} />

        {/* Icon */}
        <div style={{
          width: 72, height: 72, borderRadius: 20,
          background: 'rgba(244, 63, 94, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <AlertTriangle size={36} color="#f43f5e" />
        </div>

        <h2 style={{
          fontSize: 20, fontWeight: 800, fontFamily: 'Outfit, sans-serif',
          color: 'hsl(var(--text-primary))', margin: '0 0 8px',
        }}>
          Algo deu errado
        </h2>

        <p style={{
          fontSize: 14, color: 'hsl(var(--text-muted))',
          lineHeight: 1.6, margin: '0 0 8px',
        }}>
          Ocorreu um erro inesperado. Seus dados estão seguros.
        </p>

        {error.digest && (
          <p style={{
            fontSize: 11, color: 'hsl(var(--text-muted))',
            opacity: 0.6, fontFamily: 'monospace', margin: '0 0 24px',
          }}>
            Código: {error.digest}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 24 }}>
          <button
            onClick={reset}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 12,
              background: '#3b82f6', color: '#fff',
              fontSize: 14, fontWeight: 700, border: 'none',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2563eb')}
            onMouseLeave={e => (e.currentTarget.style.background = '#3b82f6')}
          >
            <RefreshCw size={16} />
            Tentar novamente
          </button>

          <button
            onClick={() => (window.location.href = '/dashboard')}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', borderRadius: 12,
              background: 'hsl(var(--bg-overlay))',
              color: 'hsl(var(--text-secondary))',
              fontSize: 14, fontWeight: 600, border: '1px solid hsl(var(--border-subtle))',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <Home size={16} />
            Início
          </button>
        </div>
      </div>
    </div>
  )
}
