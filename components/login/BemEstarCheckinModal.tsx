'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle2, ChevronRight, X, HeartPulse, BrainCircuit, Activity, AlertTriangle, MessageCircle } from 'lucide-react'

export function BemEstarCheckinModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [step, setStep] = useState(1) // 1 = Emoção, 2 = Motivos, 3 = Burnout, 4 = Resultado/Conversa
  const [emocao, setEmocao] = useState('')
  const [motivos, setMotivos] = useState<string[]>([])
  
  // Burnout responses: array of 5 numbers (1-5)
  const [burnoutRes, setBurnoutRes] = useState<number[]>([0, 0, 0, 0, 0])
  
  const [loading, setLoading] = useState(false)
  const [risco, setRisco] = useState('')
  const [querConversar, setQuerConversar] = useState('')

  const emocoes = [
    { label: 'Muito bem', emoji: '🙂', color: '#10b981' },
    { label: 'Bem', emoji: '😊', color: '#34d399' },
    { label: 'Regular', emoji: '😐', color: '#fbbf24' },
    { label: 'Cansado', emoji: '😟', color: '#f87171' },
    { label: 'Precisando conversar', emoji: '😞', color: '#ef4444' }
  ]

  const motivosList = ['Sobrecarga', 'Conflitos', 'Problemas pessoais', 'Dificuldade com equipe', 'Outro']

  const burnoutQuestions = [
    'Estou dormindo bem?',
    'Tenho energia para trabalhar?',
    'Tenho sentido ansiedade?',
    'Estou sobrecarregado?',
    'Consigo descansar?'
  ]

  const burnoutOptions = [
    { value: 1, label: 'Nada' },
    { value: 2, label: 'Pouco' },
    { value: 3, label: 'Médio' },
    { value: 4, label: 'Muito' },
    { value: 5, label: 'Totalmente' },
  ]
  
  // Invert score logic for questions 3 and 4 (Ansiedade and Sobrecarga)
  // If they say "Totalmente" (5) to Anxiety, it means 1 in our internal score (Bad).
  const getScore = (qIndex: number, val: number) => {
    if (qIndex === 2 || qIndex === 3) {
      // Ansiedade and Sobrecarga: 1 (Nada) is good (5), 5 (Totalmente) is bad (1)
      return 6 - val;
    }
    return val;
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const q1 = getScore(0, burnoutRes[0])
      const q2 = getScore(1, burnoutRes[1])
      const q3 = getScore(2, burnoutRes[2])
      const q4 = getScore(3, burnoutRes[3])
      const q5 = getScore(4, burnoutRes[4])

      const res = await fetch('/api/gestao-pessoas/checkin/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emocao_geral: emocao,
          motivos,
          burnout_q1: q1,
          burnout_q2: q2,
          burnout_q3: q3,
          burnout_q4: q4,
          burnout_q5: q5,
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
    // Finish checkin
    onClose()
  }

  const btnBaseStyle = {
    width: '100%', padding: '16px', borderRadius: '16px', fontWeight: 700, fontSize: '15px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    border: 'none', transition: 'all 0.2s', outline: 'none'
  }

  return (
    <Dialog.Root open={isOpen}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(8px)', zIndex: 99999 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                style={{
                  position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                  width: '90%', maxWidth: 500, background: '#1e293b', borderRadius: 24, padding: 32,
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', zIndex: 100000,
                  border: '1px solid rgba(255,255,255,0.1)', color: '#fff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <HeartPulse size={20} color="#fff" />
                    </div>
                    <div>
                      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Check-in de Bem-Estar</h2>
                      <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>Acompanhamento Semanal</p>
                    </div>
                  </div>
                  {/* Cannot close if it's mandatory, but if you want to allow them to close, uncomment the button */}
                </div>

                {step === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Como foi essa sua semana no ambiente de trabalho?</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {emocoes.map(e => (
                        <button key={e.label} onClick={() => { setEmocao(e.label); setStep(2); }}
                          style={{
                            padding: '16px', borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all 0.2s', color: '#fff', fontSize: 16, fontWeight: 600
                          }}
                          onMouseEnter={ev => ev.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                          onMouseLeave={ev => ev.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                        >
                          <span style={{ fontSize: 24 }}>{e.emoji}</span>
                          {e.label}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>O que mais influenciou sua semana?</h3>
                    <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>Selecione um ou mais motivos (opcional)</p>
                    
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
                      {motivosList.map(m => {
                        const isSel = motivos.includes(m)
                        return (
                          <button key={m} onClick={() => setMotivos(prev => isSel ? prev.filter(x => x !== m) : [...prev, m])}
                            style={{
                              padding: '12px 20px', borderRadius: 100, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                      <BrainCircuit size={24} color="#a78bfa" />
                      <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Autoavaliação de Burnout</h3>
                    </div>
                    <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>Responda rapidamente (leva menos de 2 minutos)</p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxHeight: '50vh', overflowY: 'auto', paddingRight: 8, paddingBottom: 24 }}>
                      {burnoutQuestions.map((q, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 16, border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>{q}</div>
                          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
                            {burnoutOptions.map(opt => (
                              <button key={opt.value} onClick={() => {
                                const newRes = [...burnoutRes]
                                newRes[i] = opt.value
                                setBurnoutRes(newRes)
                              }}
                                style={{
                                  flex: '1 0 auto', padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
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
                      ))}
                    </div>

                    <button disabled={loading || burnoutRes.includes(0)} onClick={handleSubmit} 
                      style={{ ...btnBaseStyle, marginTop: 16, background: (loading || burnoutRes.includes(0)) ? 'rgba(255,255,255,0.1)' : '#10b981', color: '#fff' }}>
                      {loading ? 'Analisando...' : 'Finalizar Check-in'}
                    </button>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center', padding: '20px 0' }}>
                    
                    {risco === 'Alto risco' ? (
                      <>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', border: '2px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                          <AlertTriangle size={40} color="#ef4444" />
                        </div>
                        <h3 style={{ fontSize: 24, fontWeight: 800, color: '#f87171', marginBottom: 12 }}>Atenção ao seu limite</h3>
                        <p style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 32 }}>
                          Seus resultados indicam um alto nível de sobrecarga. A sua saúde mental é prioridade.
                        </p>
                        
                        {!querConversar ? (
                          <div style={{ background: 'rgba(255,255,255,0.03)', padding: 24, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                            <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                              <MessageCircle size={18} /> Gostaria de conversar com o RH?
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                              {['Presencial', 'Online', 'Sigiloso'].map(opt => (
                                <button key={opt} onClick={async () => {
                                  setQuerConversar(opt)
                                  // we fire and forget another submit or just update in background
                                  await fetch('/api/gestao-pessoas/checkin/submit', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ emocao_geral: emocao, motivos, burnout_q1: getScore(0, burnoutRes[0]), burnout_q2: getScore(1, burnoutRes[1]), burnout_q3: getScore(2, burnoutRes[2]), burnout_q4: getScore(3, burnoutRes[3]), burnout_q5: getScore(4, burnoutRes[4]), quer_conversar: opt })
                                  })
                                }}
                                  style={{ padding: '14px', borderRadius: 12, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', fontWeight: 600, cursor: 'pointer' }}
                                >
                                  {opt}
                                </button>
                              ))}
                              <button onClick={finish} style={{ padding: '14px', borderRadius: 12, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontWeight: 600, cursor: 'pointer', marginTop: 8 }}>
                                Não, obrigado
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ padding: 20, background: 'rgba(16, 185, 129, 0.1)', borderRadius: 16, color: '#34d399', fontWeight: 600 }}>
                            Recebemos sua solicitação! Entraremos em contato em breve.
                          </div>
                        )}
                        {querConversar && (
                           <button onClick={finish} style={{ ...btnBaseStyle, marginTop: 32, background: 'rgba(255,255,255,0.1)', color: '#fff' }}>Fechar</button>
                        )}
                      </>
                    ) : (
                      <>
                        <div style={{ width: 80, height: 80, borderRadius: '50%', background: risco === 'Atenção' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', border: risco === 'Atenção' ? '2px solid rgba(245, 158, 11, 0.3)' : '2px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                          <CheckCircle2 size={40} color={risco === 'Atenção' ? '#fbbf24' : '#10b981'} />
                        </div>
                        <h3 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 12 }}>Obrigado pelo Check-in!</h3>
                        <p style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.6, marginBottom: 32 }}>
                          {risco === 'Atenção' ? 'Seu resultado indica que você precisa de um pouco mais de descanso. Tente desconectar-se no tempo livre!' : 'Que bom que as coisas estão indo bem! Continue cuidando de você.'}
                        </p>
                        <button onClick={finish} style={{ ...btnBaseStyle, background: '#3b82f6', color: '#fff' }}>
                          Ir para o Sistema
                        </button>
                      </>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
