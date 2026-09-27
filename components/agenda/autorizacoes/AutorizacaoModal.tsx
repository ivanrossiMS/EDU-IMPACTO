'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, FileCheck2, Plus, Trash2, Check, Sparkles, HelpCircle, 
  Calendar, Eye, Lock, ShieldCheck, MapPin, DollarSign,
  HeartPulse, Shield, FileText, CheckCircle2, XCircle, AlertCircle,
  Clock, ArrowRight
} from 'lucide-react'
import { AutorizacaoData, AutorizacaoOpcao } from '@/lib/autorizacoes/types'
import { validarCPF, formatarCPF } from '@/lib/autorizacoes/autorizacaoUtils'

interface AutorizacaoModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (autorizacao: AutorizacaoData) => void
  initialData?: AutorizacaoData | null
  currentUser?: any
}

export function AutorizacaoModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  currentUser
}: AutorizacaoModalProps) {
  const [activeTab, setActiveTab] = useState<'config' | 'preview'>('config')

  // Form states
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [termoTexto, setTermoTexto] = useState('')
  const [dataEvento, setDataEvento] = useState('')
  const [localEvento, setLocalEvento] = useState('')
  const [valor, setValor] = useState('')
  const [dataLimite, setDataLimite] = useState('')
  const [exigirObservacoes, setExigirObservacoes] = useState(false)
  const [observacoesLabel, setObservacoesLabel] = useState('Alergias, restrições alimentares ou recomendações médicas')
  const [exigirCpfResponsavel, setExigirCpfResponsavel] = useState(false)
  const [permitirAlterarResposta, setPermitirAlterarResposta] = useState(true)

  const [opcoes, setOpcoes] = useState<AutorizacaoOpcao[]>([
    { id: 'opt_sim', texto: 'Sim, autorizo', tipo: 'aprova', cor: '#10B981', emoji: '✅' },
    { id: 'opt_nao', texto: 'Não autorizo', tipo: 'recusa', cor: '#EF4444', emoji: '❌' }
  ])

  const [previewSelectedOpcao, setPreviewSelectedOpcao] = useState<string>('opt_sim')
  const [previewObs, setPreviewObs] = useState('')
  const [previewCpf, setPreviewCpf] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const isPreviewCpfValid = useMemo(() => validarCPF(previewCpf), [previewCpf])
  const canPreviewSign = !exigirCpfResponsavel || isPreviewCpfValid

  // Initialize or reset
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitulo(initialData.titulo || '')
        setDescricao(initialData.descricao || '')
        setTermoTexto(initialData.termoTexto || '')
        setDataEvento(initialData.dataEvento || '')
        setLocalEvento(initialData.localEvento || '')
        setValor(initialData.valor || '')
        setDataLimite(initialData.dataLimite || '')
        setExigirObservacoes(initialData.exigirObservacoes ?? false)
        setObservacoesLabel(initialData.observacoesLabel || 'Alergias, restrições alimentares ou recomendações médicas')
        const reqCpf = initialData.exigirCpfResponsavel ?? initialData.exigirDocumentoResponsavel ?? false
        setExigirCpfResponsavel(reqCpf)
        setPermitirAlterarResposta(initialData.permitirAlterarResposta ?? true)
        setOpcoes(
          Array.isArray(initialData.opcoes) && initialData.opcoes.length >= 2
            ? initialData.opcoes
            : [
                { id: 'opt_sim', texto: 'Sim, autorizo', tipo: 'aprova', cor: '#10B981', emoji: '✅' },
                { id: 'opt_nao', texto: 'Não autorizo', tipo: 'recusa', cor: '#EF4444', emoji: '❌' }
              ]
        )
      } else {
        // Nova Autorização limpa (sem preenchimento automático de modelos)
        setTitulo('')
        setDescricao('')
        setTermoTexto('')
        setDataEvento('')
        setLocalEvento('')
        setValor('')
        setDataLimite('')
        setExigirObservacoes(false)
        setObservacoesLabel('Alergias, restrições alimentares ou recomendações médicas')
        setExigirCpfResponsavel(false)
        setPermitirAlterarResposta(true)
        setOpcoes([
          { id: 'opt_sim', texto: 'Sim, autorizo', tipo: 'aprova', cor: '#10B981', emoji: '✅' },
          { id: 'opt_nao', texto: 'Não autorizo', tipo: 'recusa', cor: '#EF4444', emoji: '❌' }
        ])
      }
      setActiveTab('config')
      setPreviewCpf('')
      setErrorMessage('')
    }
  }, [isOpen, initialData])

  if (!isOpen) return null

  const handleAddOption = () => {
    if (opcoes.length >= 8) return
    const nextId = `opt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
    setOpcoes([...opcoes, { id: nextId, texto: '', tipo: 'neutro', cor: '#6366F1', emoji: '📝' }])
  }

  const handleRemoveOption = (index: number) => {
    if (opcoes.length <= 2) return
    setOpcoes(opcoes.filter((_, i) => i !== index))
  }

  const handleUpdateOption = (index: number, updates: Partial<AutorizacaoOpcao>) => {
    setOpcoes(opcoes.map((op, i) => (i === index ? { ...op, ...updates } : op)))
  }

  const handleQuickPresetDate = (days: number) => {
    const date = new Date()
    date.setDate(date.getDate() + days)
    date.setHours(18, 0, 0, 0)
    const localString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T18:00`
    setDataLimite(localString)
  }

  const handleSave = () => {
    setErrorMessage('')
    if (!titulo.trim() || titulo.trim().length < 4) {
      setErrorMessage('Por favor, informe o título da autorização com pelo menos 4 caracteres.')
      setActiveTab('config')
      return
    }

    if (!termoTexto.trim() || termoTexto.trim().length < 10) {
      setErrorMessage('Por favor, preencha o termo de consentimento com o texto da autorização (mínimo 10 caracteres).')
      setActiveTab('config')
      return
    }

    const filledOptions = opcoes.filter(o => o.texto.trim().length > 0)
    if (filledOptions.length < 2) {
      setErrorMessage('A autorização precisa de no mínimo 2 opções de resposta preenchidas (ex: Sim e Não).')
      setActiveTab('config')
      return
    }

    const payload: AutorizacaoData = {
      id: initialData?.id || `AUT-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      titulo: titulo.trim(),
      tipoAutorizacao: 'personalizado',
      descricao: descricao.trim() || undefined,
      termoTexto: termoTexto.trim(),
      dataEvento: dataEvento || null,
      localEvento: localEvento.trim() || undefined,
      valor: valor.trim() || undefined,
      dataLimite: dataLimite || null,
      encerrada: initialData?.encerrada || false,
      permitirAlterarResposta,
      exigirObservacoes,
      observacoesLabel: exigirObservacoes ? observacoesLabel.trim() : undefined,
      exigirCpfResponsavel,
      exigirDocumentoResponsavel: exigirCpfResponsavel,
      opcoes: filledOptions.map(op => ({
        id: op.id,
        texto: op.texto.trim(),
        tipo: op.tipo || 'neutro',
        cor: op.tipo === 'aprova' ? '#10B981' : op.tipo === 'recusa' ? '#EF4444' : '#6366F1',
        emoji: op.emoji || (op.tipo === 'aprova' ? '✅' : op.tipo === 'recusa' ? '❌' : '📝'),
        respostasCount: op.respostasCount || 0
      })),
      respostas: initialData?.respostas || {},
      totalRespostas: initialData?.totalRespostas || 0,
      criadoEm: initialData?.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      criadoPor: initialData?.criadoPor || (currentUser ? {
        id: currentUser.id,
        nome: currentUser.nome || 'Colaborador',
        cargo: currentUser.cargo || currentUser.perfil
      } : undefined)
    }

    onSave(payload)
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
          maxWidth: '720px',
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
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(6, 182, 212, 0.05) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)',
              color: '#FFFFFF'
            }}>
              <FileCheck2 size={24} strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
                  {initialData ? 'Editar Autorização' : 'Nova Autorização Digital'}
                </h2>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  background: 'rgba(16, 185, 129, 0.12)',
                  color: '#047857',
                  padding: '2px 8px',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <ShieldCheck size={11} /> Assinatura Digital
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#64748B', margin: '2px 0 0 0' }}>
                Crie termos de passeios e autorizações com opções e assinatura dos pais
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
              borderBottom: activeTab === 'config' ? '2.5px solid #10B981' : '2.5px solid transparent',
              color: activeTab === 'config' ? '#047857' : '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            <FileText size={16} />
            <span>Configurar Autorização</span>
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
              borderBottom: activeTab === 'preview' ? '2.5px solid #10B981' : '2.5px solid transparent',
              color: activeTab === 'preview' ? '#047857' : '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s'
            }}
          >
            <Eye size={16} />
            <span>Pré-visualização (Pais)</span>
          </button>
        </div>

        {/* BODY */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {errorMessage && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: '#B91C1C',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'config' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* TÍTULO */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', display: 'block', marginBottom: 6 }}>
                  Título da Autorização <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Autorização de saída de passeio"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 14,
                    border: '1.5px solid #E2E8F0',
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => (e.target.style.borderColor = '#10B981')}
                  onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
                />
              </div>

              {/* DETALHES DO EVENTO (PASSEIO) */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 16,
                padding: '14px 16px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 12
              }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <MapPin size={12} color="#059669" /> Local / Destino
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Teatro Municipal"
                    value={localEvento}
                    onChange={e => setLocalEvento(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      color: '#0F172A',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Calendar size={12} color="#059669" /> Data do Evento / Saída
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 15/10/2026 às 08:30"
                    value={dataEvento}
                    onChange={e => setDataEvento(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      color: '#0F172A',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <DollarSign size={12} color="#059669" /> Custo / Valor
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Gratuito ou R$ 45,00"
                    value={valor}
                    onChange={e => setValor(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      color: '#0F172A',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* TERMO DE CONSENTIMENTO */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', display: 'block', marginBottom: 6 }}>
                  Texto do Termo de Consentimento <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Ex: Eu, na qualidade de responsável legal pelo(a) aluno(a), autorizo a sua participação na saída de passeio escolar promovida pelo colégio..."
                  value={termoTexto}
                  onChange={e => setTermoTexto(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 14,
                    border: '1.5px solid #E2E8F0',
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: '#0F172A',
                    outline: 'none',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                  onFocus={e => (e.target.style.borderColor = '#10B981')}
                  onBlur={e => (e.target.style.borderColor = '#E2E8F0')}
                />
                <span style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, display: 'block' }}>
                  Este texto declara a concordância dos pais e será registrado junto à data, hora e assinatura digital.
                </span>
              </div>

              {/* OPÇÕES DE RESPOSTA */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#1E293B' }}>
                    Opções de Resposta <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    disabled={opcoes.length >= 8}
                    style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: 'none',
                      borderRadius: 8,
                      padding: '4px 10px',
                      color: '#047857',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: opcoes.length >= 8 ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Plus size={13} />
                    <span>Adicionar Opção</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {opcoes.map((opcao, index) => {
                    const isAprova = opcao.tipo === 'aprova'
                    const isRecusa = opcao.tipo === 'recusa'

                    return (
                      <div
                        key={opcao.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          background: isAprova ? '#F0FDF4' : isRecusa ? '#FEF2F2' : '#F8FAFC',
                          border: `1.5px solid ${isAprova ? '#86EFAC' : isRecusa ? '#FCA5A5' : '#E2E8F0'}`,
                          borderRadius: 14,
                          padding: '6px 10px'
                        }}
                      >
                        {/* Selector de Tipo (Aprova / Recusa / Neutro) */}
                        <select
                          value={opcao.tipo}
                          onChange={e => {
                            const newTipo = e.target.value as 'aprova' | 'recusa' | 'neutro'
                            handleUpdateOption(index, {
                              tipo: newTipo,
                              emoji: newTipo === 'aprova' ? '✅' : newTipo === 'recusa' ? '❌' : '📝'
                            })
                          }}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: 8,
                            padding: '6px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            color: isAprova ? '#15803D' : isRecusa ? '#B91C1C' : '#475569',
                            cursor: 'pointer'
                          }}
                        >
                          <option value="aprova">✅ Aprova (Sim)</option>
                          <option value="recusa">❌ Recusa (Não)</option>
                          <option value="neutro">📝 Neutro / Condicional</option>
                        </select>

                        {/* Texto da Opção */}
                        <input
                          type="text"
                          value={opcao.texto}
                          onChange={e => handleUpdateOption(index, { texto: e.target.value })}
                          placeholder={`Texto da opção ${index + 1}...`}
                          style={{
                            flex: 1,
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: 10,
                            padding: '8px 12px',
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#0F172A',
                            outline: 'none'
                          }}
                        />

                        {/* Botão Remover (se mais de 2) */}
                        {opcoes.length > 2 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(index)}
                            style={{
                              background: '#FEE2E2',
                              border: 'none',
                              borderRadius: 8,
                              width: 32,
                              height: 32,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#DC2626',
                              cursor: 'pointer'
                            }}
                            title="Remover opção"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* PRAZO LIMITE */}
              <div style={{
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: 16,
                padding: '14px 16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={15} color="#059669" /> Prazo Limite para Resposta dos Pais
                  </label>
                  {dataLimite && (
                    <button
                      type="button"
                      onClick={() => setDataLimite('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#EF4444',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Remover Prazo
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  <input
                    type="datetime-local"
                    value={dataLimite}
                    onChange={e => setDataLimite(e.target.value)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 10,
                      border: '1px solid #CBD5E1',
                      fontSize: 13,
                      color: '#0F172A',
                      background: '#FFFFFF'
                    }}
                  />

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => handleQuickPresetDate(2)}
                      style={{
                        padding: '6px 10px',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      +2 dias
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPresetDate(5)}
                      style={{
                        padding: '6px 10px',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      +5 dias
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickPresetDate(7)}
                      style={{
                        padding: '6px 10px',
                        background: '#FFFFFF',
                        border: '1px solid #CBD5E1',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#475569',
                        cursor: 'pointer'
                      }}
                    >
                      +1 semana
                    </button>
                  </div>
                </div>
              </div>

              {/* TOGGLES / CONFIGURAÇÕES ESPECIAIS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Exigir observações médicas */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 14
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
                      <HeartPulse size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                        Solicitar Observações Médicas / Restrições
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Permite que os pais informem alergias, restrições alimentares ou medicamentos para a saída
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={exigirObservacoes}
                    onChange={e => setExigirObservacoes(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#10B981', cursor: 'pointer', marginTop: 6 }}
                  />
                </div>

                {/* Exigir CPF do Responsável */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 14
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                      <ShieldCheck size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                        Exigir CPF do Responsável
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Validação matemática dos 11 dígitos e cálculo dos dígitos verificadores para validade jurídica da assinatura digital
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={exigirCpfResponsavel}
                    onChange={e => setExigirCpfResponsavel(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#10B981', cursor: 'pointer', marginTop: 6 }}
                  />
                </div>

                {/* Permitir alterar resposta antes do prazo */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 14
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366F1' }}>
                      <Lock size={18} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                        Permitir Alterar Resposta até o Encerramento
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B' }}>
                        Os pais podem mudar de ideia antes da data limite expirar
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={permitirAlterarResposta}
                    onChange={e => setPermitirAlterarResposta(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#10B981', cursor: 'pointer', marginTop: 6 }}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* PREVIEW TAB */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                background: '#F0FDF4',
                border: '1px solid #BBF7D0',
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 12,
                color: '#166534',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}>
                <Eye size={15} />
                <span>Esta é a simulação exata de como a família visualizará e assinará a autorização no aplicativo.</span>
              </div>

              {/* CARD PREVIEW */}
              <div style={{
                background: '#FFFFFF',
                border: '1.5px solid #10B981',
                borderRadius: 20,
                padding: '20px',
                boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.12)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Glow decorativo */}
                <div style={{
                  position: 'absolute',
                  top: -40,
                  right: -40,
                  width: 120,
                  height: 120,
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  filter: 'blur(30px)',
                  pointerEvents: 'none'
                }} />

                {/* Top Badge */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(16, 185, 129, 0.12)',
                    color: '#047857',
                    fontSize: 11,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em'
                  }}>
                    <FileCheck2 size={13} />
                    <span>Autorização Requerida</span>
                  </div>

                  {dataLimite && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#D97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} /> Prazo: {dataLimite.replace('T', ' ')}
                    </span>
                  )}
                </div>

                {/* Título */}
                <h3 style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', margin: '0 0 10px 0', letterSpacing: '-0.02em' }}>
                  {titulo || 'Título da Autorização'}
                </h3>

                {/* Pills de Evento */}
                {(localEvento || dataEvento || valor) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    {localEvento && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', background: '#F1F5F9', padding: '4px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MapPin size={12} color="#059669" /> {localEvento}
                      </span>
                    )}
                    {dataEvento && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#334155', background: '#F1F5F9', padding: '4px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Calendar size={12} color="#059669" /> {dataEvento}
                      </span>
                    )}
                    {valor && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#065F46', background: '#DCFCE7', padding: '4px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <DollarSign size={12} color="#059669" /> {valor}
                      </span>
                    )}
                  </div>
                )}

                {/* Termo Jurídico */}
                <div style={{
                  background: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: 14,
                  padding: '14px 16px',
                  fontSize: 13,
                  lineHeight: 1.6,
                  color: '#334155',
                  marginBottom: 16,
                  fontStyle: 'italic'
                }}>
                  &ldquo;{termoTexto || 'O termo de autorização aparecerá aqui para ser lido e aceito pelo responsável legal...'}&rdquo;
                </div>

                {/* Opções de Seleção */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                  {opcoes.map(op => {
                    const isSelected = previewSelectedOpcao === op.id
                    const isAprova = op.tipo === 'aprova'
                    const isRecusa = op.tipo === 'recusa'

                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() => setPreviewSelectedOpcao(op.id)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          borderRadius: 14,
                          border: isSelected
                            ? `2px solid ${isAprova ? '#10B981' : isRecusa ? '#EF4444' : '#6366F1'}`
                            : '1.5px solid #E2E8F0',
                          background: isSelected
                            ? isAprova ? '#F0FDF4' : isRecusa ? '#FEF2F2' : '#F5F3FF'
                            : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.05)' : 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 16 }}>{op.emoji || (isAprova ? '✅' : '❌')}</span>
                          <span style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: isSelected
                              ? isAprova ? '#15803D' : isRecusa ? '#B91C1C' : '#4F46E5'
                              : '#1E293B'
                          }}>
                            {op.texto || 'Opção de resposta'}
                          </span>
                        </div>

                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          border: `2px solid ${isSelected ? (isAprova ? '#10B981' : isRecusa ? '#EF4444' : '#6366F1') : '#CBD5E1'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {isSelected && (
                            <div style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: isAprova ? '#10B981' : isRecusa ? '#EF4444' : '#6366F1'
                            }} />
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>

                {/* Campo de Observações Médicas se ativado */}
                {exigirObservacoes && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <HeartPulse size={14} color="#EF4444" /> {observacoesLabel}
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Alérgico a amendoim; toma antialérgico se necessário..."
                      value={previewObs}
                      onChange={e => setPreviewObs(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: '1.5px solid #E2E8F0',
                        fontSize: 13,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                )}

                {/* CPF do Responsável se ativado */}
                {exigirCpfResponsavel && (
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ShieldCheck size={14} color="#059669" />
                        <span>CPF do Responsável (Assinatura Digital) <span style={{ color: '#EF4444' }}>*</span></span>
                      </label>
                      {previewCpf.length > 0 && (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: isPreviewCpfValid ? '#15803D' : '#DC2626',
                          background: isPreviewCpfValid ? '#DCFCE7' : '#FEE2E2',
                          padding: '2px 8px',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}>
                          {isPreviewCpfValid ? '✓ CPF Válido' : '✕ CPF Inválido'}
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      maxLength={14}
                      value={previewCpf}
                      onChange={e => setPreviewCpf(formatarCPF(e.target.value))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: 12,
                        border: `1.5px solid ${previewCpf.length > 0 ? (isPreviewCpfValid ? '#10B981' : '#FCA5A5') : '#E2E8F0'}`,
                        fontSize: 14,
                        fontWeight: 600,
                        color: '#0F172A',
                        boxSizing: 'border-box',
                        outline: 'none',
                        letterSpacing: '0.04em'
                      }}
                    />
                    {previewCpf.length > 0 && !isPreviewCpfValid && (
                      <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                        Digite os 11 números e o cálculo verificador correto do CPF para conseguir assinar.
                      </p>
                    )}
                  </div>
                )}

                {/* Botão de Ação */}
                <button
                  type="button"
                  disabled={!canPreviewSign}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 14,
                    background: canPreviewSign
                      ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                      : '#E2E8F0',
                    color: canPreviewSign ? '#FFFFFF' : '#94A3B8',
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: canPreviewSign ? '0 4px 14px rgba(16, 185, 129, 0.3)' : 'none',
                    cursor: canPreviewSign ? 'default' : 'not-allowed',
                    transition: 'all 0.2s'
                  }}
                >
                  <ShieldCheck size={18} />
                  <span>Assinar e Confirmar Autorização</span>
                </button>

                {exigirCpfResponsavel && !isPreviewCpfValid && (
                  <div style={{ textAlign: 'center', marginTop: 8 }}>
                    <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 600 }}>
                      ⚠️ Preencha um CPF válido para habilitar a assinatura digital
                    </span>
                  </div>
                )}

                <div style={{ textAlign: 'center', marginTop: 10 }}>
                  <span style={{ fontSize: 11, color: '#94A3B8', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={11} /> Autenticado com protocolo seguro e registro em tempo real
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #F1F5F9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          background: '#FFFFFF'
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: 14,
              border: '1px solid #E2E8F0',
              background: '#FFFFFF',
              color: '#475569',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '10px 22px',
              borderRadius: 14,
              border: 'none',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Check size={16} strokeWidth={2.6} />
            <span>Salvar Autorização</span>
          </button>
        </div>
      </motion.div>
    </div>
  )
}
