'use client'

import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { formatCurrency } from '@/lib/utils'

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string; color: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
        <div style={{ color: 'hsl(var(--text-muted))', marginBottom: 6, fontWeight: 600 }}>{label}</div>
        {payload.map((p) => (
          <div key={p.dataKey} style={{ color: p.color, fontWeight: 700 }}>
            {p.dataKey === 'receita' ? 'Receita: ' : 'Despesa: '}{formatCurrency(p.value)}
          </div>
        ))}
      </div>
    )
  }
  return null
}

export function RevenueChartComponent({ chartData }: { chartData: any[] }) {
  if (!chartData || chartData.length === 0) {
    return (
      <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
        Registre títulos e pagamentos para visualizar o gráfico
      </div>
    )
  }
  
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <defs>
          <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 15% 22%)" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(220 10% 50%)' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(220 10% 50%)' }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area type="monotone" dataKey="receita" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradReceita)" />
        <Area type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={2} fill="url(#gradDespesa)" strokeDasharray="4 4" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function RisksPieChartComponent({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={44} outerRadius={65} dataKey="valor" stroke="none">
          {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        </Pie>
        <Tooltip formatter={(v: any) => [Number(v), 'Alunos']} contentStyle={{ background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-default))', borderRadius: 8, fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
