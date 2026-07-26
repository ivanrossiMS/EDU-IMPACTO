'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle2, ChevronRight, HeartPulse, BrainCircuit, AlertTriangle, MessageCircle, Loader2 } from 'lucide-react'

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
  motivos: ['Sobrecarga', 'Conflitos', 'Problemas pessoais', 'Dificuldade com equipe', 'Outro'],
  perguntas_burnout: [
    { id: 'q1', pergunta: 'Estou dormindo bem?', invertida: false },
    { id: 'q2', pergunta: 'Tenho energia para trabalhar?', invertida: false },
    { id: 'q3', pergunta: 'Tenho sentido ansiedade?', invertida: true },
    { id: 'q4', pergunta: 'Estou sobrecarregado?', invertida: true },
    { id: 'q5', pergunta: 'Consigo descansar?', invertida: false }
  ]
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
      // Pergunta invertida (ex: Sentiu ansiedade): 1 (Nada) é bom (5), 5 (Totalmente) é ruim (1)
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
    padding: '16px',
    borderRadius: '16px',
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
                  width: '90%',
                  maxWidth: 520,
                  background: '#1e293b',
                  borderRadius: 24,
                  padding: 32,
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  zIndex: 100000,
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff'
                }}
              >
                {/* Modal Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      <HeartPulse size={22} color="#fff" />
                    </div>
                    <div>
                      <Dialog.Title style={{ margin: 0, fontSize: 19, fontWeight: 800, color: '#fff' }}>
                        {config.titulo_modal}
                      </Dialog.Title>
                      <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>{config.subtitulo_modal}</p>
                    </div>
                  </div>
                </div>

                {configLoading ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                    <p style={{ margin: 0, fontSize: 14 }}>Carregando check-in...</p>
                  </div>
                ) : (
                  <>
                    {step === 1 && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#f8fafc', lineHeight: 1.4 }}>
                          {config.pergunta_emocao}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {config.emocoes.map(e => (
                            <button
                              key={e.label}
                              onClick={() => {
                                setEmocao(e.label)
                                setStep(2)
                              }}
                              style={{
                                padding: '16px',
                                borderRadius: 16,
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                color: '#fff',
                                fontSize: 16,
                                fontWeight: 600
                              }}
                              onMouseEnter={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                              onMouseLeave={ev => (ev.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                            >
                              <span style={{ fontSize: 26 }}>{e.emoji}</span>
                              {e.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {step === 2 && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: '#f8fafc' }}>
                          O que mais influenciou sua semana?
                        </h3>
                        <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>Selecione um ou mais motivos (opcional)</p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
                          {config.motivos.map(m => {
                            const isSel = motivos.includes(m)
                            return (
                              <button
                                key={m}
                                onClick={() =>
                                  setMotivos(prev => (isSel ? prev.filter(x => x !== m) : [...prev, m]))
                                }
                                style={{
                                  padding: '12px 20px',
                                  borderRadius: 100,
                                  fontSize: 14,
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s',
                                  background: isSel ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                                  border: isSel ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                                  color: isSel ? '#fff' : '#cbd5e1'
                                }}
                              >
                                {m}
                              </button>
                            )
                          })}
                        </div>

                        <button onClick={() => setStep(3)} style={{ ...btnBaseStyle, background: '#3b82f6', color: '#fff' }}>
                          Continuar <ChevronRight size={18} />
                        </button>
                      </motion.div>
                    )}

                    {step === 3 && (
                      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                          <BrainCircuit size={24} color="#a78bfa" />
                          <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#f8fafc' }}>Autoavaliação de Bem-Estar</h3>
                        </div>
                        <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 20 }}>Responda rapidamente (menos de 2 minutos)</p>

                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 20,
                            maxHeight: '48vh',
                            overflowY: 'auto',
                            paddingRight: 8,
                            paddingBottom: 16
                          }}
                        >
                          {config.perguntas_burnout.map((q, i) => {
                            const currentOptions = Array.isArray(q.opcoes) && q.opcoes.length === 5
                              ? q.opcoes.map((label, idx) => ({ value: idx + 1, label }))
                              : burnoutOptions

                            return (
                              <div
                                key={q.id || i}
                                style={{
                                  background: 'rgba(255,255,255,0.03)',
                                  padding: 18,
                                  borderRadius: 16,
                                  border: '1px solid rgba(255,255,255,0.06)'
                                }}
                              >
                                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14, color: '#f1f5f9' }}>{q.pergunta}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                                  {currentOptions.map(opt => (
                                    <button
                                      key={opt.value}
                                      onClick={() => {
                                        const newRes = [...burnoutRes]
                                        newRes[i] = opt.value
                                        setBurnoutRes(newRes)
                                      }}
                                      style={{
                                        padding: '10px 4px',
                                        borderRadius: 10,
                                        fontSize: 12,
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

                        <button
                          disabled={loading || burnoutRes.some(val => !val || val === 0)}
                          onClick={handleSubmit}
                          style={{
                            ...btnBaseStyle,
                            marginTop: 16,
                            background:
                              loading || burnoutRes.some(val => !val || val === 0)
                                ? 'rgba(255,255,255,0.1)'
                                : '#10b981',
                            color: '#fff'
                          }}
                        >
                          {loading ? 'Analisando...' : 'Finalizar Check-in'}
                        </button>
                      </motion.div>
                    )}

                    {step === 4 && (
                      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '16px 0' }}>
                        {risco === 'Alto risco' ? (
                          <>
                            <div
                              style={{
                                width: 76,
                                height: 76,
                                borderRadius: '50%',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '2px solid rgba(239, 68, 68, 0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px'
                              }}
                            >
                              <AlertTriangle size={38} color="#ef4444" />
                            </div>
                            <h3 style={{ fontSize: 22, fontWeight: 800, color: '#f87171', marginBottom: 10 }}>Atenção ao seu limite</h3>
                            <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 28 }}>
                              Seus resultados indicam um alto nível de sobrecarga. Sua saúde mental e bem-estar são prioridade!
                            </p>

                            {!querConversar ? (
                              <div style={{ background: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                                <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#f8fafc' }}>
                                  <MessageCircle size={18} /> Gostaria de agendar uma conversa com o RH?
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {['Presencial', 'Online', 'Sigiloso'].map(opt => (
                                    <button
                                      key={opt}
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
                                        padding: '13px',
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
                                    onClick={finish}
                                    style={{
                                      padding: '12px',
                                      borderRadius: 12,
                                      background: 'transparent',
                                      border: '1px solid rgba(255,255,255,0.1)',
                                      color: '#94a3b8',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      marginTop: 4
                                    }}
                                  >
                                    Não, obrigado
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ padding: 20, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 16, color: '#34d399', fontWeight: 600 }}>
                                Recebemos sua solicitação! Entraremos em contato com você em breve.
                              </div>
                            )}
                            {querConversar && (
                              <button onClick={finish} style={{ ...btnBaseStyle, marginTop: 24, background: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                                Fechar
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <div
                              style={{
                                width: 76,
                                height: 76,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                margin: '0 auto 20px',
                                background: risco === 'Atenção' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                border: risco === 'Atenção' ? '2px solid rgba(245, 158, 11, 0.3)' : '2px solid rgba(16, 185, 129, 0.3)'
                              }}
                            >
                              <CheckCircle2 size={38} color={risco === 'Atenção' ? '#fbbf24' : '#10b981'} />
                            </div>
                            <h3 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 10 }}>Obrigado pelo Check-in!</h3>
                            <p style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 28 }}>
                              {risco === 'Atenção'
                                ? 'Seu resultado indica que você precisa de um tempo para desacelerar. Lembre-se de cuidar do seu descanso!'
                                : 'Que ótimo saber que as coisas estão correndo bem! Continue acompanhando o seu bem-estar.'}
                            </p>
                            <button onClick={finish} style={{ ...btnBaseStyle, background: '#3b82f6', color: '#fff' }}>
                              Ir para o Sistema
                            </button>
                          </>
                        )}
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
