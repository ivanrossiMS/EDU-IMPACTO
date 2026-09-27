'use client'

import React, { useState } from 'react'
import {
  MessageSquare,
  Clock,
  Calendar,
  Sparkles,
  Bot,
  AlertCircle,
  CheckCircle2,
  Sliders,
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  Mic,
  Trash2,
  Info,
  RotateCw,
  Send,
  Save,
  Check,
  ChevronDown,
  Lock
} from 'lucide-react'
import { toast } from 'sonner'
import { ADChatAutoConfig, DEFAULT_CHAT_AUTO_CONFIG } from '@/lib/agendaDigitalContext'
import { ChatBlockedNoticeCard, formatDaysOfWeek, ChatBusinessHoursCheck } from '@/components/chat/ChatBlockedNotice'

interface AdminChatSettingsManagerProps {
  localConfig: any
  setLocalConfig: React.Dispatch<React.SetStateAction<any>>
  onSave?: (newConfig: any) => void
}

export function AdminChatSettingsManager({
  localConfig,
  setLocalConfig,
  onSave
}: AdminChatSettingsManagerProps) {
  // Merge existing config with defaults
  const chatConfig: ADChatAutoConfig = {
    ...DEFAULT_CHAT_AUTO_CONFIG,
    ...(localConfig.chatAuto || {}),
    saudacao: {
      ...DEFAULT_CHAT_AUTO_CONFIG.saudacao,
      ...(localConfig.chatAuto?.saudacao || {})
    },
    horarioAtendimento: {
      ...DEFAULT_CHAT_AUTO_CONFIG.horarioAtendimento,
      ...(localConfig.chatAuto?.horarioAtendimento || {})
    },
    recursos: {
      ...DEFAULT_CHAT_AUTO_CONFIG.recursos,
      ...(localConfig.chatAuto?.recursos || {})
    }
  }

  const [isSaving, setIsSaving] = useState(false)

  // Update specific branch
  const updateChatConfig = (updater: (prev: ADChatAutoConfig) => ADChatAutoConfig) => {
    const updated = updater(chatConfig)
    const newConfig = {
      ...localConfig,
      chatAuto: updated
    }
    setLocalConfig(newConfig)
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      const finalChatConfig: ADChatAutoConfig = {
        ...chatConfig,
        horarioAtendimento: {
          ...chatConfig.horarioAtendimento,
          bloquearEnvioForaHorario: true
        }
      }
      const newConfig = {
        ...localConfig,
        chatAuto: finalChatConfig
      }
      setLocalConfig(newConfig)

      // Salva diretamente na base de dados global
      const res = await fetch('/api/configuracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chave: 'ad_config', valor: newConfig })
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || 'Falha ao salvar no servidor')
      }

      if (onSave) {
        await onSave(newConfig)
      }

      toast.success('Regras de automação e horário do chat salvas com sucesso!')
    } catch (err: any) {
      toast.error('Erro ao salvar configurações do chat: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Helper to toggle day in diasSemana
  const toggleDia = (dia: number) => {
    updateChatConfig(prev => {
      const currentDias = prev.horarioAtendimento.diasSemana || []
      const exists = currentDias.includes(dia)
      let nextDias = exists ? currentDias.filter(d => d !== dia) : [...currentDias, dia]
      nextDias.sort((a, b) => a - b)
      return {
        ...prev,
        horarioAtendimento: {
          ...prev.horarioAtendimento,
          diasSemana: nextDias
        }
      }
    })
  }

  // Quick day presets
  const setSegASex = () => {
    updateChatConfig(prev => ({
      ...prev,
      horarioAtendimento: {
        ...prev.horarioAtendimento,
        diasSemana: [1, 2, 3, 4, 5]
      }
    }))
  }

  const setTodosOsDias = () => {
    updateChatConfig(prev => ({
      ...prev,
      horarioAtendimento: {
        ...prev.horarioAtendimento,
        diasSemana: [0, 1, 2, 3, 4, 5, 6]
      }
    }))
  }

  // Insert variable into greeting text
  const insertVariable = (variable: string) => {
    updateChatConfig(prev => ({
      ...prev,
      saudacao: {
        ...prev.saudacao,
        mensagem: (prev.saudacao.mensagem || '') + ' ' + variable
      }
    }))
  }

  // Formatted sample preview for greeting
  const getGreetingPreview = () => {
    const raw = chatConfig.saudacao.mensagem || ''
    return raw
      .replace(/\{nome_contato\}/g, 'Mariana')
      .replace(/\{nome_colaborador\}/g, 'Prof. Carlos')
      .replace(/\{saudacao_tempo\}/g, 'Bom dia')
      .replace(/\{escola\}/g, 'Colégio Impacto')
  }

  const [previewReason, setPreviewReason] = useState<'closed_hour' | 'closed_day' | 'closed_lunch'>('closed_hour')

  const simulatedStatus: ChatBusinessHoursCheck = {
    isClosed: true,
    isLunch: previewReason === 'closed_lunch',
    reason: previewReason,
    currentHourStr: previewReason === 'closed_lunch' ? (chatConfig.horarioAtendimento.almocoInicio || '12:30') : '20:30',
    dayOfWeek: previewReason === 'closed_day' ? 0 : 1,
    diasLabel: formatDaysOfWeek(chatConfig.horarioAtendimento.diasSemana || [1, 2, 3, 4, 5]),
    horarioLabel: `${chatConfig.horarioAtendimento.horarioInicio || '07:00'} às ${chatConfig.horarioAtendimento.horarioFim || '18:00'}`,
    almocoLabel: chatConfig.horarioAtendimento.temIntervaloAlmoco
      ? `${chatConfig.horarioAtendimento.almocoInicio || '12:00'} às ${chatConfig.horarioAtendimento.almocoFim || '13:00'}`
      : undefined,
    hIni: chatConfig.horarioAtendimento.horarioInicio || '07:00',
    hFim: chatConfig.horarioAtendimento.horarioFim || '18:00',
    formattedNotice: '',
    title:
      previewReason === 'closed_day'
        ? 'Sem Expediente Hoje'
        : previewReason === 'closed_lunch'
        ? 'Intervalo de Almoço'
        : 'Horário Não Permitido'
  }

  const diasNomes = [
    { id: 0, label: 'Dom', full: 'Domingo' },
    { id: 1, label: 'Seg', full: 'Segunda-feira' },
    { id: 2, label: 'Ter', full: 'Terça-feira' },
    { id: 3, label: 'Qua', full: 'Quarta-feira' },
    { id: 4, label: 'Qui', full: 'Quinta-feira' },
    { id: 5, label: 'Sex', full: 'Sexta-feira' },
    { id: 6, label: 'Sáb', full: 'Sábado' }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── CARD HEADER ── */}
      <div className="ad-ajustes-card-header" style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #4f46e5, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Bot size={18} />
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: 'hsl(var(--text-main))' }}>
                Regras de Atendimento & Automação do Chat
              </h3>
            </div>
            <p style={{ margin: 0, color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Configure mensagens automáticas de boas-vindas, controle de expediente dos colaboradores, avisos de ausência e permissões de mídia.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f0fdf4', padding: '6px 12px', borderRadius: 20, border: '1px solid #bbf7d0', color: '#166534', fontSize: 12, fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
            Sistema de Autoatendimento Ativo
          </div>
        </div>
      </div>

      <div className="ad-ajustes-card-body" style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>
        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 1: MENSAGEM AUTOMÁTICA DE SAUDAÇÃO (BOAS-VINDAS)
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ background: '#ffffff', borderRadius: 16, border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          {/* Section Header with Main Toggle */}
          <div style={{ padding: '18px 22px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 2px 0', color: '#0f172a' }}>
                  Mensagem Automática de Saudação (Boas-Vindas)
                </h4>
                <p style={{ fontSize: 12, margin: 0, color: '#64748b' }}>
                  Envia automaticamente uma mensagem acolhedora quando um responsável ou aluno enviar mensagem para qualquer colaborador.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <label style={{ position: 'relative', display: 'inline-block', width: 46, height: 26, flexShrink: 0 }}>
              <input
                type="checkbox"
                style={{ opacity: 0, width: 0, height: 0 }}
                checked={chatConfig.saudacao.ativa}
                onChange={e => updateChatConfig(p => ({ ...p, saudacao: { ...p.saudacao, ativa: e.target.checked } }))}
              />
              <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: chatConfig.saudacao.ativa ? '#10b981' : '#cbd5e1', borderRadius: 24, transition: '.3s' }}>
                <span style={{ position: 'absolute', content: '""', height: 20, width: 20, left: 3, bottom: 3, background: 'white', transition: '.3s', borderRadius: '50%', transform: chatConfig.saudacao.ativa ? 'translateX(20px)' : 'none' }}></span>
              </span>
            </label>
          </div>

          {/* Body Settings (Visible when active) */}
          {chatConfig.saudacao.ativa && (
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Frequency Selector */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                  Frequência de Envio da Mensagem de Saudação:
                </label>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px 0' }}>
                  Define com que frequência essa mensagem será reenviada para o mesmo contato, evitando mensagens repetitivas em conversas contínuas.
                </p>
                <div style={{ position: 'relative', maxWidth: 420 }}>
                  <RotateCw size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b', pointerEvents: 'none' }} />
                  <select
                    value={chatConfig.saudacao.frequencia}
                    onChange={e => updateChatConfig(p => ({ ...p, saudacao: { ...p.saudacao, frequencia: e.target.value as any } }))}
                    style={{
                      width: '100%',
                      height: 40,
                      paddingLeft: 36,
                      paddingRight: 30,
                      borderRadius: 10,
                      border: '1px solid #cbd5e1',
                      background: '#f8fafc',
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#0f172a',
                      cursor: 'pointer',
                      outline: 'none',
                      appearance: 'none'
                    }}
                  >
                    <option value="1x_day">No máximo 1 vez por dia (a cada 24 horas) [Recomendado]</option>
                    <option value="1x_2days">1 vez a cada 2 dias (a cada 48 horas)</option>
                    <option value="1x_3days">1 vez a cada 3 dias (a cada 72 horas)</option>
                    <option value="1x_week">1 vez por semana</option>
                    <option value="first_time">Apenas no primeiro contato histórico da conversa</option>
                    <option value="always">Em toda nova interação de mensagem</option>
                  </select>
                  <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: 13, color: '#64748b', pointerEvents: 'none' }} />
                </div>
              </div>

              {/* Greeting Text Input */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Texto da Mensagem de Saudação:
                  </label>
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>
                    {(chatConfig.saudacao.mensagem || '').length} caracteres
                  </span>
                </div>

                {/* Variable tags chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Inserir variável:</span>
                  <button
                    type="button"
                    onClick={() => insertVariable('{nome_contato}')}
                    title="Nome do responsável ou aluno"
                    style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    + {'{nome_contato}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('{saudacao_tempo}')}
                    title="Bom dia / Boa tarde / Boa noite conforme horário"
                    style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    + {'{saudacao_tempo}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('{nome_colaborador}')}
                    title="Nome do educador ou colaborador"
                    style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    + {'{nome_colaborador}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertVariable('{escola}')}
                    title="Nome da escola"
                    style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1d4ed8', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    + {'{escola}'}
                  </button>
                </div>

                <textarea
                  rows={4}
                  value={chatConfig.saudacao.mensagem || ''}
                  onChange={e => updateChatConfig(p => ({ ...p, saudacao: { ...p.saudacao, mensagem: e.target.value } }))}
                  placeholder="Ex: Olá, {nome_contato}! {saudacao_tempo}! Agradecemos a sua mensagem..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    fontSize: 13,
                    color: '#0f172a',
                    outline: 'none',
                    lineHeight: 1.5,
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Live Preview Box */}
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                  Simulação de Envio (Como a família visualizará no chat):
                </span>
                <div style={{ marginTop: 6, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                  <div style={{ maxWidth: 360, background: '#ffffff', borderRadius: 12, padding: '10px 14px', border: '1px solid #bbf7d0', boxShadow: '0 2px 6px rgba(0,0,0,0.03)', position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#047857' }}>Atendimento Automático • Colégio Impacto</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#0f172a', margin: 0, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>
                      {getGreetingPreview()}
                    </p>
                    <div style={{ textAlign: 'right', marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>14:30 ✓✓</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 2: HORÁRIO DE EXPEDIENTE & MENSAGEM DE AUSÊNCIA
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ background: '#ffffff', borderRadius: 16, border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          {/* Header with Main Toggle */}
          <div style={{ padding: '18px 22px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 2px 0', color: '#0f172a' }}>
                  Horário de Atendimento & Bloqueio Fora do Expediente
                </h4>
                <p style={{ fontSize: 12, margin: 0, color: '#64748b' }}>
                  Define a faixa de horário e dias em que a escola atende. Fora dessa janela, o campo de digitação das famílias é substituído pelo card informativo da escola, impedindo novos envios.
                </p>
              </div>
            </div>

            {/* Toggle Switch */}
            <label style={{ position: 'relative', display: 'inline-block', width: 46, height: 26, flexShrink: 0 }}>
              <input
                type="checkbox"
                style={{ opacity: 0, width: 0, height: 0 }}
                checked={chatConfig.horarioAtendimento.ativo}
                onChange={e => updateChatConfig(p => ({ ...p, horarioAtendimento: { ...p.horarioAtendimento, ativo: e.target.checked } }))}
              />
              <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: chatConfig.horarioAtendimento.ativo ? '#10b981' : '#cbd5e1', borderRadius: 24, transition: '.3s' }}>
                <span style={{ position: 'absolute', content: '""', height: 20, width: 20, left: 3, bottom: 3, background: 'white', transition: '.3s', borderRadius: '50%', transform: chatConfig.horarioAtendimento.ativo ? 'translateX(20px)' : 'none' }}></span>
              </span>
            </label>
          </div>

          {chatConfig.horarioAtendimento.ativo && (
            <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Days of the Week Selector */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', margin: 0 }}>
                    Dias da Semana com Expediente:
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={setSegASex}
                      style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#ffffff', fontSize: 11, fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                    >
                      Seg a Sex (Padrão)
                    </button>
                    <button
                      type="button"
                      onClick={setTodosOsDias}
                      style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#ffffff', fontSize: 11, fontWeight: 600, color: '#334155', cursor: 'pointer' }}
                    >
                      Todos os Dias
                    </button>
                  </div>
                </div>

                {/* Day Buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {diasNomes.map(d => {
                    const isSelected = (chatConfig.horarioAtendimento.diasSemana || []).includes(d.id)
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => toggleDia(d.id)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                          background: isSelected ? '#eff6ff' : '#ffffff',
                          color: isSelected ? '#1e40af' : '#64748b',
                          boxShadow: isSelected ? '0 2px 4px rgba(37,99,235,0.1)' : 'none'
                        }}
                      >
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Working Hours Time Range */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Horário de Início do Expediente:
                  </label>
                  <input
                    type="time"
                    value={chatConfig.horarioAtendimento.horarioInicio || '07:00'}
                    onChange={e => updateChatConfig(p => ({ ...p, horarioAtendimento: { ...p.horarioAtendimento, horarioInicio: e.target.value } }))}
                    style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 700, color: '#0f172a', background: '#f8fafc' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Horário de Término do Expediente:
                  </label>
                  <input
                    type="time"
                    value={chatConfig.horarioAtendimento.horarioFim || '18:00'}
                    onChange={e => updateChatConfig(p => ({ ...p, horarioAtendimento: { ...p.horarioAtendimento, horarioFim: e.target.value } }))}
                    style={{ width: '100%', height: 40, padding: '0 12px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 700, color: '#0f172a', background: '#f8fafc' }}
                  />
                </div>
              </div>

              {/* Lunch Break (Optional) */}
              <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: chatConfig.horarioAtendimento.temIntervaloAlmoco ? 12 : 0 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Pausa de Almoço / Intervalo Pedagógico</span>
                    <p style={{ fontSize: 11.5, color: '#64748b', margin: '2px 0 0 0' }}>
                      Ative para pausar o atendimento durante o horário de almoço.
                    </p>
                  </div>
                  <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22, flexShrink: 0 }}>
                    <input
                      type="checkbox"
                      style={{ opacity: 0, width: 0, height: 0 }}
                      checked={chatConfig.horarioAtendimento.temIntervaloAlmoco}
                      onChange={e => updateChatConfig(p => ({ ...p, horarioAtendimento: { ...p.horarioAtendimento, temIntervaloAlmoco: e.target.checked } }))}
                    />
                    <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: chatConfig.horarioAtendimento.temIntervaloAlmoco ? '#10b981' : '#cbd5e1', borderRadius: 24, transition: '.3s' }}>
                      <span style={{ position: 'absolute', content: '""', height: 16, width: 16, left: 3, bottom: 3, background: 'white', transition: '.3s', borderRadius: '50%', transform: chatConfig.horarioAtendimento.temIntervaloAlmoco ? 'translateX(18px)' : 'none' }}></span>
                    </span>
                  </label>
                </div>

                {chatConfig.horarioAtendimento.temIntervaloAlmoco && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 2 }}>Início do Almoço:</label>
                      <input
                        type="time"
                        value={chatConfig.horarioAtendimento.almocoInicio || '12:00'}
                        onChange={e => updateChatConfig(p => ({ ...p, horarioAtendimento: { ...p.horarioAtendimento, almocoInicio: e.target.value } }))}
                        style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#ffffff' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 2 }}>Término do Almoço:</label>
                      <input
                        type="time"
                        value={chatConfig.horarioAtendimento.almocoFim || '13:00'}
                        onChange={e => updateChatConfig(p => ({ ...p, horarioAtendimento: { ...p.horarioAtendimento, almocoFim: e.target.value } }))}
                        style={{ width: '100%', height: 36, padding: '0 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, background: '#ffffff' }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Informative Banner regarding Composer Replacement */}
              <div
                style={{
                  padding: '16px 18px',
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
                  border: '1.5px solid #fed7aa',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 14,
                  boxShadow: '0 2px 8px rgba(234, 88, 12, 0.05)'
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: '#ea580c',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <Lock size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <h5 style={{ fontSize: 14, fontWeight: 800, margin: 0, color: '#9a3412' }}>
                      Bloqueio de Digitação Automático no Lugar do Campo de Mensagem
                    </h5>
                    <span style={{ fontSize: 10, fontWeight: 800, background: '#ffffff', color: '#c2410c', border: '1px solid #fed7aa', padding: '2px 8px', borderRadius: 12 }}>
                      PADRÃO INSTITUCIONAL
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: '#7c2d12', margin: 0, lineHeight: 1.5 }}>
                    Fora do expediente escolar ou nos dias sem atendimento, o campo de digitação e envio das famílias e alunos é <strong>completamente substituído pelo card informativo</strong> abaixo. Não são enviados balões no histórico da conversa, mantendo tudo limpo e sem poluição visual.
                  </p>
                </div>
              </div>


              {/* Live Preview of the Blocked Notice Card */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.04em' }}>
                    Simulação em Tempo Real (Visualização Exata que a Família verá no lugar do campo de mensagem):
                  </span>

                  {/* Tabs to switch scenario preview */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => setPreviewReason('closed_hour')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        border: previewReason === 'closed_hour' ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                        background: previewReason === 'closed_hour' ? '#fff7ed' : '#ffffff',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: previewReason === 'closed_hour' ? '#c2410c' : '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Fora do Horário
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewReason('closed_day')}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 8,
                        border: previewReason === 'closed_day' ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                        background: previewReason === 'closed_day' ? '#fff7ed' : '#ffffff',
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: previewReason === 'closed_day' ? '#c2410c' : '#64748b',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Dia Sem Expediente
                    </button>
                    {chatConfig.horarioAtendimento.temIntervaloAlmoco && (
                      <button
                        type="button"
                        onClick={() => setPreviewReason('closed_lunch')}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 8,
                          border: previewReason === 'closed_lunch' ? '1.5px solid #ea580c' : '1px solid #cbd5e1',
                          background: previewReason === 'closed_lunch' ? '#fff7ed' : '#ffffff',
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: previewReason === 'closed_lunch' ? '#c2410c' : '#64748b',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Intervalo de Almoço
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, padding: 16 }}>
                  <div style={{ maxWidth: 640, margin: '0 auto' }}>
                    <ChatBlockedNoticeCard status={simulatedStatus} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            SEÇÃO 3: RECURSOS, PERMISSÕES DE MÍDIA & TEMPO DE RESPOSTA
        ══════════════════════════════════════════════════════════════════════ */}
        <div style={{ background: '#ffffff', borderRadius: 16, border: '1.5px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ padding: '18px 22px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#f3e8ff', color: '#7e22ce', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sliders size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 800, margin: '0 0 2px 0', color: '#0f172a' }}>
                Permissões de Mídia & SLA das Famílias
              </h4>
              <p style={{ fontSize: 12, margin: 0, color: '#64748b' }}>
                Controle quais tipos de anexos os pais e alunos podem enviar no chat escolar e o tempo previsto de resposta.
              </p>
            </div>
          </div>

          <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* SLA Tempo de Resposta */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                Aviso de Tempo Estimado de Resposta:
              </label>
              <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px 0' }}>
                Exibido de forma elegante no topo do chat para que a família saiba quando esperar um retorno pedagógico.
              </p>
              <div style={{ position: 'relative', maxWidth: 360 }}>
                <Clock size={15} style={{ position: 'absolute', left: 12, top: 12, color: '#64748b', pointerEvents: 'none' }} />
                <select
                  value={chatConfig.recursos.tempoEstimadoResposta}
                  onChange={e => updateChatConfig(p => ({ ...p, recursos: { ...p.recursos, tempoEstimadoResposta: e.target.value } }))}
                  style={{
                    width: '100%',
                    height: 40,
                    paddingLeft: 36,
                    paddingRight: 30,
                    borderRadius: 10,
                    border: '1px solid #cbd5e1',
                    background: '#f8fafc',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#0f172a',
                    cursor: 'pointer',
                    outline: 'none',
                    appearance: 'none'
                  }}
                >
                  <option value="Em até 2 horas úteis">Em até 2 horas úteis</option>
                  <option value="Em até 4 horas úteis">Em até 4 horas úteis</option>
                  <option value="Até o final do expediente">Até o final do expediente</option>
                  <option value="Em até 24 horas úteis">Em até 24 horas úteis</option>
                  <option value="">Sem aviso de tempo</option>
                </select>
                <ChevronDown size={14} style={{ position: 'absolute', right: 12, top: 13, color: '#64748b', pointerEvents: 'none' }} />
              </div>
            </div>

            {/* Media Toggles List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Imagens */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ImageIcon size={18} color="#0284c7" />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Permitir envio de Fotos e Imagens</span>
                    <p style={{ fontSize: 11.5, color: '#64748b', margin: 0 }}>Famílias podem enviar fotos de atestados, atividades ou recibos.</p>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    style={{ opacity: 0, width: 0, height: 0 }}
                    checked={chatConfig.recursos.permitirImagens}
                    onChange={e => updateChatConfig(p => ({ ...p, recursos: { ...p.recursos, permitirImagens: e.target.checked } }))}
                  />
                  <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: chatConfig.recursos.permitirImagens ? '#10b981' : '#cbd5e1', borderRadius: 24, transition: '.3s' }}>
                    <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, background: 'white', transition: '.3s', borderRadius: '50%', transform: chatConfig.recursos.permitirImagens ? 'translateX(20px)' : 'none' }}></span>
                  </span>
                </label>
              </div>

              {/* Áudios */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Mic size={18} color="#7c3aed" />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Permitir envio de Mensagens de Voz / Áudio</span>
                    <p style={{ fontSize: 11.5, color: '#64748b', margin: 0 }}>Permite que os responsáveis enviem mensagens gravadas por áudio.</p>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    style={{ opacity: 0, width: 0, height: 0 }}
                    checked={chatConfig.recursos.permitirAudio}
                    onChange={e => updateChatConfig(p => ({ ...p, recursos: { ...p.recursos, permitirAudio: e.target.checked } }))}
                  />
                  <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: chatConfig.recursos.permitirAudio ? '#10b981' : '#cbd5e1', borderRadius: 24, transition: '.3s' }}>
                    <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, background: 'white', transition: '.3s', borderRadius: '50%', transform: chatConfig.recursos.permitirAudio ? 'translateX(20px)' : 'none' }}></span>
                  </span>
                </label>
              </div>

              {/* Documentos */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <FileText size={18} color="#ea580c" />
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Permitir envio de Documentos & PDFs</span>
                    <p style={{ fontSize: 11.5, color: '#64748b', margin: 0 }}>Permite upload de arquivos PDF, relatórios médicos e documentos oficiais.</p>
                  </div>
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    style={{ opacity: 0, width: 0, height: 0 }}
                    checked={chatConfig.recursos.permitirDocumentos}
                    onChange={e => updateChatConfig(p => ({ ...p, recursos: { ...p.recursos, permitirDocumentos: e.target.checked } }))}
                  />
                  <span style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: chatConfig.recursos.permitirDocumentos ? '#10b981' : '#cbd5e1', borderRadius: 24, transition: '.3s' }}>
                    <span style={{ position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3, background: 'white', transition: '.3s', borderRadius: '50%', transform: chatConfig.recursos.permitirDocumentos ? 'translateX(20px)' : 'none' }}></span>
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* ── BOTTOM SAVE BAR ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10 }}>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={isSaving}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 28px',
              borderRadius: 12,
              border: 'none',
              background: '#4f46e5',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 800,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(79, 70, 229, 0.3)',
              transition: 'all 0.15s ease'
            }}
          >
            <Save size={18} />
            {isSaving ? 'Salvando...' : 'Salvar Regras do Chat'}
          </button>
        </div>
      </div>
    </div>
  )
}
