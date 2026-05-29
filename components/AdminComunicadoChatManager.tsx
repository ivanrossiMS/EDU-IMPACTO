'use client'

import React from 'react'
import { MessageCircle, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface AdminComunicadoChatManagerProps {
  comunicadoId: string
  comunicadoTitulo: string
}

export function AdminComunicadoChatManager({ comunicadoId, comunicadoTitulo }: AdminComunicadoChatManagerProps) {
  const router = useRouter()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <MessageCircle size={20} color="#4f46e5" />
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#1e293b' }}>Conversas do Comunicado</h3>
      </div>

      <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
        <MessageCircle size={32} color="#cbd5e1" style={{ margin: '0 auto 12px auto' }} />
        <h4 style={{ fontSize: 15, fontWeight: 700, color: '#475569', margin: 0 }}>O sistema de mensagens foi atualizado</h4>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 16px 0' }}>Toda a comunicação com famílias e alunos agora acontece na central de mensagens.</p>
        <button 
          onClick={() => router.push('/agenda-digital/mensagens')}
          style={{ padding: '8px 16px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          Ir para Mensagens <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
