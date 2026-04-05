/**
 * lib/banking/fatorVencimento.ts
 * Cálculo do fator de vencimento FEBRABAN
 * SERVER-ONLY
 */

// Data base: 07/10/1997 (fator 1000)
const BASE_DATE = new Date('1997-10-07T12:00:00.000Z')
const FATOR_BASE = 1000
const FATOR_MAX = 9999

/**
 * Calcula o fator de vencimento (4 dígitos) a partir de uma data ISO (YYYY-MM-DD)
 * Regra FEBRABAN: dias corridos desde 07/10/1997
 * Fator máximo: 9999 (21/02/2025). Após reset, subtrai 9000.
 */
export function calcFatorVencimento(dataISO: string): string {
  const venc = new Date(dataISO + 'T12:00:00.000Z')
  const diffMs = venc.getTime() - BASE_DATE.getTime()
  const diffDias = Math.round(diffMs / (1000 * 60 * 60 * 24))

  let fator: number

  if (diffDias <= 8999) {
    // Primeiro ciclo (07/10/1997 ~ 27/05/2022): fator = dias + 1000
    // Intervalo: 1000..9999
    fator = diffDias + 1000
  } else {
    // Segundo ciclo (28/05/2022+): fator = dias - 9000
    // Reinicia em 0 e sobe; o banco não soma 1000 neste ciclo.
    // Verificado empiricamente: 08/04/2026 = 10410 dias → fator = 10410 - 9000 = 1410 ✓
    fator = diffDias - 9000
  }

  // Garantia de 4 dígitos válidos
  if (fator < 0 || fator > 9999) {
    fator = ((diffDias % 9000) + 9000) % 9000
  }

  return fator.toString().padStart(4, '0')
}

/**
 * Converte fator de vencimento de volta para data (YYYY-MM-DD)
 * Útil para verificação/auditoria
 */
export function fatorParaData(fator: string): string {
  const f = parseInt(fator)
  if (isNaN(f) || f < 1000 || f > 9999) return ''
  
  const diasDesdeBase = f - FATOR_BASE
  const dataVenc = new Date(BASE_DATE.getTime() + diasDesdeBase * 24 * 60 * 60 * 1000)
  return dataVenc.toISOString().slice(0, 10)
}

/**
 * Formata valor em 10 dígitos (centavos, sem ponto decimal)
 * Ex: 1234.56 → '0000123456'
 */
export function formatarValor10(valor: number): string {
  const centavos = Math.round(valor * 100)
  return centavos.toString().padStart(10, '0')
}

/**
 * Formata valor em N dígitos para CNAB
 */
export function formatarValorCNAB(valor: number, tamanho: number): string {
  const centavos = Math.round(valor * 100)
  return centavos.toString().padStart(tamanho, '0')
}

/**
 * Formata data para DDMMAAAA (CNAB)
 */
export function formatarDataCNAB(dataISO: string): string {
  if (!dataISO) return '00000000'
  const [ano, mes, dia] = dataISO.split('-')
  return `${dia}${mes}${ano}`
}

/**
 * Formata data para AAAAMMDD (CNAB Header)
 */
export function formatarDataArquivo(dataISO: string): string {
  if (!dataISO) return '00000000'
  return dataISO.replace(/-/g, '')
}

/**
 * Hora atual formatada HHMMSS
 */
export function horaAtualCNAB(): string {
  const now = new Date()
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  const s = String(now.getSeconds()).padStart(2, '0')
  return `${h}${m}${s}`
}
