'use client'

import { BarChart2, TrendingUp, Brain, Download, Filter, Users, DollarSign, BarChart3 } from 'lucide-react'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { formatCurrency } from '@/lib/utils'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, Cell
} from 'recharts'

const TABS = ['Panorama Geral', 'Acadêmico', 'Financeiro', 'Alunos & Evasão', 'RH & Equipe']

export default function BIPage() {
  const [tab, setTab] = useState('Panorama Geral')
  
  const { data: alunos = [], isLoading: loadAl } = useQuery<any[]>({
    queryKey: ['alunos'], queryFn: async () => { const r = await fetch('/api/alunos'); return r.json() }
  })
  const { data: turmas = [], isLoading: loadTur } = useQuery<any[]>({
    queryKey: ['turmas'], queryFn: async () => { const r = await fetch('/api/turmas'); return r.json() }
  })
  const { data: funcionarios = [], isLoading: loadFunc } = useQuery<any[]>({
    queryKey: ['funcionarios'], queryFn: async () => { const r = await fetch('/api/rh/funcionarios'); return r.json() }
  })
  const { data: titulos = [], isLoading: loadTit } = useQuery<any[]>({
    queryKey: ['titulos'], queryFn: async () => { const r = await fetch('/api/financeiro/titulos'); return r.json() }
  })

  const isLoading = loadAl || loadTur || loadFunc || loadTit

  // Real-data KPIs
  const totalAlunos = alunos.length
  const totalTurmas = turmas.length
  const totalFuncionarios = funcionarios.length
  const receitaMes = titulos ? titulos.filter((t: any) => t.status === 'pago').reduce((s: number, t: any) => s + (t.valor ?? 0), 0) : 0
  const inadimplentes = titulos ? titulos.filter((t: any) => t.status === 'atrasado' || t.status === 'vencido').length : 0

  // Métricas acadêmicas por turma baseadas em alunos reais
  const turmaStats = turmas.map((t: any) => {
    const alunosTurma = alunos.filter((a: any) => a.turma === t.nome || a.turma_id === t.id)
    const freq = alunosTurma.length > 0
      ? Math.round(alunosTurma.reduce((s: number, a: any) => s + (a.frequencia ?? 85), 0) / alunosTurma.length)
      : 0
    const media = alunosTurma.length > 0
      ? (alunosTurma.reduce((s: number, a: any) => s + (a.media_geral ?? 7.5), 0) / alunosTurma.length).toFixed(1)
      : 0
    return { turma: t.nome || t.codigo, media: Number(media), frequencia: freq, alunos: alunosTurma.length }
  })

  return (
    <div suppressHydrationWarning>
      {isLoading && (
        <div style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', background:'rgba(255,255,255,0.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(2px)' }}>
          <div style={{ textAlign:'center', color:'hsl(var(--text-muted))' }}>
            <div style={{ width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontWeight:600 }}>Gerando insights gerenciais...</div>
          </div>
        </div>
      )}
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Hub BI Executivo</h1>
          <p className="page-subtitle">Inteligência de dados em tempo real • {alunos.length > 0 ? `${alunos.length} alunos` : 'Sem dados cadastrados'}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm"><Download size={13} />Exportar PDF</button>
          <button className="btn btn-secondary btn-sm"><Filter size={13} />Filtros</button>
        </div>
      </div>

      <div className="tab-list" style={{ marginBottom: 24, width: '100%' }}>
        {TABS.map(t => <button key={t} className={`tab-trigger ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}
      </div>

      {tab === 'Panorama Geral' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {[
              { label: 'Total Alunos', value: totalAlunos || '—', sub: totalAlunos > 0 ? 'Alunos ativos' : 'Cadastre alunos', color: '#3b82f6', icon: <Users size={22} /> },
              { label: 'Receita do Mês', value: receitaMes > 0 ? formatCurrency(receitaMes) : '—', sub: receitaMes > 0 ? 'Receita cadastrada' : 'Sem dados financeiros', color: '#10b981', icon: <DollarSign size={22} /> },
              { label: 'Total Turmas', value: totalTurmas || '—', sub: totalTurmas > 0 ? `${totalTurmas} turma(s)` : 'Cadastre turmas', color: '#8b5cf6', icon: <BarChart3 size={22} /> },
              { label: 'Inadimplentes', value: inadimplentes, sub: totalAlunos > 0 ? `${Math.round((inadimplentes / Math.max(totalAlunos, 1)) * 100)}% do total` : 'Sem dados', color: '#ef4444', icon: <TrendingUp size={22} /> },
            ].map(k => (
              <div key={k.label} style={{ background: 'hsl(var(--bg-surface))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 16, padding: '20px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: k.color }} />
                <div style={{ color: k.color, marginBottom: 12 }}>{k.icon}</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{k.label}</div>
                <div style={{ fontSize: 11, color: k.color, marginTop: 6, fontWeight: 600 }}>{k.sub}</div>
              </div>
            ))}
          </div>

          {totalAlunos === 0 ? (
            <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
              <BarChart3 size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Nenhum dado para visualizar</div>
              <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>
                Cadastre alunos, turmas e dados financeiros para visualizar gráficos no Hub BI.
              </div>
            </div>
          ) : (
            <div className="ia-card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Brain size={18} color="#a78bfa" />
                <div style={{ flex: 1, fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
                  ✅ {totalAlunos} aluno(s), {totalTurmas} turma(s) e {totalFuncionarios} funcionário(s) cadastrados. Use os filtros acima para análise por período ou unidade.
                </div>
                <button className="btn btn-primary btn-sm"><Brain size={13} />Analisar com IA</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'Acadêmico' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {turmaStats.length === 0 ? (
            <div className="card" style={{ padding: '60px 24px', textAlign: 'center' }}>
              <BarChart3 size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Nenhuma turma cadastrada</div>
              <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))' }}>Cadastre turmas e alunos para visualizar métricas acadêmicas.</div>
            </div>
          ) : (
            <div className="chart-container">
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Desempenho por Turma</div>
              <div className="table-container" style={{ border: 'none' }}>
                <table>
                  <thead><tr><th>Turma</th><th>Alunos</th><th>Média</th><th>Frequência</th><th>Status</th></tr></thead>
                  <tbody>
                    {turmaStats.map(t => (
                      <tr key={t.turma}>
                        <td><span className="badge badge-neutral">{t.turma}</span></td>
                        <td>{t.alunos}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="progress-bar" style={{ width: 60, display: 'inline-block' }}>
                              <div className="progress-fill" style={{ width: `${(Number(t.media) / 10) * 100}%`, background: Number(t.media) < 5 ? '#ef4444' : Number(t.media) < 7 ? '#f59e0b' : '#10b981' }} />
                            </div>
                            <strong style={{ color: Number(t.media) < 5 ? '#f87171' : Number(t.media) < 7 ? '#fbbf24' : '#34d399' }}>{t.media}</strong>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div className="progress-bar" style={{ width: 60, display: 'inline-block' }}>
                              <div className="progress-fill" style={{ width: `${t.frequencia}%`, background: t.frequencia < 75 ? '#ef4444' : '#10b981' }} />
                            </div>
                            <strong style={{ color: t.frequencia < 75 ? '#f87171' : '#34d399' }}>{t.frequencia}%</strong>
                          </div>
                        </td>
                        <td>
                          <span className={`badge ${Number(t.media) >= 7 && t.frequencia >= 85 ? 'badge-success' : Number(t.media) < 5 || t.frequencia < 75 ? 'badge-danger' : 'badge-warning'}`}>
                            {Number(t.media) >= 7 && t.frequencia >= 85 ? 'Ótima' : Number(t.media) < 5 || t.frequencia < 75 ? 'Crítica' : 'Atenção'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {(tab === 'Financeiro' || tab === 'Alunos & Evasão' || tab === 'RH & Equipe') && (
        <div className="chart-container" style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <BarChart3 size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 16, fontWeight: 600 }}>Dashboard {tab}</div>
          <div style={{ fontSize: 13, marginTop: 8 }}>
            {totalAlunos === 0
              ? 'Cadastre dados no sistema para visualizar análises avançadas nesta aba.'
              : `Visualizações avançadas de ${tab.toLowerCase()} com drill-down interativo baseado nos dados reais.`}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 20 }}><Brain size={14} />Analisar com IA</button>
        </div>
      )}
    </div>
  )
}
