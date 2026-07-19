'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { ShieldAlert, AlertTriangle, Send, CheckCircle, Info } from 'lucide-react'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import { useApp } from '@/lib/context'

export default function NovaDenunciaPage() {
  const isMobile = useIsMobile()
  const { currentUser } = useApp()
  const [step, setStep] = useState(1)
  const [protocolo, setProtocolo] = useState('')

  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    tipo: 'assedio',
    descricao: '',
    data_ocorrencia: '',
    setor: '',
    envolvidos: '',
    anonimo: true
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const newProtocol = Math.random().toString(36).substring(2, 10).toUpperCase()
    
    try {
      const res = await fetch('/api/gestao-pessoas/denuncias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          protocolo: newProtocol,
          relator_id: formData.anonimo ? null : currentUser?.id,
          status: 'nova'
        })
      })
      if (res.ok) {
        setProtocolo(newProtocol)
        setStep(2)
      } else {
        alert('Erro ao registrar denúncia.')
      }
    } catch (err) {
      console.error(err)
      alert('Erro de conexão.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 2) {
    return (
      <div style={{ padding: isMobile ? 16 : 40, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', background: '#f8fafc' }}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ background: '#fff', padding: 40, borderRadius: 24, textAlign: 'center', maxWidth: 400, boxShadow: '0 10px 40px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 80, height: 80, background: '#ecfdf5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
            <CheckCircle size={40} color="#10b981" />
          </div>
          <h2 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: 24 }}>Denúncia Registrada</h2>
          <p style={{ color: '#64748b', marginBottom: 24 }}>Sua denúncia foi recebida de forma segura e sigilosa. Anote seu protocolo para acompanhamento futuro:</p>
          <div style={{ background: '#f1f5f9', padding: '16px', borderRadius: 12, fontSize: 28, fontWeight: 800, letterSpacing: '0.2em', color: '#0f172a', marginBottom: 32 }}>
            {protocolo}
          </div>
          <button onClick={() => setStep(1)} style={{ padding: '12px 24px', background: '#0f172a', color: '#fff', borderRadius: 12, border: 'none', fontWeight: 600, width: '100%', cursor: 'pointer' }}>
            Voltar
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100%', padding: isMobile ? 16 : 40, background: '#f8fafc', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        
        <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ShieldAlert size={28} color="#ef4444" strokeWidth={2.5} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>
              Canal de Denúncias
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: '#64748b', marginTop: 4 }}>
              Um ambiente seguro, sigiloso e sem retaliações.
            </p>
          </div>
        </div>

        <div style={{ background: '#fff', borderRadius: 24, padding: isMobile ? 24 : 40, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
          
          <div style={{ display: 'flex', gap: 12, padding: 16, background: '#fffbeb', borderRadius: 12, border: '1px solid #fef3c7', marginBottom: 32 }}>
            <Info size={24} color="#d97706" style={{ flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: 14, color: '#b45309', lineHeight: 1.5 }}>
              Sua identidade será preservada. Você pode optar por se identificar ou manter o relato 100% anônimo. Tratamos todas as denúncias com máxima seriedade e respeito.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Tipo de Denúncia *</label>
              <select 
                required
                value={formData.tipo}
                onChange={e => setFormData({...formData, tipo: e.target.value})}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 15, background: '#fff', color: '#0f172a' }}
              >
                <option value="assedio">Assédio (Moral ou Sexual)</option>
                <option value="fraude">Fraude ou Corrupção</option>
                <option value="conduta">Violação do Código de Conduta</option>
                <option value="seguranca">Risco à Segurança / SST</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Relato Detalhado *</label>
              <textarea 
                required
                rows={5}
                placeholder="Descreva o que aconteceu com o máximo de detalhes (o quê, quando, onde, como)..."
                value={formData.descricao}
                onChange={e => setFormData({...formData, descricao: e.target.value})}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 15, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 24 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Data da Ocorrência</label>
                <input 
                  type="date"
                  value={formData.data_ocorrencia}
                  onChange={e => setFormData({...formData, data_ocorrencia: e.target.value})}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 15 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Setor/Departamento Envolvido</label>
                <input 
                  type="text"
                  placeholder="Ex: Recepção, Coordenação..."
                  value={formData.setor}
                  onChange={e => setFormData({...formData, setor: e.target.value})}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 15 }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Pessoas Envolvidas</label>
              <input 
                type="text"
                placeholder="Nomes ou cargos das pessoas envolvidas no relato..."
                value={formData.envolvidos}
                onChange={e => setFormData({...formData, envolvidos: e.target.value})}
                style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 15 }}
              />
            </div>

            <div style={{ padding: 20, background: '#f8fafc', borderRadius: 16, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <input 
                type="checkbox" 
                id="anonimo"
                checked={formData.anonimo}
                onChange={e => setFormData({...formData, anonimo: e.target.checked})}
                style={{ width: 20, height: 20, marginTop: 2, cursor: 'pointer' }}
              />
              <div>
                <label htmlFor="anonimo" style={{ display: 'block', fontSize: 15, fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                  Quero fazer esta denúncia de forma anônima
                </label>
                <p style={{ margin: '4px 0 0 0', fontSize: 14, color: '#64748b' }}>
                  {formData.anonimo 
                    ? "Sua identidade não será enviada ao Comitê de Ética." 
                    : `Sua denúncia será registrada em nome de ${currentUser?.nome || 'você'}.`}
                </p>
              </div>
            </div>

            <button 
              type="submit"
              disabled={!formData.descricao || loading}
              style={{
                marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                padding: '16px', background: formData.descricao ? '#ef4444' : '#fca5a5', color: '#fff',
                border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: formData.descricao ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s', opacity: loading ? 0.7 : 1
              }}
            >
              <Send size={20} /> {loading ? 'Enviando...' : 'Enviar Denúncia'}
            </button>

          </form>
        </div>

      </div>
    </div>
  )
}
