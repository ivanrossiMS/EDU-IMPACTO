'use client'

import React, { useState, useMemo } from 'react'
import {
  Target, Save, Plus, Trash2, Building2, Repeat, Copy, Check,
  Sparkles, Edit3, Search, X
} from 'lucide-react'
import { formatCurrency, formatCurrencyInput, handleCurrencyInputChange, parseCurrencyNumeric } from '@/lib/utils'
import {
  type ContaPagarRecord,
  type ContaPagarTipoCusto,
  type FornecedorEscolar,
  type OrcamentoCategoriaItem,
  type PlanoContasEscolarOption,
  type UnidadeEmpresaEscolarOption,
  type RecorrenciaFixaEscolar,
  type MetodoPagamentoEscolarOption,
  CATEGORIAS_ESCOLARES,
  CENTROS_CUSTO_ESCOLARES,
  METODOS_PAGAMENTO_ESCOLARES_DEFAULT,
  TIPO_CUSTO_CONFIG,
} from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// 1. ABA DE METAS ORÇAMENTÁRIAS (BUDGET VS. REALIZADO POR PLANO DE CONTAS)
// ═══════════════════════════════════════════════════════════════════════════
interface OrcamentoEscolarTabProps {
  contas: ContaPagarRecord[]
  orcamentos: OrcamentoCategoriaItem[]
  competenciaFiltro: string
  planoContas?: PlanoContasEscolarOption[]
  onSaveOrcamentos: (novos: OrcamentoCategoriaItem[]) => Promise<void>
}

export function OrcamentoEscolarTab({
  contas,
  orcamentos,
  competenciaFiltro,
  planoContas,
  onSaveOrcamentos,
}: OrcamentoEscolarTabProps) {
  const mesAtual = useMemo(() => new Date().toISOString().slice(0, 7), [])
  const mesReferencia = competenciaFiltro !== 'todos' ? competenciaFiltro : mesAtual

  const listaPlanoContas = useMemo(() => {
    if (Array.isArray(planoContas) && planoContas.length > 0) {
      return planoContas
        .filter((p) => p.grupoConta !== 'receitas')
        .map((p) => ({
          id: p.label,
          planoId: p.id,
          label: p.label,
          grupoDre: p.grupoDre,
          cor: p.cor,
          orcamentoSugeridoMensal: 0,
        }))
    }
    return []
  }, [planoContas])

  const [draftMetas, setDraftMetas] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const o of orcamentos) {
      map[o.categoria] = o.metaMensal
    }
    return map
  })
  const [saving, setSaving] = useState(false)

  const linhasOrcamento = useMemo(() => {
    return listaPlanoContas.map((cat) => {
      const foundOrc = orcamentos.find((o) => o.categoria === cat.id || o.categoria === cat.planoId)
      const defaultMeta = foundOrc ? foundOrc.metaMensal : 0
      const meta = Number(draftMetas[cat.id] ?? defaultMeta) || 0
      const realizado = contas
        .filter(
          (c) =>
            c.status !== 'cancelado' &&
            (c.categoria === cat.id || c.planoContasId === cat.planoId) &&
            (c.competencia || c.vencimento.slice(0, 7)) === mesReferencia
        )
        .reduce((acc, c) => acc + (Number(c.valor) || 0), 0)

      const pct = meta > 0 ? Math.round((realizado / meta) * 1000) / 10 : 0
      const saldo = meta - realizado
      return {
        ...cat,
        meta,
        realizado,
        pct,
        saldo,
        statusOrcamento: pct > 100 ? 'estourado' : pct >= 85 ? 'atencao' : 'ok',
      }
    })
  }, [contas, draftMetas, mesReferencia, listaPlanoContas, orcamentos])

  const totalMeta = useMemo(() => linhasOrcamento.reduce((a, b) => a + b.meta, 0), [linhasOrcamento])
  const totalRealizado = useMemo(() => linhasOrcamento.reduce((a, b) => a + b.realizado, 0), [linhasOrcamento])

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: OrcamentoCategoriaItem[] = listaPlanoContas.map((c) => {
        const foundOrc = orcamentos.find((o) => o.categoria === c.id || o.categoria === c.planoId)
        const currentVal = draftMetas[c.id] ?? (foundOrc ? foundOrc.metaMensal : 0)
        return {
          categoria: c.id,
          metaMensal: Math.max(0, Number(currentVal) || 0),
          alertaPercentual: 85,
        }
      })
      await onSaveOrcamentos(payload)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          padding: 18,
          borderRadius: 18,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 14,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Target size={18} color="#059669" />
            Controle Orçamentário Escolar (Budget vs. Realizado • Competência {mesReferencia})
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#475569' }}>
            Teto Orçamentário Mensal: <strong style={{ color: '#0f172a' }}>{formatCurrency(totalMeta)}</strong> • Comprometido no Mês:{' '}
            <strong style={{ color: totalRealizado > totalMeta ? '#be123c' : '#047857' }}>
              {formatCurrency(totalRealizado)} ({totalMeta > 0 ? ((totalRealizado / totalMeta) * 100).toFixed(1) : 0}%)
            </strong>
          </p>
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            padding: '10px 18px',
            borderRadius: 11,
            background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
            border: 'none',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.2)',
          }}
        >
          <Save size={15} />
          {saving ? 'Salvando Metas...' : 'Salvar Teto Orçamentário'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        {linhasOrcamento.map((row) => {
          const barColor =
            row.statusOrcamento === 'estourado'
              ? '#e11d48'
              : row.statusOrcamento === 'atencao'
                ? '#d97706'
                : '#059669'
          const badgeBg =
            row.statusOrcamento === 'estourado'
              ? '#fff1f2'
              : row.statusOrcamento === 'atencao'
                ? '#fffbeb'
                : '#ecfdf5'

          return (
            <div
              key={row.id}
              style={{
                padding: 16,
                borderRadius: 16,
                background: '#ffffff',
                border: `1px solid ${row.statusOrcamento === 'estourado' ? '#fecdd3' : '#e2e8f0'}`,
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{row.label}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{row.grupoDre}</div>
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 99,
                    fontSize: 11,
                    fontWeight: 800,
                    color: barColor,
                    background: badgeBg,
                    border: `1px solid ${barColor}33`,
                  }}
                >
                  {row.pct.toFixed(1)}%
                </span>
              </div>

              {/* Barra de Progresso */}
              <div style={{ height: 8, borderRadius: 99, background: '#f1f5f9', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, row.pct)}%`,
                    background: barColor,
                    borderRadius: 99,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <div>
                  <span style={{ color: '#64748b' }}>Realizado: </span>
                  <strong style={{ color: '#0f172a' }}>{formatCurrency(row.realizado)}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <label htmlFor={`meta-${row.id}`} style={{ fontSize: 11, color: '#475569', fontWeight: 700 }}>
                    Meta R$:
                  </label>
                  <input
                    id={`meta-${row.id}`}
                    type="text"
                    inputMode="numeric"
                    value={formatCurrencyInput(draftMetas[row.id] ?? row.meta, false)}
                    onChange={(e) =>
                      setDraftMetas((prev) => ({
                        ...prev,
                        [row.id]: parseCurrencyNumeric(handleCurrencyInputChange(e.target.value, false)),
                      }))
                    }
                    style={{
                      width: 118,
                      padding: '4px 8px',
                      borderRadius: 8,
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      color: '#0369a1',
                      fontSize: 12,
                      fontWeight: 800,
                      textAlign: 'right',
                    }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. ABA DE DIRETÓRIO DE FORNECEDORES & CREDORES ESCOLARES
// ═══════════════════════════════════════════════════════════════════════════
interface FornecedoresEscolaresTabProps {
  fornecedores: FornecedorEscolar[]
  contas: ContaPagarRecord[]
  centrosCusto?: any[]
  planoContas?: PlanoContasEscolarOption[]
  unidades?: UnidadeEmpresaEscolarOption[]
  onSaveFornecedor: (f: Partial<FornecedorEscolar>) => Promise<FornecedorEscolar | null>
  onDeleteFornecedor: (id: string) => Promise<void>
}

export function FornecedoresEscolaresTab({
  fornecedores,
  contas,
  centrosCusto,
  planoContas,
  unidades,
  onSaveFornecedor,
  onDeleteFornecedor,
}: FornecedoresEscolaresTabProps) {
  const listaCentrosCusto = useMemo(
    () => (Array.isArray(centrosCusto) && centrosCusto.length > 0 ? centrosCusto : CENTROS_CUSTO_ESCOLARES),
    [centrosCusto]
  )
  const listaUnidades = useMemo(
    () => (Array.isArray(unidades) ? unidades : []),
    [unidades]
  )
  const opcoesPlanoContas = useMemo(() => {
    if (Array.isArray(planoContas) && planoContas.length > 0) {
      const despesasFirst = [...planoContas].sort((a, b) => {
        if (a.grupoConta === 'receitas' && b.grupoConta !== 'receitas') return 1
        if (a.grupoConta !== 'receitas' && b.grupoConta === 'receitas') return -1
        return String(a.codPlano || '').localeCompare(String(b.codPlano || ''), undefined, { numeric: true })
      })
      return despesasFirst.map((p) => ({
        id: p.label,
        codPlano: p.codPlano || '',
        descricao: p.descricao || p.label,
        label: p.label,
        tipo: p.tipo || 'analitico',
        grupoConta: p.grupoConta || 'despesas',
      }))
    }
    return CATEGORIAS_ESCOLARES.map((c) => ({
      id: c.id,
      codPlano: '',
      descricao: c.label,
      label: c.label,
      tipo: 'analitico' as const,
      grupoConta: 'despesas' as const,
    }))
  }, [planoContas])
  const [busca, setBusca] = useState('')
  const [editing, setEditing] = useState<Partial<FornecedorEscolar> | null>(null)
  const [buscaPlanoFornecedor, setBuscaPlanoFornecedor] = useState('')
  const [showPlanoDropdown, setShowPlanoDropdown] = useState(false)
  const [filtroGrupoPlano, setFiltroGrupoPlano] = useState<'todos' | 'despesas' | 'investimentos' | 'receitas'>('todos')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const opcoesPlanoFiltradas = useMemo(() => {
    const normalize = (s: string) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()

    const rawQuery = normalize(buscaPlanoFornecedor)
    // Se o texto digitado corresponde exatamente à conta já selecionada, exibe todas do grupo para facilitar troca
    const isExactSelected =
      rawQuery.length > 0 &&
      opcoesPlanoContas.some((c) => normalize(c.label) === rawQuery || normalize(c.id) === rawQuery)
    const q = isExactSelected ? '' : rawQuery

    return opcoesPlanoContas.filter((c) => {
      if (filtroGrupoPlano !== 'todos' && c.grupoConta !== filtroGrupoPlano) return false
      if (!q) return true
      return (
        normalize(c.codPlano).includes(q) ||
        normalize(c.descricao).includes(q) ||
        normalize(c.label).includes(q)
      )
    })
  }, [opcoesPlanoContas, buscaPlanoFornecedor, filtroGrupoPlano])

  const listaEnriquecida = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return fornecedores
      .filter((f) => {
        if (!q) return true
        return (
          f.nome.toLowerCase().includes(q) ||
          (f.nomeFantasia || '').toLowerCase().includes(q) ||
          (f.documento || '').toLowerCase().includes(q) ||
          (f.categoriaPadrao || '').toLowerCase().includes(q)
        )
      })
      .map((f) => {
        const titulos = contas.filter(
          (c) =>
            c.status !== 'cancelado' &&
            (c.fornecedorId === f.id || c.fornecedorNome.toLowerCase() === f.nome.toLowerCase())
        )
        const totalPago = titulos
          .filter((c) => c.status === 'pago')
          .reduce((a, b) => a + (Number(b.valorPago || b.valor) || 0), 0)
        const totalAberto = titulos
          .filter((c) => c.status !== 'pago')
          .reduce((a, b) => a + (Number(b.valor) || 0), 0)
        return { ...f, qtdTitulos: titulos.length, totalPago, totalAberto }
      })
  }, [fornecedores, contas, busca])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || !editing.nome?.trim()) return
    await onSaveFornecedor(editing)
    setEditing(null)
    setBuscaPlanoFornecedor('')
    setShowPlanoDropdown(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          padding: 18,
          borderRadius: 18,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={18} color="#0284c7" />
            Cadastro de Fornecedores, Prestadores e Credores Escolares ({fornecedores.length})
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#475569' }}>
            Gerencie dados bancários, chaves PIX, CNPJ e plano de contas padrão de cada fornecedor
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <input
            aria-label="Buscar fornecedor escolar"
            type="text"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CNPJ ou plano de contas..."
            style={{
              padding: '9px 14px',
              borderRadius: 10,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              fontSize: 12,
              minWidth: 250,
            }}
          />
          <button
            type="button"
            onClick={() => {
              setBuscaPlanoFornecedor('')
              setShowPlanoDropdown(false)
              setFiltroGrupoPlano('todos')
              setEditing({
                nome: '',
                nomeFantasia: '',
                documento: '',
                categoriaPadrao: '',
                unidadePadrao: listaUnidades.length === 1 ? listaUnidades[0].nome : '',
                centroCustoPadrao: '',
                tipoCustoPadrao: 'fixo',
                formaPagamentoPadrao: 'PIX',
                chavePix: '',
                telefone: '',
                email: '',
              })
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              borderRadius: 10,
              background: '#0284c7',
              border: 'none',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <Plus size={15} />
            Novo Fornecedor
          </button>
        </div>
      </div>

      {/* Formulário Inline de Criação/Edição de Fornecedor */}
      {editing && (
        <form
          onSubmit={handleSave}
          style={{
            padding: 18,
            borderRadius: 16,
            background: '#f0f9ff',
            border: '1px solid #bae6fd',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <label htmlFor="f-edit-nome" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Razão Social / Nome *
            </label>
            <input
              id="f-edit-nome"
              name="nome"
              type="text"
              required
              value={editing.nome || ''}
              onChange={(e) => setEditing({ ...editing, nome: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            />
          </div>
          <div>
            <label htmlFor="f-edit-doc" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              CNPJ / CPF
            </label>
            <input
              id="f-edit-doc"
              name="documento"
              type="text"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={editing.documento || ''}
              onChange={(e) => setEditing({ ...editing, documento: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <label htmlFor="f-edit-cat" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Plano de Contas Padrão
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search
                size={13}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 10,
                  color: '#64748b',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="f-edit-cat"
                name="categoriaPadrao"
                type="text"
                role="combobox"
                aria-expanded={showPlanoDropdown}
                aria-controls="f-edit-cat-listbox"
                aria-autocomplete="list"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={buscaPlanoFornecedor}
                placeholder="Buscar por código ou conta..."
                onFocus={(e) => {
                  setShowPlanoDropdown(true)
                  e.currentTarget.select()
                }}
                onBlur={() => {
                  setTimeout(() => setShowPlanoDropdown(false), 180)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowPlanoDropdown(false)
                  } else if (e.key === 'Enter' && showPlanoDropdown && opcoesPlanoFiltradas.length > 0) {
                    e.preventDefault()
                    const first = opcoesPlanoFiltradas[0]
                    setBuscaPlanoFornecedor(first.label)
                    setEditing({ ...editing, categoriaPadrao: first.id })
                    setShowPlanoDropdown(false)
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value
                  setBuscaPlanoFornecedor(val)
                  setEditing({ ...editing, categoriaPadrao: val })
                  setShowPlanoDropdown(true)
                }}
                style={{
                  width: '100%',
                  padding: '8px 28px 8px 30px',
                  borderRadius: 8,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                }}
              />
              {buscaPlanoFornecedor && (
                <button
                  type="button"
                  aria-label="Limpar plano de contas padrão"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setBuscaPlanoFornecedor('')
                    setEditing({ ...editing, categoriaPadrao: '' })
                    setShowPlanoDropdown(true)
                  }}
                  style={{
                    position: 'absolute',
                    right: 6,
                    width: 20,
                    height: 20,
                    borderRadius: 99,
                    border: 'none',
                    background: 'transparent',
                    color: '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>

            {showPlanoDropdown && (
              <div
                id="f-edit-cat-listbox"
                role="listbox"
                aria-label="Opções de Plano de Contas"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  minWidth: 'min(360px, 88vw)',
                  width: '100%',
                  maxHeight: 280,
                  zIndex: 60,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  boxShadow: '0 14px 32px rgba(15, 23, 42, 0.16)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 4,
                    flexWrap: 'wrap',
                    padding: '7px 8px',
                    borderBottom: '1px solid #f1f5f9',
                    background: '#f8fafc',
                  }}
                >
                  {(
                    [
                      { id: 'todos', label: 'Todos' },
                      { id: 'despesas', label: '📉 Despesas' },
                      { id: 'investimentos', label: '🪙 Investimentos' },
                      { id: 'receitas', label: '📈 Receitas' },
                    ] as const
                  ).map((g) => {
                    const active = filtroGrupoPlano === g.id
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setFiltroGrupoPlano(g.id)
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 99,
                          fontSize: 10.5,
                          fontWeight: active ? 800 : 600,
                          background: active ? '#0284c7' : '#e2e8f0',
                          color: active ? '#ffffff' : '#475569',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {g.label}
                      </button>
                    )
                  })}
                </div>

                <div style={{ overflowY: 'auto', maxHeight: 225, padding: 4 }}>
                  {opcoesPlanoFiltradas.length === 0 ? (
                    <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                      Nenhuma conta encontrada para &ldquo;{buscaPlanoFornecedor}&rdquo;.
                    </div>
                  ) : (
                    opcoesPlanoFiltradas.map((c) => {
                      const isSelected = editing.categoriaPadrao === c.id || editing.categoriaPadrao === c.label
                      const depth = c.codPlano ? Math.max(0, c.codPlano.split('.').length - 1) : 0
                      const badgeColor =
                        c.grupoConta === 'receitas'
                          ? { color: '#059669', bg: '#ecfdf5' }
                          : c.grupoConta === 'investimentos'
                            ? { color: '#2563eb', bg: '#eff6ff' }
                            : { color: '#dc2626', bg: '#fef2f2' }

                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setBuscaPlanoFornecedor(c.label)
                            setEditing({ ...editing, categoriaPadrao: c.id })
                            setShowPlanoDropdown(false)
                          }}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            paddingLeft: 10 + depth * 10,
                            borderRadius: 7,
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            border: 'none',
                            borderBottom: '1px solid #f8fafc',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            textAlign: 'left',
                            fontSize: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                            {c.codPlano && (
                              <code
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  color: badgeColor.color,
                                  background: badgeColor.bg,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  flexShrink: 0,
                                }}
                              >
                                {c.codPlano}
                              </code>
                            )}
                            <span
                              style={{
                                fontWeight: c.tipo === 'sintetico' ? 800 : 600,
                                color: '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {c.descricao}
                            </span>
                          </div>
                          {isSelected && <Check size={13} color="#0284c7" aria-hidden="true" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="f-edit-unidade" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Unidade / Empresa Padrão
            </label>
            <select
              id="f-edit-unidade"
              name="unidadePadrao"
              value={editing.unidadePadrao ?? ''}
              onChange={(e) => setEditing({ ...editing, unidadePadrao: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            >
              <option value="">---------</option>
              {listaUnidades.map((u) => (
                <option key={u.id} value={u.nome}>
                  {u.label}
                </option>
              ))}
              {editing.unidadePadrao &&
                !listaUnidades.some((u) => u.nome === editing.unidadePadrao || u.id === editing.unidadePadrao) && (
                  <option value={editing.unidadePadrao}>{editing.unidadePadrao}</option>
                )}
            </select>
          </div>
          <div>
            <label htmlFor="f-edit-cc" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Centro de Custo Padrão
            </label>
            <select
              id="f-edit-cc"
              name="centroCustoPadrao"
              value={editing.centroCustoPadrao ?? ''}
              onChange={(e) => {
                const ccVal = e.target.value
                const ccObj = listaCentrosCusto.find((cc: any) => cc.id === ccVal)
                let nextUnidade = editing.unidadePadrao ?? ''
                if (!nextUnidade && ccObj?.unidadeId) {
                  const matchedUni = listaUnidades.find(
                    (u) => u.id === ccObj.unidadeId || u.nome === ccObj.unidadeId
                  )
                  if (matchedUni) nextUnidade = matchedUni.nome
                }
                setEditing({ ...editing, centroCustoPadrao: ccVal, unidadePadrao: nextUnidade })
              }}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            >
              <option value="">---------</option>
              {listaCentrosCusto.map((cc: any) => (
                <option key={cc.id} value={cc.id}>{cc.label} ({cc.sigla})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-edit-tipo-custo" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Natureza do Custo
            </label>
            <select
              id="f-edit-tipo-custo"
              name="tipoCustoPadrao"
              value={editing.tipoCustoPadrao || 'fixo'}
              onChange={(e) => setEditing({ ...editing, tipoCustoPadrao: e.target.value as ContaPagarTipoCusto })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            >
              <option value="fixo">Custo Fixo</option>
              <option value="variavel">Custo Variável</option>
              <option value="investimento">Investimento / CAPEX</option>
              <option value="extraordinario">Extraordinário</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-edit-pix" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Chave PIX
            </label>
            <input
              id="f-edit-pix"
              name="chavePix"
              type="text"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={editing.chavePix || ''}
              onChange={(e) => setEditing({ ...editing, chavePix: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
            <button
              type="submit"
              style={{ padding: '8px 14px', borderRadius: 8, background: '#059669', border: 'none', color: '#ffffff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
            >
              Salvar Fornecedor
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setBuscaPlanoFornecedor('')
                setShowPlanoDropdown(false)
              }}
              style={{ padding: '8px 12px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: 14 }}>
        {listaEnriquecida.map((f) => (
          <div
            key={f.id}
            style={{
              padding: 16,
              borderRadius: 16,
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{f.nomeFantasia || f.nome}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{f.documento || 'Sem CNPJ informado'}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(f)
                    setBuscaPlanoFornecedor(f.categoriaPadrao || '')
                    setShowPlanoDropdown(false)
                    setFiltroGrupoPlano('todos')
                  }}
                  aria-label={`Editar fornecedor ${f.nome}`}
                  style={{ padding: 6, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', cursor: 'pointer' }}
                >
                  <Edit3 size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteFornecedor(f.id)}
                  aria-label={`Excluir fornecedor ${f.nome}`}
                  style={{ padding: 6, borderRadius: 8, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', cursor: 'pointer' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {f.categoriaPadrao && (
                <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 700 }}>{f.categoriaPadrao}</div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {f.unidadePadrao && (
                  <span
                    style={{
                      fontSize: 10.5,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: '#f1f5f9',
                      color: '#334155',
                      fontWeight: 700,
                    }}
                  >
                    🏫 {f.unidadePadrao}
                  </span>
                )}
                {f.centroCustoPadrao && (
                  <span
                    style={{
                      fontSize: 10.5,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: '#eff6ff',
                      color: '#1d4ed8',
                      fontWeight: 700,
                    }}
                  >
                    🎯 {f.centroCustoPadrao}
                  </span>
                )}
                {f.tipoCustoPadrao && (
                  <span
                    style={{
                      fontSize: 10.5,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: '#f5f3ff',
                      color: '#6d28d9',
                      fontWeight: 700,
                    }}
                  >
                    {TIPO_CUSTO_CONFIG[f.tipoCustoPadrao]?.label || f.tipoCustoPadrao}
                  </span>
                )}
              </div>
            </div>

            {f.chavePix && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(f.chavePix!)
                  setCopiedId(f.id)
                  setTimeout(() => setCopiedId(null), 1800)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  color: '#0369a1',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <span>PIX: {f.chavePix}</span>
                {copiedId === f.id ? <Check size={13} /> : <Copy size={13} />}
              </button>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: 8,
                borderTop: '1px solid #f1f5f9',
                fontSize: 11,
              }}
            >
              <span style={{ color: '#64748b' }}>
                Pago: <strong style={{ color: '#047857' }}>{formatCurrency(f.totalPago)}</strong>
              </span>
              <span style={{ color: '#64748b' }}>
                Em Aberto: <strong style={{ color: '#b45309' }}>{formatCurrency(f.totalAberto)}</strong>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. ABA DE RECORRÊNCIAS FIXAS & CONTRATOS MENSAIS (DADOS REAIS CADASTRADOS)
// ═══════════════════════════════════════════════════════════════════════════
interface RecorrentesTemplatesTabProps {
  recorrencias: RecorrenciaFixaEscolar[]
  contas?: ContaPagarRecord[]
  fornecedores?: FornecedorEscolar[]
  centrosCusto?: any[]
  planoContas?: PlanoContasEscolarOption[]
  unidades?: UnidadeEmpresaEscolarOption[]
  metodosPagamento?: MetodoPagamentoEscolarOption[]
  onSaveRecorrencia: (rec: Partial<RecorrenciaFixaEscolar>) => Promise<RecorrenciaFixaEscolar | null>
  onDeleteRecorrencia: (id: string) => Promise<void>
  onGerarDespesaTemplate: (tpl: RecorrenciaFixaEscolar, competencia: string) => Promise<void>
  onGerarLoteMensalFixo: (competencia: string) => Promise<void>
}

export function RecorrentesTemplatesTab({
  recorrencias,
  contas = [],
  fornecedores = [],
  centrosCusto,
  planoContas,
  unidades,
  metodosPagamento,
  onSaveRecorrencia,
  onDeleteRecorrencia,
  onGerarDespesaTemplate,
  onGerarLoteMensalFixo,
}: RecorrentesTemplatesTabProps) {
  const [competenciaAlvo, setCompetenciaAlvo] = useState(() => new Date().toISOString().slice(0, 7))
  const [generating, setGenerating] = useState(false)
  const [editing, setEditing] = useState<Partial<RecorrenciaFixaEscolar> | null>(null)
  const [buscaPlanoRec, setBuscaPlanoRec] = useState('')
  const [showPlanoDropdown, setShowPlanoDropdown] = useState(false)
  const [filtroGrupoPlano, setFiltroGrupoPlano] = useState<'todos' | 'despesas' | 'investimentos' | 'receitas'>('todos')

  const listaCentrosCusto = useMemo(
    () => (Array.isArray(centrosCusto) && centrosCusto.length > 0 ? centrosCusto : CENTROS_CUSTO_ESCOLARES),
    [centrosCusto]
  )

  const listaUnidades = useMemo(
    () => (Array.isArray(unidades) ? unidades : []),
    [unidades]
  )

  const listaMetodos = useMemo(
    () =>
      Array.isArray(metodosPagamento) && metodosPagamento.length > 0
        ? metodosPagamento
        : METODOS_PAGAMENTO_ESCOLARES_DEFAULT,
    [metodosPagamento]
  )

  const opcoesPlanoContas = useMemo(() => {
    if (Array.isArray(planoContas) && planoContas.length > 0) {
      const despesasFirst = [...planoContas].sort((a, b) => {
        if (a.grupoConta === 'receitas' && b.grupoConta !== 'receitas') return 1
        if (a.grupoConta !== 'receitas' && b.grupoConta === 'receitas') return -1
        return String(a.codPlano || '').localeCompare(String(b.codPlano || ''), undefined, { numeric: true })
      })
      return despesasFirst.map((p) => ({
        id: p.label,
        planoId: p.id,
        codPlano: p.codPlano || '',
        descricao: p.descricao || p.label,
        label: p.label,
        tipo: p.tipo || 'analitico',
        grupoConta: p.grupoConta || 'despesas',
      }))
    }
    return []
  }, [planoContas])

  const opcoesPlanoFiltradas = useMemo(() => {
    const normalize = (s: string) =>
      (s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()

    const rawQuery = normalize(buscaPlanoRec)
    const isExactSelected =
      rawQuery.length > 0 &&
      opcoesPlanoContas.some((c) => normalize(c.label) === rawQuery || normalize(c.id) === rawQuery)
    const q = isExactSelected ? '' : rawQuery

    return opcoesPlanoContas.filter((c) => {
      if (filtroGrupoPlano !== 'todos' && c.grupoConta !== filtroGrupoPlano) return false
      if (!q) return true
      return (
        normalize(c.codPlano).includes(q) ||
        normalize(c.descricao).includes(q) ||
        normalize(c.label).includes(q)
      )
    })
  }, [opcoesPlanoContas, buscaPlanoRec, filtroGrupoPlano])

  const handleOpenNew = () => {
    setBuscaPlanoRec('')
    setShowPlanoDropdown(false)
    setFiltroGrupoPlano('todos')
    setEditing({
      titulo: '',
      fornecedorId: '',
      fornecedorNome: '',
      fornecedorDocumento: '',
      categoria: '',
      planoContasId: '',
      unidadePadrao: listaUnidades.length === 1 ? listaUnidades[0].nome : '',
      centroCusto: '',
      tipoCusto: 'fixo',
      prioridade: 'alta',
      diaVencimento: 10,
      valorEstimado: 0,
      formaPagamento: 'PIX',
      chavePix: '',
      ativo: true,
    })
  }

  const handleSelectFornecedorRec = (fornId: string) => {
    if (!editing) return
    const found = fornecedores.find((f) => f.id === fornId)
    if (!found) {
      setEditing({ ...editing, fornecedorId: '' })
      return
    }
    let nextUnidade = found.unidadePadrao || editing.unidadePadrao || ''
    if (!nextUnidade && found.centroCustoPadrao) {
      const ccObj = listaCentrosCusto.find((cc: any) => cc.id === found.centroCustoPadrao)
      if (ccObj?.unidadeId) {
        const matchedUni = listaUnidades.find((u) => u.id === ccObj.unidadeId || u.nome === ccObj.unidadeId)
        if (matchedUni) nextUnidade = matchedUni.nome
      }
    }
    const matchedPlano = opcoesPlanoContas.find(
      (p) => p.id === found.categoriaPadrao || p.label === found.categoriaPadrao || p.descricao === found.categoriaPadrao
    )
    const nextCat = matchedPlano ? matchedPlano.id : found.categoriaPadrao || editing.categoria || ''
    setBuscaPlanoRec(nextCat)
    setEditing({
      ...editing,
      fornecedorId: found.id,
      fornecedorNome: found.nome,
      fornecedorDocumento: found.documento || '',
      titulo: editing.titulo?.trim() ? editing.titulo : found.nomeFantasia || found.nome,
      categoria: nextCat,
      planoContasId: matchedPlano?.planoId || editing.planoContasId,
      unidadePadrao: nextUnidade,
      centroCusto: found.centroCustoPadrao || editing.centroCusto || '',
      tipoCusto: found.tipoCustoPadrao || editing.tipoCusto || 'fixo',
      formaPagamento: found.formaPagamentoPadrao || editing.formaPagamento || 'PIX',
      chavePix: found.chavePix || editing.chavePix || '',
    })
  }

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || !editing.titulo?.trim()) return
    await onSaveRecorrencia(editing)
    setEditing(null)
    setBuscaPlanoRec('')
    setShowPlanoDropdown(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div
        style={{
          padding: 18,
          borderRadius: 18,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Repeat size={18} color="#7c3aed" />
            Matriz de Contratos Fixos & Gerador de Despesas Recorrentes ({recorrencias.length})
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#475569' }}>
            Cadastre os contratos e compromissos mensais recorrentes da escola e gere os lançamentos da competência com 1 clique
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <label htmlFor="rec-comp-alvo" style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
            Competência Alvo:
          </label>
          <input
            id="rec-comp-alvo"
            type="month"
            value={competenciaAlvo}
            onChange={(e) => setCompetenciaAlvo(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 10,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              fontSize: 12,
              fontWeight: 700,
            }}
          />
          <button
            type="button"
            onClick={handleOpenNew}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 15px',
              borderRadius: 10,
              background: '#0284c7',
              border: 'none',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <Plus size={15} />
            Nova Recorrência Fixa
          </button>
          {recorrencias.length > 0 && (
            <button
              type="button"
              disabled={generating}
              onClick={async () => {
                setGenerating(true)
                try {
                  await onGerarLoteMensalFixo(competenciaAlvo)
                } finally {
                  setGenerating(false)
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '9px 16px',
                borderRadius: 10,
                background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Sparkles size={14} />
              {generating ? 'Gerando...' : `Gerar Todas as Despesas Fixas de ${competenciaAlvo}`}
            </button>
          )}
        </div>
      </div>

      {/* Formulário Inline de Criação/Edição de Recorrência Fixa */}
      {editing && (
        <form
          onSubmit={handleSaveForm}
          style={{
            padding: 18,
            borderRadius: 16,
            background: '#f5f3ff',
            border: '1px solid #ddd6fe',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <div>
            <label htmlFor="rec-forn" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Vincular Fornecedor Cadastrado
            </label>
            <select
              id="rec-forn"
              value={editing.fornecedorId || ''}
              onChange={(e) => handleSelectFornecedorRec(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            >
              <option value="">-- Selecionar fornecedor (opcional) --</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nomeFantasia || f.nome} {f.documento ? `(${f.documento})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rec-titulo" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Descrição do Contrato / Despesa Fixa *
            </label>
            <input
              id="rec-titulo"
              type="text"
              required
              placeholder="Ex: Energia Elétrica, Link Internet, Contabilidade..."
              value={editing.titulo || ''}
              onChange={(e) => setEditing({ ...editing, titulo: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            />
          </div>

          <div>
            <label htmlFor="rec-dia" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Dia de Vencimento Mensal (1 a 31) *
            </label>
            <input
              id="rec-dia"
              type="number"
              min={1}
              max={31}
              required
              value={editing.diaVencimento ?? 10}
              onChange={(e) =>
                setEditing({ ...editing, diaVencimento: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })
              }
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            />
          </div>

          <div>
            <label htmlFor="rec-valor" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Valor Mensal / Estimado (R$) *
            </label>
            <input
              id="rec-valor"
              type="text"
              inputMode="numeric"
              required
              value={formatCurrencyInput(editing.valorEstimado ?? '', false)}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  valorEstimado: parseCurrencyNumeric(handleCurrencyInputChange(e.target.value, false)),
                })
              }
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12, fontWeight: 700, textAlign: 'right' }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <label htmlFor="rec-cat" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Plano de Contas
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search
                size={13}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 10,
                  color: '#64748b',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="rec-cat"
                type="text"
                role="combobox"
                aria-expanded={showPlanoDropdown}
                aria-controls="rec-cat-listbox"
                aria-autocomplete="list"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={buscaPlanoRec}
                placeholder="Buscar por código ou conta..."
                onFocus={(e) => {
                  setShowPlanoDropdown(true)
                  e.currentTarget.select()
                }}
                onBlur={() => {
                  setTimeout(() => setShowPlanoDropdown(false), 180)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowPlanoDropdown(false)
                  } else if (e.key === 'Enter' && showPlanoDropdown && opcoesPlanoFiltradas.length > 0) {
                    e.preventDefault()
                    const first = opcoesPlanoFiltradas[0]
                    setBuscaPlanoRec(first.label)
                    setEditing({ ...editing, categoria: first.id, planoContasId: first.planoId })
                    setShowPlanoDropdown(false)
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value
                  setBuscaPlanoRec(val)
                  setEditing({ ...editing, categoria: val })
                  setShowPlanoDropdown(true)
                }}
                style={{
                  width: '100%',
                  padding: '8px 28px 8px 30px',
                  borderRadius: 8,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                }}
              />
              {buscaPlanoRec && (
                <button
                  type="button"
                  aria-label="Limpar plano de contas"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setBuscaPlanoRec('')
                    setEditing({ ...editing, categoria: '', planoContasId: '' })
                    setShowPlanoDropdown(true)
                  }}
                  style={{
                    position: 'absolute',
                    right: 6,
                    width: 20,
                    height: 20,
                    borderRadius: 99,
                    border: 'none',
                    background: 'transparent',
                    color: '#64748b',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              )}
            </div>

            {showPlanoDropdown && (
              <div
                id="rec-cat-listbox"
                role="listbox"
                aria-label="Opções de Plano de Contas"
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  minWidth: 'min(360px, 88vw)',
                  width: '100%',
                  maxHeight: 260,
                  zIndex: 60,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  boxShadow: '0 14px 32px rgba(15, 23, 42, 0.16)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 4,
                    flexWrap: 'wrap',
                    padding: '7px 8px',
                    borderBottom: '1px solid #f1f5f9',
                    background: '#f8fafc',
                  }}
                >
                  {(
                    [
                      { id: 'todos', label: 'Todos' },
                      { id: 'despesas', label: '📉 Despesas' },
                      { id: 'investimentos', label: '🪙 Investimentos' },
                      { id: 'receitas', label: '📈 Receitas' },
                    ] as const
                  ).map((g) => {
                    const active = filtroGrupoPlano === g.id
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setFiltroGrupoPlano(g.id)
                        }}
                        style={{
                          padding: '3px 8px',
                          borderRadius: 99,
                          fontSize: 10.5,
                          fontWeight: active ? 800 : 600,
                          background: active ? '#7c3aed' : '#e2e8f0',
                          color: active ? '#ffffff' : '#475569',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {g.label}
                      </button>
                    )
                  })}
                </div>

                <div style={{ overflowY: 'auto', maxHeight: 210, padding: 4 }}>
                  {opcoesPlanoFiltradas.length === 0 ? (
                    <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
                      Nenhuma conta encontrada.
                    </div>
                  ) : (
                    opcoesPlanoFiltradas.map((c) => {
                      const isSelected = editing.categoria === c.id || editing.categoria === c.label
                      const depth = c.codPlano ? Math.max(0, c.codPlano.split('.').length - 1) : 0
                      return (
                        <button
                          key={c.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            setBuscaPlanoRec(c.label)
                            setEditing({ ...editing, categoria: c.id, planoContasId: c.planoId })
                            setShowPlanoDropdown(false)
                          }}
                          style={{
                            width: '100%',
                            padding: '7px 10px',
                            paddingLeft: 10 + depth * 10,
                            borderRadius: 7,
                            background: isSelected ? '#f5f3ff' : '#ffffff',
                            border: 'none',
                            borderBottom: '1px solid #f8fafc',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            textAlign: 'left',
                            fontSize: 12,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                            {c.codPlano && (
                              <code
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 800,
                                  color: '#6d28d9',
                                  background: '#f5f3ff',
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  flexShrink: 0,
                                }}
                              >
                                {c.codPlano}
                              </code>
                            )}
                            <span
                              style={{
                                fontWeight: c.tipo === 'sintetico' ? 800 : 600,
                                color: '#0f172a',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {c.descricao}
                            </span>
                          </div>
                          {isSelected && <Check size={13} color="#7c3aed" aria-hidden="true" />}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="rec-unidade" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Unidade / Empresa
            </label>
            <select
              id="rec-unidade"
              value={editing.unidadePadrao ?? ''}
              onChange={(e) => setEditing({ ...editing, unidadePadrao: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            >
              <option value="">---------</option>
              {listaUnidades.map((u) => (
                <option key={u.id} value={u.nome}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rec-cc" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Centro de Custo
            </label>
            <select
              id="rec-cc"
              value={editing.centroCusto ?? ''}
              onChange={(e) => {
                const ccVal = e.target.value
                const ccObj = listaCentrosCusto.find((cc: any) => cc.id === ccVal)
                let nextUnidade = editing.unidadePadrao ?? ''
                if (!nextUnidade && ccObj?.unidadeId) {
                  const matchedUni = listaUnidades.find((u) => u.id === ccObj.unidadeId || u.nome === ccObj.unidadeId)
                  if (matchedUni) nextUnidade = matchedUni.nome
                }
                setEditing({ ...editing, centroCusto: ccVal, unidadePadrao: nextUnidade })
              }}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            >
              <option value="">---------</option>
              {listaCentrosCusto.map((cc: any) => (
                <option key={cc.id} value={cc.id}>
                  {cc.label} ({cc.sigla})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rec-forma" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Forma de Pagamento
            </label>
            <select
              id="rec-forma"
              value={editing.formaPagamento || 'PIX'}
              onChange={(e) => setEditing({ ...editing, formaPagamento: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            >
              {listaMetodos.map((m) => (
                <option key={m.id} value={m.nome}>
                  {m.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rec-tipo-custo" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Natureza do Custo
            </label>
            <select
              id="rec-tipo-custo"
              value={editing.tipoCusto || 'fixo'}
              onChange={(e) => setEditing({ ...editing, tipoCusto: e.target.value as ContaPagarTipoCusto })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            >
              <option value="fixo">Custo Fixo</option>
              <option value="variavel">Custo Variável</option>
              <option value="investimento">Investimento / CAPEX</option>
              <option value="extraordinario">Extraordinário</option>
            </select>
          </div>

          <div>
            <label htmlFor="rec-pix" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Chave PIX
            </label>
            <input
              id="rec-pix"
              type="text"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={editing.chavePix || ''}
              onChange={(e) => setEditing({ ...editing, chavePix: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'end', gap: 8 }}>
            <button
              type="submit"
              style={{ padding: '8px 14px', borderRadius: 8, background: '#7c3aed', border: 'none', color: '#ffffff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}
            >
              Salvar Recorrência
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null)
                setBuscaPlanoRec('')
                setShowPlanoDropdown(false)
              }}
              style={{ padding: '8px 12px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {recorrencias.length === 0 ? (
        <div
          style={{
            padding: '44px 24px',
            borderRadius: 18,
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: '#f5f3ff',
              color: '#7c3aed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Repeat size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
            Nenhuma recorrência fixa cadastrada
          </div>
          <div style={{ fontSize: 12.5, color: '#64748b', maxWidth: 520 }}>
            Cadastre os contratos e despesas mensais fixas da escola (como aluguel, energia, internet, sistemas, contabilidade) para lançá-los em qualquer competência com 1 clique.
          </div>
          <button
            type="button"
            onClick={handleOpenNew}
            style={{
              marginTop: 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '9px 16px',
              borderRadius: 10,
              background: '#7c3aed',
              border: 'none',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            <Plus size={15} />
            Cadastrar Primeira Recorrência Fixa
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
          {recorrencias.map((tpl) => {
            const jaLancadoNoMes = contas.some(
              (c) =>
                c.status !== 'cancelado' &&
                (c.competencia || c.vencimento.slice(0, 7)) === competenciaAlvo &&
                (c.descricao.toLowerCase().includes(tpl.titulo.toLowerCase()) ||
                  (tpl.fornecedorId && c.fornecedorId === tpl.fornecedorId && Math.abs(c.valor - tpl.valorEstimado) < 0.01))
            )

            return (
              <div
                key={tpl.id}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase' }}>
                        Todo dia {String(tpl.diaVencimento).padStart(2, '0')}
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>• {tpl.formaPagamento}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(tpl)
                          setBuscaPlanoRec(tpl.categoria || '')
                          setShowPlanoDropdown(false)
                          setFiltroGrupoPlano('todos')
                        }}
                        aria-label={`Editar recorrência ${tpl.titulo}`}
                        style={{ padding: 5, borderRadius: 7, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#334155', cursor: 'pointer' }}
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteRecorrencia(tpl.id)}
                        aria-label={`Excluir recorrência ${tpl.titulo}`}
                        style={{ padding: 5, borderRadius: 7, background: '#fff1f2', border: '1px solid #fecdd3', color: '#be123c', cursor: 'pointer' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 6 }}>{tpl.titulo}</div>
                  {tpl.fornecedorNome && tpl.fornecedorNome !== tpl.titulo && (
                    <div style={{ fontSize: 11.5, color: '#475569', fontWeight: 600, marginTop: 2 }}>
                      Fornecedor: {tpl.fornecedorNome}
                    </div>
                  )}
                  {tpl.categoria && (
                    <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 700, marginTop: 4 }}>{tpl.categoria}</div>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                    {tpl.unidadePadrao && (
                      <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 6, background: '#f1f5f9', color: '#334155', fontWeight: 700 }}>
                        🏫 {tpl.unidadePadrao}
                      </span>
                    )}
                    {tpl.centroCusto && (
                      <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 6, background: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}>
                        🎯 {tpl.centroCusto}
                      </span>
                    )}
                    {jaLancadoNoMes && (
                      <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 6, background: '#ecfdf5', color: '#047857', fontWeight: 800 }}>
                        ✓ Lançado em {competenciaAlvo}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                  <strong style={{ fontSize: 15, color: '#047857', fontWeight: 900 }}>
                    {formatCurrency(tpl.valorEstimado)}
                  </strong>
                  <button
                    type="button"
                    onClick={() => onGerarDespesaTemplate(tpl, competenciaAlvo)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 8,
                      background: '#ecfdf5',
                      border: '1px solid #a7f3d0',
                      color: '#047857',
                      fontSize: 11,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    + Lançar em {competenciaAlvo}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
