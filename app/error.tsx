'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()
  const [correlationId, setCorrelationId] = useState<string>('')

  useEffect(() => {
    try {
      console.error('[Root Error Boundary] Erro capturado na rota raiz:', error)
      const cur = sessionStorage?.getItem('edu_current_startup_diagnostic')
      if (cur) {
        const parsed = JSON.parse(cur)
        if (parsed?.correlationId) setCorrelationId(parsed.correlationId)
      }
    } catch {}
  }, [error])

  const handleReload = () => {
    try {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.set('_r', String(Date.now()))
        window.location.href = url.toString()
      }
    } catch {
      window.location.reload()
    }
  }

  const handleGoLogin = () => {
    router.replace('/login')
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#0A0F24',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        zIndex: 999999,
        boxSizing: 'border-box',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: '440px',
          width: '100%',
          background: 'linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 15, 36, 0.98) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '24px',
          padding: '36px 28px',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6)',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'rgba(59, 130, 246, 0.12)',
            border: '1px solid rgba(59, 130, 246, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#60a5fa"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
        </div>

        <h1
          style={{
            fontSize: '22px',
            fontWeight: 800,
            color: '#ffffff',
            margin: '0 0 10px',
            letterSpacing: '-0.02em',
          }}
        >
          Instabilidade de Conexão
        </h1>

        <p
          style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.65)',
            lineHeight: 1.6,
            margin: '0 0 24px',
          }}
        >
          Não foi possível conectar ao servidor ou sincronizar os dados da sessão. Nenhuma informação local foi perdida.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={() => {
              try { reset() } catch { handleReload() }
            }}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
              border: 'none',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(59, 130, 246, 0.35)',
            }}
          >
            Tentar Novamente
          </button>

          <button
            onClick={handleReload}
            style={{
              width: '100%',
              padding: '13px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Recarregar Aplicação
          </button>

          <button
            onClick={handleGoLogin}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '12px',
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.45)',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Ir para Tela de Acesso
          </button>
        </div>

        {correlationId && (
          <div
            style={{
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '10.5px',
              fontFamily: 'monospace',
              color: 'rgba(255, 255, 255, 0.35)',
            }}
          >
            Protocolo de Diagnóstico: {correlationId}
          </div>
        )}
      </div>
    </div>
  )
}
