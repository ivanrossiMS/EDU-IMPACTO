'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, Heart, Star } from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'

const PERGUNTAS = [
  { id: 'q1', texto: 'Sinto que meu trabalho é valorizado pela instituição.' },
  { id: 'q2', texto: 'Tenho os recursos necessários para realizar minhas atividades.' },
  { id: 'q3', texto: 'O ambiente de trabalho é respeitoso e acolhedor.' },
]

export default function ResponderPesquisaPage({ params }: { params: { id: string } }) {
  const isMobile = useIsMobile()
  const [step, setStep] = useState(0)
  const [respostas, setRespostas] = useState<Record<string, number>>({})

  const handleSelect = (perguntaId: string, valor: number) => {
    setRespostas(prev => ({ ...prev, [perguntaId]: valor }))
    setTimeout(() => {
      if (step < PERGUNTAS.length) {
        setStep(s => s + 1)
      }
    }, 400)
  }

  if (step === PERGUNTAS.length) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 24, fontFamily: "'Inter', sans-serif" }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ background: '#fff', padding: 40, borderRadius: 24, textAlign: 'center', maxWidth: 400, boxShadow: '0 10px 40px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 80, height: 80, background: '#ecfdf5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <CheckCircle size={40} color="#10b981" />
          </div>
          <h2 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: 24 }}>Pesquisa Concluída!</h2>
          <p style={{ color: '#64748b', marginBottom: 0 }}>Muito obrigado pela sua participação. Sua opinião é fundamental para construirmos um ambiente de trabalho cada vez melhor.</p>
        </motion.div>
      </div>
    )
  }

  const perguntaAtual = PERGUNTAS[step]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Header Clima */}
      <div style={{ padding: 24, background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Heart size={24} color="#4f46e5" fill="#4f46e5" />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Pesquisa de Clima</h1>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? 16 : 40 }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          
          <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#64748b' }}>Pergunta {step + 1} de {PERGUNTAS.length}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {PERGUNTAS.map((_, i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i === step ? '#4f46e5' : i < step ? '#10b981' : '#e2e8f0' }} />
              ))}
            </div>
          </div>

          <motion.div 
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            style={{ background: '#fff', padding: isMobile ? 24 : 40, borderRadius: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}
          >
            <h2 style={{ margin: '0 0 32px 0', fontSize: 22, fontWeight: 700, color: '#0f172a', lineHeight: 1.4 }}>
              {perguntaAtual.texto}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { valor: 5, label: 'Concordo Totalmente', bg: '#ecfdf5', text: '#10b981', border: '#a7f3d0' },
                { valor: 4, label: 'Concordo Parcialmente', bg: '#f0fdf4', text: '#22c55e', border: '#bbf7d0' },
                { valor: 3, label: 'Neutro', bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
                { valor: 2, label: 'Discordo Parcialmente', bg: '#fff7ed', text: '#f97316', border: '#fed7aa' },
                { valor: 1, label: 'Discordo Totalmente', bg: '#fef2f2', text: '#ef4444', border: '#fecaca' },
              ].map(opt => (
                <button
                  key={opt.valor}
                  onClick={() => handleSelect(perguntaAtual.id, opt.valor)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '16px 20px', borderRadius: 16, border: `1px solid ${respostas[perguntaAtual.id] === opt.valor ? opt.border : '#e2e8f0'}`,
                    background: respostas[perguntaAtual.id] === opt.valor ? opt.bg : '#fff',
                    color: respostas[perguntaAtual.id] === opt.valor ? opt.text : '#475569',
                    fontSize: 16, fontWeight: respostas[perguntaAtual.id] === opt.valor ? 700 : 500,
                    cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left'
                  }}
                >
                  {opt.label}
                  {respostas[perguntaAtual.id] === opt.valor && <CheckCircle size={20} color={opt.text} />}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
