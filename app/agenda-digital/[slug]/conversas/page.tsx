'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import React, { useState, useRef, useEffect, use } from 'react'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { Send, Phone, Search, Users, MessageSquare, Plus, X, StopCircle, GraduationCap, DollarSign, FileText, BookOpen, ChevronRight, ChevronLeft, CheckCircle2, Building, CheckCheck } from 'lucide-react'
import { getInitials } from '@/lib/utils'

export default function ADConversasPage({ params }: { params: Promise<{ slug: string }>}) {
  const { messages, setMessages, chatsList, setChatsList } = useAgendaDigital()
  const resolvedParams = use(params as Promise<{ slug: string }>)
  const { turmas = [] } = useData();
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const { currentUser } = useApp()

  const aluno = alunos.find(a => a.id === resolvedParams.slug)
  const turmaDoAluno = turmas.find(t => t.id === (aluno as any)?.turmaId || t.nome === (aluno as any)?.turma)
  const professorNome = turmaDoAluno?.professor || 'Professor(a) Titular'

  const [chats, setChats] = useState<any[]>([])

  const [activeChat, setActiveChat] = useState<any>(null)
  const [inputText, setInputText] = useState('')
  const [showNovaConversa, setShowNovaConversa] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDestinatarioGroup, setSelectedDestinatarioGroup] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [grupos, setGrupos] = useState<any[]>([])
  const [sysUsers, setSysUsers] = useState<any[]>([])
  
  // Sincronizar os chats globais do estudante
  useEffect(() => {
    const studentChats = chatsList.filter(c => String(c.id).startsWith(String(resolvedParams.slug)))
    if (studentChats.length > 0 && chats.length === 0) {
      setChats(studentChats)
    }
  }, [chatsList, resolvedParams.slug])

  useEffect(() => {
    const savedGrupos = localStorage.getItem('ad_grupos_manuais')
    if (savedGrupos) {
      try { setGrupos(JSON.parse(savedGrupos)) } catch(e){}
    }
    const savedSysU = localStorage.getItem('edu-sys-users')
    if (savedSysU) {
      try { setSysUsers(JSON.parse(savedSysU)) } catch(e){}
    }
  }, [])

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
        [activeChat.id]: [...current, { id: Date.now(), text: inputText, sender: 'them', time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }]
      }
    })
    
    setChats(prev => prev.map(c => String(c.id) === String(activeChat.id) ? { ...c, preview: inputText, time: 'Agora' } : c))
    setChatsList(prev => prev.map(c => String(c.id) === String(activeChat.id) ? { ...c, preview: inputText, time: 'Agora', unread: (c.unread || 0) + 1 } : c))
    
    setInputText('')
  }

  const destinatariosDisponiveis = [
    { id: `${resolvedParams.slug}-prof-novo`, name: `Profª ${professorNome}`, tag: 'Professor(a)', icon: <BookOpen size={20} color="#f59e0b" />, color: '#f59e0b', desc: 'Dúvidas em sala, comportamento ou materiais.' },
    { id: `${resolvedParams.slug}-coord`, name: 'Coordenação Pedagógica', tag: 'Pedagógico', icon: <GraduationCap size={20} color="#8b5cf6" />, color: '#8b5cf6', desc: 'Desenvolvimento, avaliações médicas e faltas.' },
    { id: `${resolvedParams.slug}-finan`, name: 'Setor Financeiro', tag: 'Financeiro', icon: <DollarSign size={20} color="#10b981" />, color: '#10b981', desc: 'Boletos, declarações e renegociações.' },
    { id: `${resolvedParams.slug}-sec`, name: 'Secretaria Escolar', tag: 'Administração', icon: <FileText size={20} color="#3b82f6" />, color: '#3b82f6', desc: 'Documentações, carteirinha e atualização de dados.' },
    { id: `${resolvedParams.slug}-dir`, name: 'Direção Escolar', tag: 'Diretoria', icon: <Building size={20} color="#ec4899" />, color: '#ec4899', desc: 'Assuntos corporativos, ouvidoria e estratégias.' },
  ]

  const startNovaConversa = (dest: any) => {
    const existing = chats.find(c => c.id === dest.id)
    if (existing) {
      setActiveChat(existing)
    } else {
      const novo = { id: dest.id, name: dest.name, status: 'online', preview: 'Iniciando nova conversa...', time: 'Agora', unread: 0, tag: dest.tag, avatarColor: dest.color }
      setChats(prev => [novo, ...prev])
      
      const adminNovo = { ...novo, name: `${aluno?.nome?.split(' ')[0] || 'Família'} -> ${dest.name}` }
      setChatsList(prev => prev.find(c => String(c.id) === String(dest.id)) ? prev : [adminNovo, ...prev])
      
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
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Plus size={16} /> Nova
            </button>
          </div>
          
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: 12, color: 'hsl(var(--text-muted))' }} />
            <input 
              className="form-input" 
              placeholder="Pesquisar por nome ou setor..." 
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
                onClick={() => { setActiveChat(chat); setShowNovaConversa(false) }}
                style={{ 
                  padding: '16px 12px', 
                  marginBottom: 4,
                  display: 'flex', 
                  gap: 16, 
                  cursor: 'pointer',
                  background: isActive ? 'rgba(99, 102, 241, 0.06)' : 'transparent',
                  borderRadius: 12,
                  transition: 'background 0.2s'
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'hsl(var(--bg-main))' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ position: 'relative' }}>
                   <div style={{ width: 52, height: 52, background: chat.avatarColor || 'var(--gradient-purple)', color: 'white', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, boxShadow: isActive ? `0 6px 16px ${chat.avatarColor}40` : 'none', transition: 'all 0.3s' }}>
                     {getInitials(chat.name.split(' (')[0])}
                   </div>
                   {chat.status === 'online' && (
                     <div style={{ width: 14, height: 14, background: '#10b981', border: '3px solid hsl(var(--bg-surface))', borderRadius: 7, position: 'absolute', bottom: -2, right: -2 }}></div>
                   )}
                </div>
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ fontWeight: isActive ? 800 : 700, fontSize: 15, color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--text-main))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.name}</div>
                    <div style={{ fontSize: 12, color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--text-muted))', fontWeight: isActive ? 600 : 500, paddingTop: 2 }}>{chat.time}</div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 13, color: isActive ? 'hsl(var(--text-secondary))' : 'hsl(var(--text-muted))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 8 }}>{chat.preview}</div>
                    {chat.unread > 0 && (
                      <div style={{ background: '#ef4444', color: 'white', fontSize: 11, fontWeight: 800, minWidth: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px', boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)' }}>
                        {chat.unread}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {filteredChats.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 14 }}>
              Nenhuma conversa encontrada.
            </div>
          )}
        </div>
      </div>

      {/* Main Area (Nova Conversa or Chat Area) */}
      <div className={`ad-chat-main ${!(activeChat || showNovaConversa) ? 'mobile-hidden' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'hsl(var(--bg-main))', position: 'relative', width: '100%' }}>
          
          {showNovaConversa ? (
            <div className="ad-nova-conversa-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '60px 80px', animation: 'fadeIn 0.3s ease-out', overflowY: 'auto' }}>
              <div className="ad-nova-conversa-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
                <div>
                  <div className="ad-nova-conversa-titlebox" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <button className="mobile-back-btn" onClick={() => { setShowNovaConversa(false); setSelectedDestinatarioGroup(null); }} style={{ background: 'transparent', border: 'none', padding: 0, display: 'none', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-main))' }}>
                      <ChevronLeft size={24} />
                    </button>
                    {selectedDestinatarioGroup && (
                      <button onClick={() => setSelectedDestinatarioGroup(null)} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', width: 36, height: 36, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', color: 'hsl(var(--text-muted))' }}>
                        <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
                      </button>
                    )}
                    <h2 style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-main))', margin: 0 }}>Nova Conversa</h2>
                  </div>
                  <p style={{ color: 'hsl(var(--text-muted))', fontSize: 15, maxWidth: 400 }}>
                    {selectedDestinatarioGroup 
                      ? `Quem você quer contatar em ${selectedDestinatarioGroup.tag}?` 
                      : 'Selecione o setor ou professor que deseja se comunicar para iniciar um canal direto.'}
                  </p>
                </div>
                <button onClick={() => { setShowNovaConversa(false); setSelectedDestinatarioGroup(null); }} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', width: 40, height: 40, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-muted))', transition: 'all 0.2s' }} onMouseEnter={e => e.currentTarget.style.color='hsl(var(--text-main))'} onMouseLeave={e => e.currentTarget.style.color='hsl(var(--text-muted))'}>
                  <X size={20} />
                </button>
              </div>

              {!selectedDestinatarioGroup ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                  {destinatariosDisponiveis.map(dest => (
                    <div key={dest.id} onClick={() => setSelectedDestinatarioGroup(dest)} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24, cursor: 'pointer', display: 'flex', gap: 20, alignItems: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.02)', transition: 'all 0.2s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = dest.color; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 12px 24px ${dest.color}20` }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.02)' }}
                    >
                      <div style={{ width: 56, height: 56, borderRadius: 16, background: `${dest.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {dest.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: dest.color, fontWeight: 800, marginBottom: 4 }}>{dest.tag}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-main))', marginBottom: 4 }}>{dest.name}</div>
                        <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', lineHeight: 1.4 }}>{dest.desc}</div>
                      </div>
                      <ChevronRight size={20} color="hsl(var(--text-muted))" style={{ opacity: 0.5 }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, animation: 'fadeIn 0.3s' }}>
                  {(() => {
                    const grupoDB = grupos.find(g => g.nome.toLowerCase() === selectedDestinatarioGroup.tag.toLowerCase());
                    const colabsIds = grupoDB?.colaboradoresIds || [];
                    const atendentes = sysUsers.filter(u => colabsIds.includes(u.id));

                    if (atendentes.length === 0) {
                      return (
                        <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', background: 'hsl(var(--bg-surface))', borderRadius: 20, border: '1px dashed hsl(var(--border-subtle))' }}>
                           <Users size={48} style={{ color: 'hsl(var(--text-muted))', opacity: 0.3, marginBottom: 16 }} />
                           <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Nenhum atendente online</h3>
                           <p style={{ color: 'hsl(var(--text-muted))' }}>A instituição ainda não configurou os colaboradores para este setor.</p>
                        </div>
                      )
                    }

                    return atendentes.map(atendente => (
                      <div key={atendente.id} onClick={() => startNovaConversa({
                          id: `${selectedDestinatarioGroup.id}-${atendente.id}`,
                          name: `${atendente.nome} (${selectedDestinatarioGroup.tag})`,
                          tag: selectedDestinatarioGroup.tag,
                          color: selectedDestinatarioGroup.color
                        })} 
                        style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 24, cursor: 'pointer', display: 'flex', gap: 16, alignItems: 'center', transition: 'all 0.2s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = selectedDestinatarioGroup.color; e.currentTarget.style.background = `${selectedDestinatarioGroup.color}05` }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'; e.currentTarget.style.background = 'hsl(var(--bg-surface))' }}
                      >
                         <div style={{ width: 48, height: 48, borderRadius: 16, background: selectedDestinatarioGroup.color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18, boxShadow: `0 4px 12px ${selectedDestinatarioGroup.color}40` }}>
                           {getInitials(atendente.nome)}
                         </div>
                         <div>
                           <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', fontWeight: 600, marginBottom: 2 }}>Equipe {selectedDestinatarioGroup.tag}</div>
                           <div style={{ fontSize: 16, fontWeight: 700 }}>{atendente.nome}</div>
                         </div>
                      </div>
                    ))
                  })()}
                </div>
              )}
            </div>


          ) : activeChat ? (
            <>
               {/* Chat Header */}
               <div className="ad-chat-header" style={{ padding: '24px 32px', background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(12px)', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <button className="mobile-back-btn" onClick={() => { setActiveChat(null); }} style={{ background: 'transparent', border: 'none', padding: 0, display: 'none', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'hsl(var(--text-main))' }}>
                      <ChevronLeft size={24} />
                    </button>
                    <div className="avatar ad-chat-header-avatar" style={{ width: 56, height: 56, background: activeChat.avatarColor || 'var(--gradient-purple)', color: 'white', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 20, boxShadow: `0 8px 24px ${activeChat.avatarColor || '#6366f1'}40` }}>
                      {getInitials(activeChat.name.split(' (')[0])}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 20, color: 'hsl(var(--text-main))', marginBottom: 4 }}>{activeChat.name}</div>
                      <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                        <div style={{ width: 8, height: 8, background: '#10b981', borderRadius: 4 }}></div>
                        Online - Atendimento Digital
                      </div>
                    </div>
                  </div>
               </div>

               {/* Lista de Mensagens */}
               <div style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
                 <div style={{ textAlign: 'center', margin: '16px 0 32px' }}>
                   <span style={{ background: 'hsl(var(--bg-surface))', padding: '8px 20px', borderRadius: 20, fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', border: '1px solid rgba(0,0,0,0.04)', boxShadow: '0 4px 12px rgba(0,0,0,0.02)' }}>
                     Atendimento criptografado ponta-a-ponta
                   </span>
                 </div>
                 
                 {activeMessages.map((msg: any) => {
                   const isMe = msg.sender === 'them'
                   const senderName = isMe ? (currentUser?.nome || 'Você') : activeChat.name

                   return (
                     <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
                       <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '65%' }}>
                         
                         <div className="ad-chat-bubble" style={{ 
                           background: isMe ? 'var(--gradient-primary)' : 'hsl(var(--bg-surface))',
                           color: isMe ? 'white' : 'hsl(var(--text-main))',
                           padding: '16px 20px',
                           borderRadius: isMe ? '24px 24px 4px 24px' : '24px 24px 24px 4px',
                           width: '100%',
                           border: isMe ? 'none' : '1px solid hsl(var(--border-subtle))',
                           boxShadow: isMe ? '0 8px 24px rgba(99, 102, 241, 0.25)' : '0 4px 16px rgba(0,0,0,0.04)',
                           position: 'relative'
                         }}>
                           <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }} className="ad-chat-bubble-text">{msg.text}</p>
                           
                           <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: isMe ? 'flex-end' : 'flex-start', marginTop: 8, opacity: isMe ? 0.85 : 0.5 }}>
                             <div style={{ fontSize: 11, fontWeight: 600 }}>{msg.time}</div>
                             {isMe && <CheckCheck size={14} color={isMe ? "#fff" : "#3b82f6"} />}
                           </div>
                         </div>

                       </div>
                     </div>
                   )
                 })}
                 <div ref={messagesEndRef} />
               </div>

               {/* Caixa de Texto */}
               <div className="ad-chat-input-area" style={{ padding: '24px 40px', background: 'hsl(var(--bg-surface))', borderTop: '1px solid hsl(var(--border-subtle))' }}>
                 <form onSubmit={handleSend} style={{ display: 'flex', gap: 16 }}>
                   <input 
                     value={inputText}
                     onChange={e => setInputText(e.target.value)}
                     className="form-input" 
                     placeholder="Escreva sua mensagem aqui..." 
                     style={{ flex: 1, borderRadius: 32, paddingLeft: 24, fontSize: 15, border: '1px solid hsl(var(--border-subtle))', height: 56, background: 'hsl(var(--bg-main))' }}
                   />
                   <button 
                     type="submit" 
                     className="btn btn-primary" 
                     style={{ width: 56, height: 56, padding: 0, borderRadius: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: inputText.trim() ? 'var(--gradient-primary)' : 'hsl(var(--bg-surface-alt))', color: inputText.trim() ? 'white' : 'hsl(var(--text-muted))', border: inputText.trim() ? 'none' : '1px solid hsl(var(--border-subtle))', boxShadow: inputText.trim() ? '0 8px 24px rgba(99, 102, 241, 0.3)' : 'none', transition: 'all 0.2s', cursor: inputText.trim() ? 'pointer' : 'not-allowed' }}
                     disabled={!inputText.trim()}
                   >
                     <Send size={20} style={{ marginLeft: -2 }} />
                   </button>
                 </form>
               </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'hsl(var(--bg-main))', color: 'hsl(var(--text-muted))' }}>
              <div style={{ width: 96, height: 96, borderRadius: 48, background: 'hsl(var(--bg-surface))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 12px 32px rgba(0,0,0,0.04)' }}>
                 <MessageSquare size={40} style={{ color: 'hsl(var(--primary))', opacity: 0.5 }} />
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-main))', marginBottom: 12, fontFamily: 'Outfit, sans-serif' }}>Atendimento Integrado</h3>
              <p style={{ maxWidth: 420, textAlign: 'center', fontSize: 15, lineHeight: 1.6 }}>
                Selecione uma conversa ao lado para acompanhar o desenvolvimento do aluno ou clique em <strong>Nova Conversa</strong> para contatar a secretaria.
              </p>
              <button 
                onClick={() => setShowNovaConversa(true)}
                style={{ marginTop: 24, background: 'hsl(var(--bg-surface))', color: 'hsl(var(--primary))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 20, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--gradient-primary)'; e.currentTarget.style.color = 'white' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'hsl(var(--bg-surface))'; e.currentTarget.style.color = 'hsl(var(--primary))' }}
              >
                <Plus size={18} /> Iniciar Conversa
              </button>
            </div>
          )}
      </div>
    </div>
  )
}

