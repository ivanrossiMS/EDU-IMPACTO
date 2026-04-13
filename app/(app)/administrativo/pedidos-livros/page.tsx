'use client'
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import React from 'react'
import { useData } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import {
  BookOpen, CheckCircle2, Clock, Search, Users, Building2,
  ChevronDown, X, MessageSquare, RotateCcw, Download, Filter,
  BookMarked, StickyNote, Check, Layers, PackageCheck, Plus
} from 'lucide-react'

// ─── Tipos locais ─────────────────────────────────────────────────
interface PedidoMeta {
  tituloId: string
  feito: boolean
  dataFeito?: string
  entregue?: boolean
  dataEntrega?: string
  obs?: string
}

const EVENTOS_LIVROS = ['livros', 'apostilas em', 'apostilas fund2', 'apostila em', 'apostila fund2', 'apostilas ens. médio']

function isEventoLivro(descricao?: string): boolean {
  if (!descricao) return false
  const d = descricao.toLowerCase()
  return EVENTOS_LIVROS.some(e => d.includes(e))
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function fmtData(s?: string | null) {
  if (!s) return '—'
  // Se já está no formato DD/MM/YYYY (vindo de aluno.parcelas), retorna direto
  if (s.includes('/')) return s.slice(0, 10) // "DD/MM/YYYY"
  // Formato ISO YYYY-MM-DD (vindo de titulos do DataContext)
  const [a, m, d] = s.slice(0, 10).split('-')
  if (!d || !m || !a) return s
  return `${d}/${m}/${a}`
}
function fmtDataHora(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Chip de evento colorido ───────────────────────────────────────
const EVENTO_CORES: Record<string, { bg: string; color: string }> = {
  'livros':         { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
  'apostilas em':   { bg: 'rgba(139,92,246,0.12)',  color: '#a78bfa' },
  'apostila em':    { bg: 'rgba(139,92,246,0.12)',  color: '#a78bfa' },
  'apostilas fund2':{ bg: 'rgba(236,72,153,0.12)',  color: '#f472b6' },
  'apostila fund2': { bg: 'rgba(236,72,153,0.12)',  color: '#f472b6' },
}
function getEventoCor(desc?: string) {
  if (!desc) return { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' }
  const d = desc.toLowerCase()
  for (const [key, cor] of Object.entries(EVENTO_CORES)) {
    if (d.includes(key)) return cor
  }
  return { bg: 'rgba(100,116,139,0.12)', color: '#94a3b8' }
}

type FiltroView = 'todos' | 'pendentes' | 'feitos' | 'entregues'
type FiltroAgrup = 'escola' | 'turma' | 'evento'

// ─── Inferir segmento a partir da série/turma do aluno ────────────
function inferirSegmento(serie?: string, turma?: string): string {
  const s = (serie ?? '').toUpperCase()
  const t = (turma ?? '').toUpperCase()
  const combined = s + ' ' + t
  if (combined.includes('EI') || combined.includes('INFANTIL') || combined.includes('MATERNAL') || combined.includes('BERCARIO') || combined.includes('BERÇÁRIO') || combined.includes('JARDIM') || combined.includes('PRE') || combined.includes('PRÉ')) return 'Educação Infantil'
  if (combined.includes('FUND2') || combined.includes('FUND II') || combined.includes('EF2') || combined.includes('6º') || combined.includes('7º') || combined.includes('8º') || combined.includes('9º') || combined.includes('6 ANO') || combined.includes('7 ANO') || combined.includes('8 ANO') || combined.includes('9 ANO')) return 'Fundamental II'
  if (combined.includes('FUND1') || combined.includes('FUND I') || combined.includes('EF1') || combined.includes('1º') || combined.includes('2º') || combined.includes('3º') || combined.includes('4º') || combined.includes('5º') || combined.includes('1 ANO') || combined.includes('2 ANO') || combined.includes('3 ANO') || combined.includes('4 ANO') || combined.includes('5 ANO')) return 'Fundamental I'
  if (combined.includes(' EM') || combined.includes('ENS. MÉDIO') || combined.includes('ENSINO MÉDIO') || combined.includes('MÉDIO') || combined.includes('MEDIO') || combined.includes('1ª SÉRIE') || combined.includes('2ª SÉRIE') || combined.includes('3ª SÉRIE')) return 'Ensino Médio'
  if (combined.includes('EJA') || combined.includes('ADULTOS')) return 'EJA'
  return 'Outro'
}

export default function PedidosLivrosPage() {
  const { cfgEventos } = useData();
  const [titulos, setTitulos] = useSupabaseArray<any>('titulos');
  const [alunos, setAlunos] = useSupabaseArray<any>('alunos');
  const [pedidos, setPedidos] = useLocalStorage<PedidoMeta[]>('edu-pedidos-livros', [])
  const [pedidosManuais, setPedidosManuais] = useLocalStorage<ParcelaUnificada[]>('edu-pedidos-livros-manuais', [])

  // Filtros UI
  const [busca, setBusca]               = React.useState('')
  const [filtroView, setFiltroView]     = React.useState<FiltroView>('todos')
  const [filtroTurma, setFiltroTurma]   = React.useState('')
  const [filtroEvento, setFiltroEvento] = React.useState('')
  const [filtroSegmento, setFiltroSeg]  = React.useState('')
  const [agrupamento, setAgrupamento]   = React.useState<FiltroAgrup>('turma')
  const [obsModal, setObsModal]         = React.useState<string | null>(null)
  const [obsTexto, setObsTexto]         = React.useState('')
  const [modalParcelas, setModalParcelas] = React.useState<typeof grupos[0] | null>(null)
  const [modalNovoPedido, setModalNovoPedido] = React.useState(false)
  const [novoPedidoForm, setNovoPedidoForm] = React.useState({ alunoId: '', eventoDescricao: 'Livros', valor: '', vencimento: '' })
  const [buscaAluno, setBuscaAluno] = React.useState('')
  const [showBuscaAluno, setShowBuscaAluno] = React.useState(false)

  // ── Tipo unificado de parcela ─────────────────────────────────────────────
  type ParcelaUnificada = {
    id: string
    aluno: string
    alunoId?: string
    eventoDescricao: string
    eventoId?: string
    valor: number
    vencimento: string
    dataLancamento?: string  // ISO timestamp da inserção do evento
  }

  // ── Resolução de nome do evento: olha todos os campos possíveis ──────────
  const resolverDesc = React.useCallback((raw: {
    evento?: string; eventoDescricao?: string; descricao?: string; eventoId?: string
  }): string => {
    if (raw.evento?.trim()) return raw.evento.trim()
    if (raw.eventoDescricao?.trim()) return raw.eventoDescricao.trim()
    if (raw.eventoId) {
      const cfg = cfgEventos.find(e => e.id === raw.eventoId)
      if (cfg?.descricao) return cfg.descricao
    }
    return raw.descricao?.trim() ?? ''
  }, [cfgEventos])

  // ── Fonte 1: parcelas[] dentro de cada aluno (modo edição) ──────────────
  const parcelasDeAlunos: ParcelaUnificada[] = React.useMemo(() => {
    const result: ParcelaUnificada[] = []
    for (const alu of (alunos || [])) {
      const parcs: any[] = (alu as any).parcelas ?? []
      for (const p of parcs) {
        const desc = resolverDesc(p)
        if (!isEventoLivro(desc)) continue
        result.push({
          id: `alu-${alu.id}-p-${p.num ?? p.codigo ?? String(Math.random()).slice(2)}`,
          aluno: alu.nome,
          alunoId: alu.id,
          eventoDescricao: desc,
          eventoId: p.eventoId,
          valor: Number(p.valor) || 0,
          vencimento: p.vencimento ?? '',
          dataLancamento: p.dataLancamento,  // ISO timestamp gravado no momento da inserção
        })
      }
    }
    return result
  }, [alunos, resolverDesc])

  // ── Fonte 2: titulos no DataContext (nova matrícula recém-criada) ─────────
  const parcelasDeTitulos: ParcelaUnificada[] = React.useMemo(() => {
    return (titulos || [])
      .filter(t => isEventoLivro(resolverDesc({
        eventoDescricao: t.eventoDescricao, descricao: t.descricao, eventoId: t.eventoId
      })))
      .map(t => ({
        id: t.id,
        aluno: t.aluno,
        eventoDescricao: resolverDesc({
          eventoDescricao: t.eventoDescricao, descricao: t.descricao, eventoId: t.eventoId
        }),
        eventoId: t.eventoId,
        valor: t.valor,
        vencimento: t.vencimento ?? '',
      }))
  }, [titulos, resolverDesc])

  // ── Unifica fontes: parcelas diretas do aluno têm prioridade ─────────────
  const todasParcelas: ParcelaUnificada[] = React.useMemo(() => {
    const alunosComParcDiretas = new Set(parcelasDeAlunos.map(p => p.aluno))
    const titulosFiltrados = parcelasDeTitulos.filter(p => !alunosComParcDiretas.has(p.aluno))
    return [...parcelasDeAlunos, ...titulosFiltrados, ...pedidosManuais]
  }, [parcelasDeAlunos, parcelasDeTitulos, pedidosManuais])

  // ── Agrupa por aluno + nome de evento ─────────────────────────────────────
  type GrupoAluno = {
    alunoNome: string
    turma: string
    segmento: string
    eventoId?: string
    eventoDescricao: string
    parcelas: ParcelaUnificada[]
    valorTotal: number
    vencimentos: string[]
    pedidoId: string
    dataLancamento: string
  }

  const grupos: GrupoAluno[] = React.useMemo(() => {
    const map = new Map<string, GrupoAluno>()
    for (const p of todasParcelas) {
      const alu = (alunos || []).find(a => a.nome === p.aluno || a.id === p.alunoId)
      const key = `${p.aluno}__${p.eventoDescricao}`
      if (!map.has(key)) {
        map.set(key, {
          alunoNome: p.aluno,
          turma: alu?.turma ?? '—',
          segmento: inferirSegmento(alu?.serie, alu?.turma),
          eventoId: p.eventoId,
          eventoDescricao: p.eventoDescricao,
          parcelas: [],
          valorTotal: 0,
          vencimentos: [],
          pedidoId: p.id,
          dataLancamento: p.dataLancamento ?? '',  // ISO do momento de inserção
        })
      }
      const g = map.get(key)!
      g.parcelas.push(p)
      g.valorTotal += p.valor
      if (p.vencimento) g.vencimentos.push(p.vencimento)
    }
    return Array.from(map.values()).sort((a, b) => a.turma.localeCompare(b.turma) || a.alunoNome.localeCompare(b.alunoNome))
  }, [todasParcelas, alunos])

  // helper: obter estado do pedido
  function getPedido(pedidoId: string) {
    return pedidos.find(p => p.tituloId === pedidoId)
  }
  function isFeito(pedidoId: string) { return getPedido(pedidoId)?.feito ?? false }
  function isEntregue(pedidoId: string) { return getPedido(pedidoId)?.entregue ?? false }

  // ── Marcar / Desmarcar Feito ─────────────────────────────────────
  function marcarFeito(ids: string[], feito: boolean) {
    setPedidos(prev => {
      const map = new Map(prev.map(p => [p.tituloId, p]))
      for (const id of ids) {
        map.set(id, {
          ...(map.get(id) ?? { tituloId: id, feito: false }),
          feito,
          dataFeito: feito ? new Date().toISOString() : undefined,
        })
      }
      return Array.from(map.values())
    })
  }

  // ── Marcar / Desmarcar Entregue ───────────────────────────────────
  function marcarEntregue(ids: string[], entregue: boolean) {
    setPedidos(prev => {
      const map = new Map(prev.map(p => [p.tituloId, p]))
      for (const id of ids) {
        const atual = map.get(id) ?? { tituloId: id, feito: false }
        map.set(id, {
          ...atual,
          entregue,
          dataEntrega: entregue ? new Date().toISOString() : undefined,
          // Ao marcar como entregue, marca pedido como feito também
          feito: entregue ? true : atual.feito,
          dataFeito: entregue && !atual.feito ? new Date().toISOString() : atual.dataFeito,
        })
      }
      return Array.from(map.values())
    })
  }

  function salvarObs(pedidoId: string, obs: string) {
    setPedidos(prev => {
      const map = new Map(prev.map(p => [p.tituloId, p]))
      map.set(pedidoId, { ...(map.get(pedidoId) ?? { tituloId: pedidoId, feito: false }), obs })
      return Array.from(map.values())
    })
  }

  // ── Filtrar grupos ─────────────────────────────────────────────────
  const turmas       = [...new Set(grupos.map(g => g.turma))].filter(t => t !== '—').sort()
  const eventosLista = [...new Set(grupos.map(g => g.eventoDescricao))].sort()
  const segmentos    = [...new Set(grupos.map(g => g.segmento))].filter(Boolean).sort()

  const gruposFiltrados = grupos.filter(g => {
    const matchBusca = !busca ||
      g.alunoNome.toLowerCase().includes(busca.toLowerCase()) ||
      g.turma.toLowerCase().includes(busca.toLowerCase()) ||
      g.segmento.toLowerCase().includes(busca.toLowerCase()) ||
      g.eventoDescricao.toLowerCase().includes(busca.toLowerCase())

    const matchTurma    = !filtroTurma    || g.turma    === filtroTurma
    const matchEvento   = !filtroEvento   || g.eventoDescricao === filtroEvento
    const matchSegmento = !filtroSegmento || g.segmento === filtroSegmento

    const feito    = isFeito(g.pedidoId)
    const entregue  = isEntregue(g.pedidoId)
    const matchView =
      filtroView === 'todos'     ? true :
      filtroView === 'entregues' ? entregue :
      filtroView === 'feitos'    ? feito :
      !feito

    return matchBusca && matchTurma && matchEvento && matchSegmento && matchView
  })

  // ── Ação em lote ───────────────────────────────────────────────────
  function marcarTodosFeito(gs: GrupoAluno[], feito: boolean) {
    marcarFeito(gs.map(g => g.pedidoId), feito)
  }

  // ── KPIs ──────────────────────────────────────────────────────────
  const totalGrupos    = grupos.length
  const feitosCount   = grupos.filter(g => isFeito(g.pedidoId)).length
  const entreguesCount = grupos.filter(g => isEntregue(g.pedidoId)).length
  const pendenteCount = totalGrupos - feitosCount
  const valorTotalGeral = grupos.reduce((s, g) => s + g.valorTotal, 0)

  // ── Agrupamento visual ─────────────────────────────────────────────
  function getChaves(): string[] {
    if (agrupamento === 'turma') return [...new Set(gruposFiltrados.map(g => g.turma))].sort()
    if (agrupamento === 'evento') return [...new Set(gruposFiltrados.map(g => g.eventoDescricao))].sort()
    return ['Escola Toda']
  }

  function getGruposPorChave(chave: string): GrupoAluno[] {
    if (agrupamento === 'turma') return gruposFiltrados.filter(g => g.turma === chave)
    if (agrupamento === 'evento') return gruposFiltrados.filter(g => g.eventoDescricao === chave)
    return gruposFiltrados
  }

  const chaves = getChaves()

  // ── Obs Modal ─────────────────────────────────────────────────────
  function abrirObs(pedidoId: string) {
    setObsTexto(getPedido(pedidoId)?.obs ?? '')
    setObsModal(pedidoId)
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2))',
            border: '1px solid rgba(139,92,246,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22
          }}>📚</div>
          <div>
            <h1 className="page-title">Pedidos — Livros & Apostilas</h1>
            <p className="page-subtitle">
              Controle de pedidos gerados a partir dos eventos financeiros dos alunos
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-primary btn-sm" onClick={() => setModalNovoPedido(true)}>
            <Plus size={13} /> Novo Pedido Manual
          </button>
          <button
            className="btn btn-secondary btn-sm"
            style={{ gap: 6 }}
            onClick={() => {
              const csv = ['Aluno,Turma,Evento,Parcelas,Valor Total,Status,Data Pedido,Obs']
              for (const g of grupos) {
                const p = getPedido(g.pedidoId)
                csv.push([
                  g.alunoNome, g.turma, g.eventoDescricao, g.parcelas.length,
                  g.valorTotal.toFixed(2),
                  p?.feito ? 'Feito' : 'Pendente',
                  p?.dataFeito ? new Date(p.dataFeito).toLocaleDateString('pt-BR') : '',
                  p?.obs ?? ''
                ].join(','))
              }
              const blob = new Blob([csv.join('\n')], { type: 'text/csv' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url; a.download = `pedidos-livros-${new Date().toISOString().slice(0,10)}.csv`; a.click()
              URL.revokeObjectURL(url)
            }}
          >
            <Download size={13} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total de Pedidos',  value: totalGrupos,    icon: '📋', color: '#60a5fa' },
          { label: 'Pendentes',         value: pendenteCount,  icon: '⏳', color: '#f59e0b' },
          { label: 'Pedido Feito',      value: feitosCount,    icon: '✅', color: '#10b981' },
          { label: 'Entregues',         value: entreguesCount, icon: '📦', color: '#34d399' },
        ].map(k => (
          <div key={k.label} className="kpi-card" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>{k.icon}</span>
              <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{k.label}</span>
            </div>
            <div style={{
              fontSize: (k as { isText?: boolean }).isText ? 15 : 28,
              fontWeight: 900, color: k.color, fontFamily: 'Outfit,sans-serif'
            }}>
              {k.value}
            </div>
            {typeof k.value === 'number' && totalGrupos > 0 && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 3,
                background: `linear-gradient(90deg, ${k.color}33, transparent)`,
              }}>
                <div style={{
                  height: '100%', width: `${(k.value / totalGrupos) * 100}%`,
                  background: k.color, borderRadius: 9999, transition: 'width 0.5s'
                }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Barra de filtros */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Busca */}
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
            <input
              className="form-input"
              style={{ paddingLeft: 32 }}
              placeholder="Buscar aluno, turma ou evento..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          {/* Status */}
          <div style={{ display: 'flex', gap: 4, background: 'hsl(var(--bg-elevated))', padding: 3, borderRadius: 8 }}>
            {([
              { v: 'todos',     label: 'Todos' },
              { v: 'pendentes', label: '⏳ Pendentes' },
              { v: 'feitos',    label: '✅ Feitos' },
              { v: 'entregues', label: '📦 Entregues' },
            ] as { v: FiltroView; label: string }[]).map(opt => (
              <button
                key={opt.v}
                onClick={() => setFiltroView(opt.v)}
                className={`btn btn-sm ${filtroView === opt.v ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 11, padding: '4px 10px' }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Segmento */}
          <select className="form-input" style={{ width: 170 }} value={filtroSegmento} onChange={e => setFiltroSeg(e.target.value)}>
            <option value="">Todos os segmentos</option>
            {segmentos.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Turma */}
          <select className="form-input" style={{ width: 150 }} value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
            <option value="">Todas as turmas</option>
            {turmas.map(t => <option key={t} value={t}>{t}</option>)}
          </select>

          {/* Evento */}
          <select className="form-input" style={{ width: 170 }} value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)}>
            <option value="">Todos os eventos</option>
            {eventosLista.map(e => <option key={e} value={e}>{e}</option>)}
          </select>

          {/* Agrupamento */}
          <div style={{ display: 'flex', gap: 4, background: 'hsl(var(--bg-elevated))', padding: 3, borderRadius: 8 }}>
            {([
              { v: 'turma', icon: <Users size={12} />, label: 'Turma' },
              { v: 'evento', icon: <BookOpen size={12} />, label: 'Evento' },
              { v: 'escola', icon: <Building2 size={12} />, label: 'Escola' },
            ] as { v: FiltroAgrup; icon: React.ReactNode; label: string }[]).map(opt => (
              <button
                key={opt.v}
                onClick={() => setAgrupamento(opt.v)}
                className={`btn btn-sm ${agrupamento === opt.v ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 11, padding: '4px 10px', gap: 4, display: 'flex', alignItems: 'center' }}
              >
                {opt.icon}{opt.label}
              </button>
            ))}
          </div>

          {(busca || filtroTurma || filtroEvento || filtroSegmento || filtroView !== 'todos') && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setBusca(''); setFiltroTurma(''); setFiltroEvento(''); setFiltroSeg(''); setFiltroView('todos') }}
            >
              <X size={12} /> Limpar
            </button>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
          {gruposFiltrados.length} pedido(s) encontrado(s) de {totalGrupos} total
        </div>
      </div>

      {/* Empty */}
      {grupos.length === 0 ? (
        <div className="card" style={{ padding: '80px 40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <BookMarked size={52} style={{ margin: '0 auto 20px', opacity: 0.2 }} />
          <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>Nenhum pedido de livros/apostilas encontrado</div>
          <div style={{ fontSize: 13, maxWidth: 420, margin: '0 auto' }}>
            Os pedidos aparecem automaticamente quando eventos financeiros com o nome <strong>"Livros"</strong>, <strong>"Apostilas EM"</strong> ou <strong>"Apostilas FUND2"</strong> são lançados no financeiro do aluno.
          </div>
        </div>
      ) : gruposFiltrados.length === 0 ? (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
          <Filter size={40} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Nenhum resultado para os filtros selecionados</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {chaves.map(chave => {
            const gsChave = getGruposPorChave(chave)
            if (gsChave.length === 0) return null
            const todosFeitos = gsChave.every(g => isFeito(g.pedidoId))
            const algumFeito  = gsChave.some(g => isFeito(g.pedidoId))
            const valorChave  = gsChave.reduce((s, g) => s + g.valorTotal, 0)
            const feitosChave = gsChave.filter(g => isFeito(g.pedidoId)).length

            const corEvento = agrupamento === 'evento' ? getEventoCor(chave) : undefined

            return (
              <div key={chave}>
                {/* Header do grupo */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 10, padding: '10px 16px',
                  background: 'hsl(var(--bg-elevated))',
                  borderRadius: 12,
                  border: '1px solid hsl(var(--border-subtle))',
                  borderLeft: `4px solid ${agrupamento === 'evento' && corEvento ? corEvento.color : '#3b82f6'}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>
                      {agrupamento === 'turma' ? '🏫' : agrupamento === 'evento' ? '📖' : '🏛️'}
                    </span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{chave}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                        {gsChave.length} aluno(s) · {feitosChave}/{gsChave.length} feitos · {fmt(valorChave)}
                      </div>
                    </div>
                    {/* Barra de progresso inline */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
                      <div style={{ width: 80, height: 5, background: 'hsl(var(--bg-overlay))', borderRadius: 9999 }}>
                        <div style={{
                          height: '100%',
                          width: `${(feitosChave / gsChave.length) * 100}%`,
                          background: todosFeitos ? '#10b981' : algumFeito ? '#f59e0b' : '#3b82f6',
                          borderRadius: 9999, transition: 'width 0.4s',
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>
                        {Math.round((feitosChave / gsChave.length) * 100)}%
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ gap: 5, fontSize: 11 }}
                      onClick={() => marcarTodosFeito(gsChave, !todosFeitos)}
                    >
                      {todosFeitos ? <RotateCcw size={11} /> : <Check size={11} />}
                      {todosFeitos ? 'Desfazer todos' : 'Marcar todos feito'}
                    </button>
                  </div>
                </div>

                {/* Tabela do grupo */}
                <div className="table-container" style={{ borderRadius: 12, overflow: 'hidden' }}>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}></th>
                        <th>Aluno</th>
                        {agrupamento !== 'turma' && <th>Turma</th>}
                        {agrupamento !== 'evento' && <th>Evento</th>}
                        <th style={{ textAlign: 'center' }}>Parcelas</th>
                        <th style={{ textAlign: 'right' }}>Valor Total</th>
                        <th>Data Entrega</th>
                        <th>Lançamento</th>
                        <th style={{ textAlign: 'center' }}>Status</th>
                        <th>Data Pedido</th>
                        <th>Obs</th>
                        <th style={{ textAlign: 'center' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gsChave.map(g => {
                        const pedido  = getPedido(g.pedidoId)
                        const feito   = pedido?.feito ?? false
                        const entregue = pedido?.entregue ?? false
                        const cor = getEventoCor(g.eventoDescricao)
                        const vencMin = g.vencimentos.sort()[0]
                        const vencMax = g.vencimentos.sort().at(-1)

                        return (
                          <tr key={g.pedidoId} style={{
                            background: feito ? 'rgba(16,185,129,0.03)' : undefined,
                            opacity: feito ? 0.8 : 1,
                            transition: 'all 0.2s',
                          }}>
                            {/* Checkbox */}
                            <td style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => marcarFeito([g.pedidoId], !feito)}
                                style={{
                                  width: 22, height: 22, borderRadius: 6,
                                  border: `2px solid ${feito ? '#10b981' : 'hsl(var(--border-default))'}`,
                                  background: feito ? '#10b981' : 'transparent',
                                  cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  transition: 'all 0.15s',
                                }}
                              >
                                {feito && <Check size={12} color="#fff" strokeWidth={3} />}
                              </button>
                            </td>

                            {/* Aluno */}
                            <td>
                              <div style={{ fontWeight: 700, fontSize: 13 }}>{g.alunoNome}</div>
                              {agrupamento === 'turma' && (
                                <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>{g.turma}</div>
                              )}
                            </td>

                            {/* Turma (se agrup não é turma) */}
                            {agrupamento !== 'turma' && (
                              <td>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  fontSize: 11, fontWeight: 600,
                                  background: 'rgba(59,130,246,0.1)', color: '#60a5fa',
                                  borderRadius: 6, padding: '2px 8px'
                                }}>
                                  <Layers size={10} />{g.turma}
                                </span>
                              </td>
                            )}

                            {/* Evento (se agrup não é evento) */}
                            {agrupamento !== 'evento' && (
                              <td>
                                <span style={{
                                  display: 'inline-block', fontSize: 11, fontWeight: 600,
                                  background: cor.bg, color: cor.color,
                                  borderRadius: 6, padding: '2px 8px',
                                  whiteSpace: 'nowrap',
                                }}>
                                  {g.eventoDescricao}
                                </span>
                              </td>
                            )}

                            {/* Qtd parcelas — clicável */}
                            <td style={{ textAlign: 'center' }}>
                              <button
                                onClick={() => setModalParcelas(g)}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  width: 32, height: 32, borderRadius: '50%',
                                  background: 'rgba(167,139,250,0.12)',
                                  fontWeight: 900, fontSize: 13, color: '#a78bfa',
                                  border: '1.5px solid rgba(167,139,250,0.35)',
                                  cursor: 'pointer', transition: 'all 0.15s',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(167,139,250,0.25)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(167,139,250,0.12)')}
                                title="Ver detalhes das parcelas"
                              >
                                {g.parcelas.length}
                              </button>
                            </td>

                            {/* Valor */}
                            <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'Outfit,sans-serif', fontSize: 14, color: '#34d399' }}>
                              {fmt(g.valorTotal)}
                            </td>

                            {/* Data Entrega */}
                            <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                              {pedido?.entregue && pedido.dataEntrega ? (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  background: 'rgba(52,211,153,0.12)', color: '#34d399',
                                  borderRadius: 6, padding: '2px 8px', fontWeight: 600,
                                }}>
                                  <PackageCheck size={10} /> {fmtDataHora(pedido.dataEntrega)}
                                </span>
                              ) : <span style={{ color: 'hsl(var(--text-muted))', opacity: 0.5 }}>—</span>}
                            </td>

                            {/* Data de lançamento */}
                            <td style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                              {g.dataLancamento ? (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  background: 'rgba(99,102,241,0.08)', color: '#818cf8',
                                  borderRadius: 6, padding: '2px 8px', fontWeight: 600,
                                }}>
                                  📅 {g.dataLancamento.includes('T')
                                    ? fmtDataHora(g.dataLancamento)
                                    : fmtData(g.dataLancamento)}
                                </span>
                              ) : <span style={{ color: 'hsl(var(--text-muted))', opacity: 0.5 }}>—</span>}
                            </td>

                            {/* Status badge — 3 níveis: Entregue > Pedido Feito > Pendente */}
                            <td style={{ textAlign: 'center' }}>
                              {entregue ? (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  background: 'rgba(52,211,153,0.15)', color: '#34d399',
                                  borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700
                                }}>
                                  <PackageCheck size={11} /> Entregue
                                </span>
                              ) : feito ? (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  background: 'rgba(16,185,129,0.12)', color: '#10b981',
                                  borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700
                                }}>
                                  <CheckCircle2 size={11} /> Pedido Feito
                                </span>
                              ) : (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  background: 'rgba(245,158,11,0.12)', color: '#f59e0b',
                                  borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700
                                }}>
                                  <Clock size={11} /> Pendente
                                </span>
                              )}
                            </td>

                            {/* Data do pedido */}
                            <td style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                              {pedido?.feito && pedido.dataFeito
                                ? <span style={{ color: '#10b981' }}>{fmtDataHora(pedido.dataFeito)}</span>
                                : '—'}
                            </td>

                            {/* Obs preview */}
                            <td style={{ maxWidth: 120 }}>
                              {pedido?.obs ? (
                                <span
                                  onClick={() => abrirObs(g.pedidoId)}
                                  style={{
                                    display: 'block',
                                    fontSize: 11, color: '#60a5fa', cursor: 'pointer',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    textDecoration: 'underline dotted',
                                  }}
                                  title={pedido.obs}
                                >
                                  {pedido.obs}
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', opacity: 0.5 }}>—</span>
                              )}
                            </td>

                            {/* Ações */}
                            <td>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                                <button
                                  className="btn btn-ghost btn-icon btn-sm"
                                  title={feito ? 'Desfazer pedido feito' : 'Marcar como pedido feito'}
                                  style={{ color: feito ? '#f59e0b' : '#10b981' }}
                                  onClick={() => marcarFeito([g.pedidoId], !feito)}
                                >
                                  {feito ? <RotateCcw size={13} /> : <CheckCircle2 size={13} />}
                                </button>
                                <button
                                  className="btn btn-ghost btn-icon btn-sm"
                                  title={entregue ? 'Desfazer entrega' : 'Marcar como entregue'}
                                  style={{ color: entregue ? '#f59e0b' : '#34d399' }}
                                  onClick={() => marcarEntregue([g.pedidoId], !entregue)}
                                >
                                  {entregue ? <RotateCcw size={13} /> : <PackageCheck size={13} />}
                                </button>
                                <button
                                  className="btn btn-ghost btn-icon btn-sm"
                                  title="Adicionar observação"
                                  style={{ color: pedido?.obs ? '#60a5fa' : undefined }}
                                  onClick={() => abrirObs(g.pedidoId)}
                                >
                                  <StickyNote size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                        <td colSpan={agrupamento === 'escola' ? 5 : agrupamento === 'turma' ? 4 : 4}
                          style={{ padding: '10px 16px', fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>
                          Subtotal ({gsChave.length} aluno(s))
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 900, fontSize: 14, color: '#34d399', fontFamily: 'Outfit,sans-serif' }}>
                          {fmt(valorChave)}
                        </td>
                        <td colSpan={5} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Observação */}
      {obsModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: 'hsl(var(--bg-surface))', borderRadius: 18,
            width: '100%', maxWidth: 480,
            border: '1px solid hsl(var(--border-default))',
            boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))',
              display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <StickyNote size={16} color="#60a5fa" />
                <span style={{ fontWeight: 800, fontSize: 15 }}>Observação do Pedido</span>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setObsModal(null)}>
                <X size={15} />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              {(() => {
                const g = grupos.find(x => x.pedidoId === obsModal)
                return g ? (
                  <div style={{
                    padding: '10px 14px', background: 'hsl(var(--bg-elevated))',
                    borderRadius: 10, marginBottom: 16, fontSize: 12, color: 'hsl(var(--text-muted))'
                  }}>
                    <strong style={{ color: 'hsl(var(--text-primary))' }}>{g.alunoNome}</strong>
                    {' '}· {g.turma} · {g.eventoDescricao}
                  </div>
                ) : null
              })()}
              <textarea
                className="form-input"
                value={obsTexto}
                onChange={e => setObsTexto(e.target.value)}
                placeholder="Digite uma observação sobre este pedido..."
                rows={4}
                style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
              />
            </div>
            <div style={{
              padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))',
              display: 'flex', gap: 8, justifyContent: 'flex-end'
            }}>
              <button className="btn btn-ghost" onClick={() => setObsModal(null)}>Cancelar</button>
              {getPedido(obsModal)?.obs && (
                <button
                  className="btn btn-ghost"
                  style={{ color: '#f87171' }}
                  onClick={() => { salvarObs(obsModal, ''); setObsModal(null) }}
                >
                  Apagar obs.
                </button>
              )}
              <button className="btn btn-primary" onClick={() => { salvarObs(obsModal, obsTexto); setObsModal(null) }}>
                <MessageSquare size={13} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ════════════ MODAL PARCELAS ════════════ */}
      {modalParcelas && (
        <div
          style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:6000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
          onClick={() => setModalParcelas(null)}
        >
          <div
            style={{ background:'hsl(var(--bg-base))',borderRadius:20,width:'100%',maxWidth:560,maxHeight:'85vh',overflowY:'auto',border:'1px solid hsl(var(--border-subtle))',boxShadow:'0 40px 120px rgba(0,0,0,0.8)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ padding:'18px 24px',borderBottom:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'space-between',alignItems:'center',background:'linear-gradient(135deg,rgba(167,139,250,0.08),rgba(99,102,241,0.04))' }}>
              <div style={{ display:'flex',alignItems:'center',gap:12 }}>
                <div style={{ width:40,height:40,borderRadius:10,background:'rgba(167,139,250,0.15)',border:'1.5px solid rgba(167,139,250,0.35)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                  <BookOpen size={18} color="#a78bfa" />
                </div>
                <div>
                  <div style={{ fontWeight:800,fontSize:15 }}>{modalParcelas.alunoNome}</div>
                  <div style={{ fontSize:12,color:'hsl(var(--text-muted))' }}>
                    {modalParcelas.turma} · <span style={{ color:getEventoCor(modalParcelas.eventoDescricao).color }}>{modalParcelas.eventoDescricao}</span>
                  </div>
                </div>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalParcelas(null)}>
                <X size={15} />
              </button>
            </div>

            {/* Parcelas */}
            <div style={{ padding:24 }}>
              <div className="table-container" style={{ borderRadius:12,overflow:'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ textAlign:'center',width:50 }}>#</th>
                      <th>Competência</th>
                      <th>Vencimento</th>
                      <th style={{ textAlign:'right' }}>Valor</th>
                      <th style={{ textAlign:'right' }}>Valor Final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalParcelas.parcelas.map((p, i) => {
                      const raw = p as any
                      return (
                        <tr key={p.id}>
                          <td style={{ textAlign:'center',color:'#a78bfa',fontWeight:800,fontFamily:'monospace' }}>
                            {String(i+1).padStart(2,'0')}
                          </td>
                          <td style={{ fontSize:12,color:'hsl(var(--text-muted))' }}>{raw.competencia ?? '—'}</td>
                          <td style={{ fontSize:13,fontWeight:600 }}>{fmtData(p.vencimento)}</td>
                          <td style={{ textAlign:'right',fontSize:13 }}>{fmt(raw.valor ?? p.valor)}</td>
                          <td style={{ textAlign:'right',fontWeight:700,color:'#34d399' }}>{fmt(raw.valorFinal ?? raw.valor ?? p.valor)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:16,padding:'12px 16px',background:'hsl(var(--bg-elevated))',borderRadius:10 }}>
                <span style={{ fontSize:13,fontWeight:600,color:'hsl(var(--text-muted))' }}>{modalParcelas.parcelas.length} parcela(s)</span>
                <span style={{ fontWeight:900,fontSize:16,color:'#34d399',fontFamily:'Outfit,sans-serif' }}>Total: {fmt(modalParcelas.valorTotal)}</span>
              </div>
            </div>

            <div style={{ padding:'12px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModalParcelas(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════ MODAL NOVO PEDIDO MANUAL ════════════ */}
      {modalNovoPedido && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'hsl(var(--bg-surface))', borderRadius: 18, width: '100%', maxWidth: 460, border: '1px solid hsl(var(--border-default))', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Novo Pedido Manual</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalNovoPedido(false)}><X size={15} /></button>
            </div>
            <div style={{ padding: 24, display: 'grid', gap: 16 }}>
              <div style={{ position: 'relative' }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>
                  ALUNO * {novoPedidoForm.alunoId && <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Selecionado</span>}
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', pointerEvents: 'none' }} />
                  <input
                    className="form-input"
                    style={{ paddingLeft: 30 }}
                    placeholder="Digite para buscar aluno ou turma..."
                    value={buscaAluno}
                    onChange={e => {
                      setBuscaAluno(e.target.value)
                      setShowBuscaAluno(true)
                      if (!e.target.value) setNovoPedidoForm(p => ({...p, alunoId: ''}))
                    }}
                    onFocus={() => setShowBuscaAluno(true)}
                    onBlur={() => setTimeout(() => setShowBuscaAluno(false), 200)}
                  />
                  {novoPedidoForm.alunoId && (
                    <button
                      type="button"
                      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--text-muted))' }}
                      onClick={() => { setBuscaAluno(''); setNovoPedidoForm(p => ({...p, alunoId: ''})) }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                {showBuscaAluno && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                    {alunos.filter(a => !buscaAluno || a.nome.toLowerCase().includes(buscaAluno.toLowerCase()) || a.turma.toLowerCase().includes(buscaAluno.toLowerCase())).slice(0, 15).map(a => (
                      <div
                        key={a.id}
                        onMouseDown={() => {
                          setNovoPedidoForm(p => ({...p, alunoId: a.id}))
                          setBuscaAluno(`${a.nome} (${a.turma})`)
                          setShowBuscaAluno(false)
                        }}
                        style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-overlay))'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontWeight: 600 }}>{a.nome}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{a.turma}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>TIPO DE MATERIAL *</label>
                  <select className="form-input" value={novoPedidoForm.eventoDescricao} onChange={e => setNovoPedidoForm(p => ({...p, eventoDescricao: e.target.value}))}>
                    <option value="Livros">Livros</option>
                    <option value="Apostilas EM">Apostilas EM</option>
                    <option value="Apostilas FUND2">Apostilas FUND2</option>
                    <option value="Apostilas Ens. Médio">Apostilas Ens. Médio</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>DATA PREVISTA</label>
                  <input type="date" className="form-input" value={novoPedidoForm.vencimento} onChange={e => setNovoPedidoForm(p => ({...p, vencimento: e.target.value}))} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>VALOR TOTAL (R$)</label>
                <input type="number" step="0.01" className="form-input" value={novoPedidoForm.valor} onChange={e => setNovoPedidoForm(p => ({...p, valor: e.target.value}))} placeholder="0.00" />
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                💡 Este pedido será aglutinado junto aos eventos financeiros automáticos.
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
               <button className="btn btn-ghost" onClick={() => setModalNovoPedido(false)}>Cancelar</button>
               <button className="btn btn-primary" disabled={!novoPedidoForm.alunoId} onClick={() => {
                 const al = alunos.find(a => a.id === novoPedidoForm.alunoId)
                 if (al) {
                   const novo: ParcelaUnificada = {
                     id: `man-${Date.now()}`,
                     aluno: al.nome,
                     alunoId: al.id,
                     eventoDescricao: novoPedidoForm.eventoDescricao,
                     valor: Number(novoPedidoForm.valor) || 0,
                     vencimento: novoPedidoForm.vencimento || new Date().toISOString().slice(0,10),
                     dataLancamento: new Date().toISOString()
                   }
                   setPedidosManuais(prev => [...prev, novo])
                   setModalNovoPedido(false)
                   setNovoPedidoForm({ alunoId: '', eventoDescricao: 'Livros', valor: '', vencimento: '' })
                 }
               }}>
                 <Check size={14}/> Inserir Pedido
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
