'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Search, X, User, GraduationCap, Users, Briefcase,
  Crown, Check, ArrowRight, Shield, Smartphone, Loader2
} from 'lucide-react'
import { UserAvatar } from '@/components/UserAvatar'

export interface SelectedHistoryUser {
  id: string
  authId?: string | null
  nome: string
  tipo: 'aluno' | 'responsavel' | 'colaborador'
  subtitulo?: string
  foto?: string | null
  status?: string
  detalhe?: string
}

interface PushUserSearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectUser: (user: SelectedHistoryUser | null) => void
  currentUserSelected: SelectedHistoryUser | null
}

export function PushUserSearchModal({
  isOpen,
  onClose,
  onSelectUser,
  currentUserSelected,
}: PushUserSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'aluno' | 'responsavel' | 'colaborador'>('all')
  const [results, setResults] = useState<SelectedHistoryUser[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setSearchTerm('')
    }
  }, [isOpen])

  // Busca instantânea com debounce
  useEffect(() => {
    if (!isOpen) return

    if (!searchTerm.trim()) {
      setResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/agenda/push/test?user_search=${encodeURIComponent(searchTerm.trim())}`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.users || [])
        }
      } catch (err) {
        console.error('Erro na busca unificada de usuários:', err)
      } finally {
        setIsLoading(false)
      }
    }, 280)

    return () => clearTimeout(timer)
  }, [searchTerm, isOpen])

  if (!isOpen) return null

  const filteredResults = results.filter(item => {
    if (activeFilter === 'all') return true
    return item.tipo === activeFilter
  })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'hsl(var(--bg-surface))',
          border: '1px solid hsl(var(--border-subtle))',
          borderRadius: 20,
          maxWidth: 580,
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          animation: 'fadeInScale 0.2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes fadeInScale {
            from { opacity: 0; transform: scale(0.97); }
            to { opacity: 1; transform: scale(1); }
          }
        `}} />

        {/* Header do Modal */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Search size={18} color="#6366f1" /> Selecionar Usuário para Auditoria
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                Filtre todo o histórico de pushes enviados e recebidos por aluno, responsável ou colaborador.
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'hsl(var(--text-muted))',
                padding: 6,
                borderRadius: 8,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Campo de Pesquisa */}
          <div style={{ position: 'relative' }}>
            <Search size={16} color="hsl(var(--text-muted))" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Digite o nome, matrícula, cargo ou e-mail..."
              style={{
                width: '100%',
                padding: '11px 40px 11px 40px',
                borderRadius: 12,
                border: '1.5px solid hsl(var(--border-subtle))',
                background: 'hsl(var(--bg-main))',
                color: 'hsl(var(--text-main))',
                fontSize: 13,
                fontWeight: 500,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'hsl(var(--text-muted))'
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Filtros por Categoria de Usuário */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12, overflowX: 'auto', paddingBottom: 2 }}>
            {[
              { id: 'all', label: 'Todos os Tipos' },
              { id: 'aluno', label: 'Alunos', icon: GraduationCap },
              { id: 'responsavel', label: 'Responsáveis', icon: Users },
              { id: 'colaborador', label: 'Colaboradores / Direção', icon: Briefcase },
            ].map(tab => {
              const Icon = (tab as any).icon
              const isSelected = activeFilter === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 20,
                    border: '1px solid',
                    borderColor: isSelected ? '#6366f1' : 'hsl(var(--border-subtle))',
                    background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                    color: isSelected ? '#6366f1' : 'hsl(var(--text-muted))',
                    fontSize: 11,
                    fontWeight: isSelected ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s',
                  }}
                >
                  {Icon && <Icon size={12} />}
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Lista de Resultados */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Opção Rápida: Visão Geral da Escola Inteira */}
          <div
            onClick={() => {
              onSelectUser(null)
              onClose()
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 12,
              background: !currentUserSelected ? 'rgba(99, 102, 241, 0.08)' : 'hsl(var(--bg-main))',
              border: `1.5px solid ${!currentUserSelected ? '#6366f1' : 'hsl(var(--border-subtle))'}`,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
              }}>
                <Users size={18} />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  Todos os Usuários da Escola
                </div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                  Auditoria global com todos os disparos gerais, por turma e individuais
                </div>
              </div>
            </div>
            {!currentUserSelected && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Check size={14} /> Ativo
              </span>
            )}
          </div>

          <div style={{ height: 1, background: 'hsl(var(--border-subtle))', margin: '6px 0' }} />

          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '36px 0', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              Buscando usuários...
            </div>
          ) : searchTerm.trim().length > 0 && filteredResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Nenhum usuário encontrado para "{searchTerm}".
            </div>
          ) : searchTerm.trim().length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'hsl(var(--text-muted))', fontSize: 12 }}>
              Digite o nome de um aluno, responsável ou colaborador para pesquisar.
            </div>
          ) : (
            filteredResults.map(user => {
              const isSelected = currentUserSelected?.id === user.id && currentUserSelected?.tipo === user.tipo
              const isAluno = user.tipo === 'aluno'
              const isResp = user.tipo === 'responsavel'
              const isColab = user.tipo === 'colaborador'

              const badgeColor = isAluno ? '#10b981' : isResp ? '#3b82f6' : '#8b5cf6'
              const badgeBg = isAluno ? 'rgba(16, 185, 129, 0.12)' : isResp ? 'rgba(59, 130, 246, 0.12)' : 'rgba(139, 92, 246, 0.12)'

              return (
                <div
                  key={`${user.tipo}-${user.id}`}
                  onClick={() => {
                    onSelectUser(user)
                    onClose()
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 12,
                    background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'hsl(var(--bg-main))',
                    border: `1.5px solid ${isSelected ? '#6366f1' : 'hsl(var(--border-subtle))'}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <UserAvatar
                      name={user.nome}
                      fotoUrl={user.foto || undefined}
                      size={38}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {user.nome}
                        </span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: 6,
                          background: badgeBg,
                          color: badgeColor,
                          textTransform: 'uppercase'
                        }}>
                          {user.tipo}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user.subtitulo}
                      </div>
                    </div>
                  </div>

                  {isSelected ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Check size={14} /> Selecionado
                    </span>
                  ) : (
                    <ArrowRight size={15} color="hsl(var(--text-muted))" />
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
