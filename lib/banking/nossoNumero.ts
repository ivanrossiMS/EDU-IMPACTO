/**
 * lib/banking/nossoNumero.ts
 * Engine de geração do Nosso Número bancário
 * SERVER-ONLY — persiste o sequencial, nunca recalcula
 */
import { calcDvNossoNumeroItau } from './dv'

export interface NossoNumeroGerado {
  nossoNumero: string       // 8 dígitos sem DV
  dvNossoNumero: number     // DV calculado
  nossoNumeroDV: string     // 8 dígitos + DV (ex: '000000011')
  nossoNumeroFormatado: string // ex: '00000-001-X' formato exibição
  sequencial: number        // número sequencial bruto
}

/**
 * Gera o próximo Nosso Número para o Itaú
 * @param ultimoSequencial - Último sequencial usado (persistido no convênio)
 * @param carteira - Código da carteira ('109', '112', '175')
 */
export function gerarNossoNumeroItau(
  ultimoSequencial: number,
  carteira: string
): NossoNumeroGerado {
  const sequencial = ultimoSequencial + 1
  const nossoNumero = sequencial.toString().padStart(8, '0')
  const dvNossoNumero = calcDvNossoNumeroItau(nossoNumero, carteira)
  
  return {
    nossoNumero,
    dvNossoNumero,
    nossoNumeroDV: nossoNumero + dvNossoNumero.toString(),
    nossoNumeroFormatado: `${nossoNumero}-${dvNossoNumero}`,
    sequencial,
  }
}

/**
 * Valida se um Nosso Número já existente tem DV correto
 * Usado para verificação antes de incluir na remessa
 */
export function validarNossoNumeroItau(
  nossoNumero: string,
  dv: number,
  carteira: string
): boolean {
  const dvEsperado = calcDvNossoNumeroItau(nossoNumero.padStart(8, '0'), carteira)
  return dvEsperado === dv
}

/**
 * Verifica se um nosso número é único dentro de uma lista de títulos existentes
 */
export function isNossoNumeroUnico(
  nossoNumero: string,
  titulosExistentes: { nossoNumero?: string }[]
): boolean {
  return !titulosExistentes.some(t => t.nossoNumero === nossoNumero)
}
