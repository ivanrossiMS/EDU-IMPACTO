'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useState, useEffect } from 'react'
import { useAgendaDigital, ADComunicado } from '@/lib/agendaDigitalContext'

import { useData } from '@/lib/dataContext'
import { 
  Send, Eye, MessageCircle, AlertCircle, FileCheck, DollarSign,
  Users, UserCheck
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'

export default function ADAdminDashboard() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { comunicados } = useAgendaDigital()
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [titulos, setTitulos] = useSupabaseArray<any>('titulos');

  const alunosAtivos = (alunos || []).filter(a => a.status === 'matriculado' || a.status === 'ativo')
  
  // Metrics calculation
  const totalComunicados = comunicados.length
  let totalLeituras = 0
  let expectedLeituras = 0
  
  comunicados.forEach((c: ADComunicado) => {
    const reads = Object.keys(c.leituras).length
    totalLeituras += reads
    // Estimativa: cada aluno deveria ler 1 vez (simplificação)
    expectedLeituras += alunosAtivos.length
  })

  const leituraRate = expectedLeituras > 0 ? Math.round((totalLeituras / expectedLeituras) * 100) : 0

  // Pendencias financeiras do mes simuladas
  const titulosAtrasados = (titulos || []).filter(t => t.status === 'atrasado')
  const totalAtrasado = titulosAtrasados.reduce((acc, t) => acc + t.valor, 0)

  // Chart Data
  const chartData = [
    { name: 'Seg', engajamento: 65, envios: 20 },
    { name: 'Ter', engajamento: 78, envios: 25 },
    { name: 'Qua', engajamento: 82, envios: 40 },
    { name: 'Qui', engajamento: 60, envios: 12 },
    { name: 'Sex', engajamento: 94, envios: 50 },
    { name: 'Sáb', engajamento: 30, envios: 0 },
    { name: 'Dom', engajamento: 20, envios: 0 },
  ]

  if (!mounted) return <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>Carregando painel...</div>

  return (
    <div className="ad-admin-page-container">
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 24, fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Dashboard da Agenda</h2>
        <p style={{ color: 'hsl(var(--text-muted))' }}>Visão geral de engajamento e comunicações.</p>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .ad-admin-page-container {
            padding: 0 20px !important;
            max-width: 480px !important;
            margin: 0 auto !important;
          }
          .ad-admin-grid-4, .ad-admin-grid-3, .ad-admin-grid-2 {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
           .ad-admin-grid-4-mobile-2 {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .ad-admin-grid-4-mobile-2 .card {
            flex-direction: column !important;
            justify-content: center !important;
            text-align: center !important;
            gap: 8px !important;
            padding: 16px 12px !important;
          }
          .card {
            padding: 16px !important;
          }
          .recharts-wrapper {
            margin-left: -20px !important; 
          }
        }
      `}} />

      {/* Head Start Metrics */}
      <div className="ad-admin-grid-4-mobile-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={20} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6', lineHeight: 1 }}>{(alunos || []).length}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Alunos</div>
          </div>
        </div>
        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <UserCheck size={20} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', lineHeight: 1 }}>{alunosAtivos.length}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Ativos</div>
          </div>
        </div>
        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139,92,246,0.1)', color: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Send size={20} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#8b5cf6', lineHeight: 1 }}>{totalComunicados}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Enviados</div>
          </div>
        </div>
        <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(236,72,153,0.1)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Eye size={20} />
          </div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#ec4899', lineHeight: 1 }}>{leituraRate}%</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>Leituras</div>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="ad-admin-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Conversas Pendentes', value: 12, icon: <MessageCircle size={20} />, color: '#f59e0b' },
          { label: 'Ocorrências Recentes', value: 5, icon: <AlertCircle size={20} />, color: '#ef4444' },
          { label: 'Formulários em Aberto', value: 3, icon: <FileCheck size={20} />, color: '#f97316' },
        ].map((kpi, i) => (
          <div key={i} className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
               <div style={{ color: kpi.color }}>{kpi.icon}</div>
               <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>{kpi.label}</div>
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-main))' }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="ad-admin-grid-2" style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 24 }}>
         {/* Chart Activity */}
         <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Engajamento Semanal</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEngaj" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorEnvios" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border-subtle))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--text-muted))' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--text-muted))' }} />
                <Tooltip 
                  contentStyle={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, fontSize: 12 }} 
                  itemStyle={{ fontSize: 13, fontWeight: 600 }}
                />
                <Area type="monotone" dataKey="engajamento" name="Famílias Engajadas" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEngaj)" />
                <Area type="monotone" dataKey="envios" name="Comunicados" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorEnvios)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
         </div>

         {/* Resumo Direita */}
         <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Cobranças Rápidas</h3>
            <div style={{ padding: 16, background: 'rgba(239,68,68,0.05)', borderRadius: 12, border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <DollarSign size={20} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Inadimplência total</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAtrasado)}
                </div>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 24, flex: 1 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Atividade de Comunicados</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {comunicados.slice(0, 4).map((c: ADComunicado) => {
                const totalLidas = Object.keys(c.leituras).length
                const pct = expectedLeituras > 0 ? (totalLidas / expectedLeituras) * 100 : 0

                return (
                  <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: 12, alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{c.titulo}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{new Date(c.dataEnvio).toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: pct > 50 ? '#10b981' : '#f59e0b' }}>{totalLidas} 👁️</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

         </div>
      </div>
    </div>
  )
}
