'use client'

import { useData } from '@/lib/dataContext'
import { formatCurrency, formatNumber } from '@/lib/utils'
import { TrendingUp, TrendingDown, Users, DollarSign, AlertTriangle, GraduationCap, UserCheck, Brain, BarChart3, ArrowRight, Activity, Zap, Star, CheckCircle, Clock, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useMemo } from 'react'
import dynamic from 'next/dynamic'

// ── Lazily imported Recharts components to prevent heavy initial bundle and hydration mismatch
const RevenueChartComponent = dynamic(() => import('./DashboardCharts').then(mod => mod.RevenueChartComponent), { ssr: false })
const RisksPieChartComponent = dynamic(() => import('./DashboardCharts').then(mod => mod.RisksPieChartComponent), { ssr: false })
const CostCentersPieChartComponent = dynamic(() => import('./DashboardCharts').then(mod => mod.CostCentersPieChartComponent), { ssr: false })

const ALERT_ICONS: Record<string, React.ReactNode> = {
  critico: <XCircle size={16} color="#f87171" />,
  alto: <AlertTriangle size={16} color="#fbbf24" />,
  medio: <Clock size={16} color="#60a5fa" />,
  info: <CheckCircle size={16} color="#34d399" />,
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  matricula: <UserCheck size={14} color="#34d399" />,
  pagamento: <DollarSign size={14} color="#10b981" />,
  ocorrencia: <AlertTriangle size={14} color="#f59e0b" />,
  comunicado: <Activity size={14} color="#60a5fa" />,
  acesso: <Brain size={14} color="#a78bfa" />,
}

export default function DashboardPage() {
  const {
    alunos = [], turmas = [], titulos = [], contasPagar = [],
    funcionarios = [], leads = [], ocorrencias = [], cfgCentrosCusto = []
  } = useData() || {}

  const hoje = new Date()

  // ── KPIs computados de dados reais e Memoizados ──────────────────────────────

  const {
    totalAlunos, mesStr, mesPrevStr, receitaMes, receitaPrev, varReceita,
    inadimplentes, inadimplenciaRate, taxaOcupacao, novasMatriculas, nFuncionarios,
    riscoAlto, riscoMedio, riscoBaixo, totalRisco, RISCO_EVASAO_DIST
  } = useMemo(() => {
    const totalAlunos = alunos.filter(a => a.status === 'matriculado').length
    const mesStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
    const mesPrev = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
    const mesPrevStr = `${mesPrev.getFullYear()}-${String(mesPrev.getMonth() + 1).padStart(2, '0')}`

    const receitaMes = titulos
      .filter(t => t.status === 'pago' && t.pagamento?.startsWith(mesStr))
      .reduce((s, t) => s + t.valor, 0)
    const receitaPrev = titulos
      .filter(t => t.status === 'pago' && t.pagamento?.startsWith(mesPrevStr))
      .reduce((s, t) => s + t.valor, 0)
    const varReceita = receitaPrev > 0 ? ((receitaMes - receitaPrev) / receitaPrev) * 100 : 0

    const inadimplentes = alunos.filter(a => a.inadimplente).length
    const inadimplenciaRate = alunos.length > 0 ? (inadimplentes / alunos.length) * 100 : 0

    const taxaOcupacao = turmas.length > 0
      ? turmas.reduce((s, t) => s + (t.capacidade > 0 ? (t.matriculados / t.capacidade) * 100 : 0), 0) / turmas.length
      : 0

    const novasMatriculas = leads.filter(l => l.status === 'matriculado').length
    const nFuncionarios = funcionarios.length

    const riscoAlto = alunos.filter(a => a.risco_evasao === 'alto').length
    const riscoMedio = alunos.filter(a => a.risco_evasao === 'medio').length
    const riscoBaixo = alunos.filter(a => a.risco_evasao === 'baixo').length
    const totalRisco = riscoAlto + riscoMedio

    const RISCO_EVASAO_DIST = [
      { nome: 'Baixo', valor: riscoBaixo, fill: '#10b981' },
      { nome: 'Médio', valor: riscoMedio, fill: '#f59e0b' },
      { nome: 'Alto', valor: riscoAlto, fill: '#ef4444' },
    ]

    return {
      totalAlunos, mesStr, mesPrevStr, receitaMes, receitaPrev, varReceita,
      inadimplentes, inadimplenciaRate, taxaOcupacao, novasMatriculas, nFuncionarios,
      riscoAlto, riscoMedio, riscoBaixo, totalRisco, RISCO_EVASAO_DIST
    }
  }, [alunos, titulos, turmas, leads, funcionarios])

  // ── Receita vs despesa por mês (últimos 6 meses) ─────────────────
  const getMonthKey = (dateStr: string | null | undefined) => {
    if (!dateStr) return null
    const d = dateStr.length >= 7 ? dateStr.slice(0, 7) : null
    return d
  }

  const getMonthLabel = (key: string) => {
    const [y, m] = key.split('-')
    const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    return `${names[parseInt(m) - 1]}/${y.slice(2)}`
  }

  const receitaMensal = useMemo(() => {
    const map: Record<string, number> = {}
    titulos.forEach(t => {
      if (t.status === 'pago' && t.pagamento) {
        const k = getMonthKey(t.pagamento)
        if (k) map[k] = (map[k] ?? 0) + t.valor
      }
    })
    return map
  }, [titulos])

  const despesaMensal = useMemo(() => {
    const map: Record<string, number> = {}
    contasPagar.forEach(c => {
      if (c.status === 'pago') {
        const k = getMonthKey(c.vencimento)
        if (k) map[k] = (map[k] ?? 0) + c.valor
      }
    })
    return map
  }, [contasPagar])

  const despesasPorCentroCusto = useMemo(() => {
    const map: Record<string, number> = {}
    contasPagar.forEach(c => {
      if (c.status === 'pago' || c.status === 'pendente' || c.status === 'atrasado') { // Considerando toda a despesa lançada para análise estrutural ou só paga? Vamos pegar tudo do mês atual ou pagas?
        const dStr = c.vencimento
        if (dStr?.startsWith(mesStr)) {
          const nomeCentro = c.centroCustoId ? cfgCentrosCusto.find(x => x.id === c.centroCustoId)?.descricao || 'Não Classificado' : 'Não Classificado'
          map[nomeCentro] = (map[nomeCentro] || 0) + c.valor
        }
      }
    })
    
    // Cores modernas fixas baseadas no índice
    const CORES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b']
    
    return Object.entries(map)
      .sort((a,b) => b[1] - a[1]) // Ordem de valor
      .map(([nome, valor], i) => ({
        nome, valor, fill: CORES[i % CORES.length]
      }))
  }, [contasPagar, cfgCentrosCusto, mesStr])

  const allMonths = Array.from(new Set([...Object.keys(receitaMensal), ...Object.keys(despesaMensal)])).sort().slice(-6)

  const CHART_DATA = allMonths.length > 0
    ? allMonths.map(k => ({ mes: getMonthLabel(k), receita: receitaMensal[k] ?? 0, despesa: despesaMensal[k] ?? 0 }))
    : []

  // ── Ocupação por segmento ─────────────────────────────────────────
  const SEGMENTO_CORES: Record<string, string> = { EI: '#3b82f6', EF1: '#8b5cf6', EF2: '#10b981', EM: '#f59e0b', EJA: '#06b6d4' }
  const SEGMENTO_LABELS: Record<string, string> = { EI: 'Ed. Infantil', EF1: 'Fund. I', EF2: 'Fund. II', EM: 'Ensino Médio', EJA: 'EJA' }

  const OCUPACAO_SEGMENTOS = useMemo(() => {
    const segs: Record<string, { total: number; matriculados: number }> = {}
    turmas.forEach(t => {
      if (!segs[t.serie]) segs[t.serie] = { total: 0, matriculados: 0 }
      segs[t.serie].total += t.capacidade
      segs[t.serie].matriculados += t.matriculados
    })
    return Object.entries(segs).map(([serie, data]) => ({
      segmento: SEGMENTO_LABELS[serie] ?? serie,
      ocupacao: data.total > 0 ? Math.round((data.matriculados / data.total) * 100) : 0,
      total: data.total,
      matriculados: data.matriculados,
      cor: SEGMENTO_CORES[serie] ?? '#6b7280',
    }))
  }, [turmas])

  // ── Alertas críticos gerados de dados reais ───────────────────────
  const ALERTAS_REAIS = useMemo(() => {
    const alertas: { id: string; nivel: string; titulo: string; descricao: string; acao: string; link: string }[] = []

    // Alunos com frequência crítica (<60%)
    const criticos = alunos.filter(a => a.frequencia < 60)
    if (criticos.length > 0) {
      alertas.push({
        id: 'auto-freq', nivel: 'critico',
        titulo: `${criticos.length} aluno${criticos.length > 1 ? 's' : ''} com frequência crítica`,
        descricao: `Abaixo de 60% — ${criticos.map(a => a.nome.split(' ')[0]).join(', ')}`,
        acao: 'Ver alunos', link: '/academico/frequencia',
      })
    }

    // Inadimplência
    const titulosAtrasados = titulos.filter(t => t.status === 'atrasado')
    if (titulosAtrasados.length > 0) {
      const valorTotal = titulosAtrasados.reduce((s, t) => s + t.valor, 0)
      alertas.push({
        id: 'auto-inad', nivel: 'alto',
        titulo: `${formatCurrency(valorTotal)} em títulos atrasados`,
        descricao: `${titulosAtrasados.length} título(s) em atraso sem registro de pagamento`,
        acao: 'Ver inadimplência', link: '/financeiro/inadimplencia',
      })
    }

    // Alunos risco alto
    const riscoAlt = alunos.filter(a => a.risco_evasao === 'alto')
    if (riscoAlt.length > 0) {
      alertas.push({
        id: 'auto-risco', nivel: 'medio',
        titulo: `${riscoAlt.length} aluno${riscoAlt.length > 1 ? 's' : ''} em risco alto de evasão`,
        descricao: 'Classificados por frequência, notas e histórico financeiro',
        acao: 'Ver alunos', link: '/academico/alunos',
      })
    }

    // Contas a pagar vencendo em até 7 dias
    const proxVenc = contasPagar.filter(c => {
      if (c.status === 'pago') return false
      const d = new Date(c.vencimento)
      const diff = (d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
      return diff >= 0 && diff <= 7
    })
    if (proxVenc.length > 0) {
      const val = proxVenc.reduce((s, c) => s + c.valor, 0)
      alertas.push({
        id: 'auto-cp', nivel: 'info',
        titulo: `${proxVenc.length} conta${proxVenc.length > 1 ? 's' : ''} a pagar nos próximos 7 dias`,
        descricao: `Total: ${formatCurrency(val)}`,
        acao: 'Ver contas', link: '/financeiro/pagar',
      })
    }

    // Ocorrências graves não resolvidas
    const ocGraves = ocorrencias.filter(o => o.gravidade === 'grave' && !o.ciencia_responsavel)
    if (ocGraves.length > 0) {
      alertas.push({
        id: 'auto-oc', nivel: 'alto',
        titulo: `${ocGraves.length} ocorrência${ocGraves.length > 1 ? 's' : ''} grave${ocGraves.length > 1 ? 's' : ''} sem ciência`,
        descricao: 'Responsáveis ainda não foram notificados',
        acao: 'Ver ocorrências', link: '/academico/ocorrencias',
      })
    }

    return alertas
  }, [alunos, titulos, contasPagar, ocorrencias])

  const KPIITEMS = [
    { label: 'Total de Alunos', value: formatNumber(totalAlunos), var: 0, icon: <Users size={20} />, color: '#3b82f6' },
    { label: 'Receita do Mês', value: formatCurrency(receitaMes), var: Math.round(varReceita * 10) / 10, icon: <DollarSign size={20} />, color: '#10b981' },
    { label: 'Inadimplência', value: `${inadimplenciaRate.toFixed(1)}%`, var: 0, icon: <TrendingDown size={20} />, color: '#ef4444' },
    { label: 'Taxa de Ocupação', value: `${taxaOcupacao.toFixed(1)}%`, var: 0, icon: <GraduationCap size={20} />, color: '#8b5cf6' },
    { label: 'Novas Matrículas', value: formatNumber(novasMatriculas), var: 0, icon: <UserCheck size={20} />, color: '#f59e0b' },
    { label: 'Funcionários', value: formatNumber(nFuncionarios), var: 0, icon: <Users size={20} />, color: '#06b6d4' },
    { label: 'Turmas Ativas', value: formatNumber(turmas.length), var: 0, icon: <Star size={20} />, color: '#ec4899' },
    { label: 'Risco de Evasão', value: formatNumber(totalRisco), var: 0, icon: <AlertTriangle size={20} />, color: '#f59e0b' },
  ]

  // Empty state quando não há dados
  if (alunos.length === 0 && turmas.length === 0 && funcionarios.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>Hub Executivo</h1>
            <p style={{ fontSize: 14, color: 'hsl(var(--text-muted))' }}>Nenhum dado cadastrado ainda</p>
          </div>
        </div>
        <div className="ia-card" style={{ padding: '24px', textAlign: 'center' }}>
          <Brain size={36} color="#a78bfa" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Comece cadastrando seus dados</div>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginBottom: 16 }}>
            Adicione alunos, turmas e funcionários para ver os KPIs em tempo real.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/academico/alunos" className="btn btn-primary btn-sm">Cadastrar Alunos</Link>
            <Link href="/academico/turmas" className="btn btn-secondary btn-sm">Cadastrar Turmas</Link>
            <Link href="/rh/funcionarios" className="btn btn-secondary btn-sm">Cadastrar Funcionários</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 26, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
            Hub Executivo
          </h1>
          <p style={{ fontSize: 14, color: 'hsl(var(--text-muted))' }}>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/bi" className="btn btn-secondary btn-sm">
            <BarChart3 size={14} />BI Avançado
          </Link>
          <Link href="/ia/copilotos" className="btn" style={{ background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', color: '#fff', gap: 8, fontSize: 13, padding: '8px 16px', borderRadius: 10, boxShadow: '0 4px 12px rgba(139,92,246,0.35)' }}>
            <Brain size={14} />Copiloto IA
          </Link>
        </div>
      </div>

      {/* AI Banner */}
      <div className="ia-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Brain size={22} color="#fff" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
            ✨ Copiloto da Direção — Análise em Tempo Real
          </div>
          <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginTop: 2 }}>
            {alunos.length} alunos cadastrados •{' '}
            {inadimplentes > 0 && <><strong style={{ color: '#f87171' }}>{inadimplentes} inadimplentes </strong>/</>}{' '}
            {riscoAlto > 0 && <><strong style={{ color: '#fbbf24' }}> {riscoAlto} em risco alto</strong> de evasão.</>}
            {' '}Taxa de ocupação: <strong style={{ color: '#34d399' }}>{taxaOcupacao.toFixed(1)}%</strong>.
            {ALERTAS_REAIS.length === 0 && ' Nenhum alerta crítico ativo.'}
          </div>
        </div>
        <Link href="/ia/copilotos" className="btn btn-secondary btn-sm" style={{ flexShrink: 0 }}>
          Conversar <ArrowRight size={13} />
        </Link>
      </div>

      {/* KPI Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {KPIITEMS.map((kpi) => {
          const isNegativeMetric = kpi.label === 'Inadimplência' || kpi.label === 'Risco de Evasão'
          const isGood = kpi.var === 0 ? null : (isNegativeMetric ? kpi.var < 0 : kpi.var > 0)
          return (
            <div key={kpi.label} className="kpi-card" style={{ '--kpi-color': kpi.color } as React.CSSProperties}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ width: 40, height: 40, background: `${kpi.color}1a`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>
                  {kpi.icon}
                </div>
                {kpi.var !== 0 && isGood !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: isGood ? '#34d399' : '#f87171' }}>
                    {isGood ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {Math.abs(kpi.var)}%
                  </div>
                )}
              </div>
              <div style={{ fontSize: 26, fontWeight: 800, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 4 }}>{kpi.label}</div>
            </div>
          )
        })}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr)', gap: 16 }}>
        {/* Revenue Chart */}
        <div className="chart-container">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'hsl(var(--text-primary))' }}>Receita vs Despesa</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>Baseado em títulos pagos e contas quitadas</div>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 3, background: '#3b82f6', borderRadius: 2, display: 'inline-block' }} />Receita</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 3, background: '#ef4444', borderRadius: 2, display: 'inline-block' }} />Despesa</span>
            </div>
          </div>
          <RevenueChartComponent chartData={CHART_DATA} />
        </div>

        {/* Custo Real por Centro (MÊS ATUAL) */}
        <div className="chart-container" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>Contas por Centro de Custo</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 16 }}>Apuração real no mês atual ({getMonthLabel(mesStr)})</div>
          {despesasPorCentroCusto.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Sem despesas no mês
            </div>
          ) : (
            <>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CostCentersPieChartComponent data={despesasPorCentroCusto} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {despesasPorCentroCusto.slice(0, 4).map(r => ( // mostra top 4 na legenda pra não quebrar
                  <div key={r.nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.fill, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ color: 'hsl(var(--text-secondary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{formatCurrency(r.valor)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Evasão Risk Pie */}
        <div className="chart-container" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>Risco de Evasão</div>
          <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginBottom: 16 }}>Distribuição por nível — dados reais</div>
          {alunos.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              Sem alunos cadastrados
            </div>
          ) : (
            <>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RisksPieChartComponent data={RISCO_EVASAO_DIST} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {RISCO_EVASAO_DIST.map(r => (
                  <div key={r.nome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.fill, display: 'inline-block' }} />
                      <span style={{ color: 'hsl(var(--text-secondary))' }}>{r.nome}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{r.valor}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Ocupação + Alertas */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Ocupação por Segmento */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Ocupação por Segmento</div>
          {OCUPACAO_SEGMENTOS.length === 0 ? (
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '20px 0' }}>
              Sem turmas cadastradas
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {OCUPACAO_SEGMENTOS.map(seg => (
                <div key={seg.segmento}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{seg.segmento}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: seg.cor }}>
                      {seg.ocupacao}% <span style={{ color: 'hsl(var(--text-muted))', fontWeight: 400 }}>({seg.matriculados}/{seg.total})</span>
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${seg.ocupacao}%`, background: seg.cor }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas Críticos */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Alertas Críticos</div>
            <Link href="/alertas" className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}>Ver todos <ArrowRight size={11} /></Link>
          </div>
          {ALERTAS_REAIS.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'hsl(var(--text-muted))', fontSize: 13 }}>
              <CheckCircle size={32} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
              Nenhum alerta crítico agora
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {ALERTAS_REAIS.map(a => (
                <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px', borderRadius: 8, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))' }}>
                  <div style={{ flexShrink: 0, marginTop: 2 }}>{ALERT_ICONS[a.nivel]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</div>
                    <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.descricao}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ranking de Risco */}
      {alunos.filter(a => a.risco_evasao !== 'baixo').length > 0 && (
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>🚨 Ranking de Risco — Alunos que precisam de atenção</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--text-muted))', marginTop: 2 }}>Classificados por frequência, notas e histórico financeiro</div>
            </div>
            <Link href="/academico/alunos" className="btn btn-secondary btn-sm">Ver todos</Link>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Aluno</th><th>Turma</th><th>Frequência</th><th>Inadimplente</th><th>Risco IA</th><th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {alunos.filter(a => a.risco_evasao !== 'baixo').slice(0, 10).map((a, i) => (
                  <tr key={a.id}>
                    <td style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}>{i + 1}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ width: 30, height: 30, fontSize: 11, background: a.risco_evasao === 'alto' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: a.risco_evasao === 'alto' ? '#f87171' : '#fbbf24' }}>
                          {a.nome.split(' ')[0][0]}{a.nome.split(' ')[1]?.[0]}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{a.nome}</div>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{a.matricula}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-neutral">{a.turma}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ width: 60, display: 'inline-block' }}>
                          <div className="progress-fill" style={{ width: `${a.frequencia}%`, background: a.frequencia < 65 ? '#ef4444' : a.frequencia < 80 ? '#f59e0b' : '#10b981' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: a.frequencia < 65 ? '#f87171' : a.frequencia < 80 ? '#fbbf24' : '#34d399' }}>{a.frequencia}%</span>
                      </div>
                    </td>
                    <td>{a.inadimplente ? <span className="badge badge-danger">Sim</span> : <span className="badge badge-success">Não</span>}</td>
                    <td>
                      <span className={`badge ${a.risco_evasao === 'alto' ? 'badge-danger' : 'badge-warning'}`} style={{ textTransform: 'capitalize' }}>
                        {a.risco_evasao === 'alto' ? '⚠ Alto' : '⚡ Médio'}
                      </span>
                    </td>
                    <td>
                      <Link href="/academico/alunos/ficha" className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>Ver Ficha</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
