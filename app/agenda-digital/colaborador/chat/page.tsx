'use client'

import React from 'react'
import { ChatFullView } from '@/components/chat/ChatFullView'

export default function ColaboradorChatPage() {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 20px' }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', margin: '0 0 4px 0', letterSpacing: '-0.02em' }}>
          Chat dos Educadores e Turmas
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
          Atendimento institucional aos alunos e interação com a equipe escolar.
        </p>
      </div>

      <ChatFullView />
    </div>
  )
}
