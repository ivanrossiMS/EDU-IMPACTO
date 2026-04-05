/**
 * lib/banking/linhaDigitavel.ts
 * Composição da linha digitável FEBRABAN — 5 campos
 * SERVER-ONLY
 */
import { calcDvMod10 } from './dv'

/**
 * Monta a linha digitável a partir do código de barras de 44 dígitos
 * 
 * Estrutura do código de barras (entrada):
 *   [0-2]   Banco (3 dígitos)
 *   [3]     Moeda (1 dígito)
 *   [4]     DV geral (1 dígito)
 *   [5-8]   Fator vencimento (4 dígitos)
 *   [9-18]  Valor (10 dígitos)
 *   [19-43] Campo livre (25 dígitos)
 * 
 * Linha digitável (5 campos):
 *   Campo 1 (9 dígitos + DV = 10): banco(3)+moeda(1)+campoLivre[0..4] + DV mod10
 *   Campo 2 (10 dígitos + DV = 11): campoLivre[5..14] + DV mod10
 *   Campo 3 (10 dígitos + DV = 11): campoLivre[15..24] + DV mod10
 *   Campo 4 (1 dígito): DV geral
 *   Campo 5 (14 dígitos): fator(4) + valor(10)
 */
export function montarLinhaDigitavelItau(codigoBarras44: string): string {
  if (codigoBarras44.length !== 44) {
    throw new Error(`Código de barras deve ter 44 dígitos, recebido: ${codigoBarras44.length}`)
  }

  const banco = codigoBarras44.slice(0, 3)     // '341'
  const moeda = codigoBarras44[3]               // '9'
  const dvGeral = codigoBarras44[4]             // DV geral
  const fator = codigoBarras44.slice(5, 9)      // fator vencimento
  const valor = codigoBarras44.slice(9, 19)     // 10 dígitos
  const campoLivre = codigoBarras44.slice(19)   // 25 dígitos

  // Campo 1: banco(3) + moeda(1) + campoLivre[0..4] (5 dígitos) = 9 dígitos + DV mod10
  const c1_base = banco + moeda + campoLivre.slice(0, 5)
  const c1_dv = calcDvMod10(c1_base)
  const campo1 = c1_base + c1_dv.toString()  // 10 dígitos

  // Campo 2: campoLivre[5..14] (10 dígitos) + DV mod10
  const c2_base = campoLivre.slice(5, 15)
  const c2_dv = calcDvMod10(c2_base)
  const campo2 = c2_base + c2_dv.toString()  // 11 dígitos

  // Campo 3: campoLivre[15..24] (10 dígitos) + DV mod10
  const c3_base = campoLivre.slice(15, 25)
  const c3_dv = calcDvMod10(c3_base)
  const campo3 = c3_base + c3_dv.toString()  // 11 dígitos

  // Campo 4: DV geral (1 dígito)
  const campo4 = dvGeral  // 1 dígito

  // Campo 5: fator(4) + valor(10) = 14 dígitos
  const campo5 = fator + valor  // 14 dígitos

  return `${campo1}${campo2}${campo3}${campo4}${campo5}`
}

/**
 * Formata a linha digitável com pontos e espaços para exibição
 * Ex: '10491.09008 13221.016499 23402.260006 6 14010000102825'
 * 
 * Formato: BBBMM.NNNND NNNNN.NNNNND NNNNN.NNNNND D FFFFFFFFVVVVVVVVVV
 */
export function formatarLinhaDigitavel(linhaRaw: string): string {
  // Garante 47 dígitos (10+11+11+1+14)
  if (linhaRaw.length !== 47) {
    throw new Error(`Linha digitável deve ter 47 dígitos, recebido: ${linhaRaw.length}`)
  }

  const c1 = linhaRaw.slice(0, 10)
  const c2 = linhaRaw.slice(10, 21)
  const c3 = linhaRaw.slice(21, 32)
  const c4 = linhaRaw.slice(32, 33)
  const c5 = linhaRaw.slice(33, 47)

  // Formata campo 1: BBBMM.NNNND  (5+1+4+DV)
  const c1f = `${c1.slice(0, 5)}.${c1.slice(5)}`
  // Formata campo 2: NNNNN.NNNNNND (5+1+5+DV)
  const c2f = `${c2.slice(0, 5)}.${c2.slice(5)}`
  // Formata campo 3: NNNNN.NNNNNND
  const c3f = `${c3.slice(0, 5)}.${c3.slice(5)}`

  return `${c1f} ${c2f} ${c3f} ${c4} ${c5}`
}

/**
 * Monta e formata a linha digitável em um único passo
 */
export function gerarLinhaDigitavelFormatada(codigoBarras44: string): {
  linhaRaw: string
  linhaFormatada: string
  campos: {
    campo1: string
    campo2: string
    campo3: string
    campo4: string
    campo5: string
  }
} {
  const linhaRaw = montarLinhaDigitavelItau(codigoBarras44)
  const linhaFormatada = formatarLinhaDigitavel(linhaRaw)

  return {
    linhaRaw,
    linhaFormatada,
    campos: {
      campo1: linhaFormatada.split(' ')[0],
      campo2: linhaFormatada.split(' ')[1],
      campo3: linhaFormatada.split(' ')[2],
      campo4: linhaFormatada.split(' ')[3],
      campo5: linhaFormatada.split(' ')[4],
    },
  }
}
