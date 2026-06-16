'use client'

import { useApiQuery } from '@/hooks/useApi'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { DashboardSkeleton } from '@/components/skeletons/DashboardSkeleton'
import { formatNumber, formatCurrency } from '@/lib/utils'
import { useData, Tarefa } from '@/lib/dataContext'
import { 
  Users, AlertTriangle, GraduationCap, UserPlus,
  Calendar as CalendarIcon, ClipboardCheck, BookMarked,
  CheckCircle, CalendarDays, Cake, ShieldCheck
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'

// ── Helpers
const fmtPct = (v: number) => `${v.toFixed(1)}%`
const getInitials = (nome: string) => {
  const p = nome?.trim().split(' ').filter(Boolean)
  if (!p?.length) return '?'
  return `${p[0]?.[0] ?? ''}${p[1]?.[0] ?? ''}`.toUpperCase()
}

// ── Sparkline Component
function Sparkline({ color, path }: { color: string, path: string }) {
  const fillPath = `${path} L 100 40 L 0 40 Z`
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px' }}>
      <svg width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={fillPath} fill={`url(#grad-${color.replace('#','')})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

const PATHS = {
  blue:   "M 0 25 C 10 20, 20 30, 30 20 S 50 25, 60 15 S 80 25, 100 10",
  purple: "M 0 30 C 15 25, 20 15, 35 25 S 55 10, 70 20 S 85 10, 100 15",
  green:  "M 0 20 C 10 25, 20 15, 30 25 S 50 10, 60 20 S 80 15, 100 5",
  orange: "M 0 15 C 15 20, 25 10, 40 20 S 60 25, 75 15 S 90 20, 100 10"
}

export default function DashboardPage() {
  const hoje = new Date()
  const mesStr  = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  const mesPrev = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
  const mesPrevStr = `${mesPrev.getFullYear()}-${String(mesPrev.getMonth() + 1).padStart(2, '0')}`
  const [refreshKey] = useState(0)

  // ── Context Data (Calendar & Tasks)
  const { tarefas = [], eventosAgenda = [], turmas = [] } = useData()

  // ── Data for Stats
  const [alunos, , { loading: loadAlunos }] = useSupabaseArray<any>('alunos?limit=1000')
  const [titulos, , { loading: loadTitulos }] = useSupabaseArray<any>('titulos')
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

  // ── Usuários Cadastrados / Acessos
  const { data: usuariosData, isLoading: loadUsuarios } = useApiQuery<any[]>(
    ['dash-usuarios'],
    `/api/configuracoes/usuarios`,
    {},
    { staleTime: 300_000 }
  )
  
  const usuariosAtivos = useMemo(() => {
    if (!usuariosData) return []
    return usuariosData.filter(u => u.ultimoAcesso && u.ultimoAcesso !== 'Nunca acessou')
  }, [usuariosData])

  const statsUsuarios = useMemo(() => {
    if (!usuariosData) return { colab: 0, colabTotal: 0, alunos: 0, alunosTotal: 0, resps: 0, respsTotal: 0, total: 0, totalGeral: 0 }
    let colab = 0, colabTotal = 0
    let alunos = 0, alunosTotal = 0
    let resps = 0, respsTotal = 0

    usuariosData.forEach(u => {
      const isAtivo = u.ultimoAcesso && u.ultimoAcesso !== 'Nunca acessou'
      if (u.cargo === 'Alunos') {
        alunosTotal++
        if (isAtivo) alunos++
      }
      else if (u.cargo === 'Responsáveis') {
        respsTotal++
        if (isAtivo) resps++
      }
      else {
        colabTotal++
        if (isAtivo) colab++
      }
    })
    return { colab, colabTotal, alunos, alunosTotal, resps, respsTotal, total: usuariosAtivos.length, totalGeral: usuariosData.length }
  }, [usuariosData, usuariosAtivos])

  // ── Derived Data
  const todayStr = hoje.toISOString().slice(0, 10)
  const tarefasPendentes = tarefas.filter(t => t.status !== 'concluida')
  const eventosHoje = eventosAgenda.filter(e => e.data === todayStr)

  const kpiCards = [
    { label: 'Total de Alunos', value: formatNumber(totalAlunos), icon: <Users size={18} />, color: '#3b82f6', bgIcon: '#eff6ff', sub: 'Matriculados ativos', path: PATHS.blue },
    { label: 'Taxa de Ocupação', value: fmtPct(taxaOcupacao), icon: <GraduationCap size={18} />, color: '#8b5cf6', bgIcon: '#f5f3ff', sub: 'Capacidade física', path: PATHS.purple },
    { label: 'Novas Matrículas', value: formatNumber(novasMatriculas), icon: <UserPlus size={18} />, color: '#10b981', bgIcon: '#ecfdf5', sub: 'Este mês', path: PATHS.green },
    { label: 'Ocorrências', value: formatNumber(ocorrencias.length), icon: <AlertTriangle size={18} />, color: '#f59e0b', bgIcon: '#fffbeb', sub: 'Registradas', path: PATHS.orange },
  ]

  const aniversariantes = useMemo(() => {
    if (!alunos || alunos.length === 0) return []
    const currentYear = hoje.getFullYear()
    return (alunos || [])
      .map((aluno: any) => {
        if (!aluno.data_nascimento) return null
        const parts = aluno.data_nascimento.split('-')
        if (parts.length < 3) return null
        const bMonth = parseInt(parts[1]) - 1
        const bDay = parseInt(parts[2])
        const birthdayThisYear = new Date(currentYear, bMonth, bDay)
        
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
  }, [alunos, turmas, hoje])

  const ordersSummary = useMemo(() => {
    const EVENTOS_LIVROS = ['livros', 'apostilas em', 'apostilas fund2', 'apostila em', 'apostila fund2', 'apostilas ens. médio', 'liv']
    function isEventoLivro(descricao?: string): boolean {
      if (!descricao) return false
      return EVENTOS_LIVROS.some(e => descricao.toLowerCase().includes(e))
    }

    const resolverDesc = (raw: any): string => {
      if (raw.evento?.trim()) return raw.evento.trim()
      if (raw.eventoDescricao?.trim()) return raw.eventoDescricao.trim()
      return raw.descricao?.trim() ?? ''
    }

    const parcelasDeAlunos: any[] = []
    for (const alu of (alunos || [])) {
      const tObj = turmas.find((t: any) => t.id === alu.turma || t.codigo === alu.turma)
      const turmaNome = tObj?.nome || alu.turma || 'S/T'
      for (const p of (alu.parcelas ?? [])) {
        const desc = resolverDesc(p)
        if (!isEventoLivro(desc)) continue
        parcelasDeAlunos.push({
          id: `alu-${alu.id}-p-${p.num ?? p.codigo ?? String(Math.random()).slice(2)}`,
          aluno: alu.nome,
          alunoId: alu.id,
          turma: turmaNome,
          eventoDescricao: desc,
          valor: Number(p.valor) || 0,
          dataLancamento: p.dataLancamento,
          created_at: p.created_at,
          createdAt: p.createdAt,
          vencimento: p.vencimento
        })
      }
    }

    const parcelasDeTitulos: any[] = (titulos || [])
      .filter(t => isEventoLivro(resolverDesc({ eventoDescricao: t.eventoDescricao, descricao: t.descricao })))
      .map(t => {
        const matchingAluno = (alunos || []).find((a: any) => a.nome === t.aluno)
        let turmaNome = 'S/T'
        if (matchingAluno) {
          const tObj = turmas.find((x: any) => x.id === matchingAluno.turma || x.codigo === matchingAluno.turma)
          turmaNome = tObj?.nome || matchingAluno.turma || 'S/T'
        }
        return {
          id: t.id,
          aluno: t.aluno,
          alunoId: matchingAluno?.id,
          turma: turmaNome,
          eventoDescricao: resolverDesc({ eventoDescricao: t.eventoDescricao, descricao: t.descricao }),
          valor: t.valor,
          dataLancamento: t.dataLancamento,
          created_at: t.created_at,
          createdAt: t.createdAt,
          vencimento: t.vencimento
        }
      })

    const alunosComParcDiretas = new Set(parcelasDeAlunos.map(p => p.aluno))
    const titulosFiltrados = parcelasDeTitulos.filter(p => !alunosComParcDiretas.has(p.aluno))
    const todasParcelas = [...parcelasDeAlunos, ...titulosFiltrados, ...(Array.isArray(pedidosManuais) ? pedidosManuais : [])]

    const map = new Map<string, any>()
    let totalValue = 0, entregueCount = 0, preparadoCount = 0, pendenteCount = 0

    for (const p of todasParcelas) {
      const key = `${p.aluno}__${p.eventoDescricao}`
      const pMeta = (pedidos || []).find((x: any) => x.tituloId === p.id)
      
      let finalTurma = p.turma
      if (!finalTurma || finalTurma === 'S/T' || finalTurma === '—') {
        const matchingAluno = (alunos || []).find((a: any) => a.nome === p.aluno || a.id === p.alunoId)
        if (matchingAluno) {
          const tObj = turmas.find((x: any) => x.id === matchingAluno.turma || x.codigo === matchingAluno.turma)
          finalTurma = tObj?.nome || matchingAluno.turma || 'S/T'
        }
      }

      if (!map.has(key)) {
        map.set(key, { 
          id: p.id, 
          aluno: p.aluno, 
          turma: finalTurma || 'S/T', 
          material: p.eventoDescricao, 
          valor: 0, 
          feito: pMeta?.feito ?? false, 
          entregue: pMeta?.entregue ?? false,
          timestamp: new Date(p.dataLancamento || p.created_at || p.createdAt || p.vencimento || 0).getTime() 
        })
      } else {
        const existing = map.get(key)
        if (pMeta?.feito) existing.feito = true
        if (pMeta?.entregue) existing.entregue = true
        if (finalTurma && (!existing.turma || existing.turma === 'S/T' || existing.turma === '—')) {
          existing.turma = finalTurma
        }
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

    const sortedOrders = [...uniqueOrders].sort((a, b) => b.timestamp - a.timestamp)

    return {
      totalOrders: uniqueOrders.length,
      totalValue,
      entregueCount,
      preparadoCount,
      pendenteCount,
      recentOrders: sortedOrders.slice(0, 4)
    }
  }, [alunos, titulos, pedidos, pedidosManuais, turmas])

  const isGlobalLoading = loadKpis || loadAlunos || loadTitulos || loadPedidosMeta || loadPedidosManuais

  if (isGlobalLoading) return <DashboardSkeleton />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* ═══ Top Row (4 KPIs) ══════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
        {kpiCards.map((kpi) => (
          <div 
            key={kpi.label} 
            style={{ 
              background: '#fff',
              padding: '28px 24px 44px', 
              borderRadius: '24px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
              display: 'flex', flexDirection: 'column',
              transition: 'transform 0.3s ease, boxShadow 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ 
                width: 36, height: 36, 
                background: kpi.bgIcon, borderRadius: '10px', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                color: kpi.color 
              }}>
                {kpi.icon}
              </div>
              <span style={{ fontSize: '13px', fontWeight: 800, color: 'hsl(var(--text-muted))' }}>
                {kpi.label}
              </span>
            </div>

            <div style={{ fontSize: '42px', fontWeight: 900, color: '#111827', fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>
              {kpi.value}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, position: 'relative', zIndex: 1 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: kpi.color }} />
              <span style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{kpi.sub}</span>
            </div>

            <Sparkline color={kpi.color} path={kpi.path} />
          </div>
        ))}
      </div>

      {/* ═══ Active Users Banner ═══════════════════════════════════════════ */}
      <div style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', borderRadius: '24px', padding: '32px 40px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 10px 30px rgba(99, 102, 241, 0.2)', flexWrap: 'wrap', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ width: 64, height: 64, background: 'rgba(255,255,255,0.2)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', flexShrink: 0 }}>
            <Users size={32} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Engajamento do Sistema</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: '36px', fontWeight: 900, fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>{statsUsuarios.total}</div>
              <div style={{ fontSize: '16px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontFamily: 'Outfit, sans-serif' }}>/ {statsUsuarios.totalGeral} ativos</div>
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: 8, fontWeight: 500 }}>Já realizaram o primeiro acesso à plataforma</div>
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
              <div style={{ width: `${statsUsuarios.totalGeral > 0 ? (statsUsuarios.total / statsUsuarios.totalGeral) * 100 : 0}%`, height: '100%', background: '#34d399', borderRadius: 2 }} />
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* Card Colaboradores */}
          <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '16px', padding: '16px 20px', minWidth: 160 }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={14} /> Colaboradores</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>{statsUsuarios.colab}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', fontFamily: 'Outfit, sans-serif' }}>/ {statsUsuarios.colabTotal}</div>
            </div>
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: `${statsUsuarios.colabTotal > 0 ? (statsUsuarios.colab / statsUsuarios.colabTotal) * 100 : 0}%`, height: '100%', background: '#a7f3d0' }} />
            </div>
          </div>
          {/* Card Alunos */}
          <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '16px', padding: '16px 20px', minWidth: 160 }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><GraduationCap size={14} /> Alunos</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>{statsUsuarios.alunos}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', fontFamily: 'Outfit, sans-serif' }}>/ {statsUsuarios.alunosTotal}</div>
            </div>
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: `${statsUsuarios.alunosTotal > 0 ? (statsUsuarios.alunos / statsUsuarios.alunosTotal) * 100 : 0}%`, height: '100%', background: '#a7f3d0' }} />
            </div>
          </div>
          {/* Card Responsáveis */}
          <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '16px', padding: '16px 20px', minWidth: 160 }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} /> Responsáveis</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <div style={{ fontSize: '24px', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>{statsUsuarios.resps}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', fontFamily: 'Outfit, sans-serif' }}>/ {statsUsuarios.respsTotal}</div>
            </div>
            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ width: `${statsUsuarios.respsTotal > 0 ? (statsUsuarios.resps / statsUsuarios.respsTotal) * 100 : 0}%`, height: '100%', background: '#a7f3d0' }} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Main Area Grid (4 Columns) ═══════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, alignItems: 'start' }}>

        {/* ── Coluna 1: Pedido de Livros ──────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookMarked size={16} color="#3b82f6" />
              </div>
              <span style={{ fontWeight: 900, fontSize: '15px', fontFamily: 'Outfit, sans-serif', color: '#111827' }}>Pedido de Livros/Apostilas</span>
            </div>
            <Link href="/administrativo/pedidos-livros" style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none', fontWeight: 800 }}>Ver todos</Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Total</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', fontFamily: 'Outfit, sans-serif' }}>{ordersSummary.totalOrders}</div>
            </div>
            <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Pendentes</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', fontFamily: 'Outfit, sans-serif' }}>{ordersSummary.pendenteCount}</div>
            </div>
            <div style={{ background: '#fffbeb', padding: '16px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Em Preparo</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#f59e0b', fontFamily: 'Outfit, sans-serif' }}>{ordersSummary.preparadoCount}</div>
            </div>
            <div style={{ background: '#ecfdf5', padding: '16px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Entregues</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#10b981', fontFamily: 'Outfit, sans-serif' }}>{ordersSummary.entregueCount}</div>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: 8 }}>
              <span>Taxa de Entrega</span>
              <span style={{ color: '#10b981' }}>{ordersSummary.totalOrders > 0 ? ((ordersSummary.entregueCount / ordersSummary.totalOrders) * 100).toFixed(0) : 0}%</span>
            </div>
            <div style={{ width: '100%', height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${ordersSummary.totalOrders > 0 ? (ordersSummary.entregueCount / ordersSummary.totalOrders) * 100 : 0}%`, height: '100%', background: '#10b981' }} />
            </div>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 800, color: '#64748b', marginBottom: 12 }}>Recentes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ordersSummary.recentOrders.length === 0 ? (
              <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', padding: '10px 0', fontWeight: 600 }}>Nenhum material registrado.</div>
            ) : (
              ordersSummary.recentOrders.slice(0, 3).map((o) => (
                <div key={o.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#f8fafc', borderRadius: '16px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.aluno}</div>
                      {!o.feito && !o.entregue && (
                        <span style={{ fontSize: '9px', fontWeight: 900, color: '#ef4444', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fecaca', whiteSpace: 'nowrap' }}>NOVO</span>
                      )}
                      {o.feito && !o.entregue && (
                        <span style={{ fontSize: '9px', fontWeight: 900, color: '#f59e0b', background: '#fffbeb', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>PEDIDO FEITO</span>
                      )}
                      {o.entregue && (
                        <span style={{ fontSize: '9px', fontWeight: 900, color: '#10b981', background: '#ecfdf5', padding: '2px 6px', borderRadius: '4px', border: '1px solid #a7f3d0', whiteSpace: 'nowrap' }}>ENTREGUE</span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{o.turma} • {o.material}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Coluna 2: Tarefas ──────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: '#ecfdf5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardCheck size={16} color="#10b981" />
              </div>
              <span style={{ fontWeight: 900, fontSize: '15px', fontFamily: 'Outfit, sans-serif', color: '#111827' }}>Tarefas</span>
            </div>
            <Link href="/tarefas" style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none', fontWeight: 800 }}>Ver todas</Link>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 0' }}>
            <CheckCircle size={48} color="#cbd5e1" strokeWidth={1.5} style={{ marginBottom: 24 }} />
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#334155', marginBottom: 8 }}>Nenhuma tarefa pendente</div>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Tudo em dia por aqui! 🎉</div>
          </div>
        </div>

        {/* ── Coluna 3: Agenda ──────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: '#f5f3ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarIcon size={16} color="#8b5cf6" />
              </div>
              <span style={{ fontWeight: 900, fontSize: '15px', fontFamily: 'Outfit, sans-serif', color: '#111827' }}>Agenda</span>
            </div>
            <Link href="/calendario" style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none', fontWeight: 800 }}>Abrir</Link>
          </div>

          <div style={{ fontSize: '11px', fontWeight: 800, color: '#6366f1', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hoje</div>
          
          {eventosHoje.length === 0 ? (
            <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 600 }}>Sem eventos programados</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {eventosHoje.slice(0, 4).map(e => (
                <div key={e.id} style={{ display: 'flex', flexDirection: 'column', padding: '12px', background: '#f8fafc', borderRadius: '12px', borderLeft: `4px solid ${e.cor || '#8b5cf6'}` }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>{e.titulo}</span>
                  {e.horaInicio && <span style={{ fontSize: '11px', color: '#64748b', marginTop: 4, fontWeight: 600 }}>{e.horaInicio}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Decorative Calendar Icon */}
          <div style={{ position: 'absolute', bottom: -20, right: -20, opacity: 0.05, transform: 'rotate(-10deg)', pointerEvents: 'none' }}>
            <CalendarDays size={180} />
          </div>
        </div>

        {/* ── Coluna 4: Aniversários & Ocorrências ──────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Aniversariantes */}
          <div style={{ background: '#fff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #fdf2f8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ color: '#ec4899' }}>
                <Cake size={24} />
              </div>
              <span style={{ fontWeight: 900, fontSize: '16px', fontFamily: 'Outfit, sans-serif', color: '#111827' }}>
                Aniversariantes de {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(hoje).charAt(0).toUpperCase() + new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(hoje).slice(1)}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {aniversariantes.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '16px 0', fontWeight: 600 }}>Nenhum neste mês.</div>
              ) : (
                aniversariantes.slice(0, 3).map(aniv => (
                  <div key={aniv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', borderRadius: '16px', border: '1px solid #fce7f3' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899', fontWeight: 800, fontSize: '14px', flexShrink: 0 }}>
                      {aniv.foto ? <img src={aniv.foto} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : getInitials(aniv.nome)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aniv.nome}</div>
                      <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase', marginTop: 2 }}>Aluno • {aniv.turma}</div>
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 900, color: '#ec4899', flexShrink: 0 }}>Dia {aniv.dia}</div>
                  </div>
                ))
              )}
            </div>
            
            {aniversariantes.length > 3 && (
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <Link href="/academico/alunos" style={{ fontSize: '12px', color: '#ec4899', fontWeight: 800, textDecoration: 'none', background: '#fdf2f8', padding: '8px 24px', borderRadius: '20px' }}>Ver todos</Link>
              </div>
            )}
          </div>

          {/* Ocorrências Recentes */}
          <div style={{ background: '#fff', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ color: '#f59e0b' }}>
                  <AlertTriangle size={24} />
                </div>
                <span style={{ fontWeight: 900, fontSize: '16px', fontFamily: 'Outfit, sans-serif', color: '#111827' }}>Ocorrências Recentes</span>
              </div>
              <Link href="/academico/ocorrencias" style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none', fontWeight: 800 }}>Ver todas</Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ocorrencias.length === 0 ? (
                <div style={{ fontSize: '13px', color: '#94a3b8', textAlign: 'center', padding: '16px 0', fontWeight: 600 }}>Nenhuma registrada.</div>
              ) : (
                ocorrencias.slice(0, 3).map((oc: any) => {
                  const isGrave = oc.gravidade === 'grave';
                  const isMedia = oc.gravidade === 'media';
                  const color = isGrave ? '#ef4444' : isMedia ? '#f59e0b' : '#64748b';
                  const bg = isGrave ? '#fef2f2' : isMedia ? '#fffbeb' : '#f8fafc';
                  return (
                    <div key={oc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '16px', background: bg, borderLeft: `4px solid ${color}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 900, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{oc.tipo || oc.titulo || 'Ocorrência'}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>👤 {oc.alunoNome || 'Aluno'}</div>
                      </div>
                      <div style={{ fontSize: '10px', fontWeight: 900, color: color, textTransform: 'uppercase', background: '#fff', padding: '4px 8px', borderRadius: '8px', border: `1px solid ${color}30` }}>
                        {oc.gravidade || 'Leve'}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
