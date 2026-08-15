/**
 * lib/numeroPorExtenso.ts
 * Converte valores monetários em reais (BRL) para extenso em português.
 * Ex: 1813.87 -> "um mil, oitocentos e treze reais e oitenta e sete centavos"
 */

const UNIDADES = [
  '',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
]

const ESPECIAIS = [
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
]

const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
]

const CENTENAS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
]

function converterCentena(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'cem'

  const c = Math.floor(n / 100)
  const d = Math.floor((n % 100) / 10)
  const u = n % 10

  const partes: string[] = []

  if (c > 0) partes.push(CENTENAS[c])

  if (d === 1) {
    partes.push(ESPECIAIS[u])
  } else {
    if (d > 1) partes.push(DEZENAS[d])
    if (u > 0) partes.push(UNIDADES[u])
  }

  return partes.join(' e ')
}

export function valorPorExtenso(valorEmReais: number): string {
  if (valorEmReais === 0) return 'zero reais'

  const valorAbs = Math.abs(valorEmReais)
  const reais = Math.floor(valorAbs)
  const centavos = Math.round((valorAbs - reais) * 100)

  const milhoes = Math.floor(reais / 1000000)
  const milhares = Math.floor((reais % 1000000) / 1000)
  const resto = reais % 1000

  const partesReais: string[] = []

  if (milhoes > 0) {
    const txtMilhoes = converterCentena(milhoes)
    partesReais.push(`${txtMilhoes} ${milhoes === 1 ? 'milhão' : 'milhões'}`)
  }

  if (milhares > 0) {
    const txtMilhares = converterCentena(milhares)
    partesReais.push(`${txtMilhares === 'um' ? 'um' : txtMilhares} mil`)
  }

  if (resto > 0) {
    const txtResto = converterCentena(resto)
    partesReais.push(txtResto)
  }

  let resultado = ''

  if (reais > 0) {
    resultado = `${partesReais.join(', ')} ${reais === 1 ? 'real' : 'reais'}`
  }

  if (centavos > 0) {
    const txtCentavos = converterCentena(centavos)
    const strCentavos = `${txtCentavos} ${centavos === 1 ? 'centavo' : 'centavos'}`
    resultado = reais > 0 ? `${resultado} e ${strCentavos}` : strCentavos
  }

  return resultado
}
