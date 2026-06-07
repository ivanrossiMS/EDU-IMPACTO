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
    <>
      <style>{`
        .fab-container {
          position: fixed;
          bottom: max(24px, env(safe-area-inset-bottom, 24px));
          right: max(24px, env(safe-area-inset-right, 24px));
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          pointer-events: none;
        }

        .fab-button {
          position: relative;
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, #43E97B 0%, #38D66B 50%, #25C45A 100%);
          border: 1px solid rgba(255, 255, 255, 0.4);
          box-shadow: 
            0 16px 32px rgba(37, 196, 90, 0.2), /* Sombra externa */
            0 0 24px rgba(37, 196, 90, 0.15),   /* Glow verde */
            inset 0 4px 6px rgba(255, 255, 255, 0.5), /* Reflexo superior */
            inset 0 -4px 6px rgba(0, 0, 0, 0.1);      /* Brilho interno suave */
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          pointer-events: auto;
          outline: none;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
          animation: floatAndGlow 3s ease-in-out infinite;
          -webkit-tap-highlight-color: transparent;
        }

        .fab-button::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          border-radius: 50%;
          border: 2px solid #38D66B;
          z-index: -1;
          animation: sonarPing 1.8s cubic-bezier(0.25, 0.8, 0.25, 1) infinite;
          pointer-events: none;
        }

        .fab-button.is-open::before {
          animation: none;
          display: none;
        }

        /* Reflexo superior brilhante estilo Apple/Glassmorphism */
        .fab-button::after {
          content: '';
          position: absolute;
          top: 0;
          left: 10%;
          width: 80%;
          height: 40%;
          background: linear-gradient(to bottom, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 100%);
          border-radius: 50% 50% 0 0;
          pointer-events: none;
        }

        .fab-button:hover {
          transform: scale(1.08) translateY(-2px);
          box-shadow: 
            0 24px 48px rgba(37, 196, 90, 0.4), 
            0 0 36px rgba(37, 196, 90, 0.4),
            inset 0 4px 6px rgba(255, 255, 255, 0.6),
            inset 0 -4px 6px rgba(0, 0, 0, 0.1);
          animation-play-state: paused;
        }

        .fab-button:hover::before {
          animation-play-state: paused;
          opacity: 0;
        }

        .fab-button:active {
          transform: scale(0.96) !important;
          transition: transform 0.1s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .fab-button.is-open {
          animation: none;
          transform: scale(0.9) rotate(90deg) !important;
          box-shadow: 
            0 8px 16px rgba(37, 196, 90, 0.15), 
            inset 0 2px 4px rgba(255, 255, 255, 0.3);
        }

        .fab-icon {
          width: 28px;
          height: 28px;
          color: white;
          z-index: 2;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
        }

        @keyframes floatAndGlow {
          0% {
            transform: translateY(0) scale(1);
            box-shadow: 0 16px 32px rgba(37, 196, 90, 0.2), 0 0 24px rgba(37, 196, 90, 0.15), inset 0 4px 6px rgba(255, 255, 255, 0.5), inset 0 -4px 6px rgba(0, 0, 0, 0.1);
          }
          50% {
            transform: translateY(-6px) scale(1.02);
            box-shadow: 0 24px 40px rgba(37, 196, 90, 0.35), 0 0 32px rgba(37, 196, 90, 0.25), inset 0 4px 6px rgba(255, 255, 255, 0.6), inset 0 -4px 6px rgba(0, 0, 0, 0.1);
          }
          100% {
            transform: translateY(0) scale(1);
            box-shadow: 0 16px 32px rgba(37, 196, 90, 0.2), 0 0 24px rgba(37, 196, 90, 0.15), inset 0 4px 6px rgba(255, 255, 255, 0.5), inset 0 -4px 6px rgba(0, 0, 0, 0.1);
          }
        }

        @keyframes sonarPing {
          0% {
            transform: scale(1);
            opacity: 1;
            border-width: 4px;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
            border-width: 0px;
          }
        }

        @media (max-width: 768px) {
          .fab-button {
            width: 56px;
            height: 56px;
          }
          .fab-icon {
            width: 24px;
            height: 24px;
          }
          .fab-container {
            bottom: max(110px, calc(110px + env(safe-area-inset-bottom, 0px)));
          }
        }
      `}</style>
      <div className="fab-container">
      
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
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" fill="currentColor" stroke="none" />
                    <path d="M22 12A10.002 10.002 0 0 0 12 2C6.5 2 2 6.5 2 12c0 1.7.4 3.4 1.2 4.9L2 22l5.1-1.2C8.6 21.6 10.3 22 12 22c5.5 0 10-4.5 10-10Z" fill="#128C7E" stroke="white" strokeWidth="1.5" />
                    <path d="M16.5 14.5c-.3.8-1.5 1.5-2.2 1.6-.6.1-1.3.2-3.8-1-3-1.4-4.9-4.5-5-4.7-.2-.2-1.2-1.6-1.2-3 0-1.4.7-2.1 1-2.4.3-.3.6-.4.9-.4.2 0 .5 0 .7.1.3.1.6.8.8 1.4.1.3.2.7.1 1-.1.3-.2.5-.4.7-.2.2-.4.5-.6.7-.1.1-.3.3-.1.6.2.3.8 1.4 1.8 2.3.1 0 .2.1.2.1 1.2.9 2.2 1.2 2.6 1.4.3.1.6.1.8-.1.2-.2.9-1.1 1.2-1.4.2-.4.5-.3.8-.2.3.1 2.1 1 2.5 1.2.3.2.5.3.6.5.1.4.1 1.1-.2 1.9Z" fill="white" stroke="none" />
                  </svg> 
                  Contatos do WhatsApp
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
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b', marginBottom: contato.setor ? 4 : (contato.descricao ? 2 : 0) }}>
                      {contato.nome}
                    </div>
                    {contato.setor && (
                      <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: '#e0e7ff', color: '#4338ca', fontWeight: 600, whiteSpace: 'nowrap', marginBottom: contato.descricao ? 4 : 0 }}>
                        {contato.setor}
                      </span>
                    )}
                    {contato.descricao && (
                      <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>{contato.descricao}</div>
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
        className={`fab-button ${isOpen ? 'is-open' : ''}`}
        aria-label="Contatos do WhatsApp"
        title="Falar no WhatsApp"
      >        
        {isOpen ? (
          <X className="fab-icon" style={{ transform: 'rotate(-90deg)', transition: 'transform 0.3s' }} />
        ) : (
          <svg className="fab-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
          </svg>
        )}
      </button>
      </div>
    </>
  )
}
