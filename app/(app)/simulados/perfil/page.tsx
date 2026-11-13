'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, BookOpen, ShieldCheck } from 'lucide-react'
import MeuPerfilPage from '@/app/(app)/meu-perfil/page'

export default function SimuladosPerfilPage() {
  return (
    <div style={{ padding: '24px 20px 80px', minHeight: '100%' }}>
      {/* Top Breadcrumb / Quick Back Navigation */}
      <motion.div 
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        style={{ maxWidth: 980, margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}
      >
        <Link
          href="/simulados"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
            color: 'hsl(var(--text-secondary))',
            textDecoration: 'none',
            padding: '7px 14px',
            borderRadius: 10,
            background: 'hsl(var(--bg-surface))',
            border: '1px solid hsl(var(--border-subtle))',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#8b5cf6'
            e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)'
            e.currentTarget.style.transform = 'translateX(-2px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'hsl(var(--text-secondary))'
            e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
            e.currentTarget.style.transform = 'translateX(0)'
          }}
        >
          <ArrowLeft size={14} />
          <span>Voltar ao Módulo de Simulados</span>
        </Link>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>
          <BookOpen size={14} color="#f43f5e" />
          <span>Módulo Provas & Simulados</span>
          <span>•</span>
          <span style={{ color: '#a855f7', fontWeight: 600 }}>Perfil do Colaborador</span>
        </div>
      </motion.div>

      {/* Main Profile Component */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <MeuPerfilPage />
      </motion.div>
    </div>
  )
}
