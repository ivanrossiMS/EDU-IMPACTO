'use client'

import React from 'react'
import { AlertCircle, Inbox } from 'lucide-react'

interface EmptyStateProps {
  message?: string
  description?: string
}

export function EmptyState({ message = 'Nenhum registro encontrado', description = 'Não encontramos dados para os filtros selecionados.' }: EmptyStateProps) {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
      <Inbox size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
      <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>{message}</h3>
      <p style={{ fontSize: '14px' }}>{description}</p>
    </div>
  )
}

interface ErrorStateProps {
  message?: string
  onRetry?: () => void
}

export function ErrorState({ message = 'Erro ao carregar dados', onRetry }: ErrorStateProps) {
  return (
    <div style={{ padding: '40px', textAlign: 'center', color: '#ef4444' }}>
      <AlertCircle size={48} style={{ margin: '0 auto 16px', opacity: 0.8 }} />
      <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>{message}</h3>
      {onRetry && (
        <button 
          onClick={onRetry}
          style={{ marginTop: '12px', background: '#ef4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
        >
          Tentar novamente
        </button>
      )}
    </div>
  )
}

export function UpdatingIndicator() {
  return (
    <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ width: '6px', height: '6px', background: '#3b82f6', borderRadius: '50%', display: 'inline-block' }} />
      Atualizando...
    </span>
  )
}
