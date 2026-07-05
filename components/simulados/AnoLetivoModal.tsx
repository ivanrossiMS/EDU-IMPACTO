'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, ChevronDown } from 'lucide-react'
import { useData } from '@/lib/dataContext'

interface AnoLetivoModalProps {
  onSelect: (ano: string) => void
}

export function AnoLetivoModal({ onSelect }: AnoLetivoModalProps) {
  const { cfgCalendarioLetivo = [] } = useData()
  const [isOpen, setIsOpen] = useState(true)
  
  // Ordena para que o mais recente (maior ano) seja o primeiro
  const anosOrdenados = [...cfgCalendarioLetivo].sort((a: any, b: any) => parseInt(b.ano) - parseInt(a.ano))
  const ultimoAno = anosOrdenados[0]?.ano || ''
  
  const [selectedAno, setSelectedAno] = useState(ultimoAno)

  useEffect(() => {
    if (!selectedAno && ultimoAno) setSelectedAno(ultimoAno)
  }, [ultimoAno, selectedAno])

  const handleConfirm = () => {
    if (!selectedAno) return
    setIsOpen(false)
    setTimeout(() => onSelect(String(selectedAno)), 300)
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 24
        }}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            background: 'hsl(var(--bg-surface))', // Fundo mais claro/destacado do que o fundo do app
            borderRadius: 24,
            width: '100%',
            maxWidth: 420,
            overflow: 'hidden',
            boxShadow: '0 32px 64px rgba(0,0,0,0.3), 0 0 0 1px hsl(var(--border-subtle))', // Sombra forte para destacar
          }}
        >
          <div style={{ padding: '32px 32px 24px', textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'linear-gradient(135deg, #3b82f6 0%, #2dd4bf 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(59, 130, 246, 0.3)' }}>
              <Calendar size={32} color="#fff" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 8, letterSpacing: '-0.02em' }}>
              Selecione o Ano Letivo
            </h2>
            <p style={{ fontSize: 15, color: 'hsl(var(--text-secondary))', lineHeight: 1.5 }}>
              Escolha para qual ano deseja visualizar provas, simulados e redações.
            </p>
          </div>
          
          <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {cfgCalendarioLetivo.length > 0 ? (
              <>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedAno}
                    onChange={e => setSelectedAno(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '16px 20px',
                      borderRadius: 16,
                      background: 'hsl(var(--bg-app))', // Fundo escuro para o select fazer contraste
                      border: '1px solid hsl(var(--border-subtle))',
                      color: 'hsl(var(--text-primary))',
                      fontSize: 16,
                      fontWeight: 600,
                      outline: 'none',
                      cursor: 'pointer',
                      appearance: 'none',
                      transition: 'all 0.2s',
                    }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = '#3b82f6'
                      e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.1)'
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    {anosOrdenados.map((item: any) => (
                      <option key={item.id} value={item.ano}>Ano de {item.ano} {item.status === 'Aberto' ? '(Ativo)' : ''}</option>
                    ))}
                  </select>
                  <ChevronDown size={20} style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-secondary))', pointerEvents: 'none' }} />
                </div>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirm}
                  style={{
                    width: '100%',
                    padding: '16px',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                  }}
                >
                  Continuar
                </motion.button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'hsl(var(--text-secondary))', fontSize: 14 }}>
                Nenhum ano letivo configurado no ERP.
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
