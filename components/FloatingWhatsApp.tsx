'use client'

import React, { useState, useEffect } from 'react'
import { MessageCircle, X, ChevronRight, Phone } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'

export function FloatingWhatsApp() {
  const { adConfig } = useAgendaDigital()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const contatosAtivos = (adConfig?.contatosWhatsapp || [])
    .filter(c => c.ativo)
    .sort((a, b) => a.ordem - b.ordem)

  if (contatosAtivos.length === 0) {
    return null
  }

  const handleWhatsAppClick = (telefoneOriginal: string) => {
    // Remove tudo que não for número
    let numero = telefoneOriginal.replace(/\D/g, '')
    // Adiciona código do Brasil se não tiver
    if (!numero.startsWith('55') && numero.length >= 10) {
      numero = '55' + numero
    }
    window.open(`https://wa.me/${numero}`, '_blank')
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', pointerEvents: 'none' }}>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ 
              marginBottom: 16, 
              background: '#ffffff', 
              borderRadius: 16, 
              boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2), 0 0 10px rgba(0,0,0,0.05)', 
              width: 320, 
              overflow: 'hidden',
              pointerEvents: 'auto',
              border: '1px solid rgba(0,0,0,0.05)'
            }}
          >
            <div style={{ background: 'linear-gradient(135deg, #128C7E, #075E54)', padding: '20px', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MessageCircle size={18} fill="currentColor" /> Contatos Rápidos
                </h3>
                <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>Como podemos ajudar? Selecione um setor abaixo.</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer', flexShrink: 0 }}
              >
                <X size={16} />
              </button>
            </div>
            
            <div style={{ padding: '12px', maxHeight: '60vh', overflowY: 'auto' }} className="no-scrollbar">
              {contatosAtivos.map(contato => (
                <button 
                  key={contato.id}
                  onClick={() => handleWhatsAppClick(contato.telefone)}
                  style={{ 
                    width: '100%', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 12, 
                    padding: '16px', 
                    background: '#f8fafc', 
                    border: '1px solid #e2e8f0', 
                    borderRadius: 12, 
                    marginBottom: 8,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'left'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#f0fdf4'
                    e.currentTarget.style.borderColor = '#bbf7d0'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#f8fafc'
                    e.currentTarget.style.borderColor = '#e2e8f0'
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Phone size={20} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{contato.nome}</div>
                      {contato.setor && (
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: '#e0e7ff', color: '#4338ca', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {contato.setor}
                        </span>
                      )}
                    </div>
                    {contato.descricao ? (
                      <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contato.descricao}</div>
                    ) : (
                      <div style={{ fontSize: 13, color: '#64748b' }}>{contato.telefone}</div>
                    )}
                  </div>
                  <ChevronRight size={18} color="#cbd5e1" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: '#25D366',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 14px rgba(37, 211, 102, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          pointerEvents: 'auto',
          transition: 'transform 0.2s, background-color 0.2s',
          transform: isOpen ? 'scale(0.9)' : 'scale(1)',
        }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#1ebc5b'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#25D366'}
      >
        {isOpen ? <X size={28} /> : <MessageCircle size={32} fill="white" />}
      </button>
    </div>
  )
}
