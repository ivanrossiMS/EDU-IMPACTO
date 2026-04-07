'use client'

import { useData } from '@/lib/dataContext'
import { useState, useMemo, useCallback } from 'react'
import * as XLSX from 'xlsx'
import {
  buildDRE, fmtCur, fmtPct, sinalDisplay, MESES_PT,
  type LancamentoBruto, type FiltrosDRE, type GrupoDREResult, type LancamentoDRE
} from '@/lib/dreEngine'
import type { ConfigGrupoDRE } from '@/lib/dataContext'
import {
  Calendar, ChevronDown, ChevronRight, Download, Printer,
  Search, AlertCircle, Eye, TrendingUp, TrendingDown, BarChart3,
  ArrowUpRight, ArrowDownRight, Minus, X, Filter, RefreshCw, Info
} from 'lucide-react'

// ─── Cores semânticas ────────────────────────────────────────────
const COR_POSITIVO  = '#10b981'
const COR_NEGATIVO  = '#ef4444'
const COR_NEUTRO    = '#6b7280'
const COR_BLUE      = '#3b82f6'
const COR_TITULO    = '#8b5cf6'

type VisaoMode = 'sintetica' | 'analitica' | 'comparativa'

// ─── Helpers de UI ───────────────────────────────────────────────
const getResultColor = (valor: number): string =>
  valor > 0 ? COR_POSITIVO : valor < 0 ? COR_NEGATIVO : COR_NEUTRO

const getGroupColor = (grupo: ConfigGrupoDRE, valor: number): string => {
  if (grupo.corDestaque) return grupo.natureza === 'calculado' ? getResultColor(valor) : grupo.corDestaque
  return getResultColor(valor)
}

// ─── Componente Modal Drill-down ─────────────────────────────────
function DrillDownModal({
  titulo, lancamentos, cor, onClose
}: {
  titulo: string; lancamentos: LancamentoDRE[]; cor: string; onClose: () => void
}) {
  const total = lancamentos.reduce((s, l) => s + l.valor, 0)
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="card scrollbar-custom" style={{ width: '95%', maxWidth: 900, maxHeight: '92vh', overflowY: 'auto', borderTop: `4px solid ${cor}` }}
        onClick={e => e.stopPropagation()}>

        <div style={{ padding: '20px 24px', borderBottom: '1px solid hsl(var(--border-subtle))', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'hsl(var(--bg-base))', zIndex: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, color: cor, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              <Search size={11} style={{ marginRight: 4, verticalAlign: 'middle' }}/>Drill-down Analítico
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{titulo}</h3>
            <div style={{ fontSize: 13, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{lancamentos.length} lançamento(s) no período</div>
          </div>
          <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', fontWeight: 700 }}>Total do Grupo</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: cor, fontFamily: 'Outfit, sans-serif' }}>{fmtCur(total)}</div>
            </div>
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18}/></button>
          </div>
        </div>

        <div style={{ padding: '0 24px 24px' }}>
          {lancamentos.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
              <Info size={32} style={{ marginBottom: 8, opacity: 0.5 }}/>
              <div>Nenhum lançamento para exibir neste período.</div>
            </div>
          ) : (
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginTop: 16 }}>
              <thead>
                <tr style={{ background: 'hsl(var(--bg-elevated))', borderBottom: '2px solid hsl(var(--border-default))' }}>
                  {['Data', 'Histórico', 'Conta Contábil', 'Centro de Custo', 'Valor', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Valor' ? 'right' : 'left', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--text-muted))' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid hsl(var(--border-subtle))' }} className="hover-bg-light">
                    <td style={{ padding: '10px 12px', color: 'hsl(var(--text-muted))', whiteSpace: 'nowrap' }}>
                      {new Date((l.dataCompetencia || l.dataCaixa) + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: 'hsl(var(--text-primary))' }}>{l.descricao}</div>
                      <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))' }}>{l.referencia}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {l.planoContasCodigo ? (
                        <div>
                          <code style={{ fontSize: 10, background: 'rgba(59,130,246,0.12)', color: COR_BLUE, padding: '2px 6px', borderRadius: 4 }}>{l.planoContasCodigo}</code>
                          <div style={{ fontSize: 11, color: 'hsl(var(--text-muted))', marginTop: 2 }}>{l.planoContasNome}</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: COR_NEGATIVO }}>Sem conta</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                      {l.centroCustoId ? <code style={{ fontSize: 10, padding: '2px 5px', background: 'rgba(139,92,246,0.1)', color: COR_TITULO, borderRadius: 4 }}>{l.centroCustoId.slice(0, 8)}…</code> : '–'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: l.origem === 'despesa' ? COR_NEGATIVO : COR_POSITIVO }}>
                      {l.origem === 'despesa' ? '(' : ''}{fmtCur(l.valor)}{l.origem === 'despesa' ? ')' : ''}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`badge ${l.status === 'pago' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: 10 }}>{l.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'hsl(var(--bg-elevated))', borderTop: '2px solid hsl(var(--border-default))' }}>
                  <td colSpan={4} style={{ padding: '12px', fontWeight: 800, fontSize: 13 }}>Total do período</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, fontSize: 15, color: cor, fontFamily: 'Outfit, sans-serif' }}>{fmtCur(total)}</td>
                  <td/>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Linha da DRE (Sintética ou Analítica) ───────────────────────
function DREGrupoRow({
  grupoResult, visao, totalReceita, expandidos, onToggle, onDrillDown
}: {
  grupoResult: GrupoDREResult
  visao: VisaoMode
  totalReceita: number
  expandidos: Set<string>
  onToggle: (id: string) => void
  onDrillDown: (titulo: string, lancs: LancamentoDRE[], cor: string) => void
}) {
  const { grupo, valor, valorBruto, contas, lancamentosOrfaos } = grupoResult
  const isExpanded = expandidos.has(grupo.id)
  const isCalculado = grupo.natureza === 'calculado'
  const temDetalhes = !isCalculado && (contas.length > 0 || lancamentosOrfaos.length > 0)
  const cor = getGroupColor(grupo, valor)

  const isTotal = grupo.nivel === 'total'
  const isSubtotal = grupo.nivel === 'subtotal'
  const isGrupo = grupo.nivel === 'grupo'

  const avPct = totalReceita > 0 ? (Math.abs(valorBruto) / totalReceita * 100) : 0
  const displayVal = isCalculado
    ? (valor === 0 ? '–' : (valor < 0 ? `(${fmtCur(Math.abs(valor))})` : fmtCur(valor)))
    : (valorBruto === 0 ? '–' : (grupo.natureza === 'devedora' ? `(${fmtCur(valorBruto)})` : fmtCur(valorBruto)))

  const bgStyle: React.CSSProperties = isTotal
    ? { background: `${cor}18`, borderTop: `2px solid ${cor}50` }
    : isSubtotal
    ? { background: `${cor}08`, borderTop: `1px solid ${cor}30` }
    : {}

  return (
    <>
      <div className={`dre-print-row${temDetalhes && visao === 'analitica' ? ' hover-bg-light' : ''}`}
        style={{ ...bgStyle, borderBottom: '1px solid hsl(var(--border-subtle))', cursor: temDetalhes && visao === 'analitica' ? 'pointer' : 'default' }}
        onClick={() => temDetalhes && visao === 'analitica' && onToggle(grupo.id)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 80px 80px', padding: isTotal ? '14px 16px' : isSubtotal ? '11px 16px' : '9px 16px', alignItems: 'center' }}>

          {/* Nome */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {temDetalhes && visao === 'analitica' ? (
              isExpanded ? <ChevronDown size={14} color={cor}/> : <ChevronRight size={14} color={cor}/>
            ) : (
              <div style={{ width: 14 }}/>
            )}
            {(isTotal || isSubtotal) && (
              <div style={{ width: 4, height: 20, borderRadius: 2, background: cor, flexShrink: 0 }}/>
            )}
            <span style={{
              fontSize: isTotal ? 14 : isSubtotal ? 13 : 13,
              fontWeight: isTotal ? 800 : isSubtotal ? 700 : 500,
              color: isTotal || isSubtotal ? 'hsl(var(--text-primary))' : 'hsl(var(--text-secondary))',
              textTransform: isTotal || isSubtotal ? 'uppercase' : 'none',
              letterSpacing: isTotal || isSubtotal ? '0.04em' : 'normal',
            }}>
              {grupo.nome}
            </span>
          </div>

          {/* Valor período */}
          <div style={{ textAlign: 'right', fontWeight: isTotal ? 900 : isSubtotal ? 800 : 600, fontFamily: 'Outfit, sans-serif', fontSize: isTotal ? 17 : isSubtotal ? 15 : 13, color: cor }}>
            {displayVal}
          </div>

          {/* AV% Rec. Bruta */}
          <div style={{ textAlign: 'center', fontSize: 12, color: 'hsl(var(--text-muted))', fontFamily: 'monospace' }}>
            {!isCalculado && valorBruto !== 0 ? `${avPct.toFixed(1)}%` : ''}
          </div>

          {/* Ação drill-down */}
          <div style={{ textAlign: 'center' }}>
            {temDetalhes && (
              <button className="btn btn-ghost btn-icon btn-sm" title="Ver lançamentos"
                onClick={e => { e.stopPropagation(); onDrillDown(grupo.nome, [...contas.flatMap(c=>c.lancamentos), ...lancamentosOrfaos], cor) }}>
                <Eye size={12}/>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sub-linhas analíticas */}
      {isExpanded && visao === 'analitica' && (
        <>
          {contas.map(c => (
            <div key={c.planoContasId} className="hover-bg-light dre-print-row" style={{ borderBottom: '1px dashed hsl(var(--border-subtle))', cursor: 'pointer' }}
              onClick={() => onDrillDown(`${c.codPlano} – ${c.nome}`, c.lancamentos, cor)}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 80px 80px', padding: '7px 16px 7px 44px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ fontSize: 11, fontFamily: 'monospace', color: cor, fontWeight: 700, minWidth: 48 }}>{c.codPlano}</code>
                  <span style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{c.nome}</span>
                  <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>({c.lancamentos.length})</span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'Outfit, sans-serif', fontSize: 13, color: 'hsl(var(--text-primary))' }}>
                  {grupo.natureza === 'devedora' ? `(${fmtCur(c.valor)})` : fmtCur(c.valor)}
                </div>
                <div style={{ textAlign: 'center', fontSize: 11, color: 'hsl(var(--text-muted))' }}>
                  {totalReceita > 0 ? `${(c.valor / totalReceita * 100).toFixed(1)}%` : ''}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <Eye size={11} color="hsl(var(--text-muted))"/>
                </div>
              </div>
            </div>
          ))}
          {lancamentosOrfaos.length > 0 && (
            <div className="hover-bg-light dre-print-row" style={{ borderBottom: '1px dashed hsl(var(--border-subtle))', cursor: 'pointer' }}
              onClick={() => onDrillDown(`Sem conta vinculada – ${grupo.nome}`, lancamentosOrfaos, COR_NEUTRO)}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 80px 80px', padding: '7px 16px 7px 44px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertCircle size={12} color={COR_NEGATIVO}/>
                  <span style={{ fontSize: 12, color: COR_NEGATIVO, fontStyle: 'italic' }}>Lançamentos sem conta contábil ({lancamentosOrfaos.length})</span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'Outfit, sans-serif', fontSize: 13, color: COR_NEGATIVO }}>
                  {fmtCur(lancamentosOrfaos.reduce((s,l)=>s+l.valor,0))}
                </div>
                <div/><div/>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

// ─── Componente Principal ─────────────────────────────────────────
export default function DREPage() {
  const { cfgPlanoContas, cfgGruposDRE, dreConfig, setDreConfig, cfgCentrosCusto, titulos, contasPagar, movimentacoesManuais } = useData()

  const isLoading = false  // dados vêm do contexto local (localStorage) — sincrono

  // ─── Estado da UI ──────────────────────────────────────────────
  const [filtros, setFiltros] = useState<FiltrosDRE>({
    regime: dreConfig.regimeApuracao,
    ano: new Date().getFullYear(),
    mes: new Date().getMonth(),
    exibirZerados: dreConfig.exibirZerados,
  })
  const [filtroMesComp, setFiltroMesComp] = useState(new Date().getMonth() - 1 < 0 ? 11 : new Date().getMonth() - 1)
  const [filtroAnoComp, setFiltroAnoComp] = useState(new Date().getFullYear())
  const [visao, setVisao] = useState<VisaoMode>('sintetica')
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [drillDown, setDrillDown] = useState<{ titulo: string; lancamentos: LancamentoDRE[]; cor: string } | null>(null)
  const [mostraPendencias, setMostraPendencias] = useState(false)

  const toggleExpand = useCallback((id: string) =>
    setExpandidos(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n }), [])
  const expandAll = () => setExpandidos(new Set(cfgGruposDRE.map(g => g.id)))
  const collapseAll = () => setExpandidos(new Set())

  // ─── Converter lançamentos para formato do engine ──────────────
  const lancamentosBrutos = useMemo<LancamentoBruto[]>(() => {
    const docs: LancamentoBruto[] = []

    // Contas a Receber (Títulos)
    titulos.forEach(t => {
      docs.push({
        id: t.id, origem: 'receita',
        valor: t.valor || 0,
        dataCompetencia: t.vencimento || '',
        dataCaixa: t.pagamento || '',
        status: t.status || 'pendente',
        planoContasId: (t as any).planoContasId,
        descricao: t.descricao || 'Recebimento',
        referencia: t.aluno || t.responsavel || 'Avulso',
        centroCustoId: (t as any).centroCustoId,
        documento: (t as any).numeroDocumento,
      })
    })

    // Contas a Pagar
    contasPagar.forEach(c => {
      docs.push({
        id: c.id, origem: 'despesa',
        valor: c.valor || 0,
        dataCompetencia: c.vencimento || '',
        dataCaixa: c.status === 'pago' ? c.vencimento : '',
        status: c.status || 'pendente',
        planoContasId: c.planoContasId,
        descricao: c.descricao || 'Pagamento',
        referencia: c.fornecedor || 'Diversos',
        centroCustoId: c.centroCustoId,
        documento: c.numeroDocumento,
      })
    })

    // Movimentações Manuais do Caixa
    movimentacoesManuais.forEach(m => {
      docs.push({
        id: m.id, origem: m.tipo,
        valor: m.valor || 0,
        dataCompetencia: m.dataLancamento || '',
        dataCaixa: m.dataMovimento || m.dataLancamento || '',
        status: 'pago',  // movimentações manuais são sempre efetivadas
        planoContasId: m.planoContasId,
        descricao: m.descricao || 'Movimentação Manual',
        referencia: m.fornecedorNome || 'Avulso',
        centroCustoId: undefined,
        documento: m.numeroDocumento,
      })
    })

    return docs
  }, [titulos, contasPagar, movimentacoesManuais])


  // ─── Motor da DRE ─────────────────────────────────────────────
  const dreResult = useMemo(() =>
    buildDRE(lancamentosBrutos, cfgPlanoContas, cfgGruposDRE, filtros),
    [lancamentosBrutos, cfgPlanoContas, cfgGruposDRE, filtros]
  )

  // DRE Comparativa
  const dreComparativo = useMemo(() => {
    if (visao !== 'comparativa') return null
    return buildDRE(lancamentosBrutos, cfgPlanoContas, cfgGruposDRE, {
      ...filtros, mes: filtroMesComp, ano: filtroAnoComp
    })
  }, [lancamentosBrutos, cfgPlanoContas, cfgGruposDRE, filtros, filtroMesComp, filtroAnoComp, visao])

  // ─── KPIs Executivos ──────────────────────────────────────────
  const kpis = [
    { label: 'Receita Bruta', val: dreResult.receitaBruta, cor: COR_POSITIVO, icon: <TrendingUp size={16}/> },
    { label: 'Receita Líquida', val: dreResult.receitaLiquida, cor: COR_BLUE, icon: <ArrowUpRight size={16}/> },
    { label: 'Lucro Bruto', val: dreResult.lucroBruto, cor: dreResult.lucroBruto >= 0 ? COR_POSITIVO : COR_NEGATIVO, icon: <BarChart3 size={16}/> },
    { label: 'Res. Operacional', val: dreResult.resultadoOperacional, cor: dreResult.resultadoOperacional >= 0 ? COR_BLUE : COR_NEGATIVO, icon: <ArrowUpRight size={16}/> },
    { label: 'Lucro Líquido', val: dreResult.lucroLiquido, cor: dreResult.lucroLiquido >= 0 ? COR_POSITIVO : COR_NEGATIVO, icon: dreResult.lucroLiquido >= 0 ? <TrendingUp size={16}/> : <TrendingDown size={16}/> },
    { label: 'Mg. Bruta %', val: dreResult.margemBruta, cor: dreResult.margemBruta >= 20 ? COR_POSITIVO : COR_NEGATIVO, isPerc: true, icon: <Minus size={16}/> },
    { label: 'Mg. Operacional %', val: dreResult.margemOperacional, cor: dreResult.margemOperacional >= 10 ? COR_POSITIVO : COR_NEGATIVO, isPerc: true, icon: <Minus size={16}/> },
    { label: 'Mg. Líquida %', val: dreResult.margemLiquida, cor: dreResult.margemLiquida >= 5 ? COR_POSITIVO : COR_NEGATIVO, isPerc: true, icon: <Minus size={16}/> },
    { label: 'Total Despesas', val: dreResult.totalDespesas, cor: COR_NEGATIVO, icon: <ArrowDownRight size={16}/> },
    { label: 'Lançamentos', val: dreResult.totalLancamentos, cor: 'hsl(var(--text-muted))', isInt: true, icon: <Filter size={16}/> },
  ]

  // ─── Exportação Excel ─────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new()
    const rows: any[][] = [
      ['DRE GERENCIAL', '', ''],
      [`Período: ${filtros.mes === -1 ? 'Acumulado' : MESES_PT[filtros.mes]} / ${filtros.ano}`, `Regime: ${filtros.regime.toUpperCase()}`, `Emissão: ${new Date().toLocaleDateString('pt-BR')}`],
      [],
      ['ESTRUTURA DA DRE', 'VALOR (R$)', 'A.V. % Rec. Bruta'],
    ]

    dreResult.grupos.forEach(g => {
      const val = g.grupo.natureza === 'calculado' ? g.valor : g.valorBruto
      const avPct = dreResult.receitaBruta > 0 ? (Math.abs(val) / dreResult.receitaBruta * 100).toFixed(1) + '%' : '–'
      rows.push([g.grupo.nome, g.grupo.natureza === 'devedora' ? -g.valorBruto : val, avPct])

      if (visao === 'analitica') {
        g.contas.forEach(c => {
          rows.push([`  ${c.codPlano} – ${c.nome}`, g.grupo.natureza === 'devedora' ? -c.valor : c.valor, ''])
        })
      }
    })

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 50 }, { wch: 22 }, { wch: 20 }]
    XLSX.utils.book_append_sheet(wb, ws, 'DRE_Gerencial')
    XLSX.writeFile(wb, `DRE_${filtros.ano}_${filtros.mes !== -1 ? MESES_PT[filtros.mes] : 'Acumulado'}.xlsx`)
  }

  const handlePrint = () => { expandAll(); setTimeout(() => window.print(), 400) }

  // ─── Render ───────────────────────────────────────────────────
  const periodoLabel = filtros.mes === -1 ? `${filtros.ano} (Acumulado)` : `${MESES_PT[filtros.mes]} / ${filtros.ano}`

  return (
    <div className="dre-print-base" style={{ paddingBottom: 40 }}>

      {/* ─── Header ─────────────────────────────────────────── */}
      <div className="page-header print-hide">
        <div>
          <h1 className="page-title">DRE Gerencial</h1>
          <p className="page-subtitle">Demonstrativo do Resultado do Exercício · {periodoLabel} · Regime de {filtros.regime === 'caixa' ? 'Caixa' : 'Competência'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {dreResult.contasSemGrupoDRE.length > 0 && (
            <button className="btn btn-sm" style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b50' }}
              onClick={() => setMostraPendencias(p => !p)}>
              <AlertCircle size={13}/> {dreResult.contasSemGrupoDRE.length} Pendência(s)
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}><Printer size={13}/> PDF</button>
          <button className="btn btn-secondary btn-sm" onClick={exportExcel}><Download size={13}/> Excel</button>
        </div>
      </div>

      {/* ─── Pendências (alerta configuração) ───────────────── */}
      {mostraPendencias && dreResult.contasSemGrupoDRE.length > 0 && (
        <div className="card print-hide" style={{ marginBottom: 16, border: '1px solid #f59e0b40', background: '#f59e0b08' }}>
          <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f59e0b', fontWeight: 700, fontSize: 13 }}>
              <AlertCircle size={16}/>
              {dreResult.contasSemGrupoDRE.length} conta(s) analítica(s) sem grupo DRE definido — os lançamentos dessas contas irão para "Não Classificados"
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setMostraPendencias(false)}><X size={14}/></button>
          </div>
          <div style={{ padding: '0 16px 14px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {dreResult.contasSemGrupoDRE.map(c => (
              <code key={c.id} style={{ fontSize: 11, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', padding: '3px 8px', borderRadius: 6, border: '1px solid #f59e0b30' }}>
                {c.codPlano} – {c.descricao}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* ─── Filtros ─────────────────────────────────────────── */}
      <div className="card print-hide" style={{ padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={15} color={COR_BLUE}/>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Período</span>
        </div>

        <select className="form-input" style={{ width: 140, fontSize: 13 }} value={filtros.mes}
          onChange={e => setFiltros(p => ({ ...p, mes: parseInt(e.target.value) }))}>
          <option value={-1}>Acumulado (Anual)</option>
          {MESES_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
        </select>

        <select className="form-input" style={{ width: 88, fontSize: 13 }} value={filtros.ano}
          onChange={e => setFiltros(p => ({ ...p, ano: parseInt(e.target.value) }))}>
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>

        <div style={{ width: 1, height: 28, background: 'hsl(var(--border-subtle))' }}/>

        <select className="form-input" style={{ width: 140, fontSize: 13 }} value={filtros.regime}
          onChange={e => { const v = e.target.value as any; setFiltros(p => ({ ...p, regime: v })); setDreConfig(p => ({ ...p, regimeApuracao: v, updatedAt: new Date().toISOString() })) }}>
          <option value="caixa">Regime de Caixa</option>
          <option value="competencia">Competência</option>
        </select>

        <select className="form-input" style={{ width: 140, fontSize: 13 }}
          value={filtros.centroCustoId || ''}
          onChange={e => setFiltros(p => ({ ...p, centroCustoId: e.target.value }))}>
          <option value="">Todos os Centros</option>
          {cfgCentrosCusto.filter(cc => cc.situacao === 'ativo').map(cc => (
            <option key={cc.id} value={cc.id}>{cc.descricao}</option>
          ))}
        </select>

        <div style={{ width: 1, height: 28, background: 'hsl(var(--border-subtle))' }}/>

        {/* Visão */}
        <div style={{ display: 'flex', gap: 4, background: 'hsl(var(--bg-elevated))', borderRadius: 8, padding: 3, border: '1px solid hsl(var(--border-subtle))' }}>
          {(['sintetica', 'analitica', 'comparativa'] as VisaoMode[]).map(v => (
            <button key={v} className={`btn btn-sm ${visao === v ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6 }}
              onClick={() => setVisao(v)}>
              {v === 'sintetica' ? 'Sintética' : v === 'analitica' ? 'Analítica' : 'Comparativa'}
            </button>
          ))}
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={filtros.exibirZerados} onChange={e => setFiltros(p => ({ ...p, exibirZerados: e.target.checked }))}/>
            Exibir zerados
          </label>
          {visao === 'analitica' && (
            <>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={expandAll}>Expandir tudo</button>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={collapseAll}>Recolher</button>
            </>
          )}
        </div>
      </div>

      {/* ─── KPIs Executivos ─────────────────────────────────── */}
      <div className="print-hide" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 20 }}>
        {kpis.map((k, i) => (
          <div key={i} className="kpi-card" style={{ borderLeft: `4px solid ${k.cor}`, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 8, right: 10, opacity: 0.12, color: k.cor }}>{k.icon}</div>
            <div style={{ fontSize: 10, color: 'hsl(var(--text-muted))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: k.isInt ? 22 : 18, fontWeight: 900, color: k.cor, fontFamily: 'Outfit, sans-serif', lineHeight: 1 }}>
              {k.isInt ? k.val : k.isPerc ? `${(k.val as number).toFixed(1)}%` : fmtCur(k.val as number)}
            </div>
          </div>
        ))}
      </div>

      {/* Spinner */}
      {isLoading && (
        <div style={{ textAlign: 'center', padding: 24, color: 'hsl(var(--text-muted))' }} className="print-hide">
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 8px', display: 'block' }}/>
          Carregando dados financeiros...
        </div>
      )}

      {/* ─── Modo Comparativo ────────────────────────────────── */}
      {visao === 'comparativa' && (
        <div className="card print-hide" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Comparar com:</span>
          <select className="form-input" style={{ width: 140, fontSize: 13 }} value={filtroMesComp}
            onChange={e => setFiltroMesComp(parseInt(e.target.value))}>
            <option value={-1}>Acumulado</option>
            {MESES_PT.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select className="form-input" style={{ width: 88, fontSize: 13 }} value={filtroAnoComp}
            onChange={e => setFiltroAnoComp(parseInt(e.target.value))}>
            {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      )}

      {/* ─── Tabela DRE Principal ────────────────────────────── */}
      <div className="card" style={{ borderTop: `4px solid ${COR_BLUE}`, overflow: 'hidden', marginBottom: 20 }}>
        {/* Cabeçalho da tabela */}
        <div style={{ display: 'grid', gridTemplateColumns: visao === 'comparativa' ? '1fr 160px 130px 80px 80px' : '1fr 160px 80px 80px', background: 'hsl(var(--bg-elevated))', padding: '12px 16px', fontSize: 11, fontWeight: 800, color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '2px solid hsl(var(--border-default))' }}>
          <div>Estrutura da DRE</div>
          <div style={{ textAlign: 'right' }}>{periodoLabel}</div>
          {visao === 'comparativa' && dreComparativo && (
            <div style={{ textAlign: 'right' }}>{filtroMesComp === -1 ? filtroAnoComp : `${MESES_PT[filtroMesComp].slice(0,3)}/${filtroAnoComp}`}</div>
          )}
          <div style={{ textAlign: 'center' }}>AV%</div>
          <div style={{ textAlign: 'center' }}>Ação</div>
        </div>

        {/* Separador de seção impresso */}
        <div className="only-print-header" style={{ display: 'none', padding: '8px 16px', background: '#f8f8f8', borderBottom: '1px solid #ddd', fontSize: 11, fontWeight: 700 }}>
          DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO (DRE) · {periodoLabel} · Regime: {filtros.regime.toUpperCase()}
        </div>

        {/* Linhas */}
        {dreResult.grupos.length === 0 && !isLoading && (
          <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
            <BarChart3 size={40} style={{ opacity: 0.3, marginBottom: 12, display: 'block', margin: '0 auto 12px' }}/>
            <div style={{ fontWeight: 600 }}>Nenhum lançamento encontrado no período</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Ajuste os filtros ou certifique-se de que há lançamentos cadastrados.</div>
          </div>
        )}

        {dreResult.grupos.map(gr => (
          <div key={gr.grupo.id}>
            {visao === 'comparativa' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 130px 80px 80px', padding: gr.grupo.nivel === 'total' ? '14px 16px' : gr.grupo.nivel === 'subtotal' ? '11px 16px' : '9px 16px', alignItems: 'center', borderBottom: '1px solid hsl(var(--border-subtle))', background: gr.grupo.nivel === 'total' ? `${getGroupColor(gr.grupo, gr.valor)}18` : 'transparent' }}>
                <span style={{ fontSize: gr.grupo.nivel === 'total' ? 14 : 13, fontWeight: gr.grupo.nivel === 'total' ? 800 : gr.grupo.nivel === 'subtotal' ? 700 : 500, paddingLeft: gr.grupo.nivel === 'grupo' ? 22 : 0 }}>
                  {gr.grupo.nome}
                </span>
                <span style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit, sans-serif', color: getGroupColor(gr.grupo, gr.valor) }}>
                  {gr.grupo.natureza === 'calculado' ? (gr.valor < 0 ? `(${fmtCur(Math.abs(gr.valor))})` : fmtCur(gr.valor)) : (gr.valorBruto === 0 ? '–' : gr.grupo.natureza === 'devedora' ? `(${fmtCur(gr.valorBruto)})` : fmtCur(gr.valorBruto))}
                </span>
                {dreComparativo && (() => {
                  const grComp = dreComparativo.grupos.find(x => x.grupo.id === gr.grupo.id)
                  const valComp = grComp ? (grComp.grupo.natureza === 'calculado' ? grComp.valor : grComp.valorBruto) : 0
                  const varPct = gr.valorBruto !== 0 ? ((gr.valorBruto - valComp) / Math.abs(valComp || 1)) * 100 : 0
                  return (
                    <>
                      <span style={{ textAlign: 'right', fontFamily: 'Outfit, sans-serif', color: 'hsl(var(--text-muted))' }}>
                        {valComp === 0 ? '–' : fmtCur(valComp)}
                      </span>
                      <span style={{ textAlign: 'center', fontSize: 12, color: varPct > 0 ? COR_POSITIVO : COR_NEGATIVO, fontWeight: 700 }}>
                        {valComp !== 0 ? `${varPct > 0 ? '+' : ''}${varPct.toFixed(1)}%` : '–'}
                      </span>
                    </>
                  )
                })()}
                <div/>
              </div>
            ) : (
              <DREGrupoRow
                grupoResult={gr}
                visao={visao}
                totalReceita={dreResult.receitaBruta}
                expandidos={expandidos}
                onToggle={toggleExpand}
                onDrillDown={(t, l, c) => setDrillDown({ titulo: t, lancamentos: l, cor: c })}
              />
            )}
          </div>
        ))}
      </div>

      {/* ─── Drill-down Modal ────────────────────────────────── */}
      {drillDown && (
        <DrillDownModal {...drillDown} onClose={() => setDrillDown(null)}/>
      )}

      {/* Print styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 landscape; margin: 1.2cm; }
          body { background: white !important; }
          .print-hide { display: none !important; }
          .only-print-header { display: block !important; }
          .dre-print-base { padding: 0 !important; }
          .card { border: none !important; box-shadow: none !important; background: white !important; }
          .dre-print-row { break-inside: avoid; }
          * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; }
        }
      ` }}/>
    </div>
  )
}
