'use client'

import { useState } from 'react'
import { Brain, Zap, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, ChevronRight, RefreshCw, Sparkles } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, LineChart, Line, ReferenceLine } from 'recharts'

const INSIGHTS = [
  {
    id: 'I001',
    tipo: 'alerta',
    titulo: 'Pico de faltas às terças-feiras',
    descricao: 'Alunos do turno da tarde faltam 34% mais às terças. Recomendado: verificar o horário do transporte escolar e notificar responsáveis.',
    impacto: 'alto',
    modulo: 'Acadêmico',
    data: 'Hoje, 06:30',
    acao: 'Ver frequência',
    link: '/academico/diario',
    confianca: 94,
  },
  {
    id: 'I002',
    tipo: 'financeiro',
    titulo: 'Projeção de inadimplência para Abril: +12%',
    descricao: 'Com base nos padrões históricos de março e no calendário de vencimentos, esperamos aumento de inadimplência em abril. Recomendado: disparar campanha antecipada.',
    impacto: 'alto',
    modulo: 'Financeiro',
    data: 'Hoje, 06:00',
    acao: 'Ver inadimplência',
    link: '/financeiro/inadimplencia',
    confianca: 87,
  },
  {
    id: 'I003',
    tipo: 'evasao',
    titulo: '3 alunos com alto risco de desistência em Maio',
    descricao: 'Modelo identifica Lucas A., Mateus S. e Heitor N. com probabilidade acima de 78% de desistência no próximo bimestre. Intervenção imediata recomendada.',
    impacto: 'critico',
    modulo: 'CRM',
    data: 'Hoje, 05:45',
    acao: 'Ver retenção',
    link: '/crm/retencao',
    confianca: 81,
  },
  {
    id: 'I004',
    tipo: 'positivo',
    titulo: '9A tem a maior evolução de notas do trimestre 🏆',
    descricao: 'A turma 9A subiu +1.2 pontos na média geral em relação ao bimestre anterior. Reconhecer o Prof. Ricardo Faria e a coordenação pedagógica.',
    impacto: 'info',
    modulo: 'Acadêmico',
    data: 'Ontem, 22:00',
    acao: 'Ver turma',
    link: '/academico/turmas',
    confianca: 98,
  },
  {
    id: 'I005',
    tipo: 'financeiro',
    titulo: 'Economia possível: renegociar contrato de energia',
    descricao: 'A conta de energia das últimas 3 competências subiu 18%. Recomendado: comparar tarifas e considerar migração para mercado livre de energia.',
    impacto: 'medio',
    modulo: 'Financeiro',
    data: 'Ontem, 20:00',
    acao: 'Ver custos',
    link: '/financeiro/custos',
    confianca: 72,
  },
  {
    id: 'I006',
    tipo: 'rh',
    titulo: 'Prof. André Moura: padrão de atraso crescente',
    descricao: '4 registros de atraso nas últimas 3 semanas. Primeira vez que ultrapassa Meta RH. Reunião 1:1 recomendada antes de formalizar advertência.',
    impacto: 'medio',
    modulo: 'RH',
    data: 'Ontem, 18:30',
    acao: 'Ver ponto',
    link: '/rh/ponto',
    confianca: 90,
  },
]

const IMPACTO_CONFIG: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  critico: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: <AlertTriangle size={16} /> },
  alto: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: <AlertTriangle size={16} /> },
  medio: { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', icon: <Brain size={16} /> },
  info: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: <CheckCircle size={16} /> },
}

const INSIGHT_VOLUME = [
  { mes: 'Out', insights: 12 }, { mes: 'Nov', insights: 18 }, { mes: 'Dez', insights: 9 },
  { mes: 'Jan', insights: 22 }, { mes: 'Fev', insights: 29 }, { mes: 'Mar', insights: 34 },
]

export default function InsightsPage() {
  const [filtro, setFiltro] = useState('todos')
  const [gerado, setGerado] = useState(false)

  const modulos = ['todos', 'Acadêmico', 'Financeiro', 'CRM', 'RH']
  const filtered = INSIGHTS.filter(i => filtro === 'todos' || i.modulo === filtro)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Insights Automáticos IA</h1>
          <p className="page-subtitle">Análises geradas automaticamente pelo modelo Gemini — {INSIGHTS.length} insights ativos</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setGerado(false)}><RefreshCw size={13} />Atualizar</button>
          <button className="btn btn-primary btn-sm" onClick={() => setGerado(true)}>
            <Sparkles size={13} />{gerado ? 'Gerando...' : 'Gerar novos insights'}
          </button>
        </div>
      </div>

      {/* Resumo + gráfico */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 260px', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Críticos', value: INSIGHTS.filter(i => i.impacto === 'critico').length, color: '#ef4444' },
          { label: 'Alta prioridade', value: INSIGHTS.filter(i => i.impacto === 'alto').length, color: '#f59e0b' },
          { label: 'Oportunidades', value: INSIGHTS.filter(i => i.impacto === 'info').length, color: '#10b981' },
        ].map(c => (
          <div key={c.label} className="kpi-card">
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
            <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginBottom: 8 }}>Insights/mês</div>
          <ResponsiveContainer width="100%" height={60}>
            <BarChart data={INSIGHT_VOLUME} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
              <Bar dataKey="insights" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
              <Tooltip contentStyle={{ background: 'hsl(var(--bg-elevated))', border: 'none', borderRadius: 6, fontSize: 11 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* IA status banner */}
      <div className="ia-card" style={{ padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', flexShrink: 0 }} />
        <div style={{ flex: 1, fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
          <strong style={{ color: 'hsl(var(--text-primary))' }}>Modelo Gemini ativo</strong> — Análise contínua de 1.842 alunos, 89 funcionários, e dados financeiros. Próxima atualização automática às 18:00.
        </div>
        <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>Confiança média: 87%</span>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {modulos.map(m => (
          <button key={m} className={`btn ${filtro === m ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setFiltro(m)}>
            {m === 'todos' ? 'Todos os módulos' : m}
          </button>
        ))}
      </div>

      {/* Lista de insights */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(insight => {
          const cfg = IMPACTO_CONFIG[insight.impacto]
          return (
            <div key={insight.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '18px 20px', background: cfg.bg, border: `1px solid ${cfg.color}22`, borderLeft: `4px solid ${cfg.color}`, borderRadius: 12 }}>
              <div style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }}>{cfg.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{insight.titulo}</span>
                  <span className="badge badge-neutral" style={{ fontSize: 10 }}>{insight.modulo}</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 100, background: cfg.color + '20', color: cfg.color, fontWeight: 700 }}>
                    {insight.confianca}% confiança
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', lineHeight: 1.6, marginBottom: 8 }}>{insight.descricao}</p>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>🤖 Gerado: {insight.data}</div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <a href={insight.link} className="btn btn-primary btn-sm" style={{ fontSize: 11 }}>
                  {insight.acao} <ChevronRight size={11} />
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
