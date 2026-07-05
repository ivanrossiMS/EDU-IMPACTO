'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, ChevronRight } from 'lucide-react'
import { useData } from '@/lib/dataContext'

interface AnoLetivoModalProps {
  onSelect: (ano: string) => void
}

export function AnoLetivoModal({ onSelect }: AnoLetivoModalProps) {
  const { cfgCalendarioLetivo = [] } = useData()
  const [isOpen, setIsOpen] = useState(true)

  const handleSelect = (ano: string) => {
    localStorage.setItem('simulados_ano_letivo', ano)
    setIsOpen(false)
    setTimeout(() => onSelect(ano), 300)
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
          background: 'rgba(15, 23, 42, 0.8)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: 24
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            background: 'hsl(var(--bg-app))',
            borderRadius: 24,
            width: '100%',
            maxWidth: 480,
            overflow: 'hidden',
            boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
            border: '1px solid hsl(var(--border-subtle))'
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
              Para qual ano letivo você deseja gerenciar os uploads de provas, simulados e redações?
            </p>
          </div>
          
          <div style={{ padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {cfgCalendarioLetivo.map((item: any) => (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelect(item.ano)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  padding: '16px 20px',
                  borderRadius: 16,
                  background: 'hsl(var(--bg-surface))',
                  border: '1px solid hsl(var(--border-subtle))',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#3b82f6'
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                  e.currentTarget.style.background = 'hsl(var(--bg-surface))'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: '#3b82f6' }}>{item.ano}</span>
                  </div>
                  <div>
                    <span style={{ display: 'block', fontSize: 16, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Ano de {item.ano}</span>
                    <span style={{ display: 'block', fontSize: 13, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>{item.status === 'Aberto' ? 'Ano letivo ativo' : 'Encerrado'}</span>
                  </div>
                </div>
                <ChevronRight size={20} color="hsl(var(--text-secondary))" />
              </motion.button>
            ))}

            {(!cfgCalendarioLetivo || cfgCalendarioLetivo.length === 0) && (
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
