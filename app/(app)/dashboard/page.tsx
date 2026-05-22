'use client'

import { useApiQuery } from '@/hooks/useApi'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { SaidaProvider, useSaida } from '@/lib/saidaContext'
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton'
import { formatNumber, formatCurrency } from '@/lib/utils'
import { useData, Tarefa } from '@/lib/dataContext'
import { 
  Users, AlertTriangle, GraduationCap, UserCheck, Brain, 
  ArrowRight, Activity, Zap, CheckCircle, Clock, XCircle, 
  Calendar as CalendarIcon, RefreshCw, Bell, ClipboardCheck,
  Gift, Heart, LogOut, Sparkles, BookMarked, PackageCheck
} from 'lucide-react'
import Link from 'next/link'
import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Accent
const ACCENT = '#6366f1'

// ── Utils
const fmtPct = (v: number) => `${v.toFixed(1)}%`
const getInitials = (nome: string) => {
  const p = nome?.trim().split(' ').filter(Boolean)
  if (!p?.length) return '?'
  return `${p[0]?.[0] ?? ''}${p[1]?.[0] ?? ''}`.toUpperCase()
}

const NIVEL_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  critico: { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.3)',  icon: '#ef4444' },
  alto:    { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.3)', icon: '#f59e0b' },
  medio:   { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.25)',icon: '#3b82f6' },
  info:    { bg: 'rgba(16,185,129,0.07)', border: 'rgba(16,185,129,0.25)',icon: '#10b981' },
}

const NIVEL_ICON: Record<string, React.ReactNode> = {
  critico: <XCircle     size={14} color="#ef4444" />,
  alto:    <AlertTriangle size={14} color="#f59e0b" />,
  medio:   <Clock        size={14} color="#3b82f6" />,
  info:    <CheckCircle  size={14} color="#10b981" />,
}

function MonitorSaidaCard() {
  const { activeCalls = [] } = useSaida()
  
  return (
    <div className="card" style={{ padding: '24px 20px', borderRadius: '28px', border: '1px solid hsl(var(--border-subtle))' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(245, 158, 11, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LogOut size={20} color="#f59e0b" />
          </div>
          <span style={{ fontWeight: 900, fontSize: '18px', fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))' }}>Saída de Alunos (Tempo Real)</span>
        </div>
        <Link href="/saida-alunos/monitor" style={{ fontSize: '12px', color: ACCENT, textDecoration: 'none', fontWeight: 800 }}>Ver Monitor</Link>
      </div>

      {/* Filtros estilo Imagem */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', alignSelf: 'center', marginRight: 4, letterSpacing: '0.05em' }}>FILTROS</span>
        <button className="btn btn-secondary btn-sm" style={{ borderRadius: 20, fontSize: 11, padding: '6px 14px', fontWeight: 700 }}>Todos <span style={{ opacity: 0.5, marginLeft: 4 }}>{activeCalls.length}</span></button>
        <button className="btn btn-secondary btn-sm" style={{ borderRadius: 20, fontSize: 11, padding: '6px 14px', border: '1px solid #f59e0b', color: '#f59e0b', fontWeight: 700 }}>Aguardando <span style={{ opacity: 0.7, marginLeft: 4 }}>{activeCalls.filter((c: any) => c.status === 'waiting' || c.status === 'called').length}</span></button>
      </div>

      {activeCalls.length === 0 ? (
        <div style={{ fontSize: '13px', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '36px 0', fontWeight: 600 }}>
          Nenhuma chamada de saída registrada hoje.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {activeCalls.slice(0, 4).map((chamada: any) => {
            const isAguardando = chamada.status === 'waiting' || chamada.status === 'called' || !chamada.status
            const timeStr = chamada.time || (chamada.calledAt ? chamada.calledAt.slice(11, 16) : '00:00')
            
            return (
              <div key={chamada.id} style={{ 
                display: 'flex', 
                alignItems: 'center',
                gap: 16,
                padding: '16px 20px',
                background: isAguardando ? 'rgba(245,158,11,0.03)' : 'hsl(var(--bg-elevated))', 
                borderRadius: 20, 
                border: isAguardando ? '1px solid rgba(245,158,11,0.2)' : '1px solid hsl(var(--border-subtle))',
                boxShadow: isAguardando ? '0 4px 12px rgba(245,158,11,0.05)' : 'none',
              }}>
                {/* Avatar */}
                <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid hsl(var(--border-subtle))' }}>
                  {chamada.student_photo || chamada.studentPhoto ? (
                    <img src={chamada.student_photo || chamada.studentPhoto} alt={chamada.student_name || chamada.studentName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#94a3b8', fontWeight: 800, background: '#f1f5f9' }}>
                      {getInitials(chamada.student_name || chamada.studentName || 'A')}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 850, fontSize: '15px', color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {chamada.student_name || chamada.studentName}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.08)', padding: '2px 8px', borderRadius: 6 }}>
                      {chamada.student_class || chamada.studentClass || 'S/T'}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>👤 {chamada.guardian_name || chamada.guardianName || 'Não informado'}</span>
                    <span>•</span>
                    <span style={{ color: '#f59e0b', fontWeight: 800 }}>{timeStr}</span>
                  </div>
                </div>

                {/* Status & Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', color: isAguardando ? '#f59e0b' : '#10b981', letterSpacing: '0.04em' }}>
                    {isAguardando ? 'Aguardando' : 'Confirmado'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" style={{ padding: '0 16px', fontSize: 12, height: 34, borderRadius: 10, background: isAguardando ? '#f59e0b' : '#10b981', border: 'none', fontWeight: 800 }}>
                      {isAguardando ? 'Chamar' : 'OK'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const hoje = new Date()
  const mesStr  = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const mesPrev = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  const mesPrevStr = `${mesPrev.getFullYear()}-${String(mesPrev.getMonth() + 1).padStart(2, '0')}`
  const [refreshKey, setRefreshKey] = useState(0)

  // ── Context Data (Calendar & Tasks)
  const { tarefas = [], setTarefas, eventosAgenda = [], turmas = [] } = useData()

  // ── Data for Alerts
  const [alunos, , { loading: loadAlunos }] = useSupabaseArray<any>('alunos?limit=1000')
  const [titulos, , { loading: loadTitulos }] = useSupabaseArray<any>('titulos')
  const [contasPagar, , { loading: loadContas }] = useSupabaseArray<any>('contas-pagar')
  const [pedidos, , { loading: loadPedidosMeta }] = useSupabaseArray<any>('administrativo/pedidos-livros')
  const [pedidosManuais, , { loading: loadPedidosManuais }] = useSupabaseArray<any>('administrativo/pedidos-livros-manuais')

  // ── Ocorrências
  const { data: ocorrData } = useApiQuery<any>(
    ['dash-ocorr'],
    `/api/ocorrencias`,
    {},
    { staleTime: 120_000 }
  )
  const ocorrencias: any[] = Array.isArray(ocorrData) ? ocorrData : []

  // ── KPI principal (server-side aggregated)
  const { data: kpiData, isLoading: loadKpis } = useApiQuery<any>(
    ['dashboard-kpis', mesStr, mesPrevStr, String(refreshKey)],
    `/api/financeiro/dashboard?mes=${mesStr}&mesPrev=${mesPrevStr}`,
    {}
  )
  const kpis = kpiData || {}
  const {
    totalAlunos = 0, taxaOcupacao = 0,
    novasMatriculas = 0,
  } = kpis

  // ── Data for Alerts (RH)
  const [funcionarios, , { loading: loadFuncs }] = useSupabaseArray<any>('rh/funcionarios')

  // ── Alertas (Gerados no cliente para consistência com /alertas)
  const alertas = useMemo(() => {
    const alertas: any[] = []

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
      const order: Record<string, number> = { critico: 0, alto: 1, medio: 2, info: 3 }
      return order[a.nivel] - order[b.nivel]
    })
  }, [alunos, titulos, contasPagar, ocorrencias, funcionarios])

  // ── Handlers
  function handleRefresh() {
    setRefreshKey(k => k + 1)
  }

  const toggleTaskStatus = (id: string, current: string) => {
    const next = current === 'pendente' ? 'em-andamento' : current === 'em-andamento' ? 'concluida' : 'pendente'
    setTarefas((prev: Tarefa[]) => prev.map(t => t.id === id ? { ...t, status: next } : t))
  }

  // ── Derived Data
  const todayStr = hoje.toISOString().slice(0, 10)
  const yesterday = new Date(hoje)
  yesterday.setDate(hoje.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const tarefasPendentes = tarefas.filter(t => t.status !== 'concluida')
  
  const eventosOntem = eventosAgenda.filter(e => e.data === yesterdayStr)
  const eventosHoje = eventosAgenda.filter(e => e.data === todayStr)
  const eventosProximos = eventosAgenda.filter(e => e.data > todayStr).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 5)

  const kpiCards = [
    { label: 'Total de Alunos', value: formatNumber(totalAlunos), icon: <Users size={22} />, color: '#3b82f6', sub: 'Matriculados ativos' },
    { label: 'Taxa de Ocupação', value: fmtPct(taxaOcupacao), icon: <GraduationCap size={22} />, color: '#8b5cf6', sub: 'Capacidade física' },
    { label: 'Novas Matrículas', value: formatNumber(novasMatriculas), icon: <UserCheck size={22} />, color: '#10b981', sub: 'Este mês' },
    { label: 'Ocorrências', value: formatNumber(ocorrencias.length), icon: <AlertTriangle size={22} />, color: '#f59e0b', sub: 'Registradas' },
  ]

  const aniversariantes = useMemo(() => {
    if (!alunos || alunos.length === 0) return []

    const hoje = new Date()
    const currentYear = hoje.getFullYear()
    
    // Início e fim da semana atual (Domingo a Sábado)
    const startOfWeek = new Date(hoje)
    startOfWeek.setDate(hoje.getDate() - hoje.getDay()) // Domingo
    startOfWeek.setHours(0, 0, 0, 0)

    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // Sábado
    endOfWeek.setHours(23, 59, 59, 999)

    return (alunos || [])
      .map((aluno: any) => {
        if (!aluno.data_nascimento) return null
        
        // Evita problema de timezone usando split
        const parts = aluno.data_nascimento.split('-')
        if (parts.length < 3) return null
        
        const bYear = parseInt(parts[0])
        const bMonth = parseInt(parts[1]) - 1
        const bDay = parseInt(parts[2])
        
        // Criar data de aniversário no ano corrente (local time)
        const birthdayThisYear = new Date(currentYear, bMonth, bDay)
        
        // Filtra pelo MÊS ATUAL para bater com o título do card na imagem
        if (bMonth === hoje.getMonth()) {
          const t = turmas.find((t:any) => t.id === aluno.turma || t.codigo === aluno.turma)
          return {
            id: aluno.id,
            nome: aluno.nome,
            dia: bDay,
            turma: t?.nome || aluno.turma || 'S/T',
            foto: aluno.foto,
            timestamp: birthdayThisYear.getTime()
          }
        }
        return null
      })
      .filter((a): a is any => a !== null)
      .sort((a, b) => a.timestamp - b.timestamp)
  }, [alunos, turmas])

  const ordersSummary = useMemo(() => {
    const EVENTOS_LIVROS = ['livros', 'apostilas em', 'apostilas fund2', 'apostila em', 'apostila fund2', 'apostilas ens. médio']
    function isEventoLivro(descricao?: string): boolean {
      if (!descricao) return false
      const d = descricao.toLowerCase()
      return EVENTOS_LIVROS.some(e => d.includes(e))
    }

    const resolverDesc = (raw: any): string => {
      if (raw.evento?.trim()) return raw.evento.trim()
      if (raw.eventoDescricao?.trim()) return raw.eventoDescricao.trim()
      return raw.descricao?.trim() ?? ''
    }

    // 1. Student parcelas
    const parcelasDeAlunos: any[] = []
    for (const alu of (alunos || [])) {
      const parcs: any[] = alu.parcelas ?? []
      for (const p of parcs) {
        const desc = resolverDesc(p)
        if (!isEventoLivro(desc)) continue
        parcelasDeAlunos.push({
          id: `alu-${alu.id}-p-${p.num ?? p.codigo ?? String(Math.random()).slice(2)}`,
          aluno: alu.nome,
          eventoDescricao: desc,
          valor: Number(p.valor) || 0,
        })
      }
    }

    // 2. Title parcelas
    const parcelasDeTitulos: any[] = (titulos || [])
      .filter(t => isEventoLivro(resolverDesc({
        eventoDescricao: t.eventoDescricao, descricao: t.descricao
      })))
      .map(t => ({
        id: t.id,
        aluno: t.aluno,
        eventoDescricao: resolverDesc({
          eventoDescricao: t.eventoDescricao, descricao: t.descricao
        }),
        valor: t.valor,
      }))

    const alunosComParcDiretas = new Set(parcelasDeAlunos.map(p => p.aluno))
    const titulosFiltrados = parcelasDeTitulos.filter(p => !alunosComParcDiretas.has(p.aluno))
    const todasParcelas = [...parcelasDeAlunos, ...titulosFiltrados, ...(Array.isArray(pedidosManuais) ? pedidosManuais : [])]

    // Now group them to matching pedidos meta
    const map = new Map<string, any>()
    let totalValue = 0
    let entregueCount = 0
    let preparadoCount = 0
    let pendenteCount = 0

    for (const p of todasParcelas) {
      const key = `${p.aluno}__${p.eventoDescricao}`
      const pMeta = (pedidos || []).find((x: any) => x.tituloId === p.id)
      const feito = pMeta?.feito ?? false
      const entregue = pMeta?.entregue ?? false

      if (!map.has(key)) {
        map.set(key, {
          id: p.id,
          aluno: p.aluno,
          material: p.eventoDescricao,
          valor: 0,
          feito,
          entregue
        })
      } else {
        const existing = map.get(key)
        if (feito) existing.feito = true
        if (entregue) existing.entregue = true
      }
      map.get(key).valor += p.valor
      totalValue += p.valor
    }

    const uniqueOrders = Array.from(map.values())
    uniqueOrders.forEach(o => {
      if (o.entregue) entregueCount++
      else if (o.feito) preparadoCount++
      else pendenteCount++
    })

    return {
      totalOrders: uniqueOrders.length,
      totalValue,
      entregueCount,
      preparadoCount,
      pendenteCount,
      recentOrders: uniqueOrders.slice(0, 3) // Recent 3 orders to showcase
    }
  }, [alunos, titulos, pedidos, pedidosManuais])

  const isGlobalLoading = loadKpis || loadAlunos || loadTitulos || loadContas || loadFuncs || loadPedidosMeta || loadPedidosManuais

  if (isGlobalLoading) return <DashboardSkeleton />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ═══ HEADER ══════════════════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 30, fontWeight: 900, color: 'hsl(var(--text-primary))', letterSpacing: '-0.02em' }}>
            Dashboard
          </h1>
          <p style={{ fontSize: 14, color: 'hsl(var(--text-muted))', fontWeight: 500 }}>
            Hub de Gestão Escolar e Métricas do ERP
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={handleRefresh} className="btn btn-ghost btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, padding: '8px 16px' }}>
            <RefreshCw size={14} /> Atualizar Painel
          </button>
        </div>
      </div>

      {/* ═══ MAIN LAYOUT (2 COLUMNS) ══════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 28, alignItems: 'start' }}>

        {/* ── COLUNA ESQUERDA (Operacional - Centro) ───────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* KPI Grid (1x4) - REDESENHADO & MAIOR */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {kpiCards.map((kpi) => (
              <div 
                key={kpi.label} 
                className="kpi-card" 
                style={{ 
                  padding: '28px 24px', 
                  borderRadius: '24px',
                  display: 'flex', 
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s, border-color 0.3s',
                  border: '1px solid hsl(var(--border-subtle))',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.01), 0 2px 4px -1px rgba(0,0,0,0.01)'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-4px)'
                  e.currentTarget.style.boxShadow = `0 20px 25px -5px ${kpi.color}0c, 0 10px 10px -5px ${kpi.color}06`
                  e.currentTarget.style.borderColor = `${kpi.color}35`
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none'
                  e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0,0,0,0.01), 0 2px 4px -1px rgba(0,0,0,0.01)'
                  e.currentTarget.style.borderColor = 'hsl(var(--border-subtle))'
                }}
              >
                {/* Subtle top indicator bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: kpi.color }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'hsl(var(--text-muted))', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {kpi.label}
                  </span>
                  <div style={{ 
                    width: 44, 
                    height: 44, 
                    background: `${kpi.color}10`, 
                    borderRadius: '12px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: kpi.color 
                  }}>
                    {kpi.icon}
                  </div>
                </div>

                <div style={{ 
                  fontSize: '36px', 
                  fontWeight: 900, 
                  color: 'hsl(var(--text-primary))', 
                  fontFamily: 'Outfit, sans-serif',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  marginBottom: 6
                }}>
                  {kpi.value}
                </div>

                <div style={{ 
                  fontSize: '12px', 
                  color: 'hsl(var(--text-muted))', 
                  fontWeight: 700,
                  marginTop: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: kpi.color }} />
                  {kpi.sub}
                </div>
              </div>
            ))}
          </div>

          {/* Grid para Alertas, Tarefas e Agenda lado a lado - MAIS ESPAÇOSO */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            
            {/* Card: Rastreamento de Pedidos de Livros (Ultra-Moderno - Ajustado para Coluna) */}
            <div 
              className="card" 
              style={{ 
                padding: '26px 22px', 
                borderRadius: '24px',
                border: '1px solid hsl(var(--border-subtle))',
                background: 'linear-gradient(135deg, hsl(var(--bg-surface)), rgba(99, 102, 241, 0.02))',
                boxShadow: '0 4px 10px rgba(0,0,0,0.01)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform 0.3s, box-shadow 0.3s',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                justifyContent: 'space-between'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(0, 0, 0, 0.04)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              {/* Glow background */}
              <div style={{ position: 'absolute', top: -120, right: -120, width: 220, height: 220, borderRadius: '50%', background: 'rgba(99,102,241,0.03)', filter: 'blur(40px)', pointerEvents: 'none' }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(99, 102, 241, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookMarked size={16} color="#6366f1" />
                    </div>
                    <span style={{ fontWeight: 900, fontSize: '13.5px', fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))' }}>Pedido de Livros/Apost</span>
                  </div>
                  <Link href="/administrativo/pedidos-livros" style={{ fontSize: '11px', color: '#6366f1', textDecoration: 'none', fontWeight: 800 }}>Ver todos</Link>
                </div>

                {/* Quick Stats Grid 2x2 */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ background: 'hsl(var(--bg-elevated))', padding: '6px 8px', borderRadius: '10px', border: '1px solid hsl(var(--border-subtle))' }}>
                    <div style={{ fontSize: '8px', color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase' }}>Total</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif' }}>{ordersSummary.totalOrders}</div>
                  </div>
                  <div style={{ background: 'rgba(239, 68, 68, 0.02)', padding: '6px 8px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.06)' }}>
                    <div style={{ fontSize: '8px', color: '#ef4444', fontWeight: 700, textTransform: 'uppercase' }}>Pend.</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#ef4444', fontFamily: 'Outfit, sans-serif' }}>{ordersSummary.pendenteCount}</div>
                  </div>
                  <div style={{ background: 'rgba(245, 158, 11, 0.02)', padding: '6px 8px', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.06)' }}>
                    <div style={{ fontSize: '8px', color: '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>Prep.</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#f59e0b', fontFamily: 'Outfit, sans-serif' }}>{ordersSummary.preparadoCount}</div>
                  </div>
                  <div style={{ background: 'rgba(16, 185, 129, 0.02)', padding: '6px 8px', borderRadius: '10px', border: '1px solid rgba(16, 185, 129, 0.06)' }}>
                    <div style={{ fontSize: '8px', color: '#10b981', fontWeight: 700, textTransform: 'uppercase' }}>Entr.</div>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#10b981', fontFamily: 'Outfit, sans-serif' }}>{ordersSummary.entregueCount}</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>
                    <span>Taxa de Entrega</span>
                    <span style={{ color: '#10b981' }}>{ordersSummary.totalOrders > 0 ? ((ordersSummary.entregueCount / ordersSummary.totalOrders) * 100).toFixed(0) : 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: 4, background: 'hsl(var(--bg-elevated))', borderRadius: 2, overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${ordersSummary.totalOrders > 0 ? (ordersSummary.entregueCount / ordersSummary.totalOrders) * 100 : 0}%`, height: '100%', background: '#10b981' }} />
                    <div style={{ width: `${ordersSummary.totalOrders > 0 ? (ordersSummary.preparadoCount / ordersSummary.totalOrders) * 100 : 0}%`, height: '100%', background: '#f59e0b' }} />
                  </div>
                </div>
              </div>

              {/* Recent Orders List (Limited to 2 items) */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: '9px', fontWeight: 800, color: 'hsl(var(--text-muted))', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recentes</div>
                {ordersSummary.recentOrders.length === 0 ? (
                  <div style={{ fontSize: '11px', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '4px 0', fontWeight: 600 }}>Nenhum material.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {ordersSummary.recentOrders.slice(0, 2).map((o) => {
                      const statusColor = o.entregue ? '#10b981' : o.feito ? '#f59e0b' : '#ef4444'
                      return (
                        <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: '8px', gap: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.aluno}</div>
                            <div style={{ fontSize: '9px', color: 'hsl(var(--text-muted))', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.material}</div>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '11px', fontWeight: 900, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif' }}>{formatCurrency(o.valor)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Card: Minhas Tarefas */}
            <div 
              className="card neon-aura-card" 
              style={{ 
                padding: '26px 22px', 
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(16, 185, 129, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ClipboardCheck size={20} color="#10b981" />
                  </div>
                  <span style={{ fontWeight: 900, fontSize: '18px', fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))' }}>Tarefas</span>
                </div>
                <Link href="/tarefas" style={{ fontSize: '12px', color: ACCENT, textDecoration: 'none', fontWeight: 800 }}>Ver todas</Link>
              </div>
              {tarefasPendentes.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: '8px' }}>
                  <CheckCircle size={24} style={{ color: 'hsl(var(--text-muted))', opacity: 0.5 }} />
                  <div style={{ fontSize: '13px', color: 'hsl(var(--text-muted))', textAlign: 'center', fontWeight: 600 }}>
                    Nenhuma tarefa pendente
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {tarefasPendentes.slice(0, 3).map((t, index) => {
                    const colors = [
                      'rgba(59,130,246,0.04)', // Blue
                      'rgba(16,185,129,0.04)', // Green
                      'rgba(245,158,11,0.04)', // Yellow
                      'rgba(139,92,246,0.04)', // Purple
                    ]
                    const bg = colors[index % colors.length]
                    const borderColors = [
                      'rgba(59,130,246,0.15)',
                      'rgba(16,185,129,0.15)',
                      'rgba(245,158,11,0.15)',
                      'rgba(139,92,246,0.15)',
                    ]
                    const borderColor = borderColors[index % borderColors.length]
                    
                    return (
                      <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', background: bg, border: `1px solid ${borderColor}`, borderRadius: '14px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.titulo}
                        </div>
                        <div style={{ display: 'flex', gap: 12, fontSize: '11px', color: 'hsl(var(--text-muted))', fontWeight: 700 }}>
                          {t.prazo && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>📅 {t.prazo}</span>}
                          {t.prioridade && <span style={{ textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>⚡ {t.prioridade}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Card: Agenda */}
            <div 
              className="card" 
              style={{ 
                padding: '26px 22px', 
                borderRadius: '24px',
                border: '1px solid hsl(var(--border-subtle))',
                transition: 'transform 0.3s, box-shadow 0.3s',
                cursor: 'pointer'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(0, 0, 0, 0.04)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(139, 92, 246, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarIcon size={20} color="#8b5cf6" />
                  </div>
                  <span style={{ fontWeight: 900, fontSize: '18px', fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))' }}>Agenda</span>
                </div>
                <Link href="/calendario" style={{ fontSize: '12px', color: ACCENT, textDecoration: 'none', fontWeight: 800 }}>Abrir</Link>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                
                {/* Ontem */}
                {eventosOntem.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'hsl(var(--text-muted))', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ontem</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {eventosOntem.slice(0, 1).map(e => (
                        <div key={e.id} style={{ padding: '8px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: '10px', borderLeft: `4px solid ${e.cor || '#6b7280'}`, boxShadow: '0 2px 5px rgba(0,0,0,0.01)' }}>
                          <div style={{ fontSize: '12px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'hsl(var(--text-primary))' }}>{e.titulo}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hoje */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: ACCENT, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hoje</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {eventosHoje.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', fontWeight: 600, padding: '4px 0' }}>Sem eventos programados</div>
                    ) : (
                      eventosHoje.slice(0, 2).map(e => (
                        <div key={e.id} style={{ padding: '8px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: '10px', borderLeft: `4px solid ${e.cor || '#6b7280'}`, boxShadow: '0 2px 5px rgba(0,0,0,0.01)' }}>
                          <div style={{ fontSize: '12px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'hsl(var(--text-primary))' }}>{e.titulo}</div>
                          {e.horaInicio && <div style={{ fontSize: '10px', color: 'hsl(var(--text-muted))', fontWeight: 700, marginTop: 4 }}>🕒 {e.horaInicio}</div>}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Próximos */}
                {eventosProximos.length > 0 && (
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: 'hsl(var(--text-muted))', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Próximos</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {eventosProximos.slice(0, 2).map(e => (
                        <div key={e.id} style={{ padding: '8px 12px', background: 'hsl(var(--bg-elevated))', borderRadius: '10px', borderLeft: `4px solid ${e.cor || '#6b7280'}`, boxShadow: '0 2px 5px rgba(0,0,0,0.01)' }}>
                          <div style={{ fontSize: '12px', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'hsl(var(--text-primary))' }}>{e.titulo}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <SaidaProvider>
            <MonitorSaidaCard />
          </SaidaProvider>

        </div>

        {/* ── COLUNA DIREITA (Apoio - Comunidade) ──────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Aniversariantes do Mês (Estilo Premium) */}
          <div className="card" style={{ padding: '28px 24px', borderRadius: '28px', background: '#fff', border: '1px solid #fce7f3', boxShadow: '0 10px 40px rgba(236,72,153,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={24} style={{ color: '#ec4899', filter: 'drop-shadow(0 0 8px rgba(236, 72, 153, 0.3))' }} />
                <div style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: '50%', background: '#ec4899' }} />
              </div>
              <span style={{ fontWeight: 900, fontSize: '19px', color: '#111827', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
                Aniversariantes de {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(hoje).charAt(0).toUpperCase() + new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(hoje).slice(1)}
              </span>
            </div>

            <div className="pink-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '272px', overflowY: 'auto', paddingRight: '6px' }}>
              {aniversariantes.length === 0 ? (
                <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '24px 0', fontWeight: 600 }}>Nenhum aniversariante este mês</div>
              ) : (
                aniversariantes.map(aniv => (
                  <motion.div 
                    whileHover={{ scale: 1.02 }}
                    key={aniv.id} 
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', 
                      background: '#fff', borderRadius: 20, 
                      border: '1px solid #fce7f3', 
                      boxShadow: '0 4px 20px rgba(236, 72, 153, 0.04)'
                    }}
                  >
                    {/* Avatar com borda rosa e indicador */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ 
                        width: 48, height: 48, borderRadius: '50%', 
                        border: '2px solid #ec4899', padding: 2,
                        background: '#fff'
                      }}>
                        <div style={{ 
                          width: '100%', height: '100%', borderRadius: '50%', 
                          background: aniv.foto ? `url(${aniv.foto}) center/cover` : 'hsl(var(--bg-elevated))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, fontWeight: 800, color: '#ec4899', overflow: 'hidden'
                        }}>
                          {!aniv.foto && getInitials(aniv.nome)}
                        </div>
                      </div>
                      <div style={{ 
                        position: 'absolute', top: 0, right: 0, width: 14, height: 14, 
                        borderRadius: '50%', background: '#fff', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                      }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ec4899' }} />
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: 900, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                        {aniv.nome}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Aluno • {aniv.turma}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#ec4899', flexShrink: 0, marginLeft: 8 }}>
                          Dia {aniv.dia}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Ocorrências Recentes - REDESENHADO & MAIOR */}
          <div 
            className="card" 
            style={{ 
              padding: '24px 20px', 
              borderRadius: '28px',
              border: '1px solid hsl(var(--border-subtle))',
              transition: 'transform 0.3s, box-shadow 0.3s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(0, 0, 0, 0.04)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(245, 158, 11, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} color="#f59e0b" />
                </div>
                <span style={{ fontWeight: 900, fontSize: '18px', fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))' }}>Ocorrências</span>
              </div>
              <Link href="/academico/ocorrencias" style={{ fontSize: '12px', color: ACCENT, textDecoration: 'none', fontWeight: 800 }}>Ver todas</Link>
            </div>
            {ocorrencias.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '24px 0', fontWeight: 600 }}>
                Nenhuma ocorrência registrada
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ocorrencias.slice(0, 4).map((oc: any) => {
                  const gc = oc.gravidade === 'grave' ? '#ef4444' : oc.gravidade === 'media' ? '#f59e0b' : '#6b7280'
                  return (
                    <div key={oc.id} style={{ padding: '12px 14px', borderRadius: '12px', background: 'hsl(var(--bg-elevated))', borderLeft: `4px solid ${gc}`, boxShadow: '0 2px 5px rgba(0,0,0,0.01)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {oc.tipo || oc.titulo || 'Ocorrência'}
                        </div>
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '100px', background: `${gc}15`, color: gc, fontWeight: 800, textTransform: 'uppercase' }}>
                          {oc.gravidade || 'info'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', marginTop: 4, fontWeight: 600 }}>👤 {oc.alunoNome || 'Aluno'}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Card: Alertas Críticos (Movido para Lateral Direita) */}
          <div 
            className="card" 
            style={{ 
              padding: '24px 20px', 
              borderRadius: '28px',
              border: '1px solid hsl(var(--border-subtle))',
              transition: 'transform 0.3s, box-shadow 0.3s',
              cursor: 'pointer'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 12px 20px -3px rgba(0, 0, 0, 0.04)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bell size={20} color="#ef4444" />
                </div>
                <span style={{ fontWeight: 900, fontSize: '18px', fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))' }}>Alertas</span>
              </div>
              <Link href="/alertas" style={{ fontSize: '12px', color: ACCENT, textDecoration: 'none', fontWeight: 800 }}>Ver todos</Link>
            </div>
            {alertas.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '24px 0', fontWeight: 600 }}>
                Nenhum alerta pendente
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {alertas.slice(0, 3).map((a: any) => {
                  const c = NIVEL_COLORS[a.nivel] || NIVEL_COLORS.info
                  return (
                    <div key={a.id} style={{
                      display: 'flex', gap: 10, padding: '10px 12px', borderRadius: '12px',
                      background: c.bg, border: `1px solid ${c.border}`,
                    }}>
                      <div style={{ flexShrink: 0, marginTop: 2 }}>{NIVEL_ICON[a.nivel]}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</div>
                        <div style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>{a.descricao}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  )
}
