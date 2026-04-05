/**
 * lib/banking/dv.ts
 * Cálculos de dígitos verificadores bancários — módulo 10 e 11
 * SERVER-ONLY — jamais importar no browser
 */

/**
 * Calcula DV por Módulo 10
 * Usado nos 3 campos numéricos da linha digitável do Itaú
 */
export function calcDvMod10(numero: string): number {
  const digits = numero.replace(/\D/g, '')
  let soma = 0
  let multiplicador = 2 // começa por 2 da direita para esquerda

  for (let i = digits.length - 1; i >= 0; i--) {
    let resultado = parseInt(digits[i]) * multiplicador
    // Se resultado >= 10, soma os dígitos individuais
    if (resultado >= 10) {
      resultado = Math.floor(resultado / 10) + (resultado % 10)
    }
    soma += resultado
    multiplicador = multiplicador === 2 ? 1 : 2 // alterna 2 e 1
  }

  const resto = soma % 10
  return resto === 0 ? 0 : 10 - resto
}

/**
 * Calcula DV por Módulo 11 (padrão bancário — pesos 2 a 9)
 * Usado para o DV geral do código de barras Itaú
 */
export function calcDvMod11(numero: string): number {
  const digits = numero.replace(/\D/g, '')
  let soma = 0
  let peso = 2

  for (let i = digits.length - 1; i >= 0; i--) {
    soma += parseInt(digits[i]) * peso
    peso = peso === 9 ? 2 : peso + 1 // cicla entre 2 e 9
  }

  const resto = soma % 11
  if (resto < 2) return 1 // DV = 1 quando resto é 0 ou 1
  return 11 - resto
}

/**
 * Calcula o DV do Nosso Número para o Itaú
 * Regra específica: carteira + nossoNumero, módulo 10
 */
export function calcDvNossoNumeroItau(nossoNumero: string, carteira: string): number {
  const campo = carteira.padStart(3, '0') + nossoNumero.padStart(8, '0')
  return calcDvMod10(campo)
}

/**
 * Calcula o DAC da Agência + Conta para o Itaú
 * Módulo 10 sobre agência(4) + conta(5)
 */
export function calcDvAgenciaContaItau(agencia: string, conta: string): number {
  const campo = agencia.padStart(4, '0') + conta.padStart(5, '0')
  return calcDvMod10(campo)
}

/**
 * Valida CPF brasileiro (11 dígitos)
 */
export function validarCPF(cpf: string): boolean {
  const c = cpf.replace(/\D/g, '')
  if (c.length !== 11) return false
  if (/^(\d)\1+$/.test(c)) return false // todos iguais

  let soma = 0
  for (let i = 0; i < 9; i++) soma += parseInt(c[i]) * (10 - i)
  let r = (soma * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== parseInt(c[9])) return false

  soma = 0
  for (let i = 0; i < 10; i++) soma += parseInt(c[i]) * (11 - i)
  r = (soma * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === parseInt(c[10])
}

/**
 * Valida CNPJ brasileiro (14 dígitos)
 */
export function validarCNPJ(cnpj: string): boolean {
  const c = cnpj.replace(/\D/g, '')
  if (c.length !== 14) return false
  if (/^(\d)\1+$/.test(c)) return false

  const calc = (c: string, len: number): number => {
    const pesos = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = c.slice(0, len).split('').reduce((s, d, i) => s + parseInt(d) * pesos[i], 0)
    const r = soma % 11
    return r < 2 ? 0 : 11 - r
  }

  return calc(c, 12) === parseInt(c[12]) && calc(c, 13) === parseInt(c[13])
}

/**
 * Valida CPF ou CNPJ
 */
export function validarCpfCnpj(valor: string): boolean {
  const digits = valor.replace(/\D/g, '')
  if (digits.length === 11) return validarCPF(digits)
  if (digits.length === 14) return validarCNPJ(digits)
  return false
}

/**
 * Formata CPF ou CNPJ para exibição
 */
export function formatarCpfCnpj(valor: string): string {
  const d = valor.replace(/\D/g, '')
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  return valor
}
