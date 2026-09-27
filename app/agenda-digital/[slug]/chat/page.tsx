'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { ChatFullView } from '@/components/chat/ChatFullView'

export default function StudentChatPage() {
  const params = useParams<{ slug: string }>()
  const alunoId = params?.slug || ''

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 16px' }}>
      <div style={{ marginBottom: 14 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
          Chat da Escola e Turma
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
          Fale diretamente com os canais oficiais da escola e com a equipe educacional da sua turma.
        </p>
      </div>

      <ChatFullView alunoId={alunoId} />
    </div>
  )
}
