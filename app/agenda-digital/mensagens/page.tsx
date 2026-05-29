'use client'

import React, { useState, useEffect } from 'react'
import { MessageSquare, Search, Plus, LogOut, ChevronLeft, Calendar, FileText, Settings, User } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useApp } from '@/lib/context'
import { useChats } from '@/lib/chat/useChats'
import { useChatMessages } from '@/lib/chat/useChatMessages'
import { chatService } from '@/lib/chat/services/chatService'
import { supabase } from '@/lib/supabase'
import { UserAvatar } from '@/components/UserAvatar'
import { ChatThread } from '@/components/chat/ChatThread'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { NewChatModal } from '@/components/chat/NewChatModal'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'

export default function MensagensPage() {
  const { currentUser } = useApp()
  const { adAlert } = useAgendaDigital()
  const currentId = currentUser?.aluno_id || currentUser?.responsavel_id || currentUser?.id
  const { 
    conversations, 
    counts,
    isLoading: isLoadingChats, 
    filter, 
    setFilter, 
    refresh,
    archiveConversation,
    deleteConversation,
    pinConversation
  } = useChats(currentId)
  
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Load messages for active chat
  const { messages, isLoading: isLoadingMessages, hasMore, loadMore, sendMessage } = useChatMessages(activeConversationId, currentId)

  // Read URL search params manually to avoid Suspense requirement
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const convId = params.get('conversation')
      const isNew = params.get('new')
      
      if (convId) {
        setActiveConversationId(convId)
      }
      if (isNew) {
        setIsModalOpen(true)
      }
      
      // Clean up URL without reloading
      if (convId || isNew) {
        window.history.replaceState({}, '', '/agenda-digital/mensagens')
      }
    }
  }, [])

  const activeConv = conversations.find(c => c.id === activeConversationId)

  const handleStartChat = async (targetId: string, targetName: string, type: 'direct' | 'group', turmaId?: string, roleContext?: string, alunoId?: string) => {
    if (!currentId) return
    setIsCreating(true)
    try {
      let finalParticipantIds = [targetId]
      let namesMap: Record<string, string> = { [targetId]: targetName, [currentId]: currentUser.nome }
      let perfisMap: Record<string, string> = {}
      if (roleContext) {
        perfisMap[targetId] = roleContext
      }

      if (type === 'group' && targetId) {
        // Fetch all students in this turma
        const { data: students } = await supabase.from('alunos').select('id, nome').eq('turma_id', targetId)
        if (students && students.length > 0) {
          finalParticipantIds = students.map(s => s.id)
          students.forEach(s => { namesMap[s.id] = s.nome })
        }
      }

      const conv = await chatService.createConversation({
        title: targetName,
        type: type,
        participant_ids: finalParticipantIds,
        participant_names: namesMap,
        participant_perfis: Object.keys(perfisMap).length > 0 ? perfisMap : undefined,
        turma_id: turmaId,
        aluno_id: alunoId
      }, currentId, currentUser.perfil || 'Usuário')
      
      // Refresh list and select it
      await refresh()
      setActiveConversationId(conv.id)
      setIsModalOpen(false)
    } catch (e) {
      console.error(e)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 100px)', minHeight: 600, background: 'white', borderRadius: 24, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}>
      {/* SIDEBAR (Lista de Conversas) */}
      <div style={{ width: 340, flexShrink: 0, borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', background: 'white' }}>
        <div style={{ padding: '24px 20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Logo / Título oculto ou diferente no layout global, aqui só a busca */}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px 6px', flexWrap: 'wrap', paddingBottom: 4 }}>
            {[
              { id: 'all', label: 'Todas', count: counts?.all || 0 },
              { id: 'unread', label: 'Não lidas', count: counts?.unread || 0 },
              { id: 'pinned', label: 'Fixadas', count: counts?.pinned || 0 },
              { id: 'archived', label: 'Arquivadas', count: counts?.archived || 0 }
            ].map((tab, i) => {
              const isActive = filter.tab === tab.id
              return (
                <button 
                  key={i} 
                  onClick={() => setFilter({ ...filter, tab: tab.id as any })}
                  style={{ 
                    padding: '6px 12px', 
                    borderRadius: 20, 
                    border: 'none', 
                    background: isActive ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : '#f1f5f9', 
                    color: isActive ? 'white' : '#475569', 
                    fontWeight: isActive ? 600 : 500, 
                    fontSize: 12, 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    cursor: 'pointer',
                    flexShrink: 0,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#e2e8f0' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '#f1f5f9' }}
                >
                  {tab.label}
                  <span style={{ 
                    background: isActive ? 'rgba(255,255,255,0.2)' : 'white', 
                    color: isActive ? 'white' : '#475569', 
                    fontSize: 10, 
                    fontWeight: 700, 
                    padding: '2px 6px', 
                    borderRadius: 10 
                  }}>{tab.count}</span>
                </button>
              )
            })}
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ 
              width: '100%', 
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
              color: 'white', 
              borderRadius: 16, 
              padding: '12px 20px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: 10, 
              border: 'none', 
              fontWeight: 600, 
              fontSize: 15, 
              cursor: 'pointer', 
              boxShadow: '0 4px 14px rgba(99, 102, 241, 0.25)',
              transition: 'all 0.2s',
              flexShrink: 0
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.35)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.25)'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nova Conversa
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="Buscar conversas..." 
                value={filter.search}
                onChange={e => setFilter({ ...filter, search: e.target.value })}
                style={{ 
                  width: '100%', 
                  padding: '12px 40px 12px 44px', 
                  borderRadius: 24, 
                  border: '1px solid #f1f5f9', 
                  background: '#f8fafc', 
                  fontSize: 14, 
                  color: '#334155',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
              />
              <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#94a3b8', background: 'white', padding: '2px 6px', borderRadius: 6, border: '1px solid #e2e8f0', fontWeight: 600 }}>⌘ K</span>
            </div>
            <button style={{ 
              width: 44, 
              height: 44, 
              borderRadius: 22, 
              border: '1px solid #f1f5f9', 
              background: '#f8fafc', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              color: '#475569',
              cursor: 'pointer',
              flexShrink: 0
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            </button>
          </div>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px', scrollbarWidth: 'none' }}>
          {isLoadingChats ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
               <MessageSquare size={32} opacity={0.3} />
               <div>Nenhuma conversa encontrada.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {conversations.map(conv => {
                const isUnread = (conv as any).unread_count > 0
                const isActive = activeConversationId === conv.id
                return (
                  <div 
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    style={{ 
                      padding: '12px', 
                      borderRadius: 16, 
                      cursor: 'pointer',
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      background: isActive ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  >
                    {isUnread && (
                      <div style={{ position: 'absolute', left: -4, top: '50%', transform: 'translateY(-50%)', width: 8, height: 8, background: '#6366f1', borderRadius: '50%' }} />
                    )}
                    
                    <div style={{ position: 'relative', flexShrink: 0, marginLeft: isUnread ? 8 : 0 }}>
                      <UserAvatar size={48} name={conv.aluno?.nome || conv.title || 'Chat'} userId={conv.aluno_id || conv.other_participant?.user_id} fotoUrl={conv.aluno?.foto || undefined} />
                      <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, background: '#22c55e', borderRadius: '50%', border: '2px solid white' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span style={{ fontWeight: isUnread ? 800 : 700, fontSize: 15, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {conv.aluno?.nome || conv.title}
                          </span>
                          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {conv.aluno ? (conv.title || conv.other_participant?.user_name || 'Responsável') : (conv.other_participant?.user_perfil || 'Usuário')}
                          </span>
                        </div>
                        <span style={{ fontSize: 12, color: isUnread ? '#6366f1' : '#94a3b8', fontWeight: isUnread ? 600 : 500, flexShrink: 0, marginLeft: 8 }}>
                          {new Date(conv.last_message_at || conv.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: isUnread ? '#334155' : '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: isUnread ? 500 : 400 }}>
                          {conv.last_message_text || 'Sem mensagens'}
                        </span>
                        {isUnread && (
                          <div style={{ background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 'bold', padding: '2px 6px', borderRadius: 10, flexShrink: 0, marginLeft: 8 }}>
                            {(conv as any).unread_count}
                          </div>
                        )}
                      </div>  
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* THREAD (Mensagens) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', position: 'relative', minHeight: 0 }}>
        {/* Decorative subtle pattern behind chat could go here */}
        
        {activeConversationId ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', zIndex: 2, minHeight: 0 }}>
            {/* Thread Header */}
            <div style={{ padding: '20px 32px', borderBottom: '1px solid rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'white' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                 <div style={{ position: 'relative' }}>
                   <UserAvatar size={48} name={activeConv?.aluno?.nome || activeConv?.title || 'Chat'} userId={activeConv?.aluno_id || activeConv?.other_participant?.user_id} fotoUrl={activeConv?.aluno?.foto || undefined} />
                   <div style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, background: '#22c55e', borderRadius: '50%', border: '2px solid white' }} />
                 </div>
                 <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                      {activeConv?.aluno?.nome || activeConv?.title}
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, color: '#22c55e' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }}></span>
                        Online
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
                      {activeConv?.aluno ? (activeConv?.title || activeConv?.other_participant?.user_name || 'Responsável') : (activeConv?.other_participant?.user_perfil || 'Usuário')}
                    </div>
                 </div>
               </div>
               
               <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                 <button 
                   onClick={() => adAlert('Função de áudio em desenvolvimento', 'Aviso')}
                   style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: '#64748b', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.2s' }} 
                   onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a' }} 
                   onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' }}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                 </button>
                 <button 
                   onClick={() => adAlert('Função de vídeo em desenvolvimento', 'Aviso')}
                   style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: '#64748b', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.2s' }} 
                   onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a' }} 
                   onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' }}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                 </button>
                 <button 
                   onClick={() => adAlert('Busca na conversa em desenvolvimento', 'Aviso')}
                   style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: '#64748b', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.2s' }} 
                   onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a' }} 
                   onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' }}>
                   <Search size={20} />
                 </button>
                 
                 <DropdownMenu.Root>
                   <DropdownMenu.Trigger asChild>
                     <button 
                       style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: '#64748b', border: '1px solid #f1f5f9', cursor: 'pointer', transition: 'all 0.2s' }} 
                       onMouseEnter={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#0f172a' }} 
                       onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#64748b' }}>
                       <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                     </button>
                   </DropdownMenu.Trigger>
                   <DropdownMenu.Portal>
                     <DropdownMenu.Content 
                       align="end" 
                       sideOffset={8}
                       style={{
                         minWidth: 180,
                         background: 'white',
                         borderRadius: 12,
                         padding: 8,
                         boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                         border: '1px solid #f1f5f9',
                         zIndex: 50,
                         animation: 'fade-in 0.2s ease-out'
                       }}
                     >
                       <DropdownMenu.Item 
                         onSelect={() => activeConv && pinConversation(activeConv.id, !(activeConv as any).is_pinned)}
                         style={{ padding: '10px 12px', fontSize: 14, color: '#0f172a', fontWeight: 500, borderRadius: 8, cursor: 'pointer', outline: 'none', transition: 'background 0.2s' }}
                         onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                         onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                       >
                         {(activeConv as any)?.is_pinned ? 'Desafixar conversa' : 'Fixar conversa'}
                       </DropdownMenu.Item>
                       <DropdownMenu.Item 
                         onSelect={() => activeConv && archiveConversation(activeConv.id)}
                         style={{ padding: '10px 12px', fontSize: 14, color: '#0f172a', fontWeight: 500, borderRadius: 8, cursor: 'pointer', outline: 'none', transition: 'background 0.2s' }}
                         onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                         onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                       >
                         Arquivar conversa
                       </DropdownMenu.Item>
                        <DropdownMenu.Item 
                          onSelect={() => {
                            if (activeConv) {
                              deleteConversation(activeConv.id)
                              setActiveConversationId(null)
                            }
                          }}
                          style={{ padding: '10px 12px', fontSize: 14, color: '#ef4444', fontWeight: 500, borderRadius: 8, cursor: 'pointer', outline: 'none', transition: 'background 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          Excluir conversa
                        </DropdownMenu.Item>
                       <DropdownMenu.Separator style={{ height: 1, background: '#f1f5f9', margin: '4px 0' }} />
                       <DropdownMenu.Item 
                         onSelect={() => { setActiveConversationId(null) }}
                         style={{ padding: '10px 12px', fontSize: 14, color: '#ef4444', fontWeight: 500, borderRadius: 8, cursor: 'pointer', outline: 'none', transition: 'background 0.2s' }}
                         onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                         onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                       >
                         Fechar conversa
                       </DropdownMenu.Item>
                     </DropdownMenu.Content>
                   </DropdownMenu.Portal>
                 </DropdownMenu.Root>
               </div>
            </div>
            
            {/* Thread Body */}
            <ChatThread 
              messages={messages} 
              currentUserId={currentUser?.id || ''} 
              isLoading={isLoadingMessages} 
              hasMore={hasMore} 
              onLoadMore={loadMore} 
              conversation={activeConv}
            />
            
            {/* Thread Footer (Composer) */}
            <ChatComposer 
              onSendMessage={(content, type) => sendMessage(content, type)} 
              disabled={isLoadingMessages && messages.length === 0} 
            />
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: '#f8fafc' }}>
            <div style={{ width: 80, height: 80, borderRadius: 40, background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
               <MessageSquare size={40} color="#cbd5e1" />
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 400, color: '#475569', margin: 0 }}>Impacto EDU Chat</h3>
            <p style={{ marginTop: 8, fontSize: 15 }}>Selecione uma conversa ao lado para começar</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              style={{ marginTop: 24, background: 'white', border: '1px solid #e2e8f0', padding: '10px 20px', borderRadius: 20, color: '#0f172a', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
            >
              <Plus size={16} /> Nova Conversa
            </button>
          </div>
        )}
      </div>

      <NewChatModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSelectUser={handleStartChat} 
      />
    </div>
  )
}
