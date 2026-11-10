'use client'

import React, { useState, useMemo, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Target, Save, Plus, Trash2, Building2, Repeat, Copy, Check,
  Sparkles, Edit3, Search, X, Upload, Download, FileSpreadsheet,
  CheckCircle2, AlertCircle
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

function normalizeKey(str: string): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

function normalizeSearchStr(str: string): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function formatCnpjCpf(raw: any): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  const digits = s.replace(/\D/g, '')
  if (/[./-]/.test(s) && (digits.length === 11 || digits.length === 14)) {
    return s
  }
  if (digits.length === 11) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
  }
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`
  }
  return s
}

function inferTipoPix(chave: string): string {
  const s = String(chave || '').trim()
  if (!s) return 'CNPJ'
  if (s.includes('@')) return 'E-mail'
  const digits = s.replace(/\D/g, '')
  if (digits.length === 14) return 'CNPJ'
  if (digits.length === 11) return 'CPF'
  if (digits.length >= 10 && digits.length <= 13) return 'Telefone'
  return 'Aleatória'
}

function parseNaturezaCusto(raw: any): ContaPagarTipoCusto {
  const n = normalizeSearchStr(String(raw ?? ''))
  if (!n) return 'fixo'
  if (n.includes('variav')) return 'variavel'
  if (n.includes('invest') || n.includes('capex')) return 'investimento'
  if (n.includes('extra')) return 'extraordinario'
  return 'fixo'
}

function formatNaturezaCustoLabel(tipo?: ContaPagarTipoCusto): string {
  if (tipo === 'variavel') return 'Custo Variável'
  if (tipo === 'investimento') return 'Investimento / CAPEX'
  if (tipo === 'extraordinario') return 'Extraordinário'
  return 'Custo Fixo'
}

export function isFornecedoresSpreadsheet(rows: Record<string, any>[]): boolean {
  if (!Array.isArray(rows) || rows.length === 0) return false
  const keys = Object.keys(rows[0] || {}).map(normalizeKey)
  const hasSupplierCol = keys.some(
    (k) =>
      k.includes('RAZAO SOCIAL') ||
      k.includes('PLANO DE CONTAS PADRAO') ||
      k.includes('UNIDADE / EMPRESA PADRAO') ||
      k.includes('CENTRO DE CUSTO PADRAO') ||
      k.includes('NATUREZA DO CUSTO')
  )
  const hasLancamentoCol = keys.some(
    (k) => k === 'VENCIMENTO' || k.includes('VALOR LIQUIDO') || k.includes('VALOR BRUTO')
  )
  return hasSupplierCol && !hasLancamentoCol
}

export function parseFornecedoresRows(
  rawRows: Record<string, any>[],
  context: {
    planoContas?: PlanoContasEscolarOption[]
    centrosCusto?: any[]
    unidades?: UnidadeEmpresaEscolarOption[]
  }
): { items: Partial<FornecedorEscolar>[]; errors: string[] } {
  const listaCentrosCusto =
    Array.isArray(context.centrosCusto) && context.centrosCusto.length > 0
      ? context.centrosCusto
      : CENTROS_CUSTO_ESCOLARES
  const listaUnidades = Array.isArray(context.unidades) ? context.unidades : []
  const opcoesPlanoContas =
    Array.isArray(context.planoContas) && context.planoContas.length > 0
      ? context.planoContas.map((p) => ({
          id: p.label,
          codPlano: p.codPlano || '',
          descricao: p.descricao || p.label,
          label: p.label,
        }))
      : CATEGORIAS_ESCOLARES.map((c) => ({
          id: c.id,
          codPlano: '',
          descricao: c.label,
          label: c.label,
        }))

  const items: Partial<FornecedorEscolar>[] = []
  const errors: string[] = []

  rawRows.forEach((rawRow, idx) => {
    const lineNum = idx + 2
    const norm: Record<string, any> = {}
    let hasAnyValue = false

    for (const [k, v] of Object.entries(rawRow || {})) {
      const valStr = String(v ?? '').trim()
      if (valStr !== '') hasAnyValue = true
      norm[normalizeKey(k)] = v
    }

    if (!hasAnyValue) return

    const pick = (...candidates: string[]): string => {
      for (const c of candidates) {
        const val = norm[c]
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return String(val).trim()
        }
      }
      return ''
    }

    const nome = pick(
      'RAZAO SOCIAL / NOME',
      'RAZAO SOCIAL',
      'NOME / RAZAO SOCIAL',
      'NOME',
      'FORNECEDOR',
      'CREDOR',
      'EMPRESA',
      'PRESTADOR'
    )

    if (!nome) {
      errors.push(`Linha ${lineNum}: Coluna "Razão Social / Nome *" está vazia (linha ignorada).`)
      return
    }

    const nomeFantasia =
      pick('NOME FANTASIA', 'FANTASIA', 'APELIDO') || nome

    const rawDoc = pick(
      'CNPJ / CPF',
      'CNPJ/CPF',
      'CPF / CNPJ',
      'CPF/CNPJ',
      'CNPJ',
      'CPF',
      'DOCUMENTO'
    )
    const documento = formatCnpjCpf(rawDoc)

    // Resolução inteligente do Plano de Contas Padrão
    const rawPlano = pick(
      'PLANO DE CONTAS PADRAO',
      'PLANO DE CONTAS',
      'CATEGORIA PADRAO',
      'CATEGORIA',
      'CONTA CONTABIL',
      'CODIGO PLANO'
    )
    let categoriaPadrao = ''
    if (rawPlano) {
      const qPlano = normalizeSearchStr(rawPlano)
      const codePrefix = rawPlano.split(/[\s—–-]+/)[0]?.trim() || ''
      const matchedPlano =
        opcoesPlanoContas.find(
          (p) =>
            normalizeSearchStr(p.id) === qPlano ||
            normalizeSearchStr(p.label) === qPlano ||
            normalizeSearchStr(p.descricao) === qPlano ||
            (p.codPlano && normalizeSearchStr(p.codPlano) === qPlano) ||
            (p.codPlano && normalizeSearchStr(`${p.codPlano} - ${p.descricao}`) === qPlano)
        ) ||
        (codePrefix
          ? opcoesPlanoContas.find(
              (p) => p.codPlano && normalizeSearchStr(p.codPlano) === normalizeSearchStr(codePrefix)
            )
          : undefined) ||
        opcoesPlanoContas.find((p) => normalizeSearchStr(p.label).includes(qPlano))

      categoriaPadrao = matchedPlano ? matchedPlano.id : rawPlano
    }

    // Resolução inteligente do Centro de Custo Padrão
    const rawCc = pick(
      'CENTRO DE CUSTO PADRAO',
      'CENTRO DE CUSTO',
      'SEGMENTO / CENTRO DE CUSTO',
      'SEGMENTO',
      'DEPARTAMENTO',
      'SETOR'
    )
    let centroCustoPadrao = ''
    let matchedCcObj: any = undefined
    if (rawCc) {
      const qCc = normalizeSearchStr(rawCc)
      matchedCcObj = listaCentrosCusto.find((cc: any) => {
        const idNorm = normalizeSearchStr(cc.id || '')
        const labelNorm = normalizeSearchStr(cc.label || '')
        const siglaNorm = normalizeSearchStr(cc.sigla || '')
        const codNorm = normalizeSearchStr(cc.codigo || '')
        const comboNorm = normalizeSearchStr(`${cc.label} (${cc.sigla})`)
        return (
          idNorm === qCc ||
          labelNorm === qCc ||
          siglaNorm === qCc ||
          codNorm === qCc ||
          comboNorm === qCc ||
          labelNorm.includes(qCc)
        )
      })
      centroCustoPadrao = matchedCcObj ? matchedCcObj.id : rawCc
    }

    // Resolução inteligente da Unidade / Empresa Padrão
    const rawUnidade = pick(
      'UNIDADE / EMPRESA PADRAO',
      'UNIDADE / EMPRESA',
      'UNIDADE PADRAO',
      'UNIDADE',
      'EMPRESA PADRAO',
      'MANTENEDORA',
      'FILIAL'
    )
    let unidadePadrao = ''
    if (rawUnidade) {
      const qUni = normalizeSearchStr(rawUnidade)
      const matchedUni = listaUnidades.find(
        (u) =>
          normalizeSearchStr(u.nome) === qUni ||
          normalizeSearchStr(u.label) === qUni ||
          normalizeSearchStr(u.id) === qUni ||
          (u.codigo && normalizeSearchStr(u.codigo) === qUni) ||
          (u.cnpj && u.cnpj.replace(/\D/g, '') === rawUnidade.replace(/\D/g, '') && rawUnidade.replace(/\D/g, '').length >= 11) ||
          normalizeSearchStr(u.label).includes(qUni)
      )
      unidadePadrao = matchedUni ? matchedUni.nome : rawUnidade
    } else if (matchedCcObj?.unidadeId) {
      const matchedUniFromCc = listaUnidades.find(
        (u) => u.id === matchedCcObj.unidadeId || u.nome === matchedCcObj.unidadeId
      )
      if (matchedUniFromCc) unidadePadrao = matchedUniFromCc.nome
    } else if (listaUnidades.length === 1) {
      unidadePadrao = listaUnidades[0].nome
    }

    // Natureza do Custo
    const rawNatureza = pick(
      'NATUREZA DO CUSTO',
      'NATUREZA CUSTO',
      'NATUREZA',
      'TIPO DE CUSTO',
      'TIPO CUSTO'
    )
    const tipoCustoPadrao = parseNaturezaCusto(rawNatureza)

    // Chave PIX e campos complementares
    const chavePix = pick('CHAVE PIX', 'PIX', 'CHAVE_PIX')
    const formaPagamentoPadrao =
      pick(
        'FORMA DE PAGAMENTO PADRAO',
        'FORMA DE PAGAMENTO',
        'FORMA PAGAMENTO',
        'METODO DE PAGAMENTO'
      ) || 'PIX'
    const telefone = pick('TELEFONE', 'CELULAR', 'FONE', 'WHATSAPP', 'CONTATO TELEFONE')
    const email = pick('E-MAIL', 'EMAIL')
    const contatoNome = pick('CONTATO', 'NOME CONTATO', 'RESPONSAVEL')
    const banco = pick('BANCO')
    const agencia = pick('AGENCIA')
    const contaCorrente = pick('CONTA CORRENTE', 'CONTA')
    const observacoes = pick('OBSERVACOES', 'OBS')

    items.push({
      nome,
      nomeFantasia,
      documento,
      categoriaPadrao,
      unidadePadrao,
      centroCustoPadrao,
      tipoCustoPadrao,
      chavePix,
      tipoPix: inferTipoPix(chavePix || documento),
      formaPagamentoPadrao,
      telefone,
      email,
      contatoNome,
      banco,
      agencia,
      contaCorrente,
      observacoes,
      ativo: true,
    })
  })

  return { items, errors }
}

export function downloadTemplateFornecedores(context: {
  planoContas?: PlanoContasEscolarOption[]
  centrosCusto?: any[]
  unidades?: UnidadeEmpresaEscolarOption[]
}) {
  const listaCentrosCusto =
    Array.isArray(context.centrosCusto) && context.centrosCusto.length > 0
      ? context.centrosCusto
      : CENTROS_CUSTO_ESCOLARES
  const listaUnidades = Array.isArray(context.unidades) ? context.unidades : []
  const opcoesPlano =
    Array.isArray(context.planoContas) && context.planoContas.length > 0
      ? context.planoContas.filter((p) => p.grupoConta !== 'receitas')
      : []

  const exPlano1 = opcoesPlano[0]?.label || '05.02.06 — Sistema'
  const exPlano2 = opcoesPlano[1]?.label || opcoesPlano[0]?.label || 'Utilidades (Energia, Água, Internet)'
  const exUnidade = listaUnidades[0]?.nome || ''
  const exCc1 = listaCentrosCusto[0]?.id || 'Administração & Diretoria Geral'
  const exCc2 = listaCentrosCusto[1]?.id || listaCentrosCusto[0]?.id || 'Infraestrutura, Limpeza & Segurança'

  const modeloRows = [
    {
      'Razão Social / Nome *': 'ClassAPP Tecnologia Educacional Ltda',
      'CNPJ / CPF': '12.345.678/0001-90',
      'Plano de Contas Padrão': exPlano1,
      'Unidade / Empresa Padrão': exUnidade,
      'Centro de Custo Padrão': exCc1,
      'Natureza do Custo': 'Custo Fixo',
      'Chave PIX': 'financeiro@classapp.com.br',
      'Nome Fantasia': 'ClassAPP',
      'Forma de Pagamento Padrão': 'PIX',
      Telefone: '(11) 4002-8922',
      'E-mail': 'cobranca@classapp.com.br',
      Observações: 'Fornecedor de plataforma de comunicação escolar',
    },
    {
      'Razão Social / Nome *': 'Concessionária de Energia Elétrica S.A.',
      'CNPJ / CPF': '04.895.728/0001-80',
      'Plano de Contas Padrão': exPlano2,
      'Unidade / Empresa Padrão': exUnidade,
      'Centro de Custo Padrão': exCc2,
      'Natureza do Custo': 'Custo Variável',
      'Chave PIX': '04.895.728/0001-80',
      'Nome Fantasia': 'Equatorial Energia',
      'Forma de Pagamento Padrão': 'Boleto Bancário',
      Telefone: '0800 091 0196',
      'E-mail': 'grandesclientes@energia.com.br',
      Observações: 'Fatura mensal de energia elétrica',
    },
  ]

  const wsModelo = XLSX.utils.json_to_sheet(modeloRows)
  wsModelo['!cols'] = [
    { wch: 38 }, // Razão Social / Nome *
    { wch: 20 }, // CNPJ / CPF
    { wch: 34 }, // Plano de Contas Padrão
    { wch: 28 }, // Unidade / Empresa Padrão
    { wch: 30 }, // Centro de Custo Padrão
    { wch: 20 }, // Natureza do Custo
    { wch: 28 }, // Chave PIX
    { wch: 24 }, // Nome Fantasia
    { wch: 24 }, // Forma de Pagamento Padrão
    { wch: 18 }, // Telefone
    { wch: 28 }, // E-mail
    { wch: 36 }, // Observações
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, wsModelo, 'Fornecedores')

  // Aba 2: Referências cadastradas no sistema para facilitar preenchimento
  const refRows: any[][] = [
    ['CAMPO DA PLANILHA', 'VALORES ACEITOS / OPÇÕES CADASTRADAS NO SISTEMA', 'OBRIGATÓRIO?'],
    ['Razão Social / Nome *', 'Nome completo ou Razão Social do fornecedor/credor', 'SIM'],
    ['CNPJ / CPF', 'CNPJ ou CPF com ou sem pontuação (ex: 12.345.678/0001-90)', 'Não'],
    ['Plano de Contas Padrão', 'Código ou nome da conta (veja lista abaixo)', 'Não'],
    ['Unidade / Empresa Padrão', 'Nome da Unidade/Matriz (veja lista abaixo)', 'Não'],
    ['Centro de Custo Padrão', 'Nome ou Sigla do Centro de Custo (veja lista abaixo)', 'Não'],
    ['Natureza do Custo', 'Custo Fixo | Custo Variável | Investimento / CAPEX | Extraordinário', 'Não (Padrão: Custo Fixo)'],
    ['Chave PIX', 'CPF, CNPJ, E-mail, Telefone ou Chave Aleatória', 'Não'],
    [],
    ['--- NATUREZAS DO CUSTO VÁLIDAS ---', '', ''],
    ['Custo Fixo', 'Despesas fixas recorrentes', ''],
    ['Custo Variável', 'Despesas variáveis conforme consumo/demanda', ''],
    ['Investimento / CAPEX', 'Obras, equipamentos e investimentos', ''],
    ['Extraordinário', 'Despesas eventuais não recorrentes', ''],
  ]

  if (listaUnidades.length > 0) {
    refRows.push([], ['--- UNIDADES / EMPRESAS CADASTRADAS ---', 'DESCRIÇÃO COMPLETA', 'CNPJ'])
    for (const u of listaUnidades) {
      refRows.push([u.nome, u.label, u.cnpj || ''])
    }
  }

  if (listaCentrosCusto.length > 0) {
    refRows.push([], ['--- CENTROS DE CUSTO CADASTRADOS ---', 'SIGLA', 'DESCRIÇÃO'])
    for (const cc of listaCentrosCusto) {
      refRows.push([cc.id, cc.sigla || '', cc.label || cc.id])
    }
  }

  if (opcoesPlano.length > 0) {
    refRows.push([], ['--- PLANOS DE CONTAS CADASTRADOS ---', 'CÓDIGO', 'DESCRIÇÃO'])
    for (const p of opcoesPlano) {
      refRows.push([p.label, p.codPlano || '', p.descricao || p.label])
    }
  }

  const wsRef = XLSX.utils.aoa_to_sheet(refRows)
  wsRef['!cols'] = [{ wch: 42 }, { wch: 52 }, { wch: 26 }]
  XLSX.utils.book_append_sheet(wb, wsRef, 'Opcoes_Cadastradas')

  XLSX.writeFile(wb, 'Modelo_Importacao_Fornecedores.xlsx')
}

export function exportFornecedoresExcel(fornecedores: FornecedorEscolar[]) {
  const hojeStr = new Date().toISOString().split('T')[0]
  const rows = fornecedores.map((f) => ({
    'Razão Social / Nome *': f.nome || '',
    'CNPJ / CPF': f.documento || '',
    'Plano de Contas Padrão': f.categoriaPadrao || '',
    'Unidade / Empresa Padrão': f.unidadePadrao || '',
    'Centro de Custo Padrão': f.centroCustoPadrao || '',
    'Natureza do Custo': formatNaturezaCustoLabel(f.tipoCustoPadrao),
    'Chave PIX': f.chavePix || '',
    'Nome Fantasia': f.nomeFantasia || f.nome || '',
    'Forma de Pagamento Padrão': f.formaPagamentoPadrao || 'PIX',
    Telefone: f.telefone || '',
    'E-mail': f.email || '',
    Banco: f.banco || '',
    Agência: f.agencia || '',
    'Conta Corrente': f.contaCorrente || '',
    Observações: f.observacoes || '',
  }))
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 38 },
    { wch: 20 },
    { wch: 34 },
    { wch: 28 },
    { wch: 30 },
    { wch: 20 },
    { wch: 28 },
    { wch: 24 },
    { wch: 24 },
    { wch: 18 },
    { wch: 28 },
    { wch: 20 },
    { wch: 14 },
    { wch: 18 },
    { wch: 36 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Fornecedores')
  XLSX.writeFile(wb, `Fornecedores_Impacto_${hojeStr}.xlsx`)
}

interface FornecedoresEscolaresTabProps {
  fornecedores: FornecedorEscolar[]
  contas: ContaPagarRecord[]
  centrosCusto?: any[]
  planoContas?: PlanoContasEscolarOption[]
  unidades?: UnidadeEmpresaEscolarOption[]
  onSaveFornecedor: (f: Partial<FornecedorEscolar>) => Promise<FornecedorEscolar | null>
  onImportFornecedores?: (
    lista: Partial<FornecedorEscolar>[]
  ) => Promise<{ importedCount: number; updatedCount: number } | null>
  onDeleteFornecedor: (id: string) => Promise<void>
}

export function FornecedoresEscolaresTab({
  fornecedores,
  contas,
  centrosCusto,
  planoContas,
  unidades,
  onSaveFornecedor,
  onImportFornecedores,
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
  const [filtroCentroCusto, setFiltroCentroCusto] = useState('todos')
  const [filtroNatureza, setFiltroNatureza] = useState('todas')
  const [ordenacao, setOrdenacao] = useState<'nome_asc' | 'pago_desc' | 'aberto_desc' | 'titulos_desc'>('nome_asc')
  const [editing, setEditing] = useState<Partial<FornecedorEscolar> | null>(null)
  const [savingFornecedor, setSavingFornecedor] = useState(false)
  const [importingExcel, setImportingExcel] = useState(false)
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'error'
    message: string
    details?: string[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [buscaPlanoFornecedor, setBuscaPlanoFornecedor] = useState('')
  const [showPlanoDropdown, setShowPlanoDropdown] = useState(false)
  const [filtroGrupoPlano, setFiltroGrupoPlano] = useState<'todos' | 'despesas' | 'investimentos' | 'receitas'>('todos')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null)

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
    const mapped = fornecedores
      .filter((f) => {
        if (filtroCentroCusto !== 'todos' && (f.centroCustoPadrao || '') !== filtroCentroCusto) {
          return false
        }
        if (filtroNatureza !== 'todas' && (f.tipoCustoPadrao || 'fixo') !== filtroNatureza) {
          return false
        }
        if (!q) return true
        return (
          f.nome.toLowerCase().includes(q) ||
          (f.nomeFantasia || '').toLowerCase().includes(q) ||
          (f.documento || '').toLowerCase().includes(q) ||
          (f.categoriaPadrao || '').toLowerCase().includes(q) ||
          (f.centroCustoPadrao || '').toLowerCase().includes(q) ||
          (f.unidadePadrao || '').toLowerCase().includes(q) ||
          (f.chavePix || '').toLowerCase().includes(q)
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

    return mapped.sort((a, b) => {
      if (ordenacao === 'pago_desc') return b.totalPago - a.totalPago
      if (ordenacao === 'aberto_desc') return b.totalAberto - a.totalAberto
      if (ordenacao === 'titulos_desc') return b.qtdTitulos - a.qtdTitulos
      return (a.nomeFantasia || a.nome || '').localeCompare(b.nomeFantasia || b.nome || '', 'pt-BR')
    })
  }, [fornecedores, contas, busca, filtroCentroCusto, filtroNatureza, ordenacao])

  const resumoFornecedores = useMemo(() => {
    let totalPago = 0
    let totalAberto = 0
    let comPix = 0
    for (const f of listaEnriquecida) {
      totalPago += f.totalPago
      totalAberto += f.totalAberto
      if (f.chavePix && f.chavePix.trim()) comPix += 1
    }
    return { totalPago, totalAberto, comPix }
  }, [listaEnriquecida])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing || !editing.nome?.trim() || savingFornecedor) return
    setSavingFornecedor(true)
    try {
      await onSaveFornecedor(editing)
      setEditing(null)
      setBuscaPlanoFornecedor('')
      setShowPlanoDropdown(false)
    } finally {
      setSavingFornecedor(false)
    }
  }

  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setImportFeedback(null)
    setImportingExcel(true)

    try {
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array' })
      const firstSheet = wb.Sheets[wb.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: '' })

      if (rawRows.length === 0) {
        setImportFeedback({
          type: 'error',
          message: 'A planilha enviada está vazia. Utilize o Modelo Excel para preencher os fornecedores.',
        })
        return
      }

      const { items, errors } = parseFornecedoresRows(rawRows, {
        planoContas,
        centrosCusto: listaCentrosCusto,
        unidades: listaUnidades,
      })

      if (items.length === 0) {
        setImportFeedback({
          type: 'error',
          message: 'Nenhum fornecedor válido encontrado na planilha.',
          details:
            errors.length > 0
              ? errors
              : ['Verifique se a coluna "Razão Social / Nome *" está preenchida.'],
        })
        return
      }

      if (onImportFornecedores) {
        const res = await onImportFornecedores(items)
        if (res) {
          const parts: string[] = []
          if (res.importedCount > 0) parts.push(`${res.importedCount} novo(s) cadastrado(s)`)
          if (res.updatedCount > 0) parts.push(`${res.updatedCount} atualizado(s)`)
          setImportFeedback({
            type: 'success',
            message: `Importação concluída: ${parts.join(' e ') || `${items.length} processado(s)`}!`,
            details: errors.length > 0 ? errors : undefined,
          })
        }
      } else {
        for (const item of items) {
          await onSaveFornecedor(item)
        }
        setImportFeedback({
          type: 'success',
          message: `${items.length} fornecedor(es) importado(s) com sucesso!`,
          details: errors.length > 0 ? errors : undefined,
        })
      }
    } catch {
      setImportFeedback({
        type: 'error',
        message: 'Falha ao ler o arquivo Excel (.xlsx/.csv). Verifique se utilizou o Modelo Excel.',
      })
    } finally {
      setImportingExcel(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* CSS da Lista/Tabela Ultra Moderna de Fornecedores (Responsive Table) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
          .forn-table-wrapper {
            width: 100%;
            max-inline-size: 100%;
            container-type: inline-size;
            overflow-x: auto;
            border-radius: 16px;
            background: #ffffff;
            border: 1px solid #e2e8f0;
            box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.05);
          }
          .forn-data-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 12.5px;
            color: #0f172a;
          }
          .forn-data-table thead {
            position: sticky;
            inset-block-start: 0;
            z-index: 2;
          }
          .forn-data-table thead th {
            background: #f8fafc;
            color: #475569;
            font-size: 10.5px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            padding: 11px 14px;
            text-align: left;
            border-bottom: 1.5px solid #e2e8f0;
            white-space: nowrap;
          }
          .forn-data-table tbody tr {
            background: #ffffff;
            transition: background-color 0.15s ease;
          }
          .forn-data-table tbody tr:hover {
            background: #f8fafc;
          }
          .forn-data-table tbody tr.forn-row-editing {
            background: #f0f9ff;
          }
          .forn-data-table tbody th {
            position: sticky;
            inset-inline-start: 0;
            z-index: 1;
            background: inherit;
            text-align: left;
            padding: 12px 14px;
            font-weight: 700;
            color: #0f172a;
            border-top: 1px solid #f1f5f9;
            vertical-align: middle;
          }
          .forn-data-table tbody td {
            padding: 12px 14px;
            border-top: 1px solid #f1f5f9;
            vertical-align: middle;
            color: #1e293b;
            background: inherit;
          }
          .forn-data-table tbody tr:first-child th,
          .forn-data-table tbody tr:first-child td {
            border-top: none;
          }
          @container (width < 780px) {
            .forn-data-table,
            .forn-data-table thead,
            .forn-data-table tbody,
            .forn-data-table tr,
            .forn-data-table th,
            .forn-data-table td {
              display: block;
            }
            .forn-data-table thead {
              display: none;
            }
            .forn-data-table tbody tr {
              margin: 10px;
              padding: 12px;
              border: 1px solid #e2e8f0;
              border-radius: 12px;
            }
            .forn-data-table tbody th {
              position: sticky;
              inset-block-start: 0;
              z-index: 2;
              padding: 4px 0 10px;
              border: none;
              border-bottom: 1px solid #f1f5f9;
              margin-bottom: 6px;
            }
            .forn-data-table tbody td {
              display: grid;
              grid-template-columns: 8.5rem 1fr;
              align-items: center;
              gap: 8px;
              padding: 6px 0;
              border: none;
              text-align: left !important;
            }
            .forn-data-table tbody td::before {
              content: var(--label) ": ";
              font-weight: 700;
              font-size: 11px;
              color: #64748b;
            }
          }
        `,
        }}
      />

      {/* Cabeçalho e Barra de Ações + Filtros Integrados */}
      <div
        style={{
          padding: '16px 20px',
          borderRadius: 16,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        {/* Linha 1: Título + Botões de Ação */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 11,
                background: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)',
                border: '1px solid #7dd3fc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#0369a1',
                flexShrink: 0,
              }}
            >
              <Building2 size={19} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 800, color: '#0f172a' }}>
                  Diretório de Fornecedores, Prestadores e Credores Escolares
                </h3>
                <span
                  style={{
                    padding: '2px 9px',
                    borderRadius: 99,
                    background: '#f0f9ff',
                    border: '1px solid #bae6fd',
                    color: '#0369a1',
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  {fornecedores.length} {fornecedores.length === 1 ? 'cadastrado' : 'cadastrados'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                Gerencie dados bancários, chaves PIX, CNPJ, unidade, centro de custo e plano de contas padrão de cada fornecedor
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              ref={fileInputRef}
              id="input-import-fornecedores-xlsx"
              type="file"
              accept=".xlsx,.xls,.csv"
              aria-label="Selecionar planilha Excel de fornecedores para importar"
              onChange={handleImportExcelFile}
              style={{
                position: 'absolute',
                clipPath: 'inset(50%)',
                overflow: 'hidden',
                width: 1,
                height: 1,
                margin: -1,
                padding: 0,
                border: 0,
                whiteSpace: 'nowrap',
              }}
            />

            <button
              type="button"
              onClick={() =>
                downloadTemplateFornecedores({
                  planoContas,
                  centrosCusto: listaCentrosCusto,
                  unidades: listaUnidades,
                })
              }
              title="Baixar planilha modelo (.xlsx) com os campos necessários e opções cadastradas"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 13px',
                borderRadius: 9,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Download size={14} color="#0284c7" />
              Modelo Excel
            </button>

            <button
              type="button"
              disabled={importingExcel}
              onClick={() => fileInputRef.current?.click()}
              title="Importar fornecedores a partir de planilha Excel (.xlsx, .xls, .csv)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 13px',
                borderRadius: 9,
                background: '#f0f9ff',
                border: '1px solid #7dd3fc',
                color: '#0369a1',
                fontSize: 12,
                fontWeight: 800,
                cursor: importingExcel ? 'wait' : 'pointer',
              }}
            >
              <Upload size={14} />
              {importingExcel ? 'Importando...' : 'Importar Excel'}
            </button>

            {fornecedores.length > 0 && (
              <button
                type="button"
                onClick={() => exportFornecedoresExcel(fornecedores)}
                title="Exportar lista atual de fornecedores para Excel (.xlsx)"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 13px',
                  borderRadius: 9,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#047857',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <FileSpreadsheet size={14} />
                Exportar
              </button>
            )}

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
                padding: '8px 15px',
                borderRadius: 9,
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(2, 132, 199, 0.2)',
              }}
            >
              <Plus size={15} />
              Novo Fornecedor
            </button>
          </div>
        </div>

        {/* Linha 2: Barra de Busca, Filtros Rápidos e KPIs da Lista */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 10,
            paddingTop: 12,
            borderTop: '1px solid #f1f5f9',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1 }}>
            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 380 }}>
              <Search
                size={14}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: 11,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#64748b',
                  pointerEvents: 'none',
                }}
              />
              <input
                aria-label="Buscar fornecedor escolar"
                type="text"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por nome, CNPJ/CPF, PIX ou plano de contas..."
                style={{
                  width: '100%',
                  padding: '8px 30px 8px 32px',
                  borderRadius: 9,
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#0f172a',
                  fontSize: 12,
                }}
              />
              {busca && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => setBusca('')}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: 2,
                    display: 'inline-flex',
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <select
              aria-label="Filtrar por Centro de Custo Padrão"
              value={filtroCentroCusto}
              onChange={(e) => setFiltroCentroCusto(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 9,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <option value="todos">Todos os Centros de Custo</option>
              {listaCentrosCusto.map((cc: any) => (
                <option key={cc.id} value={cc.id}>
                  {cc.label} ({cc.sigla})
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrar por Natureza do Custo"
              value={filtroNatureza}
              onChange={(e) => setFiltroNatureza(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 9,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <option value="todas">Todas as Naturezas</option>
              <option value="fixo">Custo Fixo</option>
              <option value="variavel">Custo Variável</option>
              <option value="investimento">Investimento / CAPEX</option>
              <option value="extraordinario">Extraordinário</option>
            </select>

            <select
              aria-label="Ordenar fornecedores"
              value={ordenacao}
              onChange={(e) => setOrdenacao(e.target.value as any)}
              style={{
                padding: '8px 10px',
                borderRadius: 9,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <option value="nome_asc">Ordem: A → Z</option>
              <option value="pago_desc">Maior Volume Pago</option>
              <option value="aberto_desc">Maior Saldo em Aberto</option>
              <option value="titulos_desc">Mais Lançamentos</option>
            </select>

            {(busca || filtroCentroCusto !== 'todos' || filtroNatureza !== 'todas') && (
              <button
                type="button"
                onClick={() => {
                  setBusca('')
                  setFiltroCentroCusto('todos')
                  setFiltroNatureza('todas')
                }}
                style={{
                  padding: '7px 11px',
                  borderRadius: 8,
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  color: '#be123c',
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Limpar Filtros
              </button>
            )}
          </div>

          {/* Resumo Rápido Financeiro dos Fornecedores Filtrados */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, flexWrap: 'wrap' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>
              Exibindo <strong style={{ color: '#0f172a' }}>{listaEnriquecida.length}</strong> • Com PIX:{' '}
              <strong style={{ color: '#0369a1' }}>{resumoFornecedores.comPix}</strong>
            </span>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontWeight: 700,
              }}
            >
              Pago: <strong>{formatCurrency(resumoFornecedores.totalPago)}</strong>
            </span>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                background: resumoFornecedores.totalAberto > 0 ? '#fffbeb' : '#f8fafc',
                border: `1px solid ${resumoFornecedores.totalAberto > 0 ? '#fde68a' : '#e2e8f0'}`,
                color: resumoFornecedores.totalAberto > 0 ? '#b45309' : '#475569',
                fontWeight: 700,
              }}
            >
              Em Aberto: <strong>{formatCurrency(resumoFornecedores.totalAberto)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Feedback de Importação de Fornecedores via Excel */}
      {importFeedback && (
        <div
          role="status"
          aria-live="polite"
          style={{
            padding: '14px 18px',
            borderRadius: 14,
            background: importFeedback.type === 'success' ? '#ecfdf5' : '#fff1f2',
            border: `1px solid ${importFeedback.type === 'success' ? '#a7f3d0' : '#fecdd3'}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            {importFeedback.type === 'success' ? (
              <CheckCircle2 size={18} color="#059669" style={{ marginTop: 1, flexShrink: 0 }} />
            ) : (
              <AlertCircle size={18} color="#e11d48" style={{ marginTop: 1, flexShrink: 0 }} />
            )}
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 13,
                  color: importFeedback.type === 'success' ? '#065f46' : '#9f1239',
                }}
              >
                {importFeedback.message}
              </div>
              {importFeedback.details && importFeedback.details.length > 0 && (
                <ul
                  style={{
                    margin: '6px 0 0',
                    paddingLeft: 18,
                    fontSize: 11.5,
                    color: '#475569',
                  }}
                >
                  {importFeedback.details.slice(0, 8).map((detail, idx) => (
                    <li key={idx}>{detail}</li>
                  ))}
                  {importFeedback.details.length > 8 && (
                    <li>...e mais {importFeedback.details.length - 8} ocorrência(s).</li>
                  )}
                </ul>
              )}
            </div>
          </div>
          <button
            type="button"
            aria-label="Fechar resumo da importação"
            onClick={() => setImportFeedback(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

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
              disabled={savingFornecedor}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                background: '#059669',
                border: 'none',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 12,
                cursor: savingFornecedor ? 'wait' : 'pointer',
                opacity: savingFornecedor ? 0.75 : 1,
              }}
            >
              {savingFornecedor ? 'Salvando...' : 'Salvar Fornecedor'}
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

      {/* Lista / Tabela Ultra Moderna de Fornecedores */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby="fornecedores-table-caption"
        className="forn-table-wrapper"
      >
        <table className="forn-data-table">
          <caption
            id="fornecedores-table-caption"
            style={{
              position: 'absolute',
              clipPath: 'inset(50%)',
              overflow: 'hidden',
              width: 1,
              height: 1,
              margin: -1,
              padding: 0,
              border: 0,
              whiteSpace: 'nowrap',
            }}
          >
            Diretório de Fornecedores, Prestadores e Credores Escolares
          </caption>
          <thead>
            <tr>
              <th style={{ width: '25%' }}>Fornecedor / Razão Social</th>
              <th style={{ width: '13%' }}>CNPJ / CPF</th>
              <th style={{ width: '20%' }}>Plano de Contas Padrão</th>
              <th style={{ width: '17%' }}>Centro de Custo & Natureza</th>
              <th style={{ width: '13%' }}>Chave PIX / Pagamento</th>
              <th style={{ width: '12%', textAlign: 'right' }}>Movimentação</th>
              <th style={{ width: 96, textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {listaEnriquecida.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: '42px 20px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontSize: 13,
                  }}
                >
                  Nenhum fornecedor encontrado para os filtros aplicados.
                </td>
              </tr>
            ) : (
              listaEnriquecida.map((f) => {
                const isEditingRow = Boolean(editing && editing.id && editing.id === f.id)
                const initials = (f.nomeFantasia || f.nome || 'F')
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0]?.toUpperCase() || '')
                  .join('')

                // Separa código e descrição do Plano de Contas se estiver no formato "05.02.06 — Sistema"
                const rawCat = f.categoriaPadrao || ''
                const catParts = rawCat.split(/\s*[—–-]\s*/)
                const hasPlanoCode = catParts.length > 1 && /^[\d.]+$/.test(catParts[0].trim())
                const planoCod = hasPlanoCode ? catParts[0].trim() : ''
                const planoDesc = hasPlanoCode ? catParts.slice(1).join(' — ').trim() : rawCat

                const tipoCustoKey = f.tipoCustoPadrao || 'fixo'
                const tipoCfg = TIPO_CUSTO_CONFIG[tipoCustoKey]
                const stripeColor =
                  tipoCustoKey === 'investimento'
                    ? '#2563eb'
                    : tipoCustoKey === 'variavel'
                      ? '#d97706'
                      : tipoCustoKey === 'extraordinario'
                        ? '#e11d48'
                        : '#0284c7'

                return (
                  <tr
                    key={f.id}
                    className={isEditingRow ? 'forn-row-editing' : undefined}
                  >
                    {/* 1. FORNECEDOR / RAZÃO SOCIAL (Sticky Row Header) */}
                    <th
                      scope="row"
                      style={{
                        borderLeft: `3.5px solid ${stripeColor}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                        <div
                          aria-hidden="true"
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
                            border: '1px solid #bae6fd',
                            color: '#0369a1',
                            fontSize: 11.5,
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {initials || 'F'}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 800,
                              color: '#0f172a',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={f.nome}
                          >
                            {f.nomeFantasia || f.nome}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 2,
                              flexWrap: 'wrap',
                            }}
                          >
                            {f.nomeFantasia &&
                              f.nome &&
                              f.nomeFantasia.trim().toLowerCase() !== f.nome.trim().toLowerCase() && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    color: '#64748b',
                                    fontWeight: 500,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    maxWidth: 210,
                                  }}
                                  title={f.nome}
                                >
                                  {f.nome}
                                </span>
                              )}
                            {f.unidadePadrao && (
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: '1px 6px',
                                  borderRadius: 5,
                                  background: '#f1f5f9',
                                  border: '1px solid #e2e8f0',
                                  color: '#475569',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                🏫 {f.unidadePadrao}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </th>

                    {/* 2. CNPJ / CPF */}
                    <td style={{ '--label': "'CNPJ / CPF'" } as React.CSSProperties}>
                      {f.documento ? (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(f.documento)
                            setCopiedDocId(f.id)
                            setTimeout(() => setCopiedDocId(null), 1600)
                          }}
                          title="Clique para copiar o CNPJ / CPF"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 8px',
                            borderRadius: 7,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#334155',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span>{f.documento}</span>
                          {copiedDocId === f.id ? (
                            <Check size={12} color="#059669" />
                          ) : (
                            <Copy size={11.5} color="#94a3b8" />
                          )}
                        </button>
                      ) : (
                        <span style={{ fontSize: 11.5, color: '#94a3b8', fontStyle: 'italic' }}>
                          Sem CNPJ/CPF
                        </span>
                      )}
                    </td>

                    {/* 3. PLANO DE CONTAS PADRÃO */}
                    <td style={{ '--label': "'Plano de Contas'" } as React.CSSProperties}>
                      {rawCat ? (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            minWidth: 0,
                          }}
                          title={rawCat}
                        >
                          {planoCod && (
                            <code
                              style={{
                                fontSize: 10.5,
                                fontWeight: 800,
                                color: '#0369a1',
                                background: '#e0f2fe',
                                border: '1px solid #bae6fd',
                                padding: '2px 6px',
                                borderRadius: 5,
                                flexShrink: 0,
                              }}
                            >
                              {planoCod}
                            </code>
                          )}
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#1e293b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {planoDesc}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11.5, color: '#94a3b8' }}>—</span>
                      )}
                    </td>

                    {/* 4. CENTRO DE CUSTO & NATUREZA */}
                    <td style={{ '--label': "'Centro de Custo'" } as React.CSSProperties}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        {f.centroCustoPadrao ? (
                          <span
                            style={{
                              fontSize: 10.5,
                              padding: '3px 8px',
                              borderRadius: 6,
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              color: '#1d4ed8',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            🎯 {f.centroCustoPadrao}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>Sem C. Custo</span>
                        )}

                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 7px',
                            borderRadius: 99,
                            background: '#f5f3ff',
                            border: '1px solid #ddd6fe',
                            color: '#6d28d9',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {tipoCfg?.label || formatNaturezaCustoLabel(f.tipoCustoPadrao)}
                        </span>
                      </div>
                    </td>

                    {/* 5. CHAVE PIX / FORMA DE PAGAMENTO */}
                    <td style={{ '--label': "'PIX / Pagamento'" } as React.CSSProperties}>
                      {f.chavePix ? (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(f.chavePix!)
                            setCopiedId(f.id)
                            setTimeout(() => setCopiedId(null), 1800)
                          }}
                          title={`Copiar Chave PIX: ${f.chavePix}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            maxWidth: 210,
                            padding: '4px 9px',
                            borderRadius: 7,
                            background: copiedId === f.id ? '#ecfdf5' : '#f0f9ff',
                            border: `1px solid ${copiedId === f.id ? '#6ee7b7' : '#bae6fd'}`,
                            color: copiedId === f.id ? '#047857' : '#0369a1',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {copiedId === f.id ? 'PIX Copiado!' : f.chavePix}
                          </span>
                          {copiedId === f.id ? (
                            <Check size={12} style={{ flexShrink: 0 }} />
                          ) : (
                            <Copy size={12} style={{ flexShrink: 0 }} />
                          )}
                        </button>
                      ) : (
                        <span
                          style={{
                            fontSize: 11,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            color: '#64748b',
                            fontWeight: 600,
                          }}
                        >
                          {f.formaPagamentoPadrao || 'PIX'}
                        </span>
                      )}
                    </td>

                    {/* 6. MOVIMENTAÇÃO FINANCEIRA (PAGO / EM ABERTO) */}
                    <td
                      style={
                        {
                          '--label': "'Movimentação'",
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                        } as React.CSSProperties
                      }
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: '#047857' }}>
                          Pago: {formatCurrency(f.totalPago)}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: f.totalAberto > 0 ? '#b45309' : '#64748b',
                          }}
                        >
                          Aberto: {formatCurrency(f.totalAberto)}
                          {f.qtdTitulos > 0 && (
                            <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                              {' '}• {f.qtdTitulos} tít.
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* 7. AÇÕES */}
                    <td
                      style={
                        {
                          '--label': "'Ações'",
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                        } as React.CSSProperties
                      }
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(f)
                            setBuscaPlanoFornecedor(f.categoriaPadrao || '')
                            setShowPlanoDropdown(false)
                            setFiltroGrupoPlano('todos')
                          }}
                          title={`Editar fornecedor ${f.nome}`}
                          aria-label={`Editar fornecedor ${f.nome}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '6px 10px',
                            borderRadius: 8,
                            background: isEditingRow ? '#0284c7' : '#f8fafc',
                            border: `1px solid ${isEditingRow ? '#0284c7' : '#cbd5e1'}`,
                            color: isEditingRow ? '#ffffff' : '#334155',
                            fontSize: 11.5,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          <Edit3 size={12.5} />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteFornecedor(f.id)}
                          title={`Excluir fornecedor ${f.nome}`}
                          aria-label={`Excluir fornecedor ${f.nome}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 30,
                            height: 30,
                            borderRadius: 8,
                            background: '#fff1f2',
                            border: '1px solid #fecdd3',
                            color: '#be123c',
                            cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
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
