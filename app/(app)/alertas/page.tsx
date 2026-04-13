'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useData } from '@/lib/dataContext'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Bell, AlertTriangle, CheckCircle, Settings, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type AlertaNivel = 'critico' | 'alto' | 'medio' | 'info'
type AlertaCategoria = 'Acadêmico' | 'Financeiro' | 'Sistema' | 'Disciplinar' | 'RH'

interface AlertaGerado {
  id: string
  nivel: AlertaNivel
  titulo: string
  descricao: string
  acao: string
  link: string
  categoria: AlertaCategoria
  timestamp: string
}

const NIVEL_CONFIG: Record<AlertaNivel, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  critico: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', icon: <AlertTriangle size={16} />, label: 'Crítico' },
  alto:    { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: <AlertTriangle size={16} />, label: 'Alto' },
  medio:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.08)', icon: <Bell size={16} />, label: 'Médio' },
  info:    { color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: <CheckCircle size={16} />, label: 'Info' },
}

const FILTROS: (string)[] = ['Todos', 'Crítico', 'Alto', 'Médio', 'Info']
const CATEGORIAS: string[] = ['Todas', 'Acadêmico', 'Financeiro', 'Disciplinar', 'RH', 'Sistema']

export default function AlertasPage() {
  const { ocorrencias = [] } = useData();
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [titulos, setTitulos] = useSupabaseArray<any>('titulos');
  const [contasPagar, setContasPagar] = useSupabaseArray<any>('contas-pagar');
  const [funcionarios, setFuncionarios] = useSupabaseArray<any>('rh/funcionarios');
  const [filtroNivel, setFiltroNivel] = useState('Todos')
  const [filtroCategoria, setFiltroCategoria] = useState('Todas')
  const [lidos, setLidos] = useState<Set<string>>(new Set())

  const hoje = new Date()

  const TODOS_ALERTAS = useMemo<AlertaGerado[]>(() => {
    const alertas: AlertaGerado[] = []

    // ── Acadêmico ──────────────────────────────────────────────────
    // Frequência crítica (<60%)
    const freqCrit = (alunos || []).filter(a => a.frequencia < 60)
    freqCrit.forEach(a => {
      alertas.push({
        id: `freq-${a.id}`, nivel: 'critico',
        titulo: `${a.nome} — Frequência ${a.frequencia}%`,
        descricao: `Abaixo do mínimo legal de 75%. Turma: ${a.turma}. Intervenção urgente necessária.`,
        acao: 'Ver ficha', link: '/academico/alunos/ficha',
        categoria: 'Acadêmico',
        timestamp: new Date().toISOString(),
      })
    })

    // Frequência baixa (60-74%)
    const freqBaixa = (alunos || []).filter(a => a.frequencia >= 60 && a.frequencia < 75)
    if (freqBaixa.length > 0) {
      alertas.push({
        id: 'freq-baixa', nivel: 'alto',
        titulo: `${freqBaixa.length} aluno(s) com frequência abaixo de 75%`,
        descricao: freqBaixa.map(a => `${a.nome.split(' ')[0]} (${a.frequencia}%)`).join(', '),
        acao: 'Ver frequência', link: '/academico/frequencia',
        categoria: 'Acadêmico',
        timestamp: new Date(Date.now() - 30 * 60000).toISOString(),
      })
    }

    // Risco alto de evasão
    const riscoAlto = (alunos || []).filter(a => a.risco_evasao === 'alto')
    if (riscoAlto.length > 0) {
      alertas.push({
        id: 'risco-alto', nivel: 'medio',
        titulo: `${riscoAlto.length} aluno(s) em risco alto de evasão`,
        descricao: riscoAlto.map(a => a.nome.split(' ')[0]).join(', '),
        acao: 'Ver alunos', link: '/academico/alunos',
        categoria: 'Acadêmico',
        timestamp: new Date(Date.now() - 60 * 60000).toISOString(),
      })
    }

    // ── Financeiro ─────────────────────────────────────────────────
    const titulosAtrasados = (titulos || []).filter(t => t.status === 'atrasado')
    if (titulosAtrasados.length > 0) {
      const total = titulosAtrasados.reduce((s, t) => s + t.valor, 0)
      alertas.push({
        id: 'titulos-atraso', nivel: 'critico',
        titulo: `${formatCurrency(total)} em títulos atrasados`,
        descricao: `${titulosAtrasados.length} título(s) vencido(s) sem pagamento registrado`,
        acao: 'Ver inadimplência', link: '/financeiro/inadimplencia',
        categoria: 'Financeiro',
        timestamp: new Date(Date.now() - 2 * 60 * 60000).toISOString(),
      })
    }

    // Contas a pagar vencendo em 7 dias
    const contasProximas = (contasPagar || []).filter(c => {
      if (c.status === 'pago') return false
      const d = new Date(c.vencimento)
      const diff = (d.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24)
      return diff >= 0 && diff <= 7
    })
    if (contasProximas.length > 0) {
      const total = contasProximas.reduce((s, c) => s + c.valor, 0)
      alertas.push({
        id: 'contas-proximas', nivel: 'alto',
        titulo: `${contasProximas.length} conta(s) a pagar nos próximos 7 dias`,
        descricao: `Total: ${formatCurrency(total)}`,
        acao: 'Ver contas', link: '/financeiro/pagar',
        categoria: 'Financeiro',
        timestamp: new Date(Date.now() - 3 * 60 * 60000).toISOString(),
      })
    }

    // Contas vencidas
    const contasVencidas = (contasPagar || []).filter(c => {
      if (c.status === 'pago') return false
      return new Date(c.vencimento) < hoje
    })
    if (contasVencidas.length > 0) {
      alertas.push({
        id: 'contas-vencidas', nivel: 'critico',
        titulo: `${contasVencidas.length} conta(s) a pagar vencida(s)`,
        descricao: contasVencidas.map(c => c.descricao).slice(0, 2).join(', '),
        acao: 'Ver contas', link: '/financeiro/pagar',
        categoria: 'Financeiro',
        timestamp: new Date(Date.now() - 4 * 60 * 60000).toISOString(),
      })
    }

    // ── Disciplinar ────────────────────────────────────────────────
    const ocGraves = (ocorrencias || []).filter(o => o.gravidade === 'grave' && !o.ciencia_responsavel)
    if (ocGraves.length > 0) {
      alertas.push({
        id: 'oc-graves', nivel: 'alto',
        titulo: `${ocGraves.length} ocorrência(s) grave(s) sem ciência do responsável`,
        descricao: ocGraves.map(o => `${o.alunoNome} (${o.tipo})`).join(', '),
        acao: 'Ver ocorrências', link: '/academico/ocorrencias',
        categoria: 'Disciplinar',
        timestamp: new Date(Date.now() - 5 * 60 * 60000).toISOString(),
      })
    }

    const ocPendentes = (ocorrencias || []).filter(o => !o.ciencia_responsavel && o.gravidade !== 'grave')
    if (ocPendentes.length > 0) {
      alertas.push({
        id: 'oc-pendentes', nivel: 'medio',
        titulo: `${ocPendentes.length} ocorrência(s) aguardando ciência`,
        descricao: 'Responsáveis ainda não confirmaram ciência',
        acao: 'Ver ocorrências', link: '/academico/ocorrencias',
        categoria: 'Disciplinar',
        timestamp: new Date(Date.now() - 6 * 60 * 60000).toISOString(),
      })
    }

    // ── RH ─────────────────────────────────────────────────────────
    if ((funcionarios || []).length === 0 && (alunos || []).length > 0) {
      alertas.push({
        id: 'rh-sem-func', nivel: 'info',
        titulo: 'Nenhum funcionário cadastrado',
        descricao: 'Cadastre funcionários no módulo de RH para gestão completa',
        acao: 'Cadastrar', link: '/rh/funcionarios',
        categoria: 'RH',
        timestamp: new Date(Date.now() - 7 * 60 * 60000).toISOString(),
      })
    }

    // Info positivo quando tudo está bem
    if (alertas.filter(a => a.nivel === 'critico' || a.nivel === 'alto').length === 0 && (alunos || []).length > 0) {
      alertas.push({
        id: 'info-ok', nivel: 'info',
        titulo: 'Sistema sem alertas críticos',
        descricao: 'Frequência, financeiro e disciplina dentro dos parâmetros esperados.',
        acao: 'Ver dashboard', link: '/dashboard',
        categoria: 'Sistema',
        timestamp: new Date().toISOString(),
      })
    }

    return alertas.sort((a, b) => {
      const order: Record<AlertaNivel, number> = { critico: 0, alto: 1, medio: 2, info: 3 }
      return order[a.nivel] - order[b.nivel]
    })
  }, [alunos, titulos, contasPagar, ocorrencias, funcionarios])

  const filtered = TODOS_ALERTAS.filter(a => {
    const matchNivel = filtroNivel === 'Todos' || NIVEL_CONFIG[a.nivel]?.label === filtroNivel
    const matchCat = filtroCategoria === 'Todas' || a.categoria === filtroCategoria
    return matchNivel && matchCat
  })

  const naoLidos = TODOS_ALERTAS.filter(a => !lidos.has(a.id)).length
  const criticos = TODOS_ALERTAS.filter(a => a.nivel === 'critico').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Central de Alertas</h1>
          <p className="page-subtitle">{naoLidos} não lidos • {criticos} críticos agora — dados em tempo real</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setLidos(new Set(TODOS_ALERTAS.map(a => a.id)))}>
            <CheckCircle size={13} />Marcar todos como lidos
          </button>
          <button className="btn btn-secondary btn-sm"><Settings size={13} />Configurar alertas</button>
        </div>
      </div>

      {/* KPI resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Críticos', value: TODOS_ALERTAS.filter(a => a.nivel === 'critico').length, color: '#ef4444', icon: '🚨' },
          { label: 'Alta prioridade', value: TODOS_ALERTAS.filter(a => a.nivel === 'alto').length, color: '#f59e0b', icon: '⚠️' },
          { label: 'Médios', value: TODOS_ALERTAS.filter(a => a.nivel === 'medio').length, color: '#3b82f6', icon: '🔔' },
          { label: 'Informativos', value: TODOS_ALERTAS.filter(a => a.nivel === 'info').length, color: '#10b981', icon: 'ℹ️' },
        ].map(c => (
          <div key={c.label} className="kpi-card" style={{ cursor: 'pointer' }} onClick={() => setFiltroNivel(c.label === 'Alta prioridade' ? 'Alto' : c.label === 'Informativos' ? 'Info' : c.label)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{c.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color, fontFamily: 'Outfit, sans-serif' }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTROS.map(f => (
          <button key={f} className={`btn ${filtroNivel === f ? 'btn-primary' : 'btn-secondary'} btn-sm`} onClick={() => setFiltroNivel(f)}>{f}</button>
        ))}
        <div style={{ width: 1, background: 'hsl(var(--border-subtle))', margin: '0 4px' }} />
        {CATEGORIAS.map(c => (
          <button key={c} className={`btn ${filtroCategoria === c ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => setFiltroCategoria(c)}>{c}</button>
        ))}
      </div>

      {/* Lista de alertas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(alunos || []).length === 0 && (titulos || []).length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
            <Bell size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Nenhum dado para gerar alertas</div>
            <div style={{ fontSize: 13 }}>Cadastre alunos, turmas e títulos para ver alertas automáticos.</div>
          </div>
        ) : (
          filtered.map(alerta => {
            const cfg = NIVEL_CONFIG[alerta.nivel]
            const lido = lidos.has(alerta.id)
            return (
              <div key={alerta.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 20px', background: lido ? 'hsl(var(--bg-surface))' : cfg.bg, border: `1px solid ${lido ? 'hsl(var(--border-subtle))' : cfg.color + '33'}`, borderLeft: `4px solid ${lido ? 'hsl(var(--border-subtle))' : cfg.color}`, borderRadius: 12, opacity: lido ? 0.6 : 1, transition: 'all 0.2s' }}>
                <div style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }}>{cfg.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>{alerta.titulo}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 100, background: cfg.color + '20', color: cfg.color, fontWeight: 700 }}>{cfg.label}</span>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 100, background: 'rgba(100,116,139,0.15)', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{alerta.categoria}</span>
                    {!lido && <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.color, boxShadow: `0 0 6px ${cfg.color}`, flexShrink: 0 }} />}
                  </div>
                  <div style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>{alerta.descricao}</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                    {new Date(alerta.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <Link href={alerta.link} className="btn btn-primary btn-sm" style={{ fontSize: 11 }}>{alerta.acao}</Link>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setLidos(s => new Set([...s, alerta.id]))} title="Marcar como lido"><X size={13} /></button>
                </div>
              </div>
            )
          })
        )}
        {filtered.length === 0 && TODOS_ALERTAS.length > 0 && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
            <CheckCircle size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div>Nenhum alerta para os filtros selecionados.</div>
          </div>
        )}
      </div>
    </div>
  )
}
