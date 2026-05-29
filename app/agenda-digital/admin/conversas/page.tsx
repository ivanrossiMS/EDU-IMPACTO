'use client'
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useState, useEffect, useRef } from 'react'
import { 
  Users, MessageSquare, Search, Filter, Phone, Video, MoreVertical, 
  Paperclip, Send, CheckCircle2, Smile, Plus, X, User, CheckCheck, Mail, Reply, Trash2
} from 'lucide-react'
import { useAgendaDigital, ADChat } from '@/lib/agendaDigitalContext'
import { useData } from '@/lib/dataContext'
import { useApp } from '@/lib/context'
import { getInitials } from '@/lib/utils'

export default function ADAdminConversas() {
  const { chatsList, setChatsList, messages, setMessages, adAlert, adConfirm, chatGroups } = useAgendaDigital()
  const { currentUser, currentUserPerfil } = useApp()
  const isDiretorGeral = currentUserPerfil === 'Diretor Geral'
  const { turmas = [] } = useData()
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [activeChat, setActiveChat] = useState<number | string | null>(null)
  const [inputMsg, setInputMsg] = useState('')
  const [showNewChatModal, setShowNewChatModal] = useState(false)
  const [newChatSearch, setNewChatSearch] = useState('')
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)
  const [showOptionsMenu, setShowOptionsMenu] = useState(false)
  const [filterMode, setFilterMode] = useState<'abertos' | 'resolvidos'>('abertos')
  const [selectedRecipient, setSelectedRecipient] = useState<{id: string, nome: string} | null>(null)
  const [composeSubject, setComposeSubject] = useState('')
  const [composeBody, setComposeBody] = useState('')
  const [showEmojiTarget, setShowEmojiTarget] = useState<string | null>(null) // 'compose' | 'reply' | null
  const EMOJIS = ['😊', '😂', '👍', '🙏', '😍', '👏', '😉', '✅', '❌', '❤️', '🙌', '🎉', '💡', '🚀']

  const insertText = (target: 'compose' | 'reply', text: string) => {
    if (target === 'compose') setComposeBody(prev => prev + text)
    else setInputMsg(prev => prev + text)
    setShowEmojiTarget(null)
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

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
        { 
          id: Date.now(), 
          text: inputMsg, 
          sender: 'us', 
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toLocaleDateString('pt-BR'),
          author: currentUser?.nome || 'Administrativo',
          authorRole: 'Equipe Escolar'
        }
      ]
    }))
    setChatsList(prev => prev.map(c => String(c.id) === String(activeChat) ? { 
      ...c, 
      unread: (c.unread || 0) + 1,
      preview: inputMsg, 
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      startDate: c.startDate || new Date().toLocaleDateString('pt-BR'),
      startTime: c.startTime || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } : c))
    setInputMsg('')
  }

  const startNewChat = (id: string, name: string) => {
    setSelectedRecipient({ id, nome: name })
    setComposeSubject('')
    setComposeBody('')
  }

  const finalSendAdminTicket = () => {
    if (!composeSubject.trim() || !composeBody.trim() || !selectedRecipient) return

    const newChatId = `${selectedRecipient.id}-TKT-${Date.now()}`
    const novo: ADChat = { 
      id: newChatId, 
      name: selectedRecipient.nome, 
      status: 'active', 
      preview: composeBody.substring(0, 30) + '...', 
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString('pt-BR'),
      unread: 1, 
      tag: composeSubject,
      startDate: new Date().toLocaleDateString('pt-BR'),
      startTime: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
    }
    
    setMessages(prev => ({
      ...prev,
      [newChatId]: [{
        id: Date.now(),
        text: composeBody,
        sender: 'us',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        date: new Date().toLocaleDateString('pt-BR'),
        author: currentUser?.nome || 'Administrativo',
        authorRole: 'Equipe Escolar'
      }]
    }))

    setChatsList(prev => [novo, ...prev])
    setActiveChat(newChatId)
    setShowNewChatModal(false)
    setSelectedRecipient(null)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && activeChat) {
      setMessages(prev => ({
        ...prev,
        [String(activeChat)]: [
          ...(prev[String(activeChat)] || []),
          { 
            id: Date.now(), 
            text: `📎 Arquivo Anexado: ${file.name}`, 
            sender: 'us', 
            time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
            date: new Date().toLocaleDateString('pt-BR'),
            author: currentUser?.nome || 'Administrativo',
            authorRole: 'Equipe Escolar'
          }
        ]
      }))
      setChatsList(prev => prev.map(c => String(c.id) === String(activeChat) ? { ...c, preview: `📎 Anexo enviado`, time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) } : c))
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteMessage = (msgId: number | string) => {
    adConfirm('Deseja excluir esta mensagem permanentemente?', 'Excluir Mensagem', () => {
      setMessages(prev => {
        const chatMsgs = prev[String(activeChat)] || []
        const updatedMsgs = chatMsgs.filter(m => m.id !== msgId)
        
        if (updatedMsgs.length > 0) {
          const lastMsg = updatedMsgs[updatedMsgs.length - 1]
          setChatsList(chats => chats.map(c => String(c.id) === String(activeChat) ? {
            ...c,
            preview: lastMsg.text,
            time: lastMsg.time,
            date: lastMsg.date
          } : c))
        } else {
          setChatsList(chats => chats.map(c => String(c.id) === String(activeChat) ? {
            ...c,
            preview: 'Sem mensagens',
            time: '',
            date: ''
          } : c))
        }

        return {
          ...prev,
          [String(activeChat)]: updatedMsgs
        }
      })
      adAlert('Mensagem excluída com sucesso!', 'Sucesso')
    })
  }

  const handleDeleteChat = () => {
    if (!activeChat) return
    adConfirm('Deseja excluir toda esta conversa e todas as suas mensagens permanentemente?', 'Excluir Conversa', () => {
      setChatsList(prev => prev.filter(c => String(c.id) !== String(activeChat)))
      setMessages(prev => {
        const copy = { ...prev }
        delete copy[String(activeChat)]
        return copy
      })
      setActiveChat(null)
      setShowOptionsMenu(false)
      adAlert('Conversa excluída com sucesso!', 'Sucesso')
    })
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
          <h2 style={{ fontSize: 28, fontWeight: 900, fontFamily: 'Outfit, sans-serif', textTransform: 'uppercase', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 12 }}>
             <Mail size={28} color="#4f46e5" /> Mensagens (Inbox)
          </h2>
          <p style={{ color: 'hsl(var(--text-muted))' }}>Gerencie comunicações oficiais com alunos e responsáveis.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button 
            style={{ 
              padding: '12px 32px', 
              borderRadius: 40, 
              background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', 
              color: 'white',
              border: 'none', 
              boxShadow: '0 8px 20px -6px rgba(79, 70, 229, 0.6)', 
              fontSize: 15, 
              fontWeight: 800, 
              display: 'flex', 
              alignItems: 'center', 
              gap: 12,
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }} 
            onClick={() => setShowNewChatModal(true)}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 12px 25px -8px rgba(79, 70, 229, 0.7)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 8px 20px -6px rgba(79, 70, 229, 0.6)'
            }}
          >
             <Plus size={20} strokeWidth={3} /> Nova Mensagem
          </button>
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
              .filter(c => (c.name?.toLowerCase() || '').includes(newChatSearch.toLowerCase()) || (c.tag && c.tag.toLowerCase().includes(newChatSearch.toLowerCase())))
              .map(chat => (
              <div 
                key={chat.id}
                onClick={() => {
                  setActiveChat(chat.id)
                  if (chat.unread > 0) {
                    setChatsList(prev => prev.map(c => c.id === chat.id ? { ...c, unread: 0 } : c))
                  }
                }}
                className="ad-chat-list-item"
                style={{ 
                  padding: '16px', display: 'flex', gap: 12, borderBottom: '1px solid hsl(var(--border-subtle))',
                  cursor: 'pointer', background: activeChat === chat.id ? 'rgba(99,102,241,0.05)' : 'transparent' 
                }}
              >
                <div className="avatar ad-chat-avatar" style={{ width: 48, height: 48, background: '#e2e8f0', color: '#64748b', fontSize: 16 }}>
                  {(chat.name || '?').charAt(0)}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: activeChat === chat.id || chat.unread ? 800 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'hsl(var(--text-main))' }}>
                      {chat.tag || 'Conversa sem assunto'}
                    </h4>
                    {(() => {
                      const msgs = messages[chat.id] || []
                      if (msgs.length === 0) return chat.unread > 0 ? <span className="ad-chat-badge badge-pulse-modern" style={{ background: '#4f46e5', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{chat.unread}</span> : null
                      const lastMsg = msgs[msgs.length - 1]
                      if (lastMsg.sender === 'them' && chat.unread > 0) {
                        return <span className="ad-chat-badge badge-pulse-modern" style={{ background: '#4f46e5', color: 'white', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>{chat.unread}</span>
                      }
                      return null
                    })()}
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'hsl(var(--text-secondary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                      {chat.preview}
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                    <span style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {chat.name || 'Desconhecido'}
                    </span>
                  </div>

                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', display: 'flex', justifyContent: 'space-between', opacity: 0.9, fontWeight: 600 }}>
                     <span>{chat.date || ''} às {chat.time}</span>
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
                  {(chatsList.find(c => c.id === activeChat)?.name || '?').charAt(0)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{chatsList.find(c => c.id === activeChat)?.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 4 }}>
                       Tópico Oficial de Atendimento
                    </span>
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
                      {isDiretorGeral && (
                        <>
                          <div style={{ height: 1, background: 'hsl(var(--border-subtle))', margin: '4px 0' }} />
                          <button 
                            className="btn btn-ghost btn-sm" 
                            style={{ justifyContent: 'flex-start', color: '#dc2626', fontWeight: 'bold' }} 
                            onClick={handleDeleteChat}
                          >
                            Excluir Conversa Completa
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Messages Area (Ticket Style) */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, background: 'rgba(0,0,0,0.02)' }}>
              
              <div style={{ width: '100%', borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 16, marginBottom: 8 }}>
                 <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px 0', color: '#1e293b' }}>
                    Tópico: {chatsList.find(c => c.id === activeChat)?.tag || 'Atendimento Geral'}
                 </h2>
                 <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <p style={{ margin: 0, fontSize: 13, color: 'hsl(var(--text-muted))' }}>
                       Iniciado em <strong>{chatsList.find(c => c.id === activeChat)?.startDate || chatsList.find(c => c.id === activeChat)?.date || (messages[String(activeChat)]?.[0]?.date) || 'Data N/D'}</strong> às <strong>{chatsList.find(c => c.id === activeChat)?.startTime || chatsList.find(c => c.id === activeChat)?.time}</strong>
                    </p>
                    <span style={{ fontSize: 12, background: 'rgba(79, 70, 229, 0.1)', color: '#4f46e5', padding: '2px 10px', borderRadius: 20, fontWeight: 700 }}>
                       Iniciado por: {messages[String(activeChat)]?.[0]?.authorRole || 'Remetente'} ({messages[String(activeChat)]?.[0]?.author || 'Usuário'})
                    </span>
                 </div>
              </div>

              {(messages[activeChat] || []).map(msg => (
                <div key={msg.id} style={{ 
                    background: 'white', 
                    border: '1px solid hsl(var(--border-subtle))',
                    borderRadius: 16, 
                    padding: 24,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                    marginLeft: msg.sender === 'us' ? 40 : 0,
                    marginRight: msg.sender === 'us' ? 0 : 40,
                    position: 'relative'
                }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                         <div style={{ width: 32, height: 32, borderRadius: 16, background: msg.sender === 'us' ? '#4f46e5' : '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                            {getInitials(msg.author || (msg.sender === 'us' ? 'Equipe Escolar' : (chatsList.find(c => c.id === activeChat)?.name || 'Usuário')))}
                         </div>
                         <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{msg.author || (msg.sender === 'us' ? 'Equipe Escolar' : chatsList.find(c => c.id === activeChat)?.name)}</div>
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{msg.authorRole || (msg.sender === 'us' ? 'Resposta Oficial' : 'Mensagem do Cliente')}</div>
                         </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{msg.date || ''} às {msg.time}</span>
                        {isDiretorGeral && (
                          <button 
                            onClick={() => handleDeleteMessage(msg.id)}
                            style={{ 
                              background: 'transparent', 
                              border: 'none', 
                              color: '#ef4444', 
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              padding: 4,
                              borderRadius: 6,
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            title="Excluir Mensagem"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                   </div>
                   <div style={{ fontSize: 15, lineHeight: 1.6, color: '#334155', whiteSpace: 'pre-wrap' }}>
                     {msg.text}
                   </div>
                </div>
              ))}
            </div>

            {/* Input Area (Textarea style) */}
            <div className="ad-chat-input-area" style={{ padding: 24, borderTop: '1px solid hsl(var(--border-subtle))', background: 'white', position: 'relative' }}>
              
              <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />

              <div style={{ border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, overflow: 'hidden', background: '#f8fafc' }}>
                <div style={{ display: 'flex', gap: 16, padding: '10px 16px', borderBottom: '1px solid hsl(var(--border-subtle))', background: '#f8fafc' }}>
                    <button onClick={() => setShowEmojiTarget(showEmojiTarget === 'reply' ? null : 'reply')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}><Smile size={16} /> Emojis</button>
                </div>
                {showEmojiTarget === 'reply' && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 12, background: 'white' }}>
                    {EMOJIS.map(e => <button key={e} onClick={() => insertText('reply', e)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer' }}>{e}</button>)}
                  </div>
                )}
                <textarea 
                  placeholder="Escreva sua resposta oficial aqui..." 
                  style={{ width: '100%', background: 'transparent', border: 0, outline: 'none', padding: '16px', fontSize: 15, resize: 'none', minHeight: 120, fontFamily: 'inherit' }}
                  value={inputMsg}
                  onChange={e => setInputMsg(e.target.value)}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'white', borderTop: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={{ background: 'transparent', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, color: 'hsl(var(--text-muted))', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => fileInputRef.current?.click()}><Paperclip size={18} /></button>
                  </div>
                  <button onClick={handleSend} style={{ background: inputMsg.trim() ? '#4f46e5' : '#e2e8f0', color: inputMsg.trim() ? 'white' : '#94a3b8', border: 0, padding: '10px 24px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, cursor: inputMsg.trim() ? 'pointer' : 'default', transition: 'all 0.2s' }}>
                    <Reply size={18} /> Enviar Resposta
                  </button>
                </div>
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
      <AnimatePresence>
{showNewChatModal && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ background: '#fff', borderRadius: 16, width: '90%', maxWidth: 500, padding: 24, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
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
               {!selectedRecipient ? (
                 <>
                   {newChatSearch === '' ? (
                     <>
                        <h4 style={{ fontSize: 13, textTransform: 'uppercase', color: 'hsl(var(--text-muted))', fontWeight: 800, marginBottom: 12, letterSpacing: 1 }}>Selecione por Turma / Grupo</h4>
                        {chatGroups?.map(grupo => {
                           const isExpanded = expandedGroup === grupo.id
                           let totalAlunos = (alunos || []).filter((a: any) => (grupo.alunosIds || []).includes(a.id)).length
                           
                           return (
                             <div key={grupo.id} style={{ marginBottom: 12, border: '1px solid hsl(var(--border-subtle))', borderRadius: 12, overflow: 'hidden' }}>
                                <div 
                                   onClick={() => setExpandedGroup(isExpanded ? null : grupo.id)}
                                   style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', background: isExpanded ? 'rgba(99,102,241,0.05)' : 'transparent' }}
                                >
                                   <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                      <div style={{ width: 32, height: 32, borderRadius: 8, background: grupo.cor || '#4338ca', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Users size={16} /></div>
                                      <div style={{ fontWeight: 700 }}>{grupo.nome}</div>
                                   </div>
                                   <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{totalAlunos} Alunos</span>
                                </div>
                                {isExpanded && (
                                  <div style={{ padding: '8px 16px 16px 16px', display: 'flex', flexDirection: 'column', gap: 8, background: '#f8fafc' }}>
                                     {(alunos || []).filter((a: any) => (grupo.alunosIds || []).includes(a.id)).map((a: any) => (
                                       <div key={a.id} onClick={() => startNewChat(a.id, a.nome)} style={{ padding: '10px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span style={{ fontWeight: 600, fontSize: 13 }}>{a.nome}</span>
                                          <Plus size={14} color="#4f46e5" />
                                       </div>
                                     ))}
                                  </div>
                                )}
                             </div>
                           )
                        })}
                     </>
                   ) : newChatSearch.length >= 3 ? (
                     <>
                       {(alunos || []).filter(a => a.nome.toLowerCase().includes(newChatSearch.toLowerCase()) || a.id.includes(newChatSearch)).slice(0, 50).map(a => (
                         <div 
                           key={a.id} 
                           style={{ padding: '12px 16px', borderBottom: '1px solid hsl(var(--border-subtle))', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderRadius: 12, marginBottom: 8 }}
                           onClick={() => startNewChat(a.id, a.nome)}
                         >
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                              <div className="avatar" style={{ width: 40, height: 40, background: 'var(--gradient-primary)', color: 'white' }}>
                                <User size={20} />
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: '#1e293b' }}>{a.nome}</div>
                                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Turma: {turmas.find((t: any) => String(t.id) === String(a.turma) || String(t.codigo) === String(a.turma) || String(t.nome) === String(a.turma))?.nome || a.turma} • MAT: {a.id.substring(0,8)}</div>
                              </div>
                            </div>
                            <button className="btn btn-primary btn-sm" style={{ borderRadius: 20 }}>Selecionar</button>
                         </div>
                       ))}
                     </>
                   ) : (
                     <div style={{ textAlign: 'center', padding: '60px 20px', color: 'hsl(var(--text-muted))' }}>
                        <Search size={48} style={{ opacity: 0.1, marginBottom: 16 }} />
                        <p>Digite pelo menos 3 letras para buscar um aluno.</p>
                     </div>
                   )}
                 </>
               ) : (
                 <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                       <div className="avatar" style={{ width: 32, height: 32, background: '#4f46e5', color: 'white' }}><User size={14} /></div>
                       <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Enviando para:</div>
                          <div style={{ fontWeight: 700 }}>{selectedRecipient.nome}</div>
                       </div>
                       <button className="btn btn-ghost btn-sm" onClick={() => setSelectedRecipient(null)}>Alterar</button>
                    </div>
                    
                    <div className="form-group">
                      <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: 'block' }}>Assunto do Tópico</label>
                      <input 
                        className="form-input" 
                        placeholder="Ex: Assunto Financeiro / Dúvida Pedagógica" 
                        value={composeSubject}
                        onChange={e => setComposeSubject(e.target.value)}
                        style={{ width: '100%' }}
                      />
                    </div>

                    <div className="form-group">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <label style={{ fontSize: 12, fontWeight: 700 }}>Mensagem Inicial</label>
                        <div style={{ display: 'flex', gap: 12 }}>
                          <button onClick={() => setShowEmojiTarget(showEmojiTarget === 'compose' ? null : 'compose')} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><Smile size={14} /></button>
                        </div>
                      </div>
                      {showEmojiTarget === 'compose' && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 10, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 8 }}>
                          {EMOJIS.map(e => <button key={e} onClick={() => insertText('compose', e)} style={{ border: 'none', background: 'none', fontSize: 18, cursor: 'pointer' }}>{e}</button>)}
                        </div>
                      )}
                      <textarea 
                        className="form-input" 
                        placeholder="Escreva o conteúdo da mensagem..." 
                        value={composeBody}
                        onChange={e => setComposeBody(e.target.value)}
                        style={{ width: '100%', minHeight: 120, resize: 'none' }}
                      />
                    </div>

                    <button 
                       className="btn btn-primary" 
                       style={{ height: 48, borderRadius: 12 }}
                       disabled={!composeSubject.trim() || !composeBody.trim()}
                       onClick={finalSendAdminTicket}
                    >
                       <Send size={18} /> Enviar Mensagem Oficial
                    </button>
                 </div>
               )}
            </div>
          </motion.div>
        
</motion.div>
)}</AnimatePresence>
    </div>
  )
}
