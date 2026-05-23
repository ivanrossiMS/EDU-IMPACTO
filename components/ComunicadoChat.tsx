'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Paperclip, Send, Loader2, X, FileText } from 'lucide-react'

interface ChatMessage {
  id: string
  comunicado_id: string
  remetente_id: string
  remetente_nome: string
  conteudo: string
  anexos: string[]
  is_admin: boolean
  created_at: string
}

interface ComunicadoChatProps {
  comunicadoId: string
  remetenteId: string
  remetenteNome: string
  remetenteAvatar?: string
  isAdmin?: boolean
  adminAvatar?: string
}

function timeAgoShort(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diffInSeconds < 60) return 'agora'
  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) return `${diffInMinutes}m`
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h`
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d`
  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) return `${diffInWeeks}sem`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function ComunicadoChat({ comunicadoId, remetenteId, remetenteNome, remetenteAvatar, isAdmin = false, adminAvatar }: ComunicadoChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [pendingAnexos, setPendingAnexos] = useState<string[]>([])
  
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const fetchMessages = async () => {
    try {
      const url = isAdmin 
        ? `/api/comunicados_respostas?comunicado_id=${comunicadoId}&admin=true`
        : `/api/comunicados_respostas?comunicado_id=${comunicadoId}&remetente_id=${remetenteId}`;
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setMessages(data)
      }
    } catch (e) {
      console.error('Error fetching messages', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 10000)
    return () => clearInterval(interval)
  }, [comunicadoId, remetenteId, isAdmin])

  const handleSend = async () => {
    if (!newMessage.trim() && pendingAnexos.length === 0) return
    setIsSending(true)
    
    try {
      const payload = {
        comunicado_id: comunicadoId,
        remetente_id: remetenteId,
        remetente_nome: remetenteNome,
        conteudo: newMessage.trim(),
        anexos: pendingAnexos,
        is_admin: isAdmin
      }

      const res = await fetch('/api/comunicados_respostas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data])
        setNewMessage('')
        setPendingAnexos([])
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } catch (e) {
      console.error('Error sending message', e)
    } finally {
      setIsSending(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    setIsUploading(true)
    const formData = new FormData()
    Array.from(e.target.files).forEach(f => formData.append('files', f))
    
    try {
      const res = await fetch('/api/upload-midia', {
        method: 'POST',
        body: formData
      })
      if (res.ok) {
        const data = await res.json()
        setPendingAnexos(prev => [...prev, ...data.urls])
      }
    } catch (err) {
      console.error('Upload failed', err)
    } finally {
      setIsUploading(false)
      if (e.target) e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', borderTop: '1px solid #f1f5f9', paddingTop: 16 }}>
      
      {/* Feed Area */}
      {messages.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', margin: '0 0 16px 0' }}>
            Respostas ({messages.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 400, overflowY: 'auto', paddingRight: 4 }}>
            {messages.map((msg, idx) => {
              const isMe = msg.remetente_id === remetenteId && msg.is_admin === isAdmin
              const isLast = idx === messages.length - 1
              
              const avatarToUse = (!isMe && adminAvatar && msg.is_admin) ? adminAvatar : (isMe && remetenteAvatar ? remetenteAvatar : null)
              
              return (
                <div key={msg.id} style={{ display: 'flex', gap: 10, position: 'relative' }}>
                  
                  {/* Threading Line Context */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 28 }}>
                    <div style={{ 
                      width: 28, height: 28, borderRadius: '50%', background: isMe ? '#e2e8f0' : '#dbeafe', color: isMe ? '#475569' : '#1e40af', 
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, overflow: 'hidden'
                    }}>
                      {avatarToUse ? (
                        <img src={avatarToUse} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        msg.remetente_nome.charAt(0).toUpperCase()
                      )}
                    </div>
                    {!isLast && (
                       <div style={{ width: 1, flex: 1, background: '#e2e8f0', marginTop: 4, marginBottom: -12 }} />
                    )}
                  </div>
                  
                  {/* Content */}
                  <div style={{ flex: 1, paddingBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, lineHeight: 1.2 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                        {msg.remetente_nome}
                      </span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        • {isMe ? 'Você' : (msg.is_admin ? 'Escola' : 'Familiar')}
                      </span>
                      <span style={{ fontSize: 11, color: '#94a3b8', marginLeft: 'auto' }}>
                        {timeAgoShort(msg.created_at)}
                      </span>
                    </div>
                    
                    <div style={{ fontSize: 13, color: '#334155', lineHeight: 1.4, marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.conteudo}
                    </div>

                    {msg.anexos && msg.anexos.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {msg.anexos.map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noreferrer" style={{ 
                            display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', 
                            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, textDecoration: 'none', color: '#3b82f6',
                            fontSize: 11, fontWeight: 500
                          }}>
                            <FileText size={12} /> Anexo {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                    
                    <button 
                      onClick={() => document.getElementById('comunicado-chat-input')?.focus()}
                      style={{ background: 'none', border: 'none', color: '#3b82f6', fontSize: 12, fontWeight: 500, padding: 0, marginTop: 6, cursor: 'pointer' }}
                    >
                      Responder
                    </button>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Very Compact Input Area */}
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 12, borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
        
        {pendingAnexos.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {pendingAnexos.map((url, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: 12, fontSize: 11, color: '#475569' }}>
                <FileText size={12} />
                <span>Arq {i+1}</span>
                <button onClick={() => setPendingAnexos(prev => prev.filter((_, idx) => idx !== i))} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}>
                  <X size={12} color="#ef4444" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <div style={{ 
            width: 28, height: 28, borderRadius: '50%', background: '#f1f5f9', color: '#64748b', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0, overflow: 'hidden'
          }}>
            {remetenteAvatar ? <img src={remetenteAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : remetenteNome.charAt(0).toUpperCase()}
          </div>
          
          <div style={{ flex: 1, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '4px 12px' }}>
            <textarea 
              id="comunicado-chat-input"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Adicionar resposta..."
              style={{ 
                flex: 1, background: 'transparent', border: 'none', outline: 'none', resize: 'none', 
                maxHeight: 80, minHeight: 20, fontSize: 13, color: '#0f172a', padding: '4px 0', lineHeight: 1.4
              }}
              rows={1}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              onInput={e => {
                e.currentTarget.style.height = 'auto'
                e.currentTarget.style.height = (e.currentTarget.scrollHeight) + 'px'
              }}
            />
            
            <label style={{ cursor: 'pointer', color: '#94a3b8', padding: '4px', marginLeft: 4, display: 'flex' }}>
              <input type="file" style={{ display: 'none' }} multiple onChange={handleFileUpload} disabled={isUploading} />
              {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
            </label>
          </div>
          
          <button 
            onClick={handleSend}
            disabled={isSending || isUploading || (!newMessage.trim() && pendingAnexos.length === 0)}
            style={{ 
              background: 'transparent', 
              color: (!newMessage.trim() && pendingAnexos.length === 0) ? '#cbd5e1' : '#3b82f6', 
              border: 'none', fontWeight: 600, fontSize: 13, padding: '4px 4px 4px 0',
              cursor: (!newMessage.trim() && pendingAnexos.length === 0) ? 'default' : 'pointer'
            }}
          >
            {isSending ? <Loader2 size={16} className="animate-spin" /> : 'Enviar'}
          </button>
        </div>
      </div>
      
    </div>
  )
}
