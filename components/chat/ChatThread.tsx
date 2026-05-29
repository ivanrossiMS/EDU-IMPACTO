'use client'

import React, { useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserAvatar } from '@/components/UserAvatar'
import { Check, CheckCheck, Clock } from 'lucide-react'
import type { ChatMessage } from '@/lib/chat/types'

interface ChatThreadProps {
  messages: ChatMessage[]
  currentUserId: string
  isLoading: boolean
  hasMore: boolean
  onLoadMore: () => void
  conversation?: import('@/lib/chat/types').ChatConversation | null
}

export function ChatThread({ messages, currentUserId, isLoading, hasMore, onLoadMore, conversation }: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fafbfc', position: 'relative', minHeight: 0 }}>
      {/* Background pattern */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.2, backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\\"60\\" height=\\"60\\" viewBox=\\"0 0 60 60\\" xmlns=\\"http://www.w3.org/2000/svg\\"%3E%3Cpath d=\\"M54.627 0l.83.83-54.627 54.627-.83-.83L54.627 0zM29.627 0l.83.83-29.627 29.627-.83-.83L29.627 0zM59.173 29.546l.83.83-29.627 29.627-.83-.83L59.173 29.546z\\" fill=\\"%2394a3b8\\" fill-opacity=\\"0.1\\" fill-rule=\\"evenodd\\"/%3E%3C/svg%3E")', pointerEvents: 'none' }} />
      
      <div 
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20, zIndex: 1 }}
      >
        {hasMore && (
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <button 
              onClick={onLoadMore}
              disabled={isLoading}
              style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 16, padding: '6px 16px', fontSize: 12, color: '#64748b', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
            >
              {isLoading ? 'Carregando...' : 'Carregar anteriores'}
            </button>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, index) => {
            const isMe = msg.sender_id === currentUserId
            const showAvatar = !isMe && (index === 0 || messages[index - 1].sender_id !== msg.sender_id)
            
            return (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                style={{ 
                  display: 'flex', 
                  flexDirection: isMe ? 'row-reverse' : 'row',
                  alignItems: 'flex-end',
                  gap: 12,
                  alignSelf: isMe ? 'flex-end' : 'flex-start',
                  maxWidth: '70%'
                }}
              >
                {!isMe && (
                  <div style={{ width: 40, flexShrink: 0 }}>
                    {showAvatar && (() => {
                      const senderPerfil = msg.sender_perfil || conversation?.participants?.find(p => p.user_id === msg.sender_id)?.user_perfil;
                      const isSenderFamily = senderPerfil === 'Família' || senderPerfil === 'Responsável' || senderPerfil === 'Aluno';
                      
                      const avatarUserId = isSenderFamily && conversation?.aluno_id ? conversation.aluno_id : msg.sender_id;
                      const avatarFotoUrl = isSenderFamily && conversation?.aluno_id ? conversation?.aluno?.foto : undefined;
                      
                      return <UserAvatar size={40} name={msg.sender_name || 'Usuário'} userId={avatarUserId} fotoUrl={avatarFotoUrl} />;
                    })()}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {!isMe && showAvatar && (
                    <span style={{ fontSize: 13, color: '#64748b', marginLeft: 4, marginBottom: 6, fontWeight: 500 }}>
                      {msg.sender_name || 'Usuário'}
                    </span>
                  )}
                  
                  {msg.content_type === 'image' || (msg.content_type === 'text' && msg.content?.includes('supabase.co/storage') && msg.content?.match(/\.(jpeg|jpg|gif|png|webp)$/i)) ? (
                    <div style={{
                      background: isMe ? '#6366f1' : 'white',
                      padding: 4,
                      borderRadius: 16,
                      borderBottomRightRadius: isMe ? 4 : 16,
                      borderBottomLeftRadius: !isMe ? 4 : 16,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative'
                    }}>
                      <img src={msg.content || ''} alt="Imagem" style={{ maxWidth: 260, borderRadius: 12, objectFit: 'cover' }} />
                      <button 
                        onClick={() => window.open(msg.content || '', '_blank')}
                        title="Download"
                        style={{
                          position: 'absolute', top: 12, right: 12, width: 32, height: 32,
                          background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)'
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4, paddingRight: 8, paddingBottom: 4, opacity: isMe ? 0.9 : 0.6, color: isMe ? 'white' : '#64748b' }}>
                        <span style={{ fontSize: 11, fontWeight: 500 }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && <CheckCheck size={14} />}
                      </div>
                    </div>
                  ) : msg.content_type === 'video' || (msg.content_type === 'text' && msg.content?.includes('supabase.co/storage') && msg.content?.match(/\.(mp4|webm|ogg|mov)$/i)) ? (
                    <div style={{
                      background: isMe ? '#6366f1' : 'white',
                      padding: 4,
                      borderRadius: 16,
                      borderBottomRightRadius: isMe ? 4 : 16,
                      borderBottomLeftRadius: !isMe ? 4 : 16,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative'
                    }}>
                      <video src={msg.content || ''} controls style={{ maxWidth: 260, borderRadius: 12, objectFit: 'cover' }} />
                      <button 
                        onClick={() => window.open(msg.content || '', '_blank')}
                        title="Download"
                        style={{
                          position: 'absolute', top: 12, right: 12, width: 32, height: 32,
                          background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)', zIndex: 10
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </button>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4, paddingRight: 8, paddingBottom: 4, opacity: isMe ? 0.9 : 0.6, color: isMe ? 'white' : '#64748b' }}>
                        <span style={{ fontSize: 11, fontWeight: 500 }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && <CheckCheck size={14} />}
                      </div>
                    </div>
                  ) : msg.content_type === 'audio' ? (
                    <div style={{
                      background: isMe ? '#6366f1' : 'white',
                      padding: '12px 16px',
                      borderRadius: 20,
                      borderBottomRightRadius: isMe ? 4 : 20,
                      borderBottomLeftRadius: !isMe ? 4 : 20,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      display: 'flex',
                      flexDirection: 'column',
                      minWidth: 240
                    }}>
                      <audio controls src={msg.content || ''} style={{ height: 36, width: '100%', outline: 'none' }} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4, opacity: isMe ? 0.9 : 0.6, color: isMe ? 'white' : '#64748b' }}>
                        <span style={{ fontSize: 11, fontWeight: 500 }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && <CheckCheck size={14} />}
                      </div>
                    </div>
                  ) : msg.content_type === 'file' ? (
                    <div style={{
                      background: 'white',
                      border: '1px solid #f1f5f9',
                      padding: 12,
                      borderRadius: 16,
                      borderBottomRightRadius: isMe ? 4 : 16,
                      borderBottomLeftRadius: !isMe ? 4 : 16,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      minWidth: 260
                    }}>
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {(() => {
                             try { const d = JSON.parse(msg.content || '{}'); return d.name || 'Arquivo anexado' }
                             catch { return 'Arquivo anexado' }
                          })()}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {(() => {
                             try { 
                               const d = JSON.parse(msg.content || '{}'); 
                               return d.size ? `${(d.size / 1024 / 1024).toFixed(2)} MB` : 'Documento'
                             } catch { return 'Documento' }
                          })()}
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          try {
                            const d = JSON.parse(msg.content || '{}');
                            window.open(d.url, '_blank');
                          } catch {
                            if (msg.content) window.open(msg.content, '_blank');
                          }
                        }}
                        style={{ width: 32, height: 32, borderRadius: '50%', background: '#f8fafc', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', cursor: 'pointer' }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      background: isMe ? '#6366f1' : 'white',
                      color: isMe ? 'white' : '#0f172a',
                      padding: '10px 14px',
                      borderRadius: 20,
                      borderBottomRightRadius: isMe ? 4 : 20,
                      borderBottomLeftRadius: !isMe ? 4 : 20,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      maxWidth: '100%'
                    }}>
                      <div style={{ fontSize: 15, lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {msg.content?.includes('supabase.co/storage') ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <a href={msg.content || ''} target="_blank" rel="noreferrer" style={{ color: isMe ? 'white' : '#6366f1', textDecoration: 'underline' }}>
                              Arquivo de Mídia
                            </a>
                          </div>
                        ) : (
                          msg.content || ''
                        )}
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4, opacity: isMe ? 0.9 : 0.6 }}>
                        <span style={{ fontSize: 11, fontWeight: 500 }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMe && (
                          <span style={{ marginLeft: 2 }}>
                            <CheckCheck size={14} />
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
