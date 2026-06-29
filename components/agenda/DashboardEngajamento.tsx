'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { X, TrendingUp, Users, CheckCircle, BarChart3, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts'
import { ADComunicado } from '@/lib/agendaDigitalContext'

interface DashboardEngajamentoProps {
  isOpen: boolean
  onClose: () => void
  comunicados: ADComunicado[]
  alunosAtivos: any[]
}

export function DashboardEngajamento({ isOpen, onClose, comunicados, alunosAtivos }: DashboardEngajamentoProps) {
  const metrics = useMemo(() => {
    if (!comunicados.length || !alunosAtivos.length) return null

    // Filtra comunicados dos últimos 30 dias que não são rascunhos ou relatórios individuais
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const validComunicados = comunicados.filter(c => {
      const dateStr = c.dataEnvio || (c as any).data || (c as any).created_at
      if (!dateStr) return false
      const cDate = new Date(dateStr)
      if (cDate < thirtyDaysAgo) return false
      if (c.status === 'rascunho') return false
      if (c.id?.startsWith('AD-COM-REL-STU-')) return false
      return true
    })

    let totalTargets = 0
    let totalReads = 0
    let totalCienciasExpected = 0
    let totalCiencias = 0

    const comunicadosWithStats = validComunicados.map(c => {
      const isGlobal = !c.turmas?.length && !c.alunosIds?.length
      const targets = isGlobal 
        ? alunosAtivos 
        : alunosAtivos.filter(a => c.turmas?.includes(a.turma) || c.alunosIds?.some(idRaw => idRaw.replace(/^_*(ALU)?/, '') === a.id.replace(/^_*(ALU)?/, '')))
      
      const targetCount = targets.length
      const readCount = Object.keys(c.leituras || {}).length
      const readRate = targetCount > 0 ? Math.round((readCount / targetCount) * 100) : 0

      totalTargets += targetCount
      totalReads += readCount

      if (c.exigeCiencia) {
        totalCienciasExpected += targetCount
        totalCiencias += Object.keys(c.ciencias || {}).length
      }

      return {
        ...c,
        targetCount,
        readCount,
        readRate,
        shortTitle: c.titulo.length > 20 ? c.titulo.substring(0, 20) + '...' : c.titulo
      }
    })

    const avgReadRate = totalTargets > 0 ? Math.round((totalReads / totalTargets) * 100) : 0
    const avgCienciaRate = totalCienciasExpected > 0 ? Math.round((totalCiencias / totalCienciasExpected) * 100) : 0

    // Top 5 Comunicados
    const topComunicados = [...comunicadosWithStats]
      .filter(c => c.targetCount >= 5) // apenas para públicos maiores
      .sort((a, b) => b.readRate - a.readRate)
      .slice(0, 5)

    // Agrupamento por Data para Gráfico de Linha (Evolução)
    const evolutionMap: Record<string, { date: string, reads: number, targets: number }> = {}
    
    // Inicia os últimos 15 dias com 0
    for (let i = 14; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dStr = d.toISOString().split('T')[0]
      evolutionMap[dStr] = { date: `${d.getDate()}/${d.getMonth()+1}`, reads: 0, targets: 0 }
    }

    comunicadosWithStats.forEach(c => {
      const dateStr = c.dataEnvio || (c as any).data || (c as any).created_at
      if (dateStr) {
        const dStr = dateStr.split('T')[0]
        if (evolutionMap[dStr]) {
          evolutionMap[dStr].reads += c.readCount
          evolutionMap[dStr].targets += c.targetCount
        }
      }
    })

    const evolutionData = Object.values(evolutionMap).map(item => ({
      ...item,
      rate: item.targets > 0 ? Math.round((item.reads / item.targets) * 100) : null
    }))

    return {
      totalEnviados: validComunicados.length,
      avgReadRate,
      avgCienciaRate,
      topComunicados,
      evolutionData
    }
  }, [comunicados, alunosAtivos])

  if (!isOpen) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(4px)' }}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        style={{
          width: '90%',
          maxWidth: 1000,
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: 24,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Activity color="#4f46e5" size={28} />
              Dashboard de Engajamento
            </h2>
            <p style={{ margin: 0, marginTop: 4, color: '#64748b', fontSize: 14 }}>Visão geral dos últimos 30 dias na Agenda Digital</p>
          </div>
          <button 
            onClick={onClose}
            style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: '#e2e8f0', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#cbd5e1'}
            onMouseLeave={e => e.currentTarget.style.background = '#e2e8f0'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 32, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          {/* Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
            <div style={{ background: 'linear-gradient(135deg, #4f46e5, #3b82f6)', padding: 24, borderRadius: 20, color: 'white', position: 'relative', overflow: 'hidden' }}>
              <TrendingUp size={100} style={{ position: 'absolute', right: -20, bottom: -20, opacity: 0.1 }} />
              <div style={{ fontSize: 14, fontWeight: 600, opacity: 0.8, textTransform: 'uppercase', letterSpacing: 1 }}>Taxa de Leitura</div>
              <div style={{ fontSize: 48, fontWeight: 900, marginTop: 8 }}>{metrics?.avgReadRate}%</div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>Média geral dos comunicados</div>
            </div>

            <div style={{ background: '#f8fafc', padding: 24, borderRadius: 20, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                <CheckCircle size={16} /> Taxa de Ciência
              </div>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#0f172a', marginTop: 12 }}>{metrics?.avgCienciaRate}%</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Quando exigida assinatura</div>
            </div>

            <div style={{ background: '#f8fafc', padding: 24, borderRadius: 20, border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                <Users size={16} /> Comunicados Enviados
              </div>
              <div style={{ fontSize: 40, fontWeight: 900, color: '#0f172a', marginTop: 12 }}>{metrics?.totalEnviados}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>Nos últimos 30 dias</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
            {/* Chart: Evolução */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <BarChart3 size={18} color="#4f46e5" />
                Evolução de Leitura (15 dias)
              </div>
              <div style={{ height: 250 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics?.evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 600 }}
                      formatter={(value: any) => [`${value}%`, 'Taxa de Leitura']}
                      labelStyle={{ color: '#64748b', marginBottom: 4 }}
                    />
                    <Line type="monotone" dataKey="rate" stroke="#4f46e5" strokeWidth={4} dot={{ r: 4, fill: '#4f46e5', strokeWidth: 0 }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top 5 */}
            <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 20, padding: 24 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} color="#10b981" />
                Top 5 Mais Lidos
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {metrics?.topComunicados.map((c, i) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: i === 0 ? 'rgba(245, 158, 11, 0.1)' : '#f1f5f9', color: i === 0 ? '#f59e0b' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.titulo}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{c.readCount} de {c.targetCount} famílias</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#10b981' }}>
                      {c.readRate}%
                    </div>
                  </div>
                ))}
                {(!metrics?.topComunicados || metrics.topComunicados.length === 0) && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, padding: '20px 0' }}>Dados insuficientes.</div>
                )}
              </div>
            </div>
          </div>

        </div>
      </motion.div>
    </div>
  )
}
