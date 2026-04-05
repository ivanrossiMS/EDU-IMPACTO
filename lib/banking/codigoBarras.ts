/**
 * lib/banking/codigoBarras.ts
 * Composição do código de barras bancário Itaú — 44 dígitos
 * SERVER-ONLY
 */
import { calcDvMod11, calcDvNossoNumeroItau, calcDvAgenciaContaItau } from './dv'
import { calcFatorVencimento, formatarValor10 } from './fatorVencimento'
import type { CampoLivreInput, CodigoBarrasInput } from './types'

/**
 * Monta o Campo Livre Itaú — 25 dígitos
 * Válido para carteiras 109, 112, 175
 * 
 * Estrutura:
 *  [1-3]   Carteira (3 dígitos)
 *  [4-11]  Nosso Número (8 dígitos, sem DV)
 *  [12]    DV do Nosso Número (mod10 sobre carteira+nossoNumero)
 *  [13-16] Agência (4 dígitos, sem DV)
 *  [17-21] Conta (5 dígitos, sem DV)
 *  [22]    DAC Agência+Conta (mod10)
 *  [23-25] "000" (zeros, fixo)
 */
export function montarCampoLivreItau(params: CampoLivreInput): string {
  const carteira = params.carteira.padStart(3, '0')
  const nossoNumero = params.nossoNumero.padStart(8, '0')
  const dvNN = params.dvNossoNumero
  const agencia = params.agencia.padStart(4, '0')
  const conta = params.conta.padStart(5, '0')
  const dvAgConta = params.dvAgenciaConta

  const campoLivre =
    carteira +
    nossoNumero +
    dvNN.toString() +
    agencia +
    conta +
    dvAgConta.toString() +
    '000'

  if (campoLivre.length !== 25) {
    throw new Error(`Campo livre inválido: esperado 25 dígitos, obtido ${campoLivre.length}. Valor: ${campoLivre}`)
  }

  return campoLivre
}

/**
 * Monta o Código de Barras Itaú — 44 dígitos
 * 
 * Estrutura:
 *  [1-3]   Banco (341)
 *  [4]     Moeda (9 = Real)
 *  [5]     DV geral (calculado por último, sobre os 43 outros dígitos)
 *  [6-9]   Fator de vencimento (4 dígitos)
 *  [10-19] Valor (10 dígitos, centavos)
 *  [20-44] Campo livre (25 dígitos)
 */
export function montarCodigoBarrasItau(params: CodigoBarrasInput): string {
  const banco = params.banco.padStart(3, '0') // '341'
  const moeda = params.moeda || '9'
  const fator = params.fatorVencimento.padStart(4, '0')
  const valor = formatarValor10(params.valor)
  const campoLivre = params.campoLivre

  if (campoLivre.length !== 25) {
    throw new Error(`Campo livre deve ter 25 dígitos, recebido: ${campoLivre.length}`)
  }

  // Monta os 43 dígitos sem o DV (posição 5)
  const sem_dv = banco + moeda + fator + valor + campoLivre

  if (sem_dv.length !== 43) {
    throw new Error(`Código de barras sem DV deve ter 43 dígitos, obtido: ${sem_dv.length}`)
  }

  // Calcula DV geral (módulo 11)
  const dv = calcDvMod11(sem_dv)

  // Insere DV na posição 5 (índice 4)
  const codigoBarras = banco + moeda + dv.toString() + fator + valor + campoLivre

  if (codigoBarras.length !== 44) {
    throw new Error(`Código de barras deve ter 44 dígitos, obtido: ${codigoBarras.length}`)
  }

  return codigoBarras
}

/**
 * Função principal: dado um conjunto completo de parâmetros, 
 * gera o código de barras Itaú 44 dígitos correto.
 */
export interface GerarCodigoBarrasItauInput {
  banco: string          // '341'
  carteira: string       // '109'
  nossoNumero: string    // 8 dígitos sem DV
  agencia: string        // 4 dígitos
  conta: string          // 5 dígitos
  dataVencimento: string // YYYY-MM-DD
  valor: number          // em reais
}

export function gerarCodigoBarrasCompleto(input: GerarCodigoBarrasItauInput): {
  dvNossoNumero: number
  dvAgenciaConta: number
  campoLivre: string
  fatorVencimento: string
  codigoBarras44: string
} {
  const dvNN = calcDvNossoNumeroItau(input.nossoNumero, input.carteira)
  const dvAC = calcDvAgenciaContaItau(input.agencia, input.conta)
  const fator = calcFatorVencimento(input.dataVencimento)

  const campoLivre = montarCampoLivreItau({
    carteira: input.carteira,
    nossoNumero: input.nossoNumero,
    dvNossoNumero: dvNN,
    agencia: input.agencia,
    conta: input.conta,
    dvAgenciaConta: dvAC,
  })

  const codigoBarras44 = montarCodigoBarrasItau({
    banco: input.banco,
    moeda: '9',
    fatorVencimento: fator,
    valor: input.valor,
    campoLivre,
  })

  return {
    dvNossoNumero: dvNN,
    dvAgenciaConta: dvAC,
    campoLivre,
    fatorVencimento: fator,
    codigoBarras44,
  }
}

/**
 * Valida se um código de barras de 44 dígitos é estruturalmente válido
 */
export function validarCodigoBarras44(cb: string): { valido: boolean; erros: string[] } {
  const erros: string[] = []

  if (!/^\d{44}$/.test(cb)) {
    erros.push(`Código de barras deve ter exatamente 44 dígitos numéricos (encontrado: ${cb.length})`)
    return { valido: false, erros }
  }

  const banco = cb.slice(0, 3)
  const moeda = cb[3]
  const dvInformado = parseInt(cb[4])

  if (moeda !== '9') {
    erros.push(`Código de moeda inválido: esperado '9' (Real), encontrado '${moeda}'`)
  }

  // Valida DV geral: recalcula e compara
  const semDv = cb.slice(0, 4) + cb.slice(5)
  const dvCalculado = calcDvMod11(semDv)

  if (dvCalculado !== dvInformado) {
    erros.push(`DV geral inválido: esperado ${dvCalculado}, encontrado ${dvInformado}`)
  }

  // Valida fator (posições 5-8)
  const fator = parseInt(cb.slice(5, 9))
  if (fator < 1000 || fator > 9999) {
    erros.push(`Fator de vencimento inválido: ${fator} (deve ser entre 1000 e 9999)`)
  }

  return { valido: erros.length === 0, erros }
}
