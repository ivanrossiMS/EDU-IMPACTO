// ==============================================================================
// Motor Matemático e Financeiro do CredImpacto
// Cálculos de juros, amortização, memória de cálculo, quitação e rescisão CLT
// ==============================================================================

import {
  MetodoCalculo,
  CredImpactoSimulacao,
  CredImpactoMemoriaCalculo,
  CredImpactoParcela
} from '@/types/credimpacto'

/**
 * Arredondamento monetário preciso com proteção contra imprecisões de ponto flutuante IEEE 754.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Formata um valor numérico para o padrão de moeda brasileiro (R$).
 */
export function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

/**
 * Nomes amigáveis dos métodos de amortização e juros.
 */
export const METODOS_LABELS: Record<MetodoCalculo, { nome: string; descricao: string; formula: string }> = {
  JUROS_SIMPLES_SALDO: {
    nome: 'Juros simples sobre o saldo devedor',
    descricao: 'Amortização constante do principal com juros do período calculados exclusivamente sobre o saldo remanescente. As parcelas diminuem gradativamente mês a mês.',
    formula: 'J_k = Saldo_(k-1) * i; Amortização = Principal / n; Parcela_k = Amortização + J_k'
  },
  JUROS_SIMPLES_INICIAL: {
    nome: 'Juros mensais sobre o valor inicial',
    descricao: 'Juros lineares fixos aplicados sobre o capital inicial durante todo o prazo. As parcelas são fixas e idênticas em todos os meses.',
    formula: 'J = Principal * i; Amortização = Principal / n; Parcela = Amortização + J'
  },
  ACRESCIMO_UNICO: {
    nome: 'Acréscimo único sobre o total',
    descricao: 'Acréscimo percentual único sobre o valor total emprestado, dividido em parcelas iguais.',
    formula: 'Total = Principal * (1 + Taxa); Parcela = Total / n'
  },
  TABELA_PRICE: {
    nome: 'Tabela Price — Parcelas fixas',
    descricao: 'Sistema Francês de Amortização com prestações constantes. A parcela de amortização cresce a cada mês enquanto a parcela de juros decresce.',
    formula: 'PMT = P * [i * (1+i)^n] / [(1+i)^n - 1]'
  },
  BALAO_FINAL_COMPOSTO: {
    nome: 'Tudo no final, com juros compostos',
    descricao: 'Carência total das parcelas intermediárias com quitação integral do principal e juros compostos capitalizados na data de vencimento final.',
    formula: 'Montante Final = Principal * (1 + i)^n'
  }
}

/**
 * Gera as competências e datas de vencimento sequenciais a partir de uma data inicial.
 */
export function generateInstallmentDates(
  totalParcelas: number,
  dataInicio: Date = new Date(),
  diaVencimento: number = 5
): Array<{ competencia: string; vencimento: string }> {
  const result: Array<{ competencia: string; vencimento: string }> = []
  
  // Começa no próximo mês para a primeira competência
  let year = dataInicio.getFullYear()
  let month = dataInicio.getMonth() + 1 // 1-indexed

  for (let k = 1; k <= totalParcelas; k++) {
    // Competência do desconto em folha (ex: 2026-10)
    const compMonthStr = String(month).padStart(2, '0')
    const competencia = `${year}-${compMonthStr}`

    // Vencimento da folha (geralmente dia 5 do mês subsequente à competência)
    let dueMonth = month + 1
    let dueYear = year
    if (dueMonth > 12) {
      dueMonth = 1
      dueYear += 1
    }
    const dueMonthStr = String(dueMonth).padStart(2, '0')
    const dueDayStr = String(diaVencimento).padStart(2, '0')
    const vencimento = `${dueYear}-${dueMonthStr}-${dueDayStr}`

    result.push({ competencia, vencimento })

    // Avança mês da competência
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }

  return result
}

/**
 * Simula as condições financeiras completas de um empréstimo com precisão contábil.
 */
export function simulateLoan(
  valorSolicitado: number,
  quantidadeParcelas: number,
  taxaMensal: number, // em porcentagem, ex: 1.5 para 1.5%
  metodo: MetodoCalculo = 'JUROS_SIMPLES_SALDO',
  salarioBaseColaborador?: number,
  dataInicio: Date = new Date(),
  diaVencimento: number = 5
): CredImpactoSimulacao {
  const principal = roundMoney(Math.max(0, valorSolicitado))
  const n = Math.max(1, Math.floor(quantidadeParcelas))
  const i = Math.max(0, taxaMensal) / 100 // decimal
  const dates = generateInstallmentDates(n, dataInicio, diaVencimento)

  const parcelas: CredImpactoSimulacao['parcelas'] = []
  let totalJuros = 0
  let saldoDevedor = principal

  const memoriaItens: CredImpactoMemoriaCalculo['itens'] = [
    {
      etapa: 'Capital Inicial (Principal)',
      descricao: `Valor concedido pela escola: ${formatBrl(principal)}`,
      detalhe: `Número de parcelas: ${n} | Taxa mensal: ${taxaMensal.toFixed(2)}% a.m.`
    }
  ]

  switch (metodo) {
    // --------------------------------------------------------------------------
    // 1. JUROS SIMPLES SOBRE O SALDO DEVEDOR (Amortização Constante)
    // --------------------------------------------------------------------------
    case 'JUROS_SIMPLES_SALDO': {
      const amortizacaoBase = roundMoney(principal / n)
      memoriaItens.push({
        etapa: 'Amortização Constante Base',
        descricao: `Amortização base do principal = ${formatBrl(principal)} / ${n} = ${formatBrl(amortizacaoBase)}`,
        formula: 'A = P / n'
      })

      for (let k = 1; k <= n; k++) {
        const jurosPeriodo = roundMoney(saldoDevedor * i)
        let amortizacao = amortizacaoBase

        // Ajuste de centavos na última parcela para zerar exatamente o saldo devedor
        if (k === n) {
          amortizacao = roundMoney(saldoDevedor)
        }

        const valorTotal = roundMoney(amortizacao + jurosPeriodo)
        saldoDevedor = roundMoney(Math.max(0, saldoDevedor - amortizacao))
        totalJuros = roundMoney(totalJuros + jurosPeriodo)

        parcelas.push({
          numero: k,
          competencia: dates[k - 1].competencia,
          dataVencimento: dates[k - 1].vencimento,
          valorAmortizacao: amortizacao,
          valorJuros: jurosPeriodo,
          valorTotal,
          saldoDevedorApos: saldoDevedor
        })
      }
      break
    }

    // --------------------------------------------------------------------------
    // 2. JUROS MENSAIS SOBRE O VALOR INICIAL (Juros Fixos Lineares)
    // --------------------------------------------------------------------------
    case 'JUROS_SIMPLES_INICIAL': {
      const jurosFixoMes = roundMoney(principal * i)
      const amortizacaoBase = roundMoney(principal / n)

      memoriaItens.push({
        etapa: 'Juros Mensais Fixos',
        descricao: `Juros por mês = ${formatBrl(principal)} * ${taxaMensal.toFixed(2)}% = ${formatBrl(jurosFixoMes)}`,
        formula: 'J = P * i'
      })

      for (let k = 1; k <= n; k++) {
        let amortizacao = amortizacaoBase
        if (k === n) {
          amortizacao = roundMoney(saldoDevedor)
        }
        const valorTotal = roundMoney(amortizacao + jurosFixoMes)
        saldoDevedor = roundMoney(Math.max(0, saldoDevedor - amortizacao))
        totalJuros = roundMoney(totalJuros + jurosFixoMes)

        parcelas.push({
          numero: k,
          competencia: dates[k - 1].competencia,
          dataVencimento: dates[k - 1].vencimento,
          valorAmortizacao: amortizacao,
          valorJuros: jurosFixoMes,
          valorTotal,
          saldoDevedorApos: saldoDevedor
        })
      }
      break
    }

    // --------------------------------------------------------------------------
    // 3. ACRÉSCIMO ÚNICO SOBRE O TOTAL (Taxa Única Global)
    // --------------------------------------------------------------------------
    case 'ACRESCIMO_UNICO': {
      const acrescimoTotal = roundMoney(principal * (taxaMensal / 100))
      const totalComAcrescimo = roundMoney(principal + acrescimoTotal)
      const parcelaBase = roundMoney(totalComAcrescimo / n)
      const amortizacaoBase = roundMoney(principal / n)
      const jurosBase = roundMoney(acrescimoTotal / n)

      memoriaItens.push({
        etapa: 'Acréscimo Único Global',
        descricao: `Taxa total de ${taxaMensal.toFixed(2)}% sobre ${formatBrl(principal)} = Acréscimo de ${formatBrl(acrescimoTotal)}`,
        formula: 'Total = P * (1 + Taxa Única)'
      })

      let totalAcumuladoParcelas = 0
      let totalAcumuladoAmortizacao = 0

      for (let k = 1; k <= n; k++) {
        let valorTotal = parcelaBase
        let amortizacao = amortizacaoBase
        let juros = jurosBase

        if (k === n) {
          valorTotal = roundMoney(totalComAcrescimo - totalAcumuladoParcelas)
          amortizacao = roundMoney(principal - totalAcumuladoAmortizacao)
          juros = roundMoney(valorTotal - amortizacao)
        }

        totalAcumuladoParcelas = roundMoney(totalAcumuladoParcelas + valorTotal)
        totalAcumuladoAmortizacao = roundMoney(totalAcumuladoAmortizacao + amortizacao)
        saldoDevedor = roundMoney(Math.max(0, principal - totalAcumuladoAmortizacao))
        totalJuros = roundMoney(totalJuros + juros)

        parcelas.push({
          numero: k,
          competencia: dates[k - 1].competencia,
          dataVencimento: dates[k - 1].vencimento,
          valorAmortizacao: amortizacao,
          valorJuros: juros,
          valorTotal,
          saldoDevedorApos: saldoDevedor
        })
      }
      break
    }

    // --------------------------------------------------------------------------
    // 4. TABELA PRICE (Parcelas Fixas - Sistema Francês)
    // --------------------------------------------------------------------------
    case 'TABELA_PRICE': {
      let pmt = 0
      if (i === 0) {
        pmt = roundMoney(principal / n)
      } else {
        const fator = Math.pow(1 + i, n)
        pmt = roundMoney(principal * ((i * fator) / (fator - 1)))
      }

      memoriaItens.push({
        etapa: 'Prestação Constante (Price)',
        descricao: `Prestação mensal fixa calculada: ${formatBrl(pmt)}`,
        formula: 'PMT = P * [i * (1+i)^n] / [(1+i)^n - 1]'
      })

      for (let k = 1; k <= n; k++) {
        const jurosPeriodo = roundMoney(saldoDevedor * i)
        let amortizacao = roundMoney(pmt - jurosPeriodo)
        let valorTotal = pmt

        // Última parcela absorve resíduo
        if (k === n) {
          amortizacao = roundMoney(saldoDevedor)
          valorTotal = roundMoney(amortizacao + jurosPeriodo)
        }

        saldoDevedor = roundMoney(Math.max(0, saldoDevedor - amortizacao))
        totalJuros = roundMoney(totalJuros + jurosPeriodo)

        parcelas.push({
          numero: k,
          competencia: dates[k - 1].competencia,
          dataVencimento: dates[k - 1].vencimento,
          valorAmortizacao: amortizacao,
          valorJuros: jurosPeriodo,
          valorTotal,
          saldoDevedorApos: saldoDevedor
        })
      }
      break
    }

    // --------------------------------------------------------------------------
    // 5. BALÃO FINAL COMPOSTO (Bullet / Montante Composto no Vencimento)
    // --------------------------------------------------------------------------
    case 'BALAO_FINAL_COMPOSTO': {
      const montanteFinal = roundMoney(principal * Math.pow(1 + i, n))
      totalJuros = roundMoney(montanteFinal - principal)

      memoriaItens.push({
        etapa: 'Capitalização Composta no Vencimento',
        descricao: `Montante Final = ${formatBrl(principal)} * (1 + ${i})^${n} = ${formatBrl(montanteFinal)}`,
        formula: 'M = P * (1 + i)^n'
      })

      for (let k = 1; k <= n; k++) {
        if (k < n) {
          parcelas.push({
            numero: k,
            competencia: dates[k - 1].competencia,
            dataVencimento: dates[k - 1].vencimento,
            valorAmortizacao: 0,
            valorJuros: 0,
            valorTotal: 0,
            saldoDevedorApos: principal
          })
        } else {
          // Última parcela quita tudo
          parcelas.push({
            numero: k,
            competencia: dates[k - 1].competencia,
            dataVencimento: dates[k - 1].vencimento,
            valorAmortizacao: principal,
            valorJuros: totalJuros,
            valorTotal: montanteFinal,
            saldoDevedorApos: 0
          })
        }
      }
      break
    }
  }

  const totalAPagar = roundMoney(principal + totalJuros)
  const valorPrimeiraParcela = parcelas[0]?.valorTotal || 0
  const valorUltimaParcela = parcelas[parcelas.length - 1]?.valorTotal || 0

  memoriaItens.push({
    etapa: 'Totalizadores',
    descricao: `Total de Juros: ${formatBrl(totalJuros)} | Total a Pagar: ${formatBrl(totalAPagar)}`,
    detalhe: `Amortização total confirmada: ${formatBrl(parcelas.reduce((acc, p) => acc + p.valorAmortizacao, 0))}`
  })

  // Verificação de margem consignável (se salário fornecido)
  let limiteMargemConsignavel: CredImpactoSimulacao['limiteMargemConsignavel'] = undefined
  if (salarioBaseColaborador && salarioBaseColaborador > 0) {
    const margemMaximaValor = roundMoney(salarioBaseColaborador * 0.30) // 30% CLT consignável padrão
    const maxParcela = Math.max(...parcelas.map(p => p.valorTotal))
    const margemComprometida = maxParcela > margemMaximaValor
    const percentualComprometimento = roundMoney((maxParcela / salarioBaseColaborador) * 100)

    limiteMargemConsignavel = {
      salarioBase: salarioBaseColaborador,
      margemMaximaValor,
      margemComprometida,
      percentualComprometimento
    }
  }

  const memoriaCalculo: CredImpactoMemoriaCalculo = {
    metodo,
    nomeMetodo: METODOS_LABELS[metodo]?.nome || metodo,
    taxaMensal,
    valorPrincipal: principal,
    quantidadeParcelas: n,
    totalJuros,
    totalAPagar,
    explicacao: METODOS_LABELS[metodo]?.descricao || '',
    itens: memoriaItens
  }

  return {
    valorSolicitado: principal,
    quantidadeParcelas: n,
    taxaMensal,
    metodoCalculo: metodo,
    totalJuros,
    totalAPagar,
    valorPrimeiraParcela,
    valorUltimaParcela,
    parcelas,
    memoriaCalculo,
    limiteMargemConsignavel
  }
}

/**
 * Calcula a quitação antecipada excluindo rigorosamente todos os juros futuros não incorridos.
 */
export function calculateEarlyPayoff(
  parcelas: CredImpactoParcela[],
  principalOriginal: number
): {
  parcelasPagasCount: number
  parcelasRestantesCount: number
  totalAmortizadoAteAgora: number
  saldoDevedorPrincipal: number
  jurosFuturosDispensados: number
  totalSemDesconto: number
  valorParaQuitacao: number
  economiaColaborador: number
  parcelasRestantes: CredImpactoParcela[]
} {
  const parcelasPagas = parcelas.filter(p => p.status === 'descontada' || p.status === 'paga_avulso')
  const parcelasRestantes = parcelas.filter(p => p.status === 'prevista' || p.status === 'exportada_folha' || p.status === 'atrasada')

  const totalAmortizadoAteAgora = roundMoney(
    parcelasPagas.reduce((acc, p) => acc + (p.valorAmortizacao || 0), 0)
  )

  // Saldo devedor estrito do principal
  const saldoDevedorPrincipal = roundMoney(Math.max(0, principalOriginal - totalAmortizadoAteAgora))

  // Juros das parcelas futuras que NÃO serão cobrados
  const jurosFuturosDispensados = roundMoney(
    parcelasRestantes.reduce((acc, p) => acc + (p.valorJuros || 0), 0)
  )

  // O total que o colaborador pagaria se esperasse todas as parcelas
  const totalSemDesconto = roundMoney(
    parcelasRestantes.reduce((acc, p) => acc + (p.valorTotal || 0), 0)
  )

  // Valor líquido final para quitação imediata: APENAS o saldo devedor de principal remanescente
  const valorParaQuitacao = saldoDevedorPrincipal
  const economiaColaborador = roundMoney(totalSemDesconto - valorParaQuitacao)

  return {
    parcelasPagasCount: parcelasPagas.length,
    parcelasRestantesCount: parcelasRestantes.length,
    totalAmortizadoAteAgora,
    saldoDevedorPrincipal,
    jurosFuturosDispensados,
    totalSemDesconto,
    valorParaQuitacao,
    economiaColaborador,
    parcelasRestantes
  }
}

/**
 * Simula a liquidação e compensação em caso de rescisão / desligamento CLT.
 * Respeita o Art. 477, § 5º da CLT (teto de compensação limitado a 1 salário mensal).
 */
export function calculateTerminationSeverance(
  saldoDevedorAtual: number,
  salarioBaseColaborador: number,
  verbasRescisoriasLiquidas: number,
  limiteCltPercentual: number = 100 // 100% de 1 salário
): {
  saldoDevedorTotal: number
  salarioBase: number
  tetoCompensacaoClt: number
  valorCompensadoNoTRCT: number
  saldoRemanescente: number
  excedeTetoClt: boolean
  excedeVerbasDisponiveis: boolean
  parecerJuridico: string
} {
  const saldoDevedor = roundMoney(saldoDevedorAtual)
  const salario = roundMoney(salarioBaseColaborador)
  const verbas = roundMoney(verbasRescisoriasLiquidas)

  // Limite estrito do Art. 477 § 5º da CLT
  const tetoCompensacaoClt = roundMoney(salario * (limiteCltPercentual / 100))

  // A compensação no TRCT é o MENOR entre: saldo devedor, teto da CLT e as verbas disponíveis
  const valorCompensadoNoTRCT = roundMoney(
    Math.min(saldoDevedor, tetoCompensacaoClt, verbas)
  )

  const saldoRemanescente = roundMoney(Math.max(0, saldoDevedor - valorCompensadoNoTRCT))
  const excedeTetoClt = saldoDevedor > tetoCompensacaoClt
  const excedeVerbasDisponiveis = saldoDevedor > verbas

  let parecerJuridico = `Compensação integral de ${formatBrl(valorCompensadoNoTRCT)} realizada dentro dos parâmetros do Art. 477, § 5º da CLT.`
  if (saldoRemanescente > 0) {
    parecerJuridico = `A dívida (${formatBrl(saldoDevedor)}) excede o limite de compensação rescisória permitido pela CLT (${formatBrl(tetoCompensacaoClt)}). Foi retido ${formatBrl(valorCompensadoNoTRCT)} no TRCT e restam ${formatBrl(saldoRemanescente)} a serem quitados ou renegociados via Termo de Confissão de Dívida.`
  }

  return {
    saldoDevedorTotal: saldoDevedor,
    salarioBase: salario,
    tetoCompensacaoClt,
    valorCompensadoNoTRCT,
    saldoRemanescente,
    excedeTetoClt,
    excedeVerbasDisponiveis,
    parecerJuridico
  }
}
