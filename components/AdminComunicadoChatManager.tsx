'use client'

import React, { useState, useEffect } from 'react'
import { Loader2, MessageCircle, ChevronRight, User } from 'lucide-react'
import { ComunicadoChat } from './ComunicadoChat'

interface AdminComunicadoChatManagerProps {
  comunicadoId: string
  comunicadoTitulo: string
}

interface Respondent {
  remetente_id: string
  remetente_nome: string
  last_message_at: string
  message_count: number
}

export function AdminComunicadoChatManager({ comunicadoId, comunicadoTitulo }: AdminComunicadoChatManagerProps) {
  const [respondents, setRespondents] = useState<Respondent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRespondent, setSelectedRespondent] = useState<Respondent | null>(null)

  useEffect(() => {
    fetchRespondents()
  }, [comunicadoId])

  const fetchRespondents = async () => {
    try {
      const res = await fetch(`/api/comunicados_respostas?comunicado_id=${comunicadoId}&admin=true`)
      if (res.ok) {
        const messages = await res.json()
        
        // Group by remetente_id
        const grouped = new Map<string, Respondent>()
        for (const msg of messages) {
          if (msg.is_admin) continue // skip our own messages when building the list of respondents
          
          if (!grouped.has(msg.remetente_id)) {
            grouped.set(msg.remetente_id, {
              remetente_id: msg.remetente_id,
              remetente_nome: msg.remetente_nome,
              last_message_at: msg.created_at,
              message_count: 1
            })
          } else {
            const current = grouped.get(msg.remetente_id)!
            current.message_count++
            if (new Date(msg.created_at) > new Date(current.last_message_at)) {
              current.last_message_at = msg.created_at
            }
          }
        }
        
        // Convert to array and sort by latest message
        const list = Array.from(grouped.values()).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
        setRespondents(list)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (selectedRespondent) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <button 
          className="btn btn-secondary btn-sm" 
          onClick={() => setSelectedRespondent(null)}
          style={{ alignSelf: 'flex-start', padding: '6px 12px', fontSize: 13 }}
        >
          &larr; Voltar para a lista de respostas
        </button>
        <div style={{ background: '#f8fafc', padding: '16px 24px', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#4f46e5', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 }}>
            {selectedRespondent.remetente_nome.charAt(0).toUpperCase()}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>{selectedRespondent.remetente_nome}</h4>
            <span style={{ fontSize: 13, color: '#64748b' }}>Chat Privado • {comunicadoTitulo}</span>
          </div>
        </div>
        
        <ComunicadoChat 
          comunicadoId={comunicadoId} 
          remetenteId={selectedRespondent.remetente_id} 
          remetenteNome="Equipe Escolar" 
          isAdmin={true} 
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <MessageCircle size={20} color="#4f46e5" />
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#1e293b' }}>Respostas Recebidas ({respondents.length})</h3>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="animate-spin" color="#94a3b8" /></div>
      ) : respondents.length === 0 ? (
        <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 16, padding: '32px 24px', textAlign: 'center' }}>
          <MessageCircle size={32} color="#cbd5e1" style={{ margin: '0 auto 12px auto' }} />
          <h4 style={{ fontSize: 15, fontWeight: 700, color: '#475569', margin: 0 }}>Nenhuma resposta ainda</h4>
          <p style={{ fontSize: 13, color: '#94a3b8', margin: '4px 0 0 0' }}>Quando os responsáveis responderem a este comunicado, os chats aparecerão aqui.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {respondents.map(r => (
            <button
              key={r.remetente_id}
              onClick={() => setSelectedRespondent(r)}
              style={{ 
                background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '16px 20px', 
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, cursor: 'pointer',
                transition: 'all 0.2s', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = '#4f46e5'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(79,70,229,0.1)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = '#e2e8f0'
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={20} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{r.remetente_nome}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {r.message_count} {r.message_count === 1 ? 'mensagem' : 'mensagens'} • Última em {new Date(r.last_message_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
              <ChevronRight size={20} color="#cbd5e1" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
