'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, Vote, Plus, Trash2, Check, Sparkles, HelpCircle, 
  Calendar, Eye, Lock, Unlock, RefreshCw, Layers, ArrowUp, ArrowDown,
  Smile, ShieldCheck, CheckCircle2
} from 'lucide-react'
import { EnqueteData, EnqueteOpcao } from '@/lib/enquetes/types'

interface EnqueteModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (enquete: EnqueteData) => void
  initialData?: EnqueteData | null
  currentUser?: any
}

const QUICK_EMOJIS = ['👍', '👎', '🎉', '❤️', '📅', '🥪', '🚌', '🎒', '✏️', '⚽', '🥗', '🍕', '💡', '🌟', '✅', '❌']

export function EnqueteModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  currentUser
}: EnqueteModalProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config')

  // Form states
  const [pergunta, setPergunta] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipo, setTipo] = useState<'unica' | 'multipla'>('unica')
  const [maxEscolhas, setMaxEscolhas] = useState<number | undefined>(undefined)
  const [permitirAlterarVoto, setPermitirAlterarVoto] = useState(true)
  const [anonima, setAnonima] = useState(false)
  const [visibilidadeResultados, setVisibilidadeResultados] = useState<'imediato' | 'apos_votar' | 'somente_admin'>('apos_votar')
  const [dataExpiracao, setDataExpiracao] = useState<string>('')
  
  const [opcoes, setOpcoes] = useState<EnqueteOpcao[]>([
    { id: 'opt_1', texto: '', emoji: '👍' },
    { id: 'opt_2', texto: '', emoji: '👎' }
  ])

  const [activeEmojiIndex, setActiveEmojiIndex] = useState<number | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [previewVotes, setPreviewVotes] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState<string>('')

  // Initialize or reset form
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setPergunta(initialData.pergunta || initialData.titulo || '')
        setDescricao(initialData.descricao || '')
        setTipo(initialData.tipo || 'unica')
        setMaxEscolhas(initialData.maxEscolhas)
        setPermitirAlterarVoto(initialData.permitirAlterarVoto ?? true)
        setAnonima(initialData.anonima ?? false)
        setVisibilidadeResultados(initialData.visibilidadeResultados || 'apos_votar')
        setDataExpiracao(initialData.dataExpiracao || '')
        setOpcoes(
          Array.isArray(initialData.opcoes) && initialData.opcoes.length >= 2
            ? initialData.opcoes
            : [
                { id: 'opt_1', texto: '', emoji: '👍' },
                { id: 'opt_2', texto: '', emoji: '👎' }
              ]
        )
      } else {
        setPergunta('')
        setDescricao('')
        setTipo('unica')
        setMaxEscolhas(undefined)
        setPermitirAlterarVoto(true)
        setAnonima(false)
        setVisibilidadeResultados('apos_votar')
        setDataExpiracao('')
        setOpcoes([
          { id: 'opt_1', texto: '', emoji: '👍' },
          { id: 'opt_2', texto: '', emoji: '👎' }
        ])
      }
      setActiveTab('config')
      setErrorMessage('')
      setPreviewVotes([])
    }
  }, [isOpen, initialData])

  if (!isOpen) return null

  const handleAddOption = () => {
    if (opcoes.length >= 10) return
    const nextId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    const defaultEmoji = QUICK_EMOJIS[opcoes.length % QUICK_EMOJIS.length]
    setOpcoes([...opcoes, { id: nextId, texto: '', emoji: defaultEmoji }])
  }

  const handleRemoveOption = (index: number) => {
    if (opcoes.length <= 2) return
    const updated = opcoes.filter((_, i) => i !== index)
    setOpcoes(updated)
  }

  const handleUpdateOption = (index: number, updates: Partial<EnqueteOpcao>) => {
    const updated = opcoes.map((op, i) => (i === index ? { ...op, ...updates } : op))
    setOpcoes(updated)
  }

  const handleQuickPresetDate = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    const localString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    setDataExpiracao(localString)
  }

  const handleSave = () => {
    setErrorMessage('')
    if (!pergunta.trim() || pergunta.trim().length < 4) {
      setErrorMessage('Por favor, informe a pergunta da enquete com pelo menos 4 caracteres.')
      setActiveTab('config')
      return
    }

    const filledOptions = opcoes.filter(o => o.texto.trim().length > 0)
    if (filledOptions.length < 2) {
      setErrorMessage('A enquete precisa de no mínimo 2 opções de resposta preenchidas.')
      setActiveTab('config')
      return
    }

    const enquetePayload: EnqueteData = {
      id: initialData?.id || `ENQ-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      titulo: pergunta.trim(),
      pergunta: pergunta.trim(),
      descricao: descricao.trim() || undefined,
      tipo,
      maxEscolhas: tipo === 'multipla' ? maxEscolhas : undefined,
      permitirAlterarVoto,
      anonima,
      visibilidadeResultados,
      dataExpiracao: dataExpiracao || null,
      encerrada: initialData?.encerrada || false,
      opcoes: filledOptions.map(op => ({
        id: op.id,
        texto: op.texto.trim(),
        emoji: op.emoji || undefined,
        votosCount: op.votosCount || 0
      })),
      votos: initialData?.votos || {},
      totalVotos: initialData?.totalVotos || 0,
      criadoEm: initialData?.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      criadoPor: initialData?.criadoPor || (currentUser ? {
        id: currentUser.id,
        nome: currentUser.nome || 'Colaborador',
        cargo: currentUser.cargo || currentUser.perfil
      } : undefined)
    }

    onSave(enquetePayload)
    onClose()
  }

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto'
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 15 }}
        transition={{ type: 'spring', damping: 26, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          maxHeight: '92vh',
          background: '#FFFFFF',
          borderRadius: '24px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(226, 232, 240, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* HEADER */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.04) 0%, rgba(99, 102, 241, 0.04) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
              color: '#FFFFFF'
            }}>
              <Vote size={22} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                  {initialData ? 'Editar Enquete' : 'Nova Enquete Interativa'}
                </h2>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'rgba(245, 158, 11, 0.12)',
                  color: '#B45309',
                  padding: '2px 8px',
                  borderRadius: 999
                }}>
                  Tempo Real
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0 0' }}>
                Crie votações interativas com apuração instantânea e gráficos de %
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 34,
              height: 34,
              borderRadius: 12,
              background: '#F1F5F9',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748B',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#E2E8F0'; e.currentTarget.style.color = '#0F172A'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#F1F5F9'; e.currentTarget.style.color = '#64748B'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* TABS */}
        <div style={{
          display: 'flex',
          padding: '8px 24px 0',
          borderBottom: '1px solid #F1F5F9',
          gap: 16
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            style={{
              padding: '10px 4px',
              fontSize: 14,
              fontWeight: 700,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'config' ? '2.5px solid #F59E0B' : '2.5px solid transparent',
              color: activeTab === 'config' ? '#D97706' : '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            <span>Configurar Enquete</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            style={{
              padding: '10px 4px',
              fontSize: 14,
              fontWeight: 700,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'preview' ? '2.5px solid #F59E0B' : '2.5px solid transparent',
              color: activeTab === 'preview' ? '#D97706' : '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            <Eye size={16} />
            <span>Pré-visualização ao Vivo</span>
            <span style={{
              fontSize: 10,
              background: '#ECFDF5',
              color: '#059669',
              padding: '1px 6px',
              borderRadius: 6,
              fontWeight: 800
            }}>
              Simular
            </span>
          </button>
        </div>

        {/* BODY */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {errorMessage && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: 14,
              padding: '12px 16px',
              marginBottom: 20,
              color: '#B91C1C',
              fontSize: 13,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'config' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* PERGUNTA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Pergunta da Enquete <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: 12, color: pergunta.length > 110 ? '#EF4444' : '#94A3B8', fontWeight: 600 }}>
                    {pergunta.length}/120
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={120}
                  value={pergunta}
                  onChange={e => setPergunta(e.target.value)}
                  placeholder="Ex: Qual o melhor dia para a reunião de pais e mestres?"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: '1.5px solid #CBD5E1',
                    background: '#F8FAFC',
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#0F172A',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#F59E0B'; e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245, 158, 11, 0.15)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>

              {/* DESCRIÇÃO OPCIONAL */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Detalhes / Instruções <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 500 }}>(opcional)</span>
                  </label>
                  <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>
                    {descricao.length}/250
                  </span>
                </div>
                <textarea
                  rows={2}
                  maxLength={250}
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  placeholder="Ex: Por favor, vote até quinta-feira para planejarmos o coffee break e acomodação."
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    borderRadius: 14,
                    border: '1.5px solid #E2E8F0',
                    background: '#F8FAFC',
                    fontSize: 13.5,
                    color: '#334155',
                    outline: 'none',
                    transition: 'all 0.2s',
                    resize: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit'
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#F59E0B'; e.currentTarget.style.background = '#FFFFFF'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#F8FAFC'; }}
                />
              </div>

              {/* TIPO DE ESCOLHA */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                  Formato de Escolha
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div
                    onClick={() => setTipo('unica')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 16,
                      border: tipo === 'unica' ? '2px solid #F59E0B' : '1.5px solid #E2E8F0',
                      background: tipo === 'unica' ? 'rgba(245, 158, 11, 0.05)' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      border: tipo === 'unica' ? '6px solid #F59E0B' : '2px solid #CBD5E1',
                      marginTop: 2,
                      flexShrink: 0
                    }} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Escolha Única</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>O participante escolhe apenas 1 opção</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setTipo('multipla')}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 16,
                      border: tipo === 'multipla' ? '2px solid #F59E0B' : '1.5px solid #E2E8F0',
                      background: tipo === 'multipla' ? 'rgba(245, 158, 11, 0.05)' : '#FFFFFF',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: 6,
                      border: tipo === 'multipla' ? 'none' : '2px solid #CBD5E1',
                      background: tipo === 'multipla' ? '#F59E0B' : 'transparent',
                      marginTop: 2,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFF'
                    }}>
                      {tipo === 'multipla' && <Check size={14} strokeWidth={3} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>Múltipla Escolha</div>
                      <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Pode selecionar várias opções</div>
                    </div>
                  </div>
                </div>

                {tipo === 'multipla' && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>Limite máximo de escolhas:</span>
                    <select
                      value={maxEscolhas || ''}
                      onChange={e => setMaxEscolhas(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: '1px solid #CBD5E1',
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#0F172A',
                        background: '#FFF'
                      }}
                    >
                      <option value="">Sem limite (qualquer quantia)</option>
                      {opcoes.map((_, i) => (
                        <option key={i + 1} value={i + 1}>Até {i + 1} opções</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* OPÇÕES DE RESPOSTA */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Opções de Resposta ({opcoes.length})
                  </label>
                  <span style={{ fontSize: 11, color: '#64748B' }}>
                    Mínimo 2 • Máximo 10
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {opcoes.map((opcao, index) => (
                    <div key={opcao.id} style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                      {/* Pílula número */}
                      <span style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        background: '#F1F5F9',
                        color: '#64748B',
                        fontSize: 12,
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}>
                        {index + 1}
                      </span>

                      {/* Botão de Emoji */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setActiveEmojiIndex(activeEmojiIndex === index ? null : index)}
                          title="Trocar emoji da opção"
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                            border: '1.5px solid #E2E8F0',
                            background: '#FFF',
                            fontSize: 18,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s'
                          }}
                        >
                          {opcao.emoji || '📌'}
                        </button>

                        {/* Emoji Picker Popover */}
                        {activeEmojiIndex === index && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '100%',
                              left: 0,
                              marginTop: 6,
                              zIndex: 100,
                              background: '#FFF',
                              borderRadius: 16,
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0,0,0,0.06)',
                              padding: 10,
                              display: 'grid',
                              gridTemplateColumns: 'repeat(4, 1fr)',
                              gap: 6,
                              width: 180
                            }}
                          >
                            {QUICK_EMOJIS.map(em => (
                              <button
                                key={em}
                                type="button"
                                onClick={() => {
                                  handleUpdateOption(index, { emoji: em })
                                  setActiveEmojiIndex(null)
                                }}
                                style={{
                                  fontSize: 20,
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  padding: 6,
                                  borderRadius: 8,
                                  transition: 'background 0.1s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = '#F1F5F9'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                              >
                                {em}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Input do texto da opção */}
                      <input
                        type="text"
                        value={opcao.texto}
                        onChange={e => handleUpdateOption(index, { texto: e.target.value })}
                        placeholder={`Opção ${index + 1}...`}
                        style={{
                          flex: 1,
                          padding: '12px 14px',
                          borderRadius: 12,
                          border: '1.5px solid #E2E8F0',
                          background: '#FFF',
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#0F172A',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                        onFocus={e => e.currentTarget.style.borderColor = '#F59E0B'}
                        onBlur={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                      />

                      {/* Botão Remover */}
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(index)}
                        disabled={opcoes.length <= 2}
                        title={opcoes.length <= 2 ? 'Mínimo de 2 opções obrigatório' : 'Remover opção'}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 10,
                          background: opcoes.length <= 2 ? '#F8FAFC' : '#FEE2E2',
                          border: 'none',
                          color: opcoes.length <= 2 ? '#CBD5E1' : '#EF4444',
                          cursor: opcoes.length <= 2 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.15s'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                {opcoes.length < 10 && (
                  <button
                    type="button"
                    onClick={handleAddOption}
                    style={{
                      marginTop: 12,
                      width: '100%',
                      padding: '10px 16px',
                      borderRadius: 12,
                      border: '1.5px dashed #CBD5E1',
                      background: '#F8FAFC',
                      color: '#475569',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#F59E0B'; e.currentTarget.style.color = '#D97706'; e.currentTarget.style.background = 'rgba(245, 158, 11, 0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.color = '#475569'; e.currentTarget.style.background = '#F8FAFC'; }}
                  >
                    <Plus size={16} />
                    <span>Adicionar Opção de Resposta</span>
                  </button>
                )}
              </div>

              {/* REGRAS & PRIVACIDADE AVANÇADAS */}
              <div style={{
                borderRadius: 18,
                border: '1px solid #E2E8F0',
                background: '#FAFAFA',
                overflow: 'hidden'
              }}>
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  style={{
                    width: '100%',
                    padding: '14px 18px',
                    background: 'none',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: '#334155'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ShieldCheck size={18} color="#D97706" />
                    <span>Regras, Privacidade & Prazos da Enquete</span>
                  </div>
                  <span style={{ fontSize: 12, color: '#64748B' }}>
                    {showAdvanced ? 'Recolher ▲' : 'Configurar ▼'}
                  </span>
                </button>

                <AnimatePresence>
                  {showAdvanced && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ padding: '0 18px 18px', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: 16 }}
                    >
                      {/* VOTO ANÔNIMO */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14 }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {anonima ? <Lock size={15} color="#D97706" /> : <Unlock size={15} color="#64748B" />}
                            Votação Anônima (Sigilosa)
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            {anonima ? 'Os nomes dos votantes ficam ocultos. Apenas os totais são exibidos.' : 'Gestores e professores podem ver quem votou em cada opção.'}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={anonima}
                          onChange={e => setAnonima(e.target.checked)}
                          style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#F59E0B' }}
                        />
                      </div>

                      {/* PERMITIR ALTERAR VOTO */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <RefreshCw size={15} color="#10B981" />
                            Permitir Alterar o Voto
                          </div>
                          <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            Os participantes podem mudar de escolha enquanto a enquete estiver aberta.
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={permitirAlterarVoto}
                          onChange={e => setPermitirAlterarVoto(e.target.checked)}
                          style={{ width: 20, height: 20, cursor: 'pointer', accentColor: '#10B981' }}
                        />
                      </div>

                      {/* VISIBILIDADE DOS RESULTADOS */}
                      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
                        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>
                          Visibilidade dos Resultados Parciais
                        </label>
                        <select
                          value={visibilidadeResultados}
                          onChange={e => setVisibilidadeResultados(e.target.value as any)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: 12,
                            border: '1.5px solid #CBD5E1',
                            background: '#FFF',
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: '#1E293B'
                          }}
                        >
                          <option value="apos_votar">Visível para o participante após votar (Recomendado)</option>
                          <option value="imediato">Sempre visível para todos (mesmo antes de votar)</option>
                          <option value="somente_admin">Apenas Administradores e Gestores (oculto para os alunos/pais)</option>
                        </select>
                      </div>

                      {/* DATA DE EXPIRAÇÃO */}
                      <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <label style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                            Data e Hora Limite de Encerramento (Opcional)
                          </label>
                          {dataExpiracao && (
                            <button
                              type="button"
                              onClick={() => setDataExpiracao('')}
                              style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                            >
                              Limpar prazo
                            </button>
                          )}
                        </div>
                        <input
                          type="datetime-local"
                          value={dataExpiracao}
                          onChange={e => setDataExpiracao(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            borderRadius: 12,
                            border: '1.5px solid #CBD5E1',
                            background: '#FFF',
                            fontSize: 13.5,
                            fontWeight: 600,
                            color: '#1E293B',
                            boxSizing: 'border-box'
                          }}
                        />

                        {/* Presets rápidos */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => handleQuickPresetDate(1)}
                            style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFF', fontSize: 11, fontWeight: 700, color: '#64748B', cursor: 'pointer' }}
                          >
                            +24 horas
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickPresetDate(3)}
                            style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFF', fontSize: 11, fontWeight: 700, color: '#64748B', cursor: 'pointer' }}
                          >
                            +3 dias
                          </button>
                          <button
                            type="button"
                            onClick={() => handleQuickPresetDate(7)}
                            style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#FFF', fontSize: 11, fontWeight: 700, color: '#64748B', cursor: 'pointer' }}
                          >
                            +1 semana
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            /* PREVIEW INTERATIVO AO VIVO */
            <div>
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 16,
                padding: '14px 18px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <Sparkles size={20} color="#F59E0B" />
                <div style={{ fontSize: 13, color: '#475569' }}>
                  Esta é a pré-visualização interativa exatamente como seus destinatários (alunos, responsáveis ou colaboradores) verão no celular ou computador.
                </div>
              </div>

              {/* CARD DE PRÉVIA DA ENQUETE */}
              <div style={{
                background: '#FFFFFF',
                borderRadius: 20,
                border: '1.5px solid #E2E8F0',
                padding: '24px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.06)'
              }}>
                {/* Header da enquete */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      background: 'rgba(245, 158, 11, 0.12)',
                      color: '#B45309',
                      padding: '4px 10px',
                      borderRadius: 999
                    }}>
                      <Vote size={12} /> Enquete
                    </span>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      background: '#ECFDF5',
                      color: '#059669',
                      padding: '4px 10px',
                      borderRadius: 999,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />
                      Votação Aberta
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {anonima && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', background: '#F1F5F9', padding: '3px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Lock size={11} /> Anônima
                      </span>
                    )}
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748B', background: '#F1F5F9', padding: '3px 8px', borderRadius: 6 }}>
                      {tipo === 'unica' ? 'Escolha Única' : 'Múltipla Escolha'}
                    </span>
                  </div>
                </div>

                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: '0 0 6px 0', lineHeight: 1.4 }}>
                  {pergunta || 'Pergunta da Enquete...'}
                </h3>
                {descricao && (
                  <p style={{ fontSize: 13.5, color: '#475569', margin: '0 0 18px 0', lineHeight: 1.5 }}>
                    {descricao}
                  </p>
                )}

                {/* Opções na prévia */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
                  {opcoes.map((opcao, i) => {
                    const isSelected = previewVotes.includes(opcao.id)
                    const simulatedTotal = previewVotes.length > 0 ? previewVotes.length : 1
                    const simulatedCount = isSelected ? 1 : 0
                    const simulatedPercent = previewVotes.length > 0 ? (isSelected ? 100 : 0) : 0

                    return (
                      <button
                        key={opcao.id}
                        type="button"
                        onClick={() => {
                          if (tipo === 'unica') {
                            setPreviewVotes([opcao.id])
                          } else {
                            if (previewVotes.includes(opcao.id)) {
                              setPreviewVotes(previewVotes.filter(x => x !== opcao.id))
                            } else {
                              if (!maxEscolhas || previewVotes.length < maxEscolhas) {
                                setPreviewVotes([...previewVotes, opcao.id])
                              }
                            }
                          }
                        }}
                        style={{
                          width: '100%',
                          padding: '14px 16px',
                          borderRadius: 14,
                          border: isSelected ? '2px solid #F59E0B' : '1.5px solid #E2E8F0',
                          background: isSelected ? 'rgba(245, 158, 11, 0.04)' : '#FFFFFF',
                          position: 'relative',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          textAlign: 'left'
                        }}
                      >
                        {/* Barra de progresso animada */}
                        {previewVotes.length > 0 && isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              bottom: 0,
                              width: '100%',
                              background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.2) 100%)',
                              zIndex: 1,
                              transition: 'width 0.6s ease'
                            }}
                          />
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 2 }}>
                          <span style={{ fontSize: 20 }}>{opcao.emoji || '📌'}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: isSelected ? '#B45309' : '#0F172A' }}>
                            {opcao.texto || `Opção ${i + 1}`}
                          </span>
                          {isSelected && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              color: '#FFF',
                              background: '#F59E0B',
                              padding: '2px 8px',
                              borderRadius: 999,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3
                            }}>
                              <Check size={11} strokeWidth={3} /> Seu voto
                            </span>
                          )}
                        </div>

                        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                          {previewVotes.length > 0 && isSelected && (
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#D97706' }}>
                              100%
                            </span>
                          )}
                          <div style={{
                            width: 20,
                            height: 20,
                            borderRadius: tipo === 'unica' ? '50%' : 6,
                            border: isSelected ? 'none' : '2px solid #CBD5E1',
                            background: isSelected ? '#F59E0B' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFF'
                          }}>
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div style={{
                  marginTop: 18,
                  paddingTop: 14,
                  borderTop: '1px solid #F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: '#64748B'
                }}>
                  <span>👥 {previewVotes.length > 0 ? '1 voto computado' : 'Nenhum voto ainda'}</span>
                  <span>🟢 Atualizado automaticamente</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #F1F5F9',
          background: '#FAFAFA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '12px 20px',
              borderRadius: 14,
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '12px 24px',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(245, 158, 11, 0.35)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            <CheckCircle2 size={18} />
            <span>Salvar e Anexar Enquete</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}
