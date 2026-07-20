'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { PieChart, Lock, CheckCircle2, AlertTriangle, Send } from 'lucide-react'
import { use } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'

export default function ResponderPesquisaPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id } = use(params)
  const { currentUser, hydrated } = useApp()
  
  const [pesquisa, setPesquisa] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // Respostas dinâmicas mapeadas por pergunta_id
  const [respostas, setRespostas] = useState<Record<string, any>>({})
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPesquisa()
  }, [])

  const fetchPesquisa = async () => {
    try {
      const res = await fetch(`/api/pesquisa/${id}`)
      if (res.ok) {
        const data = await res.json()
        setPesquisa(data)
      } else {
        setError('Pesquisa inválida ou não encontrada.')
      }
    } catch (e) {
      setError('Erro de conexão ao buscar dados.')
    } finally {
      setLoading(false)
    }
  }

  const handleRespostaChange = (perguntaId: string, valor: any) => {
    setRespostas(prev => ({ ...prev, [perguntaId]: valor }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError('')

    // Validate that all questions were answered
    for (const p of pesquisa.perguntas) {
      if (respostas[p.id] === undefined || respostas[p.id] === '') {
        setError(`A pergunta "${p.titulo}" é obrigatória.`)
        setIsSubmitting(false)
        return
      }
    }

    try {
      const res = await fetch(`/api/pesquisa/${id}/respostas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respostas_json: respostas,
          email: currentUser ? undefined : email,
          password: currentUser ? undefined : password
        })
      })

      const data = await res.json()

      if (res.ok) {
        setSucesso(true)
      } else {
        setError(data.error || 'Erro ao enviar respostas.')
      }
    } catch (e) {
      setError('Erro de conexão com o servidor.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>Carregando dados da pesquisa...</div>
  if (error && !pesquisa) return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>{error}</div>
  if (pesquisa?.status !== 'ativa') return <div style={{ padding: 40, textAlign: 'center', color: '#ef4444' }}>Esta pesquisa já foi encerrada e não aceita mais respostas.</div>

  if (sucesso) {
    return (
      <div style={{ minHeight: '100vh', padding: 40, background: '#f8fafc', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ background: '#fff', borderRadius: 24, padding: 60, textAlign: 'center', maxWidth: 500, boxShadow: '0 4px 40px rgba(0,0,0,0.02)' }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <CheckCircle2 size={40} />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>Respostas Enviadas com Sucesso!</h1>
          <p style={{ color: '#64748b', fontSize: 16, lineHeight: 1.6, marginBottom: 32 }}>Sua assinatura digital foi validada. Agradecemos a sua participação na construção de um ambiente melhor.</p>
          <button onClick={() => router.push('/')} style={{ padding: '12px 24px', background: '#f1f5f9', color: '#0f172a', borderRadius: 12, border: 'none', fontWeight: 700, cursor: 'pointer' }}>
            Voltar ao Início
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '60px 20px', 
      fontFamily: "'Inter', sans-serif", 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      position: 'relative',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #f0fdf4 0%, #e0e7ff 50%, #fdf2f8 100%)'
    }}>
      {/* Decorative Orbs */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '40vw', height: '40vw', background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', filter: 'blur(60px)', animation: 'float 8s infinite ease-in-out' }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)', filter: 'blur(60px)', animation: 'float 12s infinite ease-in-out reverse' }} />

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-30px) scale(1.05); }
        }
        .modern-input:focus {
          border-color: #6366f1 !important;
          box-shadow: 0 0 0 4px rgba(99,102,241,0.1) !important;
        }
        .modern-radio input:checked + span {
          color: #4f46e5 !important;
        }
      `}</style>

      {/* Header Logo */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ marginBottom: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, zIndex: 10 }}
      >
        <div style={{ 
          width: 80, height: 80, 
          background: 'rgba(255,255,255,0.7)', 
          backdropFilter: 'blur(10px)',
          borderRadius: 24, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.05)',
          border: '1px solid rgba(255,255,255,0.4)'
        }}>
          <img src="/logo-impacto.png" alt="IMPACTO EDU" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1e293b', letterSpacing: '0.05em' }}>IMPACTO EDU</h2>
          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sistema de Gestão Escolar</p>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
        style={{ 
          width: '100%', maxWidth: 740, 
          background: 'rgba(255, 255, 255, 0.85)', 
          backdropFilter: 'blur(24px)',
          borderRadius: 32, 
          padding: '48px 56px', 
          boxShadow: '0 20px 60px rgba(0,0,0,0.05), 0 1px 3px rgba(0,0,0,0.02)',
          border: '1px solid rgba(255, 255, 255, 1)',
          zIndex: 10
        }}
      >
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PieChart size={28} color="#4f46e5" strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a' }}>{pesquisa.titulo}</h1>
            <p style={{ margin: 0, fontSize: 14, color: '#64748b', marginTop: 4 }}>
              {pesquisa.tipo || 'Pesquisa de Clima Organizacional'} (Identificada)
            </p>
          </div>
        </div>

        {pesquisa.descricao && (
          <div style={{ marginBottom: 32, fontSize: 15, color: '#334155', lineHeight: 1.6, background: '#f8fafc', padding: 20, borderRadius: 16, border: '1px solid #e2e8f0' }}>
            {pesquisa.descricao}
          </div>
        )}

        <div style={{ background: '#fef2f2', padding: 20, borderRadius: 16, border: '1px solid #fecaca', marginBottom: 32, display: 'flex', gap: 12 }}>
          <AlertTriangle size={24} color="#ef4444" style={{ flexShrink: 0 }} />
          <div>
            <h4 style={{ margin: '0 0 4px 0', fontSize: 14, fontWeight: 700, color: '#991b1b' }}>Pesquisa Identificada e Assinada Digitalmente</h4>
            <p style={{ margin: 0, fontSize: 13, color: '#b91c1c', lineHeight: 1.5 }}>
              Para garantir a conformidade com as diretrizes do RH e validação legal, esta pesquisa registrará sua identidade e seu IP.
              {currentUser ? ' Sua assinatura será validada automaticamente através do seu login atual.' : ' Você precisará inserir suas credenciais de acesso no final da pesquisa para assiná-la.'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
          
          {pesquisa.perguntas?.map((pergunta: any, index: number) => (
            <motion.div 
              key={pergunta.id} 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + (index * 0.1) }}
              style={{ display: 'flex', flexDirection: 'column', gap: 16, background: 'rgba(255,255,255,0.5)', padding: 24, borderRadius: 20, border: '1px solid rgba(255,255,255,0.8)' }}
            >
              <label style={{ fontSize: 17, fontWeight: 700, color: '#1e293b', lineHeight: 1.4 }}>
                <span style={{ color: '#6366f1', marginRight: 8 }}>{index + 1}.</span> {pergunta.titulo}
              </label>
              
              {pergunta.tipo === 'texto' && (
                <textarea 
                  className="modern-input"
                  value={respostas[pergunta.id] || ''} 
                  onChange={e => handleRespostaChange(pergunta.id, e.target.value)}
                  placeholder="Digite sua resposta detalhada aqui..."
                  rows={4} 
                  style={{ width: '100%', padding: '16px 20px', borderRadius: 16, border: '1px solid #e2e8f0', background: '#fff', outline: 'none', resize: 'vertical', fontSize: 15, transition: 'all 0.2s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                />
              )}

              {pergunta.tipo === 'escala_10' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleRespostaChange(pergunta.id, n)}
                      style={{
                        width: 44, height: 44, borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                        background: respostas[pergunta.id] === n ? '#4f46e5' : '#fff',
                        color: respostas[pergunta.id] === n ? '#fff' : '#64748b',
                        border: respostas[pergunta.id] === n ? 'none' : '1px solid #cbd5e1'
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              
              {pergunta.tipo === 'escala_5' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[1,2,3,4,5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleRespostaChange(pergunta.id, n)}
                      style={{
                        width: 50, height: 50, borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                        background: respostas[pergunta.id] === n ? '#4f46e5' : '#fff',
                        color: respostas[pergunta.id] === n ? '#fff' : '#64748b',
                        border: respostas[pergunta.id] === n ? 'none' : '1px solid #cbd5e1'
                      }}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}

              {pergunta.tipo === 'sim_nao' && (
                <div style={{ display: 'flex', gap: 12 }}>
                  <button type="button" onClick={() => handleRespostaChange(pergunta.id, 'Sim')} style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', background: respostas[pergunta.id] === 'Sim' ? '#10b981' : '#fff', color: respostas[pergunta.id] === 'Sim' ? '#fff' : '#64748b', border: respostas[pergunta.id] === 'Sim' ? 'none' : '1px solid #cbd5e1' }}>Sim</button>
                  <button type="button" onClick={() => handleRespostaChange(pergunta.id, 'Não')} style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 700, cursor: 'pointer', background: respostas[pergunta.id] === 'Não' ? '#ef4444' : '#fff', color: respostas[pergunta.id] === 'Não' ? '#fff' : '#64748b', border: respostas[pergunta.id] === 'Não' ? 'none' : '1px solid #cbd5e1' }}>Não</button>
                </div>
              )}

              {pergunta.tipo === 'multipla_escolha' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {pergunta.opcoes?.map((op: string) => (
                    <label className="modern-radio" key={op} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', border: respostas[pergunta.id] === op ? '2px solid #6366f1' : '1px solid #e2e8f0', borderRadius: 16, cursor: 'pointer', background: respostas[pergunta.id] === op ? '#eef2ff' : '#fff', transition: 'all 0.2s', boxShadow: respostas[pergunta.id] === op ? '0 4px 12px rgba(99,102,241,0.1)' : '0 2px 4px rgba(0,0,0,0.01)' }}>
                      <input 
                        type="radio" 
                        name={`pergunta_${pergunta.id}`} 
                        checked={respostas[pergunta.id] === op} 
                        onChange={() => handleRespostaChange(pergunta.id, op)}
                        style={{ width: 20, height: 20, accentColor: '#6366f1', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: 15, fontWeight: respostas[pergunta.id] === op ? 700 : 500, color: '#334155', transition: 'all 0.2s' }}>{op}</span>
                    </label>
                  ))}
                </div>
              )}
            </motion.div>
          ))}

          {pesquisa.perguntas?.length === 0 && (
            <div style={{ color: '#64748b', fontStyle: 'italic' }}>Esta pesquisa não possui perguntas cadastradas.</div>
          )}

          {error && (
            <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, color: '#991b1b', fontSize: 14 }}>
              {error}
            </div>
          )}

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(!hydrated || !currentUser) && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                style={{ 
                  display: 'flex', flexDirection: 'column', gap: 20, 
                  background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)', 
                  padding: 32, borderRadius: 24, 
                  boxShadow: '0 12px 32px rgba(15, 23, 42, 0.2)',
                  position: 'relative', overflow: 'hidden'
                }}
              >
                <div style={{ position: 'absolute', top: -100, right: -100, width: 250, height: 250, background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -50, left: -50, width: 150, height: 150, background: 'radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)', borderRadius: '50%', pointerEvents: 'none' }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#f8fafc', fontWeight: 800, fontSize: 18, zIndex: 1 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                    <Lock size={20} />
                  </div>
                  Assinatura Digital de Segurança
                </div>
                
                <p style={{ color: '#94a3b8', fontSize: 14, marginTop: -10, zIndex: 1 }}>
                  Por exigência de conformidade, suas credenciais garantem a validade desta avaliação. Em pesquisas anônimas, seu usuário não é atrelado às respostas no relatório.
                </p>

                <label style={{ display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1 }}>
                  <input 
                    required
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Seu E-mail cadastrado"
                    style={{ width: '100%', padding: '16px 20px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', outline: 'none', fontSize: 15, transition: 'all 0.2s' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#818cf8'}
                    onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 8, zIndex: 1 }}>
                  <input 
                    required
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Sua Senha de Acesso"
                    style={{ width: '100%', padding: '16px 20px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', outline: 'none', fontSize: 15, transition: 'all 0.2s' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#818cf8'}
                    onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                </label>
              </motion.div>
            )}
            
            {hydrated && currentUser && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', alignItems: 'center', gap: 16, background: '#ecfdf5', border: '1px solid #10b981', padding: '20px 24px', borderRadius: 20 }}
              >
                <div style={{ padding: 10, background: '#10b981', color: '#fff', borderRadius: 12 }}>
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <div style={{ color: '#065f46', fontWeight: 800, fontSize: 16 }}>Assinatura Verificada</div>
                  <div style={{ color: '#047857', fontSize: 14 }}>Autenticado como <strong>{currentUser.nome}</strong>. Sua assinatura será validada automaticamente.</div>
                </div>
              </motion.div>
            )}

            <motion.button 
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              disabled={isSubmitting}
              type="submit" 
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                width: '100%', padding: '18px', 
                background: isSubmitting ? '#94a3b8' : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', 
                color: '#fff', border: 'none', borderRadius: 16,
                fontSize: 16, fontWeight: 700, cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                boxShadow: isSubmitting ? 'none' : '0 8px 20px rgba(99,102,241,0.3)',
                marginTop: 8
              }}
            >
              {isSubmitting ? 'Processando e Assinando...' : <><Send size={20} /> Enviar Respostas Seguras</>}
            </motion.button>
          </div>

        </form>
      </motion.div>
    </div>
  )
}
