'use client'

import React from 'react'
import { formatCurrency } from '@/lib/utils'

interface GraficoProps {
  receitas: number
  despesas: number
  height?: number
}

export function GraficoReceitaDespesa({ receitas, despesas, height = 30 }: GraficoProps) {
  const max = Math.max(receitas, despesas, 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {/* Barra de Receita */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>Receitas</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>{formatCurrency(receitas)}</span>
        </div>
        <div style={{ width: '100%', height, background: 'rgba(16,185,129,0.1)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${(receitas / max) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #059669)', transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* Barra de Despesa */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>Despesas</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444' }}>{formatCurrency(despesas)}</span>
        </div>
        <div style={{ width: '100%', height, background: 'rgba(239,68,68,0.1)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${(despesas / max) * 100}%`, height: '100%', background: 'linear-gradient(90deg, #ef4444, #dc2626)', transition: 'width 0.5s ease' }} />
        </div>
      </div>
    </div>
  )
}
