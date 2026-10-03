'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Vote, Check, Lock, Unlock, Clock, Users, RefreshCw, 
  BarChart3, AlertCircle, CheckCircle2, ChevronRight, X,
  Shield, Sparkles, Trophy, Loader2
} from 'lucide-react'
import { EnqueteData, EnqueteVoto } from '@/lib/enquetes/types'
import { 
  calculateEnqueteStats, 
  getUserVote, 
  getVoterKey, 
  isEnqueteClosed, 
  formatTimeRemaining 
} from '@/lib/enquetes/enqueteUtils'
import { supabase } from '@/lib/supabase'

interface EnqueteWidgetProps {
  enquete: EnqueteData
  comunicadoId: string
  currentUser?: any
  currentAluno?: any
  isAdminMode?: boolean
  onVoteSuccess?: (updatedEnquete: EnqueteData) => void
}

export function EnqueteWidget({
  enquete: initialEnquete,
  comunicadoId,
  currentUser,
  currentAluno,
  isAdminMode = false,
  onVoteSuccess
}: EnqueteWidgetProps) {
  const [enquete, setEnquete] = useState<EnqueteData>(initialEnquete)
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isChangingVote, setIsChangingVote] = useState(false)
  const [showVotersModal, setShowVotersModal] = useState(false)
  const [selectedVotersFilter, setSelectedVotersFilter] = useState<string>('all')
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  // Sync with prop updates
  useEffect(() => {
    if (initialEnquete) {
      setEnquete(initialEnquete)
    }
  }, [initialEnquete])

  const stats = useMemo(() => calculateEnqueteStats(enquete), [enquete])
  const isClosed = useMemo(() => isEnqueteClosed(enquete), [enquete])
  const timeRemaining = useMemo(() => formatTimeRemaining(enquete.dataExpiracao), [enquete.dataExpiracao])

  const currentUserId = currentUser?.id || currentUser?.uid || ''
  const currentAlunoId = currentAluno?.id || null
  const currentAlunoNome = currentAluno?.nome || null

  const userVote: EnqueteVoto | null = useMemo(() => {
    return getUserVote(enquete, currentUserId, currentAlunoId)
  }, [enquete, currentUserId, currentAlunoId])

  const hasVoted = !!userVote

  // Initialize selected options with current user vote if already voted
  useEffect(() => {
    if (userVote && Array.isArray(userVote.opcoesIds)) {
      setSelectedOptions(userVote.opcoesIds)
    } else {
      setSelectedOptions([])
    }
  }, [userVote])

  // ==========================================
  // REALTIME SYNCHRONIZATION
  // ==========================================
  useEffect(() => {
    if (!enquete?.id) return

    // 1. Broadcast channel listener for instantaneous sub-100ms updates
    const channelName = `enquete_live_${enquete.id}`
    const channel = supabase.channel(channelName)

    channel
      .on('broadcast', { event: 'vote_update' }, (payload: any) => {
        if (payload?.payload?.enquete) {
          setEnquete(payload.payload.enquete)
          if (onVoteSuccess) onVoteSuccess(payload.payload.enquete)
        }
      })
      .on('broadcast', { event: 'status_update' }, (payload: any) => {
        if (payload?.payload?.enquete) {
          setEnquete(payload.payload.enquete)
          if (onVoteSuccess) onVoteSuccess(payload.payload.enquete)
        }
      })
      .subscribe()

    // 2. Global Comunicados Update Event from AgendaRealtimeProvider
    const handleComunicadosUpdate = (event: any) => {
      const item = event?.detail?.item
      if (item && String(item.id) === String(comunicadoId)) {
        const remoteEnquete = item.enquete || item.dados?.enquete
        if (remoteEnquete) {
          setEnquete(remoteEnquete)
        }
      }
    }
    window.addEventListener('ad:comunicados-update', handleComunicadosUpdate)

    // 3. Heartbeat polling a cada 30 segundos apenas se a página estiver visível
    const interval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      try {
        const { data } = await supabase
          .from('comunicados')
          .select('dados')
          .eq('id', comunicadoId)
          .maybeSingle()

        const remoteEnquete = (data as any)?.dados?.enquete
        if (remoteEnquete) {
          setEnquete(remoteEnquete)
        }
      } catch (_) {}
    }, 30000)

    return () => {
      try { supabase.removeChannel(channel) } catch (_) {}
      window.removeEventListener('ad:comunicados-update', handleComunicadosUpdate)
      clearInterval(interval)
    }
  }, [enquete.id, comunicadoId, onVoteSuccess])

  // Broadcast helper
  const broadcastUpdate = useCallback(async (updated: EnqueteData, eventName = 'vote_update') => {
    try {
      const channel = supabase.channel(`enquete_live_${updated.id}`)
      await channel.send({
        type: 'broadcast',
        event: eventName,
        payload: { enquete: updated, comunicadoId }
      })
    } catch (_) {}
  }, [comunicadoId])

  // Handle option selection
  const handleToggleOption = (optionId: string) => {
    if (isClosed && !isAdminMode) return
    if (hasVoted && !isChangingVote) return

    if (enquete.tipo === 'unica') {
      setSelectedOptions([optionId])
    } else {
      if (selectedOptions.includes(optionId)) {
        setSelectedOptions(selectedOptions.filter(id => id !== optionId))
      } else {
        if (!enquete.maxEscolhas || selectedOptions.length < enquete.maxEscolhas) {
          setSelectedOptions([...selectedOptions, optionId])
        }
      }
    }
  }

  // Handle Vote Submission
  const handleSubmitVote = async () => {
    if (selectedOptions.length === 0) return
    setIsSubmitting(true)
    setFeedbackMessage(null)

    try {
      const payload = {
        comunicadoId,
        enqueteId: enquete.id,
        opcoesIds: selectedOptions,
        usuarioId: currentUserId,
        usuarioNome: currentUser?.nome || currentAlunoNome || 'Participante',
        usuarioFoto: currentUser?.foto || (currentAluno as any)?.foto || null,
        usuarioTipo: currentUser?.perfil === 'Família' || currentUser?.perfil === 'Responsável' ? 'responsavel' : 'aluno',
        alunoId: currentAlunoId,
        alunoNome: currentAlunoNome
      }

      const res = await fetch('/api/agenda/enquetes/votar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar voto')
      }

      if (data.enquete) {
        setEnquete(data.enquete)
        setIsChangingVote(false)
        setFeedbackMessage({ type: 'success', text: 'Seu voto foi registrado com sucesso!' })
        if (onVoteSuccess) onVoteSuccess(data.enquete)
        broadcastUpdate(data.enquete, 'vote_update')

        setTimeout(() => setFeedbackMessage(null), 4000)
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Erro ao votar. Tente novamente.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Closing or Reopening Poll (Admin/Author only)
  const handleToggleStatus = async () => {
    if (!isAdminMode) return
    setIsUpdatingStatus(true)
    const newStatus = !enquete.encerrada

    try {
      const res = await fetch('/api/agenda/enquetes/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comunicadoId,
          encerrada: newStatus
        })
      })

      const data = await res.json()
      if (data.ok && data.enquete) {
        setEnquete(data.enquete)
        if (onVoteSuccess) onVoteSuccess(data.enquete)
        broadcastUpdate(data.enquete, 'status_update')
      }
    } catch (err) {
      console.error('Erro ao atualizar status da enquete:', err)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // Decide if user should see results
  const shouldShowResults = useMemo(() => {
    if (isAdminMode) return true
    if (enquete.visibilidadeResultados === 'imediato') return true
    if (hasVoted && !isChangingVote && enquete.visibilidadeResultados !== 'somente_admin') return true
    if (isClosed && enquete.visibilidadeResultados !== 'somente_admin') return true
    return false
  }, [isAdminMode, enquete.visibilidadeResultados, hasVoted, isChangingVote, isClosed])

  // Filter voters list for admin modal
  const allVotersList = useMemo(() => {
    if (!enquete.votos) return []
    return Object.values(enquete.votos)
  }, [enquete.votos])

  const filteredVoters = useMemo(() => {
    if (selectedVotersFilter === 'all') return allVotersList
    return allVotersList.filter(v => v.opcoesIds.includes(selectedVotersFilter))
  }, [allVotersList, selectedVotersFilter])

  return (
    <div style={{
      width: '100%',
      maxWidth: '820px',
      margin: '20px 0',
      background: 'linear-gradient(145deg, #FFFFFF 0%, #FAFAFF 100%)',
      borderRadius: '24px',
      border: '1.5px solid rgba(99, 102, 241, 0.2)',
      boxShadow: '0 12px 36px -4px rgba(99, 102, 241, 0.08), 0 0 0 1px rgba(255, 255, 255, 0.8) inset',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* GLOW DE FUNDO */}
      <div style={{
        position: 'absolute',
        top: -60,
        right: -60,
        width: 180,
        height: 180,
        background: 'radial-gradient(circle, rgba(245, 158, 11, 0.15) 0%, rgba(99, 102, 241, 0.08) 50%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }} />

      {/* HEADER DA ENQUETE */}
      <div style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid rgba(226, 232, 240, 0.8)',
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.05) 0%, rgba(99, 102, 241, 0.03) 100%)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        {/* BADGES E STATUS */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: '#FFFFFF',
              padding: '4px 12px',
              borderRadius: 999,
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
            }}>
              <Vote size={13} strokeWidth={2.5} /> Enquete Interativa
            </span>

            {isClosed ? (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                background: '#F1F5F9',
                color: '#64748B',
                padding: '4px 10px',
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}>
                <Lock size={12} /> Encerrada
              </span>
            ) : (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                background: '#ECFDF5',
                color: '#059669',
                padding: '4px 10px',
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}>
                <span style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: '#10B981',
                  boxShadow: '0 0 8px #10B981',
                  animation: 'pulse 2s infinite'
                }} />
                Votação Aberta
              </span>
            )}

            {timeRemaining && !isClosed && (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#B45309',
                padding: '4px 10px',
                borderRadius: 999,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5
              }}>
                <Clock size={12} /> {timeRemaining}
              </span>
            )}
          </div>

          {/* BADGES AUXILIARES */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {enquete.anonima ? (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#64748B',
                background: '#F1F5F9',
                padding: '3px 9px',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }} title="Os nomes dos participantes não são exibidos aos gestores">
                <Lock size={12} /> Voto Anônimo
              </span>
            ) : (
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#4338CA',
                background: '#EEF2FF',
                padding: '3px 9px',
                borderRadius: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4
              }} title="Votação identificada pela equipe escolar">
                <Users size={12} /> Voto Identificado
              </span>
            )}

            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#475569',
              background: '#F1F5F9',
              padding: '3px 9px',
              borderRadius: 8
            }}>
              {enquete.tipo === 'unica' 
                ? 'Escolha única' 
                : enquete.maxEscolhas 
                  ? `Até ${enquete.maxEscolhas} opções` 
                  : 'Múltipla escolha'}
            </span>
          </div>
        </div>

        {/* TÍTULO E DESCRIÇÃO */}
        <div>
          <h3 style={{
            fontSize: 19,
            fontWeight: 800,
            color: '#0F172A',
            margin: '0 0 6px 0',
            lineHeight: 1.35,
            letterSpacing: '-0.015em'
          }}>
            {enquete.pergunta || enquete.titulo}
          </h3>
          {enquete.descricao && (
            <p style={{
              fontSize: 14,
              color: '#475569',
              margin: 0,
              lineHeight: 1.5,
              whiteSpace: 'pre-line'
            }}>
              {enquete.descricao}
            </p>
          )}
        </div>
      </div>

      {/* CORPO DE OPÇÕES */}
      <div style={{ padding: '20px 24px' }}>
        {feedbackMessage && (
          <div style={{
            marginBottom: 16,
            padding: '10px 16px',
            borderRadius: 12,
            background: feedbackMessage.type === 'success' ? '#ECFDF5' : '#FEF2F2',
            border: feedbackMessage.type === 'success' ? '1px solid #A7F3D0' : '1px solid #FECACA',
            color: feedbackMessage.type === 'success' ? '#065F46' : '#991B1B',
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            {feedbackMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {stats.opcoes.map((opcao) => {
            const isSelected = selectedOptions.includes(opcao.id)
            const isUserChoice = userVote && userVote.opcoesIds.includes(opcao.id)
            const percent = opcao.percent || 0

            return (
              <div
                key={opcao.id}
                onClick={() => (!shouldShowResults || isChangingVote) && handleToggleOption(opcao.id)}
                style={{
                  position: 'relative',
                  width: '100%',
                  minHeight: 56,
                  borderRadius: 16,
                  border: isSelected || isUserChoice
                    ? '2px solid #6366F1'
                    : '1.5px solid #E2E8F0',
                  background: isSelected || isUserChoice
                    ? '#F8FAFF'
                    : '#FFFFFF',
                  cursor: (!shouldShowResults || isChangingVote) && !isClosed ? 'pointer' : 'default',
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 18px',
                  boxSizing: 'border-box',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isSelected || isUserChoice
                    ? '0 4px 14px rgba(99, 102, 241, 0.12)'
                    : '0 2px 6px rgba(0, 0, 0, 0.02)'
                }}
                onMouseEnter={e => {
                  if ((!shouldShowResults || isChangingVote) && !isClosed) {
                    e.currentTarget.style.borderColor = '#6366F1'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }
                }}
                onMouseLeave={e => {
                  if ((!shouldShowResults || isChangingVote) && !isClosed) {
                    e.currentTarget.style.borderColor = isSelected || isUserChoice ? '#6366F1' : '#E2E8F0'
                    e.currentTarget.style.transform = 'none'
                  }
                }}
              >
                {/* BARRA DE PROGRESSO ANIMADA (QUANDO EXIBE RESULTADOS) */}
                {shouldShowResults && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      bottom: 0,
                      background: opcao.isWinner && stats.totalVotos > 0
                        ? 'linear-gradient(90deg, rgba(99, 102, 241, 0.18) 0%, rgba(139, 92, 246, 0.28) 100%)'
                        : 'rgba(241, 245, 249, 0.95)',
                      borderRight: opcao.isWinner && stats.totalVotos > 0 ? '2px solid #8B5CF6' : '1px solid #CBD5E1',
                      zIndex: 1
                    }}
                  />
                )}

                {/* CONTEÚDO DA OPÇÃO */}
                <div style={{
                  position: 'relative',
                  zIndex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  gap: 12
                }}>
                  {/* ESQUERDA: ÍCONE/SELETOR + TEXTO */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    {/* SELETOR (QUANDO EM MODO DE VOTAÇÃO) */}
                    {(!shouldShowResults || isChangingVote) && (
                      <div style={{
                        width: 22,
                        height: 22,
                        borderRadius: enquete.tipo === 'unica' ? '50%' : 7,
                        border: isSelected ? 'none' : '2px solid #CBD5E1',
                        background: isSelected ? '#6366F1' : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        flexShrink: 0,
                        transition: 'all 0.15s'
                      }}>
                        {isSelected && <Check size={14} strokeWidth={3} />}
                      </div>
                    )}

                    {/* EMOJI DA OPÇÃO */}
                    {opcao.emoji && (
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{opcao.emoji}</span>
                    )}

                    {/* TEXTO DA OPÇÃO */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: isSelected || isUserChoice ? '#1E1B4B' : '#1E293B',
                        wordBreak: 'break-word'
                      }}>
                        {opcao.texto}
                      </span>

                      {/* BADGE "SEU VOTO" */}
                      {isUserChoice && shouldShowResults && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          background: '#6366F1',
                          color: '#FFFFFF',
                          padding: '2px 8px',
                          borderRadius: 999,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          boxShadow: '0 2px 6px rgba(99, 102, 241, 0.3)'
                        }}>
                          <Check size={10} strokeWidth={3} /> Seu voto
                        </span>
                      )}

                      {/* COROA DO MAIS VOTADO */}
                      {shouldShowResults && opcao.isWinner && stats.totalVotos > 0 && stats.opcoes.length > 1 && (
                        <span style={{
                          fontSize: 10,
                          fontWeight: 800,
                          background: '#FEF3C7',
                          color: '#B45309',
                          padding: '2px 7px',
                          borderRadius: 999,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3
                        }}>
                          <Trophy size={10} /> Mais votado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* DIREITA: RESULTADOS (% E TOTAL DE VOTOS) */}
                  {shouldShowResults && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 12,
                        color: '#64748B',
                        fontWeight: 600
                      }}>
                        {opcao.count} {opcao.count === 1 ? 'voto' : 'votos'}
                      </span>

                      <span style={{
                        fontSize: 16,
                        fontWeight: 800,
                        color: opcao.isWinner && stats.totalVotos > 0 ? '#4338CA' : '#334155',
                        minWidth: 48,
                        textAlign: 'right'
                      }}>
                        {percent}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* MENSAGEM SE RESULTADOS ESTIVEREM OCULTOS PARA NÃO-ADMIN */}
        {hasVoted && !shouldShowResults && (
          <div style={{
            marginTop: 16,
            padding: '14px 18px',
            borderRadius: 14,
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#475569',
            fontSize: 13,
            fontWeight: 600
          }}>
            <Shield size={18} color="#6366F1" />
            <span>Seu voto foi registrado com sucesso. Por definição da escola, os resultados parciais desta enquete são confidenciais e visíveis apenas pela gestão.</span>
          </div>
        )}

        {/* AÇÕES DE VOTAÇÃO (QUANDO NÃO VOTOU OU ESTÁ ALTERANDO O VOTO) */}
        {(!hasVoted || isChangingVote) && !isClosed && (
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
            {isChangingVote && (
              <button
                type="button"
                onClick={() => {
                  setIsChangingVote(false)
                  if (userVote) setSelectedOptions(userVote.opcoesIds)
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: 12,
                  border: '1px solid #CBD5E1',
                  background: '#FFFFFF',
                  color: '#64748B',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Cancelar Alteração
              </button>
            )}

            <button
              type="button"
              onClick={handleSubmitVote}
              disabled={selectedOptions.length === 0 || isSubmitting}
              style={{
                padding: '12px 28px',
                borderRadius: 14,
                border: 'none',
                background: selectedOptions.length === 0
                  ? '#CBD5E1'
                  : 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                color: '#FFFFFF',
                fontSize: 14,
                fontWeight: 800,
                cursor: selectedOptions.length === 0 || isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: selectedOptions.length > 0 ? '0 4px 14px rgba(99, 102, 241, 0.35)' : 'none',
                transition: 'all 0.2s'
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Computando voto...</span>
                </>
              ) : (
                <>
                  <Check size={16} strokeWidth={3} />
                  <span>{isChangingVote ? 'Salvar Novo Voto' : 'Confirmar Voto'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* FOOTER DA ENQUETE COM METADADOS E BOTÕES ADMINISTRATIVOS */}
      <div style={{
        padding: '14px 24px',
        borderTop: '1px solid rgba(226, 232, 240, 0.8)',
        background: '#FAFAFC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        fontSize: 12.5,
        color: '#64748B'
      }}>
        {/* LADO ESQUERDO: TOTAL DE VOTOS E INDICADOR AO VIVO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={15} color="#6366F1" />
            {stats.totalVotantes} {stats.totalVotantes === 1 ? 'participante' : 'participantes'} ({stats.totalVotos} {stats.totalVotos === 1 ? 'voto' : 'votos'})
          </span>

          <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#10B981', fontWeight: 600 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
            Atualização em tempo real
          </span>
        </div>

        {/* LADO DIREITO: BOTÕES DE GESTÃO / ALTERAÇÃO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* BOTÃO ALTERAR MEU VOTO */}
          {hasVoted && !isChangingVote && enquete.permitirAlterarVoto && !isClosed && (
            <button
              type="button"
              onClick={() => setIsChangingVote(true)}
              style={{
                background: 'none',
                border: '1px solid #CBD5E1',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                color: '#475569',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366F1'; e.currentTarget.style.color = '#6366F1'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#475569'; }}
            >
              <RefreshCw size={12} /> Alterar meu voto
            </button>
          )}

          {/* BOTÃO ADMINISTRATIVO: VER LISTA DE VOTANTES */}
          {isAdminMode && (
            <button
              type="button"
              onClick={() => setShowVotersModal(true)}
              style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                padding: '6px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                color: '#4338CA',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              <Users size={13} /> Ver Detalhes dos Votos
            </button>
          )}

          {/* BOTÃO ADMINISTRATIVO: ENCERRAR / REABRIR */}
          {isAdminMode && (
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={isUpdatingStatus}
              style={{
                background: isClosed ? '#ECFDF5' : '#FEF2F2',
                border: isClosed ? '1px solid #A7F3D0' : '1px solid #FECACA',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                color: isClosed ? '#065F46' : '#991B1B',
                cursor: isUpdatingStatus ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5
              }}
            >
              {isUpdatingStatus ? (
                <Loader2 size={12} className="animate-spin" />
              ) : isClosed ? (
                <>
                  <Unlock size={12} /> Reabrir Enquete
                </>
              ) : (
                <>
                  <Lock size={12} /> Encerrar Enquete
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* MODAL DE DETALHES DOS VOTANTES (ADMIN / GESTÃO) */}
      <AnimatePresence>
        {showVotersModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.75)',
              backdropFilter: 'blur(8px)',
              zIndex: 99999999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => setShowVotersModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '620px',
                maxHeight: '85vh',
                background: '#FFFFFF',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
              {/* HEADER DO MODAL */}
              <div style={{
                padding: '18px 24px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#FAFAFC'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#FFF'
                  }}>
                    <Users size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Registro de Votos da Enquete
                    </h3>
                    <div style={{ fontSize: 12, color: '#64748B' }}>
                      {stats.totalVotantes} {stats.totalVotantes === 1 ? 'participante registrado' : 'participantes registrados'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowVotersModal(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#F1F5F9',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748B'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* FILTROS POR OPÇÃO */}
              <div style={{
                padding: '10px 24px',
                borderBottom: '1px solid #F1F5F9',
                display: 'flex',
                gap: 8,
                overflowX: 'auto'
              }}>
                <button
                  type="button"
                  onClick={() => setSelectedVotersFilter('all')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: selectedVotersFilter === 'all' ? '1.5px solid #6366F1' : '1px solid #E2E8F0',
                    background: selectedVotersFilter === 'all' ? 'rgba(99, 102, 241, 0.1)' : '#FFFFFF',
                    color: selectedVotersFilter === 'all' ? '#4338CA' : '#64748B',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  Todos ({allVotersList.length})
                </button>

                {enquete.opcoes.map(op => {
                  const count = allVotersList.filter(v => v.opcoesIds.includes(op.id)).length
                  const isCur = selectedVotersFilter === op.id
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setSelectedVotersFilter(op.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 999,
                        border: isCur ? '1.5px solid #6366F1' : '1px solid #E2E8F0',
                        background: isCur ? 'rgba(99, 102, 241, 0.1)' : '#FFFFFF',
                        color: isCur ? '#4338CA' : '#64748B',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5
                      }}
                    >
                      {op.emoji && <span>{op.emoji}</span>}
                      <span>{op.texto} ({count})</span>
                    </button>
                  )
                })}
              </div>

              {/* CONTEÚDO DOS VOTANTES */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
                {enquete.anonima ? (
                  <div style={{
                    padding: '24px 18px',
                    textAlign: 'center',
                    background: '#F8FAFC',
                    borderRadius: 16,
                    border: '1px dashed #CBD5E1'
                  }}>
                    <Lock size={32} color="#D97706" style={{ margin: '0 auto 12px' }} />
                    <h4 style={{ fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 6px 0' }}>
                      Esta enquete foi criada com Voto Anônimo
                    </h4>
                    <p style={{ fontSize: 13, color: '#64748B', margin: 0, lineHeight: 1.5, maxWidth: 400, marginInline: 'auto' }}>
                      Por privacidade e transparência, os nomes e dados individuais dos votantes foram preservados pelo sistema e não podem ser revelados.
                    </p>
                  </div>
                ) : filteredVoters.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 16px', color: '#94A3B8', fontSize: 14 }}>
                    Nenhum voto registrado para este filtro.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {filteredVoters.map((v, idx) => {
                      const voteTime = new Date(v.votadoEm)
                      const timeStr = voteTime.toLocaleDateString('pt-BR') + ' às ' + voteTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                      const chosenOptions = enquete.opcoes.filter(op => v.opcoesIds.includes(op.id))

                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '12px 16px',
                            borderRadius: 14,
                            border: '1px solid #E2E8F0',
                            background: '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {/* AVATAR */}
                            <div style={{
                              width: 38,
                              height: 38,
                              borderRadius: '50%',
                              background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
                              color: '#FFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: 14,
                              overflow: 'hidden',
                              flexShrink: 0
                            }}>
                              {v.usuarioFoto ? (
                                <img src={v.usuarioFoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                (v.usuarioNome || 'U').charAt(0).toUpperCase()
                              )}
                            </div>

                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                                {v.usuarioNome}
                              </div>
                              <div style={{ fontSize: 12, color: '#64748B' }}>
                                {v.alunoNome ? `Aluno(a): ${v.alunoNome}` : (v.usuarioTipo === 'responsavel' ? 'Responsável' : 'Colaborador')} • {timeStr}
                              </div>
                            </div>
                          </div>

                          {/* OPÇÕES VOTADAS */}
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {chosenOptions.map(op => (
                              <span
                                key={op.id}
                                style={{
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: 'rgba(99, 102, 241, 0.1)',
                                  color: '#4338CA',
                                  padding: '3px 8px',
                                  borderRadius: 8,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4
                                }}
                              >
                                {op.emoji && <span>{op.emoji}</span>}
                                <span>{op.texto}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* FOOTER DO MODAL */}
              <div style={{
                padding: '14px 24px',
                borderTop: '1px solid #F1F5F9',
                background: '#FAFAFC',
                display: 'flex',
                justifyContent: 'flex-end'
              }}>
                <button
                  type="button"
                  onClick={() => setShowVotersModal(false)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: 10,
                    border: '1px solid #CBD5E1',
                    background: '#FFF',
                    color: '#475569',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
