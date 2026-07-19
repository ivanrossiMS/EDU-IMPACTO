'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Lock, CheckCircle, ShieldCheck } from 'lucide-react'

type Props = {
  isOpen: boolean
  onClose: () => void
  onSign: (senha: string) => Promise<boolean>
  title: string
  subtitle?: string
}

export function AssinaturaDigitalModal({ isOpen, onClose, onSign, title, subtitle }: Props) {
  const [senha, setSenha] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const isSuccess = await onSign(senha)
      if (isSuccess) {
        setSuccess(true)
        setTimeout(() => {
          onClose()
          setSuccess(false)
          setSenha('')
        }, 2000)
      } else {
        setError('Senha incorreta. Tente novamente.')
      }
    } catch (e) {
      setError('Erro ao processar assinatura.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)',
      padding: 16, fontFamily: "'Inter', sans-serif"
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        style={{
          width: '100%', maxWidth: 420, background: '#fff',
          borderRadius: 24, padding: 32, position: 'relative',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 24, right: 24,
            background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8'
          }}
        >
          <X size={24} />
        </button>

        {success ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ width: 64, height: 64, background: '#ecfdf5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
              <CheckCircle size={32} color="#10b981" />
            </div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Assinado Eletronicamente</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>Seu aceite foi registrado com sucesso.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={24} color="#3b82f6" />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Assinatura Digital</h2>
                <p style={{ margin: 0, fontSize: 13, color: '#64748b', marginTop: 2 }}>Registro seguro e inalterável</p>
              </div>
            </div>

            <div style={{ marginBottom: 24, background: '#f8fafc', padding: 16, borderRadius: 12, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>Documento / Ação</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>{title}</div>
              {subtitle && <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{subtitle}</div>}
            </div>

            <form onSubmit={handleSign}>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>Confirme sua Senha</label>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} color="#94a3b8" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="password"
                    required
                    value={senha}
                    onChange={e => setSenha(e.target.value)}
                    placeholder="Sua senha de acesso atual"
                    style={{
                      width: '100%', padding: '14px 16px 14px 44px', borderRadius: 12,
                      border: `1px solid ${error ? '#ef4444' : '#cbd5e1'}`, outline: 'none',
                      fontSize: 15, transition: 'all 0.2s'
                    }}
                    onFocus={e => { if(!error) e.currentTarget.style.borderColor = '#3b82f6' }}
                    onBlur={e => { if(!error) e.currentTarget.style.borderColor = '#cbd5e1' }}
                  />
                </div>
                {error && <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 500, marginTop: 8 }}>{error}</div>}
              </div>

              <button
                type="submit"
                disabled={loading || !senha}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, background: '#0f172a',
                  color: '#fff', border: 'none', fontSize: 15, fontWeight: 700, cursor: (loading || !senha) ? 'not-allowed' : 'pointer',
                  opacity: (loading || !senha) ? 0.7 : 1, transition: 'opacity 0.2s'
                }}
              >
                {loading ? 'Processando...' : 'Assinar Documento'}
              </button>
              
              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.4 }}>
                Ao confirmar, você assina digitalmente este documento, sendo registrado seu IP, data e hora com validade legal e probatória.
              </div>
            </form>
          </>
        )}
      </motion.div>
    </div>
  )
}
