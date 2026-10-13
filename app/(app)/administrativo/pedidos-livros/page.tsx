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
  Edit2, Trash2, Loader2
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

const EVENTOS_LIVROS = ['livros', 'apostilas em', 'apostilas fund2', 'apostila em', 'apostila fund2', 'liv', 'itinerário', 'itinerario', 'arte', 'inglês', 'ingles']

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

function extractYearFromVencimento(vencimento?: string): string | null {
  if (!vencimento) return null
  const str = vencimento.trim()
  if (str.includes('/')) {
    const parts = str.split('/')
    if (parts.length === 3 && parts[2].length === 4) return parts[2]
  }
  if (str.includes('-')) {
    const parts = str.split('-')
    if (parts[0].length === 4) return parts[0]
  }
  if (str.length === 4 && !isNaN(Number(str))) return str
  return null
}

// ─── Chip de evento colorido ───────────────────────────────────────
const EVENTO_CORES: Record<string, { bg: string; color: string }> = {
  'livros':         { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
  'apostilas em':   { bg: 'rgba(139,92,246,0.12)',  color: '#a78bfa' },
  'apostila em':    { bg: 'rgba(139,92,246,0.12)',  color: '#a78bfa' },
  'apostilas fund2':{ bg: 'rgba(236,72,153,0.12)',  color: '#f472b6' },
  'apostila fund2': { bg: 'rgba(236,72,153,0.12)',  color: '#f472b6' },
  'itinerário':     { bg: 'rgba(16,185,129,0.12)',  color: '#34d399' },
  'itinerario':     { bg: 'rgba(16,185,129,0.12)',  color: '#34d399' },
  'arte':           { bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24' },
  'inglês':         { bg: 'rgba(239,68,68,0.12)',   color: '#f87171' },
  'ingles':         { bg: 'rgba(239,68,68,0.12)',   color: '#f87171' },
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
  const { cfgEventos, turmas: rawTurmas = [], cfgCalendarioLetivo = [] } = useData();
  const { currentUser } = useApp();

  const [titulos, setTitulos, { loading: isTitulosLoading }] = useSupabaseArray<any>('titulos');
  const [alunos, setAlunos, { loading: isAlunosLoading }] = useSupabaseArray<any>('alunos/lightweight?limit=2000');
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
      for (let i = 0; i < parcs.length; i++) {
        const p = parcs[i]
        const desc = resolverDesc(p)
        if (!isEventoLivro(desc)) continue
        result.push({
          id: `alu-${alu.id}-p-${p.num ?? p.codigo ?? `idx-${i}`}`,
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
      
      let groupIdentifier = p.dataLancamento ? p.dataLancamento.substring(0, 10) : 'default'
      if (p.id.startsWith('man-')) {
        groupIdentifier = p.id
      }
      const key = `${p.aluno}__${p.eventoDescricao}__${groupIdentifier}`
      
      if (!map.has(key)) {
        const tObj = rawTurmas.find((t: any) => t.id === (p.turmaId || alu?.turma))
        const nomeTurma = p.turma || tObj?.nome || alu?.turma || '—'

        const yearFromVenc  = extractYearFromVencimento(p.vencimento)
        const yearFromTurma = tObj?.ano ? String(tObj.ano) : ((tObj as any)?.ano_letivo ? String((tObj as any).ano_letivo) : null)
        const yearFromAluno = alu?.anoLetivo ? String(alu.anoLetivo) : ((alu as any)?.ano_letivo ? String((alu as any).ano_letivo) : null)
        const yearFromParc  = (p as any).anoLetivo ? String((p as any).anoLetivo) : ((p as any).ano_letivo ? String((p as any).ano_letivo) : null)
        const anoLetivoCalculado = yearFromParc || yearFromTurma || yearFromAluno || yearFromVenc || new Date().getFullYear().toString()

        map.set(key, {
          alunoNome: p.aluno,
          turma: nomeTurma,
          segmento: inferirSegmento(alu?.serie, nomeTurma),
          anoLetivo: anoLetivoCalculado,
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
  const anosOficiais = (cfgCalendarioLetivo || []).map((c: any) => c.ano ? String(c.ano) : null).filter(Boolean)
  const anosTurmas   = rawTurmas.map((t: any) => t.ano ? String(t.ano) : t.ano_letivo ? String(t.ano_letivo) : null).filter(Boolean)
  const anosDisponiveis = [...new Set([...anosOficiais, ...grupos.map(g => g.anoLetivo), ...anosTurmas, new Date().getFullYear().toString()])].filter(Boolean).sort().reverse()
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

  // ── KPIs baseados no Ano Letivo e demais filtros ─────────────────────
  const gruposBaseKPI = React.useMemo(() => {
    return grupos.filter(g => {
      const matchBusca = !busca ||
        g.alunoNome.toLowerCase().includes(busca.toLowerCase()) ||
        g.turma.toLowerCase().includes(busca.toLowerCase()) ||
        g.segmento.toLowerCase().includes(busca.toLowerCase()) ||
        g.eventoDescricao.toLowerCase().includes(busca.toLowerCase())

      const matchTurma    = !filtroTurma    || g.turma    === filtroTurma
      const matchEvento   = !filtroEvento   || g.eventoDescricao === filtroEvento
      const matchSegmento = !filtroSegmento || g.segmento === filtroSegmento
      const matchAno      = !filtroAno      || g.anoLetivo === filtroAno

      return matchBusca && matchTurma && matchEvento && matchSegmento && matchAno
    })
  }, [grupos, busca, filtroTurma, filtroEvento, filtroSegmento, filtroAno])

  const totalGrupos    = gruposBaseKPI.length
  const feitosCount   = gruposBaseKPI.filter(g => isFeito(g.pedidoId)).length
  const chegouCount   = gruposBaseKPI.filter(g => isChegou(g.pedidoId)).length
  const entreguesCount = gruposBaseKPI.filter(g => isEntregue(g.pedidoId)).length
  const pendenteCount = totalGrupos - feitosCount
  const valorTotalGeral = gruposBaseKPI.reduce((s, g) => s + g.valorTotal, 0)

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

        /* ── Header Responsivo ── */
        .pedidos-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }
        .pedidos-header-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .pedidos-header-icon {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          box-shadow: 0 4px 14px -2px rgba(59, 130, 246, 0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          border: 1px solid rgba(255, 255, 255, 0.25);
          flex-shrink: 0;
        }
        .pedidos-header-actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        /* ── KPIs Grid ── */
        .pedidos-kpi-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 12px;
        }
        .pedidos-kpi-card {
          position: relative;
          overflow: hidden;
          cursor: pointer;
          border-radius: 14px;
          padding: 13px 16px;
          background: hsl(var(--bg-surface));
          border: 1px solid hsl(var(--border-subtle));
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 94px;
        }
        .pedidos-kpi-card:hover {
          transform: translateY(-2px);
          border-color: hsl(var(--border-default));
          box-shadow: 0 6px 16px -4px rgba(0,0,0,0.07);
        }

        /* ── Barra de Filtros Harmoniosa ── */
        .pedidos-filter-card {
          background: hsl(var(--bg-surface));
          border: 1px solid hsl(var(--border-subtle));
          border-radius: 14px;
          padding: 14px 16px;
          margin-bottom: 18px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        }
        .pedidos-filter-row-primary {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
          width: 100%;
        }
        .pedidos-search-wrap {
          position: relative;
          flex: 1.6;
          min-width: 220px;
        }
        .pedidos-search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: hsl(var(--text-muted));
          pointer-events: none;
        }
        .pedidos-search-input {
          width: 100%;
          height: 38px;
          padding: 0 34px 0 36px;
          border-radius: 10px;
          border: 1px solid hsl(var(--border-subtle));
          background: hsl(var(--bg-base));
          color: hsl(var(--text-primary));
          font-size: 13px;
          outline: none;
          transition: all 0.2s;
        }
        .pedidos-search-input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
          background: hsl(var(--bg-surface));
        }
        .pedidos-search-clear {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: hsl(var(--text-muted));
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3px;
          border-radius: 6px;
        }
        .pedidos-search-clear:hover {
          color: hsl(var(--text-primary));
          background: hsl(var(--bg-hover));
        }
        .pedidos-selects-container {
          display: flex;
          gap: 8px;
          flex: 3;
          align-items: center;
          flex-wrap: wrap;
        }
        .pedidos-select {
          width: 100%;
          height: 38px;
          padding: 0 28px 0 10px;
          border-radius: 10px;
          border: 1px solid hsl(var(--border-subtle));
          background: hsl(var(--bg-base));
          color: hsl(var(--text-primary));
          font-size: 12.5px;
          font-weight: 500;
          outline: none;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 8px center;
          background-size: 13px;
          transition: all 0.2s;
        }
        .pedidos-select:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.15);
          background-color: hsl(var(--bg-surface));
        }
        .pedidos-btn-clear {
          height: 38px;
          padding: 0 12px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 600;
          color: #ef4444;
          gap: 5px;
          white-space: nowrap;
          display: flex;
          align-items: center;
          cursor: pointer;
        }
        .pedidos-btn-clear:hover {
          background: rgba(239, 68, 68, 0.08);
          color: #dc2626;
        }

        .pedidos-filter-row-secondary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          padding-top: 10px;
          border-top: 1px solid hsl(var(--border-subtle));
        }
        .pedidos-status-scroll {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          padding: 2px 0;
        }
        .pedidos-status-scroll::-webkit-scrollbar {
          display: none;
        }
        .pedidos-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 11px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 500;
          color: hsl(var(--text-secondary));
          background: hsl(var(--bg-base));
          border: 1px solid hsl(var(--border-subtle));
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease-in-out;
        }
        .pedidos-status-pill:hover {
          background: hsl(var(--bg-elevated));
          color: hsl(var(--text-primary));
        }
        .pedidos-status-count {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 9999px;
          line-height: 1.2;
        }
        .pedidos-filter-right-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .pedidos-agrup-wrap {
          display: flex;
          gap: 3px;
          background: hsl(var(--bg-base));
          padding: 3px;
          border-radius: 9px;
          border: 1px solid hsl(var(--border-subtle));
        }
        .pedidos-results-badge {
          font-size: 11.5px;
          color: hsl(var(--text-muted));
          background: hsl(var(--bg-elevated));
          padding: 4px 10px;
          border-radius: 8px;
          border: 1px solid hsl(var(--border-subtle));
          white-space: nowrap;
        }

        /* ── Cabeçalho do Grupo ── */
        .pedidos-group-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          padding: 10px 16px;
          background: hsl(var(--bg-surface));
          border-radius: 12px;
          border: 1px solid hsl(var(--border-subtle));
          box-shadow: 0 1px 2px rgba(0,0,0,0.02);
          gap: 12px;
          flex-wrap: wrap;
        }
        .pedidos-group-header-info {
          display: flex;
          align-items: center;
          gap: 10px;
          flex: 1;
          min-width: 200px;
        }

        /* ── Observações & Ações ── */
        .pedidos-obs-pill {
          font-size: 11px;
          color: hsl(var(--text-secondary));
          cursor: pointer;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          border: 1px dashed rgba(99, 102, 241, 0.35);
          padding: 4px 8px;
          border-radius: 6px;
          background: rgba(99, 102, 241, 0.04);
          display: flex;
          align-items: center;
          gap: 5px;
          transition: all 0.15s;
        }
        .pedidos-obs-pill:hover {
          background: rgba(99, 102, 241, 0.09);
          border-color: rgba(99, 102, 241, 0.6);
          color: hsl(var(--text-primary));
        }
        .pedidos-obs-add-btn {
          font-size: 11px;
          color: hsl(var(--text-muted));
          background: none;
          border: 1px dashed hsl(var(--border-subtle));
          border-radius: 6px;
          padding: 3px 8px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s;
        }
        .pedidos-obs-add-btn:hover {
          border-color: #3b82f6;
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.05);
        }

        /* ── Visibilidade Desktop vs Mobile ── */
        .pedidos-desktop-view {
          display: block;
        }
        .pedidos-mobile-view {
          display: none;
        }

        /* ── Modais Form Grids ── */
        .pedidos-modal-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        /* ── Regras Responsivas Mobile (<= 860px) ── */
        @media (max-width: 860px) {
          .pedidos-header {
            flex-direction: column;
            align-items: stretch;
            gap: 14px;
            margin-bottom: 16px;
          }
          .pedidos-header-left {
            gap: 12px;
          }
          .pedidos-header-icon {
            width: 42px;
            height: 42px;
            border-radius: 12px;
          }
          .pedidos-header h1.page-title {
            font-size: 20px !important;
            line-height: 1.25 !important;
          }
          .pedidos-header p.page-subtitle {
            font-size: 12px !important;
            margin-top: 2px !important;
          }
          .pedidos-header-actions {
            display: flex;
            width: 100%;
            gap: 8px;
          }
          .pedidos-header-actions > * {
            flex: 1;
            justify-content: center;
            min-height: 40px;
          }
          .pedidos-header-actions .btn-primary {
            flex: 1.3;
          }

          /* KPI Grid: 2 colunas no mobile com Total em destaque */
          .pedidos-kpi-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .pedidos-kpi-total {
            grid-column: span 2 !important;
          }

          /* Filtros Mobile */
          .pedidos-search-wrap {
            width: 100%;
            min-width: 100%;
            flex: 1 1 100%;
          }
          .pedidos-selects-container {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            width: 100% !important;
          }
          .pedidos-selects-container select {
            width: 100% !important;
            font-size: 13px !important;
            min-height: 40px !important;
          }
          .pedidos-filter-row-secondary {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .pedidos-filter-right-controls {
            justify-content: space-between !important;
            width: 100% !important;
          }
          .pedidos-agrup-wrap {
            flex: 1;
          }
          .pedidos-agrup-wrap button {
            flex: 1;
            justify-content: center;
            min-height: 34px;
          }

          /* Cabeçalho de Grupo Mobile */
          .pedidos-group-header {
            flex-direction: column;
            align-items: stretch;
            padding: 12px;
            gap: 10px;
          }
          .pedidos-group-header-actions {
            width: 100%;
          }
          .pedidos-group-header-actions button {
            width: 100%;
            justify-content: center;
            min-height: 38px;
          }

          /* Alternar Desktop / Mobile */
          .pedidos-desktop-view {
            display: none !important;
          }
          .pedidos-mobile-view {
            display: flex !important;
            flex-direction: column;
            gap: 12px;
          }

          /* Formulários em modais */
          .pedidos-modal-form-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
        }
      `}} />

      {/* Cabeçalho da Página */}
      <div className="pedidos-header">
        <div className="pedidos-header-left">
          <div className="pedidos-header-icon">
            <BookMarked size={24} />
          </div>
          <div>
            <h1 className="page-title" style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>Pedidos de Materiais</h1>
            <p className="page-subtitle" style={{ fontSize: 13, opacity: 0.75, margin: '2px 0 0 0' }}>
              Rastreamento completo desde o lançamento financeiro até a entrega ao aluno.
            </p>
          </div>
        </div>
        <div className="pedidos-header-actions">
          <motion.button 
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="btn btn-primary" 
            style={{ height: 40, padding: '0 16px', borderRadius: 10, fontSize: 13, boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)', gap: 6 }}
            onClick={() => setModalNovoPedido(true)}
          >
            <Plus size={15} /> Novo Pedido Manual
          </motion.button>
          <button
            className="btn btn-secondary"
            style={{ height: 40, padding: '0 14px', borderRadius: 10, fontSize: 13, gap: 6 }}
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
            <Download size={15} /> Exportar
          </button>
        </div>
      </div>

      {/* Loading state / Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
          <Loader2 className="animate-spin" size={48} color="#3b82f6" />
          <div style={{ color: 'hsl(var(--text-secondary))', fontWeight: 600, fontSize: 14 }}>
            Carregando pedidos de materiais...
          </div>
        </div>
      ) : (
      <>
      {/* Sub-header com indicador de Ano Letivo e KPIs Interativos */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={15} color="#6366f1" />
            <span>Ano Letivo: <strong style={{ color: 'hsl(var(--text-foreground))', fontSize: 13 }}>{filtroAno || 'Todos os Anos'}</strong></span>
            <span style={{ fontSize: 11, background: 'rgba(99,102,241,0.12)', color: '#6366f1', padding: '2px 8px', borderRadius: 9999, fontWeight: 700 }}>
              {totalGrupos} pedido(s)
            </span>
          </div>
          {filtroView !== 'todos' && (
            <button
              className="btn btn-ghost btn-xs"
              style={{ fontSize: 11, color: '#6366f1', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => setFiltroView('todos')}
            >
              <RotateCcw size={11} /> Mostrar Todos os Status
            </button>
          )}
        </div>
        <div className="pedidos-kpi-grid">
          {[
            { label: 'Total de Materiais',  value: totalGrupos,    icon: Layers, color: '#3b82f6', view: 'todos' as FiltroView },
            { label: 'Pendentes',         value: pendenteCount,  icon: Clock, color: '#f59e0b', view: 'pendentes' as FiltroView },
            { label: 'Pedido Feito',      value: feitosCount,    icon: CheckCircle2, color: '#8b5cf6', view: 'feitos' as FiltroView },
            { label: 'Chegou na Escola',  value: chegouCount,    icon: Building2, color: '#06b6d4', view: 'chegou' as FiltroView },
            { label: 'Entregues',         value: entreguesCount, icon: PackageCheck, color: '#10b981', view: 'entregues' as FiltroView },
          ].map(k => {
            const isSelected = filtroView === k.view
            const isTotal = k.view === 'todos'
            const IconComp = k.icon
            return (
              <motion.div
                key={k.label}
                whileHover={{ translateY: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setFiltroView(k.view)}
                className={`pedidos-kpi-card ${isTotal ? 'pedidos-kpi-total' : ''} ${isSelected ? 'selected' : ''}`}
                style={{
                  background: isSelected ? `${k.color}0a` : 'hsl(var(--bg-surface))',
                  border: isSelected ? `1.5px solid ${k.color}` : '1px solid hsl(var(--border-subtle))',
                  ['--kpi-shadow' as any]: `${k.color}35`,
                }}
              >
                {/* Linha Superior: Ícone + Rótulo + Indicador Ativo */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: `${k.color}15`,
                      color: k.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <IconComp size={15} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: isSelected ? 700 : 500, color: isSelected ? k.color : 'hsl(var(--text-secondary))', whiteSpace: 'nowrap' }}>
                      {k.label}
                    </span>
                  </div>
                  {isSelected && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: k.color, boxShadow: `0 0 6px ${k.color}` }} />
                  )}
                </div>

                {/* Linha do Valor + Porcentagem */}
                <div style={{
                  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 'auto', marginBottom: 8
                }}>
                  <span style={{ fontSize: 24, fontWeight: 900, color: 'hsl(var(--text-primary))', fontFamily: 'Outfit,sans-serif', lineHeight: 1 }}>
                    {k.value}
                  </span>
                  {totalGrupos > 0 && k.view !== 'todos' && (
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      background: `${k.color}14`,
                      color: k.color,
                      padding: '2px 7px',
                      borderRadius: 6,
                      lineHeight: 1.2
                    }}>
                      {Math.round((k.value / totalGrupos) * 100)}%
                    </span>
                  )}
                </div>

                {/* Micro barra de progresso inferior */}
                <div style={{
                  width: '100%', height: 3, background: 'hsl(var(--bg-overlay))',
                  borderRadius: 9999, overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: totalGrupos > 0 ? `${(k.value / totalGrupos) * 100}%` : '0%',
                    background: k.color,
                    borderRadius: 9999,
                    transition: 'width 0.4s ease'
                  }} />
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Barra de Filtros Unificada e Harmoniosa */}
      <div className="card pedidos-filter-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Linha 1: Busca & Dropdowns Categóricos (Alinhados horizontalmente) */}
          <div className="pedidos-filter-row-primary">
            {/* Campo de Busca */}
            <div className="pedidos-search-wrap">
              <Search size={14} className="pedidos-search-icon" />
              <input
                className="pedidos-search-input"
                placeholder="Buscar por aluno, turma ou evento..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
              {busca && (
                <button
                  type="button"
                  onClick={() => setBusca('')}
                  className="pedidos-search-clear"
                  title="Limpar busca"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Selects em linha com larguras flexíveis proporcionais */}
            <div className="pedidos-selects-container">
              {/* Ano Letivo */}
              <div style={{ flex: '0 0 125px', minWidth: 110 }}>
                <select className="pedidos-select" value={filtroAno} onChange={e => setFiltroAno(e.target.value)}>
                  <option value="">Todos os anos</option>
                  {anosDisponiveis.map(a => <option key={String(a)} value={a || ""}>{a}</option>)}
                </select>
              </div>

              {/* Segmento */}
              <div style={{ flex: '1 1 150px', minWidth: 140 }}>
                <select className="pedidos-select" value={filtroSegmento} onChange={e => setFiltroSeg(e.target.value)}>
                  <option value="">Todos os segmentos</option>
                  {segmentos.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Turma */}
              <div style={{ flex: '1.2 1 165px', minWidth: 150 }}>
                <select className="pedidos-select" value={filtroTurma} onChange={e => setFiltroTurma(e.target.value)}>
                  <option value="">Todas as turmas</option>
                  {turmas.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Evento */}
              <div style={{ flex: '1 1 150px', minWidth: 140 }}>
                <select className="pedidos-select" value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)}>
                  <option value="">Todos os eventos</option>
                  {eventosLista.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>

              {/* Botão Limpar Filtros */}
              {(busca || (filtroAno && filtroAno !== new Date().getFullYear().toString()) || filtroTurma || filtroEvento || filtroSegmento || filtroView !== 'todos') && (
                <button
                  className="btn btn-ghost btn-sm pedidos-btn-clear"
                  onClick={() => { setBusca(''); setFiltroAno(new Date().getFullYear().toString()); setFiltroTurma(''); setFiltroEvento(''); setFiltroSeg(''); setFiltroView('todos') }}
                  title="Resetar todos os filtros"
                >
                  <RotateCcw size={12} />
                  <span>Limpar</span>
                </button>
              )}
            </div>
          </div>

          {/* Linha 2: Status Pills + Agrupamento + Contador */}
          <div className="pedidos-filter-row-secondary">
            {/* Status Pills */}
            <div className="pedidos-status-scroll">
              {([
                { v: 'todos',     label: 'Todos',          count: totalGrupos,    color: '#3b82f6' },
                { v: 'pendentes', label: 'Pendentes',      count: pendenteCount,  color: '#f59e0b', icon: Clock },
                { v: 'feitos',    label: 'Pedido Feito',   count: feitosCount,    color: '#8b5cf6', icon: CheckCircle2 },
                { v: 'chegou',    label: 'Na Escola',      count: chegouCount,    color: '#06b6d4', icon: Building2 },
                { v: 'entregues', label: 'Entregues',      count: entreguesCount, color: '#10b981', icon: PackageCheck },
              ] as const).map(opt => {
                const isActive = filtroView === opt.v;
                const IconComp = (opt as any).icon;
                return (
                  <button
                    key={opt.v}
                    onClick={() => setFiltroView(opt.v)}
                    className={`pedidos-status-pill ${isActive ? 'active' : ''}`}
                    style={isActive ? {
                      background: `${opt.color}15`,
                      color: opt.color,
                      borderColor: `${opt.color}45`,
                      fontWeight: 700
                    } : {}}
                  >
                    {IconComp && <IconComp size={12} style={{ opacity: isActive ? 1 : 0.7 }} />}
                    <span>{opt.label}</span>
                    <span
                      className="pedidos-status-count"
                      style={{
                        background: isActive ? opt.color : 'hsl(var(--bg-elevated))',
                        color: isActive ? '#fff' : 'hsl(var(--text-muted))'
                      }}
                    >
                      {opt.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Lado Direito: Agrupamento e Contador */}
            <div className="pedidos-filter-right-controls">
              {/* Agrupamento */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>Agrupar:</span>
                <div className="pedidos-agrup-wrap">
                  {([
                    { v: 'turma', icon: <Users size={12} />, label: 'Turma' },
                    { v: 'evento', icon: <BookOpen size={12} />, label: 'Evento' },
                    { v: 'escola', icon: <Building2 size={12} />, label: 'Escola' },
                  ] as { v: FiltroAgrup; icon: React.ReactNode; label: string }[]).map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => setAgrupamento(opt.v)}
                      className={`btn btn-sm ${agrupamento === opt.v ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: 11, padding: '4px 10px', height: 28, gap: 4, display: 'flex', alignItems: 'center', borderRadius: 7 }}
                    >
                      {opt.icon}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contador de Materiais */}
              <div className="pedidos-results-badge">
                <strong style={{ color: 'hsl(var(--text-primary))' }}>{gruposFiltrados.length}</strong> de {totalGrupos} materia{totalGrupos === 1 ? 'l' : 'is'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Empty / Content */}
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
            const uniqueAlunosCount = new Set(gsChave.map(g => g.alunoNome)).size

            const corEvento = agrupamento === 'evento' ? getEventoCor(chave) : undefined

            return (
              <div key={chave}>
                {/* Header do grupo */}
                <div className="pedidos-group-header" style={{
                  borderLeft: `4px solid ${agrupamento === 'evento' && corEvento ? corEvento.color : '#3b82f6'}`,
                }}>
                  <div className="pedidos-group-header-info">
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: agrupamento === 'evento' && corEvento ? `${corEvento.color}15` : 'rgba(59,130,246,0.12)',
                      color: agrupamento === 'evento' && corEvento ? corEvento.color : '#3b82f6',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {agrupamento === 'turma' ? <Users size={16} /> : agrupamento === 'evento' ? <BookOpen size={16} /> : <Building2 size={16} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13.5, color: 'hsl(var(--text-primary))' }}>{chave}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                        {uniqueAlunosCount} aluno(s) · {gsChave.length} materia{gsChave.length === 1 ? 'l' : 'is'} · <strong style={{ color: todosFeitos ? '#10b981' : 'hsl(var(--text-primary))' }}>{feitosChave}/{gsChave.length} concluídos</strong>
                      </div>
                    </div>
                  </div>

                  {/* Barra de progresso inline */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 140 }}>
                    <div style={{ flex: 1, height: 6, background: 'hsl(var(--bg-overlay))', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(feitosChave / gsChave.length) * 100}%`,
                        background: todosFeitos ? '#10b981' : algumFeito ? '#f59e0b' : '#3b82f6',
                        borderRadius: 9999, transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: todosFeitos ? '#10b981' : 'hsl(var(--text-secondary))', minWidth: 32, textAlign: 'right' }}>
                      {Math.round((feitosChave / gsChave.length) * 100)}%
                    </span>
                  </div>

                  <div className="pedidos-group-header-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ gap: 5, fontSize: 11, height: 30, borderRadius: 8 }}
                      onClick={() => marcarTodosFeito(gsChave, !todosFeitos)}
                    >
                      {todosFeitos ? <RotateCcw size={11} /> : <Check size={11} />}
                      {todosFeitos ? 'Desfazer todos' : 'Marcar todos feito'}
                    </button>
                  </div>
                </div>

                {/* VISÃO 1: Tabela do grupo (Visível no Desktop) */}
                <div className="table-container pedidos-desktop-view" style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid hsl(var(--border-subtle))' }}>
                  <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%' }}>
                    <thead>
                      <tr>
                        <th style={{ minWidth: 220, padding: '10px 14px' }}>Aluno & Turma</th>
                        {agrupamento !== 'evento' && <th style={{ width: 140, padding: '10px 14px' }}>Evento</th>}
                        <th style={{ textAlign: 'center', width: 60, padding: '10px 14px' }}>Qtd</th>
                        <th style={{ textAlign: 'center', width: 380, padding: '10px 14px' }}>Rastreamento do Pedido</th>
                        <th style={{ width: 160, padding: '10px 14px' }}>Observações</th>
                        <th style={{ textAlign: 'center', width: 175, padding: '10px 14px' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(gsChave.reduce((acc, g) => {
                        if (!acc[g.alunoNome]) acc[g.alunoNome] = { alunoNome: g.alunoNome, turma: g.turma, segmento: g.segmento, pedidos: [] };
                        acc[g.alunoNome].pedidos.push(g);
                        return acc;
                      }, {} as Record<string, { alunoNome: string, turma: string, segmento: string, pedidos: typeof gsChave }>)).map((sg, sgIndex) => (
                        <React.Fragment key={sg.alunoNome}>
                          {sgIndex > 0 && <tr style={{ height: 12 }}><td colSpan={6} style={{ border: 'none', background: 'transparent', padding: 0 }} /></tr>}
                          {sg.pedidos.map((g, rowIndex) => {
                            const isFirst = rowIndex === 0;
                            const isLast = rowIndex === sg.pedidos.length - 1;
                            const hasMultiple = sg.pedidos.length > 1;

                            const pedido  = getPedido(g.pedidoId)
                            const feito   = pedido?.feito ?? false
                            const chegou  = pedido?.chegou ?? false
                            const entregue = pedido?.entregue ?? false
                            const currentStep = entregue ? 4 : chegou ? 3 : feito ? 2 : 1;
                            const cor = getEventoCor(g.eventoDescricao)
                            
                            let bg = sgIndex % 2 === 0 ? 'hsl(var(--bg-surface))' : 'rgba(128,128,128,0.015)';
                            if (entregue) bg = 'rgba(16,185,129,0.025)';
                            else if (feito) bg = 'rgba(59,130,246,0.02)';

                            const totalCols = agrupamento !== 'evento' ? 6 : 5;
                            const mainBorder = '1px solid hsl(var(--border-default))';
                            const innerBorder = '1px solid hsl(var(--border-subtle))';

                            const getTdStyle = (colIndex: number) => ({
                              borderLeft: colIndex === 0 ? mainBorder : 'none',
                              borderRight: colIndex === totalCols - 1 ? mainBorder : 'none',
                              borderTop: isFirst ? mainBorder : 'none',
                              borderBottom: isLast ? mainBorder : innerBorder,
                              borderTopLeftRadius: isFirst && colIndex === 0 ? 12 : 0,
                              borderTopRightRadius: isFirst && colIndex === totalCols - 1 ? 12 : 0,
                              borderBottomLeftRadius: isLast && colIndex === 0 ? 12 : 0,
                              borderBottomRightRadius: isLast && colIndex === totalCols - 1 ? 12 : 0,
                            });

                            return (
                              <motion.tr 
                                key={g.pedidoId} 
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                whileHover={{ backgroundColor: 'rgba(59, 130, 246, 0.035)' }}
                                style={{
                                  background: bg,
                                  transition: 'background-color 0.15s ease',
                                }}
                              >
                                {/* Aluno */}
                                <td style={{ ...getTdStyle(0), padding: 0, verticalAlign: 'top' }}>
                                  <div style={{ padding: '10px 14px', position: 'relative', height: '100%', minHeight: 52, display: 'flex', alignItems: 'center' }}>
                                    {isFirst ? (
                                      <>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                          <div style={{ 
                                            width: 32, height: 32, borderRadius: 8, 
                                            background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(99,102,241,0.15))',
                                            color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 12, fontWeight: 700, border: '1px solid rgba(59,130,246,0.25)',
                                            position: 'relative', zIndex: 2
                                          }}>
                                            {g.alunoNome.charAt(0)}
                                          </div>
                                          <div>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: 'hsl(var(--text-primary))' }}>{g.alunoNome}</div>
                                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 500, display: 'flex', gap: 4, alignItems: 'center', marginTop: 1 }}>
                                              <Layers size={10} style={{ color: '#6366f1' }} /> {g.turma} • {g.segmento}
                                            </div>
                                          </div>
                                        </div>
                                        {hasMultiple && (
                                          <div style={{
                                            position: 'absolute',
                                            left: 30,
                                            top: 42,
                                            bottom: 0,
                                            width: 2,
                                            background: 'hsl(var(--border-subtle))',
                                            zIndex: 1
                                          }} />
                                        )}
                                      </>
                                    ) : (
                                      <>
                                        <div style={{
                                          position: 'absolute',
                                          left: 30,
                                          top: 0,
                                          bottom: isLast ? '50%' : 0,
                                          width: 2,
                                          background: 'hsl(var(--border-subtle))',
                                          zIndex: 1
                                        }} />
                                        <div style={{
                                          position: 'absolute',
                                          left: 30,
                                          top: '50%',
                                          width: 14,
                                          height: 2,
                                          background: 'hsl(var(--border-subtle))',
                                          zIndex: 1
                                        }} />
                                        <div style={{ marginLeft: 34, display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <div style={{ 
                                            width: 18, height: 18, borderRadius: 5, 
                                            background: 'rgba(128,128,128,0.1)',
                                            color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          }}>
                                            <PackageCheck size={10} />
                                          </div>
                                          <span style={{ fontSize: 11, fontWeight: 500, color: 'hsl(var(--text-muted))' }}>Material Adicional</span>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </td>

                                {/* Evento */}
                                {agrupamento !== 'evento' && (
                                  <td style={{ ...getTdStyle(1), padding: '10px 14px' }}>
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
                                <td style={{ ...getTdStyle(agrupamento !== 'evento' ? 2 : 1), textAlign: 'center', padding: '10px 14px' }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-elevated))', padding: '2px 8px', borderRadius: 6 }}>
                                    {g.parcelas.length}
                                  </span>
                                </td>

                                {/* Rastreamento Moderno com Barra Conectora de Progresso */}
                                <td style={{ ...getTdStyle(agrupamento !== 'evento' ? 3 : 2), padding: '10px 16px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, justifyContent: 'space-between', position: 'relative' }}>
                                    
                                    {/* Linha de fundo conectora cinza */}
                                    <div style={{ position: 'absolute', top: '14px', left: '12%', right: '12%', height: '2px', background: 'hsl(var(--border-subtle))', zIndex: 0 }} />
                                    
                                    {/* Linha preenchida de progresso ativo */}
                                    <div style={{
                                      position: 'absolute',
                                      top: '14px',
                                      left: '12%',
                                      width: currentStep === 4 ? '76%' : currentStep === 3 ? '51%' : currentStep === 2 ? '25%' : '0%',
                                      height: '2px',
                                      background: currentStep === 4 ? '#10b981' : currentStep === 3 ? '#06b6d4' : '#f59e0b',
                                      zIndex: 0,
                                      transition: 'width 0.4s ease'
                                    }} />

                                    {/* Step 1: Lançado */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 1, flex: 1 }}>
                                      <div style={{ 
                                        width: 26, height: 26, borderRadius: '50%', background: '#6366f1', color: '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, border: '3px solid hsl(var(--bg-surface))', boxShadow: '0 0 0 1px rgba(99,102,241,0.3)'
                                      }}>
                                        <Plus size={12} />
                                      </div>
                                      <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 9.5, fontWeight: 800, color: '#6366f1' }}>LANÇADO</div>
                                        <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>
                                          {g.dataLancamento ? fmtData(g.dataLancamento) : '—'}
                                        </div>
                                        <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>
                                          {abreviarNome(g.usuarioLancamento || 'Sistema')}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Step 2: Pedido Feito */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 1, flex: 1, opacity: feito ? 1 : 0.4 }}>
                                      <div style={{ 
                                        width: 26, height: 26, borderRadius: '50%', background: feito ? '#f59e0b' : 'hsl(var(--bg-elevated))', color: feito ? '#fff' : 'hsl(var(--text-muted))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, border: '3px solid hsl(var(--bg-surface))', boxShadow: feito ? '0 0 0 1px rgba(245,158,11,0.3)' : 'none'
                                      }}>
                                        <Check size={12} />
                                      </div>
                                      <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 9.5, fontWeight: 800, color: feito ? '#f59e0b' : 'hsl(var(--text-muted))' }}>PEDIDO</div>
                                        {feito && pedido ? (
                                          <>
                                            <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>{fmtData(pedido.dataFeito)}</div>
                                            <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{abreviarNome(pedido.usuarioFeito)}</div>
                                          </>
                                        ) : (
                                          <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))' }}>Aguardando</div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Step 3: Chegou */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 1, flex: 1, opacity: chegou ? 1 : 0.4 }}>
                                      <div style={{ 
                                        width: 26, height: 26, borderRadius: '50%', background: chegou ? '#06b6d4' : 'hsl(var(--bg-elevated))', color: chegou ? '#fff' : 'hsl(var(--text-muted))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, border: '3px solid hsl(var(--bg-surface))', boxShadow: chegou ? '0 0 0 1px rgba(6,182,212,0.3)' : 'none'
                                      }}>
                                        <Building2 size={12} />
                                      </div>
                                      <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 9.5, fontWeight: 800, color: chegou ? '#06b6d4' : 'hsl(var(--text-muted))' }}>CHEGOU</div>
                                        {chegou && pedido ? (
                                          <>
                                            <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>{fmtData(pedido.dataChegou)}</div>
                                            <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{abreviarNome(pedido.usuarioChegou)}</div>
                                          </>
                                        ) : (
                                          <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))' }}>Aguardando</div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Step 4: Entregue */}
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, zIndex: 1, flex: 1, opacity: entregue ? 1 : 0.4 }}>
                                      <div style={{ 
                                        width: 26, height: 26, borderRadius: '50%', background: entregue ? '#10b981' : 'hsl(var(--bg-elevated))', color: entregue ? '#fff' : 'hsl(var(--text-muted))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, border: '3px solid hsl(var(--bg-surface))', boxShadow: entregue ? '0 0 0 1px rgba(16,185,129,0.3)' : 'none'
                                      }}>
                                        <CheckCircle2 size={12} />
                                      </div>
                                      <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: 9.5, fontWeight: 800, color: entregue ? '#10b981' : 'hsl(var(--text-muted))' }}>ENTREGUE</div>
                                        {entregue && pedido ? (
                                          <>
                                            <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>{fmtData(pedido.dataEntrega)}</div>
                                            <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))', fontWeight: 600 }}>{abreviarNome(pedido.usuarioEntrega)}</div>
                                          </>
                                        ) : (
                                          <div style={{ fontSize: 8.5, color: 'hsl(var(--text-muted))' }}>Pendente</div>
                                        )}
                                      </div>
                                    </div>

                                  </div>
                                </td>

                                {/* Observações */}
                                <td style={{ ...getTdStyle(agrupamento !== 'evento' ? 4 : 3), maxWidth: 160, padding: '10px 14px' }}>
                                  {pedido?.obs ? (
                                    <div 
                                      onClick={() => abrirObs(g.pedidoId)}
                                      className="pedidos-obs-pill"
                                      title={pedido.obs}
                                    >
                                      <StickyNote size={12} color="#8b5cf6" style={{ flexShrink: 0 }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {pedido.obs}
                                      </span>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => abrirObs(g.pedidoId)}
                                      className="pedidos-obs-add-btn"
                                      title="Adicionar observação"
                                    >
                                      <Plus size={11} /> Obs
                                    </button>
                                  )}
                                </td>

                                {/* Ações */}
                                <td style={{ ...getTdStyle(agrupamento !== 'evento' ? 5 : 4), padding: '10px 12px' }}>
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', flexWrap: 'nowrap' }}>
                                    {!feito && (
                                      <button
                                        className="btn btn-primary btn-sm"
                                        style={{ height: 29, padding: '0 10px', fontSize: 11, borderRadius: 8, whiteSpace: 'nowrap', fontWeight: 600, gap: 4 }}
                                        onClick={() => marcarFeito([g.pedidoId], true)}
                                      >
                                        <Check size={12} /> Pedido
                                      </button>
                                    )}
                                    {feito && !chegou && (
                                      <button
                                        className="btn btn-sm"
                                        style={{ height: 29, padding: '0 10px', fontSize: 11, borderRadius: 8, background: '#06b6d4', color: '#fff', border: 'none', whiteSpace: 'nowrap', fontWeight: 600, gap: 4 }}
                                        onClick={() => marcarChegou([g.pedidoId], true)}
                                      >
                                        <Building2 size={12} /> Chegou
                                      </button>
                                    )}
                                    {chegou && !entregue && (
                                      <button
                                        className="btn btn-success btn-sm"
                                        style={{ height: 29, padding: '0 10px', fontSize: 11, borderRadius: 8, background: '#10b981', color: '#fff', border: 'none', whiteSpace: 'nowrap', fontWeight: 600, gap: 4 }}
                                        onClick={() => marcarEntregue([g.pedidoId], true)}
                                      >
                                        <PackageCheck size={12} /> Entregar
                                      </button>
                                    )}
                                    {entregue && (
                                      <span style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        fontSize: 11, fontWeight: 700, color: '#10b981',
                                        background: 'rgba(16, 185, 129, 0.1)', padding: '3px 8px',
                                        borderRadius: 6, border: '1px solid rgba(16, 185, 129, 0.2)',
                                        whiteSpace: 'nowrap'
                                      }}>
                                        <CheckCircle2 size={12} /> Entregue
                                      </span>
                                    )}
                                    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                      <button
                                        className="btn btn-ghost btn-icon btn-sm"
                                        style={{ width: 28, height: 28, padding: 0 }}
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
                                        <Edit2 size={13} color="#3b82f6" />
                                      </button>
                                      <button
                                        className="btn btn-ghost btn-icon btn-sm"
                                        style={{ width: 28, height: 28, padding: 0 }}
                                        title="Excluir Lançamento"
                                        onClick={() => handleDeleteLaunch(g)}
                                      >
                                        <Trash2 size={13} color="#ef4444" />
                                      </button>
                                      <button
                                        className="btn btn-ghost btn-icon btn-sm"
                                        style={{ width: 28, height: 28, padding: 0 }}
                                        title="Observações"
                                        onClick={() => abrirObs(g.pedidoId)}
                                      >
                                        <StickyNote size={13} color={pedido?.obs ? '#8b5cf6' : 'hsl(var(--text-muted))'} />
                                      </button>
                                      {(feito || chegou || entregue) && (
                                        <button
                                          className="btn btn-ghost btn-icon btn-sm"
                                          style={{ width: 28, height: 28, padding: 0 }}
                                          title="Desfazer etapa"
                                          onClick={() => entregue ? marcarEntregue([g.pedidoId], false) : chegou ? marcarChegou([g.pedidoId], false) : marcarFeito([g.pedidoId], false)}
                                        >
                                          <RotateCcw size={13} color="#f59e0b" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </td>
                              </motion.tr>
                            )
                          })}
                        </React.Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'hsl(var(--bg-elevated))' }}>
                        <td colSpan={agrupamento === 'escola' ? 4 : 3}
                          style={{ padding: '10px 16px', fontSize: 12, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>
                          Subtotal ({uniqueAlunosCount} aluno(s) · {gsChave.length} materia{gsChave.length === 1 ? 'l' : 'is'})
                        </td>
                        <td colSpan={agrupamento === 'escola' ? 2 : 3} />
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* VISÃO 2: Cards Mobile do grupo (Visível apenas em Telas Pequenas) */}
                <div className="pedidos-mobile-view">
                  {Object.values(gsChave.reduce((acc, g) => {
                    if (!acc[g.alunoNome]) acc[g.alunoNome] = { alunoNome: g.alunoNome, turma: g.turma, segmento: g.segmento, pedidos: [] };
                    acc[g.alunoNome].pedidos.push(g);
                    return acc;
                  }, {} as Record<string, { alunoNome: string, turma: string, segmento: string, pedidos: typeof gsChave }>)).map((sg) => (
                    <div
                      key={sg.alunoNome}
                      style={{
                        background: 'hsl(var(--bg-surface))',
                        borderRadius: 16,
                        border: '1px solid hsl(var(--border-default))',
                        padding: '14px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12
                      }}
                    >
                      {/* Cabeçalho do Aluno */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid hsl(var(--border-subtle))', paddingBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: 10,
                            background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
                            color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, fontWeight: 800, border: '1px solid rgba(59,130,246,0.3)',
                            flexShrink: 0
                          }}>
                            {sg.alunoNome.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 14, color: 'hsl(var(--text-primary))', lineHeight: 1.25 }}>
                              {sg.alunoNome}
                            </div>
                            <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 600, display: 'flex', gap: 4, alignItems: 'center', marginTop: 2 }}>
                              <Layers size={11} style={{ color: '#6366f1' }} />
                              <span>{sg.turma}</span>
                              <span>•</span>
                              <span>{sg.segmento}</span>
                            </div>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, background: 'hsl(var(--bg-elevated))', color: 'hsl(var(--text-muted))', padding: '3px 8px', borderRadius: 9999 }}>
                          {sg.pedidos.length} {sg.pedidos.length === 1 ? 'material' : 'materiais'}
                        </span>
                      </div>

                      {/* Lista de Pedidos/Materiais do Aluno */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {sg.pedidos.map((g) => {
                          const pedido = getPedido(g.pedidoId)
                          const feito = pedido?.feito ?? false
                          const chegou = pedido?.chegou ?? false
                          const entregue = pedido?.entregue ?? false
                          const cor = getEventoCor(g.eventoDescricao)
                          const currentStep = entregue ? 4 : chegou ? 3 : feito ? 2 : 1

                          return (
                            <div
                              key={g.pedidoId}
                              style={{
                                background: feito ? 'rgba(59, 130, 246, 0.02)' : 'hsl(var(--bg-elevated))',
                                borderRadius: 12,
                                border: `1px solid ${entregue ? '#10b98130' : chegou ? '#a78bfa30' : feito ? '#f59e0b30' : 'hsl(var(--border-subtle))'}`,
                                padding: '12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 10
                              }}
                            >
                              {/* Badge do Evento e Qtd */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 5,
                                  fontSize: 12, fontWeight: 700,
                                  background: cor.bg, color: cor.color,
                                  borderRadius: 8, padding: '3px 10px',
                                  border: `1px solid ${cor.color}40`
                                }}>
                                  <BookOpen size={12} />
                                  {g.eventoDescricao}
                                </span>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: 'hsl(var(--text-muted))' }}>
                                    {g.parcelas.length} {g.parcelas.length === 1 ? 'parcela' : 'parcelas'}
                                  </span>
                                  {g.valorTotal > 0 && (
                                    <span style={{ fontSize: 12, fontWeight: 800, color: 'hsl(var(--text-primary))' }}>
                                      {fmt(g.valorTotal)}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Rastreamento Mobile Stepper */}
                              <div style={{ position: 'relative', padding: '8px 2px 4px', margin: '4px 0' }}>
                                {/* Linha conectora de fundo */}
                                <div style={{
                                  position: 'absolute',
                                  top: '20px',
                                  left: '12%',
                                  right: '12%',
                                  height: '2px',
                                  background: 'hsl(var(--border-subtle))',
                                  zIndex: 0
                                }} />
                                {/* Linha preenchida */}
                                <div style={{
                                  position: 'absolute',
                                  top: '20px',
                                  left: '12%',
                                  width: currentStep === 4 ? '76%' : currentStep === 3 ? '50%' : currentStep === 2 ? '25%' : '0%',
                                  height: '2px',
                                  background: currentStep === 4 ? '#10b981' : currentStep === 3 ? '#a78bfa' : '#f59e0b',
                                  zIndex: 0,
                                  transition: 'width 0.3s ease'
                                }} />

                                <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
                                  {/* Step 1: Lançado */}
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '25%', gap: 3 }}>
                                    <div style={{
                                      width: 24, height: 24, borderRadius: '50%',
                                      background: '#6366f1', color: '#fff',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      boxShadow: '0 0 0 2px hsl(var(--bg-surface))',
                                      fontSize: 11
                                    }}>
                                      <Plus size={12} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: 9, fontWeight: 800, color: '#6366f1' }}>LANÇADO</div>
                                      <div style={{ fontSize: 8, color: 'hsl(var(--text-muted))' }}>
                                        {g.dataLancamento ? fmtData(g.dataLancamento) : '—'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Step 2: Pedido */}
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '25%', gap: 3, opacity: feito ? 1 : 0.45 }}>
                                    <div style={{
                                      width: 24, height: 24, borderRadius: '50%',
                                      background: feito ? '#f59e0b' : 'hsl(var(--bg-overlay))',
                                      color: feito ? '#fff' : 'hsl(var(--text-muted))',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      boxShadow: '0 0 0 2px hsl(var(--bg-surface))',
                                      fontSize: 11
                                    }}>
                                      <Check size={12} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: 9, fontWeight: 800, color: feito ? '#f59e0b' : 'hsl(var(--text-muted))' }}>PEDIDO</div>
                                      <div style={{ fontSize: 8, color: 'hsl(var(--text-muted))' }}>
                                        {feito && pedido?.dataFeito ? fmtData(pedido.dataFeito) : 'Aguardando'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Step 3: Chegou */}
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '25%', gap: 3, opacity: chegou ? 1 : 0.45 }}>
                                    <div style={{
                                      width: 24, height: 24, borderRadius: '50%',
                                      background: chegou ? '#a78bfa' : 'hsl(var(--bg-overlay))',
                                      color: chegou ? '#fff' : 'hsl(var(--text-muted))',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      boxShadow: '0 0 0 2px hsl(var(--bg-surface))',
                                      fontSize: 11
                                    }}>
                                      <PackageCheck size={12} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: 9, fontWeight: 800, color: chegou ? '#a78bfa' : 'hsl(var(--text-muted))' }}>CHEGOU</div>
                                      <div style={{ fontSize: 8, color: 'hsl(var(--text-muted))' }}>
                                        {chegou && pedido?.dataChegou ? fmtData(pedido.dataChegou) : 'Aguardando'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Step 4: Entregue */}
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '25%', gap: 3, opacity: entregue ? 1 : 0.45 }}>
                                    <div style={{
                                      width: 24, height: 24, borderRadius: '50%',
                                      background: entregue ? '#10b981' : 'hsl(var(--bg-overlay))',
                                      color: entregue ? '#fff' : 'hsl(var(--text-muted))',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      boxShadow: '0 0 0 2px hsl(var(--bg-surface))',
                                      fontSize: 11
                                    }}>
                                      <CheckCircle2 size={12} />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                      <div style={{ fontSize: 9, fontWeight: 800, color: entregue ? '#10b981' : 'hsl(var(--text-muted))' }}>ENTREGUE</div>
                                      <div style={{ fontSize: 8, color: 'hsl(var(--text-muted))' }}>
                                        {entregue && pedido?.dataEntrega ? fmtData(pedido.dataEntrega) : 'Pendente'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Observação (se houver) */}
                              {pedido?.obs ? (
                                <div
                                  onClick={() => abrirObs(g.pedidoId)}
                                  style={{
                                    fontSize: 11, color: 'hsl(var(--text-muted))',
                                    cursor: 'pointer', background: 'rgba(59, 130, 246, 0.06)',
                                    border: '1px dashed rgba(59, 130, 246, 0.3)',
                                    borderRadius: 8, padding: '6px 10px',
                                    display: 'flex', alignItems: 'center', gap: 6
                                  }}
                                >
                                  <StickyNote size={13} color="#a78bfa" style={{ flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {pedido.obs}
                                  </span>
                                </div>
                              ) : null}

                              {/* Botões de Ação Mobile */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                                {/* CTA Principal de Avanço */}
                                {!feito && (
                                  <button
                                    className="btn btn-primary"
                                    style={{ width: '100%', minHeight: 40, fontSize: 12, borderRadius: 10, gap: 6, justifyContent: 'center' }}
                                    onClick={() => marcarFeito([g.pedidoId], true)}
                                  >
                                    <Check size={14} /> Marcar Pedido Feito
                                  </button>
                                )}
                                {feito && !chegou && (
                                  <button
                                    className="btn"
                                    style={{ width: '100%', minHeight: 40, fontSize: 12, borderRadius: 10, background: '#8b5cf6', color: '#fff', border: 'none', gap: 6, justifyContent: 'center' }}
                                    onClick={() => marcarChegou([g.pedidoId], true)}
                                  >
                                    <PackageCheck size={14} /> Marcar Chegada na Escola
                                  </button>
                                )}
                                {chegou && !entregue && (
                                  <button
                                    className="btn btn-success"
                                    style={{ width: '100%', minHeight: 40, fontSize: 12, borderRadius: 10, background: '#10b981', color: '#fff', border: 'none', gap: 6, justifyContent: 'center' }}
                                    onClick={() => marcarEntregue([g.pedidoId], true)}
                                  >
                                    <CheckCircle2 size={14} /> Marcar Entrega ao Aluno
                                  </button>
                                )}
                                {entregue && (
                                  <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                    padding: '8px 12px', background: 'rgba(16, 185, 129, 0.1)',
                                    borderRadius: 10, color: '#10b981', fontWeight: 700, fontSize: 12
                                  }}>
                                    <CheckCircle2 size={15} /> Pedido Entregue ao Aluno
                                  </div>
                                )}

                                {/* Barra de Ações Rápidas */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid hsl(var(--border-subtle))', paddingTop: 8 }}>
                                  <div style={{ display: 'flex', gap: 6 }}>
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      style={{ height: 34, padding: '0 8px', fontSize: 11, gap: 4 }}
                                      onClick={() => {
                                        setModalEditar(g)
                                        setEditForm({
                                          eventoDescricao: g.eventoDescricao,
                                          valor: String(g.valorTotal),
                                          vencimento: g.vencimentos[0] || ''
                                        })
                                      }}
                                    >
                                      <Edit2 size={13} color="#3b82f6" /> Editar
                                    </button>
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      style={{ height: 34, padding: '0 8px', fontSize: 11, gap: 4 }}
                                      onClick={() => abrirObs(g.pedidoId)}
                                    >
                                      <StickyNote size={13} color={pedido?.obs ? '#a78bfa' : 'hsl(var(--text-muted))'} />
                                      {pedido?.obs ? 'Obs' : '+ Obs'}
                                    </button>
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      style={{ height: 34, padding: '0 8px', fontSize: 11, gap: 4, color: '#ef4444' }}
                                      onClick={() => handleDeleteLaunch(g)}
                                    >
                                      <Trash2 size={13} /> Excluir
                                    </button>
                                  </div>

                                  {(feito || chegou || entregue) && (
                                    <button
                                      className="btn btn-ghost btn-sm"
                                      style={{ height: 34, padding: '0 8px', fontSize: 11, gap: 4, color: '#f59e0b' }}
                                      title="Desfazer etapa anterior"
                                      onClick={() => entregue ? marcarEntregue([g.pedidoId], false) : chegou ? marcarChegou([g.pedidoId], false) : marcarFeito([g.pedidoId], false)}
                                    >
                                      <RotateCcw size={12} /> Desfazer
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
      </>
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
            width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
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
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)' }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ background: 'hsl(var(--bg-surface))', borderRadius: 18, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', border: '1px solid hsl(var(--border-default))', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Novo Pedido Manual</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalNovoPedido(false)}><X size={15} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'grid', gap: 16 }}>
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
              <div className="pedidos-modal-form-grid">
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>TIPO DE MATERIAL *</label>
                  <select className="form-input" value={novoPedidoForm.eventoDescricao} onChange={e => setNovoPedidoForm(p => ({...p, eventoDescricao: e.target.value}))}>
                    <option value="Livros">Livros</option>
                    <option value="Apostilas EM">Apostilas EM</option>
                    <option value="Apostilas FUND2">Apostilas FUND2</option>
                    <option value="LIV">LIV</option>
                    <option value="Itinerário">Itinerário</option>
                    <option value="Arte">Arte</option>
                    <option value="Inglês">Inglês</option>
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
<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 6000, padding: 16, backdropFilter: 'blur(4px)' }}>
          <motion.div initial={{scale:0.95, opacity:0, y:20}} animate={{scale:1, opacity:1, y:0}} exit={{scale:0.95, opacity:0, y:20}} transition={{ type: "spring", stiffness: 300, damping: 25 }} style={{ background: 'hsl(var(--bg-surface))', borderRadius: 18, width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', border: '1px solid hsl(var(--border-default))', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>Editar Lançamento</div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setModalEditar(null)}><X size={15} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>ALUNO</label>
                <input className="form-input" value={modalEditar.alunoNome} disabled style={{ opacity: 0.6 }} />
              </div>
              <div className="pedidos-modal-form-grid">
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'hsl(var(--text-muted))', marginBottom: 6 }}>TIPO DE MATERIAL</label>
                  <select className="form-input" value={editForm.eventoDescricao} onChange={e => setEditForm(p => ({...p, eventoDescricao: e.target.value}))}>
                    <option value="Livros">Livros</option>
                    <option value="Apostilas EM">Apostilas EM</option>
                    <option value="Apostilas FUND2">Apostilas FUND2</option>
                    <option value="LIV">LIV</option>
                    <option value="Itinerário">Itinerário</option>
                    <option value="Arte">Arte</option>
                    <option value="Inglês">Inglês</option>
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
