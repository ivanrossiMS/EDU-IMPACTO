'use client'

import React, { useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, MessageSquarePlus, MessageSquare, ArrowLeft, Maximize2 } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { useApp } from '@/lib/context'
import { useChats } from '@/lib/chat/useChats'
import { UserAvatar } from '@/components/UserAvatar'
import { useChatMessages } from '@/lib/chat/useChatMessages'
import { chatService } from '@/lib/chat/services/chatService'
import { ChatThread } from '@/components/chat/ChatThread'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { NewChatModal } from '@/components/chat/NewChatModal'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'

export default function FloatingChatPanel({ onClose }: { onClose: () => void }) {
  const { currentUser } = useApp()
  const router = useRouter()
  const params = useParams()
  const { adAlert } = useAgendaDigital()
  const currentId = currentUser?.aluno_id || currentUser?.responsavel_id || currentUser?.id
  
  const [activeTab, setActiveTab] = useState<'recentes' | 'nao_lidas'>('recentes')
  const [view, setView] = useState<'list' | 'chat'>('list')
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [isNewChatOpen, setIsNewChatOpen] = useState(false)
  
  const { conversations, isLoading, refresh, deleteConversation } = useChats(currentId)
  
  // Only load messages if we are in chat view
  const { messages, isLoading: isLoadingMessages, hasMore, loadMore, sendMessage } = useChatMessages(
    view === 'chat' ? activeConversationId : null, 
    currentId
  )

  const activeConv = conversations.find(c => c.id === activeConversationId)

  const filteredConvs = conversations.filter(c => {
    if (activeTab === 'nao_lidas') return (c.unread_count || 0) > 0
    return true
  })

  const handleOpenConversation = (id: string) => {
    setActiveConversationId(id)
    setView('chat')
  }

  const handleExpandConversation = () => {
    if (activeConversationId) {
      let basePath = '/agenda-digital/mensagens'
      
      if (currentUser?.perfil === 'Família' || currentUser?.cargo === 'Responsável' || currentUser?.cargo === 'Aluno') {
        const studentId = currentUser?.aluno_id || currentUser?.id
        // Extrai o ID do aluno da URL atual se possível, para manter o contexto
        // Verifica se existe params na rota atual (usamos hooks para isso)
        const pathSegments = window.location.pathname.split('/')
        const isSlugPath = pathSegments[1] === 'agenda-digital' && pathSegments[2] && !['admin', 'mensagens', 'selecionar-aluno', 'colaborador'].includes(pathSegments[2])
        let contextId = activeConv?.aluno_id || params?.slug || (isSlugPath ? pathSegments[2] : currentUser?.aluno_id)
        
        // Se ainda não temos contextId, ou se o contextId for igual ao ID do próprio responsável (UUID do parent), abortamos
        if (!contextId || contextId === currentUser?.id || contextId === currentUser?.responsavel_id) {
          adAlert('Esta conversa não possui um vínculo de aluno ou você ainda não selecionou um aluno.', 'Aviso')
          return
        }
        
        basePath = `/agenda-digital/${contextId}/conversas`
      } else if (currentUser?.perfil === 'Colaborador' || currentUser?.perfil === 'Professor') {
        basePath = '/agenda-digital/colaborador/conversas'
      } else if (currentUser?.perfil === 'Administrador' || currentUser?.perfil === 'Gestor' || currentUser?.perfil === 'Direção' || currentUser?.perfil === 'Secretaria') {
        basePath = '/agenda-digital/admin/conversas'
      }

      router.push(`${basePath}?conversation=${activeConversationId}`)
      onClose()
    }
  }

  const handleStartChat = async (targetId: string, targetName: string, type: 'direct' | 'group', turmaId?: string, roleContext?: string, alunoId?: string) => {
    if (!currentId) return
    try {
      let finalParticipantIds = [targetId]
      let namesMap: Record<string, string> = { [targetId]: targetName }

      if (type === 'group' && turmaId) {
        // Group logic placeholder if needed - usually NewChatModal passes the right array if it was implemented, but for now we follow page.tsx
      }

      let perfisMap: Record<string, string> = {}
      if (roleContext) {
        perfisMap[targetId] = roleContext
      }

      const conv = await chatService.createConversation({
        type,
        title: type === 'group' ? targetName : undefined,
        turma_id: turmaId,
        aluno_id: alunoId,
        participant_ids: finalParticipantIds,
        participant_names: namesMap,
        participant_perfis: Object.keys(perfisMap).length > 0 ? perfisMap : undefined
      }, currentId, currentUser?.perfil || 'Usuário')

      if (conv) {
        setActiveConversationId(conv.id)
        setView('chat')
        setIsNewChatOpen(false)
        refresh()
      }
    } catch (e) {
      console.error(e)
      adAlert('Erro ao iniciar conversa', 'Erro')
    }
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{
          position: 'fixed',
          bottom: 90,
          right: 24,
          zIndex: 9998,
          width: 'min(380px, calc(100vw - 32px))',
          height: 'min(600px, calc(100vh - 120px))',
          background: 'white',
          borderRadius: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {view === 'list' ? (
          <>
            {/* HEADER */}
            <div style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: 'white',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MessageSquare size={18} />
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 700 }}>Mensagens</span>
                </div>
                <button 
                  onClick={onClose}
                  style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* TABS */}
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.1)', borderRadius: 12, padding: 4 }}>
                {(['recentes', 'nao_lidas'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      borderRadius: 8,
                      border: 'none',
                      background: activeTab === tab ? 'white' : 'transparent',
                      color: activeTab === tab ? '#4f46e5' : 'white',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {tab === 'recentes' ? 'Recentes' : 'Não Lidas'}
                  </button>
                ))}
              </div>
            </div>

            {/* LIST */}
            <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: 8 }}>
              {isLoading ? (
                <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>Carregando...</div>
              ) : filteredConvs.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                  <MessageSquare size={32} opacity={0.3} />
                  <span style={{ fontSize: 14 }}>Nenhuma conversa encontrada.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {filteredConvs.map(conv => (
                    <div 
                      key={conv.id}
                      onClick={() => handleOpenConversation(conv.id)}
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: 12,
                        background: 'white',
                        borderRadius: 12,
                        cursor: 'pointer',
                        alignItems: 'center'
                      }}
                    >
                      {(() => {
                        return <UserAvatar size={44} name={conv.aluno?.nome || conv.title || 'Chat'} userId={conv.aluno_id || conv.other_participant?.user_id} fotoUrl={conv.aluno?.foto || undefined} />;
                      })()}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                            <span style={{ fontWeight: (conv.unread_count || 0) > 0 ? 800 : 700, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {conv.aluno?.nome || conv.title || 'Conversa'}
                            </span>
                            <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {conv.aluno ? (conv.title || conv.other_participant?.user_name || 'Responsável') : (conv.other_participant?.user_perfil || 'Usuário')}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>
                            {new Date(conv.last_message_at || conv.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 13, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: (conv.unread_count || 0) > 0 ? 600 : 400 }}>
                            {conv.last_message_text || 'Sem mensagens'}
                          </span>
                          {(conv.unread_count || 0) > 0 && (
                            <div style={{ background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 'bold', padding: '2px 6px', borderRadius: 10 }}>
                              {conv.unread_count}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* FOOTER */}
            <div style={{ padding: 16, background: 'white', borderTop: '1px solid #e2e8f0' }}>
              <button
                onClick={() => setIsNewChatOpen(true)}
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 12,
                  background: '#f1f5f9',
                  color: '#0f172a',
                  border: 'none',
                  fontSize: 14,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  cursor: 'pointer'
                }}
              >
                <MessageSquarePlus size={18} />
                Nova Conversa
              </button>
            </div>
          </>
        ) : (
          <>
            {/* CHAT HEADER */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              padding: '16px',
              background: 'white',
              borderBottom: '1px solid #e2e8f0',
              gap: 12
            }}>
              <button 
                onClick={() => setView('list')}
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'transparent', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <ArrowLeft size={20} />
              </button>
              
              <UserAvatar size={40} name={activeConv?.aluno?.nome || activeConv?.title || 'Chat'} userId={activeConv?.aluno_id || activeConv?.other_participant?.user_id} fotoUrl={activeConv?.aluno?.foto || undefined} />
              
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeConv?.aluno?.nome || activeConv?.title || 'Conversa'}
                </span>
                <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {activeConv?.aluno ? (activeConv?.title || activeConv?.other_participant?.user_name || 'Responsável') : (activeConv?.other_participant?.user_perfil || 'Usuário')}
                </span>
              </div>

              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button 
                    style={{ width: 36, height: 36, borderRadius: '50%', background: 'transparent', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
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
                      zIndex: 10001
                    }}
                  >
                    <DropdownMenu.Item 
                      onSelect={() => {
                        if (activeConv) {
                          deleteConversation(activeConv.id)
                          setView('list')
                        }
                      }}
                      style={{ padding: '10px 12px', fontSize: 14, color: '#ef4444', fontWeight: 500, borderRadius: 8, cursor: 'pointer', outline: 'none' }}
                    >
                      Excluir conversa
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <button 
                onClick={handleExpandConversation}
                title="Abrir em tela cheia"
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'transparent', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <Maximize2 size={18} />
              </button>
              
              <button 
                onClick={onClose}
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'transparent', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* CHAT THREAD */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <ChatThread 
                messages={messages} 
                currentUserId={currentId || ''} 
                isLoading={isLoadingMessages} 
                hasMore={hasMore} 
                onLoadMore={loadMore} 
                conversation={activeConv}
              />
            </div>

            {/* CHAT COMPOSER */}
            <div style={{ flexShrink: 0, background: 'white' }}>
              <ChatComposer 
                onSendMessage={(content, type) => sendMessage(content, type)} 
                disabled={isLoadingMessages && messages.length === 0} 
              />
            </div>
          </>
        )}
      </motion.div>
      
      <NewChatModal 
        isOpen={isNewChatOpen}
        onClose={() => setIsNewChatOpen(false)} 
        onSelectUser={handleStartChat} 
      />
    </>
  )
}
