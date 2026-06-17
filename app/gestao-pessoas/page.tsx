'use client'

import React, { useEffect, useState } from 'react'
import { Users, Activity, ShieldAlert, GraduationCap, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function GestaoPessoasDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({
    colaboradores: 0,
    pendenciasSST: 0,
    planosAcao: 0,
    atendimentos: 0
  })

  useEffect(() => {
    // Buscar pendências
    fetch('/api/gestao-pessoas/pendencias-badge')
      .then(res => res.ok ? res.json() : { pendencias: 0 })
      .then(data => {
        setStats(s => ({ ...s, atendimentos: data.pendencias || 0 }))
      })
      .catch(console.error)

    // Simulando busca do número de colaboradores (ideal seria uma chamada à API)
    fetch('/api/rh/funcionarios')
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setStats(s => ({ ...s, colaboradores: Array.isArray(data) ? data.length : 0 }))
      })
      .catch(console.error)
  }, [])

  const cards = [
    { label: 'Colaboradores Ativos', value: stats.colaboradores, icon: Users, color: '#3b82f6', link: '/gestao-pessoas/colaboradores' },
    { label: 'Pendências NR-01', value: stats.pendenciasSST, icon: ShieldAlert, color: '#ef4444', link: '/gestao-pessoas/sst' },
    { label: 'Ações em Aberto', value: stats.planosAcao, icon: Activity, color: '#f59e0b', link: '/gestao-pessoas/plano-acao' },
    { label: 'Atendimentos', value: stats.atendimentos, icon: GraduationCap, color: '#8b5cf6', link: '/gestao-pessoas/atendimentos' }
  ]

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 32, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Visão Geral
          </h1>
          <p style={{ fontSize: 15, color: '#64748b' }}>
            Monitoramento em tempo real do Capital Humano e Segurança do Trabalho.
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 40 }}>
        {cards.map((c, i) => (
          <div key={i} onClick={() => router.push(c.link)} style={{ 
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 24, 
            cursor: 'pointer', transition: 'all 0.3s', display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 16, background: `${c.color}22`, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <c.icon size={24} />
              </div>
              <ArrowRight size={20} color="#cbd5e1" />
            </div>
            <div>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#0f172a', fontFamily: "'Outfit', sans-serif" }}>{c.value}</div>
              <div style={{ fontSize: 14, color: '#64748b', fontWeight: 600 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Sections Wrapper */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Atividades Recentes */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 32, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>Atividades Recentes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', padding: '40px 0' }}>
              Nenhuma atividade registrada nos últimos dias.
            </div>
          </div>
        </div>

        {/* Alertas de Vencimento (ASO, Treinamentos) */}
        <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 24, padding: 32, boxShadow: '0 4px 6px -1px rgba(225, 29, 72, 0.05)' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 20, fontWeight: 800, color: '#9f1239', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
            Alertas de Vencimento
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, color: '#be123c', textAlign: 'center', padding: '40px 0', opacity: 0.7 }}>
              Nenhum documento ou treinamento vencendo nos próximos 30 dias.
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
