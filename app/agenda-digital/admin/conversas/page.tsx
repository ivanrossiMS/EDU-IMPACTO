'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useState, useEffect } from 'react'
import { 
  Users, MessageSquare, Search, Filter, Phone, Video, MoreVertical, 
  Paperclip, Send, CheckCircle2, Smile, Plus, X, User, CheckCheck
} from 'lucide-react'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import { useRef } from 'react'

export default function ADAdminConversas() {
  const { chatsList, setChatsList, messages, setMessages, adAlert, adConfirm } = useAgendaDigital()
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [activeChat, setActiveChat] = useState<number | string | null>("1")
  const [inputMsg, setInputMsg] = useState('')
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [newChatSearch, setNewChatSearch] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false)
  const [filterMode, setFilterMode] = useState<'abertos' | 'resolvidos'>('abertos')

  const fileInputRef = useRef<HTMLInputElement>(null)

  const EMOJIS = ['😊', '😂', '👍', '🙏', '😍', '👏', '😉', '✅', '❌', '❤️']

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const newId = params.get('newChatId')
    const newName = params.get('newChatName')
    if (newId && newName) {
      setChatsList(prev => {
        if (!prev.find(c => String(c.id) === newId)) {
          return [{ id: newId, name: newName, status: 'online', preview: 'Iniciar nova conversa...', time: 'Agora', unread: 0, tag: 'Geral' }, ...prev]
        }
        return prev
      })
      setMessages(prev => prev[newId] ? prev : { ...prev, [newId]: [] })
      setActiveChat(newId)
      window.history.replaceState({}, '', '/agenda-digital/admin/conversas')
    }
  }, [setChatsList, setMessages])

  const handleSend = () => {
    if (!inputMsg.trim() || !activeChat) return
    
    setMessages(prev => ({
      ...prev,
      [String(activeChat)]: [
        ...(prev[String(activeChat)] || []),
        { id: Date.now(), text: inputMsg, sender: 'us', time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
      ]
    }))
    setChatsList(prev => prev.map(c => String(c.id) === String(activeChat) ? { ...c, preview: inputMsg, time: 'Agora' } : c))
    setInputMsg('')
  }

  const startNewChat = (id: string, name: string) => {
    setChatsList(prev => {
      if (!prev.find(c => String(c.id) === id)) {
        return [{ id, name, status: 'online', preview: 'Iniciou uma nova conversa...', time: 'Agora', unread: 0, tag: 'Geral' }, ...prev]
      }
      return prev
    })
    setMessages(prev => prev[id] ? prev : { ...prev, [id]: [] })
    setActiveChat(id)
    setShowNewChatModal(false)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && activeChat) {
      setMessages(prev => ({
        ...prev,
        [String(activeChat)]: [
          ...(prev[String(activeChat)] || []),
          { id: Date.now(), text: `📎 Arquivo Anexado: ${file.name}`, sender: 'us', time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }
        ]
      }))
      setChatsList(prev => prev.map(c => String(c.id) === String(activeChat) ? { ...c, preview: `📎 Anexo enviado`, time: 'Agora' } : c))
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="ad-admin-page-container ad-mobile-optimized ad-chat-mobile-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', marginTop: -24 }}>
      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .ad-chat-mobile-container {
             height: calc(100vh - 130px) !important;
             margin-top: 0 !important;
          }
          .ad-chat-split {
             flex-direction: column !important;
             border: none !important;
             box-shadow: none !important;
             background: transparent !important;
             overflow: visible !important;
          }
          .ad-chat-sidebar {
             width: 100% !important;
             display: ${activeChat ? 'none' : 'flex'} !important;
             border-right: none !important;
             border-radius: 16px !important;
             overflow: hidden !important;
          }
          .ad-chat-main {
             width: 100% !important;
             display: ${!activeChat ? 'none' : 'flex'} !important;
             border-radius: 16px !important;
             overflow: hidden !important;
             box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
          }
          .ad-chat-back-btn {
             display: flex !important;
             margin-right: 12px !important;
             background: rgba(0,0,0,0.05) !important;
             border-radius: 50% !important;
             width: 36px !important;
             height: 36px !important;
             align-items: center !important;
             justify-content: center !important;
             border: none !important;
             color: hsl(var(--text-main)) !important;
          }
          /* Adjust font sizes in message header */
          .ad-chat-header h3 {
             font-size: 14px !important;
          }
          /* Chat specific buttons */
          .ad-chat-header-actions button span {
             display: none !important;
          }
          .ad-chat-input-area {
             padding: 12px 16px !important;
             background: rgba(255, 255, 255, 0.95) !important;
             backdrop-filter: blur(10px) !important;
             border-top: 1px solid rgba(0,0,0,0.05) !important;
          }
          .ad-chat-input-box {
             padding: 4px 6px !important;
             border-radius: 32px !important;
             background: hsl(var(--bg-surface)) !important;
             border: 1px solid rgba(0,0,0,0.08) !important;
             box-shadow: inset 0 2px 4px rgba(0,0,0,0.01) !important;
          }
          .ad-chat-input-box input {
             font-size: 15px !important;
             padding: 8px 12px !important;
             height: 44px !important;
          }
          .ad-chat-list-item { 
             padding: 16px 16px !important; 
             border-radius: 16px !important;
             margin: 0 8px 4px 8px !important;
             border-bottom: none !important;
             background: hsl(var(--bg-surface)) !important;
             box-shadow: 0 2px 8px rgba(0,0,0,0.02) !important;
          }
          .ad-chat-list-item h4 {
             font-size: 15px !important;
          }
          .ad-chat-list-item p {
             font-size: 13px !important;
             white-space: nowrap !important;
          }
          .ad-chat-avatar {
             width: 44px !important;
             height: 44px !important;
             font-size: 14px !important;
          }
          .ad-chat-msg-bubble {
             padding: 12px 18px !important;
             font-size: 14px !important;
             line-height: 1.5 !important;
             max-width: 88% !important;
             border-radius: 20px !important;
             box-shadow: 0 4px 12px rgba(0,0,0,0.03) !important;
          }
          /* Custom shapes for us vs them */
          .ad-chat-msg-wrapper[style*="flex-end"] .ad-chat-msg-bubble {
             border-bottom-right-radius: 4px !important;
             background: var(--gradient-primary) !important;
             box-shadow: 0 4px 16px rgba(99, 102, 241, 0.2) !important;
          }
          .ad-chat-msg-wrapper[style*="flex-start"] .ad-chat-msg-bubble {
             border-bottom-left-radius: 4px !important;
          }
          .ad-chat-badge {
             font-size: 10px !important;
             width: 20px !important;
             height: 20px !important;
          }
          /* Hide empty text */
          .ad-chat-date-pill {
             font-size: 11px !important;
             padding: 4px 12px !important;
             background: rgba(0,0,0,0.04) !important;
             color: hsl(var(--text-muted)) !important;
             border-radius: 12px !important;
          }
        }
      `}} />

      {/* Exibe o header s&oacute; se n&atilde;o estiver com chat ativo no mobile (no desktop aparece sempre) */}
      <div className="ad-chat-page-header" style={{ display: activeChat ? 'none' : 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Atendimento (Chats)</h2>
          <p style={{ color: 'hsl(var(--text-muted))' }}>Responda rapidamente responsáveis.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" style={{ padding: '0 16px' }} onClick={() => setShowNewChatModal(true)}><Plus size={16} /> Nova Conversa</button>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        @media (min-width: 769px) {
          .ad-chat-page-header { display: flex !important; }
        }
      `}}/>

      {/* Main Split Interface */}
      <div className="card ad-chat-split" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Left Side: Chat List */}
        <div className="ad-chat-sidebar" style={{ width: 350, borderRight: '1px solid hsl(var(--border-subtle))', display: 'flex', flexDirection: 'column', background: 'hsl(var(--bg-surface))' }}>
          <div style={{ padding: 16, borderBottom: '1px solid hsl(var(--border-subtle))' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--text-muted))' }} />
              <input className="form-input" placeholder="Buscar nas conversas..." value={newChatSearch} onChange={e => setNewChatSearch(e.target.value)} style={{ paddingLeft: 36, width: '100%', background: 'hsl(var(--bg-main))' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <span className="badge" style={{ background: filterMode === 'abertos' ? 'rgba(99,102,241,0.1)' : 'transparent', color: filterMode === 'abertos' ? '#4f46e5' : 'hsl(var(--text-muted))', cursor: 'pointer' }} onClick={() => setFilterMode('abertos')}>
                Abertos ({chatsList.filter(c => c.status !== 'resolved').length})
              </span>
              <span className="badge" style={{ background: filterMode === 'resolvidos' ? 'rgba(99,102,241,0.1)' : 'transparent', color: filterMode === 'resolvidos' ? '#4f46e5' : 'hsl(var(--text-muted))', cursor: 'pointer' }} onClick={() => setFilterMode('resolvidos')}>
                Resolvidos ({chatsList.filter(c => c.status === 'resolved').length})
              </span>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {chatsList.filter(c => filterMode === 'abertos' ? c.status !== 'resolved' : c.status === 'resolved')
              .filter(c => c.name.toLowerCase().includes(newChatSearch.toLowerCase()) || (c.tag && c.tag.toLowerCase().includes(newChatSearch.toLowerCase())))
              .map(chat => (
              <div 
                key={chat.id}
                onClick={() => setActiveChat(chat.id)}
                className="ad-chat-list-item"
                style={{ 
                  padding: '16px', display: 'flex', gap: 12, borderBottom: '1px solid hsl(var(--border-subtle))',
                  cursor: 'pointer', background: activeChat === chat.id ? 'rgba(99,102,241,0.05)' : 'transparent' 
                }}
              >
                <div className="avatar ad-chat-avatar" style={{ width: 48, height: 48, background: '#e2e8f0', color: '#64748b', fontSize: 16 }}>
                  {chat.name.charAt(0)}
                  {chat.status === 'online' && <div style={{ position: 'absolute', bottom: 0, right: 0, width: 12, height: 12, background: '#10b981', borderRadius: '50%', border: '2px solid white' }}/>}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: activeChat === chat.id || chat.unread ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.name}</h4>
                    <span style={{ fontSize: 11, color: chat.unread ? '#4f46e5' : 'hsl(var(--text-muted))', fontWeight: chat.unread ? 700 : 500 }}>{chat.time}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <p style={{ margin: 0, fontSize: 12, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '85%' }}>{chat.preview}</p>
                    {chat.unread > 0 && <span className="ad-chat-badge" style={{ background: '#4f46e5', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{chat.unread}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Active Chat */}
        {activeChat ? (
          <div className="ad-chat-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'hsl(var(--bg-main))' }}>
            <div className="ad-chat-header" style={{ padding: '16px 20px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'hsl(var(--bg-surface))' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button 
                  className="ad-chat-back-btn" 
                  style={{ display: 'none' }} 
                  onClick={(e) => { e.stopPropagation(); setActiveChat(null); }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div className="avatar" style={{ width: 40, height: 40, background: 'var(--gradient-purple)', color: 'white', fontSize: 15, marginRight: 12 }}>
                  {chatsList.find(c => c.id === activeChat)?.name.charAt(0)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{chatsList.find(c => c.id === activeChat)?.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}><span style={{width: 6, height: 6, borderRadius: '50%', background: '#10b981'}}></span> Online</span>
                  </div>
                </div>
              </div>
              <div className="ad-chat-header-actions" style={{ display: 'flex', gap: 8, color: 'hsl(var(--text-secondary))', position: 'relative' }}>
                {chatsList.find(c => c.id === activeChat)?.status !== 'resolved' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => adConfirm('Tem certeza que deseja marcar como resolvido?', 'Atendimento Finalizado', () => {
                    setChatsList(prev => prev.map(c => c.id === activeChat ? {...c, status: 'resolved'} : c))
                    setActiveChat(null)
                    adAlert('Ação realizada', 'Sucesso')
                  })}><CheckCircle2 size={18} /> Resolver</button>
                )}
                {chatsList.find(c => c.id === activeChat)?.status === 'resolved' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => adConfirm('Deseja reabrir este atendimento?', 'Reabrir Atendimento', () => {
                    setChatsList(prev => prev.map(c => c.id === activeChat ? {...c, status: 'online'} : c))
                    adAlert('Atendimento reaberto', 'Sucesso')
                  })}><MoreVertical size={18} /> Reabrir</button>
                )}
                <div style={{ width: 1, height: 24, background: 'hsl(var(--border-subtle))', margin: 'auto 4px' }} />
                <button className="btn btn-ghost btn-sm" style={{ padding: 8 }} onClick={() => setShowOptionsMenu(!showOptionsMenu)}><MoreVertical size={18} /></button>
                
                {showOptionsMenu && (
                  <div style={{ position: 'absolute', top: 36, right: 0, background: '#fff', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', width: 200, zIndex: 10 }}>
                    <div style={{ padding: 8, display: 'flex', flexDirection: 'column' }}>
                      <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { adAlert('Transferindo o atendimento para Setor Financeiro', 'Transferência'); setShowOptionsMenu(false); }}>Transferir p/ Financeiro</button>
                      <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start' }} onClick={() => { adAlert('Buscando histórico do aluno...', 'Histórico'); setShowOptionsMenu(false); }}>Ver Histórico Escolar</button>
                      <div style={{ height: 1, background: 'hsl(var(--border-subtle))', margin: '4px 0' }} />
                      <button className="btn btn-ghost btn-sm" style={{ justifyContent: 'flex-start', color: '#ef4444' }} onClick={() => { adConfirm('Deseja bloquear este contato temporariamente?', 'Bloqueio', () => { adAlert('Contato Bloqueado'); setShowOptionsMenu(false); }) }}>Bloquear Contato</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Messages Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16, background: 'hsl(var(--bg-main))' }}>
              <div className="ad-chat-date-pill" style={{ background: '#fef3c7', color: '#92400e', fontSize: 12, padding: 8, borderRadius: 8, textAlign: 'center', width: 'fit-content', margin: '0 auto' }}>
                Atendimento iniciado hoje.
              </div>

              {(messages[activeChat] || []).map(msg => (
                <div key={msg.id} className="ad-chat-msg-wrapper" style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'us' ? 'flex-end' : 'flex-start', maxWidth: '75%', alignSelf: msg.sender === 'us' ? 'flex-end' : 'flex-start' }}>
                   <div className="ad-chat-msg-bubble" style={{ 
                     background: msg.sender === 'us' ? 'var(--gradient-purple)' : 'hsl(var(--bg-surface))', 
                     color: msg.sender === 'us' ? 'white' : 'inherit',
                     border: msg.sender === 'us' ? 'none' : '1px solid hsl(var(--border-subtle))', 
                     padding: '12px 16px', 
                     borderRadius: msg.sender === 'us' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', 
                     fontSize: 14,
                     lineHeight: 1.4
                   }}>
                     {msg.text}
                   </div>
                   <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4, [msg.sender === 'us' ? 'alignSelf' : 'alignSelf']: msg.sender === 'us' ? 'flex-end' : 'flex-start' }}>
                     {msg.time} {msg.sender === 'us' && <CheckCheck size={14} color="#3b82f6" />}
                   </div>
                </div>
              ))}
            </div>

            {/* Input Area */}
            <div className="ad-chat-input-area" style={{ padding: 20, borderTop: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', position: 'relative' }}>
              
              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div style={{ position: 'absolute', bottom: 85, left: 24, background: '#fff', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, padding: 8, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, zIndex: 10 }}>
                  {EMOJIS.map(emoji => (
                    <button key={emoji} onClick={() => { setInputMsg(prev => prev + emoji); setShowEmojiPicker(false); }} style={{ background: 'transparent', border: 0, fontSize: 20, cursor: 'pointer', padding: 4, borderRadius: 4 }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />

              <div className="ad-chat-input-box" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'hsl(var(--bg-main))', padding: '6px 8px', borderRadius: 32, border: '1px solid hsl(var(--border-subtle))' }}>
                <button style={{ background: 'transparent', border: 0, color: 'hsl(var(--text-muted))', cursor: 'pointer', padding: '4px' }} onClick={() => setShowEmojiPicker(!showEmojiPicker)}><Smile size={20} /></button>
                <button style={{ background: 'transparent', border: 0, color: 'hsl(var(--text-muted))', cursor: 'pointer', padding: '4px' }} onClick={() => fileInputRef.current?.click()}><Paperclip size={20} /></button>
                <input 
                  placeholder={`Mensagem...`} 
                  style={{ flex: 1, background: 'transparent', border: 0, outline: 'none', padding: '8px 4px', fontSize: 15 }}
                  value={inputMsg}
                  onChange={e => setInputMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <button onClick={handleSend} style={{ background: inputMsg.trim() ? 'var(--gradient-primary)' : 'hsl(var(--bg-surface-alt))', color: inputMsg.trim() ? 'white' : 'hsl(var(--text-muted))', border: 0, width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: inputMsg.trim() ? 'pointer' : 'default', transition: 'all 0.2s', boxShadow: inputMsg.trim() ? '0 4px 12px rgba(99,102,241,0.3)' : 'none' }}>
                  <Send size={18} style={{ marginLeft: -2 }} />
                </button>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 12, paddingLeft: 16 }}>
                <button className="badge badge-ghost" style={{ cursor: 'pointer' }} onClick={() => setInputMsg(prev => prev + ' Segue o seu boleto rápido:')}>⚡ Enviar Boleto Rápido</button>
                <button className="badge badge-ghost" style={{ cursor: 'pointer' }} onClick={() => setInputMsg(prev => prev + ' Olá! Em que posso ajudar hoje?')}>⚡ Resposta Pronta (Atendimento)</button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))' }}>
            <MessageSquare size={64} style={{ opacity: 0.1, marginBottom: 16 }} />
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>Nenhum Chat Selecionado</h3>
            <p>Selecione uma conversa ao lado para iniciar o atendimento.</p>
          </div>
        )}

      </div>
      {showNewChatModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 500, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
               <h3 style={{ fontSize: 18, fontWeight: 700 }}>Iniciar Nova Conversa</h3>
               <button className="btn btn-ghost btn-sm" onClick={() => setShowNewChatModal(false)}><X size={16} /></button>
            </div>
            
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'hsl(var(--text-muted))' }} />
              <input 
                className="form-input" 
                placeholder="Buscar aluno ou responsável..." 
                style={{ width: '100%', paddingLeft: 36 }}
                value={newChatSearch}
                onChange={e => setNewChatSearch(e.target.value)}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
               {(alunos || []).filter(a => a.nome.toLowerCase().includes(newChatSearch.toLowerCase()) || a.id.includes(newChatSearch)).slice(0, 50).map(a => (
                 <div 
                   key={a.id} 
                   style={{ padding: '12px 0', borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                 >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div className="avatar" style={{ width: 36, height: 36, background: 'hsl(var(--bg-overlay))', color: 'var(--color-primary)' }}>
                        <User size={16} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600 }}>{a.nome}</div>
                        <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Turma: {a.turma} • MAT: {a.id.substring(0,8)}</div>
                      </div>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => startNewChat(a.id, a.nome)}>Iniciar Chat</button>
                 </div>
               ))}
               {(alunos || []).length === 0 && (
                 <div style={{ padding: 24, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Nenhum aluno encontrado na base.</div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
