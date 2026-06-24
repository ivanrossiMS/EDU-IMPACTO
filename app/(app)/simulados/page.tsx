'use client'

import { motion } from 'framer-motion'
import { LayoutDashboard, Users, PenTool, FileText, TrendingUp, AlertCircle, Calendar } from 'lucide-react'
import Link from 'next/link'

export default function SimuladosDashboard() {
  const cards = [
    { title: 'Provas Ativas', value: '4', icon: <PenTool size={24} color="#f43f5e" />, link: '/simulados/gerenciamento' },
    { title: 'Questões no Banco', value: '1.240', icon: <FileText size={24} color="#3b82f6" />, link: '/simulados/banco' },
    { title: 'Requisições Pendentes', value: '12', icon: <AlertCircle size={24} color="#f59e0b" />, link: '/simulados/gerenciamento' },
    { title: 'Bimestre Atual', value: '2º Bimestre', icon: <Calendar size={24} color="#10b981" />, link: '/simulados/cadastros/bimestres' },
  ]

  return (
    <div style={{ padding: '40px' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(190,18,60,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(244,63,94,0.2)' }}>
            <LayoutDashboard size={24} color="#f43f5e" />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Visão Geral</h1>
            <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Módulo de Geração e Gerenciamento de Simulados</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 40 }}>
          {cards.map((c, i) => (
            <Link href={c.link} key={i} style={{ textDecoration: 'none' }}>
              <div 
                style={{ 
                  background: 'hsl(var(--bg-surface))', 
                  border: '1px solid hsl(var(--border-subtle))', 
                  borderRadius: 20, 
                  padding: 24,
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.borderColor = 'hsl(var(--text-muted))'
                  e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}
              >
                <div>
                  <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.title}</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'hsl(var(--text-primary))', lineHeight: 1 }}>{c.value}</div>
                </div>
                {c.icon}
              </div>
            </Link>
          ))}
        </div>

        {/* Mais gráficos e status seriam adicionados aqui */}
        <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 20, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
          <TrendingUp size={48} color="hsl(var(--text-muted))" style={{ marginBottom: 16 }} />
          <h3 style={{ color: 'hsl(var(--text-primary))', fontSize: 20, margin: '0 0 8px' }}>Estatísticas em Breve</h3>
          <p style={{ color: 'hsl(var(--text-secondary))', margin: 0, textAlign: 'center', maxWidth: 400 }}>
            Conforme as provas forem geradas e os gabaritos corrigidos, gráficos de desempenho aparecerão aqui.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
