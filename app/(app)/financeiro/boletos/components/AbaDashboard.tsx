'use client'

import React from 'react'
import { Aluno, Titulo } from '@/lib/dataContext'
import { StatusBadge } from './StatusBadge'
import { Trash2, Printer, X, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Clock, Send, BarChart3, Wallet, Users, CalendarDays } from 'lucide-react'

interface Props {
  titulos: Titulo[]
  alunos: Aluno[]
  onEmitir: () => void
  // onReprint e onDelete removidos pois a tabela foi excluída, 
  // mantidos na interface como opcional caso o pai os passe.
  onReprint?: (titulo: Titulo) => void
  onDelete?: (id: string) => void
}

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtData(s?: string | null) {
  if (!s) return '—'
  const [a, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

interface GrupoBoleto {
  titulo: Titulo
  valorTotal: number
  parcelas: string[]
  descricoes: string[]
  vencimento: string
  qtdParcelas: number
  membros: Titulo[]
}

// ── Mini bar chart (SVG puro, sem dependência) ───────────────────────────────
function MiniBar({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  const w = 6; const gap = 3; const h = 32
  const total = data.length * (w + gap) - gap
  return (
    <svg width={total} height={h} style={{ display: 'block' }}>
      {data.map((v, i) => {
        const barH = Math.max(3, (v / max) * h)
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={h - barH}
            width={w}
            height={barH}
            rx={2}
            fill={color}
            opacity={0.7 + (i / data.length) * 0.3}
          />
        )
      })}
    </svg>
  )
}

// ── Doughnut simples ─────────────────────────────────────────────────────────
function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) return (
    <svg width={100} height={100}>
      <circle cx={50} cy={50} r={38} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={14} />
      <text x={50} y={54} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize={11}>Vazio</text>
    </svg>
  )

  const r = 38; const cx = 50; const cy = 50
  let cumulative = 0
  const arcs = segments.map(seg => {
    const pct = seg.value / total
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2
    cumulative += pct
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const large = pct > 0.5 ? 1 : 0
    return { d: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, color: seg.color }
  })

  return (
    <svg width={100} height={100}>
      <circle cx={cx} cy={cy} r={r + 7} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
      {arcs.map((arc, i) => (
        <path key={i} d={arc.d} fill={arc.color} opacity={0.85} />
      ))}
      <circle cx={cx} cy={cy} r={24} fill="hsl(var(--bg-elevated))" />
      <text x={cx} y={cy - 4} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize={14} fontWeight="bold">
        {total}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize={8}>
        boletos
      </text>
    </svg>
  )
}

export function AbaDashboard({ titulos, alunos, onEmitir }: Props) {
  const turmas = [...new Set(alunos.map(a => a.turma).filter(Boolean))].sort()
  const emitidos = titulos.filter(t => t.statusBancario && t.statusBancario !== 'rascunho')

  // ── Agrupamento por nossoNumero ──────────────────────────────────────────────
  const grupoMap = new Map<string, GrupoBoleto>()
  for (const t of emitidos) {
    const nn = t.nossoNumero ?? t.id
    if (!grupoMap.has(nn)) {
      grupoMap.set(nn, { titulo: t, valorTotal: 0, parcelas: [], descricoes: [], vencimento: t.vencimento || '', qtdParcelas: 0, membros: [] })
    }
    const g = grupoMap.get(nn)!
    g.valorTotal += t.valor ?? 0
    if (t.parcela && !g.parcelas.includes(t.parcela)) g.parcelas.push(t.parcela)
    if (t.descricao && !g.descricoes.includes(t.descricao)) g.descricoes.push(t.descricao)
    if (t.vencimento && t.vencimento > g.vencimento) g.vencimento = t.vencimento
    g.qtdParcelas++
    g.membros.push(t)
    if (t.htmlBoleto && !g.titulo.htmlBoleto) g.titulo = t
  }
  for (const g of grupoMap.values()) {
    const vg = (g.titulo as any).valorGrupo
    if (typeof vg === 'number' && vg > 0) g.valorTotal = vg
  }
  const grupos = Array.from(grupoMap.values())

  // ── Métricas ─────────────────────────────────────────────────────────────────
  const hoje = new Date().toISOString().slice(0, 10)
  const liquidados      = grupos.filter(g => g.titulo.statusBancario === 'liquidado')
  const vencidos        = grupos.filter(g => g.titulo.statusBancario === 'vencido')
  const emRemessa       = grupos.filter(g => g.titulo.statusBancario === 'enviado_remessa')
  const emitidosSolo    = grupos.filter(g => g.titulo.statusBancario === 'emitido')
  const registrados     = grupos.filter(g => g.titulo.statusBancario === 'registrado')
  const pendentes       = [...emitidosSolo, ...registrados]
  const vencemHoje      = grupos.filter(g => (g.vencimento || g.titulo.vencimento || '') === hoje)
  const vencemSemana    = grupos.filter(g => {
    const v = g.vencimento || g.titulo.vencimento || ''
    const em7 = new Date(); em7.setDate(em7.getDate() + 7)
    return v >= hoje && v <= em7.toISOString().slice(0, 10)
  })

  const valorTotal      = grupos.reduce((s, g) => s + g.valorTotal, 0)
  const valorLiquidado  = liquidados.reduce((s, g) => s + g.valorTotal, 0)
  const valorVencido    = vencidos.reduce((s, g) => s + g.valorTotal, 0)
  const valorRemessa    = emRemessa.reduce((s, g) => s + g.valorTotal, 0)
  const valorPendente   = pendentes.reduce((s, g) => s + g.valorTotal, 0)
  const ticketMedio     = grupos.length > 0 ? valorTotal / grupos.length : 0
  const taxaLiquidacao  = grupos.length > 0 ? Math.round((liquidados.length / grupos.length) * 100) : 0
  const taxaInadimplencia = grupos.length > 0 ? Math.round((vencidos.length / grupos.length) * 100) : 0

  // Dados históricos simulados (últimos 7 estados agrupados por data de vencimento)
  const vencDist = grupos.reduce((acc, g) => {
    const mes = (g.vencimento || '').slice(0, 7)
    if (!mes) return acc
    if (!acc[mes]) acc[mes] = 0
    acc[mes]++
    return acc
  }, {} as Record<string, number>)
  const meses = Object.keys(vencDist).sort().slice(-6)
  const barData = meses.map(m => vencDist[m] ?? 0)

  // Alunos com mais boletos
  const porAluno = grupos.reduce((acc, g) => {
    const nome = g.titulo.aluno
    if (!acc[nome]) acc[nome] = { qtd: 0, valor: 0 }
    acc[nome].qtd++
    acc[nome].valor += g.valorTotal
    return acc
  }, {} as Record<string, { qtd: number; valor: number }>)
  const topAlunos = Object.entries(porAluno).sort((a, b) => b[1].valor - a[1].valor).slice(0, 5)


  // ── Render ───────────────────────────────────────────────────────────────────
  if (grupos.length === 0) {
    return (
      <div className="card" style={{ padding: '80px 40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🏦</div>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Nenhum boleto emitido ainda</div>
        <div style={{ fontSize: 13, marginBottom: 24 }}>Clique em &quot;Emitir Boleto&quot; para gerar o primeiro boleto registrado.</div>
        <button className="btn btn-primary" onClick={onEmitir}>+ Emitir Primeiro Boleto</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── ROW 1: Métricas primárias ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>

        {/* Volume Total */}
        <div className="card" style={{ padding: '18px 20px', background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(99,102,241,0.05))', border: '1px solid rgba(99,102,241,0.25)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -16, right: -16, fontSize: 80, opacity: 0.04 }}>💰</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={16} color="#818cf8" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Volume Total</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: '#818cf8' }}>{fmtMoeda(valorTotal)}</div>
          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 4 }}>
            Ticket médio: <strong style={{ color: '#c4b5fd' }}>{fmtMoeda(ticketMedio)}</strong>
          </div>
        </div>

        {/* Liquidados */}
        <div className="card" style={{ padding: '18px 20px', background: 'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.03))', border: '1px solid rgba(16,185,129,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={16} color="#10b981" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Liquidados</span>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '2px 8px', borderRadius: 8 }}>{taxaLiquidacao}%</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: '#10b981' }}>{liquidados.length}</div>
          <div style={{ fontSize: 11, color: '#34d399', marginTop: 2 }}>{fmtMoeda(valorLiquidado)} recebido</div>
        </div>

        {/* Em Remessa */}
        <div className="card" style={{ padding: '18px 20px', background: 'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(245,158,11,0.03))', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Send size={16} color="#f59e0b" />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Em Remessa</span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: '#f59e0b' }}>{emRemessa.length}</div>
          <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 2 }}>{fmtMoeda(valorRemessa)} aguardando banco</div>
        </div>

        {/* Inadimplência */}
        <div className="card" style={{ padding: '18px 20px', background: 'linear-gradient(135deg,rgba(248,113,113,0.1),rgba(248,113,113,0.03))', border: '1px solid rgba(248,113,113,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(248,113,113,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={16} color="#f87171" />
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vencidos</span>
            </div>
            {taxaInadimplencia > 0 && (
              <span style={{ fontSize: 12, fontWeight: 800, color: '#f87171', background: 'rgba(248,113,113,0.12)', padding: '2px 8px', borderRadius: 8 }}>{taxaInadimplencia}%</span>
            )}
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: '#f87171' }}>{vencidos.length}</div>
          <div style={{ fontSize: 11, color: '#fca5a5', marginTop: 2 }}>{fmtMoeda(valorVencido)} em atraso</div>
        </div>
      </div>

      {/* ── ROW 2: Gráficos + Alertas ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px 1fr', gap: 14 }}>

        {/* Distribuição por status (barras) */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart3 size={15} color="#818cf8" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Distribuição por Status</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Liquidado',    count: liquidados.length,  val: valorLiquidado, color: '#10b981' },
              { label: 'Em Remessa',   count: emRemessa.length,   val: valorRemessa,   color: '#f59e0b' },
              { label: 'Pendente',     count: pendentes.length,   val: valorPendente,  color: '#60a5fa' },
              { label: 'Vencido',      count: vencidos.length,    val: valorVencido,   color: '#f87171' },
            ].map(row => {
              const pct = grupos.length > 0 ? (row.count / grupos.length) * 100 : 0
              return (
                <div key={row.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{row.label}</span>
                    <span style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>
                      {row.count} · {fmtMoeda(row.val)}
                    </span>
                  </div>
                  <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: row.color, borderRadius: 99, transition: 'width 0.6s ease', minWidth: row.count > 0 ? 4 : 0 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Donut */}
        <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <DonutChart segments={[
            { value: liquidados.length,   color: '#10b981', label: 'Liq.' },
            { value: emRemessa.length,    color: '#f59e0b', label: 'Rem.' },
            { value: pendentes.length,    color: '#60a5fa', label: 'Pend.' },
            { value: vencidos.length,     color: '#f87171', label: 'Venc.' },
          ]} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 8px', justifyContent: 'center' }}>
            {[
              { label: 'Liquidado', color: '#10b981' },
              { label: 'Remessa',   color: '#f59e0b' },
              { label: 'Pendente',  color: '#60a5fa' },
              { label: 'Vencido',   color: '#f87171' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: l.color }} />
                <span style={{ color: 'hsl(var(--text-muted))' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas e próximos vencimentos */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <CalendarDays size={15} color="#818cf8" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alertas & Vencimentos</span>
          </div>

          {vencemHoje.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', marginBottom: 8 }}>
              <AlertCircle size={14} color="#f87171" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>{vencemHoje.length} boleto(s) vencem hoje</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{fmtMoeda(vencemHoje.reduce((s, g) => s + g.valorTotal, 0))}</div>
              </div>
            </div>
          )}

          {vencemSemana.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', marginBottom: 8 }}>
              <Clock size={14} color="#f59e0b" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f59e0b' }}>{vencemSemana.length} vencem nos próximos 7 dias</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{fmtMoeda(vencemSemana.reduce((s, g) => s + g.valorTotal, 0))}</div>
              </div>
            </div>
          )}

          {vencidos.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.12)', marginBottom: 8 }}>
              <TrendingDown size={14} color="#f87171" />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>{vencidos.length} em atraso</div>
                <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{fmtMoeda(valorVencido)} a recuperar</div>
              </div>
            </div>
          )}

          {vencemHoje.length === 0 && vencemSemana.length === 0 && vencidos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: '#10b981', fontSize: 12 }}>
              <CheckCircle2 size={22} style={{ margin: '0 auto 6px' }} />
              <div style={{ fontWeight: 700 }}>Tudo em dia!</div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Nenhum vencimento crítico.</div>
            </div>
          )}

          {/* Sparkline histórico por mês */}
          {barData.length > 1 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid hsl(var(--border-subtle))' }}>
              <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>Boletos por mês de vencimento</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4 }}>
                <MiniBar data={barData} color="#818cf8" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {meses.slice(-2).map(m => (
                    <div key={m} style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>{m.slice(5)}/{m.slice(2, 4)}</div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 3: Top alunos + Métricas secundárias ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* Top alunos por valor */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Users size={15} color="#818cf8" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Alunos por Volume</span>
          </div>
          {topAlunos.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 12, padding: '16px 0' }}>Sem dados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {topAlunos.map(([nome, data], i) => {
                const pct = topAlunos[0] ? (data.valor / topAlunos[0][1].valor) * 100 : 0
                const alu = alunos.find(a => a.nome === nome)
                return (
                  <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                      background: i === 0 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                      color: i === 0 ? '#fbbf24' : 'hsl(var(--text-muted))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800,
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {nome}
                          {alu?.turma && <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginLeft: 6 }}>{alu.turma}</span>}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#818cf8', flexShrink: 0, marginLeft: 8 }}>{fmtMoeda(data.valor)}</span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 99 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#818cf8)', borderRadius: 99 }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Métricas secundárias */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <TrendingUp size={15} color="#818cf8" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Métricas Financeiras</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Total emitidos',     value: grupos.length,          unit: 'boletos',  color: '#60a5fa' },
              { label: 'Multi-evento',        value: grupos.filter(g => g.qtdParcelas > 1).length, unit: 'boletos', color: '#a78bfa' },
              { label: 'Taxa liquidação',     value: `${taxaLiquidacao}%`,   unit: '',         color: '#10b981' },
              { label: 'Taxa inadimplência',  value: `${taxaInadimplencia}%`,unit: '',         color: '#f87171' },
              { label: 'Valor pendente',      value: fmtMoeda(valorPendente),unit: '',         color: '#60a5fa', wide: true },
              { label: 'Valor em remessa',    value: fmtMoeda(valorRemessa), unit: '',         color: '#f59e0b', wide: true },
            ].map(m => (
              <div
                key={m.label}
                style={{
                  padding: '10px 12px', borderRadius: 12,
                  background: 'hsl(var(--bg-elevated))',
                  border: '1px solid hsl(var(--border-subtle))',
                  ...(m as any).wide ? { gridColumn: 'span 2' } : {},
                }}
              >
                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</div>
                <div style={{ fontSize: 18, fontWeight: 900, fontFamily: 'Outfit,sans-serif', color: m.color }}>
                  {m.value}
                  {m.unit && <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 4, color: 'hsl(var(--text-muted))' }}>{m.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>


    </div>
  )
}
