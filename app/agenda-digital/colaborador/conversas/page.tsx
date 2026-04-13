'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import React, { useState, useRef, useEffect } from 'react'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { Send, Search, Users, MessageSquare, Plus, X, StopCircle, GraduationCap, DollarSign, FileText, BookOpen, ChevronRight, ChevronLeft, Building, CheckCheck } from 'lucide-react'
import { getInitials } from '@/lib/utils'

export default function ColaboradorConversasPage() {
  const { messages, setMessages, chatsList, setChatsList } = useAgendaDigital()
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const { currentUser } = useApp()

  const [chats, setChats] = useState<any[]>([])
  const [activeChat, setActiveChat] = useState<any>(null)
  const [inputText, setInputText] = useState('')
  const [showNovaConversa, setShowNovaConversa] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentUser) {
       const staffChats = chatsList.filter(c => (c as any).targetId === currentUser.id || (c as any).authorId === currentUser.id)
       if (staffChats.length > 0 && chats.length === 0) {
         setChats(staffChats)
       }
    }
  }, [chatsList, currentUser])

  const getFakeMessagesForChat = (chat: any) => {
    return []
  }

  const activeMessages = activeChat ? messages[activeChat.id] || getFakeMessagesForChat(activeChat) : []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim() || !activeChat) return

    setMessages(prev => {
      const current = prev[activeChat.id] || getFakeMessagesForChat(activeChat)
      return {
        ...prev,
        [activeChat.id]: [...current, { id: Date.now(), text: inputText, sender: 'me', time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }]
      }
    })
    
    setChats(prev => prev.map(c => String(c.id) === String(activeChat.id) ? { ...c, preview: inputText, time: 'Agora' } : c))
    
    setInputText('')
  }

  // Generate target list (simulate families + other departments)
  const familiasDestinatarios = alunos.slice(0, 10).map(a => ({
     id: `fam-${a.id}`,
     name: `Família: ${a.nome}`,
     tag: `Turma ${a.turma}`,
     icon: <Users size={20} color="#3b82f6" />,
     color: '#3b82f6',
     desc: `Responsável: ${a.responsavel || 'Não informado'}`
  }))

  const setorDestinatarios = [
    { id: `colab-coord`, name: 'Coordenação Pedagógica', tag: 'Equipe', icon: <GraduationCap size={20} color="#8b5cf6" />, color: '#8b5cf6', desc: 'Canal direto com os coordenadores.' },
    { id: `colab-finan`, name: 'Setor de RH / Financeiro', tag: 'Administrativo', icon: <DollarSign size={20} color="#10b981" />, color: '#10b981', desc: 'Dúvidas sobre pagamentos e folha.' },
    { id: `colab-dir`, name: 'Direção Escolar', tag: 'Diretoria', icon: <Building size={20} color="#ec4899" />, color: '#ec4899', desc: 'Comunicação executiva.' },
  ]

  const destinatariosDisponiveis = [...setorDestinatarios, ...familiasDestinatarios]

  const startNovaConversa = (dest: any) => {
    const existing = chats.find(c => c.id === dest.id)
    if (existing) {
      setActiveChat(existing)
    } else {
      const novo = { id: dest.id, name: dest.name, status: 'online', preview: 'Inicie o contato...', time: 'Agora', unread: 0, tag: dest.tag, avatarColor: dest.color }
      setChats(prev => [novo, ...prev])
      setActiveChat(novo)
    }
    setShowNovaConversa(false)
  }

  const filteredChats = chats.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.tag.toLowerCase().includes(searchQuery.toLowerCase()))

  return (
    <div className="ad-chat-container" style={{ display: 'flex', height: 'calc(100vh - 140px)', background: 'hsl(var(--bg-main))', borderRadius: 24, border: '1px solid hsl(var(--border-subtle))', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.03)' }}>
      
      {/* Sidebar (Lista de Chats) */}
      <div className={`ad-chat-sidebar ${(activeChat || showNovaConversa) ? 'mobile-hidden' : ''}`} style={{ width: 360, background: 'hsl(var(--bg-surface))', borderRight: '1px solid hsl(var(--border-subtle))', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-main))' }}>Mensagens</h2>
            <button 
              onClick={() => setShowNovaConversa(true)}
              style={{ background: 'var(--gradient-primary)', color: 'white', border: 'none', borderRadius: 20, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)', transition: 'transform 0.2s' }}
            >
              <Plus size={16} /> Nova
            </button>
          </div>
          
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: 'hsl(var(--text-muted))' }} />
            <input 
              className="form-input" 
              placeholder="Pesquisar conversas..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ paddingLeft: 38, width: '100%', fontSize: 14, borderRadius: 12, background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))', height: 42 }} 
            />
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
          {filteredChats.map(chat => {
            const isActive = activeChat?.id === chat.id
            return (
              <div 
                key={chat.id} 
                className={`ad-chat-list-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveChat(chat)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '16px', borderRadius: 16,
                  cursor: 'pointer', transition: 'all 0.2s', marginBottom: 4,
                  background: isActive ? 'rgba(99,102,241,0.08)' : 'transparent',
                  border: isActive ? '1px solid rgba(99,102,241,0.15)' : '1px solid transparent'
                }}
                onMouseEnter={e => !isActive && (e.currentTarget.style.background = 'rgba(0,0,0,0.02)')}
                onMouseLeave={e => !isActive && (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ position: 'relative' }}>
                  <div className="avatar" style={{ width: 52, height: 52, fontSize: 18, background: chat.avatarColor || 'var(--gradient-purple)', color: 'white', borderRadius: 18, boxShadow: isActive ? `0 8px 16px ${chat.avatarColor}40` : 'none', transition: 'all 0.3s' }}>
                    {getInitials(chat.name.replace('Família: ', ''))}
                  </div>
                  {chat.status === 'online' && (
                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, background: '#10b981', border: '2.5px solid hsl(var(--bg-surface))', borderRadius: '50%' }} />
                  )}
                </div>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ fontWeight: isActive ? 800 : 700, fontSize: 15, color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--text-main))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {chat.name}
                    </div>
                    <div style={{ fontSize: 11, color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))', fontWeight: isActive ? 600 : 500, whiteSpace: 'nowrap' }}>
                      {chat.time}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: (chat.unread || 0) > 0 ? 600 : 400 }}>
                      {chat.preview}
                    </div>
                    {chat.unread > 0 && (
                      <div className="badge-pulse" style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: 'white', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 10, flexShrink: 0, boxShadow: '0 4px 12px rgba(225,29,72,0.3)' }}>
                        {chat.unread}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          
          {filteredChats.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40 }}>
               <MessageSquare size={32} style={{ color: 'hsl(var(--border-subtle))', marginBottom: 12 }} />
               <p style={{ color: 'hsl(var(--text-muted))', fontSize: 14 }}>Nenhuma conversa encontrada.</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={`ad-chat-main ${!activeChat && !showNovaConversa ? 'mobile-hidden' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'hsl(var(--bg-surface))' }}>
        
        {showNovaConversa ? (
          <div className="ad-new-chat-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', animation: 'fadeIn 0.3s' }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-main))', display: 'flex', alignItems: 'center', gap: 16 }}>
              <button 
                onClick={() => setShowNovaConversa(false)} 
                className="btn btn-secondary btn-sm" 
                style={{ width: 40, height: 40, padding: 0, borderRadius: 20 }}
              >
                <X size={20} />
              </button>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Nova Conversa</h2>
                <p style={{ fontSize: 13, color: 'hsl(var(--text-muted))', margin: 0 }}>Selecione um contato para iniciar</p>
              </div>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 32 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16 }}>Destinatários Disponíveis</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {destinatariosDisponiveis.map(dest => (
                  <div 
                    key={dest.id}
                    className="ad-dest-card"
                    onClick={() => startNovaConversa(dest)}
                    style={{ background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: 20, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', gap: 16 }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = dest.color; e.currentTarget.style.backgroundColor = `${dest.color}05`; e.currentTarget.style.transform = 'translateY(-2px)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.backgroundColor = 'hsl(var(--bg-main))'; e.currentTarget.style.transform = 'none' }}
                  >
                    <div style={{ width: 48, height: 48, borderRadius: 12, background: `${dest.color}15`, color: dest.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {dest.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-main))', marginBottom: 4 }}>{dest.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: dest.color, marginBottom: 8, display: 'inline-block', padding: '2px 6px', background: `${dest.color}10`, borderRadius: 6 }}>{dest.tag}</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', lineHeight: 1.4 }}>{dest.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeChat ? (
          <>
            <div className="ad-chat-header" style={{ padding: '20px 32px', borderBottom: '1px solid hsl(var(--border-subtle))', background: 'hsl(var(--bg-surface))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.02)', zIndex: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                 <button 
                  className="ad-mobile-back-btn btn btn-secondary btn-sm"
                  onClick={() => setActiveChat(null)}
                  style={{ width: 40, height: 40, padding: 0, borderRadius: 20, marginRight: -4 }}
                >
                  <ChevronLeft size={22} />
                </button>
                <div className="avatar" style={{ width: 48, height: 48, fontSize: 16, background: activeChat.avatarColor || 'var(--gradient-purple)', color: 'white', borderRadius: 16, boxShadow: `0 4px 12px ${activeChat.avatarColor || '#8B5CF6'}40` }}>
                  {getInitials(activeChat.name.replace('Família: ', ''))}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, color: 'hsl(var(--text-main))', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {activeChat.name}
                    {activeChat.status === 'online' && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}/>}
                  </div>
                  <div style={{ fontSize: 13, color: 'hsl(var(--primary))', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {activeChat.tag}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                 <button className="btn btn-secondary btn-sm" style={{ width: 40, height: 40, padding: 0, borderRadius: 12 }}>
                   <Search size={18} />
                 </button>
                 <button className="btn btn-secondary btn-sm" style={{ height: 40, borderRadius: 12, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}>
                   <StopCircle size={16} /> Encerrar
                 </button>
              </div>
            </div>
            
            {/* Messages Area */}
            <div className="ad-chat-messages" style={{ flex: 1, padding: '32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24, background: 'linear-gradient(180deg, hsl(var(--bg-main)), hsl(var(--bg-surface)))' }}>
              
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                 <span style={{ background: 'hsl(var(--bg-overlay))', color: 'hsl(var(--text-muted))', fontSize: 11, fontWeight: 600, padding: '6px 16px', borderRadius: 20, letterSpacing: 0.5 }}>
                   CONVERSA INICIADA HOJE
                 </span>
              </div>

              {activeMessages.map((msg: any) => {
                const isMe = msg.sender === 'me'
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '100%', animation: 'fadeUp 0.3s ease-out forwards' }}>
                    <div style={{ 
                       background: isMe ? 'var(--gradient-primary)' : 'hsl(var(--bg-overlay))',
                       color: isMe ? 'white' : 'hsl(var(--text-main))',
                       padding: '14px 20px',
                       borderRadius: 20,
                       borderTopRightRadius: isMe ? 4 : 20,
                       borderTopLeftRadius: !isMe ? 4 : 20,
                       maxWidth: '75%',
                       fontSize: 15,
                       lineHeight: 1.5,
                       boxShadow: isMe ? '0 8px 24px rgba(99,102,241,0.2)' : '0 4px 12px rgba(0,0,0,0.03)',
                       border: isMe ? 'none' : '1px solid hsl(var(--border-subtle))'
                    }}>
                      {msg.text}
                    </div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px' }}>
                      {msg.time}
                      {isMe && <CheckCheck size={14} color="#6366f1" />}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input Area */}
            <div className="ad-chat-input-area" style={{ padding: '24px 32px', background: 'hsl(var(--bg-surface))', borderTop: '1px solid hsl(var(--border-subtle))', position: 'relative', zIndex: 10 }}>
              <form onSubmit={handleSend} style={{ display: 'flex', gap: 16 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <input 
                    className="form-input"
                    placeholder="Digite sua mensagem profissional..."
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    style={{ width: '100%', paddingLeft: 20, paddingRight: 48, height: 56, borderRadius: 28, fontSize: 15, background: 'hsl(var(--bg-main))', border: '1px solid hsl(var(--border-subtle))', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                  />
                  <div style={{ position: 'absolute', right: 8, top: 8, display: 'flex', gap: 4 }}>
                    <button type="button" className="btn btn-secondary" style={{ width: 40, height: 40, padding: 0, borderRadius: 20, color: 'hsl(var(--text-muted))', border: 'none', background: 'transparent' }}>
                      <FileText size={20} />
                    </button>
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={!inputText.trim()}
                  style={{ 
                    width: 56, height: 56, borderRadius: 28,
                    background: inputText.trim() ? 'var(--gradient-primary)' : 'hsl(var(--bg-overlay))',
                    color: inputText.trim() ? 'white' : 'hsl(var(--text-muted))',
                    border: 'none', cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: inputText.trim() ? '0 8px 24px rgba(99,102,241,0.3)' : 'none',
                    transition: 'all 0.3s'
                  }}
                  onMouseEnter={e => inputText.trim() && (e.currentTarget.style.transform = 'scale(1.05)')}
                  onMouseLeave={e => inputText.trim() && (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <Send size={22} style={{ transform: 'translateX(2px)' }} />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, hsl(var(--bg-main)), hsl(var(--bg-surface)))' }}>
             <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'rgba(99,102,241,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: 'inset 0 0 40px rgba(99,102,241,0.1)' }}>
               <MessageSquare size={48} color="hsl(var(--primary))" opacity={0.6} />
             </div>
             <h3 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-main))', marginBottom: 12 }}>Atendimento Institucional</h3>
             <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 15, maxWidth: 400, textAlign: 'center', lineHeight: 1.6, marginBottom: 32 }}>
               Selecione uma conversa na lista lateral ou inicie um novo contato com um responsável ou outro setor da escola.
             </p>
             <button 
                onClick={() => setShowNovaConversa(true)}
                className="btn btn-primary"
                style={{ height: 48, padding: '0 24px', borderRadius: 24, fontSize: 15, fontWeight: 700 }}
             >
                <Plus size={18} /> Iniciar Novo Chat
             </button>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .badge-pulse { animation: pulse 2s infinite; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ad-mobile-back-btn { display: none !important; }

        @media (max-width: 768px) {
          .ad-chat-container { border-radius: 0 !important; border: none !important; height: calc(100vh - 200px) !important; box-shadow: none !important; }
          .ad-chat-sidebar { width: 100% !important; border-right: none !important; }
          .mobile-hidden { display: none !important; }
          .ad-mobile-back-btn { display: flex !important; margin-right: 8px !important; }
          
          .ad-chat-header { padding: 16px 20px !important; }
          .ad-chat-header .avatar { width: 40px !important; height: 40px !important; font-size: 14px !important; }
          .ad-chat-header h2 { font-size: 18px !important; }
          
          .ad-chat-messages { padding: 20px !important; gap: 16px !important; }
          
          .ad-chat-input-area { padding: 16px !important; padding-bottom: calc(16px + env(safe-area-inset-bottom)) !important; border-top: 1px solid rgba(0,0,0,0.05) !important; }
          .ad-chat-input-area .form-input { height: 48px !important; border-radius: 24px !important; font-size: 14px !important; }
          .ad-chat-input-area button[type="submit"] { width: 48px !important; height: 48px !important; }
          .ad-chat-input-area button[type="submit"] svg { width: 20px !important; height: 20px !important; }
          
          .ad-new-chat-container { padding-bottom: 24px !important; }
          .ad-dest-card { padding: 16px !important; flex-direction: column !important; align-items: flex-start !important; gap: 12px !important; }
        }
      `}} />
    </div>
  )
}
