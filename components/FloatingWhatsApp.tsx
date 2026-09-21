'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  X, 
  Phone, 
  CreditCard, 
  FileText, 
  MessageSquare, 
  GraduationCap, 
  Sparkles,
  ArrowUpRight
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgendaDigital } from '@/lib/agendaDigitalContext'
import { getWhatsAppShareUrl } from '@/lib/whatsapp'

function getSectorMeta(setor?: string) {
  const s = (setor || '').toLowerCase()
  if (s.includes('finan') || s.includes('mensal')) {
    return {
      Icon: CreditCard,
      bg: '#ecfdf5',
      color: '#059669',
      border: '#a7f3d0',
      label: 'Financeiro'
    }
  }
  if (s.includes('secret')) {
    return {
      Icon: FileText,
      bg: '#f0f9ff',
      color: '#0284c7',
      border: '#bae6fd',
      label: 'Secretaria'
    }
  }
  if (s.includes('baby')) {
    return {
      Icon: Sparkles,
      bg: '#fdf2f8',
      color: '#db2777',
      border: '#fbcfe8',
      label: 'Baby'
    }
  }
  if (s.includes('recep') || s.includes('atend')) {
    return {
      Icon: MessageSquare,
      bg: '#fffbeb',
      color: '#d97706',
      border: '#fde68a',
      label: 'Recepção'
    }
  }
  if (s.includes('coord') || s.includes('pedag') || s.includes('infantil') || s.includes('fund') || s.includes('médio')) {
    return {
      Icon: GraduationCap,
      bg: '#f5f3ff',
      color: '#7c3aed',
      border: '#ddd6fe',
      label: 'Coordenação'
    }
  }
  return {
    Icon: Phone,
    bg: '#ecfdf5',
    color: '#059669',
    border: '#a7f3d0',
    label: 'WhatsApp'
  }
}

export function FloatingWhatsApp() {
  const { adConfig } = useAgendaDigital()
  const [isOpen, setIsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Fechar ao clicar fora
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  if (!mounted) return null

  const contatosAtivos = (adConfig?.contatosWhatsapp || [])
    .filter(c => c.ativo)
    .sort((a, b) => a.ordem - b.ordem)

  if (contatosAtivos.length === 0) {
    return null
  }

  const handleWhatsAppClick = (telefoneOriginal: string) => {
    window.open(getWhatsAppShareUrl(telefoneOriginal), '_blank')
  }

  return (
    <>
      <style>{`
        .dock-container {
          position: fixed;
          bottom: max(24px, env(safe-area-inset-bottom, 24px));
          right: max(24px, env(safe-area-inset-right, 24px));
          z-index: 9999;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          pointer-events: none;
        }

        .dock-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .dock-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .dock-scroll::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.35);
          border-radius: 999px;
        }
        .dock-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.55);
        }

        @keyframes dockPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.45; transform: scale(1.2); }
        }

        .dock-pulse {
          animation: dockPulse 2s infinite ease-in-out;
        }

        .fab-button-lux {
          position: relative;
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 28%, #34d399 0%, #10b981 55%, #059669 100%);
          border: 1px solid rgba(255, 255, 255, 0.45);
          box-shadow: 
            0 14px 28px -4px rgba(16, 185, 129, 0.38),
            0 0 20px rgba(16, 185, 129, 0.22),
            inset 0 3px 5px rgba(255, 255, 255, 0.6),
            inset 0 -3px 5px rgba(0, 0, 0, 0.12);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          pointer-events: auto;
          outline: none;
          transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
          -webkit-tap-highlight-color: transparent;
        }

        .fab-button-lux::after {
          content: '';
          position: absolute;
          top: 0;
          left: 12%;
          width: 76%;
          height: 42%;
          background: linear-gradient(to bottom, rgba(255,255,255,0.65) 0%, rgba(255,255,255,0) 100%);
          border-radius: 50% 50% 0 0;
          pointer-events: none;
        }

        .fab-button-lux:hover {
          transform: scale(1.07) translateY(-2px);
          box-shadow: 
            0 20px 36px -4px rgba(16, 185, 129, 0.45),
            0 0 28px rgba(16, 185, 129, 0.35),
            inset 0 3px 5px rgba(255, 255, 255, 0.7),
            inset 0 -3px 5px rgba(0, 0, 0, 0.12);
        }

        .fab-button-lux:active {
          transform: scale(0.95) !important;
        }

        .fab-button-lux.is-open {
          transform: scale(0.92) !important;
          box-shadow: 
            0 8px 18px rgba(16, 185, 129, 0.25),
            inset 0 2px 4px rgba(255, 255, 255, 0.4);
        }

        .fab-icon-lux {
          width: 26px;
          height: 26px;
          color: white;
          z-index: 2;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.15));
        }

        @media (max-width: 768px) {
          .fab-button-lux {
            width: 48px;
            height: 48px;
          }
          .fab-icon-lux {
            width: 22px;
            height: 22px;
          }
          .dock-container {
            bottom: max(95px, calc(95px + env(safe-area-inset-bottom, 0px)));
            right: 16px;
          }
        }
      `}</style>

      <div ref={containerRef} className="dock-container">
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.94 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              style={{
                width: 255,
                marginBottom: 10,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}
            >
              {/* Top Dynamic Pill Header */}
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 12px 7px 14px',
                  borderRadius: 9999,
                  background: 'rgba(15, 23, 42, 0.92)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: '0 8px 24px -4px rgba(0, 0, 0, 0.25)',
                  color: 'white'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7.5 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: '#34d399',
                      boxShadow: '0 0 8px #34d399'
                    }}
                    className="dock-pulse"
                  />
                  <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.02em', color: '#f8fafc' }}>
                    Canais de Atendimento
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 20,
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.7)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#ffffff'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  }}
                  title="Fechar"
                  aria-label="Fechar"
                >
                  <X size={12} strokeWidth={2.5} />
                </button>
              </motion.div>

              {/* Stack of Floating Tactile Pills */}
              <div
                className="dock-scroll"
                style={{
                  maxHeight: 'min(360px, 58vh)',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  paddingRight: 2,
                  paddingLeft: 2
                }}
              >
                {contatosAtivos.map((contato, index) => {
                  const meta = getSectorMeta(contato.setor || contato.nome)
                  const SectorIcon = meta.Icon
                  const primaryText = contato.setor || contato.nome
                  const secondaryText = contato.setor ? contato.nome : (contato.descricao || 'WhatsApp')

                  return (
                    <motion.button
                      key={contato.id}
                      onClick={() => handleWhatsAppClick(contato.telefone)}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.035, duration: 0.2 }}
                      whileHover={{ x: -4 }}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(16px)',
                        WebkitBackdropFilter: 'blur(16px)',
                        border: '1px solid rgba(226, 232, 240, 0.85)',
                        borderRadius: 18,
                        boxShadow: '0 4px 12px -2px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'box-shadow 0.2s, border-color 0.2s, background-color 0.2s',
                        outline: 'none'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = 'rgba(52, 211, 153, 0.7)'
                        e.currentTarget.style.backgroundColor = '#ffffff'
                        e.currentTarget.style.boxShadow = '0 8px 20px -4px rgba(16, 185, 129, 0.2), 0 2px 6px -1px rgba(0, 0, 0, 0.04)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.85)'
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.95)'
                        e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: meta.bg,
                            color: meta.color,
                            border: `1px solid ${meta.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <SectorIcon size={16} strokeWidth={2.2} />
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: '#0f172a',
                              lineHeight: 1.15,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {primaryText}
                          </div>
                          <div
                            style={{
                              fontSize: 9.5,
                              fontWeight: 500,
                              color: '#64748b',
                              marginTop: 1.5,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {secondaryText}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'rgba(16, 185, 129, 0.1)',
                          color: '#059669',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginLeft: 6,
                          transition: 'all 0.15s'
                        }}
                      >
                        <ArrowUpRight size={13} strokeWidth={2.5} />
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`fab-button-lux ${isOpen ? 'is-open' : ''}`}
          aria-label="Contatos do WhatsApp"
          title="Falar no WhatsApp"
        >
          {isOpen ? (
            <X className="fab-icon-lux" style={{ strokeWidth: 2.5 }} />
          ) : (
            <svg className="fab-icon-lux" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
            </svg>
          )}
        </button>
      </div>
    </>
  )
}
