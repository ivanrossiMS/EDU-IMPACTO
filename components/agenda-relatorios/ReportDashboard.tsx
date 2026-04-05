'use client'

import React, { useMemo } from 'react'
import { ReportTemplate, ReportRecord } from '@/lib/relatoriosContext'
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Activity, Hash, MessageSquare, CheckSquare, List } from 'lucide-react'

type Props = {
  template: ReportTemplate
  records: ReportRecord[]
}

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899']

export function ReportDashboard({ template, records }: Props) {
  
  // Create an aggregation for each field
  const aggregations = useMemo(() => {
    const data: Record<string, any> = {}
    
    template.sections.forEach(sec => {
      sec.fields.forEach(f => {
        if (!['unica-escolha', 'sim-nao', 'multipla-escolha', 'numero', 'nota'].includes(f.type)) return
        
        const answers: any[] = []
        records.forEach(r => {
          if (r.data[f.id] !== undefined && r.data[f.id] !== null && r.data[f.id] !== '') {
            answers.push(r.data[f.id])
          }
        })

        if (answers.length === 0) return

        if (['unica-escolha', 'sim-nao'].includes(f.type)) {
          const counts: Record<string, number> = {}
          answers.forEach(a => { counts[a] = (counts[a] || 0) + 1 })
          data[f.id] = { type: 'pie', data: Object.entries(counts).map(([name, value]) => ({ name, value })), totalAnswers: answers.length }
        }
        else if (f.type === 'multipla-escolha') {
          const counts: Record<string, number> = {}
          let totalChoices = 0
          answers.forEach(a => {
            if (Array.isArray(a)) {
              a.forEach(v => { counts[v] = (counts[v] || 0) + 1; totalChoices++ })
            }
            else {
               counts[a] = (counts[a] || 0) + 1; totalChoices++
            }
          })
          data[f.id] = { type: 'bar', data: Object.entries(counts).map(([name, value]) => ({ name, value })), totalAnswers: totalChoices }
        }
        else if (f.type === 'numero' || f.type === 'nota') {
          const nums = answers.map(Number).filter(n => !isNaN(n))
          const avg = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : 0
          data[f.id] = { type: 'stat', value: avg, label: 'Média' }
        }
      })
    })
    
    return data
  }, [template, records])

  return (
    <div style={{ padding: 32, overflowY: 'auto', flex: 1, background: 'hsl(var(--bg-main))' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          <div className="card" style={{ padding: 20 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'hsl(var(--text-secondary))' }}>
                <Activity size={20} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Total de Submissões</span>
             </div>
             <div style={{ fontSize: 32, fontWeight: 800, marginTop: 12 }}>{records.length}</div>
          </div>

          <div className="card" style={{ padding: 20 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'hsl(var(--text-secondary))' }}>
                <CheckSquare size={20} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Taxa de Aprovação</span>
             </div>
             <div style={{ fontSize: 32, fontWeight: 800, marginTop: 12, color: '#10b981' }}>
               {records.length > 0 ? Math.round((records.filter(r => r.status === 'aprovado').length / records.length) * 100) : 0}%
             </div>
          </div>
        </div>

        {template.sections.map(sec => {
          const actionableFields = sec.fields.filter(f => aggregations[f.id])
          if (actionableFields.length === 0) return null

          return (
            <div key={sec.id} style={{ marginBottom: 40 }}>
               <h3 style={{ fontSize: 18, fontWeight: 800, color: 'hsl(var(--text-main))', marginBottom: 20, borderBottom: '2px solid rgba(0,0,0,0.05)', paddingBottom: 8 }}>{sec.title}</h3>
               
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
                 {actionableFields.map(f => {
                    const agg = aggregations[f.id]
                    return (
                      <div key={f.id} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column' }}>
                         <h4 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px 0' }}>{f.label}</h4>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                           <span className="badge badge-ghost" style={{ fontSize: 11 }}>Visão Consolidada</span>
                           {agg.totalAnswers && <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{agg.totalAnswers} total</span>}
                         </div>
                         
                         <div style={{ flex: 1, minHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {agg.type === 'pie' && (
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie data={agg.data} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                                    {agg.data.map((entry: any, index: number) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                  </Pie>
                                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                </PieChart>
                              </ResponsiveContainer>
                            )}

                            {agg.type === 'bar' && (
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={agg.data} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(0,0,0,0.05)" />
                                  <XAxis type="number" hide />
                                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12, fill: 'hsl(var(--text-secondary))' }} axisLine={false} tickLine={false} />
                                  <RechartsTooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                  <Bar dataKey="value" fill="#4f46e5" radius={[0, 4, 4, 0]}>
                                    {agg.data.map((entry: any, index: number) => (
                                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            )}

                            {agg.type === 'stat' && (
                               <div style={{ textAlign: 'center' }}>
                                  <div style={{ fontSize: 48, fontWeight: 800, color: '#4f46e5' }}>{agg.value}</div>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>{agg.label}</div>
                               </div>
                            )}
                         </div>

                         {/* Legenda detalhada para gráficos de pizza e barras */}
                         {['pie', 'bar'].includes(agg.type) && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16, background: 'rgba(0,0,0,0.02)', padding: 12, borderRadius: 8 }}>
                               {agg.data.map((entry: any, index: number) => {
                                 const percent = agg.totalAnswers > 0 ? Math.round((entry.value / agg.totalAnswers) * 100) : 0
                                 return (
                                   <div key={entry.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[index % COLORS.length] }} />
                                        <span style={{ fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>{entry.name}</span>
                                      </div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <span style={{ fontWeight: 700, color: 'hsl(var(--text-main))' }}>{entry.value}</span>
                                        <span style={{ width: 40, textAlign: 'right', color: 'hsl(var(--text-muted))' }}>{percent}%</span>
                                      </div>
                                   </div>
                                 )
                               })}
                            </div>
                         )}
                      </div>
                    )
                 })}
               </div>
            </div>
          )
        })}

        {Object.keys(aggregations).length === 0 && (
          <div style={{ padding: 60, textAlign: 'center', color: 'hsl(var(--text-muted))', background: 'hsl(var(--bg-surface))', borderRadius: 12 }}>
             Nenhum dado quantitativo. Adicione campos de múltipla escolha, seleção única ou números para que o dashboard seja gerado.
          </div>
        )}
      </div>
    </div>
  )
}
