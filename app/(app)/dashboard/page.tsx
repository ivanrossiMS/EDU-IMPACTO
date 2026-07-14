'use client'

import { useApiQuery } from '@/hooks/useApi'
import { useSupabaseArray } from '@/lib/useSupabaseCollection'
import { ImpactoLoader } from '@/components/ui/ImpactoLoader'
import { formatNumber, formatCurrency } from '@/lib/utils'
import { useData, Tarefa } from '@/lib/dataContext'
import { 
  Users, AlertTriangle, GraduationCap, UserPlus,
  Calendar as CalendarIcon, ClipboardCheck, BookMarked,
  CheckCircle, CalendarDays, Cake, ShieldCheck, X, Loader2
} from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
  
  // Extrai as coordenadas finais do path (ex: "M ... S 80 25, 100 10")
  const pathParts = path.split(/[\s,]+/)
  const endX = pathParts[pathParts.length - 2]
  const endY = pathParts[pathParts.length - 1]

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '40px' }}>
      <svg width="100%" height="40" viewBox="0 0 100 40" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
          <filter id={`shadow-${color.replace('#','')}`}>
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={color} floodOpacity="0.3"/>
          </filter>
        </defs>
        <path d={fillPath} fill={`url(#grad-${color.replace('#','')})`} />
        <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={endX} cy={endY} r="3" fill={color} stroke="hsl(var(--bg-surface))" strokeWidth="1.5" filter={`url(#shadow-${color.replace('#','')})`} />
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
  const { tarefas = [], eventosAgenda = [], turmas = [], cfgCalendarioLetivo = [], loading: loadContext = false } = useData() as any

  // ── Modais
  const [modalAnivOpen, setModalAnivOpen] = useState(false)
  const [anivFiltroAno, setAnivFiltroAno] = useState('Todos')
  const [anivFiltroTurma, setAnivFiltroTurma] = useState('Todas')
  
  // ── Filtros Dashboard
  const [filtroTarefas, setFiltroTarefas] = useState<'todas' | 'pendentes' | 'concluidas'>('todas')
  const [diaSelecionadoOffset, setDiaSelecionadoOffset] = useState<number>(0)

  // ── Data for Stats
  const { data: aniversariantesList, isLoading: loadAniv } = useApiQuery<any[]>(['dash-aniversariantes'], '/api/alunos/aniversariantes')
  const [alunos, , { loading: loadAlunos }] = useSupabaseArray<any>('alunos/lightweight?limit=2000')
  const [titulos, , { loading: loadTitulos }] = useSupabaseArray<any>('titulos')
  const [pedidos, , { loading: loadPedidosMeta }] = useSupabaseArray<any>('administrativo/pedidos-livros')
  const [pedidosManuais, , { loading: loadPedidosManuais }] = useSupabaseArray<any>('administrativo/pedidos-livros-manuais')

  // ── Ocorrências
  const { data: ocorrData, isLoading: loadOcorr } = useApiQuery<any>(
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
    return usuariosData.filter((u: any) => u.ultimoAcesso && u.ultimoAcesso !== 'Nunca acessou')
  }, [usuariosData])

  const statsUsuarios = useMemo(() => {
    if (!usuariosData) return { colab: 0, colabTotal: 0, alunos: 0, alunosTotal: 0, resps: 0, respsTotal: 0, total: 0, totalGeral: 0 }
    let colab = 0, colabTotal = 0
    let alunos = 0, alunosTotal = 0
    let resps = 0, respsTotal = 0

    usuariosData.forEach((u: any) => {
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
  
  const tarefasPendentesList = tarefas.filter((t: any) => t.status !== 'concluida')
  const tarefasConcluidasList = tarefas.filter((t: any) => t.status === 'concluida')
  const tarefasExibidas = filtroTarefas === 'todas' 
    ? tarefas 
    : filtroTarefas === 'pendentes' 
      ? tarefasPendentesList 
      : tarefasConcluidasList

  const selectedDate = new Date(hoje);
  selectedDate.setDate(hoje.getDate() + diaSelecionadoOffset);
  const selectedDateStr = selectedDate.toISOString().slice(0, 10);
  const eventosExibidos = eventosAgenda.filter((e: any) => e.data === selectedDateStr);

  const kpiCards = [
    { label: 'Total de Alunos', value: formatNumber(totalAlunos), icon: <Users size={18} />, color: '#3b82f6', bgIcon: 'rgba(59, 130, 246, 0.1)', sub: 'Matriculados ativos', path: PATHS.blue },
    { label: 'Taxa de Ocupação', value: fmtPct(taxaOcupacao), icon: <GraduationCap size={18} />, color: '#8b5cf6', bgIcon: 'rgba(139, 92, 246, 0.1)', sub: 'Capacidade física', path: PATHS.purple },
    { label: 'Novas Matrículas', value: formatNumber(novasMatriculas), icon: <UserPlus size={18} />, color: '#10b981', bgIcon: 'rgba(16, 185, 129, 0.1)', sub: 'Este mês', path: PATHS.green },
    { label: 'Ocorrências', value: formatNumber(ocorrencias.length), icon: <AlertTriangle size={18} />, color: '#f59e0b', bgIcon: 'hsl(var(--bg-surface))beb', sub: 'Registradas', path: PATHS.orange },
  ]

  const aniversariantes = useMemo(() => {
    // Garante extração do array (a API retorna { data: [], meta: {} })
    const list = Array.isArray(aniversariantesList) 
      ? aniversariantesList 
      : (aniversariantesList as any)?.data || []
      
    if (!list || list.length === 0) return []
    return list.map((a: any) => {
      let turmaNome = a.turma || 'S/T'
      const tObj = turmas.find((t: any) => t.id === a.turma || t.codigo === a.turma)
      if (tObj) turmaNome = tObj.nome

      return {
        id: a.id,
        nome: a.nome,
        dia: parseInt(a.dataNascimento?.split('-')[2] || '0'),
        turma: turmaNome,
        anoLetivoId: (tObj as any)?.ano ? String((tObj as any).ano) : (tObj as any)?.ano_letivo ? String((tObj as any).ano_letivo) : 'Todos',
        foto: a.foto || null,
        timestamp: new Date().getTime()
      }
    }).sort((a: any, b: any) => a.dia - b.dia)
  }, [aniversariantesList, turmas])

  const ordersSummary = useMemo(() => {
    const EVENTOS_LIVROS = ['livros', 'apostilas em', 'apostilas fund2', 'apostila em', 'apostila fund2', 'apostilas ens. médio', 'liv', 'itinerário', 'itinerario']
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
      .filter((t: any) => isEventoLivro(resolverDesc({ eventoDescricao: t.eventoDescricao, descricao: t.descricao })))
      .map((t: any) => {
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

    const alunosComParcDiretas = new Set(parcelasDeAlunos.map((p: any) => p.aluno))
    const titulosFiltrados = parcelasDeTitulos.filter((p: any) => !alunosComParcDiretas.has(p.aluno))
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
    uniqueOrders.forEach((o: any) => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 40 }}>

      {/* ═══ Top Row (4 KPIs) ══════════════════════════════════════════════ */}
      <div className="dashboard-kpi-grid">
        {kpiCards.map((kpi) => (
          <div 
            key={kpi.label} 
            style={{ 
              background: 'hsl(var(--bg-surface))',
              padding: '24px', 
              borderRadius: '24px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(0,0,0,0.02)',
              border: '1px solid hsl(var(--border-subtle))',
              display: 'flex', flexDirection: 'column',
              minHeight: '160px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 800, color: kpi.color, display: 'block', marginBottom: '8px' }}>
                  {kpi.label}
                </span>
                <div style={{ fontSize: '38px', fontWeight: 900, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>
                  {loadKpis ? <Loader2 className="animate-spin" size={32} color={kpi.color} style={{ margin: '3px 0' }} /> : kpi.value}
                </div>
                <div style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', fontWeight: 600, marginTop: '10px' }}>
                  {kpi.sub}
                </div>
              </div>
              <div style={{ 
                width: 48, height: 48, 
                background: `linear-gradient(135deg, ${kpi.bgIcon}, hsl(var(--bg-surface))fff)`,
                borderRadius: '16px', 
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                color: kpi.color,
                boxShadow: `0 8px 16px ${kpi.color}15, inset 0 2px 4px rgba(255,255,255,0.8)`
              }}>
                {kpi.icon}
              </div>
            </div>

            <Sparkline color={kpi.color} path={kpi.path} />
          </div>
        ))}
      </div>

      {/* ═══ Main Area Grid (3 Columns) ═══════════════════════════════════ */}
      <div className="dashboard-main-grid">

        {/* ── Coluna 1: Pedido de Livros ──────────────────────────── */}
        <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookMarked size={16} color="#3b82f6" />
              </div>
              <span style={{ fontWeight: 900, fontSize: '15px', fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))' }}>Pedido de Livros/Apostilas</span>
            </div>
            <Link href="/administrativo/pedidos-livros" style={{ fontSize: '12px', color: '#6366f1', textDecoration: 'none', fontWeight: 800 }}>Ver todos</Link>
          </div>

          {(loadAlunos || loadTitulos || loadPedidosMeta || loadPedidosManuais) ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
              <Loader2 className="animate-spin" size={32} color="#3b82f6" />
            </div>
          ) : (
            <>
          <div className="dashboard-books-grid">
            <div style={{ background: 'hsl(var(--bg-elevated))', padding: '16px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Total</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif' }}>{ordersSummary.totalOrders}</div>
            </div>
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '16px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: '#ef4444', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Pendentes</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#ef4444', fontFamily: 'Outfit, sans-serif' }}>{ordersSummary.pendenteCount}</div>
            </div>
            <div style={{ background: 'hsl(var(--bg-surface))beb', padding: '16px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Pedido Feito</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#f59e0b', fontFamily: 'Outfit, sans-serif' }}>{ordersSummary.preparadoCount}</div>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: '#10b981', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>Entregues</div>
              <div style={{ fontSize: '24px', fontWeight: 900, color: '#10b981', fontFamily: 'Outfit, sans-serif' }}>{ordersSummary.entregueCount}</div>
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800, color: 'hsl(var(--text-secondary))', marginBottom: 8 }}>
              <span>Taxa de Entrega</span>
              <span style={{ color: '#10b981' }}>{ordersSummary.totalOrders > 0 ? ((ordersSummary.entregueCount / ordersSummary.totalOrders) * 100).toFixed(0) : 0}%</span>
            </div>
            <div style={{ width: '100%', height: 6, background: 'hsl(var(--bg-hover))', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${ordersSummary.totalOrders > 0 ? (ordersSummary.entregueCount / ordersSummary.totalOrders) * 100 : 0}%`, height: '100%', background: '#10b981' }} />
            </div>
          </div>

          <div style={{ fontSize: '13px', fontWeight: 800, color: 'hsl(var(--text-secondary))', marginBottom: 12 }}>Recentes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {ordersSummary.recentOrders.length === 0 ? (
              <div style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '10px 0', fontWeight: 600 }}>Nenhum material registrado.</div>
            ) : (
              ordersSummary.recentOrders.slice(0, 3).map((o) => {
                const IconComponent = o.material.toLowerCase().includes('livro') ? BookMarked : Users;
                const iconColor = o.entregue ? '#10b981' : (o.feito ? '#f59e0b' : '#3b82f6');
                const iconBg = o.entregue ? '#ecfdf5' : (o.feito ? 'hsl(var(--bg-surface))beb' : '#eff6ff');

                return (
                  <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '0px', background: 'transparent' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '16px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: iconColor }}>
                      <IconComponent size={20} strokeWidth={2} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 14, paddingTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.aluno}</div>
                        <div style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{o.turma} • {o.material}</div>
                      </div>
                      <div style={{ marginLeft: 12, flexShrink: 0 }}>
                        {!o.feito && !o.entregue && (
                          <span style={{ fontSize: '9px', fontWeight: 900, color: '#ef4444', textTransform: 'uppercase' }}>Novo</span>
                        )}
                        {o.feito && !o.entregue && (
                          <span style={{ fontSize: '9px', fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase' }}>Pedido Feito</span>
                        )}
                        {o.entregue && (
                          <span style={{ fontSize: '9px', fontWeight: 900, color: '#10b981', textTransform: 'uppercase' }}>Entregue</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
            </>
          )}
        </div>

        {/* ── Coluna Central: Tarefas e Agenda ──────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Tarefas */}
          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', border: '1px solid hsl(var(--border-subtle))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: 'rgba(16, 185, 129, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ClipboardCheck size={16} color="#10b981" strokeWidth={2.5} />
              </div>
              <span style={{ fontWeight: 900, fontSize: '15px', fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))' }}>Tarefas</span>
            </div>
            <Link href="/tarefas" style={{ fontSize: '12px', color: '#3b82f6', textDecoration: 'none', fontWeight: 800 }}>Ver todas</Link>
          </div>

          {loadContext ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
              <Loader2 className="animate-spin" size={32} color="#10b981" />
            </div>
          ) : (
            <>
          <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
            <div 
              onClick={() => setFiltroTarefas('todas')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: filtroTarefas === 'todas' ? 'rgba(139, 92, 246, 0.1)' : 'transparent', padding: filtroTarefas === 'todas' ? '6px 14px' : '6px 0', borderRadius: '20px', transition: 'all 0.2s' }}
            >
              <span style={{ fontSize: '12px', fontWeight: 800, color: filtroTarefas === 'todas' ? '#7c3aed' : 'hsl(var(--text-muted))' }}>Todas</span>
              <span style={{ fontSize: '10px', fontWeight: 900, color: filtroTarefas === 'todas' ? 'hsl(var(--bg-surface))' : 'hsl(var(--text-muted))', background: filtroTarefas === 'todas' ? '#8b5cf6' : 'hsl(var(--bg-hover))', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tarefas.length}</span>
            </div>
            <div 
              onClick={() => setFiltroTarefas('pendentes')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: filtroTarefas === 'pendentes' ? 'rgba(139, 92, 246, 0.1)' : 'transparent', padding: filtroTarefas === 'pendentes' ? '6px 14px' : '6px 0', borderRadius: '20px', transition: 'all 0.2s' }}
            >
              <span style={{ fontSize: '12px', fontWeight: 800, color: filtroTarefas === 'pendentes' ? '#7c3aed' : 'hsl(var(--text-muted))' }}>Pendentes</span>
              <span style={{ fontSize: '10px', fontWeight: 900, color: filtroTarefas === 'pendentes' ? 'hsl(var(--bg-surface))' : 'hsl(var(--text-muted))', background: filtroTarefas === 'pendentes' ? '#8b5cf6' : 'hsl(var(--bg-hover))', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tarefasPendentesList.length}</span>
            </div>
            <div 
              onClick={() => setFiltroTarefas('concluidas')}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, background: filtroTarefas === 'concluidas' ? 'rgba(139, 92, 246, 0.1)' : 'transparent', padding: filtroTarefas === 'concluidas' ? '6px 14px' : '6px 0', borderRadius: '20px', transition: 'all 0.2s' }}
            >
              <span style={{ fontSize: '12px', fontWeight: 800, color: filtroTarefas === 'concluidas' ? '#7c3aed' : 'hsl(var(--text-muted))' }}>Concluídas</span>
              <span style={{ fontSize: '10px', fontWeight: 900, color: filtroTarefas === 'concluidas' ? 'hsl(var(--bg-surface))' : 'hsl(var(--text-muted))', background: filtroTarefas === 'concluidas' ? '#8b5cf6' : 'hsl(var(--bg-hover))', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{tarefasConcluidasList.length}</span>
            </div>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px 0' }}>
            {tarefasExibidas.length === 0 ? (
              <>
                <div style={{ marginBottom: 20 }}>
                  <svg width="60" height="70" viewBox="0 0 60 70" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="5" y="15" width="50" height="55" rx="10" fill="#e0e7ff" />
                    <rect x="20" y="5" width="20" height="15" rx="5" fill="hsl(var(--bg-surface))" stroke="#a5b4fc" strokeWidth="4" />
                    <path d="M 22 32 L 27 37 L 38 26" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M 22 46 L 27 51 L 38 40" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M 22 60 L 27 65 L 38 54" stroke="#818cf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 900, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit, sans-serif', marginBottom: 4 }}>Nenhuma tarefa {filtroTarefas === 'pendentes' ? 'pendente' : filtroTarefas === 'concluidas' ? 'concluída' : 'encontrada'}</div>
                <div style={{ fontSize: '13px', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Tudo em dia por aqui! 🎉</div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', alignItems: 'flex-start', overflowY: 'auto', maxHeight: '250px', paddingRight: '4px' }}>
                {tarefasExibidas.slice(0, 5).map((t: any) => {
                  const isConcluida = t.status === 'concluida';
                  return (
                    <div key={t.id} style={{ display: 'flex', flexDirection: 'column', padding: '12px', background: 'hsl(var(--bg-elevated))', borderRadius: '12px', borderLeft: `4px solid ${isConcluida ? '#10b981' : '#f59e0b'}`, width: '100%', textAlign: 'left' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'hsl(var(--text-primary))', textDecoration: isConcluida ? 'line-through' : 'none', opacity: isConcluida ? 0.7 : 1 }}>{t.titulo}</span>
                      {t.prazo && <span style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', marginTop: 4, fontWeight: 600 }}>Prazo: {t.prazo.split('-').reverse().join('/')}</span>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
            </>
          )}
        </div>

        {/* ── Coluna 3: Agenda ──────────────────────────── */}
        <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, background: 'rgba(139, 92, 246, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CalendarIcon size={16} color="#8b5cf6" strokeWidth={2.5} />
              </div>
              <span style={{ fontWeight: 900, fontSize: '15px', fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))' }}>Agenda</span>
            </div>
            <Link href="/calendario" style={{ fontSize: '12px', color: '#3b82f6', textDecoration: 'none', fontWeight: 800 }}>Ver todos</Link>
          </div>

          {loadContext ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
              <Loader2 className="animate-spin" size={32} color="#8b5cf6" />
            </div>
          ) : (
            <>
          {/* Week View */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid hsl(var(--border-subtle))', overflowX: 'auto', gap: 12 }} className="no-scrollbar">
            {[0, 1, 2, 3, 4, 5, 6].map((offset) => {
              const d = new Date(hoje);
              d.setDate(hoje.getDate() + offset);
              const isSelected = diaSelecionadoOffset === offset;
              const isToday = offset === 0;
              const dayName = isToday ? 'Hoje' : new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d).replace('.', '').toUpperCase();
              
              return (
                <div 
                  key={offset} 
                  onClick={() => setDiaSelecionadoOffset(offset)}
                  style={{ 
                    flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', 
                    background: isSelected ? '#8b5cf6' : 'transparent', 
                    padding: isSelected ? '10px 14px' : '10px 0', 
                    borderRadius: '20px', 
                    color: isSelected ? 'hsl(var(--bg-surface))' : 'inherit', 
                    gap: 4, 
                    boxShadow: isSelected ? '0 4px 14px rgba(139, 92, 246, 0.3)' : 'none',
                    cursor: 'pointer',
                    minWidth: isSelected ? 'auto' : '40px',
                    transition: 'all 0.2s'
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: isSelected ? 'rgba(255,255,255,0.8)' : 'hsl(var(--text-muted))' }}>{dayName}</span>
                  <div style={{ color: isSelected ? '#fff' : 'hsl(var(--text-primary))', fontSize: '16px', fontWeight: 900 }}>{d.getDate().toString().padStart(2, '0')}</div>
                </div>
              )
            })}
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px 0' }}>
            {eventosExibidos.length === 0 ? (
              <>
                <div style={{ fontSize: '16px', fontWeight: 900, color: 'hsl(var(--text-secondary))', fontFamily: 'Outfit, sans-serif', marginBottom: 8 }}>Nenhum evento {diaSelecionadoOffset === 0 ? 'para hoje' : 'neste dia'}</div>
                <div style={{ fontSize: '13px', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Aproveite para planejar! 📅</div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', alignItems: 'flex-start', overflowY: 'auto', maxHeight: '250px', paddingRight: '4px' }}>
                {eventosExibidos.slice(0, 5).map((e: any) => (
                  <div key={e.id} style={{ display: 'flex', flexDirection: 'column', padding: '12px', background: 'hsl(var(--bg-elevated))', borderRadius: '12px', borderLeft: `4px solid ${e.cor || '#8b5cf6'}`, width: '100%', textAlign: 'left' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'hsl(var(--text-primary))' }}>{e.titulo}</span>
                    {e.horaInicio && <span style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', marginTop: 4, fontWeight: 600 }}>{e.horaInicio} {e.horaFim ? `às ${e.horaFim}` : ''}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
            </>
          )}
        </div>
        {/* Fim da Coluna Central */}
        </div>

        {/* ── Coluna 4: Aniversários & Ocorrências ──────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Aniversariantes */}
          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid hsl(var(--border-subtle))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, background: 'rgba(236, 72, 153, 0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899' }}>
                  <Cake size={16} strokeWidth={2.5} />
                </div>
                <span style={{ fontWeight: 900, fontSize: '15px', fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))' }}>
                  Aniversariantes de {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(hoje).charAt(0).toUpperCase() + new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(hoje).slice(1)}
                </span>
              </div>
              <button 
                onClick={() => setModalAnivOpen(true)} 
                style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 800, textDecoration: 'none', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                Ver todos
              </button>
            </div>

            {loadAniv ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                <Loader2 className="animate-spin" size={32} color="#ec4899" />
              </div>
            ) : (
              <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {aniversariantes.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '16px 0', fontWeight: 600 }}>Nenhum neste mês.</div>
              ) : (
                aniversariantes.slice(0, 3).map((aniv: any) => (
                  <div key={aniv.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #fdf2f8' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(236, 72, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899', fontWeight: 800, fontSize: '14px', flexShrink: 0 }}>
                      {aniv.foto ? <img src={aniv.foto} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : getInitials(aniv.nome)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aniv.nome}</div>
                      <div style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase', marginTop: 2 }}>Aluno • {aniv.turma}</div>
                    </div>
                    <div style={{ fontSize: '11px', fontWeight: 900, color: '#ec4899', flexShrink: 0, textTransform: 'uppercase' }}>Dia {aniv.dia}</div>
                  </div>
                ))
              )}
            </div>
            
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button 
                onClick={() => setModalAnivOpen(true)} 
                style={{ width: '100%', fontSize: '13px', color: '#ec4899', fontWeight: 800, textDecoration: 'none', background: 'rgba(236, 72, 153, 0.1)', padding: '12px 24px', borderRadius: '16px', border: 'none', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.background = '#fce7f3'}
                onMouseOut={(e) => e.currentTarget.style.background = '#fdf2f8'}
              >
                Ver todos os aniversariantes
              </button>
            </div>
              </>
            )}
          </div>

          {/* Ocorrências Recentes */}
          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: '24px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid hsl(var(--border-subtle))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, background: 'hsl(var(--bg-surface))beb', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
                  <AlertTriangle size={16} strokeWidth={2.5} />
                </div>
                <span style={{ fontWeight: 900, fontSize: '15px', fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-primary))' }}>Ocorrências Recentes</span>
              </div>
              <Link href="/academico/ocorrencias" style={{ fontSize: '12px', color: '#3b82f6', textDecoration: 'none', fontWeight: 800 }}>Ver todas</Link>
            </div>

            {loadOcorr ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                <Loader2 className="animate-spin" size={32} color="#f59e0b" />
              </div>
            ) : (
              <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ocorrencias.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'hsl(var(--text-muted))', textAlign: 'center', padding: '16px 0', fontWeight: 600 }}>Nenhuma registrada.</div>
              ) : (
                ocorrencias.slice(0, 3).map((oc: any) => {
                  const isGrave = oc.gravidade === 'grave';
                  const isMedia = oc.gravidade === 'media';
                  const color = isGrave ? '#ef4444' : isMedia ? '#f59e0b' : '#3b82f6';
                  const bg = isGrave ? '#fef2f2' : isMedia ? 'hsl(var(--bg-surface))beb' : '#eff6ff';
                  
                  // Extract date
                  let dataStr = oc.dataRegistro || oc.data_registro || oc.created_at || '';
                  let fmtDate = '';
                  if (dataStr) {
                    const d = new Date(dataStr);
                    if (!isNaN(d.getTime())) {
                      fmtDate = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth()+1).toString().padStart(2, '0')} - ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
                    }
                  }

                  return (
                    <div key={oc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px', borderRadius: '16px', background: bg, borderLeft: `4px solid ${color}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{oc.tipo || oc.titulo || 'Ocorrência'}</div>
                        <div style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Users size={12} /> {oc.alunoNome || 'Aluno'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <div style={{ fontSize: '10px', fontWeight: 900, color: color, textTransform: 'uppercase' }}>
                          {oc.gravidade || 'Leve'}
                        </div>
                        {fmtDate && (
                          <div style={{ fontSize: '10px', fontWeight: 800, color: 'hsl(var(--text-muted))' }}>
                            {fmtDate}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
              </>
            )}
          </div>

        </div>

      </div>

      {/* ═══ Active Users Banner ═══════════════════════════════════════════ */}
      <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: '24px', padding: '32px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid hsl(var(--border-subtle))', flexWrap: 'wrap', gap: 24 }}>
        {loadUsuarios ? (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
            <Loader2 className="animate-spin" size={32} color="#6d28d9" />
          </div>
        ) : (
          <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32, flex: 1 }}>
          
          {/* Circular Progress */}
          <div style={{ position: 'relative', width: 90, height: 90, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="45" fill="none" stroke="#f1f5f9" strokeWidth="8" />
              <circle cx="50" cy="50" r="45" fill="none" stroke="#8b5cf6" strokeWidth="8" strokeDasharray="282.74" strokeDashoffset={282.74 - (282.74 * (statsUsuarios.totalGeral > 0 ? statsUsuarios.total / statsUsuarios.totalGeral : 0))} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
            </svg>
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '20px', fontWeight: 900, color: '#4c1d95', fontFamily: 'Outfit, sans-serif' }}>{statsUsuarios.totalGeral > 0 ? Math.round((statsUsuarios.total / statsUsuarios.totalGeral) * 100) : 0}<span style={{ fontSize: '12px' }}>%</span></span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: 'hsl(var(--text-primary))', marginBottom: 8 }}>Engajamento do Sistema</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: '32px', fontWeight: 900, fontFamily: 'Outfit, sans-serif', lineHeight: 1, color: '#6d28d9' }}>{statsUsuarios.total}</div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'hsl(var(--text-secondary))', fontFamily: 'Outfit, sans-serif' }}>/ {statsUsuarios.totalGeral} ativos</div>
            </div>
            <div style={{ fontSize: '12px', color: 'hsl(var(--text-muted))', marginTop: 6, fontWeight: 600 }}>Já realizaram o primeiro acesso à plataforma</div>
          </div>

          {/* Wavy Line decoration */}
          <div style={{ flex: 1, height: 60, marginLeft: 20, position: 'relative' }}>
            <svg viewBox="0 0 200 60" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="wave-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M 0 30 C 40 10, 60 50, 100 30 C 140 10, 160 50, 200 30 L 200 60 L 0 60 Z" fill="url(#wave-grad)" />
              <path d="M 0 30 C 40 10, 60 50, 100 30 C 140 10, 160 50, 200 30" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

        </div>
        
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {/* Card Colaboradores */}
          <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid #f1f5f9', borderRadius: '20px', padding: '16px 20px', minWidth: 160, boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
            <div style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={14} color="#8b5cf6" /> Colaboradores</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <div style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: '#4c1d95' }}>{statsUsuarios.colab}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', fontFamily: 'Outfit, sans-serif' }}>/ {statsUsuarios.colabTotal}</div>
            </div>
            <div style={{ width: '100%', height: 4, background: 'hsl(var(--bg-hover))', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
              <div style={{ width: `${statsUsuarios.colabTotal > 0 ? (statsUsuarios.colab / statsUsuarios.colabTotal) * 100 : 0}%`, height: '100%', background: '#8b5cf6' }} />
            </div>
          </div>
          {/* Card Alunos */}
          <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid #f1f5f9', borderRadius: '20px', padding: '16px 20px', minWidth: 160, boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
            <div style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><GraduationCap size={14} color="#3b82f6" /> Alunos</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <div style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: '#1d4ed8' }}>{statsUsuarios.alunos}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', fontFamily: 'Outfit, sans-serif' }}>/ {statsUsuarios.alunosTotal}</div>
            </div>
            <div style={{ width: '100%', height: 4, background: 'hsl(var(--bg-hover))', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
              <div style={{ width: `${statsUsuarios.alunosTotal > 0 ? (statsUsuarios.alunos / statsUsuarios.alunosTotal) * 100 : 0}%`, height: '100%', background: '#3b82f6' }} />
            </div>
          </div>
          {/* Card Responsáveis */}
          <div style={{ background: 'hsl(var(--bg-surface))', border: '1px solid #f1f5f9', borderRadius: '20px', padding: '16px 20px', minWidth: 160, boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
            <div style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', fontWeight: 800, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><Users size={14} color="#10b981" /> Responsáveis</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <div style={{ fontSize: '24px', fontWeight: 900, fontFamily: 'Outfit, sans-serif', color: '#047857' }}>{statsUsuarios.resps}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#cbd5e1', fontFamily: 'Outfit, sans-serif' }}>/ {statsUsuarios.respsTotal}</div>
            </div>
            <div style={{ width: '100%', height: 4, background: 'hsl(var(--bg-hover))', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
              <div style={{ width: `${statsUsuarios.respsTotal > 0 ? (statsUsuarios.resps / statsUsuarios.respsTotal) * 100 : 0}%`, height: '100%', background: '#10b981' }} />
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      
      {/* ── Modal de Aniversariantes ──────────────────────────── */}
      <AnimatePresence>
        {modalAnivOpen && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setModalAnivOpen(false)}
              style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)' }} 
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              style={{ 
                position: 'relative', width: '100%', maxWidth: 800, maxHeight: '85vh', 
                background: 'hsl(var(--bg-surface))', borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden'
              }}
            >
              {/* Header */}
              <div style={{ padding: '24px 32px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(to right, #fdf2f8, hsl(var(--bg-surface)))' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 16, background: '#fbcfe8', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Cake size={24} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: 20, fontWeight: 900, color: 'hsl(var(--text-primary))', margin: 0, fontFamily: 'Outfit, sans-serif' }}>Aniversariantes do Mês</h2>
                    <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', margin: '4px 0 0 0', fontWeight: 600 }}>
                      Mês de {new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(hoje).charAt(0).toUpperCase() + new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(hoje).slice(1)}
                    </p>
                  </div>
                </div>
                <button onClick={() => setModalAnivOpen(false)} style={{ width: 36, height: 36, borderRadius: '50%', background: 'hsl(var(--bg-hover))', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-secondary))', cursor: 'pointer', transition: 'all 0.2s' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Filters */}
              <div style={{ padding: '20px 32px', background: 'hsl(var(--bg-elevated))', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 8, textTransform: 'uppercase' }}>Ano Letivo</label>
                  <select 
                    value={anivFiltroAno} 
                    onChange={e => { setAnivFiltroAno(e.target.value); setAnivFiltroTurma('Todas') }}
                    style={{ width: '100%', padding: '10px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-primary))', outline: 'none' }}
                  >
                    <option value="Todos">Todos os Anos Letivos</option>
                    {cfgCalendarioLetivo.map((c: any) => (
                      <option key={c.id} value={String(c.ano)}>{c.ano}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', marginBottom: 8, textTransform: 'uppercase' }}>Turma</label>
                  <select 
                    value={anivFiltroTurma} 
                    onChange={e => setAnivFiltroTurma(e.target.value)}
                    style={{ width: '100%', padding: '10px 16px', borderRadius: 12, border: '1px solid #cbd5e1', fontSize: 14, fontWeight: 600, color: 'hsl(var(--text-primary))', outline: 'none' }}
                  >
                    <option value="Todas">Todas as Turmas</option>
                    {turmas.filter((t: any) => anivFiltroAno === 'Todos' || String(t.ano || t.ano_letivo) === anivFiltroAno).map((t: any) => (
                      <option key={t.id} value={t.nome}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* List */}
              <div style={{ padding: 32, overflowY: 'auto', flex: 1, background: 'hsl(var(--bg-surface))' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                  {aniversariantes
                    .filter((a: any) => anivFiltroAno === 'Todos' || a.anoLetivoId === anivFiltroAno)
                    .filter((a: any) => anivFiltroTurma === 'Todas' || a.turma === anivFiltroTurma)
                    .map((aniv: any) => (
                    <div key={aniv.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', borderRadius: '16px', border: '1px solid #fce7f3', background: 'hsl(var(--bg-surface))bfd' }}>
                      <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(236, 72, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ec4899', fontWeight: 800, fontSize: '18px', flexShrink: 0, border: '2px solid #fbcfe8' }}>
                        {aniv.foto ? <img src={aniv.foto} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : getInitials(aniv.nome)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '15px', fontWeight: 900, color: 'hsl(var(--text-primary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aniv.nome}</div>
                        <div style={{ fontSize: '12px', color: 'hsl(var(--text-secondary))', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 4 }}>Turma • {aniv.turma}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#ec4899', padding: '8px 12px', borderRadius: 12, color: 'hsl(var(--bg-surface))' }}>
                        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', opacity: 0.9 }}>Dia</span>
                        <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>{aniv.dia}</span>
                      </div>
                    </div>
                  ))}
                  {aniversariantes
                    .filter((a: any) => anivFiltroAno === 'Todos' || a.anoLetivoId === anivFiltroAno)
                    .filter((a: any) => anivFiltroTurma === 'Todas' || a.turma === anivFiltroTurma).length === 0 && (
                    <div style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: 15, fontWeight: 600 }}>
                      Nenhum aniversariante encontrado para os filtros selecionados.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
