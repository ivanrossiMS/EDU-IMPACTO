'use client'

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadialBarChart, RadialBar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  LineChart, Line, ReferenceLine,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

// ── Shared tooltip styles
const TT_STYLE = {
  background: 'hsl(var(--bg-elevated))',
  border: '1px solid hsl(var(--border-default))',
  borderRadius: 10,
  padding: '10px 14px',
  fontSize: 12,
  boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
}

// ── Revenue vs Despesa (Area + Bar mixed) ────────────────────────
function RevTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={TT_STYLE}>
      <div style={{ color: 'hsl(var(--text-muted))', marginBottom: 6, fontWeight: 700, fontSize: 11 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, fontWeight: 700, marginBottom: 2 }}>
          {p.dataKey === 'receita' ? '↑ Receita: ' : '↓ Despesa: '}{formatCurrency(p.value)}
        </div>
      ))}
      {payload.length === 2 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid hsl(var(--border-subtle))', color: payload[0].value > payload[1].value ? '#34d399' : '#f87171', fontWeight: 800, fontSize: 11 }}>
          Resultado: {formatCurrency(payload[0].value - payload[1].value)}
        </div>
      )}
    </div>
  )
}

export function RevenueChartComponent({ chartData }: { chartData: any[] }) {
  if (!chartData?.length) return (
    <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
      Registre títulos e pagamentos para visualizar o gráfico
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="2 4" stroke="hsl(220 15% 20%)" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'hsl(220 10% 48%)' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11, fill: 'hsl(220 10% 48%)' }} axisLine={false} tickLine={false} width={40} />
        <Tooltip content={<RevTooltip />} />
        <Area type="monotone" dataKey="receita" stroke="#3b82f6" strokeWidth={2.5} fill="url(#gradReceita)" dot={false} activeDot={{ r: 5, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} />
        <Area type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={2} fill="url(#gradDespesa)" strokeDasharray="5 3" dot={false} activeDot={{ r: 4, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Inadimplência Mensal (Bar) ────────────────────────────────────
export function InadimplenciaBarChart({ chartData }: { chartData: any[] }) {
  if (!chartData?.length) return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>Sem dados</div>
  )
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={16}>
        <CartesianGrid strokeDasharray="2 4" stroke="hsl(220 15% 20%)" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(220 10% 48%)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(220 10% 48%)' }} axisLine={false} tickLine={false} width={24} />
        <Tooltip
          formatter={(v: any) => [v, 'Inadimplentes']}
          contentStyle={TT_STYLE}
          cursor={{ fill: 'rgba(239,68,68,0.07)' }}
        />
        <Bar dataKey="inadimplentes" fill="#ef4444" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Matriculas Mensal (Line) ──────────────────────────────────────
export function MatriculasLineChart({ chartData }: { chartData: any[] }) {
  if (!chartData?.length) return (
    <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>Sem dados</div>
  )
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="2 4" stroke="hsl(220 15% 20%)" vertical={false} />
        <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(220 10% 48%)' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: 'hsl(220 10% 48%)' }} axisLine={false} tickLine={false} width={24} />
        <Tooltip formatter={(v: any) => [v, 'Matrículas']} contentStyle={TT_STYLE} />
        <Line type="monotone" dataKey="matriculas" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ── Riscos Pie (donut) ───────────────────────────────────────────
export function RisksPieChartComponent({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={48} outerRadius={70} dataKey="valor" stroke="none" paddingAngle={3}>
          {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        </Pie>
        <Tooltip formatter={(v: any) => [Number(v), 'Alunos']} contentStyle={TT_STYLE} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Despesas Por Centro de Custo ─────────────────────────────────
export function CostCentersPieChartComponent({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="valor" stroke="none" paddingAngle={2}>
          {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
        </Pie>
        <Tooltip formatter={(v: any) => [formatCurrency(Number(v)), 'Despesa']} contentStyle={TT_STYLE} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── Radial Bar Ocupação ──────────────────────────────────────────
export function OcupacaoRadialChart({ value, color }: { value: number; color: string }) {
  const data = [{ value, fill: color }, { value: 100 - value, fill: 'transparent' }]
  return (
    <ResponsiveContainer width="100%" height={90}>
      <RadialBarChart cx="50%" cy="55%" innerRadius="60%" outerRadius="90%" startAngle={180} endAngle={0} data={[{ value, fill: color }]}>
        <RadialBar dataKey="value" cornerRadius={6} background={{ fill: 'hsl(220 15% 20%)' }} />
      </RadialBarChart>
    </ResponsiveContainer>
  )
}

// ── Sparkline (tiny trend line) ─────────────────────────────────
export function SparkLine({ data, color, dataKey = 'v' }: { data: any[]; color: string; dataKey?: string }) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 2, left: 0, bottom: 2 }}>
        <defs>
          <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#spark-${color.replace('#', '')})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
