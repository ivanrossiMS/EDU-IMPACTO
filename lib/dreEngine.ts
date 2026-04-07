/**
 * dreEngine.ts — Motor de Cálculo da DRE Gerencial
 * Responsável por toda a lógica de apuração financeira da DRE.
 * Totalmente desacoplado do frontend para fácil migração para API futura.
 */

import type { ConfigPlanoContas, ConfigGrupoDRE, GrupoDRECodigo } from './dataContext'

// ─── Tipos de Entrada ────────────────────────────────────────────

export interface LancamentoBruto {
  id: string
  origem: 'receita' | 'despesa'
  valor: number
  dataCompetencia: string   // YYYY-MM-DD
  dataCaixa: string         // YYYY-MM-DD | ''
  status: 'pago' | 'pendente' | 'atrasado'
  planoContasId?: string
  descricao: string
  referencia: string
  documento?: string
  centroCustoId?: string
}

export interface FiltrosDRE {
  regime: 'caixa' | 'competencia'
  ano: number
  mes: number               // 0-11, -1 = ano todo
  mesComparativo?: number   // para modo comparativo
  anoComparativo?: number
  centroCustoId?: string    // '' = todos
  exibirZerados: boolean
}

// ─── Tipos de Saída ──────────────────────────────────────────────

export interface LancamentoDRE extends LancamentoBruto {
  grupoDRE: GrupoDRECodigo
  planoContasCodigo?: string
  planoContasNome?: string
}

export interface ContaDRELine {
  planoContasId: string
  codPlano: string
  nome: string
  valor: number
  lancamentos: LancamentoDRE[]
}

export interface GrupoDREResult {
  grupo: ConfigGrupoDRE
  valorBruto: number          // soma dos lançamentos antes de sinal
  valor: number               // valor com sinal correto (devedoras ficam negativas)
  percentualReceita: number   // AV% sobre receita bruta
  percentualLiquida: number   // AV% sobre receita líquida
  contas: ContaDRELine[]      // detalhamento por conta contábil
  lancamentosOrfaos: LancamentoDRE[] // lançamentos sem conta contábil
}

export interface DREResult {
  // Estrutura completa
  grupos: GrupoDREResult[]
  // Valores de subtotais calculados
  receitaBruta: number
  deducaoReceita: number
  receitaLiquida: number
  custoServico: number
  lucroBruto: number
  despAdministrativa: number
  despComercial: number
  resultadoOperacional: number
  resultadoFinanceiro: number
  resultadoAntesImpostos: number
  impostos: number
  lucroLiquido: number
  investimentos: number
  semClassificacao: number
  // KPIs
  margemBruta: number         // %
  margemOperacional: number   // %
  margemLiquida: number       // %
  // Totais de apoio
  totalReceitas: number
  totalDespesas: number
  // Pendências
  lancamentosOrfaos: LancamentoDRE[]  // sem planoContasId
  contasSemGrupoDRE: ConfigPlanoContas[]  // contas sem grupoDRE definido
  // Meta
  filtrosAplicados: FiltrosDRE
  totalLancamentos: number
}

// ─── Utilidades ──────────────────────────────────────────────────

const pct = (valor: number, base: number): number => {
  if (base === 0) return 0
  return Math.round((valor / base) * 10000) / 100  // 2 casas
}

const passaFiltroData = (
  lancamento: LancamentoBruto,
  filtros: FiltrosDRE
): boolean => {
  const dateStr = filtros.regime === 'competencia'
    ? lancamento.dataCompetencia
    : lancamento.dataCaixa

  if (!dateStr) return false

  // Regime caixa: só pago
  if (filtros.regime === 'caixa' && lancamento.status !== 'pago') return false

  const ano = parseInt(dateStr.slice(0, 4))
  const mes = parseInt(dateStr.slice(5, 7)) - 1  // 0-index

  if (ano !== filtros.ano) return false
  if (filtros.mes !== -1 && mes !== filtros.mes) return false

  return true
}

// ─── Função principal de build da DRE ───────────────────────────

export function buildDRE(
  lancamentosBrutos: LancamentoBruto[],
  planoContas: ConfigPlanoContas[],
  gruposDRE: ConfigGrupoDRE[],
  filtros: FiltrosDRE
): DREResult {

  // Mapas para lookup rápido
  const planosMap = new Map<string, ConfigPlanoContas>()
  planoContas.forEach(p => planosMap.set(p.id, p))

  // Filtrar os lançamentos pelo período
  const lancamentosFiltrados = lancamentosBrutos.filter(l =>
    passaFiltroData(l, filtros) &&
    (!filtros.centroCustoId || filtros.centroCustoId === '' || l.centroCustoId === filtros.centroCustoId)
  )

  // Classificar lançamentos em grupos DRE
  const lancamentosClassificados: LancamentoDRE[] = []
  const lancamentosOrfaos: LancamentoDRE[] = []  // sem planoContasId vinculado

  for (const l of lancamentosFiltrados) {
    const conta = l.planoContasId ? planosMap.get(l.planoContasId) : undefined
    let grupoDRE: GrupoDRECodigo = 'SEM_CLASSIFICACAO'

    if (conta) {
      if (conta.grupoDRE) {
        grupoDRE = conta.grupoDRE
      } else {
        // Fallback inteligente baseado em grupoConta
        if (conta.grupoConta === 'receitas') grupoDRE = 'RECEITA_BRUTA'
        else if (conta.grupoConta === 'investimentos') grupoDRE = 'INVESTIMENTOS'
        else grupoDRE = 'DESP_ADMINISTRATIVA'
      }
    }

    const lancDRE: LancamentoDRE = {
      ...l,
      grupoDRE,
      planoContasCodigo: conta?.codPlano,
      planoContasNome: conta?.descricao,
    }

    lancamentosClassificados.push(lancDRE)
    if (!l.planoContasId) lancamentosOrfaos.push(lancDRE)
  }

  // Agrupar lançamentos por código de grupo DRE
  const lancsByGrupo = new Map<GrupoDRECodigo, LancamentoDRE[]>()
  for (const l of lancamentosClassificados) {
    if (!lancsByGrupo.has(l.grupoDRE)) lancsByGrupo.set(l.grupoDRE, [])
    lancsByGrupo.get(l.grupoDRE)!.push(l)
  }

  // Calcular somas brutas por grupo (sem fórmula ainda)
  const somasBrutas = new Map<GrupoDRECodigo, number>()
  for (const [cod, lancs] of lancsByGrupo.entries()) {
    somasBrutas.set(cod, lancs.reduce((acc, l) => acc + l.valor, 0))
  }
  const getSoma = (cod: GrupoDRECodigo): number => somasBrutas.get(cod) ?? 0

  // Calcular subtotais (fórmulas)
  const receitaBruta = getSoma('RECEITA_BRUTA')
  const deducaoReceita = getSoma('DEDUCAO_RECEITA')
  const receitaLiquida = receitaBruta - deducaoReceita
  const custoServico = getSoma('CUSTO_SERVICO')
  const lucroBruto = receitaLiquida - custoServico
  const despAdministrativa = getSoma('DESP_ADMINISTRATIVA')
  const despComercial = getSoma('DESP_COMERCIAL')
  const resultadoOperacional = lucroBruto - despAdministrativa - despComercial
  const resultadoFinanceiro = getSoma('RESULTADO_FINANCEIRO')  // misto — contas definem sinal
  const resultadoAntesImpostos = resultadoOperacional + resultadoFinanceiro
  const impostos = getSoma('IMPOSTOS')
  const lucroLiquido = resultadoAntesImpostos - impostos
  const investimentos = getSoma('INVESTIMENTOS')
  const semClassificacao = getSoma('SEM_CLASSIFICACAO')

  // Mapa de valores calculados (para preencher grupos de tipo 'calculado')
  const valoresCalculados = new Map<GrupoDRECodigo, number>([
    ['RECEITA_LIQUIDA', receitaLiquida],
    ['LUCRO_BRUTO', lucroBruto],
    ['RESULTADO_OPERACIONAL', resultadoOperacional],
    ['RESULTADO_ANTES_IMPOSTOS', resultadoAntesImpostos],
    ['LUCRO_LIQUIDO', lucroLiquido],
  ])

  // Montar resultados por grupo — ordenados
  const gruposOrdenados = [...gruposDRE].sort((a, b) => a.ordem - b.ordem)

  const grupos: GrupoDREResult[] = gruposOrdenados
    .filter(g => g.exibir)
    .map(g => {
      const lancamentos = lancsByGrupo.get(g.codigo) ?? []
      const isCalculado = g.natureza === 'calculado'

      let valorBruto = 0
      if (isCalculado) {
        valorBruto = valoresCalculados.get(g.codigo) ?? 0
      } else {
        valorBruto = getSoma(g.codigo)
      }

      // O valor é o próprio valor calculado (os grupos calculados já têm sinal correto)
      const valor = isCalculado ? valorBruto : valorBruto

      // Agrupar por conta contábil
      const contasMap = new Map<string, ContaDRELine>()
      for (const l of lancamentos) {
        const key = l.planoContasId || '__orphan__'
        if (!contasMap.has(key)) {
          contasMap.set(key, {
            planoContasId: key,
            codPlano: l.planoContasCodigo || '---',
            nome: l.planoContasNome || 'Sem conta vinculada',
            valor: 0,
            lancamentos: [],
          })
        }
        const c = contasMap.get(key)!
        c.valor += l.valor
        c.lancamentos.push(l)
      }

      const contas = Array.from(contasMap.values())
        .sort((a, b) => b.valor - a.valor)

      const orphans = lancamentos.filter(l => !l.planoContasId)

      return {
        grupo: g,
        valorBruto,
        valor,
        percentualReceita: pct(Math.abs(valor), receitaBruta),
        percentualLiquida: pct(Math.abs(valor), receitaLiquida),
        contas: contas.filter(c => c.planoContasId !== '__orphan__'),
        lancamentosOrfaos: orphans,
      } satisfies GrupoDREResult
    })
    .filter(g => filtros.exibirZerados || g.valorBruto !== 0 || g.grupo.natureza === 'calculado')

  // Identificar contas sem grupoDRE
  const contasSemGrupoDRE = planoContas.filter(
    p => p.situacao === 'ativo' && !p.grupoDRE && p.tipo === 'analitico'
  )

  const totalReceitas = receitaBruta + resultadoFinanceiro
  const totalDespesas = deducaoReceita + custoServico + despAdministrativa + despComercial + impostos

  return {
    grupos,
    receitaBruta,
    deducaoReceita,
    receitaLiquida,
    custoServico,
    lucroBruto,
    despAdministrativa,
    despComercial,
    resultadoOperacional,
    resultadoFinanceiro,
    resultadoAntesImpostos,
    impostos,
    lucroLiquido,
    investimentos,
    semClassificacao,
    margemBruta: pct(lucroBruto, receitaBruta),
    margemOperacional: pct(resultadoOperacional, receitaBruta),
    margemLiquida: pct(lucroLiquido, receitaBruta),
    totalReceitas,
    totalDespesas,
    lancamentosOrfaos,
    contasSemGrupoDRE,
    filtrosAplicados: filtros,
    totalLancamentos: lancamentosFiltrados.length,
  }
}

// ─── Funções auxiliares de formatação ───────────────────────────

export const fmtCur = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })

export const fmtPct = (v: number): string =>
  `${v.toFixed(1).replace('.', ',')}%`

export const sinalDisplay = (valor: number, grupo: ConfigGrupoDRE): string => {
  if (grupo.natureza === 'calculado') {
    return valor < 0 ? `(${fmtCur(Math.abs(valor))})` : fmtCur(valor)
  }
  if (grupo.natureza === 'devedora') {
    return valor === 0 ? '–' : `(${fmtCur(valor)})`
  }
  return valor === 0 ? '–' : fmtCur(valor)
}

export const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]
