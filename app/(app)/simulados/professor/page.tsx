'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, CheckCircle, Clock, Edit3 } from 'lucide-react'
import Link from 'next/link'

export default function AreaProfessorPage() {
  // Mock data for requests
  const [requisicoes] = useState([
    {
      id: '1',
      simulado: 'Simulado Geral 1º Bimestre',
      disciplina: 'Matemática',
      serie: '9º Ano',
      solicitadas: 10,
      enviadas: 4,
      status: 'pendente', // pendente, concluido
      prazo: '2026-07-10'
    },
    {
      id: '2',
      simulado: 'Prova de Recuperação',
      disciplina: 'Matemática',
      serie: '1ª Série EM',
      solicitadas: 5,
      enviadas: 5,
      status: 'concluido',
      prazo: '2026-06-30'
    }
  ])

  return (
    <div style={{ padding: '40px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16,185,129,0.2)' }}>
            <BookOpen size={24} color="#10b981" />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0, letterSpacing: '-0.02em' }}>Área do Professor</h1>
            <p style={{ color: 'hsl(var(--text-secondary))', margin: '4px 0 0', fontSize: 14 }}>Minhas requisições de questões</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {requisicoes.map(req => (
            <div key={req.id} style={{ 
              background: 'hsl(var(--bg-surface))', 
              border: `1px solid ${req.status === 'concluido' ? 'rgba(16,185,129,0.3)' : 'hsl(var(--border-subtle))'}`, 
              borderRadius: 20, 
              padding: 24,
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{req.disciplina} • {req.serie}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'hsl(var(--text-primary))', lineHeight: 1.3 }}>{req.simulado}</div>
                </div>
                {req.status === 'concluido' ? (
                  <div style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '4px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle size={12} /> CONCLUÍDO
                  </div>
                ) : (
                  <div style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', padding: '4px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={12} /> PENDENTE
                  </div>
                )}
              </div>

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: 'hsl(var(--text-muted))' }}>Progresso:</span>
                  <span style={{ color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{req.enviadas} de {req.solicitadas} questões</span>
                </div>
                <div style={{ height: 6, background: 'rgba(100, 116, 139, 0.2)', borderRadius: 100, overflow: 'hidden' }}>
                  <div style={{ 
                    height: '100%', 
                    background: req.enviadas >= req.solicitadas ? '#10b981' : '#3b82f6', 
                    width: `${(req.enviadas / req.solicitadas) * 100}%`,
                    borderRadius: 100
                  }} />
                </div>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Prazo: <strong style={{ color: 'hsl(var(--text-secondary))' }}>{req.prazo}</strong></div>
                
                {req.status !== 'concluido' && (
                  <Link href="/simulados/banco/nova" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                    <Edit3 size={14} /> Adicionar Questão
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

      </motion.div>
    </div>
  )
}
