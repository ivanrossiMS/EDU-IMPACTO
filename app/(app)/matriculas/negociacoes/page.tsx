'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Handshake, Sparkles, Search, Plus, Printer, Download, RefreshCw,
  ShieldCheck, User, Users, Phone, CreditCard, Calendar, Check, Copy,
  Edit3, Trash2, Eye, CheckCircle2, Clock, LayoutGrid, Table as TableIcon,
  MessageCircle, X, Filter, Percent, ArrowUpRight, AlertCircle
} from 'lucide-react'
import { useApp } from '@/lib/context'
import { useData } from '@/lib/dataContext'
import { useConfigDb } from '@/lib/useConfigDb'
import {
  NegociacaoMatriculaRecord,
  MODALIDADE_ISAAC_CONFIG,
  STATUS_NEGOCIACAO_CONFIG,
  fmtCurrency,
  fmtDate,
  buildResumoNegociacaoTexto,
} from './types'
import { NegociacaoFormModal } from './components/NegociacaoFormModal'
import { NegociacaoFichaModal } from './components/NegociacaoFichaModal'

const LOCAL_CACHE_KEY = 'edu_matriculas_negociacoes_cache_v1'

export default function NegociacoesMatriculasPage() {
  const { currentUser } = useApp()
  const { logSystemAction } = useData()
  const currentUserName = currentUser?.nome || 'Diretor Geral'

  // Anos letivos do sistema
  const { data: dbCalendario = [] } = useConfigDb<any>('cfgCalendarioLetivo')
  const anosDisponiveis = useMemo(() => {
    const anosSet = new Set<string>(['2027', '2026'])
    for (const c of dbCalendario || []) {
      const a = String(c?.ano || '').trim()
      if (a) anosSet.add(a)
    }
    return Array.from(anosSet).sort((a, b) => Number(b) - Number(a))
  }, [dbCalendario])

  const [anoLetivo, setAnoLetivo] = useState<string>('2027')
  const [negociacoes, setNegociacoes] = useState<NegociacaoMatriculaRecord[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [turmasMap, setTurmasMap] = useState<Record<string, string>>({})

  // Filtros e Busca
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filtroIsaac, setFiltroIsaac] = useState<'todos' | 'no_isaac' | 'fora_isaac' | 'hibrido'>('todos')
  const [filtroEscopo, setFiltroEscopo] = useState<'todos' | 'matricula' | 'mensalidade' | 'parcelamento' | 'material'>('todos')
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'autorizado' | 'lancado' | 'concluido' | 'cancelado'>('todos')
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')

  // Modais e Feedback
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false)
  const [editingItem, setEditingItem] = useState<NegociacaoMatriculaRecord | null>(null)
  const [selectedFicha, setSelectedFicha] = useState<NegociacaoMatriculaRecord | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3500)
  }, [])

  // Atalho de teclado '/' ou Ctrl+K para focar busca
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      } else if (
        e.key === '/' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Carrega mapa de turmas para enriquecer busca do ERP
  useEffect(() => {
    fetch('/api/turmas?all=true')
      .then(res => (res.ok ? res.json() : null))
      .then(json => {
        if (!json) return
        const list = Array.isArray(json) ? json : json.data || []
        const map: Record<string, string> = {}
        for (const t of list) {
          if (t.id && t.nome) map[String(t.id)] = t.nome
          if (t.codigo && t.nome) map[String(t.codigo)] = t.nome
          if (t.nome) map[String(t.nome)] = t.nome
        }
        setTurmasMap(map)
      })
      .catch(() => {})
  }, [])

  // Carrega negociações do servidor (com hidratação imediata via localStorage)
  const fetchNegociacoes = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true)
    try {
      const res = await fetch('/api/matriculas/negociacoes', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        const list = Array.isArray(json.negociacoes) ? json.negociacoes : []
        setNegociacoes(list)
        try {
          window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(list))
        } catch {}
      }
    } catch (err) {
      console.error('Erro ao buscar negociações:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(LOCAL_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNegociacoes(parsed)
          setLoading(false)
        }
      }
    } catch {}
    fetchNegociacoes(true)
  }, [fetchNegociacoes])

  // Salvar (Criar ou Editar) Negociação
  const handleSaveNegociacao = async (payload: Partial<NegociacaoMatriculaRecord> & { usuarioAcao?: string }) => {
    const res = await fetch('/api/matriculas/negociacoes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) {
      throw new Error(json.error || 'Falha ao salvar negociação')
    }
    const list: NegociacaoMatriculaRecord[] = Array.isArray(json.negociacoes) ? json.negociacoes : []
    setNegociacoes(list)
    try {
      window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(list))
    } catch {}

    logSystemAction(
      'Matrículas (Negociações)',
      payload.id ? 'Edição' : 'Cadastro',
      `${payload.id ? 'Atualizou' : 'Registrou'} negociação ${json.negociacao?.protocolo || ''} para ${payload.alunoNome}`,
      { registroId: json.negociacao?.id, detalhesDepois: json.negociacao }
    )

    showToast(
      payload.id
        ? `Negociação ${json.negociacao?.protocolo} atualizada com sucesso!`
        : `Negociação ${json.negociacao?.protocolo} registrada e liberada para a equipe!`
    )
  }

  // Atualizar Status Operacional ou Nota
  const handleUpdateStatus = async (
    id: string,
    status: NegociacaoMatriculaRecord['status'],
    observacoesOperacionais?: string,
    acaoLabel?: string
  ) => {
    // Atualização otimista
    setNegociacoes(prev =>
      prev.map(it =>
        it.id === id
          ? {
              ...it,
              status,
              observacoesOperacionais:
                observacoesOperacionais !== undefined ? observacoesOperacionais : it.observacoesOperacionais,
              updatedAt: new Date().toISOString(),
            }
          : it
      )
    )
    if (selectedFicha && selectedFicha.id === id) {
      setSelectedFicha(prev =>
        prev
          ? {
              ...prev,
              status,
              observacoesOperacionais:
                observacoesOperacionais !== undefined ? observacoesOperacionais : prev.observacoesOperacionais,
            }
          : null
      )
    }

    try {
      const res = await fetch('/api/matriculas/negociacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          status,
          observacoesOperacionais,
          usuarioAcao: currentUserName,
          acaoLabel,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.negociacoes)) {
          setNegociacoes(json.negociacoes)
          try {
            window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(json.negociacoes))
          } catch {}
        }
        if (json.negociacao && selectedFicha?.id === id) {
          setSelectedFicha(json.negociacao)
        }
        showToast(`Status atualizado para "${STATUS_NEGOCIACAO_CONFIG[status].shortLabel}"!`)
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
    }
  }

  // Excluir Negociação
  const handleDelete = async (id: string) => {
    const target = negociacoes.find(n => n.id === id)
    setNegociacoes(prev => prev.filter(n => n.id !== id))
    setConfirmDeleteId(null)

    try {
      const res = await fetch(`/api/matriculas/negociacoes?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        const json = await res.json()
        if (Array.isArray(json.negociacoes)) {
          setNegociacoes(json.negociacoes)
          try {
            window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(json.negociacoes))
          } catch {}
        }
        logSystemAction(
          'Matrículas (Negociações)',
          'Exclusão',
          `Excluiu negociação ${target?.protocolo || id} (${target?.alunoNome || ''})`,
          { registroId: id }
        )
        showToast('Negociação removida com sucesso.')
      }
    } catch (err) {
      console.error('Erro ao excluir negociação:', err)
    }
  }

  // Copiar Resumo
  const handleCopyResumo = async (neg: NegociacaoMatriculaRecord) => {
    try {
      await navigator.clipboard.writeText(buildResumoNegociacaoTexto(neg))
      setCopiedId(neg.id)
      showToast(`Resumo de ${neg.alunoNome} copiado para a área de transferência!`)
      setTimeout(() => setCopiedId(null), 2500)
    } catch {}
  }

  // Base do Ano Letivo Selecionado
  const negociacoesDoAno = useMemo(
    () => negociacoes.filter(n => String(n.anoLetivo || '2027') === String(anoLetivo)),
    [negociacoes, anoLetivo]
  )

  // Métricas de KPI sobre o Ano Selecionado
  const kpis = useMemo(() => {
    const ativas = negociacoesDoAno.filter(n => n.status !== 'cancelado')
    const pendentesLancamento = negociacoesDoAno.filter(n => n.status === 'autorizado').length
    const lancadasOuConcluidas = negociacoesDoAno.filter(n => n.status === 'lancado' || n.status === 'concluido').length

    const noIsaacCount = ativas.filter(
      n =>
        n.modalidadeIsaac === 'no_isaac' ||
        n.modalidadeIsaac === 'hibrido' ||
        (n.temMensalidade && n.canalMensalidade === 'no_isaac') ||
        (n.temMatricula && n.canalMatricula === 'no_isaac')
    ).length

    const foraIsaacCount = ativas.filter(
      n =>
        n.modalidadeIsaac === 'fora_isaac' ||
        n.modalidadeIsaac === 'hibrido' ||
        (n.temMatricula && n.canalMatricula === 'fora_isaac') ||
        (n.temMensalidade && n.canalMensalidade === 'fora_isaac')
    ).length

    const comMensalidade = ativas.filter(n => n.temMensalidade && n.descontoMensalidadePct > 0)
    const descontoMedioMensalidade =
      comMensalidade.length > 0
        ? comMensalidade.reduce((acc, n) => acc + (Number(n.descontoMensalidadePct) || 0), 0) / comMensalidade.length
        : 0

    const economiaMensalTotal = ativas.reduce((acc, n) => {
      if (!n.temMensalidade) return acc
      return acc + Math.max(0, (Number(n.valorTabelaMensalidade) || 0) - (Number(n.valorAutorizadoMensalidade) || 0))
    }, 0)

    return {
      total: negociacoesDoAno.length,
      ativasCount: ativas.length,
      pendentesLancamento,
      lancadasOuConcluidas,
      noIsaacCount,
      foraIsaacCount,
      descontoMedioMensalidade,
      economiaMensalTotal,
    }
  }, [negociacoesDoAno])

  // Lista Filtrada
  const filteredList = useMemo(() => {
    const q = searchTerm
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')

    return negociacoesDoAno.filter(neg => {
      // Filtro Status
      if (filtroStatus !== 'todos' && neg.status !== filtroStatus) return false

      // Filtro Isaac
      if (filtroIsaac === 'no_isaac') {
        const hasNoIsaac =
          neg.modalidadeIsaac === 'no_isaac' ||
          (neg.temMensalidade && neg.canalMensalidade === 'no_isaac') ||
          (neg.temMatricula && neg.canalMatricula === 'no_isaac')
        if (!hasNoIsaac) return false
      } else if (filtroIsaac === 'fora_isaac') {
        const hasForaIsaac =
          neg.modalidadeIsaac === 'fora_isaac' ||
          (neg.temMatricula && neg.canalMatricula === 'fora_isaac') ||
          (neg.temMensalidade && neg.canalMensalidade === 'fora_isaac') ||
          (neg.temParcelamentoEspecial && neg.canalParcelamento === 'fora_isaac')
        if (!hasForaIsaac) return false
      } else if (filtroIsaac === 'hibrido') {
        if (neg.modalidadeIsaac !== 'hibrido') return false
      }

      // Filtro Escopo
      if (filtroEscopo === 'matricula' && !neg.temMatricula) return false
      if (filtroEscopo === 'mensalidade' && !neg.temMensalidade) return false
      if (filtroEscopo === 'parcelamento' && !neg.temParcelamentoEspecial) return false
      if (filtroEscopo === 'material' && !neg.temMaterial) return false

      // Busca Textual
      if (q.length > 0) {
        const haystack = [
          neg.protocolo,
          neg.alunoNome,
          ...(Array.isArray(neg.alunos) ? neg.alunos.map(a => `${a.nome} ${a.serieTurma}`) : []),
          neg.serieTurma,
          neg.responsavelNome,
          neg.responsavelCpf,
          neg.responsavelTelefone,
          neg.autorizadoPor,
          neg.observacoesDirecao,
          neg.observacoesOperacionais,
          neg.descricaoParcelamento,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')

        if (!haystack.includes(q)) return false
      }

      return true
    })
  }, [negociacoesDoAno, searchTerm, filtroIsaac, filtroEscopo, filtroStatus])

  // Exportar CSV
  const handleExportCsv = () => {
    if (filteredList.length === 0) return
    const headers = [
      'Protocolo',
      'Ano Letivo',
      'Data Autorizacao',
      'Status',
      'Ambiente Geral',
      'Aluno(s)',
      'Serie/Turma',
      'Responsavel',
      'Parentesco',
      'Telefone',
      'CPF',
      'Matricula Autorizada (R$)',
      'Desc. Matricula (%)',
      'Parcelas Matricula',
      'Canal Matricula',
      'Mensalidade Autorizada (R$)',
      'Desc. Mensalidade (%)',
      'Canal Mensalidade',
      'Parcelamento Especial (R$)',
      'Autorizado Por',
      'Observacoes Direcao',
      'Nota Operacional',
    ]

    const rows = filteredList.map(n => [
      n.protocolo,
      n.anoLetivo,
      fmtDate(n.dataAutorizacao),
      STATUS_NEGOCIACAO_CONFIG[n.status]?.shortLabel || n.status,
      MODALIDADE_ISAAC_CONFIG[n.modalidadeIsaac]?.shortLabel || n.modalidadeIsaac,
      n.alunoNome,
      n.serieTurma,
      n.responsavelNome,
      n.responsavelParentesco,
      n.responsavelTelefone,
      n.responsavelCpf,
      n.temMatricula ? n.valorAutorizadoMatricula.toFixed(2) : '—',
      n.temMatricula ? `${n.descontoMatriculaPct}%` : '—',
      n.temMatricula ? `${n.parcelasMatricula}x (${n.formaPagamentoMatricula})` : '—',
      n.temMatricula ? (n.canalMatricula === 'no_isaac' ? 'No isaac' : 'Fora do isaac') : '—',
      n.temMensalidade ? n.valorAutorizadoMensalidade.toFixed(2) : '—',
      n.temMensalidade ? `${n.descontoMensalidadePct}%` : '—',
      n.temMensalidade ? (n.canalMensalidade === 'no_isaac' ? 'No isaac' : 'Fora do isaac') : '—',
      n.temParcelamentoEspecial ? n.valorAutorizadoParcelamento.toFixed(2) : '—',
      n.autorizadoPor,
      (n.observacoesDirecao || '').replace(/\n/g, ' '),
      (n.observacoesOperacionais || '').replace(/\n/g, ' '),
    ])

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(';'))
        .join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `negociacoes-matriculas-${anoLetivo}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showToast('Planilha CSV exportada com sucesso!')
  }

  const activeFiltersCount = [
    filtroIsaac !== 'todos',
    filtroEscopo !== 'todos',
    filtroStatus !== 'todos',
    searchTerm.trim().length > 0,
  ].filter(Boolean).length

  const clearAllFilters = () => {
    setSearchTerm('')
    setFiltroIsaac('todos')
    setFiltroEscopo('todos')
    setFiltroStatus('todos')
  }

  return (
    <div
      className="negociacoes-matriculas-root"
      style={{
        minHeight: '100vh',
        background: '#f8fafc',
        color: '#0f172a',
        padding: '24px',
        fontFamily: 'Outfit, system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Estilos Modern Web Guidance: Responsive Table (@container + sticky headers) + Content-Visibility Containment + Print */}
      <style>{`
        /* Isolamento de layout para cartões complexos (interactions-in-complex-layouts) */
        .negociacao-card-isolated {
          content-visibility: auto;
          contain-intrinsic-size: auto 380px auto 340px;
        }
        @supports not (content-visibility: auto) {
          .negociacao-card-isolated {
            contain: layout style paint;
          }
        }

        /* Tabela Responsiva com Container Queries e Sticky Headers (responsive-table) */
        .negociacoes-table-wrapper {
          overflow: auto;
          max-inline-size: 100%;
          max-block-size: min(680px, 80vh);
          container-type: inline-size;
          background: #ffffff;
          border-radius: 18px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.04);
        }

        .negociacoes-data-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-size: 13px;
          --label-2: "Responsável";
          --label-3: "Ambiente";
          --label-4: "Matrícula";
          --label-5: "Mensalidade";
          --label-6: "Autorização";
          --label-7: "Status";
          --label-8: "Ações";
        }

        .negociacoes-data-table caption {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        .negociacoes-data-table thead {
          position: sticky;
          inset-block-start: 0;
          z-index: 2;
          background: #0f172a;
          color: #ffffff;
        }

        .negociacoes-data-table thead th {
          padding: 13px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #1e293b;
          white-space: nowrap;
        }

        .negociacoes-data-table tbody th {
          position: sticky;
          inset-inline-start: 0;
          z-index: 1;
          background: #ffffff;
          padding: 14px 16px;
          text-align: left;
          font-weight: 800;
          border-bottom: 1px solid #f1f5f9;
          border-right: 1px solid #f1f5f9;
        }

        .negociacoes-data-table tbody td {
          padding: 14px 16px;
          border-bottom: 1px solid #f1f5f9;
          vertical-align: middle;
          background: #ffffff;
        }

        .negociacoes-data-table tbody tr:hover th,
        .negociacoes-data-table tbody tr:hover td {
          background: #f8fafc;
        }

        @container (width < 680px) {
          .negociacoes-data-table,
          .negociacoes-data-table thead,
          .negociacoes-data-table tbody,
          .negociacoes-data-table tr,
          .negociacoes-data-table th,
          .negociacoes-data-table td {
            display: block;
          }

          .negociacoes-data-table thead {
            display: none;
          }

          .negociacoes-data-table tbody tr {
            margin-block-end: 1rem;
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            overflow: hidden;
          }

          .negociacoes-data-table tbody th {
            position: sticky;
            inset-block-start: 0;
            z-index: 2;
            background: #f1f5f9;
            border-bottom: 1px solid #cbd5e1;
          }

          .negociacoes-data-table tbody td:nth-child(2)::before { content: var(--label-2) ": "; font-weight: 800; color: #475569; }
          .negociacoes-data-table tbody td:nth-child(3)::before { content: var(--label-3) ": "; font-weight: 800; color: #475569; }
          .negociacoes-data-table tbody td:nth-child(4)::before { content: var(--label-4) ": "; font-weight: 800; color: #475569; }
          .negociacoes-data-table tbody td:nth-child(5)::before { content: var(--label-5) ": "; font-weight: 800; color: #475569; }
          .negociacoes-data-table tbody td:nth-child(6)::before { content: var(--label-6) ": "; font-weight: 800; color: #475569; }
          .negociacoes-data-table tbody td:nth-child(7)::before { content: var(--label-7) ": "; font-weight: 800; color: #475569; }
          .negociacoes-data-table tbody td:nth-child(8)::before { content: var(--label-8) ": "; font-weight: 800; color: #475569; }
        }

        @media print {
          aside, nav, header, .sidebar, [data-sidebar], .no-print {
            display: none !important;
          }
          body.printing-ficha-negociacao .negociacoes-main-container {
            display: none !important;
          }
          body.printing-ficha-negociacao .negociacao-ficha-backdrop {
            position: static !important;
            background: #ffffff !important;
            padding: 0 !important;
          }
          body.printing-ficha-negociacao #ficha-negociacao-printable {
            max-height: none !important;
            box-shadow: none !important;
            border: 1px solid #cbd5e1 !important;
          }
        }
      `}</style>

      {/* Toast de Feedback */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed',
              top: 24,
              right: 24,
              zIndex: 9999,
              background: '#0f172a',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: 14,
              boxShadow: '0 12px 30px rgba(15, 23, 42, 0.28)',
              fontSize: 13,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Sparkles size={16} color="#10b981" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="negociacoes-main-container"
        style={{ maxWidth: 1420, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}
      >
        {/* ─── CABEÇALHO ULTRA MODERNO ─── */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 22,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 50%, #f0fdf4 100%)',
              padding: '24px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 18,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: '#ffffff',
                    border: '1px solid #bfdbfe',
                    color: '#1d4ed8',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 8,
                    boxShadow: '0 1px 2px rgba(37,99,235,0.08)',
                  }}
                >
                  <Handshake size={13} color="#2563eb" />
                  MATRÍCULAS & COMERCIAL
                </span>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: '#10b981',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 900,
                    padding: '4px 10px',
                    borderRadius: 8,
                    boxShadow: '0 2px 6px rgba(16,185,129,0.25)',
                  }}
                >
                  <Sparkles size={12} />
                  CAMPANHA {anoLetivo}
                </span>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    background: '#f5f3ff',
                    border: '1px solid #ddd6fe',
                    color: '#6d28d9',
                    fontSize: 11,
                    fontWeight: 800,
                    padding: '4px 10px',
                    borderRadius: 8,
                  }}
                >
                  <ShieldCheck size={13} color="#7c3aed" />
                  AUTORIZAÇÕES DA DIREÇÃO
                </span>
              </div>

              <h1 style={{ fontSize: 27, fontWeight: 900, color: '#0f172a', margin: '0 0 5px', letterSpacing: '-0.02em' }}>
                Central de Negociações Autorizadas
              </h1>
              <p style={{ fontSize: 13, color: '#64748b', margin: 0, maxWidth: 780, lineHeight: 1.5 }}>
                Consulte e registre os valores autorizados pelo Diretor para <strong>Matrículas, Mensalidades, Parcelamentos e Materiais</strong> — identificando claramente o que é <strong>No isaac</strong> e <strong>Fora do isaac (Na Escola)</strong> para alinhamento imediato entre Direção, Secretaria e Financeiro.
              </p>
            </div>

            {/* Ações do Topo */}
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Seletor de Ano Letivo */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#ffffff',
                  padding: 4,
                  borderRadius: 12,
                  border: '1px solid #cbd5e1',
                  gap: 4,
                }}
              >
                {anosDisponiveis.map(ano => {
                  const active = anoLetivo === ano
                  return (
                    <button
                      key={ano}
                      onClick={() => setAnoLetivo(ano)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 800,
                        border: 'none',
                        cursor: 'pointer',
                        background: active ? '#2563eb' : 'transparent',
                        color: active ? '#ffffff' : '#64748b',
                        transition: 'all 0.15s',
                      }}
                    >
                      {ano}
                    </button>
                  )
                })}
              </div>

              <button
                onClick={() => fetchNegociacoes(false)}
                title="Atualizar lista"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  padding: '9px 14px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                <span>Atualizar</span>
              </button>

              <button
                onClick={handleExportCsv}
                disabled={filteredList.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  padding: '9px 14px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: filteredList.length === 0 ? 'not-allowed' : 'pointer',
                  opacity: filteredList.length === 0 ? 0.5 : 1,
                }}
              >
                <Download size={14} />
                <span>Exportar CSV</span>
              </button>

              <button
                onClick={() => {
                  setEditingItem(null)
                  setIsFormOpen(true)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '10px 20px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px -3px rgba(37, 99, 235, 0.4)',
                }}
              >
                <Plus size={16} />
                <span>Nova Negociação Autorizada</span>
              </button>
            </div>
          </div>

          {/* ─── 6 CARDS DE KPI INTERATIVOS ─── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              padding: '16px 28px 20px',
              background: '#ffffff',
              borderTop: '1px solid #f1f5f9',
            }}
          >
            {/* KPI 1: Total */}
            <div
              onClick={clearAllFilters}
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '12px 16px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                Negociações {anoLetivo}
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                {kpis.total}
              </div>
              <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 700 }}>
                {kpis.ativasCount} ativas autorizadas
              </div>
            </div>

            {/* KPI 2: Aguardando Lançamento */}
            <div
              onClick={() => setFiltroStatus(filtroStatus === 'autorizado' ? 'todos' : 'autorizado')}
              style={{
                background: filtroStatus === 'autorizado' ? '#fffbeb' : '#f8fafc',
                border: filtroStatus === 'autorizado' ? '2px solid #f59e0b' : '1px solid #fde68a',
                borderRadius: 14,
                padding: '12px 16px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
                ⏳ Pendente Lançamento
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#b45309', marginTop: 2 }}>
                {kpis.pendentesLancamento}
              </div>
              <div style={{ fontSize: 11, color: '#92400e', fontWeight: 700 }}>
                Clique p/ filtrar pendências
              </div>
            </div>

            {/* KPI 3: No isaac */}
            <div
              onClick={() => setFiltroIsaac(filtroIsaac === 'no_isaac' ? 'todos' : 'no_isaac')}
              style={{
                background: filtroIsaac === 'no_isaac' ? '#f5f3ff' : '#f8fafc',
                border: filtroIsaac === 'no_isaac' ? '2px solid #7c3aed' : '1px solid #ddd6fe',
                borderRadius: 14,
                padding: '12px 16px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase' }}>
                🟣 Cobrança No isaac
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#6d28d9', marginTop: 2 }}>
                {kpis.noIsaacCount}
              </div>
              <div style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>
                Faturadas via plataforma isaac
              </div>
            </div>

            {/* KPI 4: Fora do isaac */}
            <div
              onClick={() => setFiltroIsaac(filtroIsaac === 'fora_isaac' ? 'todos' : 'fora_isaac')}
              style={{
                background: filtroIsaac === 'fora_isaac' ? '#ecfdf5' : '#f8fafc',
                border: filtroIsaac === 'fora_isaac' ? '2px solid #10b981' : '1px solid #a7f3d0',
                borderRadius: 14,
                padding: '12px 16px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                🟢 Fora do isaac (Escola)
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#047857', marginTop: 2 }}>
                {kpis.foraIsaacCount}
              </div>
              <div style={{ fontSize: 11, color: '#059669', fontWeight: 700 }}>
                Direto na secretaria / maquininha
              </div>
            </div>

            {/* KPI 5: Lançadas / Concluídas */}
            <div
              onClick={() => setFiltroStatus(filtroStatus === 'concluido' ? 'todos' : 'concluido')}
              style={{
                background: filtroStatus === 'concluido' ? '#ecfdf5' : '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '12px 16px',
                cursor: 'pointer',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                ✅ Lançadas / Efetivadas
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#0f172a', marginTop: 2 }}>
                {kpis.lancadasOuConcluidas}
              </div>
              <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>
                Já processadas pela equipe
              </div>
            </div>

            {/* KPI 6: Desconto Médio */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 14,
                padding: '12px 16px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase' }}>
                Desconto Médio Mensal
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#2563eb', marginTop: 2 }}>
                {kpis.descontoMedioMensalidade.toFixed(1)}%
              </div>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
                Concessão: {fmtCurrency(kpis.economiaMensalTotal)}/mês
              </div>
            </div>
          </div>
        </div>

        {/* ─── BARRA DE BUSCA INSTANTÂNEA E FILTROS RÁPIDOS ─── */}
        <div
          className="no-print"
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid #e2e8f0',
            padding: '18px 22px',
            boxShadow: '0 4px 16px -2px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Linha 1: Busca + Alternador de Visão */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280, position: 'relative' }}>
              <Search size={18} color="#2563eb" style={{ position: 'absolute', left: 14, top: 13 }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Pesquisar por nome do aluno, responsável, CPF, telefone, série, protocolo (NEG-2027-...) ou observação... [Pressione /]"
                style={{
                  width: '100%',
                  padding: '11px 40px 11px 42px',
                  borderRadius: 14,
                  border: '2px solid #cbd5e1',
                  background: '#f8fafc',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#2563eb')}
                onBlur={e => (e.currentTarget.style.borderColor = '#cbd5e1')}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: 11,
                    background: '#e2e8f0',
                    border: 'none',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={13} color="#475569" />
                </button>
              )}
            </div>

            {activeFiltersCount > 0 && (
              <button
                onClick={clearAllFilters}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px solid #fecaca',
                  background: '#fef2f2',
                  color: '#b91c1c',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
                Limpar Filtros ({activeFiltersCount})
              </button>
            )}

            {/* Alternador Cards vs Tabela */}
            <div
              style={{
                display: 'flex',
                background: '#f1f5f9',
                padding: 4,
                borderRadius: 12,
                border: '1px solid #e2e8f0',
                gap: 4,
              }}
            >
              <button
                onClick={() => setViewMode('cards')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 13px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: viewMode === 'cards' ? '#ffffff' : 'transparent',
                  color: viewMode === 'cards' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <LayoutGrid size={14} />
                Cards
              </button>
              <button
                onClick={() => setViewMode('table')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 13px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  background: viewMode === 'table' ? '#ffffff' : 'transparent',
                  color: viewMode === 'table' ? '#0f172a' : '#64748b',
                  boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <TableIcon size={14} />
                Tabela
              </button>
            </div>
          </div>

          {/* Linha 2: Pills de Filtro Rápido */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            {/* Filtro Ambiente Isaac */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginRight: 2 }}>Canal:</span>
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'no_isaac', label: '🟣 No isaac' },
                { id: 'fora_isaac', label: '🟢 Fora do isaac (Escola)' },
                { id: 'hibrido', label: '⚡ Híbrido (Escola + isaac)' },
              ].map(item => {
                const active = filtroIsaac === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setFiltroIsaac(item.id as any)}
                    style={{
                      padding: '5px 11px',
                      borderRadius: 999,
                      fontSize: 11.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: active ? '1px solid #0f172a' : '1px solid #cbd5e1',
                      background: active ? '#0f172a' : '#ffffff',
                      color: active ? '#ffffff' : '#475569',
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            {/* Filtro Escopo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginRight: 2 }}>Tipo:</span>
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'matricula', label: '🎒 Matrícula' },
                { id: 'mensalidade', label: '📅 Mensalidades' },
                { id: 'parcelamento', label: '💳 Parcelamentos' },
                { id: 'material', label: '📚 Material' },
              ].map(item => {
                const active = filtroEscopo === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setFiltroEscopo(item.id as any)}
                    style={{
                      padding: '5px 11px',
                      borderRadius: 999,
                      fontSize: 11.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: active ? '1px solid #2563eb' : '1px solid #cbd5e1',
                      background: active ? '#2563eb' : '#ffffff',
                      color: active ? '#ffffff' : '#475569',
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>

            {/* Filtro Status Operacional */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', marginRight: 2 }}>Status:</span>
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'autorizado', label: '⏳ Pendente Lançamento' },
                { id: 'lancado', label: '🟣 Lançado no Sistema' },
                { id: 'concluido', label: '✅ Concluído' },
                { id: 'cancelado', label: '❌ Cancelado' },
              ].map(item => {
                const active = filtroStatus === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setFiltroStatus(item.id as any)}
                    style={{
                      padding: '5px 11px',
                      borderRadius: 999,
                      fontSize: 11.5,
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: active ? '1px solid #059669' : '1px solid #cbd5e1',
                      background: active ? '#059669' : '#ffffff',
                      color: active ? '#ffffff' : '#475569',
                    }}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ─── LISTAGEM DE NEGOCIAÇÕES ─── */}
        {loading ? (
          <div
            style={{
              background: '#ffffff',
              borderRadius: 20,
              border: '1px solid #e2e8f0',
              padding: 48,
              textAlign: 'center',
              color: '#64748b',
              fontWeight: 700,
            }}
          >
            Carregando negociações autorizadas...
          </div>
        ) : filteredList.length === 0 ? (
          <div
            style={{
              background: '#ffffff',
              borderRadius: 22,
              border: '1px dashed #cbd5e1',
              padding: '56px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
              }}
            >
              <Handshake size={32} />
            </div>
            <h3 style={{ fontSize: 19, fontWeight: 900, color: '#0f172a', margin: 0 }}>
              {negociacoesDoAno.length === 0
                ? `Nenhuma negociação registrada para ${anoLetivo} ainda`
                : 'Nenhuma negociação encontrada com os filtros atuais'}
            </h3>
            <p style={{ fontSize: 13, color: '#64748b', maxWidth: 520, margin: 0, lineHeight: 1.5 }}>
              {negociacoesDoAno.length === 0
                ? 'Registre aqui os descontos, parcelamentos e condições especiais (No isaac ou Fora do isaac) que o Diretor autorizar para que a Secretaria e o Financeiro localizem tudo em segundos.'
                : 'Experimente limpar os filtros ou pesquisar por outro nome de aluno ou responsável.'}
            </p>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 12,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Limpar Filtros
                </button>
              )}
              <button
                onClick={() => {
                  setEditingItem(null)
                  setIsFormOpen(true)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 22px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontSize: 13,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                <Plus size={16} />
                Registrar Primeira Negociação {anoLetivo}
              </button>
            </div>
          </div>
        ) : viewMode === 'cards' ? (
          /* ─── VISÃO EM CARDS DETALHADOS (ALTA LEGIBILIDADE) ─── */
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(430px, 1fr))', gap: 18 }}>
            {filteredList.map(neg => {
              const modCfg = MODALIDADE_ISAAC_CONFIG[neg.modalidadeIsaac] || MODALIDADE_ISAAC_CONFIG.no_isaac
              const stCfg = STATUS_NEGOCIACAO_CONFIG[neg.status] || STATUS_NEGOCIACAO_CONFIG.autorizado
              const cleanPhone = (neg.responsavelTelefone || '').replace(/\D/g, '')

              return (
                <div
                  key={neg.id}
                  className="negociacao-card-isolated"
                  style={{
                    background: '#ffffff',
                    borderRadius: 20,
                    border: neg.status === 'autorizado' ? '2px solid #93c5fd' : '1px solid #e2e8f0',
                    boxShadow: '0 6px 22px -4px rgba(15, 23, 42, 0.06)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                  }}
                >
                  <div>
                    {/* Faixa Superior: Protocolo + Ambiente Isaac + Status */}
                    <div
                      style={{
                        padding: '12px 18px',
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 8,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            fontFamily: 'monospace',
                            background: '#0f172a',
                            color: '#ffffff',
                            padding: '3px 8px',
                            borderRadius: 6,
                          }}
                        >
                          {neg.protocolo}
                        </span>

                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 900,
                            background: modCfg.bg,
                            color: modCfg.color,
                            border: `1px solid ${modCfg.border}`,
                            padding: '3px 9px',
                            borderRadius: 6,
                          }}
                        >
                          ● {modCfg.shortLabel}
                        </span>
                      </div>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          background: stCfg.bg,
                          color: stCfg.color,
                          border: `1px solid ${stCfg.border}`,
                          padding: '3px 9px',
                          borderRadius: 6,
                        }}
                      >
                        {stCfg.shortLabel}
                      </span>
                    </div>

                    {/* Bloco Família: Aluno(s) e Responsável */}
                    <div style={{ padding: '16px 18px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <h3 style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', margin: 0 }}>
                              {neg.alunoNome}
                            </h3>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                padding: '2px 7px',
                                borderRadius: 6,
                                background: neg.vinculadoErp ? '#dbeafe' : '#f1f5f9',
                                color: neg.vinculadoErp ? '#1d4ed8' : '#64748b',
                              }}
                            >
                              {neg.vinculadoErp ? 'ERP' : 'Digitado'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#2563eb', marginTop: 2 }}>
                            {neg.serieTurma || 'Série não especificada'} ·{' '}
                            <span style={{ color: '#64748b' }}>
                              {neg.tipoAluno === 'novo' ? 'Aluno Novo' : 'Veterano (Rematrícula)'}
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                            Autorizado por
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 900, color: '#0f172a' }}>{neg.autorizadoPor}</div>
                          <div style={{ fontSize: 10, color: '#64748b' }}>{fmtDate(neg.dataAutorizacao)}</div>
                        </div>
                      </div>

                      {/* Linha do Responsável */}
                      <div
                        style={{
                          marginTop: 10,
                          padding: '8px 12px',
                          borderRadius: 10,
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <div style={{ fontSize: 12, color: '#334155', fontWeight: 700 }}>
                          <span style={{ color: '#64748b', fontWeight: 600 }}>{neg.responsavelParentesco || 'Resp.'}: </span>
                          <strong>{neg.responsavelNome || 'Não informado'}</strong>
                          {neg.responsavelCpf && (
                            <span style={{ color: '#64748b', fontSize: 11, marginLeft: 6 }}>({neg.responsavelCpf})</span>
                          )}
                        </div>

                        {neg.responsavelTelefone && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#059669' }}>
                              {neg.responsavelTelefone}
                            </span>
                            {cleanPhone && (
                              <a
                                href={`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(buildResumoNegociacaoTexto(neg))}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir WhatsApp do Responsável"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: 24,
                                  height: 24,
                                  borderRadius: 6,
                                  background: '#10b981',
                                  color: '#ffffff',
                                }}
                              >
                                <MessageCircle size={13} />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Grid de Valores Autorizados */}
                    <div
                      style={{
                        padding: '0 18px 14px',
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))',
                        gap: 10,
                      }}
                    >
                      {/* Box Matrícula */}
                      {neg.temMatricula && (
                        <div
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            borderRadius: 12,
                            padding: '10px 12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 900, color: '#1e40af', textTransform: 'uppercase' }}>
                              🎒 Matrícula {neg.anoLetivo}
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 900,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: neg.canalMatricula === 'no_isaac' ? '#ede9fe' : '#d1fae5',
                                color: neg.canalMatricula === 'no_isaac' ? '#6d28d9' : '#065f46',
                              }}
                            >
                              {neg.canalMatricula === 'no_isaac' ? 'NO ISAAC' : 'FORA DO ISAAC'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                            {neg.valorTabelaMatricula > neg.valorAutorizadoMatricula && (
                              <span style={{ fontSize: 11, color: '#64748b', textDecoration: 'line-through' }}>
                                {fmtCurrency(neg.valorTabelaMatricula)}
                              </span>
                            )}
                            <span style={{ fontSize: 17, fontWeight: 900, color: '#0f172a' }}>
                              {fmtCurrency(neg.valorAutorizadoMatricula)}
                            </span>
                            {neg.descontoMatriculaPct > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '1px 5px', borderRadius: 4 }}>
                                -{neg.descontoMatriculaPct.toFixed(0)}%
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginTop: 2 }}>
                            {neg.parcelasMatricula > 1
                              ? `${neg.parcelasMatricula}x de ${fmtCurrency(neg.valorAutorizadoMatricula / neg.parcelasMatricula)}`
                              : 'À vista'}{' '}
                            · {neg.formaPagamentoMatricula}
                          </div>
                          {neg.detalheMatricula && (
                            <div style={{ fontSize: 10.5, color: '#475569', marginTop: 2 }}>
                              {neg.detalheMatricula}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Box Mensalidade */}
                      {neg.temMensalidade && (
                        <div
                          style={{
                            background: '#ecfdf5',
                            border: '1px solid #a7f3d0',
                            borderRadius: 12,
                            padding: '10px 12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 900, color: '#065f46', textTransform: 'uppercase' }}>
                              📅 Mensalidade ({neg.qtdParcelasMensalidade}x)
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 900,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: neg.canalMensalidade === 'no_isaac' ? '#ede9fe' : '#d1fae5',
                                color: neg.canalMensalidade === 'no_isaac' ? '#6d28d9' : '#065f46',
                              }}
                            >
                              {neg.canalMensalidade === 'no_isaac' ? 'NO ISAAC' : 'FORA DO ISAAC'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                            {neg.valorTabelaMensalidade > neg.valorAutorizadoMensalidade && (
                              <span style={{ fontSize: 11, color: '#64748b', textDecoration: 'line-through' }}>
                                {fmtCurrency(neg.valorTabelaMensalidade)}
                              </span>
                            )}
                            <span style={{ fontSize: 17, fontWeight: 900, color: '#0f172a' }}>
                              {fmtCurrency(neg.valorAutorizadoMensalidade)}/mês
                            </span>
                            {neg.descontoMensalidadePct > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 800, color: '#15803d', background: '#dcfce7', padding: '1px 5px', borderRadius: 4 }}>
                                -{neg.descontoMensalidadePct.toFixed(0)}%
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', marginTop: 2 }}>
                            Venc. dia {neg.diaVencimentoMensalidade} · {neg.condicaoMensalidade.slice(0, 38)}
                          </div>
                        </div>
                      )}

                      {/* Box Parcelamento Especial */}
                      {neg.temParcelamentoEspecial && (
                        <div
                          style={{
                            background: '#f5f3ff',
                            border: '1px solid #ddd6fe',
                            borderRadius: 12,
                            padding: '10px 12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 900, color: '#5b21b6', textTransform: 'uppercase' }}>
                              💳 Parcelamento Especial
                            </span>
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 900,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: neg.canalParcelamento === 'no_isaac' ? '#ede9fe' : '#d1fae5',
                                color: neg.canalParcelamento === 'no_isaac' ? '#6d28d9' : '#065f46',
                              }}
                            >
                              {neg.canalParcelamento === 'no_isaac' ? 'NO ISAAC' : 'FORA DO ISAAC'}
                            </span>
                          </div>

                          <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                            {fmtCurrency(neg.valorAutorizadoParcelamento)}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#334155' }}>
                            {neg.entradaParcelamento > 0 ? `Entr. ${fmtCurrency(neg.entradaParcelamento)} + ` : ''}
                            {neg.qtdParcelasEspecial}x ({neg.formaPagamentoParcelamento})
                          </div>
                        </div>
                      )}

                      {/* Box Material */}
                      {neg.temMaterial && (
                        <div
                          style={{
                            background: '#fffbeb',
                            border: '1px solid #fde68a',
                            borderRadius: 12,
                            padding: '10px 12px',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 10, fontWeight: 900, color: '#92400e', textTransform: 'uppercase' }}>
                              📚 Material Didático
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 900, color: '#92400e' }}>
                              {neg.parcelasMaterial}x
                            </span>
                          </div>
                          <div style={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }}>
                            {fmtCurrency(neg.valorAutorizadoMaterial)}
                          </div>
                          <div style={{ fontSize: 10.5, color: '#78350f', fontWeight: 600 }}>
                            {neg.descricaoMaterial}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Observações da Direção */}
                    {neg.observacoesDirecao && (
                      <div
                        style={{
                          margin: '0 18px 14px',
                          padding: '9px 12px',
                          borderRadius: 10,
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          fontSize: 12,
                          color: '#78350f',
                          fontWeight: 600,
                          lineHeight: 1.4,
                        }}
                      >
                        <strong style={{ color: '#b45309' }}>📌 Direção:</strong> {neg.observacoesDirecao}
                      </div>
                    )}

                    {/* Nota Operacional se houver */}
                    {neg.observacoesOperacionais && (
                      <div
                        style={{
                          margin: '0 18px 14px',
                          padding: '7px 12px',
                          borderRadius: 8,
                          background: '#f1f5f9',
                          fontSize: 11.5,
                          color: '#334155',
                          fontWeight: 600,
                        }}
                      >
                        <strong>⚙️ Equipe:</strong> {neg.observacoesOperacionais}
                      </div>
                    )}
                  </div>

                  {/* Rodapé de Ações Rápidas para os Colaboradores */}
                  <div
                    className="no-print"
                    style={{
                      padding: '10px 18px',
                      background: '#f8fafc',
                      borderTop: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {neg.status === 'autorizado' && (
                        <button
                          onClick={() =>
                            handleUpdateStatus(
                              neg.id,
                              'lancado',
                              neg.observacoesOperacionais,
                              `Marcado como Lançado no Sistema por ${currentUserName}`
                            )
                          }
                          style={{
                            padding: '6px 11px',
                            borderRadius: 8,
                            border: '1px solid #c4b5fd',
                            background: '#f5f3ff',
                            color: '#6d28d9',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          ✓ Marcar Lançado no isaac/ERP
                        </button>
                      )}
                      {neg.status === 'lancado' && (
                        <button
                          onClick={() =>
                            handleUpdateStatus(
                              neg.id,
                              'concluido',
                              neg.observacoesOperacionais,
                              `Matrícula marcada como Concluída por ${currentUserName}`
                            )
                          }
                          style={{
                            padding: '6px 11px',
                            borderRadius: 8,
                            border: '1px solid #6ee7b7',
                            background: '#ecfdf5',
                            color: '#047857',
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: 'pointer',
                          }}
                        >
                          ✓ Concluir Matrícula
                        </button>
                      )}

                      <button
                        onClick={() => handleCopyResumo(neg)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 10px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: copiedId === neg.id ? '#10b981' : '#ffffff',
                          color: copiedId === neg.id ? '#ffffff' : '#334155',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        {copiedId === neg.id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedId === neg.id ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <button
                        onClick={() => setSelectedFicha(neg)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '6px 11px',
                          borderRadius: 8,
                          border: '1px solid #bfdbfe',
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                        }}
                      >
                        <Eye size={13} />
                        Ficha / Imprimir
                      </button>

                      <button
                        onClick={() => {
                          setEditingItem(neg)
                          setIsFormOpen(true)
                        }}
                        title="Editar negociação"
                        style={{
                          padding: 6,
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#475569',
                          cursor: 'pointer',
                        }}
                      >
                        <Edit3 size={13} />
                      </button>

                      {confirmDeleteId === neg.id ? (
                        <button
                          onClick={() => handleDelete(neg.id)}
                          style={{
                            padding: '5px 8px',
                            borderRadius: 8,
                            border: 'none',
                            background: '#ef4444',
                            color: '#ffffff',
                            fontSize: 10,
                            fontWeight: 900,
                            cursor: 'pointer',
                          }}
                        >
                          Confirmar?
                        </button>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(neg.id)}
                          title="Excluir negociação"
                          style={{
                            padding: 6,
                            borderRadius: 8,
                            border: '1px solid #fecaca',
                            background: '#fef2f2',
                            color: '#ef4444',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* ─── VISÃO EM TABELA RESPONSIVA (COM STICKY HEADERS & CONTAINER QUERIES) ─── */
          <div
            tabIndex={0}
            role="region"
            aria-labelledby="negociacoes-table-caption"
            className="negociacoes-table-wrapper"
          >
            <table className="negociacoes-data-table">
              <caption id="negociacoes-table-caption">
                Negociações de matrículas e mensalidades autorizadas pela Direção ({anoLetivo})
              </caption>
              <thead>
                <tr>
                  <th scope="col">Aluno(s) / Série</th>
                  <th scope="col">Responsável / Contato</th>
                  <th scope="col">Ambiente</th>
                  <th scope="col">Matrícula {anoLetivo}</th>
                  <th scope="col">Mensalidade {anoLetivo}</th>
                  <th scope="col">Autorizado Por</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredList.map(neg => {
                  const modCfg = MODALIDADE_ISAAC_CONFIG[neg.modalidadeIsaac] || MODALIDADE_ISAAC_CONFIG.no_isaac
                  const stCfg = STATUS_NEGOCIACAO_CONFIG[neg.status] || STATUS_NEGOCIACAO_CONFIG.autorizado
                  return (
                    <tr key={neg.id}>
                      <th scope="row">
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#64748b' }}>{neg.protocolo}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 900, color: '#0f172a' }}>{neg.alunoNome}</div>
                        <div style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 700 }}>{neg.serieTurma}</div>
                      </th>
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{neg.responsavelNome}</div>
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>
                          {neg.responsavelParentesco} {neg.responsavelTelefone ? `· ${neg.responsavelTelefone}` : ''}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: 10.5,
                            fontWeight: 900,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: modCfg.bg,
                            color: modCfg.color,
                            border: `1px solid ${modCfg.border}`,
                          }}
                        >
                          {modCfg.shortLabel}
                        </span>
                      </td>
                      <td>
                        {neg.temMatricula ? (
                          <div>
                            <div style={{ fontWeight: 900, color: '#0f172a' }}>
                              {fmtCurrency(neg.valorAutorizadoMatricula)}{' '}
                              <span style={{ fontSize: 10, color: '#15803d' }}>(-{neg.descontoMatriculaPct.toFixed(0)}%)</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              {neg.parcelasMatricula}x · {neg.canalMatricula === 'no_isaac' ? 'No isaac' : 'Fora do isaac'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        {neg.temMensalidade ? (
                          <div>
                            <div style={{ fontWeight: 900, color: '#0f172a' }}>
                              {fmtCurrency(neg.valorAutorizadoMensalidade)}/mês{' '}
                              <span style={{ fontSize: 10, color: '#15803d' }}>(-{neg.descontoMensalidadePct.toFixed(0)}%)</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              {neg.qtdParcelasMensalidade}x · {neg.canalMensalidade === 'no_isaac' ? 'No isaac' : 'Fora do isaac'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{neg.autorizadoPor}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{fmtDate(neg.dataAutorizacao)}</div>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '3px 9px',
                            borderRadius: 6,
                            background: stCfg.bg,
                            color: stCfg.color,
                            border: `1px solid ${stCfg.border}`,
                          }}
                        >
                          {stCfg.shortLabel}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => setSelectedFicha(neg)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              border: '1px solid #bfdbfe',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            Ficha
                          </button>
                          <button
                            onClick={() => {
                              setEditingItem(neg)
                              setIsFormOpen(true)
                            }}
                            style={{
                              padding: '5px 10px',
                              borderRadius: 6,
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#334155',
                              fontSize: 11,
                              fontWeight: 800,
                              cursor: 'pointer',
                            }}
                          >
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Cadastro / Edição */}
      <NegociacaoFormModal
        isOpen={isFormOpen}
        editingItem={editingItem}
        anoLetivoDefault={anoLetivo}
        turmasMap={turmasMap}
        currentUserName={currentUserName}
        onClose={() => {
          setIsFormOpen(false)
          setEditingItem(null)
        }}
        onSave={handleSaveNegociacao}
      />

      {/* Modal da Ficha Oficial / Impressão */}
      <NegociacaoFichaModal
        negociacao={selectedFicha}
        onClose={() => setSelectedFicha(null)}
        onEdit={neg => {
          setEditingItem(neg)
          setIsFormOpen(true)
        }}
        onUpdateStatus={handleUpdateStatus}
        currentUserName={currentUserName}
      />
    </div>
  )
}
