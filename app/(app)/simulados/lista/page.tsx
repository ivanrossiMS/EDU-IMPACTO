'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { FileText } from 'lucide-react'

export default function SimuladosListaPage() {
  return (
    <div style={{ padding: '40px 32px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Simulados</h1>
            <p style={{ color: 'hsl(var(--text-secondary))', margin: '2px 0 0', fontSize: 14 }}>Visualize e acompanhe os simulados disponíveis</p>
          </div>
        </div>

        <div style={{ 
          background: 'hsl(var(--bg-surface))', 
          border: '1px solid hsl(var(--border-subtle))', 
          borderRadius: 20, 
          padding: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center'
        }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <FileText size={32} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-primary))', margin: '0 0 8px' }}>Página em Construção</h2>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: 14, margin: 0, maxWidth: 400 }}>
            Esta página exibirá a lista de simulados disponíveis. Em breve você poderá acompanhar o desempenho e acessar mais informações.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
