'use client'

import React, { useEffect, useState } from 'react'
import { Users, Activity, ShieldAlert, GraduationCap, ArrowRight, HeartPulse, Building2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function GestaoPessoasDashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({
    colaboradores: 0,
    pendenciasSST: 0,
    planosAcao: 0,
    atendimentos: 0,
    riscosMapeados: 0
  })

  useEffect(() => {
    // Buscar KPIs
    Promise.all([
      fetch('/api/gestao-pessoas/riscos').then(res => res.ok ? res.json() : []),
      fetch('/api/gestao-pessoas/plano-acao').then(res => res.ok ? res.json() : []),
      fetch('/api/gestao-pessoas/atendimentos').then(res => res.ok ? res.json() : []),
      fetch('/api/rh/funcionarios').then(res => res.ok ? res.json() : [])
    ]).then(([riscos, acoes, atendimentos, funcs]) => {
      setStats({
        colaboradores: Array.isArray(funcs) ? funcs.length : 0,
        riscosMapeados: Array.isArray(riscos) ? riscos.length : 0,
        planosAcao: Array.isArray(acoes) ? acoes.filter((a: any) => a.status !== 'Concluído').length : 0,
        atendimentos: Array.isArray(atendimentos) ? atendimentos.length : 0,
        pendenciasSST: 2 // Mock de pendências PCMSO/PGR
      })
    }).catch(console.error)
  }, [])

  const cards = [
    { label: 'Colaboradores Ativos', value: stats.colaboradores, icon: Users, color: '#3b82f6', bg: '#eff6ff', link: '/gestao-pessoas/colaboradores' },
    { label: 'Riscos (PGR)', value: stats.riscosMapeados, icon: ShieldAlert, color: '#f59e0b', bg: '#fffbeb', link: '/gestao-pessoas/inventario-riscos' },
    { label: 'Ações Pendentes', value: stats.planosAcao, icon: Activity, color: '#8b5cf6', bg: '#f5f3ff', link: '/gestao-pessoas/plano-acao' },
    { label: 'Atendimentos / ASO', value: stats.atendimentos, icon: HeartPulse, color: '#ec4899', bg: '#fdf2f8', link: '/gestao-pessoas/atendimentos' }
  ]

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1400, margin: '0 auto' }}>
      
      {/* Header Premium */}
      <div style={{ marginBottom: 40, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eff6ff', color: '#1d4ed8', padding: '6px 12px', borderRadius: 100, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            <Building2 size={16} /> Gestão de Capital Humano
          </div>
          <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 40, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 8, lineHeight: 1.1 }}>
            Visão Geral e SST
          </h1>
          <p style={{ fontSize: 16, color: '#64748b', maxWidth: 600 }}>
            Monitoramento em tempo real dos colaboradores, controle de segurança do trabalho (NR-01, NR-07) e saúde corporativa.
          </p>
        </div>
      </div>

      {/* Metric Cards - Premium Hover */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, marginBottom: 40 }}>
        {cards.map((c, i) => (
          <div key={i} onClick={() => router.push(c.link)} style={{ 
            background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 28, 
            cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-6px)'; e.currentTarget.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'; e.currentTarget.style.borderColor = c.color }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)'; e.currentTarget.style.borderColor = '#e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: c.bg, color: c.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <c.icon size={28} strokeWidth={2.5} />
              </div>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ArrowRight size={20} color="#94a3b8" />
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: '#0f172a', fontFamily: "'Outfit', sans-serif", lineHeight: 1 }}>{c.value}</div>
              <div style={{ fontSize: 15, color: '#64748b', fontWeight: 600, marginTop: 8 }}>{c.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Sections Wrapper */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Atividades Recentes */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 24, padding: 32, boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 24 }}>Atividades Recentes</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 14, color: '#94a3b8', textAlign: 'center', padding: '40px 0', background: '#f8fafc', borderRadius: 16 }}>
              Nenhuma atividade de risco mapeada nas últimas 24h.
            </div>
          </div>
        </div>

        {/* Alertas Críticos */}
        <div style={{ background: 'linear-gradient(135deg, #fff1f2, #ffe4e6)', border: '1px solid #fecdd3', borderRadius: 24, padding: 32, boxShadow: '0 10px 15px -3px rgba(225, 29, 72, 0.1)' }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: 22, fontWeight: 800, color: '#9f1239', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', display: 'inline-block', boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.2)' }}></span>
            Atenção Imediata
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
             {/* Mock data for visual appeal */}
             <div style={{ background: '#fff', padding: 16, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
               <div>
                 <strong style={{ color: '#0f172a', display: 'block', marginBottom: 4 }}>ASO Vencido: Maria Souza</strong>
                 <span style={{ color: '#64748b', fontSize: 13 }}>Vencido há 5 dias</span>
               </div>
               <button onClick={() => router.push('/gestao-pessoas/atendimentos')} style={{ padding: '8px 16px', background: '#fee2e2', color: '#e11d48', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Ver</button>
             </div>
             <div style={{ background: '#fff', padding: 16, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
               <div>
                 <strong style={{ color: '#0f172a', display: 'block', marginBottom: 4 }}>Risco Crítico Identificado</strong>
                 <span style={{ color: '#64748b', fontSize: 13 }}>Cozinha - Risco de Queimadura (P5 x S4)</span>
               </div>
               <button onClick={() => router.push('/gestao-pessoas/inventario-riscos')} style={{ padding: '8px 16px', background: '#fee2e2', color: '#e11d48', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Analisar</button>
             </div>
          </div>
        </div>
      </div>

    </div>
  )
}
