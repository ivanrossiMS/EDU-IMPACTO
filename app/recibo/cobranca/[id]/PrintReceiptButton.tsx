'use client'

import React from 'react'

export function PrintReceiptButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      style={{
        padding: '10px 18px',
        borderRadius: 12,
        border: 'none',
        background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
        color: '#ffffff',
        fontSize: 13.5,
        fontWeight: 800,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: '0 4px 14px rgba(5, 150, 105, 0.28)'
      }}
    >
      Imprimir / Salvar PDF
    </button>
  )
}
