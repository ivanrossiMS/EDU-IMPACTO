'use client'

import React, { useState, useMemo } from 'react'
import {
  Target, Save, Plus, Trash2, Building2, Repeat, Copy, Check,
  Sparkles, Edit3
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  type ContaPagarRecord,
  type FornecedorEscolar,
  type OrcamentoCategoriaItem,
  type PlanoContasEscolarOption,
  CATEGORIAS_ESCOLARES,
  CENTROS_CUSTO_ESCOLARES,
  TEMPLATES_DESPESAS_ESCOLARES,
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
          orcamentoSugeridoMensal: p.orcamentoSugeridoMensal,
        }))
    }
    return CATEGORIAS_ESCOLARES.map((c) => ({
      id: c.id,
      planoId: c.id,
      label: c.label,
      grupoDre: c.grupoDre,
      cor: c.cor,
      orcamentoSugeridoMensal: c.orcamentoSugeridoMensal,
    }))
  }, [planoContas])

  const [draftMetas, setDraftMetas] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const c of CATEGORIAS_ESCOLARES) {
      const found = orcamentos.find((o) => o.categoria === c.id)
      map[c.id] = found ? found.metaMensal : c.orcamentoSugeridoMensal
    }
    for (const o of orcamentos) {
      map[o.categoria] = o.metaMensal
    }
    return map
  })
  const [saving, setSaving] = useState(false)

  const linhasOrcamento = useMemo(() => {
    return listaPlanoContas.map((cat) => {
      const foundOrc = orcamentos.find((o) => o.categoria === cat.id || o.categoria === cat.planoId)
      const defaultMeta = foundOrc ? foundOrc.metaMensal : cat.orcamentoSugeridoMensal
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
      const payload: OrcamentoCategoriaItem[] = listaPlanoContas.map((c) => ({
        categoria: c.id,
        metaMensal: Math.max(0, Number(draftMetas[c.id] ?? c.orcamentoSugeridoMensal) || 0),
        alertaPercentual: 85,
      }))
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
                    type="number"
                    step="100"
                    min="0"
                    value={draftMetas[row.id] ?? row.meta}
                    onChange={(e) =>
                      setDraftMetas((prev) => ({ ...prev, [row.id]: Math.max(0, Number(e.target.value) || 0) }))
                    }
                    style={{
                      width: 105,
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
  onSaveFornecedor: (f: Partial<FornecedorEscolar>) => Promise<FornecedorEscolar | null>
  onDeleteFornecedor: (id: string) => Promise<void>
}

export function FornecedoresEscolaresTab({
  fornecedores,
  contas,
  centrosCusto,
  planoContas,
  onSaveFornecedor,
  onDeleteFornecedor,
}: FornecedoresEscolaresTabProps) {
  const listaCentrosCusto = useMemo(
    () => (Array.isArray(centrosCusto) && centrosCusto.length > 0 ? centrosCusto : CENTROS_CUSTO_ESCOLARES),
    [centrosCusto]
  )
  const opcoesPlanoContas = useMemo(() => {
    if (Array.isArray(planoContas) && planoContas.length > 0) {
      const despesasFirst = [...planoContas].sort((a, b) => {
        if (a.grupoConta === 'receitas' && b.grupoConta !== 'receitas') return 1
        if (a.grupoConta !== 'receitas' && b.grupoConta === 'receitas') return -1
        return 0
      })
      return despesasFirst.map((p) => ({ id: p.label, label: p.label }))
    }
    return CATEGORIAS_ESCOLARES.map((c) => ({ id: c.id, label: c.label }))
  }, [planoContas])
  const [busca, setBusca] = useState('')
  const [editing, setEditing] = useState<Partial<FornecedorEscolar> | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

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
            onClick={() =>
              setEditing({
                nome: '',
                nomeFantasia: '',
                documento: '',
                categoriaPadrao: opcoesPlanoContas[0]?.id || CATEGORIAS_ESCOLARES[0].id,
                centroCustoPadrao: '',
                formaPagamentoPadrao: 'PIX',
                chavePix: '',
                telefone: '',
                email: '',
              })
            }
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
              type="text"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={editing.documento || ''}
              onChange={(e) => setEditing({ ...editing, documento: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            />
          </div>
          <div>
            <label htmlFor="f-edit-cat" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Plano de Contas Padrão
            </label>
            <select
              id="f-edit-cat"
              value={editing.categoriaPadrao || opcoesPlanoContas[0]?.id || CATEGORIAS_ESCOLARES[0].id}
              onChange={(e) => setEditing({ ...editing, categoriaPadrao: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            >
              {opcoesPlanoContas.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-edit-cc" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Centro de Custo Padrão
            </label>
            <select
              id="f-edit-cc"
              value={editing.centroCustoPadrao ?? ''}
              onChange={(e) => setEditing({ ...editing, centroCustoPadrao: e.target.value })}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', fontSize: 12 }}
            >
              <option value="">---------</option>
              {listaCentrosCusto.map((cc: any) => (
                <option key={cc.id} value={cc.id}>{cc.label} ({cc.sigla})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-edit-pix" style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Chave PIX
            </label>
            <input
              id="f-edit-pix"
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
              onClick={() => setEditing(null)}
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
                  onClick={() => setEditing(f)}
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

            <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 700 }}>{f.categoriaPadrao}</div>

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
// 3. ABA DE TEMPLATES RECORRENTES ESCOLARES (GERADOR 1-CLIQUE)
// ═══════════════════════════════════════════════════════════════════════════
interface RecorrentesTemplatesTabProps {
  onGerarDespesaTemplate: (tpl: (typeof TEMPLATES_DESPESAS_ESCOLARES)[number], competencia: string) => Promise<void>
  onGerarLoteMensalFixo: (competencia: string) => Promise<void>
}

export function RecorrentesTemplatesTab({
  onGerarDespesaTemplate,
  onGerarLoteMensalFixo,
}: RecorrentesTemplatesTabProps) {
  const [competenciaAlvo, setCompetenciaAlvo] = useState(() => new Date().toISOString().slice(0, 7))
  const [generating, setGenerating] = useState(false)

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
            Matriz de Contratos Fixos & Gerador de Despesas Recorrentes Escolares
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#475569' }}>
            Gere os compromissos mensais recorrentes da escola (Folha, Encargos, Utilidades, Sistema de Ensino, Limpeza, Impostos) com 1 clique
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        {TEMPLATES_DESPESAS_ESCOLARES.map((tpl) => (
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase' }}>
                  Todo dia {String(tpl.diaVencimento).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>{tpl.formaPagamento}</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{tpl.titulo}</div>
              <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 700, marginTop: 4 }}>{tpl.categoria}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>Segmento: {tpl.centroCusto}</div>
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
        ))}
      </div>
    </div>
  )
}
