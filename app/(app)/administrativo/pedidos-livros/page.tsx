'use client'
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion';
import { useSupabaseArray } from '@/lib/useSupabaseCollection';


import { useData } from '@/lib/dataContext'
import { useLocalStorage } from '@/lib/useLocalStorage'
import { useApp } from '@/lib/context'
import {
  BookOpen, CheckCircle2, Clock, Search, Users, Building2,
  ChevronDown, X, MessageSquare, RotateCcw, Download, Filter,
  BookMarked, StickyNote, Check, Layers, PackageCheck, Plus, User, CalendarDays,
  Edit2, Trash2
} from 'lucide-react'

// ─── Tipos locais ─────────────────────────────────────────────────
interface PedidoMeta {
  tituloId: string
  feito: boolean
  usuarioFeito?: string
  dataFeito?: string
  chegou?: boolean
  usuarioChegou?: string
  dataChegou?: string
  entregue?: boolean
  usuarioEntrega?: string
  dataEntrega?: string
  obs?: string
}

const EVENTOS_LIVROS = ['livros', 'apostilas em', 'apostilas fund2', 'apostila em', 'apostila fund2', 'apostilas ens. médio', 'liv']

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
function abreviarNome(nome?: string): string {
  if (!nome) return '—'
  const partes = nome.trim().split(/\s+/)
  if (partes.length <= 2) return nome
  return `${partes[0]} ${partes[partes.length - 1]}`
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

type FiltroView = 'todos' | 'pendentes' | 'feitos' | 'chegou' | 'entregues'
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
  const { cfgEventos, turmas: rawTurmas = [] } = useData();
  const { currentUser } = useApp();

  const [titulos, setTitulos, { loading: isTitulosLoading }] = useSupabaseArray<any>('titulos');
  const [alunos, setAlunos, { loading: isAlunosLoading }] = useSupabaseArray<any>('alunos?lightweight=true');
  const [pedidos, setPedidos, { loading: isPedidosLoading }] = useSupabaseArray<PedidoMeta>('administrativo/pedidos-livros', [])
  const [pedidosManuais, setPedidosManuais, { loading: isPedidosManuaisLoading }] = useSupabaseArray<ParcelaUnificada>('administrativo/pedidos-livros-manuais', [])

  const isLoading = isTitulosLoading || isAlunosLoading || isPedidosLoading || isPedidosManuaisLoading;

  // Filtros UI
  const [busca, setBusca]               = React.useState('')
  const [filtroView, setFiltroView]     = React.useState<FiltroView>('todos')
  const [filtroAno, setFiltroAno]       = React.useState(new Date().getFullYear().toString())
  const [filtroTurma, setFiltroTurma]   = React.useState('')
  const [filtroEvento, setFiltroEvento] = React.useState('')
  const [filtroSegmento, setFiltroSeg]  = React.useState('')
  const [agrupamento, setAgrupamento]   = React.useState<FiltroAgrup>('turma')
  const [obsModal, setObsModal]         = React.useState<string | null>(null)
  const [obsTexto, setObsTexto]         = React.useState('')
  const [modalParcelas, setModalParcelas] = React.useState<typeof grupos[0] | null>(null)
  const [modalNovoPedido, setModalNovoPedido] = React.useState(false)
  const [novoPedidoForm, setNovoPedidoForm] = React.useState({ alunoId: '', eventoDescricao: 'Livros', turmaId: '', turma: '', obs: '', turmasDisponiveis: [] as {id:string, nome:string}[] })
  const [buscaAluno, setBuscaAluno] = React.useState('')
  const [showBuscaAluno, setShowBuscaAluno] = React.useState(false)

  // Estados e funções de edição/exclusão de lançamentos
  const [modalEditar, setModalEditar] = React.useState<GrupoAluno | null>(null)
  const [editForm, setEditForm] = React.useState({ eventoDescricao: '', valor: '', vencimento: '' })

  function parseStudentParcelId(id: string) {
    if (id.startsWith('alu-')) {
      const parts = id.split('-p-');
      const studentId = parts[0].replace('alu-', '');
      const parcelId = parts[1];
      return { type: 'aluno', studentId, parcelId };
    }
    if (id.startsWith('man-')) {
      return { type: 'manual', id };
    }
    return { type: 'titulo', id };
  }

  const handleSaveEdit = () => {
    if (!modalEditar) return;
    const parsed = parseStudentParcelId(modalEditar.pedidoId);
    if (parsed.type === 'manual') {
      setPedidosManuais(prev => prev.map(p => p.id === parsed.id ? {
        ...p,
        eventoDescricao: editForm.eventoDescricao,
        valor: Number(editForm.valor) || 0,
        vencimento: editForm.vencimento
      } : p));
    } else if (parsed.type === 'aluno') {
      const alu = (alunos || []).find(a => a.id === parsed.studentId);
      if (alu) {
        const updatedParcelas = (alu.parcelas || []).map((p: any) => {
          const pId = p.num ?? p.codigo ?? '';
          if (pId === parsed.parcelId) {
            return {
              ...p,
              eventoDescricao: editForm.eventoDescricao,
              descricao: editForm.eventoDescricao,
              valor: Number(editForm.valor) || 0,
              vencimento: editForm.vencimento
            };
          }
          return p;
        });
        const updatedAluno = { ...alu, parcelas: updatedParcelas };
        
        setAlunos(prev => prev.map(a => a.id === alu.id ? updatedAluno : a));
        
        fetch(`/api/alunos?id=${alu.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedAluno)
        }).catch(console.error);
      }
    } else if (parsed.type === 'titulo') {
      const tit = titulos.find(t => t.id === parsed.id);
      if (tit) {
        const updatedTitulo = {
          ...tit,
          eventoDescricao: editForm.eventoDescricao,
          descricao: editForm.eventoDescricao,
          valor: Number(editForm.valor) || 0,
          vencimento: editForm.vencimento
        };
        setTitulos(prev => prev.map(t => t.id === tit.id ? updatedTitulo : t));
        fetch(`/api/titulos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedTitulo)
        }).catch(console.error);
      }
    }
    setModalEditar(null);
  };

  const handleDeleteLaunch = (g: GrupoAluno) => {
    if (!window.confirm(`Tem certeza que deseja excluir o lançamento de ${g.eventoDescricao} de ${g.alunoNome}?`)) return;
    const parsed = parseStudentParcelId(g.pedidoId);
    if (parsed.type === 'manual') {
      setPedidosManuais(prev => prev.filter(p => p.id !== parsed.id));
    } else if (parsed.type === 'aluno') {
      const alu = (alunos || []).find(a => a.id === parsed.studentId);
      if (alu) {
        const updatedParcelas = (alu.parcelas || []).filter((p: any) => {
          const pId = p.num ?? p.codigo ?? '';
          return pId !== parsed.parcelId;
        });
        const updatedAluno = { ...alu, parcelas: updatedParcelas };
        
        setAlunos(prev => prev.map(a => a.id === alu.id ? updatedAluno : a));
        
        fetch(`/api/alunos?id=${alu.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedAluno)
        }).catch(console.error);
      }
    } else if (parsed.type === 'titulo') {
      fetch(`/api/titulos?id=${parsed.id}`, { method: 'DELETE' }).catch(console.error);
      setTitulos(prev => prev.filter(t => t.id !== parsed.id));
    }
  };

  // ── Tipo unificado de parcela ─────────────────────────────────────────────
  type ParcelaUnificada = {
    id: string
    aluno: string
    alunoId?: string
    turmaId?: string
    turma?: string
    eventoDescricao: string
    eventoId?: string
    valor: number
    vencimento: string
    dataLancamento?: string  // ISO timestamp da inserção do evento
    usuarioLancamento?: string
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
          usuarioLancamento: p.usuarioLancamento || p.usuario,
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
        dataLancamento: t.dataLancamento || t.created_at || t.createdAt,
        usuarioLancamento: t.usuarioLancamento || t.usuario || t.usuarioCriacao || 'Sistema',
      }))
  }, [titulos, resolverDesc])

  // ── Unifica fontes: parcelas diretas do aluno têm prioridade ─────────────
  const todasParcelas: ParcelaUnificada[] = React.useMemo(() => {
    const alunosComParcDiretas = new Set(parcelasDeAlunos.map(p => p.aluno))
    const titulosFiltrados = parcelasDeTitulos.filter(p => !alunosComParcDiretas.has(p.aluno))
    return [...parcelasDeAlunos, ...titulosFiltrados, ...(Array.isArray(pedidosManuais) ? pedidosManuais : [])]
  }, [parcelasDeAlunos, parcelasDeTitulos, pedidosManuais])

  // ── Agrupa por aluno + nome de evento ─────────────────────────────────────
  type GrupoAluno = {
    alunoNome: string
    turma: string
    segmento: string
    anoLetivo: string
    eventoId?: string
    eventoDescricao: string
    parcelas: ParcelaUnificada[]
    valorTotal: number
    vencimentos: string[]
    pedidoId: string
    dataLancamento: string
    usuarioLancamento: string
  }

  const grupos: GrupoAluno[] = React.useMemo(() => {
    const map = new Map<string, GrupoAluno>()
    for (const p of todasParcelas) {
      const alu = (alunos || []).find(a => a.nome === p.aluno || a.id === p.alunoId)
      const key = `${p.aluno}__${p.eventoDescricao}`
      if (!map.has(key)) {
        const tObj = rawTurmas.find((t: any) => t.id === (p.turmaId || alu?.turma))
        const nomeTurma = p.turma || tObj?.nome || alu?.turma || '—'

        map.set(key, {
          alunoNome: p.aluno,
          turma: nomeTurma,
          segmento: inferirSegmento(alu?.serie, nomeTurma),
          anoLetivo: p.vencimento ? p.vencimento.substring(0, 4) : new Date().getFullYear().toString(),
          eventoId: p.eventoId,
          eventoDescricao: p.eventoDescricao,
          parcelas: [],
          valorTotal: 0,
          vencimentos: [],
          pedidoId: p.id,
          dataLancamento: p.dataLancamento ?? '',  // ISO do momento de inserção
          usuarioLancamento: p.usuarioLancamento ?? '',
        })
      }
      const g = map.get(key)!
      g.parcelas.push(p)
      g.valorTotal += p.valor
      if (p.vencimento) g.vencimentos.push(p.vencimento)
      
      // Se a parcela atual contiver dados de lançamento e o grupo ainda não, propaga
      if (p.dataLancamento && !g.dataLancamento) {
        g.dataLancamento = p.dataLancamento
      }
      if (p.usuarioLancamento && !g.usuarioLancamento) {
        g.usuarioLancamento = p.usuarioLancamento
      }
    }
    return Array.from(map.values()).sort((a, b) => a.turma.localeCompare(b.turma) || a.alunoNome.localeCompare(b.alunoNome))
  }, [todasParcelas, alunos])

  // helper: obter estado do pedido
  function getPedido(pedidoId: string) {
    if (!Array.isArray(pedidos)) return undefined
    return pedidos.find(p => p.tituloId === pedidoId)
  }
  function isFeito(pedidoId: string) { return getPedido(pedidoId)?.feito ?? false }
  function isChegou(pedidoId: string) { return getPedido(pedidoId)?.chegou ?? false }
  function isEntregue(pedidoId: string) { return getPedido(pedidoId)?.entregue ?? false }

  // ── Marcar / Desmarcar Feito ─────────────────────────────────────
  function marcarFeito(ids: string[], feito: boolean) {
    setPedidos(prev => {
      const map = new Map(prev.map(p => [p.tituloId, p]))
      for (const id of ids) {
        map.set(id, {
          ...(map.get(id) ?? { tituloId: id, feito: false }),
          feito,
          usuarioFeito: feito ? currentUser?.nome || 'Usuário' : undefined,
          dataFeito: feito ? new Date().toISOString() : undefined,
          // Se desfizer feito, desfaz também chegou e entregue
          ...(feito ? {} : {
            chegou: false, usuarioChegou: undefined, dataChegou: undefined,
            entregue: false, usuarioEntrega: undefined, dataEntrega: undefined
          })
        })
      }
      return Array.from(map.values())
    })
  }

  // ── Marcar / Desmarcar Chegou ───────────────────────────────────
  function marcarChegou(ids: string[], chegou: boolean) {
    setPedidos(prev => {
      const map = new Map(prev.map(p => [p.tituloId, p]))
      for (const id of ids) {
        const atual = map.get(id) ?? { tituloId: id, feito: false }
        map.set(id, {
          ...atual,
          chegou,
          usuarioChegou: chegou ? currentUser?.nome || 'Usuário' : undefined,
          dataChegou: chegou ? new Date().toISOString() : undefined,
          // Ao marcar como chegou, marca pedido como feito também
          feito: chegou ? true : atual.feito,
          usuarioFeito: chegou && !atual.feito ? currentUser?.nome || 'Usuário' : atual.usuarioFeito,
          dataFeito: chegou && !atual.feito ? new Date().toISOString() : atual.dataFeito,
          // Ao desmarcar chegou, desmarca entregue também
          ...(chegou ? {} : { entregue: false, usuarioEntrega: undefined, dataEntrega: undefined })
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
          usuarioEntrega: entregue ? currentUser?.nome || 'Usuário' : undefined,
          dataEntrega: entregue ? new Date().toISOString() : undefined,
          // Ao marcar como entregue, marca pedido como feito e chegou também
          feito: entregue ? true : atual.feito,
          usuarioFeito: entregue && !atual.feito ? currentUser?.nome || 'Usuário' : atual.usuarioFeito,
          dataFeito: entregue && !atual.feito ? new Date().toISOString() : atual.dataFeito,
          chegou: entregue ? true : atual.chegou,
          usuarioChegou: entregue && !atual.chegou ? currentUser?.nome || 'Usuário' : atual.usuarioChegou,
          dataChegou: entregue && !atual.chegou ? new Date().toISOString() : atual.dataChegou,
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
  const anosDisponiveis = [...new Set(grupos.map(g => g.anoLetivo))].filter(Boolean).sort().reverse()
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
    const matchAno      = !filtroAno      || g.anoLetivo === filtroAno

    const feito    = isFeito(g.pedidoId)
    const chegou   = isChegou(g.pedidoId)
    const entregue = isEntregue(g.pedidoId)
    const matchView =
      filtroView === 'todos'     ? true :
      filtroView === 'entregues' ? entregue :
      filtroView === 'chegou'    ? chegou :
      filtroView === 'feitos'    ? feito :
      !feito

    return matchBusca && matchTurma && matchEvento && matchSegmento && matchView && matchAno
  })

  // ── Ação em lote ───────────────────────────────────────────────────
  function marcarTodosFeito(gs: GrupoAluno[], feito: boolean) {
    marcarFeito(gs.map(g => g.pedidoId), feito)
  }

  // ── KPIs ──────────────────────────────────────────────────────────
  const totalGrupos    = grupos.length
  const feitosCount   = grupos.filter(g => isFeito(g.pedidoId)).length
  const chegouCount   = grupos.filter(g => isChegou(g.pedidoId)).length
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
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .skeleton-shimmer {
          background: linear-gradient(90deg, hsl(var(--bg-elevated)) 25%, hsl(var(--border-subtle)) 50%, hsl(var(--bg-elevated)) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite linear;
        }
      `}} />
      <div className="page-header" style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            border: '2px solid rgba(255, 255, 255, 0.2)'
          }}>📚</div>
          <div>
            <h1 className="page-title" style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em' }}>Pedidos de Materiais</h1>
            <p className="page-subtitle" style={{ fontSize: 14, opacity: 0.8 }}>
              Rastreamento completo desde o lançamento financeiro até a entrega ao aluno.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <motion.button 
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="btn btn-primary" 
            style={{ height: 44, padding: '0 20px', borderRadius: 12, boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
            onClick={() => setModalNovoPedido(true)}
          >
            <Plus size={16} /> Novo Pedido Manual
          </motion.button>
          <button
            className="btn btn-secondary"
            style={{ height: 44, padding: '0 16px', borderRadius: 12, gap: 8 }}
            onClick={() => {
              const csv = ['Aluno,Turma,Evento,Parcelas,Valor Total,Status,Data Pedido,Usuário Pedido,Data Chegou,Usuário Chegou,Data Entrega,Usuário Entrega,Obs']
              for (const g of grupos) {
                const p = getPedido(g.pedidoId)
                csv.push([
                  g.alunoNome, g.turma, g.eventoDescricao, g.parcelas.length,
                  g.valorTotal.toFixed(2),
                  p?.entregue ? 'Entregue' : p?.chegou ? 'Chegou' : p?.feito ? 'Pedido' : 'Pendente',
                  p?.dataFeito ? fmtDataHora(p.dataFeito) : '',
                  p?.usuarioFeito ?? '',
                  p?.dataChegou ? fmtDataHora(p.dataChegou) : '',
                  p?.usuarioChegou ?? '',
                  p?.dataEntrega ? fmtDataHora(p.dataEntrega) : '',
                  p?.usuarioEntrega ?? '',
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
            <Download size={16} /> Exportar
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total de Pedidos',  value: totalGrupos,    icon: '📋', color: '#60a5fa' },
          { label: 'Pendentes',         value: pendenteCount,  icon: '⏳', color: '#f59e0b' },
          { label: 'Pedido Feito',      value: feitosCount,    icon: '✅', color: '#8b5cf6' },
          { label: 'Chegou na Escola',  value: chegouCount,    icon: '🏢', color: '#a78bfa' },
          { label: 'Entregues',         value: entreguesCount, icon: '📦', color: '#10b981' },
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
              { v: 'chegou',    label: '🏢 Chegou' },
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

          {/* Ano Letivo */}
          <select className="form-input" style={{ width: 120 }} value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
            <option value="">Todos os anos</option>
            {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

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

          {(busca || filtroAno !== new Date().getFullYear().toString() || filtroTurma || filtroEvento || filtroSegmento || filtroView !== 'todos') && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { setBusca(''); setFiltroAno(new Date().getFullYear().toString()); setFiltroTurma(''); setFiltroEvento(''); setFiltroSeg(''); setFiltroView('todos') }}
            >
              <X size={12} /> Limpar
            </button>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: 'hsl(var(--text-muted))' }}>
          {gruposFiltrados.length} pedido(s) encontrado(s) de {totalGrupos} total
        </div>
      </div>

      {/* Loading state / Empty / Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div className="skeleton-shimmer" style={{ width: 32, height: 32, borderRadius: 8 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="skeleton-shimmer" style={{ height: 16, width: 140, borderRadius: 6 }} />
                    <div className="skeleton-shimmer" style={{ height: 12, width: 220, borderRadius: 6 }} />
                  </div>
                </div>
                <div className="skeleton-shimmer" style={{ height: 32, width: 120, borderRadius: 8 }} />
              </div>
              <div className="table-container" style={{ borderRadius: 12, overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}><div className="skeleton-shimmer" style={{ height: 16, width: 20, borderRadius: 4 }} /></th>
                      <th><div className="skeleton-shimmer" style={{ height: 16, width: 120, borderRadius: 4 }} /></th>
                      <th><div className="skeleton-shimmer" style={{ height: 16, width: 80, borderRadius: 4 }} /></th>
                      <th style={{ textAlign: 'center' }}><div className="skeleton-shimmer" style={{ height: 16, width: 40, borderRadius: 4 }} /></th>
                      <th><div className="skeleton-shimmer" style={{ height: 16, width: 100, borderRadius: 4 }} /></th>
                      <th><div className="skeleton-shimmer" style={{ height: 16, width: 80, borderRadius: 4 }} /></th>
                      <th><div className="skeleton-shimmer" style={{ height: 16, width: 100, borderRadius: 4 }} /></th>
                      <th><div className="skeleton-shimmer" style={{ height: 16, width: 80, borderRadius: 4 }} /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 2 }).map((_, rIdx) => (
                      <tr key={rIdx}>
                        <td><div className="skeleton-shimmer" style={{ height: 16, width: 16, borderRadius: 4 }} /></td>
                        <td><div className="skeleton-shimmer" style={{ height: 14, width: 150, borderRadius: 4 }} /></td>
                        <td><div className="skeleton-shimmer" style={{ height: 14, width: 100, borderRadius: 4 }} /></td>
                        <td><div className="skeleton-shimmer" style={{ height: 14, width: 30, borderRadius: 4, margin: '0 auto' }} /></td>
                        <td><div className="skeleton-shimmer" style={{ height: 20, width: 70, borderRadius: 12 }} /></td>
                        <td><div className="skeleton-shimmer" style={{ height: 14, width: 90, borderRadius: 4 }} /></td>
                        <td><div className="skeleton-shimmer" style={{ height: 20, width: 80, borderRadius: 12 }} /></td>
                        <td><div className="skeleton-shimmer" style={{ height: 14, width: 70, borderRadius: 4 }} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : grupos.length === 0 ? (
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
                        {gsChave.length} aluno(s) · {feitosChave}/{gsChave.length} feitos
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
                        <th>Aluno & Turma</th>
                        {agrupamento !== 'evento' && <th>Evento</th>}
                        <th style={{ textAlign: 'center' }}>Qtd</th>
                        <th style={{ textAlign: 'center', minWidth: 400 }}>Rastreamento do Pedido</th>
                        <th>Observações</th>
                        <th style={{ textAlign: 'center' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gsChave.map(g => {
                        const pedido  = getPedido(g.pedidoId)
                        const feito   = pedido?.feito ?? false
                        const chegou  = pedido?.chegou ?? false
                        const entregue = pedido?.entregue ?? false
                        const cor = getEventoCor(g.eventoDescricao)
                        const vencMin = g.vencimentos.sort()[0]
                        const vencMax = g.vencimentos.sort().at(-1)

                        return (
                          <motion.tr 
                            key={g.pedidoId} 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            whileHover={{ scale: 1.002, backgroundColor: 'rgba(59, 130, 246, 0.02)' }}
                            style={{
                              background: feito ? 'rgba(16,185,129,0.02)' : undefined,
                              transition: 'all 0.2s',
                              borderBottom: '1px solid hsl(var(--border-subtle))'
                            }}
                          >
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ 
                                  width: 32, height: 32, borderRadius: 8, 
                                  background: 'linear-gradient(135deg, #3b82f615, #8b5cf615)',
                                  color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: 12, fontWeight: 700, border: '1px solid #3b82f630'
                                }}>
                                  {g.alunoNome.charAt(0)}
                                </div>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 13, color: 'hsl(var(--text-foreground))' }}>{g.alunoNome}</div>
                                  <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', display: 'flex', gap: 4, alignItems: 'center' }}>
                                    <Layers size={10} /> {g.turma} • {g.segmento}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Evento */}
                            {agrupamento !== 'evento' && (
                              <td>
                                <span style={{
                                  display: 'inline-block', fontSize: 11, fontWeight: 600,
                                  background: cor.bg, color: cor.color,
                                  borderRadius: 6, padding: '2px 8px',
                                  border: `1px solid ${cor.color}30`
                                }}>
                                  {g.eventoDescricao}
                                </span>
                              </td>
                            )}

                            {/* Qtd */}
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>{g.parcelas.length}</span>
                            </td>

                            {/* Rastreamento Moderno */}
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 0, justifyContent: 'space-between', position: 'relative' }}>
                                
                                {/* Linha de fundo conectora */}
                                <div style={{ position: 'absolute', top: '15px', left: '10%', right: '10%', height: '2px', background: 'hsl(var(--border-subtle))', zIndex: 0 }} />
                                
                                {/* Step 1: Lançado */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 1, flex: 1 }}>
                                  <div style={{ 
                                    width: 30, height: 30, borderRadius: '50%', background: '#6366f1', color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, border: '4px solid #fff', boxShadow: '0 0 0 1px #6366f130'
                                  }}>
                                    <Plus size={14} />
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: '#6366f1' }}>LANÇADO</div>
                                    <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>
                                      {g.dataLancamento ? fmtDataHora(g.dataLancamento) : '—'}
                                    </div>
                                    <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>
                                      {abreviarNome(g.usuarioLancamento || 'Sistema')}
                                    </div>
                                  </div>
                                </div>

                                {/* Step 2: Pedido Feito */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 1, flex: 1, opacity: feito ? 1 : 0.4 }}>
                                  <div style={{ 
                                    width: 30, height: 30, borderRadius: '50%', background: feito ? '#f59e0b' : '#e2e8f0', color: feito ? '#fff' : '#94a3b8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, border: '4px solid #fff', boxShadow: feito ? '0 0 0 1px #f59e0b30' : 'none'
                                  }}>
                                    <Check size={14} />
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: feito ? '#f59e0b' : '#94a3b8' }}>PEDIDO</div>
                                    {feito && pedido ? (
                                      <>
                                        <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>{fmtDataHora(pedido.dataFeito)}</div>
                                        <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>{abreviarNome(pedido.usuarioFeito)}</div>
                                      </>
                                    ) : (
                                      <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>Aguardando</div>
                                    )}
                                  </div>
                                </div>

                                {/* Step 3: Chegou */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 1, flex: 1, opacity: chegou ? 1 : 0.4 }}>
                                  <div style={{ 
                                    width: 30, height: 30, borderRadius: '50%', background: chegou ? '#a78bfa' : '#e2e8f0', color: chegou ? '#fff' : '#94a3b8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, border: '4px solid #fff', boxShadow: chegou ? '0 0 0 1px #a78bfa30' : 'none'
                                  }}>
                                    <PackageCheck size={14} />
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: chegou ? '#a78bfa' : '#94a3b8' }}>CHEGOU</div>
                                    {chegou && pedido ? (
                                      <>
                                        <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>{fmtDataHora(pedido.dataChegou)}</div>
                                        <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>{abreviarNome(pedido.usuarioChegou)}</div>
                                      </>
                                    ) : (
                                      <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>Aguardando</div>
                                    )}
                                  </div>
                                </div>

                                {/* Step 4: Entregue */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, zIndex: 1, flex: 1, opacity: entregue ? 1 : 0.4 }}>
                                  <div style={{ 
                                    width: 30, height: 30, borderRadius: '50%', background: entregue ? '#10b981' : '#e2e8f0', color: entregue ? '#fff' : '#94a3b8',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, border: '4px solid #fff', boxShadow: entregue ? '0 0 0 1px #10b98130' : 'none'
                                  }}>
                                    <CheckCircle2 size={14} />
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: entregue ? '#10b981' : '#94a3b8' }}>ENTREGUE</div>
                                    {entregue && pedido ? (
                                      <>
                                        <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>{fmtDataHora(pedido.dataEntrega)}</div>
                                        <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>{abreviarNome(pedido.usuarioEntrega)}</div>
                                      </>
                                    ) : (
                                      <div style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>Pendente</div>
                                    )}
                                  </div>
                                </div>

                              </div>
                            </td>

                            {/* Observações */}
                            <td style={{ maxWidth: 150 }}>
                              {pedido?.obs ? (
                                <div 
                                  onClick={() => abrirObs(g.pedidoId)}
                                  style={{ fontSize: 11, color: 'hsl(var(--text-muted))', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', border: '1px dashed #3b82f640', padding: '4px 8px', borderRadius: 6, background: '#3b82f605' }}
                                  title={pedido.obs}
                                >
                                  {pedido.obs}
                                </div>
                              ) : (
                                <span style={{ fontSize: 11, color: 'hsl(var(--text-muted))', opacity: 0.3 }}>Sem obs.</span>
                              )}
                            </td>

                            {/* Ações */}
                            <td>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                {!feito && (
                                  <button
                                    className="btn btn-primary btn-sm"
                                    style={{ height: 30, padding: '0 10px', fontSize: 11, borderRadius: 8 }}
                                    onClick={() => marcarFeito([g.pedidoId], true)}
                                  >
                                    Marcar Pedido
                                  </button>
                                )}
                                {feito && !chegou && (
                                  <button
                                    className="btn btn-primary btn-sm"
                                    style={{ height: 30, padding: '0 10px', fontSize: 11, borderRadius: 8, background: '#8b5cf6', color: '#fff', border: 'none' }}
                                    onClick={() => marcarChegou([g.pedidoId], true)}
                                  >
                                    Marcar Chegada
                                  </button>
                                )}
                                {chegou && !entregue && (
                                  <button
                                    className="btn btn-success btn-sm"
                                    style={{ height: 30, padding: '0 10px', fontSize: 11, borderRadius: 8, background: '#10b981', color: '#fff', border: 'none' }}
                                    onClick={() => marcarEntregue([g.pedidoId], true)}
                                  >
                                    Marcar Entrega
                                  </button>
                                )}
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button
                                    className="btn btn-ghost btn-icon btn-sm"
                                    title="Editar Lançamento"
                                    onClick={() => {
                                      setModalEditar(g)
                                      setEditForm({
                                        eventoDescricao: g.eventoDescricao,
                                        valor: String(g.valorTotal),
                                        vencimento: g.vencimentos[0] || ''
                                      })
                                    }}
                                  >
                                    <Edit2 size={14} color="#3b82f6" />
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-icon btn-sm"
                                    title="Excluir Lançamento"
                                    onClick={() => handleDeleteLaunch(g)}
                                  >
                                    <Trash2 size={14} color="#ef4444" />
                                  </button>
                                  <button
                                    className="btn btn-ghost btn-icon btn-sm"
                                    title="Observações"
                                    onClick={() => abrirObs(g.pedidoId)}
                                  >
                                    <StickyNote size={14} color={pedido?.obs ? '#a78bfa' : '#94a3b8'} />
                                  </button>
                                  {(feito || chegou || entregue) && (
                                    <button
                                      className="btn btn-ghost btn-icon btn-sm"
                                      title="Desfazer Rastreamento"
                                      onClick={() => entregue ? marcarEntregue([g.pedidoId], false) : chegou ? marcarChegou([g.pedidoId], false) : marcarFeito([g.pedidoId], false)}
                                    >
                                      <RotateCcw size={14} color="#f59e0b" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                        <td colSpan={agrupamento === 'escola' ? 5 : agrupamento === 'turma' ? 4 : 4}
                          style={{ padding: '10px 16px', fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>
                          Subtotal ({gsChave.length} aluno(s))
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

      <AnimatePresence>
{/* Modal de Observação */}
      {obsModal && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)',
        }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{
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
          </motion.div>
        
</motion.div>
)}</AnimatePresence>
      <AnimatePresence>
{/* ════════════ MODAL PARCELAS ════════════ */}
      {modalParcelas && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:6000,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
          onClick={() => setModalParcelas(null)}
        >
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }}
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
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:16,padding:'12px 16px',background:'hsl(var(--bg-elevated))',borderRadius:10 }}>
                <span style={{ fontSize:13,fontWeight:600,color:'hsl(var(--text-muted))' }}>{modalParcelas.parcelas.length} parcela(s)</span>
              </div>
            </div>

            <div style={{ padding:'12px 24px',borderTop:'1px solid hsl(var(--border-subtle))',display:'flex',justifyContent:'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModalParcelas(null)}>Fechar</button>
            </div>
          </motion.div>
        
</motion.div>
)}</AnimatePresence>

      <AnimatePresence>
{/* ════════════ MODAL NOVO PEDIDO MANUAL ════════════ */}
      {modalNovoPedido && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ background: 'hsl(var(--bg-surface))', borderRadius: 18, width: '100%', maxWidth: 460, border: '1px solid hsl(var(--border-default))', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
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
                      onClick={() => { setBuscaAluno(''); setNovoPedidoForm(p => ({...p, alunoId: '', turmasDisponiveis: [], turmaId: '', turma: ''})) }}
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
                {showBuscaAluno && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border-subtle))', borderRadius: 8, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', zIndex: 10, maxHeight: 200, overflowY: 'auto' }}>
                    {alunos.filter(a => {
                      if (!buscaAluno) return true;
                      const tObj = rawTurmas.find((t: any) => String(t.id) === String(a.turma));
                      const tNome = tObj?.nome || a.turma || '';
                      return a.nome.toLowerCase().includes(buscaAluno.toLowerCase()) || 
                             tNome.toLowerCase().includes(buscaAluno.toLowerCase());
                    }).slice(0, 15).map(a => {
                      const hList = a.historicoTurmas || a.dados?.historicoTurmas || []
                      const turmas = hList.length > 0 
                        ? hList.map((h: any) => {
                            const tObj = rawTurmas.find((t: any) => String(t.id) === String(h.serieTurma))
                            const tNome = tObj?.nome || h.serieTurma
                            return { id: h.serieTurma, nome: `${tNome} - ${h.anoLetivo}` }
                          })
                        : (() => {
                            const tObj = rawTurmas.find((t: any) => String(t.id) === String(a.turma))
                            return [{ id: a.turma, nome: tObj?.nome || a.turma }]
                          })()
                      return (
                      <div
                        key={a.id}
                        onMouseDown={() => {
                          setNovoPedidoForm(p => ({
                            ...p, 
                            alunoId: a.id, 
                            turmasDisponiveis: turmas,
                            turmaId: turmas.length === 1 ? turmas[0].id : '',
                            turma: turmas.length === 1 ? turmas[0].nome : ''
                          }))
                          setBuscaAluno(`${a.nome}`)
                          setShowBuscaAluno(false)
                        }}
                        style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid hsl(var(--border-subtle))' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'hsl(var(--bg-overlay))'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ fontWeight: 600 }}>{a.nome}</div>
                        <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{turmas.map((t:any) => t.nome).join(' | ')}</div>
                      </div>
                    )})}
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
                    <option value="LIV">LIV</option>
                  </select>
                </div>
                {novoPedidoForm.alunoId && (
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>TURMA DO ALUNO *</label>
                    <select 
                      className="form-input" 
                      value={novoPedidoForm.turmaId} 
                      onChange={e => {
                        const sel = novoPedidoForm.turmasDisponiveis.find(t => t.id === e.target.value)
                        setNovoPedidoForm(p => ({...p, turmaId: e.target.value, turma: sel ? sel.nome : ''}))
                      }}
                    >
                      <option value="">Selecione a Turma...</option>
                      {novoPedidoForm.turmasDisponiveis.map(t => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>OBSERVAÇÃO</label>
                <textarea
                  className="form-input"
                  value={novoPedidoForm.obs}
                  onChange={e => setNovoPedidoForm(p => ({ ...p, obs: e.target.value }))}
                  placeholder="Observação opcional para o pedido..."
                  rows={2}
                  style={{ resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                💡 Este pedido será aglutinado junto aos eventos financeiros automáticos.
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
               <button className="btn btn-ghost" onClick={() => setModalNovoPedido(false)}>Cancelar</button>
               <button className="btn btn-primary" disabled={!novoPedidoForm.alunoId} onClick={() => {
                 const al = (alunos || []).find(a => a.id === novoPedidoForm.alunoId)
                 if (al) {
                   const pedidoId = `man-${Date.now()}`
                   const novo: ParcelaUnificada = {
                     id: pedidoId,
                     aluno: al.nome,
                     alunoId: al.id,
                     eventoDescricao: novoPedidoForm.eventoDescricao,
                     turmaId: novoPedidoForm.turmaId,
                     turma: novoPedidoForm.turma,
                     valor: 0,
                     vencimento: new Date().toISOString().slice(0,10),
                     dataLancamento: new Date().toISOString()
                   }
                   setPedidosManuais(prev => [...prev, novo])
                   if (novoPedidoForm.obs.trim()) {
                     setPedidos(prev => [
                       ...prev,
                       {
                         tituloId: pedidoId,
                         feito: false,
                         obs: novoPedidoForm.obs.trim()
                       }
                     ])
                   }
                   setModalNovoPedido(false)
                   setNovoPedidoForm({ alunoId: '', eventoDescricao: 'Livros', turmaId: '', turma: '', obs: '', turmasDisponiveis: [] })
                 }
               }}>
                 <Check size={14}/> Inserir Pedido
               </button>
            </div>
          </motion.div>
        
</motion.div>
)}</AnimatePresence>

      <AnimatePresence>
{/* ════════════ MODAL EDITAR LANÇAMENTO ════════════ */}
      {modalEditar && (
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: 20, backdropFilter: 'blur(4px)' }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ background: 'hsl(var(--bg-surface))', borderRadius: 18, width: '100%', maxWidth: 460, border: '1px solid hsl(var(--border-default))', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Editar Lançamento</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalEditar(null)}><X size={15} /></button>
            </div>
            <div style={{ padding: 24, display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>ALUNO</label>
                <input className="form-input" value={modalEditar.alunoNome} disabled style={{ opacity: 0.6 }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>TIPO DE MATERIAL</label>
                  <select className="form-input" value={editForm.eventoDescricao} onChange={e => setEditForm(p => ({...p, eventoDescricao: e.target.value}))}>
                    <option value="Livros">Livros</option>
                    <option value="Apostilas EM">Apostilas EM</option>
                    <option value="Apostilas FUND2">Apostilas FUND2</option>
                    <option value="Apostilas Ens. Médio">Apostilas Ens. Médio</option>
                    <option value="LIV">LIV</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 24px', borderTop: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
               <button className="btn btn-ghost" onClick={() => setModalEditar(null)}>Cancelar</button>
               <button className="btn btn-primary" onClick={handleSaveEdit}>
                 <Check size={14}/> Salvar Alterações
               </button>
            </div>
          </motion.div>
</motion.div>
      )}</AnimatePresence>
    </div>
  )
}
