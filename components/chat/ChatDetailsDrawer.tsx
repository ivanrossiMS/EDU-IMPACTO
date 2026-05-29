'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Users, Calendar, MessageSquare, Archive, ArrowRightLeft, UserCheck } from 'lucide-react'
import type { ChatConversation, ChatParticipant } from '@/lib/chat/types'

interface ChatDetailsDrawerProps {
  conversation: ChatConversation | null
  participants: ChatParticipant[]
  onClose: () => void
  onArchive: () => void
  onTransfer: () => void
  isAdmin: boolean
}

function avatarColor(name?: string): string {
  const colors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899']
  if (!name) return colors[0]
  return colors[name.charCodeAt(0) % colors.length]
}
function initials(name?: string): string {
  if (!name) return '?'
  return name.split(' ').slice(0, 2).map(s => s[0]).join('').toUpperCase()
}
function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'short', year: 'numeric',
    })
  } catch { return '—' }
}

const PERFIL_LABELS: Record<string, string> = {
  admin: 'Administrador',
  colaborador: 'Colaborador',
  familia: 'Família',
  aluno: 'Aluno',
  moderator: 'Moderador',
  member: 'Membro',
  observer: 'Observador',
}

export function ChatDetailsDrawer({
  conversation,
  participants,
  onClose,
  onArchive,
  onTransfer,
  isAdmin,
}: ChatDetailsDrawerProps) {
  return (
    <AnimatePresence>
      {conversation && (
        <motion.aside
          key="details-drawer"
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{
            width: 300,
            flexShrink: 0,
            height: '100%',
            overflowY: 'auto',
            background: 'hsl(var(--bg-surface))',
            borderLeft: '1px solid hsl(var(--border-subtle))',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 16px 14px',
            borderBottom: '1px solid hsl(var(--border-subtle))',
            position: 'sticky',
            top: 0,
            background: 'hsl(var(--bg-surface))',
            zIndex: 5,
          }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))', letterSpacing: '-0.01em' }}>
              Detalhes
            </h4>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: 6,
                borderRadius: 8,
                color: 'hsl(var(--text-muted))',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Conversation info card */}
            <section>
              <SectionLabel icon={<MessageSquare size={12} />} label="Informações" />
              <div style={{
                background: 'hsl(var(--bg-elevated))',
                borderRadius: 12,
                border: '1px solid hsl(var(--border-subtle))',
                overflow: 'hidden',
              }}>
                <InfoRow label="Título" value={conversation.title || '—'} />
                <InfoRow label="Tipo" value={
                  conversation.type === 'direct' ? 'Conversa direta'
                  : conversation.type === 'group' ? 'Grupo'
                  : 'Comunicado'
                } />
                <InfoRow label="Status" value={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: conversation.status === 'active' ? '#22c55e' : '#f59e0b',
                      display: 'inline-block',
                    }} />
                    {conversation.status === 'active' ? 'Ativa'
                      : conversation.status === 'archived' ? 'Arquivada'
                      : conversation.status === 'closed' ? 'Encerrada'
                      : 'Transferida'}
                  </span>
                } />
                <InfoRow label="Prioridade" value={
                  conversation.priority === 'urgent' ? '🔴 Urgente'
                  : conversation.priority === 'high' ? '🟡 Alta'
                  : conversation.priority === 'low' ? '⚪ Baixa'
                  : '🟢 Normal'
                } last />
              </div>
            </section>

            {/* Aluno info */}
            {conversation.aluno && (
              <section>
                <SectionLabel icon={<UserCheck size={12} />} label="Aluno" />
                <div style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(79,70,229,0.06))',
                  borderRadius: 12,
                  border: '1px solid rgba(99,102,241,0.2)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: avatarColor(conversation.aluno.nome),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#fff',
                    flexShrink: 0,
                  }}>
                    {initials(conversation.aluno.nome)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                      {conversation.aluno.nome}
                    </div>
                    {conversation.aluno.turma && (
                      <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                        {conversation.aluno.turma}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Participants */}
            <section>
              <SectionLabel icon={<Users size={12} />} label={`Participantes (${participants.length})`} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {participants.map(p => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 10,
                      background: 'hsl(var(--bg-elevated))',
                      border: '1px solid hsl(var(--border-subtle))',
                    }}
                  >
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: avatarColor(p.user_name),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#fff',
                      flexShrink: 0,
                    }}>
                      {initials(p.user_name)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.user_name || 'Usuário'}
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                        {PERFIL_LABELS[p.user_role] || p.user_role}
                        {p.user_perfil ? ` • ${p.user_perfil}` : ''}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Stats */}
            <section>
              <SectionLabel icon={<Calendar size={12} />} label="Estatísticas" />
              <div style={{
                background: 'hsl(var(--bg-elevated))',
                borderRadius: 12,
                border: '1px solid hsl(var(--border-subtle))',
                overflow: 'hidden',
              }}>
                <InfoRow label="Criado em" value={formatDate(conversation.created_at)} />
                <InfoRow label="Última mensagem" value={formatDate(conversation.last_message_at)} />
                <InfoRow label="Total de mensagens" value={String(conversation.message_count || 0)} last />
              </div>
            </section>

            {/* Admin actions */}
            {isAdmin && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <SectionLabel label="Ações" />
                <button
                  onClick={onArchive}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid hsl(var(--border-default))',
                    background: 'hsl(var(--bg-elevated))',
                    color: 'hsl(var(--text-secondary))',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    width: '100%',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'hsl(var(--bg-hover))'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(var(--border-strong))'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'hsl(var(--bg-elevated))'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(var(--border-default))'
                  }}
                >
                  <Archive size={16} />
                  Arquivar conversa
                </button>
                <button
                  onClick={onTransfer}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(99,102,241,0.3)',
                    background: 'rgba(99,102,241,0.06)',
                    color: '#6366f1',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    width: '100%',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.12)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.06)'
                  }}
                >
                  <ArrowRightLeft size={16} />
                  Transferir conversa
                </button>
              </section>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function SectionLabel({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: 'hsl(var(--text-muted))',
      marginBottom: 8,
    }}>
      {icon}
      {label}
    </div>
  )
}

function InfoRow({ label, value, last }: { label: string; value: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '9px 12px',
      borderBottom: last ? 'none' : '1px solid hsl(var(--border-subtle))',
    }}>
      <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  )
}
