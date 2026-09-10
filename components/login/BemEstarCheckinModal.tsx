'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle2, ChevronRight, HeartPulse, BrainCircuit, AlertTriangle, MessageCircle, Loader2, ChevronLeft, X } from 'lucide-react'

type ConfigState = {
  ativo: boolean
  frequencia_dias: number
  titulo_modal: string
  subtitulo_modal: string
  pergunta_emocao: string
  emocoes: { label: string; emoji: string; color: string }[]
  motivos: string[]
  perguntas_burnout: { id: string; pergunta: string; invertida?: boolean; opcoes?: string[] }[]
}

const DEFAULT_CONFIG: ConfigState = {
  ativo: true,
  frequencia_dias: 7,
  titulo_modal: 'Check-in de Bem-Estar',
  subtitulo_modal: 'Acompanhamento Semanal',
  pergunta_emocao: 'Como foi essa sua semana no ambiente de trabalho?',
  emocoes: [
    { label: 'Muito bem', emoji: '🙂', color: '#10b981' },
    { label: 'Bem', emoji: '😊', color: '#34d399' },
    { label: 'Regular', emoji: '😐', color: '#fbbf24' },
    { label: 'Cansado', emoji: '😟', color: '#f87171' },
    { label: 'Precisando conversar', emoji: '😞', color: '#ef4444' }
  ],
  motivos: [
    'Semana tranquila',
    'Apoio da equipe',
    'Reconhecimento no trabalho',
    'Organização da rotina',
    'Aprendizado e evolução',
    'Equilíbrio vida e trabalho',
    'Sentimento de propósito',
    'Sobrecarga de tarefas',
    'Dificuldade com equipe',
    'Conflitos no trabalho',
    'Problemas pessoais',
    'Outro'
  ],
  perguntas_burnout: [
    { id: 'q1', pergunta: 'Estou dormindo bem?', invertida: false },
    { id: 'q2', pergunta: 'Tenho energia para trabalhar?', invertida: false },
    { id: 'q3', pergunta: 'Tenho sentido ansiedade?', invertida: true },
    { id: 'q4', pergunta: 'Estou sobrecarregado?', invertida: true },
    { id: 'q5', pergunta: 'Consigo descansar?', invertida: false }
  ]
}

function organizeMotivos(list: string[]) {
  const labelMap: Record<string, string> = {
    'Equilíbrio entre vida pessoal e trabalho': 'Equilíbrio vida e trabalho',
    'Aprendizado e desenvolvimento': 'Aprendizado e evolução',
    'Reconhecimento pelo trabalho': 'Reconhecimento no trabalho',
    'Sobrecarga': 'Sobrecarga de tarefas',
    'Conflitos': 'Conflitos no trabalho'
  }

  const orderPriority: Record<string, number> = {
    'Semana tranquila': 1,
    'Apoio da equipe': 2,
    'Reconhecimento no trabalho': 3,
    'Reconhecimento pelo trabalho': 3,
    'Organização da rotina': 4,
    'Rotina organizada': 4,
    'Aprendizado e evolução': 5,
    'Aprendizado e desenvolvimento': 5,
    'Equilíbrio vida e trabalho': 6,
    'Equilíbrio entre vida pessoal e trabalho': 6,
    'Sentimento de propósito': 7,
    'Sobrecarga de tarefas': 8,
    'Sobrecarga': 8,
    'Dificuldade com equipe': 9,
    'Conflitos no trabalho': 10,
    'Conflitos': 10,
    'Problemas pessoais': 11
  }

  const mapped = list.map(item => labelMap[item] || item)
  const uniqueList = Array.from(new Set(mapped))

  return [...uniqueList].sort((a, b) => {
    const isAOutro = a.trim().toLowerCase() === 'outro'
    const isBOutro = b.trim().toLowerCase() === 'outro'
    if (isAOutro) return 1
    if (isBOutro) return -1
    const pA = orderPriority[a] ?? 50
    const pB = orderPriority[b] ?? 50
    return pA - pB
  })
}

export function BemEstarCheckinModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG)
  const [configLoading, setConfigLoading] = useState(true)

  const [step, setStep] = useState(1) // 1 = Emoção, 2 = Motivos, 3 = Burnout, 4 = Resultado/Conversa
  const [emocao, setEmocao] = useState('')
  const [motivos, setMotivos] = useState<string[]>([])
  const [burnoutRes, setBurnoutRes] = useState<number[]>([])

  const [loading, setLoading] = useState(false)
  const [risco, setRisco] = useState('')
  const [querConversar, setQuerConversar] = useState('')

  useEffect(() => {
    if (isOpen) {
      fetchConfig()
    }
  }, [isOpen])

  const fetchConfig = async () => {
    setConfigLoading(true)
    try {
      const res = await fetch('/api/gestao-pessoas/checkin/config', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (data) {
          setConfig({
            ativo: data.ativo ?? DEFAULT_CONFIG.ativo,
            frequencia_dias: data.frequencia_dias ?? DEFAULT_CONFIG.frequencia_dias,
            titulo_modal: data.titulo_modal || DEFAULT_CONFIG.titulo_modal,
            subtitulo_modal: data.subtitulo_modal || DEFAULT_CONFIG.subtitulo_modal,
            pergunta_emocao: data.pergunta_emocao || DEFAULT_CONFIG.pergunta_emocao,
            emocoes: Array.isArray(data.emocoes) && data.emocoes.length > 0 ? data.emocoes : DEFAULT_CONFIG.emocoes,
            motivos: Array.isArray(data.motivos) && data.motivos.length > 0 ? data.motivos : DEFAULT_CONFIG.motivos,
            perguntas_burnout: Array.isArray(data.perguntas_burnout) && data.perguntas_burnout.length > 0 ? data.perguntas_burnout : DEFAULT_CONFIG.perguntas_burnout
          })
          setBurnoutRes(new Array(data.perguntas_burnout?.length || 5).fill(0))
        }
      }
    } catch (e) {
      console.error('Erro ao buscar config do checkin:', e)
      setBurnoutRes(new Array(DEFAULT_CONFIG.perguntas_burnout.length).fill(0))
    } finally {
      setConfigLoading(false)
    }
  }

  const burnoutOptions = [
    { value: 1, label: 'Nada' },
    { value: 2, label: 'Pouco' },
    { value: 3, label: 'Médio' },
    { value: 4, label: 'Muito' },
    { value: 5, label: 'Totalmente' }
  ]

  const getScore = (qIndex: number, val: number) => {
    const q = config.perguntas_burnout[qIndex]
    if (q && q.invertida) {
      return 6 - val
    }
    return val
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const respostasDetalhadas = config.perguntas_burnout.map((q, idx) => {
        const rawValue = burnoutRes[idx] || 3
        const score = getScore(idx, rawValue)
        return {
          id: q.id,
          pergunta: q.pergunta,
          resposta_valor: rawValue,
          score
        }
      })

      const res = await fetch('/api/gestao-pessoas/checkin/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emocao_geral: emocao,
          motivos,
          burnout_q1: getScore(0, burnoutRes[0] || 3),
          burnout_q2: getScore(1, burnoutRes[1] || 3),
          burnout_q3: getScore(2, burnoutRes[2] || 3),
          burnout_q4: getScore(3, burnoutRes[3] || 3),
          burnout_q5: getScore(4, burnoutRes[4] || 3),
          respostas_detalhadas: respostasDetalhadas,
          quer_conversar: querConversar || null
        })
      })

      const data = await res.json()
      if (data.success) {
        setRisco(data.risco_burnout)
        setStep(4)
      } else {
        alert(data.error || 'Erro ao salvar check-in')
      }
    } catch (e) {
      alert('Erro de conexão')
    }
    setLoading(false)
  }

  const finish = () => {
    onClose()
  }

  const btnBaseStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px',
    borderRadius: '14px',
    fontWeight: 700,
    fontSize: '15px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: 'none',
    transition: 'all 0.2s',
    outline: 'none'
  }

  const displayMotivos = organizeMotivos(config.motivos)

  return (
    <Dialog.Root open={isOpen}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.85)',
                  backdropFilter: 'blur(8px)',
                  zIndex: 99999
                }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, x: '-50%', y: '-45%' }}
                animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                exit={{ opacity: 0, scale: 0.95, x: '-50%', y: '-45%' }}
                style={{
                  position: 'fixed',
                  top: '50%',
                  left: '50%',
                  width: 'calc(100% - 32px)',
                  maxWidth: 500,
                  maxHeight: 'min(90dvh, 650px)',
                  background: '#1e293b',
                  borderRadius: 24,
                  padding: '22px 20px',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  zIndex: 100000,
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden'
                }}
              >
                <style>{`
                  .checkin-custom-scroll::-webkit-scrollbar {
                    width: 5px;
                  }
                  .checkin-custom-scroll::-webkit-scrollbar-track {
                    background: transparent;
                  }
                  .checkin-custom-scroll::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.18);
                    border-radius: 99px;
                  }
                `}</style>

                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
                        flexShrink: 0
                      }}
                    >
                      <HeartPulse size={20} color="#fff" />
                    </div>
                    <div>
                      <Dialog.Title style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#fff' }}>
                        {config.titulo_modal}
                      </Dialog.Title>
                      <p style={{ margin: 0, fontSize: 12, color: '#94a3b8' }}>{config.subtitulo_modal}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {step > 1 && step < 4 && (
                      <button
                        type="button"
                        onClick={() => setStep(prev => prev - 1)}
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#cbd5e1',
                          padding: '6px 10px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <ChevronLeft size={14} /> Voltar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={finish}
                      aria-label="Fechar"
                      title="Fechar"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: '#94a3b8',
                        padding: 6,
                        borderRadius: 10,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {configLoading ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Loader2 size={32} className="animate-spin" style={{ marginBottom: 12 }} />
                    <p style={{ margin: 0, fontSize: 14 }}>Carregando check-in...</p>
                  </div>
                ) : (
                  <>
                    {/* ETAPA 1: EMOÇÃO */}
                    {step === 1 && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
                      >
                        <div className="checkin-custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 4 }}>
                          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 14, color: '#f8fafc', lineHeight: 1.35 }}>
                            {config.pergunta_emocao}
                          </h3>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {config.emocoes.map(e => (
                              <button
                                key={e.label}
                                type="button"
                                onClick={() => {
                                  setEmocao(e.label)
                                  setStep(2)
                                }}
                                style={{
                                  padding: '13px 16px',
                                  borderRadius: 14,
                                  background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 14,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  color: '#fff',
                                  fontSize: 15,
                                  fontWeight: 600
                                }}
                                onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                                onMouseLeave={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                              >
                                <span style={{ fontSize: 24 }}>{e.emoji}</span>
                                <span>{e.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* ETAPA 2: MOTIVOS REORGANIZADOS COM BOTÃO AVANÇAR VISÍVEL */}
                    {step === 2 && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
                      >
                        <div
                          className="checkin-custom-scroll"
                          style={{
                            flex: 1,
                            overflowY: 'auto',
                            minHeight: 0,
                            paddingRight: 4,
                            paddingBottom: 8
                          }}
                        >
                          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: '#f8fafc', lineHeight: 1.3 }}>
                            O que mais influenciou sua semana?
                          </h3>
                          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>
                            Selecione um ou mais motivos (opcional)
                          </p>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, 1fr)',
                              gap: 8
                            }}
                          >
                            {displayMotivos.map(m => {
                              const isSel = motivos.includes(m)
                              return (
                                <button
                                  key={m}
                                  type="button"
                                  onClick={() =>
                                    setMotivos(prev => (isSel ? prev.filter(x => x !== m) : [...prev, m]))
                                  }
                                  style={{
                                    padding: '10px 8px',
                                    borderRadius: 12,
                                    fontSize: 12.5,
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center',
                                    lineHeight: 1.25,
                                    minHeight: 46,
                                    background: isSel ? '#2563eb' : 'rgba(255,255,255,0.05)',
                                    border: isSel ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                                    color: isSel ? '#ffffff' : '#cbd5e1',
                                    boxShadow: isSel ? '0 4px 12px rgba(37, 99, 235, 0.35)' : 'none'
                                  }}
                                >
                                  {isSel ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                                      <CheckCircle2 size={15} color="#fff" style={{ flexShrink: 0 }} />
                                      <span>{m}</span>
                                    </span>
                                  ) : (
                                    <span>{m}</span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        {/* Botão de Avançar garantido sempre visível */}
                        <div style={{ paddingTop: 14, marginTop: 'auto', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <button
                            type="button"
                            onClick={() => setStep(3)}
                            style={{
                              ...btnBaseStyle,
                              background: '#2563eb',
                              color: '#fff',
                              boxShadow: '0 4px 14px rgba(37,99,235,0.4)'
                            }}
                          >
                            Avançar <ChevronRight size={18} />
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* ETAPA 3: AUTOAVALIAÇÃO DE BURNOUT */}
                    {step === 3 && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
                      >
                        <div className="checkin-custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 4, paddingBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                            <BrainCircuit size={20} color="#a78bfa" />
                            <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#f8fafc' }}>Autoavaliação de Bem-Estar</h3>
                          </div>
                          <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 14 }}>Responda rapidamente (menos de 2 minutos)</p>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {config.perguntas_burnout.map((q, i) => {
                              const currentOptions = Array.isArray(q.opcoes) && q.opcoes.length === 5
                                ? q.opcoes.map((label, idx) => ({ value: idx + 1, label }))
                                : burnoutOptions

                              return (
                                <div
                                  key={q.id || i}
                                  style={{
                                    background: 'rgba(255,255,255,0.03)',
                                    padding: 12,
                                    borderRadius: 14,
                                    border: '1px solid rgba(255,255,255,0.06)'
                                  }}
                                >
                                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8, color: '#f1f5f9' }}>{q.pergunta}</div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                                    {currentOptions.map(opt => (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => {
                                          const newRes = [...burnoutRes]
                                          newRes[i] = opt.value
                                          setBurnoutRes(newRes)
                                        }}
                                        style={{
                                          padding: '8px 2px',
                                          borderRadius: 8,
                                          fontSize: 11,
                                          fontWeight: 600,
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                          textAlign: 'center',
                                          background: burnoutRes[i] === opt.value ? '#a78bfa' : 'rgba(255,255,255,0.05)',
                                          border: burnoutRes[i] === opt.value ? '1px solid #c4b5fd' : '1px solid rgba(255,255,255,0.1)',
                                          color: burnoutRes[i] === opt.value ? '#1e1b4b' : '#94a3b8'
                                        }}
                                      >
                                        {opt.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Botão Finalizar Check-in fixo no rodapé */}
                        <div style={{ paddingTop: 14, marginTop: 'auto', flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                          <button
                            type="button"
                            disabled={loading || burnoutRes.some(val => !val || val === 0)}
                            onClick={handleSubmit}
                            style={{
                              ...btnBaseStyle,
                              background:
                                loading || burnoutRes.some(val => !val || val === 0)
                                  ? 'rgba(255,255,255,0.1)'
                                  : '#10b981',
                              color: '#fff',
                              boxShadow:
                                loading || burnoutRes.some(val => !val || val === 0)
                                  ? 'none'
                                  : '0 4px 14px rgba(16,185,129,0.35)'
                            }}
                          >
                            {loading ? (
                              <>
                                <Loader2 size={18} className="animate-spin" /> Analisando...
                              </>
                            ) : (
                              'Finalizar Check-in'
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* ETAPA 4: RESULTADO */}
                    {step === 4 && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, textAlign: 'center', padding: '6px 0' }}
                      >
                        <div className="checkin-custom-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: 4 }}>
                          {risco === 'Alto risco' ? (
                            <>
                              <div
                                style={{
                                  width: 68,
                                  height: 68,
                                  borderRadius: '50%',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '2px solid rgba(239, 68, 68, 0.3)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  margin: '0 auto 16px'
                                }}
                              >
                                <AlertTriangle size={34} color="#ef4444" />
                              </div>
                              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#f87171', marginBottom: 8 }}>Atenção ao seu limite</h3>
                              <p style={{ fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 20 }}>
                                Seus resultados indicam um alto nível de sobrecarga. Sua saúde mental e bem-estar são prioridade!
                              </p>

                              {!querConversar ? (
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                                  <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#f8fafc' }}>
                                    <MessageCircle size={16} /> Gostaria de agendar uma conversa com o RH?
                                  </h4>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {['Presencial', 'Online', 'Sigiloso'].map(opt => (
                                      <button
                                        key={opt}
                                        type="button"
                                        onClick={async () => {
                                          setQuerConversar(opt)
                                          await fetch('/api/gestao-pessoas/checkin/submit', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              emocao_geral: emocao,
                                              motivos,
                                              quer_conversar: opt
                                            })
                                          })
                                        }}
                                        style={{
                                          padding: '11px',
                                          borderRadius: 12,
                                          background: 'rgba(59,130,246,0.12)',
                                          border: '1px solid rgba(59,130,246,0.25)',
                                          color: '#60a5fa',
                                          fontWeight: 600,
                                          cursor: 'pointer'
                                        }}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={finish}
                                      style={{
                                        padding: '11px',
                                        borderRadius: 12,
                                        background: 'transparent',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        color: '#94a3b8',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        marginTop: 2
                                      }}
                                    >
                                      Não, obrigado
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div style={{ padding: 16, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 16, color: '#34d399', fontWeight: 600, fontSize: 14 }}>
                                  Recebemos sua solicitação! Entraremos em contato com você em breve.
                                </div>
                              )}
                              {querConversar && (
                                <button type="button" onClick={finish} style={{ ...btnBaseStyle, marginTop: 18, background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                                  Fechar
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <div
                                style={{
                                  width: 68,
                                  height: 68,
                                  borderRadius: '50%',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  margin: '0 auto 16px',
                                  background: risco === 'Atenção' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                  border: risco === 'Atenção' ? '2px solid rgba(245, 158, 11, 0.3)' : '2px solid rgba(16, 185, 129, 0.3)'
                                }}
                              >
                                <CheckCircle2 size={34} color={risco === 'Atenção' ? '#fbbf24' : '#10b981'} />
                              </div>
                              <h3 style={{ fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Obrigado pelo Check-in!</h3>
                              <p style={{ fontSize: 13.5, color: '#cbd5e1', lineHeight: 1.5, marginBottom: 24 }}>
                                {risco === 'Atenção'
                                  ? 'Seu resultado indica que você precisa de um tempo para desacelerar. Lembre-se de cuidar do seu descanso!'
                                  : 'Que ótimo saber que as coisas estão correndo bem! Continue acompanhando o seu bem-estar.'}
                              </p>
                              <button type="button" onClick={finish} style={{ ...btnBaseStyle, background: '#2563eb', color: '#fff' }}>
                                Ir para o Sistema
                              </button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
