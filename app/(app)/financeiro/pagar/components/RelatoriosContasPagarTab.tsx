'use client'

import React, { useState, useMemo } from 'react'
import {
  BarChart3, PieChart as PieChartIcon, Building2, Clock,
  FileSpreadsheet, Printer, GraduationCap, Percent, FileText
} from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, ComposedChart, Line
} from 'recharts'
import * as XLSX from 'xlsx'
import { formatCurrency } from '@/lib/utils'
import {
  type ContaPagarRecord,
  type CentroCustoEscolarOption,
  type PlanoContasEscolarOption,
  CATEGORIAS_ESCOLARES,
  CENTROS_CUSTO_ESCOLARES,
  openPrintBorderoPagamentos,
} from '../types'

interface RelatoriosContasPagarTabProps {
  contas: ContaPagarRecord[]
  totalAlunosAtivos: number
  centrosCusto?: CentroCustoEscolarOption[]
  planoContas?: PlanoContasEscolarOption[]
}

type ReportType =
  | 'curva_abc_categorias'
  | 'centro_custo_aluno'
  | 'ranking_fornecedores'
  | 'aging_passivos'
  | 'evolucao_mensal'
  | 'retencoes_fiscais'
  | 'bordero_autorizacao'

const CHART_COLORS = [
  '#0284c7', '#7c3aed', '#059669', '#d97706', '#e11d48',
  '#0891b2', '#db2777', '#65a30d', '#4f46e5', '#0d9488',
]

export function RelatoriosContasPagarTab({
  contas,
  totalAlunosAtivos,
  centrosCusto,
  planoContas,
}: RelatoriosContasPagarTabProps) {
  const listaCentrosCusto = useMemo(
    () => (Array.isArray(centrosCusto) && centrosCusto.length > 0 ? centrosCusto : CENTROS_CUSTO_ESCOLARES),
    [centrosCusto]
  )
  const [activeReport, setActiveReport] = useState<ReportType>('curva_abc_categorias')
  const [regime, setRegime] = useState<'vencimento' | 'competencia' | 'caixa'>('vencimento')
  const [filtroCompetencia, setFiltroCompetencia] = useState<string>('todos')
  const [incluirCancelados] = useState(false)

  const competenciasDisponiveis = useMemo(() => {
    const set = new Set<string>()
    for (const c of contas) {
      if (c.competencia) set.add(c.competencia)
      else if (c.vencimento) set.add(c.vencimento.slice(0, 7))
    }
    return Array.from(set).sort().reverse()
  }, [contas])

  const contasBase = useMemo(() => {
    return contas.filter((c) => {
      if (!incluirCancelados && c.status === 'cancelado') return false
      if (regime === 'caixa' && c.status !== 'pago') return false
      if (filtroCompetencia !== 'todos') {
        const refMonth =
          regime === 'competencia'
            ? c.competencia || c.vencimento.slice(0, 7)
            : regime === 'caixa'
              ? (c.dataPagamento || c.vencimento).slice(0, 7)
              : c.vencimento.slice(0, 7)
        if (refMonth !== filtroCompetencia) return false
      }
      return true
    })
  }, [contas, regime, filtroCompetencia, incluirCancelados])

  const totalGeral = useMemo(
    () => contasBase.reduce((acc, c) => acc + (Number(c.valor) || 0), 0),
    [contasBase]
  )

  // ── 1. RELATÓRIO CURVA ABC POR CATEGORIA ESCOLAR ──────────────────────────
  const dadosCategorias = useMemo(() => {
    const map = new Map<
      string,
      {
        categoria: string
        grupoDre: string
        cor: string
        qtd: number
        valorBruto: number
        valorLiquido: number
        pago: number
        aberto: number
        vencido: number
      }
    >()

    for (const c of contasBase) {
      const planoMeta = planoContas?.find(
        (x) => x.id === c.planoContasId || x.label === c.categoria || x.descricao === c.categoria
      )
      const catMeta = CATEGORIAS_ESCOLARES.find((x) => x.id === c.categoria)
      const key = planoMeta?.label || c.categoria || 'Outros Custos Operacionais'
      const cur = map.get(key) || {
        categoria: key,
        grupoDre: planoMeta?.grupoDre || catMeta?.grupoDre || 'Despesas Operacionais',
        cor: planoMeta?.cor || catMeta?.cor || '#0284c7',
        qtd: 0,
        valorBruto: 0,
        valorLiquido: 0,
        pago: 0,
        aberto: 0,
        vencido: 0,
      }
      cur.qtd += 1
      cur.valorBruto += Number(c.valorBase || c.valor || 0)
      cur.valorLiquido += Number(c.valor || 0)
      if (c.status === 'pago') cur.pago += Number(c.valorPago || c.valor || 0)
      else {
        cur.aberto += Number(c.valor || 0)
        if (c.status === 'vencido') cur.vencido += Number(c.valor || 0)
      }
      map.set(key, cur)
    }

    const sorted = Array.from(map.values()).sort((a, b) => b.valorLiquido - a.valorLiquido)
    let acum = 0
    return sorted.map((item) => {
      const pct = totalGeral > 0 ? (item.valorLiquido / totalGeral) * 100 : 0
      acum += pct
      const classeAbc = acum <= 70 ? 'A' : acum <= 90 ? 'B' : 'C'
      return {
        ...item,
        percentual: Math.round(pct * 10) / 10,
        acumulado: Math.min(100, Math.round(acum * 10) / 10),
        classeAbc,
      }
    })
  }, [contasBase, totalGeral, planoContas])

  // ── 2. RELATÓRIO CENTRO DE CUSTO / SEGMENTO ESCOLAR & CUSTO POR ALUNO ─────
  const dadosCentroCusto = useMemo(() => {
    const map = new Map<
      string,
      {
        centroCusto: string
        sigla: string
        cor: string
        qtdLancamentos: number
        totalAlocado: number
        pagoAlocado: number
        abertoAlocado: number
        estimativaAlunosSegmento: number
      }
    >()

    const baseAlunos = Math.max(120, totalAlunosAtivos || 420)
    const pesoAlunosSegmento: Record<string, number> = {
      'Educação Infantil': Math.round(baseAlunos * 0.2),
      'Fundamental Anos Iniciais': Math.round(baseAlunos * 0.3),
      'Fundamental Anos Finais': Math.round(baseAlunos * 0.3),
      'Ensino Médio & Pré-Vestibular': Math.round(baseAlunos * 0.2),
      'Período Integral / Bilíngue': Math.round(baseAlunos * 0.15),
    }

    for (const c of contasBase) {
      const hasRateio = Array.isArray(c.rateio) && c.rateio.length > 0
      const allocations = hasRateio
        ? c.rateio!.map((r) => ({
            centro: r.centroCusto,
            valor: Number(r.valor) || ((Number(r.percentual) || 0) / 100) * c.valor,
          }))
        : [{ centro: c.centroCusto || 'Administração & Diretoria Geral', valor: Number(c.valor || 0) }]

      for (const aloc of allocations) {
        const meta = listaCentrosCusto.find((x) => x.id === aloc.centro)
        const cur = map.get(aloc.centro) || {
          centroCusto: aloc.centro,
          sigla: meta?.sigla || aloc.centro.slice(0, 4).toUpperCase(),
          cor: meta?.cor || '#0284c7',
          qtdLancamentos: 0,
          totalAlocado: 0,
          pagoAlocado: 0,
          abertoAlocado: 0,
          estimativaAlunosSegmento: pesoAlunosSegmento[aloc.centro] || baseAlunos,
        }
        cur.qtdLancamentos += 1
        cur.totalAlocado += aloc.valor
        if (c.status === 'pago') cur.pagoAlocado += aloc.valor
        else cur.abertoAlocado += aloc.valor
        map.set(aloc.centro, cur)
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.totalAlocado - a.totalAlocado)
      .map((item) => ({
        ...item,
        percentual: totalGeral > 0 ? Math.round((item.totalAlocado / totalGeral) * 1000) / 10 : 0,
        custoPorAluno:
          item.estimativaAlunosSegmento > 0
            ? Math.round((item.totalAlocado / item.estimativaAlunosSegmento) * 100) / 100
            : 0,
      }))
  }, [contasBase, totalGeral, totalAlunosAtivos, listaCentrosCusto])

  // ── 3. RELATÓRIO RANKING ABC DE FORNECEDORES / CREDORES ───────────────────
  const dadosFornecedores = useMemo(() => {
    const map = new Map<
      string,
      {
        fornecedor: string
        documento: string
        categoriaPrincipal: string
        qtdTitulos: number
        valorBruto: number
        retencoes: number
        valorLiquido: number
        pago: number
        emAberto: number
        vencido: number
      }
    >()

    for (const c of contasBase) {
      const key = (c.fornecedorNome || 'Fornecedor Não Identificado').trim()
      const cur = map.get(key) || {
        fornecedor: key,
        documento: c.fornecedorDocumento || '—',
        categoriaPrincipal: c.categoria,
        qtdTitulos: 0,
        valorBruto: 0,
        retencoes: 0,
        valorLiquido: 0,
        pago: 0,
        emAberto: 0,
        vencido: 0,
      }
      cur.qtdTitulos += 1
      cur.valorBruto += Number(c.valorBase || c.valor || 0)
      cur.retencoes += Number(c.retencaoImpostos || 0)
      cur.valorLiquido += Number(c.valor || 0)
      if (c.status === 'pago') cur.pago += Number(c.valorPago || c.valor || 0)
      else {
        cur.emAberto += Number(c.valor || 0)
        if (c.status === 'vencido') cur.vencido += Number(c.valor || 0)
      }
      map.set(key, cur)
    }

    return Array.from(map.values())
      .sort((a, b) => b.valorLiquido - a.valorLiquido)
      .map((f, idx) => ({
        posicao: idx + 1,
        ...f,
        share: totalGeral > 0 ? Math.round((f.valorLiquido / totalGeral) * 1000) / 10 : 0,
      }))
  }, [contasBase, totalGeral])

  // ── 4. RELATÓRIO AGING LIST DE PASSIVOS E CRONOGRAMA DE VENCIMENTOS ───────
  const dadosAging = useMemo(() => {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const faixas = [
      { id: 'venc_90', label: 'Vencido > 90 dias', tipo: 'Vencido Crítico', cor: '#be123c', qtd: 0, valor: 0, encargos: 0 },
      { id: 'venc_60', label: 'Vencido 31 a 90 dias', tipo: 'Vencido', cor: '#e11d48', qtd: 0, valor: 0, encargos: 0 },
      { id: 'venc_30', label: 'Vencido 16 a 30 dias', tipo: 'Vencido', cor: '#f43f5e', qtd: 0, valor: 0, encargos: 0 },
      { id: 'venc_15', label: 'Vencido 1 a 15 dias', tipo: 'Vencido Recente', cor: '#ea580c', qtd: 0, valor: 0, encargos: 0 },
      { id: 'hoje', label: 'Vence Hoje', tipo: 'Imediato', cor: '#d97706', qtd: 0, valor: 0, encargos: 0 },
      { id: 'avenc_7', label: 'A Vencer (1 a 7 dias)', tipo: 'Curto Prazo', cor: '#0284c7', qtd: 0, valor: 0, encargos: 0 },
      { id: 'avenc_15', label: 'A Vencer (8 a 15 dias)', tipo: 'Curto Prazo', cor: '#0891b2', qtd: 0, valor: 0, encargos: 0 },
      { id: 'avenc_30', label: 'A Vencer (16 a 30 dias)', tipo: 'Médio Prazo', cor: '#059669', qtd: 0, valor: 0, encargos: 0 },
      { id: 'avenc_mais', label: 'A Vencer (> 30 dias)', tipo: 'Longo Prazo', cor: '#7c3aed', qtd: 0, valor: 0, encargos: 0 },
    ]

    const abertas = contas.filter((c) => c.status !== 'pago' && c.status !== 'cancelado')
    for (const c of abertas) {
      const dt = new Date(`${c.vencimento}T00:00:00`)
      const diffDays = Math.round((dt.getTime() - hoje.getTime()) / 86400000)
      const enc = (Number(c.juros) || 0) + (Number(c.multa) || 0)

      let target = faixas[8]
      if (diffDays < -90) target = faixas[0]
      else if (diffDays < -30) target = faixas[1]
      else if (diffDays < -15) target = faixas[2]
      else if (diffDays < 0) target = faixas[3]
      else if (diffDays === 0) target = faixas[4]
      else if (diffDays <= 7) target = faixas[5]
      else if (diffDays <= 15) target = faixas[6]
      else if (diffDays <= 30) target = faixas[7]

      target.qtd += 1
      target.valor += Number(c.valor || 0)
      target.encargos += enc
    }

    return faixas
  }, [contas])

  // ── 5. RELATÓRIO EVOLUÇÃO MENSAL (FIXO vs VARIÁVEL & COMPETÊNCIA vs CAIXA) ─
  const dadosEvolucaoMensal = useMemo(() => {
    const map = new Map<
      string,
      {
        mes: string
        custoFixo: number
        custoVariavel: number
        investimento: number
        totalCompetencia: number
        totalPagoCaixa: number
        emAberto: number
      }
    >()

    for (const c of contas) {
      if (c.status === 'cancelado') continue
      const mes = c.competencia || c.vencimento.slice(0, 7)
      const cur = map.get(mes) || {
        mes,
        custoFixo: 0,
        custoVariavel: 0,
        investimento: 0,
        totalCompetencia: 0,
        totalPagoCaixa: 0,
        emAberto: 0,
      }
      const val = Number(c.valor || 0)
      cur.totalCompetencia += val
      if (c.tipoCusto === 'fixo') cur.custoFixo += val
      else if (c.tipoCusto === 'investimento') cur.investimento += val
      else cur.custoVariavel += val

      if (c.status === 'pago') cur.totalPagoCaixa += Number(c.valorPago || c.valor || 0)
      else cur.emAberto += val

      map.set(mes, cur)
    }

    return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes))
  }, [contas])

  // ── 6. RELATÓRIO FISCAL DE RETENÇÕES NA FONTE ─────────────────────────────
  const dadosRetencoes = useMemo(() => {
    return contasBase
      .filter((c) => (Number(c.retencaoImpostos) || 0) > 0)
      .map((c) => ({
        id: c.id,
        codigo: c.codigo || c.id,
        fornecedor: c.fornecedorNome,
        documentoCredor: c.fornecedorDocumento || '—',
        notaFiscal: c.notaFiscal || c.numeroDocumento || 'S/N',
        vencimento: c.vencimento,
        valorBruto: c.valorBase,
        iss: c.detalhesRetencao?.iss ?? c.retencaoImpostos,
        irrf: c.detalhesRetencao?.irrf ?? 0,
        inss: c.detalhesRetencao?.inss ?? 0,
        csrf: c.detalhesRetencao?.pisCofinsCsll ?? 0,
        totalRetido: c.retencaoImpostos,
        valorLiquido: c.valor,
        status: c.status,
      }))
  }, [contasBase])

  // ── 7. BORDERÔ DE AUTORIZAÇÃO DE PAGAMENTOS ───────────────────────────────
  const dadosBordero = useMemo(() => {
    return contasBase
      .filter((c) => c.status !== 'pago' && c.status !== 'cancelado')
      .sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''))
  }, [contasBase])

  // Exportação Universal para Excel (.xlsx) do Relatório Ativo
  const handleExportExcel = () => {
    let sheetData: Record<string, any>[] = []
    let sheetName = 'Relatorio_Contas_Pagar'

    if (activeReport === 'curva_abc_categorias') {
      sheetName = 'Curva_ABC_Categorias'
      sheetData = dadosCategorias.map((r) => ({
        'Classe ABC': r.classeAbc,
        'Categoria Escolar': r.categoria,
        'Grupo DRE': r.grupoDre,
        'Qtd. Títulos': r.qtd,
        'Valor Bruto (R$)': r.valorBruto,
        'Valor Líquido (R$)': r.valorLiquido,
        'Já Pago (R$)': r.pago,
        'Em Aberto (R$)': r.aberto,
        'Vencido (R$)': r.vencido,
        '% Participação': r.percentual,
        '% Acumulado': r.acumulado,
      }))
    } else if (activeReport === 'centro_custo_aluno') {
      sheetName = 'Rateio_Segmentos_Escolar'
      sheetData = dadosCentroCusto.map((r) => ({
        'Segmento / Centro de Custo': r.centroCusto,
        Sigla: r.sigla,
        'Qtd. Alocações': r.qtdLancamentos,
        'Total Alocado (R$)': r.totalAlocado,
        'Pago (R$)': r.pagoAlocado,
        'Em Aberto (R$)': r.abertoAlocado,
        '% do Total': r.percentual,
        'Alunos no Segmento (Base)': r.estimativaAlunosSegmento,
        'Custo por Aluno (R$)': r.custoPorAluno,
      }))
    } else if (activeReport === 'ranking_fornecedores') {
      sheetName = 'Ranking_Fornecedores'
      sheetData = dadosFornecedores.map((r) => ({
        Ranking: r.posicao,
        'Fornecedor / Credor': r.fornecedor,
        'CNPJ / CPF': r.documento,
        'Categoria Principal': r.categoriaPrincipal,
        'Qtd. Títulos': r.qtdTitulos,
        'Valor Bruto (R$)': r.valorBruto,
        'Retenções Fiscais (R$)': r.retencoes,
        'Valor Líquido (R$)': r.valorLiquido,
        'Pago (R$)': r.pago,
        'Em Aberto (R$)': r.emAberto,
        'Vencido (R$)': r.vencido,
        '% Share': r.share,
      }))
    } else if (activeReport === 'aging_passivos') {
      sheetName = 'Aging_Passivos_Vencimentos'
      sheetData = dadosAging.map((r) => ({
        'Faixa de Vencimento / Atraso': r.label,
        Classificação: r.tipo,
        'Qtd. Títulos': r.qtd,
        'Valor Total (R$)': r.valor,
        'Juros e Multas (R$)': r.encargos,
      }))
    } else if (activeReport === 'evolucao_mensal') {
      sheetName = 'Evolucao_Mensal_Despesas'
      sheetData = dadosEvolucaoMensal.map((r) => ({
        Competência: r.mes,
        'Custo Fixo (R$)': r.custoFixo,
        'Custo Variável (R$)': r.custoVariavel,
        'Investimentos CAPEX (R$)': r.investimento,
        'Total Competência (R$)': r.totalCompetencia,
        'Total Pago Caixa (R$)': r.totalPagoCaixa,
        'Saldo em Aberto (R$)': r.emAberto,
      }))
    } else if (activeReport === 'retencoes_fiscais') {
      sheetName = 'Retencoes_Fiscais_Fonte'
      sheetData = dadosRetencoes.map((r) => ({
        Código: r.codigo,
        Fornecedor: r.fornecedor,
        'CNPJ / CPF': r.documentoCredor,
        'Nota Fiscal / Doc': r.notaFiscal,
        Vencimento: r.vencimento,
        'Valor Bruto (R$)': r.valorBruto,
        'ISS Retido (R$)': r.iss,
        'IRRF Retido (R$)': r.irrf,
        'INSS Retido (R$)': r.inss,
        'PIS/COFINS/CSLL (R$)': r.csrf,
        'Total Retido (R$)': r.totalRetido,
        'Valor Líquido (R$)': r.valorLiquido,
      }))
    } else {
      sheetName = 'Bordero_Pagamentos'
      sheetData = dadosBordero.map((c) => ({
        Código: c.codigo || c.id,
        Vencimento: c.vencimento,
        Fornecedor: c.fornecedorNome,
        'CNPJ / CPF': c.fornecedorDocumento || '',
        Descrição: c.descricao,
        Categoria: c.categoria,
        'Centro de Custo': c.centroCusto,
        'Forma Pagamento': c.formaPagamento,
        'Chave PIX / Boleto': c.chavePix || c.linhaDigitavel || '',
        'Valor Líquido (R$)': c.valor,
        Alçada: c.aprovacaoStatus || 'aprovado',
      }))
    }

    const ws = XLSX.utils.json_to_sheet(sheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, `${sheetName}_${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const cardContainerStyle: React.CSSProperties = {
    borderRadius: 16,
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
    overflow: 'hidden',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Barra Superior de Seleção de Relatórios e Filtros de Regime (Light) */}
      <div
        style={{
          padding: 18,
          borderRadius: 18,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={18} color="#0284c7" />
              Central de Relatórios Executivos & Controladoria Escolar
            </h3>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b' }}>
              7 visões analíticas com exportação nativa para Excel (.xlsx) e emissão de Borderô Oficial de Pagamentos
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Seletor de Regime Contábil */}
            <div
              style={{
                display: 'flex',
                background: '#f1f5f9',
                padding: 3,
                borderRadius: 10,
                border: '1px solid #cbd5e1',
              }}
            >
              {[
                { id: 'vencimento', label: 'Por Vencimento' },
                { id: 'competencia', label: 'Por Competência (DRE)' },
                { id: 'caixa', label: 'Regime de Caixa (Pagos)' },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRegime(r.id as any)}
                  style={{
                    padding: '6px 11px',
                    borderRadius: 8,
                    border: 'none',
                    background: regime === r.id ? '#ffffff' : 'transparent',
                    color: regime === r.id ? '#0369a1' : '#475569',
                    fontSize: 11,
                    fontWeight: regime === r.id ? 800 : 600,
                    cursor: 'pointer',
                    boxShadow: regime === r.id ? '0 1px 3px rgba(15,23,42,0.08)' : 'none',
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {/* Filtro de Mês/Competência */}
            <select
              aria-label="Filtrar competência do relatório"
              value={filtroCompetencia}
              onChange={(e) => setFiltroCompetencia(e.target.value)}
              style={{
                padding: '7px 12px',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                color: '#0f172a',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <option value="todos">Todas as Competências</option>
              {competenciasDisponiveis.map((comp) => (
                <option key={comp} value={comp}>
                  Competência {comp}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleExportExcel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 10,
                background: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#047857',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <FileSpreadsheet size={14} />
              Exportar Relatório (.XLSX)
            </button>

            <button
              type="button"
              onClick={() =>
                openPrintBorderoPagamentos(
                  dadosBordero.length > 0 ? dadosBordero : contasBase,
                  filtroCompetencia === 'todos' ? 'Consolidado Geral' : `Competência ${filtroCompetencia}`
                )
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 10,
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                color: '#0369a1',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Printer size={14} />
              Imprimir Borderô de Autorização
            </button>
          </div>
        </div>

        {/* 7 Abas de Relatórios */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[
            { id: 'curva_abc_categorias', label: '1. Curva ABC por Plano de Contas', icon: <PieChartIcon size={14} /> },
            { id: 'centro_custo_aluno', label: '2. Rateio Segmentos & Custo/Aluno', icon: <GraduationCap size={14} /> },
            { id: 'ranking_fornecedores', label: '3. Ranking de Fornecedores', icon: <Building2 size={14} /> },
            { id: 'aging_passivos', label: '4. Aging List & Atrasos', icon: <Clock size={14} /> },
            { id: 'evolucao_mensal', label: '5. Evolução Fixo vs. Variável', icon: <BarChart3 size={14} /> },
            { id: 'retencoes_fiscais', label: `6. Retenções Fiscais (${dadosRetencoes.length})`, icon: <Percent size={14} /> },
            { id: 'bordero_autorizacao', label: `7. Borderô de Pagamentos (${dadosBordero.length})`, icon: <FileText size={14} /> },
          ].map((tab) => {
            const active = activeReport === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveReport(tab.id as ReportType)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 13px',
                  borderRadius: 10,
                  background: active ? '#eff6ff' : '#f8fafc',
                  border: active ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                  color: active ? '#1d4ed8' : '#475569',
                  fontSize: 12,
                  fontWeight: active ? 800 : 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* CONTEÚDO DO RELATÓRIO 1: CURVA ABC POR PLANO DE CONTAS */}
      {activeReport === 'curva_abc_categorias' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
            <div style={{ ...cardContainerStyle, padding: 18, height: 320 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
                Distribuição de Despesas por Plano de Contas (R$)
              </div>
              <ResponsiveContainer width="100%" height="88%">
                <BarChart data={dadosCategorias.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="categoria" stroke="#334155" fontSize={11} width={175} />
                  <Tooltip
                    formatter={(val: any) => formatCurrency(Number(val))}
                    contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10, color: '#0f172a' }}
                  />
                  <Bar dataKey="valorLiquido" name="Valor Líquido" radius={[0, 6, 6, 0]}>
                    {dadosCategorias.slice(0, 8).map((entry, idx) => (
                      <Cell key={idx} fill={entry.cor || CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ ...cardContainerStyle, padding: 18, height: 320 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
                Composição Percentual do Orçamento (Pareto ABC)
              </div>
              <ResponsiveContainer width="100%" height="88%">
                <PieChart>
                  <Pie
                    data={dadosCategorias.slice(0, 6)}
                    dataKey="valorLiquido"
                    nameKey="categoria"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={88}
                    paddingAngle={3}
                  >
                    {dadosCategorias.slice(0, 6).map((entry, index) => (
                      <Cell key={index} fill={entry.cor || CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => formatCurrency(Number(val))}
                    contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10, color: '#0f172a' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#334155' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={cardContainerStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 14px' }}>Curva</th>
                  <th style={{ padding: '12px 14px' }}>Plano de Contas</th>
                  <th style={{ padding: '12px 14px' }}>Grupo DRE</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Títulos</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Pago (R$)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Em Aberto (R$)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Líquido (R$)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>% Share</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>% Acum.</th>
                </tr>
              </thead>
              <tbody>
                {dadosCategorias.map((row) => (
                  <tr key={row.categoria} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontWeight: 800,
                          fontSize: 11,
                          background:
                            row.classeAbc === 'A'
                              ? '#fff1f2'
                              : row.classeAbc === 'B'
                                ? '#fffbeb'
                                : '#ecfdf5',
                          color:
                            row.classeAbc === 'A' ? '#be123c' : row.classeAbc === 'B' ? '#b45309' : '#047857',
                          border:
                            row.classeAbc === 'A'
                              ? '1px solid #fecdd3'
                              : row.classeAbc === 'B'
                                ? '1px solid #fde68a'
                                : '1px solid #a7f3d0',
                        }}
                      >
                        Classe {row.classeAbc}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{row.categoria}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>{row.grupoDre}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#334155', fontWeight: 700 }}>{row.qtd}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#047857', fontWeight: 700 }}>
                      {formatCurrency(row.pago)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#b45309', fontWeight: 700 }}>
                      {formatCurrency(row.aberto)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#0f172a', fontWeight: 800 }}>
                      {formatCurrency(row.valorLiquido)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#0369a1', fontWeight: 700 }}>
                      {row.percentual.toFixed(1)}%
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#64748b' }}>
                      {row.acumulado.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO DO RELATÓRIO 2: RATEIO POR SEGMENTO ESCOLAR & CUSTO POR ALUNO */}
      {activeReport === 'centro_custo_aluno' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            {dadosCentroCusto.map((seg) => (
              <div
                key={seg.centroCusto}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderTop: `4px solid ${seg.cor}`,
                  boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: seg.cor, textTransform: 'uppercase' }}>
                    {seg.sigla} • {seg.percentual}%
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{seg.qtdLancamentos} alocações</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginTop: 4 }}>{seg.centroCusto}</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', marginTop: 8 }}>
                  {formatCurrency(seg.totalAlocado)}
                </div>
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: '#64748b',
                  }}
                >
                  <span>Custo Médio / Aluno:</span>
                  <strong style={{ color: '#0369a1' }}>{formatCurrency(seg.custoPorAluno)}/aluno</strong>
                </div>
              </div>
            ))}
          </div>

          <div style={cardContainerStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 14px' }}>Segmento / Centro de Custo</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Alocações (c/ Rateio)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Liquidado (R$)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Em Aberto (R$)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Custo Total Alocado (R$)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>% do Custo Escolar</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Custo Médio por Aluno</th>
                </tr>
              </thead>
              <tbody>
                {dadosCentroCusto.map((row) => (
                  <tr key={row.centroCusto} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>
                      <span style={{ color: row.cor, marginRight: 6 }}>●</span>
                      {row.centroCusto}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#334155', fontWeight: 700 }}>{row.qtdLancamentos}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#047857', fontWeight: 700 }}>
                      {formatCurrency(row.pagoAlocado)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#b45309', fontWeight: 700 }}>
                      {formatCurrency(row.abertoAlocado)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#0f172a', fontWeight: 800 }}>
                      {formatCurrency(row.totalAlocado)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#0369a1', fontWeight: 700 }}>
                      {row.percentual}%
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#6d28d9', fontWeight: 800 }}>
                      {formatCurrency(row.custoPorAluno)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO DO RELATÓRIO 3: RANKING DE FORNECEDORES */}
      {activeReport === 'ranking_fornecedores' && (
        <div style={cardContainerStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 14px' }}>#</th>
                <th style={{ padding: '12px 14px' }}>Fornecedor / Credor Escolar</th>
                <th style={{ padding: '12px 14px' }}>CNPJ / CPF</th>
                <th style={{ padding: '12px 14px' }}>Categoria Principal</th>
                <th style={{ padding: '12px 14px', textAlign: 'center' }}>Títulos</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Retenções (R$)</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Pago (R$)</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Em Aberto (R$)</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Líquido (R$)</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>% Share</th>
              </tr>
            </thead>
            <tbody>
              {dadosFornecedores.map((f) => (
                <tr key={f.fornecedor} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0369a1' }}>#{f.posicao}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>{f.fornecedor}</td>
                  <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'monospace' }}>{f.documento}</td>
                  <td style={{ padding: '10px 14px', color: '#334155' }}>{f.categoriaPrincipal}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'center', color: '#334155', fontWeight: 700 }}>{f.qtdTitulos}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#b45309' }}>
                    {formatCurrency(f.retencoes)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#047857', fontWeight: 700 }}>
                    {formatCurrency(f.pago)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: f.vencido > 0 ? '#be123c' : '#475569', fontWeight: 700 }}>
                    {formatCurrency(f.emAberto)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#0f172a', fontWeight: 900 }}>
                    {formatCurrency(f.valorLiquido)}
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', color: '#0369a1', fontWeight: 700 }}>
                    {f.share}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CONTEÚDO DO RELATÓRIO 4: AGING LIST DE PASSIVOS E ATRASOS */}
      {activeReport === 'aging_passivos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...cardContainerStyle, padding: 18, height: 300 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
              Escalonamento de Passivos por Faixa de Vencimento e Atraso (Aging List)
            </div>
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={dadosAging}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" stroke="#334155" fontSize={10} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val: any) => formatCurrency(Number(val))}
                  contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10, color: '#0f172a' }}
                />
                <Bar dataKey="valor" name="Saldo na Faixa" radius={[6, 6, 0, 0]}>
                  {dadosAging.map((entry, idx) => (
                    <Cell key={idx} fill={entry.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={cardContainerStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 14px' }}>Faixa de Vencimento / Atraso</th>
                  <th style={{ padding: '12px 14px' }}>Classificação de Risco</th>
                  <th style={{ padding: '12px 14px', textAlign: 'center' }}>Qtd. Títulos</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Encargos Juros/Multa (R$)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Volume Financeiro (R$)</th>
                </tr>
              </thead>
              <tbody>
                {dadosAging.map((row) => (
                  <tr key={row.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>
                      <span style={{ color: row.cor, marginRight: 8 }}>●</span>
                      {row.label}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#475569' }}>{row.tipo}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#0f172a' }}>{row.qtd}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#be123c' }}>
                      {formatCurrency(row.encargos)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      {formatCurrency(row.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO DO RELATÓRIO 5: EVOLUÇÃO MENSAL FIXO VS VARIÁVEL */}
      {activeReport === 'evolucao_mensal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ ...cardContainerStyle, padding: 18, height: 320 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', marginBottom: 12 }}>
              Evolução Mensal: Custos Fixos vs. Variáveis vs. Desembolso Efetivo de Caixa
            </div>
            <ResponsiveContainer width="100%" height="88%">
              <ComposedChart data={dadosEvolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="mes" stroke="#334155" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(val: any) => formatCurrency(Number(val))}
                  contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 10, color: '#0f172a' }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="custoFixo" name="Custo Fixo" stackId="a" fill="#4f46e5" />
                <Bar dataKey="custoVariavel" name="Custo Variável" stackId="a" fill="#d97706" />
                <Bar dataKey="investimento" name="Investimentos CAPEX" stackId="a" fill="#059669" radius={[6, 6, 0, 0]} />
                <Line type="monotone" dataKey="totalPagoCaixa" name="Liquidado (Caixa)" stroke="#0284c7" strokeWidth={3} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={cardContainerStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 14px' }}>Competência</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Custos Fixos</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Custos Variáveis</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Investimentos (CAPEX)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Competência</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Efetivo Pago (Caixa)</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Saldo em Aberto</th>
                </tr>
              </thead>
              <tbody>
                {dadosEvolucaoMensal.map((m) => (
                  <tr key={m.mes} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0369a1' }}>{m.mes}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#334155' }}>{formatCurrency(m.custoFixo)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#334155' }}>{formatCurrency(m.custoVariavel)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#334155' }}>{formatCurrency(m.investimento)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#0f172a' }}>
                      {formatCurrency(m.totalCompetencia)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#047857' }}>
                      {formatCurrency(m.totalPagoCaixa)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#b45309' }}>
                      {formatCurrency(m.emAberto)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CONTEÚDO DO RELATÓRIO 6: RETENÇÕES FISCAIS NA FONTE */}
      {activeReport === 'retencoes_fiscais' && (
        <div style={cardContainerStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 14px' }}>NF / Doc</th>
                <th style={{ padding: '12px 14px' }}>Fornecedor Prestador</th>
                <th style={{ padding: '12px 14px' }}>CNPJ</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Valor Bruto</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>ISS Fonte</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>IRRF</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>INSS 11%</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>CSRF 4,65%</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Total Retido</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Valor Líquido</th>
              </tr>
            </thead>
            <tbody>
              {dadosRetencoes.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>
                    Nenhuma retenção fiscal na fonte encontrada para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                dadosRetencoes.map((r) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0369a1' }}>{r.notaFiscal}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>{r.fornecedor}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontFamily: 'monospace' }}>{r.documentoCredor}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#334155' }}>{formatCurrency(r.valorBruto)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#b45309' }}>{formatCurrency(r.iss)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#b45309' }}>{formatCurrency(r.irrf)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#b45309' }}>{formatCurrency(r.inss)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#b45309' }}>{formatCurrency(r.csrf)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#d97706' }}>
                      {formatCurrency(r.totalRetido)}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, color: '#047857' }}>
                      {formatCurrency(r.valorLiquido)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CONTEÚDO DO RELATÓRIO 7: BORDERÔ DE AUTORIZAÇÃO DE PAGAMENTOS */}
      {activeReport === 'bordero_autorizacao' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div
            style={{
              padding: 16,
              borderRadius: 14,
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                Borderô Oficial de Autorização de Remessa & Pagamentos ({dadosBordero.length} títulos em aberto)
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                Soma total para liberação bancária:{' '}
                <strong style={{ color: '#0369a1' }}>
                  {formatCurrency(dadosBordero.reduce((a, b) => a + b.valor, 0))}
                </strong>
              </div>
            </div>
            <button
              type="button"
              onClick={() => openPrintBorderoPagamentos(dadosBordero, 'Borderô Oficial de Pagamentos')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '10px 16px',
                borderRadius: 10,
                background: '#0284c7',
                border: 'none',
                color: '#ffffff',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              <Printer size={15} />
              Gerar Documento Assinável pela Diretoria
            </button>
          </div>

          <div style={cardContainerStyle}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '12px 14px' }}>Vencimento</th>
                  <th style={{ padding: '12px 14px' }}>Credor / Favorecido</th>
                  <th style={{ padding: '12px 14px' }}>Descrição da Despesa</th>
                  <th style={{ padding: '12px 14px' }}>Meio / PIX / Boleto</th>
                  <th style={{ padding: '12px 14px' }}>Alçada</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Valor Líquido (R$)</th>
                </tr>
              </thead>
              <tbody>
                {dadosBordero.map((c) => (
                  <tr key={c.id} style={{ borderTop: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                      {c.vencimento?.split('-').reverse().join('/')}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>{c.fornecedorNome}</td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>{c.descricao}</td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>
                      {c.formaPagamento} {c.chavePix ? `• PIX: ${c.chavePix}` : ''}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 700,
                          background: c.aprovacaoStatus === 'pendente_aprovacao' ? '#fffbeb' : '#ecfdf5',
                          color: c.aprovacaoStatus === 'pendente_aprovacao' ? '#b45309' : '#047857',
                          border: c.aprovacaoStatus === 'pendente_aprovacao' ? '1px solid #fde68a' : '1px solid #a7f3d0',
                        }}
                      >
                        {c.aprovacaoStatus === 'pendente_aprovacao' ? 'Pendente Diretoria' : 'Aprovado'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 900, color: '#0f172a' }}>
                      {formatCurrency(c.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
