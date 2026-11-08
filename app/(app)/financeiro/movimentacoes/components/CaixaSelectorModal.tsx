'use client'

import React, { useState, useMemo } from 'react'
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
} from 'lucide-react'
import type { ConfigCaixa } from '@/lib/dataContext'
import { formatCurrencyInput, handleCurrencyInputChange } from '@/lib/utils'
import {
  isCaixaDoUsuario,
  isUsuarioAdministrador,
  formatCurrencyBRL,
  formatDateBR,
  normalizeText,
  type ResumoSaldoCaixa,
} from '../types'

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
  saldosPorCaixaMap?: Record<string, ResumoSaldoCaixa>
  onSelectCaixa: (caixa: ConfigCaixa) => void
  onQuickCreateCaixa: (novoCaixa: Partial<ConfigCaixa>) => Promise<ConfigCaixa | null>
  onClose?: () => void
}

export function CaixaSelectorModal({
  open,
  caixas,
  selectedCaixa,
  currentUser,
  currentUserPerfil,
  unidadesDisponiveis,
  saldosPorCaixaMap = {},
  onSelectCaixa,
  onQuickCreateCaixa,
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
  const effectiveTab: 'meus' | 'todos' = isAdmin ? tab : 'meus'

  const nomeOperador = currentUser?.nome || 'Operador'
  const anoAtual = new Date().getFullYear()
  const primeiroNomeUpper = (nomeOperador.split(' ')[0] || 'CAIXA').toUpperCase()

  const [novoCodigo, setNovoCodigo] = useState(() => {
    const maxCod = caixas.reduce((acc, c) => Math.max(acc, Number(c.codigo) || 100), 107)
    return String(maxCod + 1)
  })
  const [novaDescricao, setNovaDescricao] = useState(`${primeiroNomeUpper}-${anoAtual}`)
  const [novaUnidade, setNovaUnidade] = useState(unidadesDisponiveis[0] || 'Colégio Impacto - Matriz')
  const [novoSaldoInicial, setNovoSaldoInicial] = useState('0')

  const { meusCaixas, todosCaixasFiltrados } = useMemo(() => {
    const q = normalizeText(search)
    const filtered = caixas.filter((c) => {
      if (!q) return true
      return (
        normalizeText(c.codigo).includes(q) ||
        normalizeText(c.descricao).includes(q) ||
        normalizeText(c.operador).includes(q) ||
        normalizeText(c.unidadeEmpresa).includes(q)
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

  const handleCreateAndSelect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novaDescricao.trim()) return
    setCreating(true)
    try {
      const created = await onQuickCreateCaixa({
        codigo: novoCodigo.trim() || '108',
        descricao: novaDescricao.trim().toUpperCase(),
        operador: `11 - ${nomeOperador}`,
        abertoPor: `11 - ${nomeOperador}`,
        unidadeEmpresa: novaUnidade,
        dataAbertura: new Date().toISOString().slice(0, 10),
        situacao: 'Aberto',
        saldoInicial: Number(String(novoSaldoInicial).replace(',', '.')) || 0,
        aceitaBaixaContasPagarOutroUsuario: true,
        aceitaTransferencias: 'Sim',
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
          maxWidth: 880,
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: 16,
          boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.4)',
          border: '1px solid #cbd5e1',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Top Header — Título 100% Branco e Alinhado */}
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

          {selectedCaixa && onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Manter caixa atual e fechar"
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.22)',
                background: 'rgba(255,255,255,0.1)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Security & Operator Ownership Banner — Em Linha Única Sem Quebra */}
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
              <strong>Regra de Titularidade do Sistema:</strong> Os caixas só podem ser operados pelo usuário titular vinculado.
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

        {/* Toolbar: Tabs + Search + Quick New Caixa — Alinhados em Linha Única */}
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

            {isAdmin && (
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
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 auto', justifyContent: 'flex-end', minWidth: 0 }}>
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
              <span>Abrir Novo Caixa</span>
            </button>
          </div>
        </div>

        {/* Inline Quick Create Form */}
        {showCreateForm && (
          <form
            onSubmit={handleCreateAndSelect}
            style={{
              padding: '14px 24px',
              background: '#f0fdf4',
              borderBottom: '1px solid #bbf7d0',
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#166534', marginBottom: 10 }}>
              Abrir Novo Caixa Vinculado ao Operador: {nomeOperador}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '85px 1fr 1.3fr 130px auto',
                gap: 10,
                alignItems: 'end',
              }}
            >
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 4, whiteSpace: 'nowrap' }}>
                  Código
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
                    background: '#ffffff',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 4, whiteSpace: 'nowrap' }}>
                  Identificação do Caixa
                </label>
                <input
                  type="text"
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  placeholder="Ex: IVAN-2026"
                  required
                  style={{
                    width: '100%',
                    height: 34,
                    padding: '0 10px',
                    borderRadius: 6,
                    border: '1px solid #86efac',
                    fontSize: 12.5,
                    background: '#ffffff',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 4, whiteSpace: 'nowrap' }}>
                  Unidade Escolar
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
                  }}
                >
                  {unidadesDisponiveis.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#15803d', marginBottom: 4, whiteSpace: 'nowrap' }}>
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
          {/* ABA 1: MEUS CAIXAS (Apenas caixas cujo Operador designado é o usuário logado) */}
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
                    Somente aparecem em &ldquo;Meus Caixas&rdquo; os caixas cujo operador designado é você. Clique abaixo para abrir um caixa em seu nome.
                  </p>
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

          {/* ABA 2: TODOS OS CAIXAS DO SISTEMA (Exclusivo para Administrador) */}
          {effectiveTab === 'todos' && isAdmin && (
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
                  <span>Todos os Caixas do Sistema — Visão Administrador ({todosCaixasFiltrados.length})</span>
                </span>
                <span style={{ fontSize: 11.5, color: '#64748b', whiteSpace: 'nowrap' }}>
                  Visão geral de todos os caixas e seus operadores designados
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
                          if (isMeu) onSelectCaixa(cx)
                        }}
                        style={{
                          padding: '14px 18px',
                          borderRadius: 12,
                          border: isSelected
                            ? '2px solid #0284c7'
                            : isMeu
                            ? '1px solid #cbd5e1'
                            : '1px solid #e2e8f0',
                          background: isSelected ? '#f0f9ff' : isMeu ? '#ffffff' : '#f8fafc',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 16,
                          cursor: isMeu ? 'pointer' : 'default',
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

                          {isMeu ? (
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

        {/* Footer */}
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
            Dica: Você pode alternar entre os seus caixas a qualquer momento clicando na lupa ao lado do caixa selecionado.
          </span>
          {selectedCaixa && onClose && (
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
                flexShrink: 0,
              }}
            >
              Continuar com Caixa {selectedCaixa.codigo}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
