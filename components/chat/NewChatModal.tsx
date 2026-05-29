'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Search, Users, User, ArrowRight } from 'lucide-react'
import Portal from '@/components/Portal'
import { UserAvatar } from '@/components/UserAvatar'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'

interface NewChatModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectUser: (userId: string, userName: string, type: 'direct' | 'group', turmaId?: string, roleContext?: string, alunoId?: string) => void
}

export function NewChatModal({ isOpen, onClose, onSelectUser }: NewChatModalProps) {
  const [alunos] = useSupabaseArray<any>('alunos')
  const [todosUsuarios] = useSupabaseArray<any>('configuracoes/usuarios')
  const equipe = (todosUsuarios || []).filter(u => u.id && !u.id.toString().startsWith('virtual-') && !u.id.toString().startsWith('resp-'))
  const [turmas] = useSupabaseArray<any>('turmas')
  
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'alunos' | 'equipe' | 'grupos'>('alunos')
  const [expandedAlunoId, setExpandedAlunoId] = useState<string | null>(null)

  // Move hooks to top level
  const params = require('next/navigation').useParams()
  const { currentUser } = require('@/lib/context').useApp()
  const isFamily = currentUser?.perfil === 'Família' || currentUser?.cargo === 'Responsável'
  const fallbackAlunoId = isFamily ? (params?.slug as string || currentUser?.aluno_id) : undefined

  const filteredAlunos = alunos?.filter(a => a.nome.toLowerCase().includes(search.toLowerCase())) || []
  const filteredEquipe = equipe?.filter(f => f.nome.toLowerCase().includes(search.toLowerCase())) || []
  const filteredTurmas = turmas?.filter(t => t.nome.toLowerCase().includes(search.toLowerCase())) || []

  return (
    <AnimatePresence>
      {isOpen && (
        <Portal>
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={onClose}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              style={{ background: 'white', borderRadius: 24, width: '100%', maxWidth: 500, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
            >
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#0f172a' }}>Nova Conversa</h3>
                <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: 20 }}>
                <div style={{ position: 'relative', marginBottom: 20 }}>
                  <Search size={18} color="#94a3b8" style={{ position: 'absolute', left: 16, top: 13 }} />
                  <input 
                    type="text" 
                    placeholder="Buscar por nome..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ width: '100%', padding: '12px 16px 12px 42px', borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 14 }}
                  />
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: '#f8fafc', padding: 4, borderRadius: 12 }}>
                  <button 
                    onClick={() => { setTab('alunos'); setExpandedAlunoId(null) }}
                    style={{ flex: 1, padding: '8px 0', background: tab === 'alunos' ? 'white' : 'transparent', border: 'none', borderRadius: 8, fontWeight: 500, color: tab === 'alunos' ? '#0f172a' : '#64748b', boxShadow: tab === 'alunos' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    Alunos / Família
                  </button>
                  <button 
                    onClick={() => { setTab('equipe'); setExpandedAlunoId(null) }}
                    style={{ flex: 1, padding: '8px 0', background: tab === 'equipe' ? 'white' : 'transparent', border: 'none', borderRadius: 8, fontWeight: 500, color: tab === 'equipe' ? '#0f172a' : '#64748b', boxShadow: tab === 'equipe' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    Equipe
                  </button>
                  <button 
                    onClick={() => { setTab('grupos'); setExpandedAlunoId(null) }}
                    style={{ flex: 1, padding: '8px 0', background: tab === 'grupos' ? 'white' : 'transparent', border: 'none', borderRadius: 8, fontWeight: 500, color: tab === 'grupos' ? '#0f172a' : '#64748b', boxShadow: tab === 'grupos' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none', cursor: 'pointer', transition: 'all 0.2s' }}
                  >
                    Grupos
                  </button>
                </div>

                <div style={{ maxHeight: 300, overflowY: 'auto', margin: '0 -20px', padding: '0 20px' }}>
                  {tab === 'alunos' && filteredAlunos.map(aluno => (
                    <div key={aluno.id}>
                      <div 
                        onClick={() => {
                          if (aluno.responsaveis && aluno.responsaveis.length > 0) {
                            setExpandedAlunoId(expandedAlunoId === aluno.id ? null : aluno.id)
                          } else {
                            onSelectUser(aluno.id, aluno.nome, 'direct', undefined, 'Aluno')
                          }
                        }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s', background: expandedAlunoId === aluno.id ? '#f8fafc' : 'transparent' }}
                        onMouseEnter={e => { if (expandedAlunoId !== aluno.id) e.currentTarget.style.background = '#f8fafc' }}
                        onMouseLeave={e => { if (expandedAlunoId !== aluno.id) e.currentTarget.style.background = 'transparent' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <UserAvatar size={40} name={aluno.nome} fotoUrl={aluno.foto_url || aluno.foto} />
                          <div>
                            <div style={{ fontWeight: 500, color: '#0f172a', fontSize: 14 }}>{aluno.nome}</div>
                            <div style={{ color: '#64748b', fontSize: 12 }}>{aluno.turma_nome || 'Sem Turma'}</div>
                          </div>
                        </div>
                        {aluno.responsaveis && aluno.responsaveis.length > 0 ? (
                          <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 500, background: '#e0e7ff', padding: '4px 8px', borderRadius: 12 }}>
                            {aluno.responsaveis.length} responsáveis
                          </div>
                        ) : (
                          <ArrowRight size={16} color="#cbd5e1" />
                        )}
                      </div>

                      {/* Expansão para mostrar Aluno + Responsáveis separadamente */}
                      {expandedAlunoId === aluno.id && (
                        <div style={{ marginLeft: 32, marginTop: 4, marginBottom: 12, borderLeft: '2px solid #e2e8f0', paddingLeft: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          
                          {/* Opção de falar com o próprio aluno */}
                          <div
                            onClick={() => onSelectUser(aluno.id, aluno.nome, 'direct', undefined, 'Aluno', aluno.id)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: '#f8fafc' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                            onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <User size={16} color="#64748b" />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>Falar com Aluno</div>
                                <div style={{ fontSize: 11, color: '#64748b' }}>{aluno.nome}</div>
                              </div>
                            </div>
                            <ArrowRight size={14} color="#cbd5e1" />
                          </div>

                          {/* Opções de falar com os responsáveis */}
                          {aluno.responsaveis?.map((resp: any) => {
                            let roleLabel = 'Responsável'
                            if (resp.parentesco) roleLabel = resp.parentesco
                            if (resp.isFinanceiro) roleLabel += ' (Financeiro)'
                            if (resp.isPedagogico) roleLabel += ' (Pedagógico)'

                            return (
                              <div
                                key={resp.id}
                                onClick={() => onSelectUser(resp.id, resp.nome, 'direct', undefined, `${roleLabel} de ${aluno.nome}`, aluno.id)}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: '#f8fafc' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                                onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Users size={16} color="#6366f1" />
                                  <div>
                                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{resp.nome}</div>
                                    <div style={{ fontSize: 11, color: '#6366f1' }}>{roleLabel}</div>
                                  </div>
                                </div>
                                <ArrowRight size={14} color="#cbd5e1" />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}

                  {tab === 'equipe' && filteredEquipe.map(func => {
                    return (
                    <div 
                      key={func.id}
                      onClick={() => onSelectUser(func.id, func.nome, 'direct', undefined, undefined, fallbackAlunoId)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <UserAvatar size={40} name={func.nome} fotoUrl={func.foto_url || func.foto} />
                        <div>
                          <div style={{ fontWeight: 500, color: '#0f172a', fontSize: 14 }}>{func.nome}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{func.cargo || 'Colaborador'}</div>
                        </div>
                      </div>
                      <ArrowRight size={16} color="#cbd5e1" />
                    </div>
                  )})}

                  {tab === 'grupos' && filteredTurmas.map(turma => (
                    <div 
                      key={turma.id}
                      onClick={() => onSelectUser(turma.id, turma.nome, 'group', turma.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--gradient-primary, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                          <Users size={20} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: '#0f172a', fontSize: 14 }}>{turma.nome}</div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>{turma.serie} - {turma.turno}</div>
                        </div>
                      </div>
                      <ArrowRight size={16} color="#cbd5e1" />
                    </div>
                  ))}

                  {((tab === 'alunos' && filteredAlunos.length === 0) || 
                    (tab === 'equipe' && filteredEquipe.length === 0) || 
                    (tab === 'grupos' && filteredTurmas.length === 0)) && (
                    <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                      Nenhum resultado encontrado.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </Portal>
      )}
    </AnimatePresence>
  )
}
