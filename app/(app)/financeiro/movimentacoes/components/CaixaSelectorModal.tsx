'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Wallet,
  Lock,
  CheckCircle2,
  Search,
  UserCheck,
  Plus,
  Building2,
  Calendar,
  ArrowRight,
  ShieldCheck,
  X,
  AlertCircle,
  Eye,
  Landmark,
  ExternalLink,
} from 'lucide-react'
import {
  TIPOS_CAIXA_PADRAO,
  type ConfigCaixa,
  type ConfigPlanoContas,
  type TipoCaixaConfig,
} from '@/lib/dataContext'
import { formatCurrencyInput, handleCurrencyInputChange } from '@/lib/utils'
import {
  isCaixaDoUsuario,
  isUsuarioAdministrador,
  formatCurrencyBRL,
  formatDateBR,
  getLocalISODate,
  normalizeText,
  type ResumoSaldoCaixa,
} from '../types'

export interface UnidadeOptionDetalhada {
  codigo: string
  label: string
  cnpj?: string
  tipo: 'Matriz' | 'Unidade'
  nomeExibicao: string
  subtitulo?: string
}

export interface OperadorOptionItem {
  id: string
  codigo: string
  nome: string
  label: string
}

interface CaixaSelectorModalProps {
  open: boolean
  caixas: ConfigCaixa[]
  selectedCaixa: ConfigCaixa | null
  currentUser: {
    id?: string
    nome?: string
    email?: string
    cargo?: string
    perfil?: string
    colaborador_id?: string
    system_user_id?: string
    user_metadata?: Record<string, any>
  } | null
  currentUserPerfil?: string
  unidadesDisponiveis: string[]
  unidadesDetalhadas?: UnidadeOptionDetalhada[]
  tiposCaixaDisponiveis?: string[]
  operadoresDisponiveis?: OperadorOptionItem[]
  planoContas?: ConfigPlanoContas[]
  saldosPorCaixaMap?: Record<string, ResumoSaldoCaixa>
  onSelectCaixa: (caixa: ConfigCaixa) => void
  onQuickCreateCaixa: (novoCaixa: Partial<ConfigCaixa>) => Promise<ConfigCaixa | null>
  onCreateTipoCaixa?: (novoTipo: string) => Promise<void>
  onClose?: () => void
}

export function CaixaSelectorModal({
  open,
  caixas,
  selectedCaixa,
  currentUser,
  currentUserPerfil,
  unidadesDisponiveis,
  unidadesDetalhadas = [],
  tiposCaixaDisponiveis = [],
  operadoresDisponiveis = [],
  planoContas = [],
  saldosPorCaixaMap = {},
  onSelectCaixa,
  onQuickCreateCaixa,
  onCreateTipoCaixa,
  onClose,
}: CaixaSelectorModalProps) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'meus' | 'todos'>('meus')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)

  const isAdmin = useMemo(
    () => isUsuarioAdministrador(currentUser, currentUserPerfil),
    [currentUser, currentUserPerfil]
  )
  const effectiveTab: 'meus' | 'todos' = tab

  const nomeOperador = currentUser?.nome || 'Operador'
  const anoAtual = new Date().getFullYear()
  const primeiroNomeUpper = (nomeOperador.split(' ')[0] || 'CAIXA').toUpperCase()

  const defaultOperadorLabel = useMemo(() => {
    const raw = nomeOperador.trim()
    if (/^\d+\s*-/.test(raw)) return raw
    if (raw.toLowerCase().includes('ivan')) return `11 - ${raw}`
    const matchOp = operadoresDisponiveis.find(
      (op) => normalizeText(op.nome) === normalizeText(raw)
    )
    if (matchOp) return matchOp.label
    return `11 - ${raw}`
  }, [nomeOperador, operadoresDisponiveis])

  // Próximo código sequencial idêntico a /configuracoes/financeiro/caixas (maior numérico + 1)
  const nextSuggestedCode = useMemo(() => {
    const maxNum = caixas.reduce((max, c) => {
      const n = parseInt(String(c.codigo || ''), 10)
      return !isNaN(n) && n > max ? n : max
    }, 0)
    return String(maxNum + 1)
  }, [caixas])

  // Lista consolidada de Tipos de Caixa de /configuracoes/financeiro/caixas
  const todosTiposCaixa = useMemo<string[]>(() => {
    const set = new Set<string>(TIPOS_CAIXA_PADRAO)
    for (const t of tiposCaixaDisponiveis) {
      const clean = String(t || '').trim()
      if (clean) set.add(clean)
    }
    for (const c of caixas) {
      const clean = String(c.tipoCaixa || '').trim()
      if (clean) set.add(clean)
    }
    return Array.from(set)
  }, [tiposCaixaDisponiveis, caixas])

  // Lista consolidada de Operadores de /configuracoes/financeiro/caixas
  const todosOperadores = useMemo<OperadorOptionItem[]>(() => {
    const map = new Map<string, OperadorOptionItem>()
    if (defaultOperadorLabel) {
      const parts = defaultOperadorLabel.split('-').map((s) => s.trim())
      map.set(defaultOperadorLabel, {
        id: String(currentUser?.id || parts[0] || '11'),
        codigo: parts.length > 1 ? parts[0] : '11',
        nome: parts.length > 1 ? parts.slice(1).join(' - ') : defaultOperadorLabel,
        label: defaultOperadorLabel,
      })
    }
    for (const op of operadoresDisponiveis) {
      if (op?.label && !map.has(op.label)) map.set(op.label, op)
    }
    for (const c of caixas) {
      if (c.operador && !map.has(c.operador)) {
        const parts = c.operador.split('-').map((s) => s.trim())
        map.set(c.operador, {
          id: c.operadorCodigo || c.operador,
          codigo: parts.length > 1 ? parts[0] : '',
          nome: parts.length > 1 ? parts.slice(1).join(' - ') : c.operador,
          label: c.operador,
        })
      }
    }
    return Array.from(map.values())
  }, [defaultOperadorLabel, currentUser, operadoresDisponiveis, caixas])

  // Lista consolidada de Unidades/Empresas de /configuracoes/financeiro/caixas
  const todasUnidadesLabels = useMemo<string[]>(() => {
    const set = new Set<string>()
    for (const u of unidadesDetalhadas) {
      if (u.label) set.add(u.label)
    }
    for (const u of unidadesDisponiveis) {
      if (u) set.add(u)
    }
    for (const c of caixas) {
      if (c.unidadeEmpresa) set.add(c.unidadeEmpresa)
    }
    return Array.from(set)
  }, [unidadesDetalhadas, unidadesDisponiveis, caixas])

  // Estados do formulário "+ Abrir Novo Caixa" sincronizado com /configuracoes/financeiro/caixas
  const [novoCodigo, setNovoCodigo] = useState<string>(nextSuggestedCode)
  const [novaDataAbertura, setNovaDataAbertura] = useState<string>(() => getLocalISODate())
  const [novaDescricao, setNovaDescricao] = useState<string>(`${primeiroNomeUpper}-${anoAtual}`)
  const [novoTipoCaixa, setNovoTipoCaixa] = useState<TipoCaixaConfig>('Caixa – Movimento Diário')
  const [novoOperador, setNovoOperador] = useState<string>(defaultOperadorLabel)
  const [novaUnidade, setNovaUnidade] = useState<string>(todasUnidadesLabels[0] || '')
  const [novaContaPlanoId, setNovaContaPlanoId] = useState<string>('')
  const [novaContaPlanoLabel, setNovaContaPlanoLabel] = useState<string>('')
  const [novoSaldoInicial, setNovoSaldoInicial] = useState<string>('0')
  const [novaAgencia, setNovaAgencia] = useState<string>('')
  const [novaConta, setNovaConta] = useState<string>('')
  const [novoAceitaTransferencia, setNovoAceitaTransferencia] = useState<'Sim' | 'Não'>('Sim')
  const [novoAceitaBaixaOutro, setNovoAceitaBaixaOutro] = useState<'Sim' | 'Não'>('Sim')
  const [showNovoTipoInput, setShowNovoTipoInput] = useState<boolean>(false)
  const [novoTipoNome, setNovoTipoNome] = useState<string>('')
  const [savingNovoTipo, setSavingNovoTipo] = useState<boolean>(false)

  // Mantém o código sequencial e unidade padrão sincronizados quando os caixas/unidades carregam
  useEffect(() => {
    setNovoCodigo(nextSuggestedCode)
  }, [nextSuggestedCode, showCreateForm])

  useEffect(() => {
    if (!novaUnidade && todasUnidadesLabels.length > 0) {
      setNovaUnidade(todasUnidadesLabels[0])
    }
  }, [todasUnidadesLabels, novaUnidade])

  useEffect(() => {
    if (defaultOperadorLabel) {
      setNovoOperador(defaultOperadorLabel)
    }
  }, [defaultOperadorLabel])

  // Fechar modal com tecla Escape
  useEffect(() => {
    if (!open || !onClose) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  const { meusCaixas, todosCaixasFiltrados } = useMemo(() => {
    const q = normalizeText(search)
    const filtered = caixas.filter((c) => {
      if (!q) return true
      return (
        normalizeText(c.codigo).includes(q) ||
        normalizeText(c.descricao).includes(q) ||
        normalizeText(c.operador).includes(q) ||
        normalizeText(c.unidadeEmpresa).includes(q) ||
        normalizeText(c.tipoCaixa).includes(q)
      )
    })

    const meus: ConfigCaixa[] = []

    for (const c of filtered) {
      if (isCaixaDoUsuario(c, currentUser)) {
        meus.push(c)
      }
    }

    return { meusCaixas: meus, todosCaixasFiltrados: filtered }
  }, [caixas, search, currentUser])

  if (!open) return null

  const handleAddNovoTipo = async () => {
    const clean = novoTipoNome.trim()
    if (!clean) return
    setSavingNovoTipo(true)
    try {
      if (onCreateTipoCaixa) {
        await onCreateTipoCaixa(clean)
      }
      setNovoTipoCaixa(clean)
      setNovoTipoNome('')
      setShowNovoTipoInput(false)
    } finally {
      setSavingNovoTipo(false)
    }
  }

  const handleCreateAndSelect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novaDescricao.trim()) return
    setCreating(true)
    try {
      const opVal = novoOperador.trim() || defaultOperadorLabel
      const opParts = opVal.split('-').map((s) => s.trim())
      const opCodigo = opParts.length > 1 ? opParts[0] : '11'
      const unVal = novaUnidade || todasUnidadesLabels[0] || 'MATRIZ - COLÉGIO IMPACTO'
      const unParts = unVal.split('-').map((s) => s.trim())
      const unCodigo = unParts.length > 1 ? unParts[0] : '1'

      const created = await onQuickCreateCaixa({
        codigo: novoCodigo.trim() || nextSuggestedCode,
        descricao: novaDescricao.trim(),
        tipoCaixa: novoTipoCaixa || 'Caixa – Movimento Diário',
        operador: opVal,
        operadorCodigo: opCodigo,
        abertoPor: defaultOperadorLabel,
        unidadeEmpresa: unVal,
        unidadeId: unCodigo,
        contaPlanoId: novaContaPlanoId || undefined,
        contaPlanoLabel: novaContaPlanoLabel || undefined,
        agencia: novaAgencia.trim(),
        conta: novaConta.trim(),
        dataAbertura: novaDataAbertura || getLocalISODate(),
        situacao: 'Aberto',
        saldoInicial: Number(String(novoSaldoInicial).replace(',', '.')) || 0,
        aceitaTransferenciaOutrosCaixas: novoAceitaTransferencia === 'Sim',
        aceitaBaixaContasPagarOutroUsuario: novoAceitaBaixaOutro === 'Sim',
        aceitaTransferencias: novoAceitaTransferencia,
      })
      if (created) {
        setShowCreateForm(false)
        onSelectCaixa(created)
      }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-selecao-caixa-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose()
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.68)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 920,
          maxHeight: '92vh',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.4)',
          border: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top Header — Com Botão de Fechar Sempre Visível */}
        <div
          style={{
            padding: '18px 24px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(56, 189, 248, 0.18)',
                border: '1px solid rgba(56, 189, 248, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
                flexShrink: 0,
              }}
            >
              <Wallet size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2
                id="modal-selecao-caixa-title"
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 800,
                  color: '#ffffff',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.25,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Seleção de Caixa Operacional — Movimentação Financeira
              </h2>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: 12.5,
                  color: '#e2e8f0',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Selecione o seu caixa para consultar e operar baixas, recebimentos, transferências e lançamentos.
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar modal"
              title="Fechar modal (Esc)"
              style={{
                height: 36,
                padding: '0 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.28)',
                background: 'rgba(255,255,255,0.12)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <X size={17} />
              <span>Fechar</span>
            </button>
          )}
        </div>

        {/* Security & Operator Ownership Banner */}
        <div
          style={{
            padding: '10px 24px',
            background: '#f0f9ff',
            borderBottom: '1px solid #bae6fd',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'nowrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <ShieldCheck size={17} style={{ color: '#0284c7', flexShrink: 0 }} />
            <div
              style={{
                fontSize: 12.5,
                color: '#0c4a6e',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <strong>Regra de Titularidade do Sistema:</strong> Os caixas são sincronizados com{' '}
              <Link
                href="/configuracoes/financeiro/caixas"
                style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'underline' }}
              >
                Configurações &gt; Financeiro &gt; Caixas
              </Link>
              .
            </div>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 999,
              background: '#0284c7',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <UserCheck size={13} />
            <span>Operador Logado: {nomeOperador}</span>
          </div>
        </div>

        {/* Toolbar: Tabs + Search + Quick New Caixa */}
        <div
          style={{
            padding: '12px 24px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'nowrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setTab('meus')}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                border: effectiveTab === 'meus' ? '1px solid #0284c7' : '1px solid #cbd5e1',
                background: effectiveTab === 'meus' ? '#0284c7' : '#ffffff',
                color: effectiveTab === 'meus' ? '#ffffff' : '#334155',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <UserCheck size={14} />
              <span>Meus Caixas ({meusCaixas.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab('todos')}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 700,
                border: effectiveTab === 'todos' ? '1px solid #334155' : '1px solid #cbd5e1',
                background: effectiveTab === 'todos' ? '#334155' : '#ffffff',
                color: effectiveTab === 'todos' ? '#ffffff' : '#475569',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                whiteSpace: 'nowrap',
              }}
            >
              <Eye size={14} />
              <span>Todos os Caixas ({todosCaixasFiltrados.length})</span>
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flex: '1 1 auto',
              justifyContent: 'flex-end',
              minWidth: 0,
            }}
          >
            <div style={{ position: 'relative', width: '100%', maxWidth: 250 }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar código, descrição..."
                style={{
                  width: '100%',
                  height: 36,
                  padding: '0 10px 0 32px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: 12.5,
                  background: '#ffffff',
                  color: '#0f172a',
                }}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 8,
                border: '1px solid #16a34a',
                background: '#16a34a',
                color: '#ffffff',
                fontSize: 12.5,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <Plus size={14} />
              <span>{showCreateForm ? 'Fechar Formulário' : 'Abrir Novo Caixa'}</span>
            </button>
          </div>
        </div>

        {/* Formulário Completo "+ Abrir Novo Caixa" — 100% Sincronizado com /configuracoes/financeiro/caixas */}
        {showCreateForm && (
          <form
            onSubmit={handleCreateAndSelect}
            style={{
              padding: '16px 24px',
              background: '#f0fdf4',
              borderBottom: '1px solid #bbf7d0',
              maxHeight: '56vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Landmark size={15} />
                <span>Abrir Novo Caixa — Sincronizado com Configurações &gt; Financeiro &gt; Caixas</span>
              </div>
              <Link
                href="/configuracoes/financeiro/caixas"
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: '#15803d',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  textDecoration: 'none',
                }}
              >
                <span>Gerenciar em Configurações/Caixas</span>
                <ExternalLink size={12} />
              </Link>
            </div>

            {/* Linha 1: Código + Data Abertura + Identificação do Caixa + Tipo do Caixa */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '95px 135px 1.2fr 1.2fr',
                gap: 10,
                marginBottom: 10,
                alignItems: 'end',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#15803d',
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Código (Seq.)
                </label>
                <input
                  type="text"
                  value={novoCodigo}
                  onChange={(e) => setNovoCodigo(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    fontSize: 12.5,
                    fontWeight: 800,
                    background: '#ffffff',
                    color: '#0f172a',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#15803d',
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Data Abertura
                </label>
                <input
                  type="date"
                  value={novaDataAbertura}
                  onChange={(e) => setNovaDataAbertura(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    fontSize: 12,
                    background: '#ffffff',
                    color: '#0f172a',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#15803d',
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Identificação / Descrição do Caixa
                </label>
                <input
                  type="text"
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Ex: IVAN-2026 ou CAIXA SECRETARIA"
                  required
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    fontSize: 12.5,
                    background: '#ffffff',
                    color: '#0f172a',
                  }}
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 4,
                  }}
                >
                  <label
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#15803d',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Tipo do Caixa
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNovoTipoInput((v) => !v)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: '#0284c7',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    {showNovoTipoInput ? 'Fechar' : '+ Novo Tipo'}
                  </button>
                </div>
                <select
                  value={novoTipoCaixa}
                  onChange={(e) => setNovoTipoCaixa(e.target.value)}
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    fontSize: 12.5,
                    background: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  {todosTiposCaixa.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {showNovoTipoInput && (
              <div
                style={{
                  marginBottom: 10,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: '#ffffff',
                  border: '1px solid #bae6fd',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 11.5, fontWeight: 700, color: '#0369a1', whiteSpace: 'nowrap' }}>
                  Novo Tipo de Caixa:
                </span>
                <input
                  type="text"
                  value={novoTipoNome}
                  onChange={(e) => setNovoTipoNome(e.target.value)}
                  placeholder="Ex: Caixa Cantina, Caixa Eventos..."
                  style={{
                    flex: 1,
                    height: 30,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    fontSize: 12,
                  }}
                />
                <button
                  type="button"
                  disabled={savingNovoTipo}
                  onClick={handleAddNovoTipo}
                  style={{
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#0284c7',
                    color: '#ffffff',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {savingNovoTipo ? 'Salvando...' : 'Adicionar Tipo'}
                </button>
              </div>
            )}

            {/* Linha 2: Operador + Unidade/Empresa (Matriz + Unidades) + Conta Plano */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1.6fr 1fr',
                gap: 10,
                marginBottom: 10,
                alignItems: 'end',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#15803d',
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Operador Responsável
                </label>
                <select
                  value={novoOperador}
                  onChange={(e) => setNovoOperador(e.target.value)}
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    fontSize: 12.5,
                    background: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  {todosOperadores.map((op) => (
                    <option key={op.label} value={op.label}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#15803d',
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Unidade / Empresa (Matriz e Unidades)
                </label>
                <select
                  value={novaUnidade}
                  onChange={(e) => setNovaUnidade(e.target.value)}
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    fontSize: 12.5,
                    background: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  {unidadesDetalhadas.length > 0 ? (
                    <>
                      {unidadesDetalhadas.some((u) => u.tipo === 'Matriz') && (
                        <optgroup label="🏢 Matriz / Mantenedora Principal">
                          {unidadesDetalhadas
                            .filter((u) => u.tipo === 'Matriz')
                            .map((u) => (
                              <option key={u.label} value={u.label}>
                                {u.label}
                              </option>
                            ))}
                        </optgroup>
                      )}
                      {unidadesDetalhadas.some((u) => u.tipo === 'Unidade') && (
                        <optgroup label="🏫 Unidades Educacionais">
                          {unidadesDetalhadas
                            .filter((u) => u.tipo === 'Unidade')
                            .map((u) => (
                              <option key={u.label} value={u.label}>
                                {u.label}
                              </option>
                            ))}
                        </optgroup>
                      )}
                      {todasUnidadesLabels
                        .filter((lbl) => !unidadesDetalhadas.some((u) => u.label === lbl))
                        .map((lbl) => (
                          <option key={lbl} value={lbl}>
                            {lbl}
                          </option>
                        ))}
                    </>
                  ) : (
                    todasUnidadesLabels.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#15803d',
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Conta Plano (Opcional)
                </label>
                <select
                  value={novaContaPlanoId}
                  onChange={(e) => {
                    const pid = e.target.value
                    setNovaContaPlanoId(pid)
                    const found = planoContas.find((p) => p.id === pid)
                    if (found) {
                      const cod = found.codPlano || (found as any).codigo || ''
                      const desc = found.descricao || (found as any).nome || ''
                      setNovaContaPlanoLabel(`${cod} - ${desc}`)
                    } else {
                      setNovaContaPlanoLabel('')
                    }
                  }}
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    fontSize: 12,
                    background: '#ffffff',
                    color: '#0f172a',
                  }}
                >
                  <option value="">— Selecionar Conta Plano —</option>
                  {planoContas.map((p) => {
                    const cod = p.codPlano || (p as any).codigo || ''
                    const desc = p.descricao || (p as any).nome || ''
                    return (
                      <option key={p.id} value={p.id}>
                        {cod} - {desc}
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>

            {/* Linha 3: Agência + Conta + Transferências + Baixa Outro Usuário + Saldo Inicial + Botões */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '90px 105px 1fr 1fr 125px auto',
                gap: 10,
                alignItems: 'end',
              }}
            >
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#15803d',
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Agência
                </label>
                <input
                  type="text"
                  value={novaAgencia}
                  onChange={(e) => setNovaAgencia(e.target.value)}
                  placeholder="Ex: 6492"
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    fontSize: 12,
                    background: '#ffffff',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#15803d',
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Conta
                </label>
                <input
                  type="text"
                  value={novaConta}
                  onChange={(e) => setNovaConta(e.target.value)}
                  placeholder="Ex: 34022-6"
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    fontSize: 12,
                    background: '#ffffff',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#15803d',
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Aceita Transferências
                </label>
                <select
                  value={novoAceitaTransferencia}
                  onChange={(e) => setNovoAceitaTransferencia(e.target.value as 'Sim' | 'Não')}
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    fontSize: 12,
                    background: '#ffffff',
                  }}
                >
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#15803d',
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Baixa de Outro Usuário
                </label>
                <select
                  value={novoAceitaBaixaOutro}
                  onChange={(e) => setNovoAceitaBaixaOutro(e.target.value as 'Sim' | 'Não')}
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    fontSize: 12,
                    background: '#ffffff',
                  }}
                >
                  <option value="Sim">Sim</option>
                  <option value="Não">Não</option>
                </select>
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#15803d',
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Saldo Inicial (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatCurrencyInput(novoSaldoInicial, false)}
                  onChange={(e) => setNovoSaldoInicial(handleCurrencyInputChange(e.target.value, false))}
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    fontSize: 12.5,
                    background: '#ffffff',
                    textAlign: 'right',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    height: 34,
                    padding: '0 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: '#15803d',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {creating ? 'Abrindo...' : 'Criar e Usar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  style={{
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 6,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#475569',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </form>
        )}

        {/* List of Caixas */}
        <div
          style={{
            padding: '16px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* ABA 1: MEUS CAIXAS */}
          {effectiveTab === 'meus' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#0f172a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Caixas Designados para {nomeOperador} ({meusCaixas.length})
                </span>
                <span style={{ fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap' }}>
                  Clique em &ldquo;Utilizar Caixa&rdquo; para carregar os lançamentos
                </span>
              </div>

              {meusCaixas.length === 0 ? (
                <div
                  style={{
                    padding: '28px 20px',
                    borderRadius: 12,
                    border: '1px dashed #94a3b8',
                    background: '#f8fafc',
                    textAlign: 'center',
                  }}
                >
                  <AlertCircle size={28} style={{ color: '#0284c7', margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                    Nenhum caixa designado para {nomeOperador}
                  </div>
                  <p style={{ fontSize: 12.5, color: '#475569', margin: '0 0 14px' }}>
                    Somente aparecem em &ldquo;Meus Caixas&rdquo; os caixas cujo operador designado é você. Você também pode consultar a aba &ldquo;Todos os Caixas ({todosCaixasFiltrados.length})&rdquo; ou abrir um novo caixa.
                  </p>
                  <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(true)}
                      style={{
                        padding: '9px 18px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#0284c7',
                        color: '#ffffff',
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Plus size={15} />
                      <span>Abrir Meu Caixa Agora ({primeiroNomeUpper}-{anoAtual})</span>
                    </button>
                    {todosCaixasFiltrados.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setTab('todos')}
                        style={{
                          padding: '9px 16px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#334155',
                          fontSize: 12.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Eye size={14} />
                        <span>Ver Todos os Caixas ({todosCaixasFiltrados.length})</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {meusCaixas.map((cx) => {
                    const isSelected = selectedCaixa?.id === cx.id
                    const isAberto = cx.situacao === 'Aberto'
                    const resumo = saldosPorCaixaMap[cx.id] || saldosPorCaixaMap[cx.codigo]
                    const saldo =
                      resumo !== undefined
                        ? resumo.saldoAtual
                        : Number(cx.saldoInicial || 0) + Number(cx.totalEntradas || 0) - Number(cx.totalSaidas || 0)
                    const qtdLctos = resumo?.qtdLancamentos ?? 0
                    const isZerado = Math.abs(saldo) < 0.009

                    return (
                      <div
                        key={cx.id}
                        onClick={() => onSelectCaixa(cx)}
                        style={{
                          padding: '14px 18px',
                          borderRadius: 12,
                          border: isSelected ? '2px solid #0284c7' : '1px solid #cbd5e1',
                          background: isSelected ? '#f0f9ff' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 16,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: isSelected
                            ? '0 4px 14px rgba(2, 132, 199, 0.12)'
                            : '0 1px 3px rgba(15, 23, 42, 0.04)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 10,
                              background: isAberto ? '#dcfce7' : '#f1f5f9',
                              border: isAberto ? '1px solid #86efac' : '1px solid #cbd5e1',
                              color: isAberto ? '#15803d' : '#475569',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: 13.5,
                              flexShrink: 0,
                            }}
                          >
                            <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.75, lineHeight: 1 }}>CX</span>
                            <span style={{ lineHeight: 1.15 }}>{cx.codigo}</span>
                          </div>

                          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                              <span
                                style={{
                                  fontSize: 14.5,
                                  fontWeight: 800,
                                  color: '#0f172a',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                Caixa: {cx.codigo} - {cx.descricao}
                              </span>
                              {cx.tipoCaixa && (
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 999,
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    background: '#eff6ff',
                                    color: '#0369a1',
                                    border: '1px solid #bae6fd',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  {cx.tipoCaixa}
                                </span>
                              )}
                              <span
                                style={{
                                  padding: '2px 9px',
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: isAberto ? '#dcfce7' : '#fee2e2',
                                  color: isAberto ? '#166534' : '#991b1b',
                                  border: isAberto ? '1px solid #86efac' : '1px solid #fecaca',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                }}
                              >
                                Situação: {cx.situacao}
                              </span>
                              {isAberto && isZerado && (
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 999,
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    border: '1px solid #cbd5e1',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  Caixa Zerado
                                </span>
                              )}
                              {isSelected && (
                                <span
                                  style={{
                                    padding: '2px 9px',
                                    borderRadius: 999,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: '#0284c7',
                                    color: '#ffffff',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  Em Uso
                                </span>
                              )}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                fontSize: 12,
                                color: '#334155',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <UserCheck size={13} style={{ color: '#0284c7', flexShrink: 0 }} />
                                <span>
                                  <strong>Operador:</strong> {cx.operador}
                                </span>
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <Calendar size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                                <span>
                                  <strong>Data Abertura:</strong> {formatDateBR(cx.dataAbertura)}
                                </span>
                              </span>
                            </div>

                            {cx.unidadeEmpresa && (
                              <div
                                title={cx.unidadeEmpresa}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  fontSize: 11.5,
                                  color: '#64748b',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                <Building2 size={12.5} style={{ color: '#64748b', flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {cx.unidadeEmpresa}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                              }}
                            >
                              Saldo Atual em Caixa
                            </div>
                            <div
                              style={{
                                fontSize: 15,
                                fontWeight: 900,
                                color: saldo > 0.009 ? '#15803d' : saldo < -0.009 ? '#dc2626' : '#0f172a',
                                marginTop: 1,
                              }}
                            >
                              {formatCurrencyBRL(saldo)}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>
                              {qtdLctos} lcto(s) • Abertura: {formatCurrencyBRL(cx.saldoInicial || 0)}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectCaixa(cx)
                            }}
                            style={{
                              height: 38,
                              padding: '0 16px',
                              borderRadius: 8,
                              border: 'none',
                              background: isSelected ? '#15803d' : '#0284c7',
                              color: '#ffffff',
                              fontSize: 12.5,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isSelected ? (
                              <>
                                <CheckCircle2 size={15} />
                                <span>Caixa Ativo</span>
                              </>
                            ) : (
                              <>
                                <span>Utilizar Caixa</span>
                                <ArrowRight size={15} />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ABA 2: TODOS OS CAIXAS DE CONFIGURAÇÕES/FINANCEIRO/CAIXAS */}
          {effectiveTab === 'todos' && (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                  gap: 12,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#0f172a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Eye size={14} style={{ color: '#0284c7' }} />
                  <span>Todos os Caixas de Configurações/Financeiro/Caixas ({todosCaixasFiltrados.length})</span>
                </span>
                <span style={{ fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap' }}>
                  Relação completa de caixas cadastrados no sistema
                </span>
              </div>

              {todosCaixasFiltrados.length === 0 ? (
                <div
                  style={{
                    padding: '28px 20px',
                    borderRadius: 12,
                    border: '1px dashed #94a3b8',
                    background: '#f8fafc',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  Nenhum caixa cadastrado no sistema.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {todosCaixasFiltrados.map((cx) => {
                    const isMeu = isCaixaDoUsuario(cx, currentUser)
                    const canOperate = isMeu || isAdmin || Boolean(cx.aceitaBaixaContasPagarOutroUsuario)
                    const isSelected = selectedCaixa?.id === cx.id
                    const isAberto = cx.situacao === 'Aberto'
                    const resumo = saldosPorCaixaMap[cx.id] || saldosPorCaixaMap[cx.codigo]
                    const saldo =
                      resumo !== undefined
                        ? resumo.saldoAtual
                        : Number(cx.saldoInicial || 0) + Number(cx.totalEntradas || 0) - Number(cx.totalSaidas || 0)
                    const qtdLctos = resumo?.qtdLancamentos ?? 0
                    const isZerado = Math.abs(saldo) < 0.009

                    return (
                      <div
                        key={cx.id}
                        onClick={() => {
                          if (canOperate) onSelectCaixa(cx)
                        }}
                        style={{
                          padding: '14px 18px',
                          borderRadius: 12,
                          border: isSelected
                            ? '2px solid #0284c7'
                            : canOperate
                            ? '1px solid #cbd5e1'
                            : '1px solid #e2e8f0',
                          background: isSelected ? '#f0f9ff' : canOperate ? '#ffffff' : '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 16,
                          cursor: canOperate ? 'pointer' : 'default',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              width: 46,
                              height: 46,
                              borderRadius: 10,
                              background: isAberto ? '#dcfce7' : '#f1f5f9',
                              border: isAberto ? '1px solid #86efac' : '1px solid #cbd5e1',
                              color: isAberto ? '#15803d' : '#475569',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: 13.5,
                              flexShrink: 0,
                            }}
                          >
                            <span style={{ fontSize: 9, fontWeight: 700, opacity: 0.75, lineHeight: 1 }}>CX</span>
                            <span style={{ lineHeight: 1.15 }}>{cx.codigo}</span>
                          </div>

                          <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                              <span
                                style={{
                                  fontSize: 14.5,
                                  fontWeight: 800,
                                  color: '#0f172a',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                Caixa: {cx.codigo} - {cx.descricao}
                              </span>
                              {cx.tipoCaixa && (
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 999,
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    background: '#eff6ff',
                                    color: '#0369a1',
                                    border: '1px solid #bae6fd',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  {cx.tipoCaixa}
                                </span>
                              )}
                              <span
                                style={{
                                  padding: '2px 9px',
                                  borderRadius: 999,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  background: isAberto ? '#dcfce7' : '#fee2e2',
                                  color: isAberto ? '#166534' : '#991b1b',
                                  border: isAberto ? '1px solid #86efac' : '1px solid #fecaca',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                }}
                              >
                                Situação: {cx.situacao}
                              </span>
                              {isAberto && isZerado && (
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: 999,
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    border: '1px solid #cbd5e1',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  Caixa Zerado
                                </span>
                              )}
                              {isMeu ? (
                                <span
                                  style={{
                                    padding: '2px 9px',
                                    borderRadius: 999,
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    background: '#e0f2fe',
                                    color: '#0369a1',
                                    border: '1px solid #bae6fd',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  Designado a Você
                                </span>
                              ) : (
                                <span
                                  style={{
                                    padding: '2px 9px',
                                    borderRadius: 999,
                                    fontSize: 10.5,
                                    fontWeight: 700,
                                    background: '#f1f5f9',
                                    color: '#475569',
                                    border: '1px solid #cbd5e1',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                >
                                  Outro Operador
                                </span>
                              )}
                            </div>

                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 16,
                                fontSize: 12,
                                color: '#334155',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <UserCheck size={13} style={{ color: isMeu ? '#0284c7' : '#64748b', flexShrink: 0 }} />
                                <span>
                                  <strong>Operador Designado:</strong> {cx.operador}
                                </span>
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                                <Calendar size={13} style={{ color: '#64748b', flexShrink: 0 }} />
                                <span>
                                  <strong>Data Abertura:</strong> {formatDateBR(cx.dataAbertura)}
                                </span>
                              </span>
                            </div>

                            {cx.unidadeEmpresa && (
                              <div
                                title={cx.unidadeEmpresa}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  fontSize: 11.5,
                                  color: '#64748b',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                <Building2 size={12.5} style={{ color: '#64748b', flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {cx.unidadeEmpresa}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
                          <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            <div
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#64748b',
                                textTransform: 'uppercase',
                                letterSpacing: '0.03em',
                              }}
                            >
                              Saldo Atual em Caixa
                            </div>
                            <div
                              style={{
                                fontSize: 15,
                                fontWeight: 900,
                                color: saldo > 0.009 ? '#15803d' : saldo < -0.009 ? '#dc2626' : '#0f172a',
                                marginTop: 1,
                              }}
                            >
                              {formatCurrencyBRL(saldo)}
                            </div>
                            <div style={{ fontSize: 10.5, color: '#64748b', fontWeight: 600 }}>
                              {qtdLctos} lcto(s) • Abertura: {formatCurrencyBRL(cx.saldoInicial || 0)}
                            </div>
                          </div>

                          {canOperate ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onSelectCaixa(cx)
                              }}
                              style={{
                                height: 38,
                                padding: '0 16px',
                                borderRadius: 8,
                                border: 'none',
                                background: isSelected ? '#15803d' : '#0284c7',
                                color: '#ffffff',
                                fontSize: 12.5,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {isSelected ? (
                                <>
                                  <CheckCircle2 size={15} />
                                  <span>Caixa Ativo</span>
                                </>
                              ) : (
                                <>
                                  <span>Utilizar Caixa</span>
                                  <ArrowRight size={15} />
                                </>
                              )}
                            </button>
                          ) : (
                            <div
                              style={{
                                height: 38,
                                padding: '0 14px',
                                borderRadius: 8,
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                color: '#64748b',
                                fontSize: 11.5,
                                fontWeight: 700,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              <Lock size={13} />
                              <span>Exclusivo do Operador</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer — Botão de Fechar Sempre Visível */}
        <div
          style={{
            padding: '12px 24px',
            background: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            fontSize: 12,
            color: '#64748b',
          }}
        >
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Dica: Você pode alternar entre os caixas a qualquer momento clicando em &ldquo;Alterar Caixa&rdquo;.
          </span>
          {onClose && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <X size={14} />
                <span>{selectedCaixa ? `Fechar (Continuar com Caixa ${selectedCaixa.codigo})` : 'Fechar Modal'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
