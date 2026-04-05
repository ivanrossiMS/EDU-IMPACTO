/**
 * lib/banking/validacao.ts
 * Validação pré-emissão de boletos — SERVER-ONLY
 * Regras bloqueantes apenas para campos CRÍTICOS; demais geram avisos.
 */
import { validarCpfCnpj } from './dv'
import type { TituloEmissaoInput, Pagador, ValidationResult, ConvenioBancario } from './types'

const CARTEIRAS_ITAU_VALIDAS = ['109', '112', '175', '196', '198']

/** Normaliza agência: garante 4 dígitos com zero à esquerda */
function normAgencia(ag: string): string {
  return ag.replace(/\D/g, '').padStart(4, '0').slice(-4)
}

/** Normaliza conta: garante 5 dígitos com zero à esquerda */
function normConta(cc: string): string {
  return cc.replace(/\D/g, '').padStart(5, '0').slice(-5)
}

/**
 * Valida pagador — apenas campos críticos bloqueam; demais geram avisos
 */
export function validarPagador(pagador: Pagador): { erros: string[]; avisos: string[] } {
  const erros: string[] = []
  const avisos: string[] = []

  // Coerce todos os campos para string primeiro (defesa extra contra dados mal formados)
  const nome       = String(pagador.nome       ?? '')
  const logradouro = String(pagador.logradouro ?? '')
  const bairro     = String(pagador.bairro     ?? '')
  const cidade     = String(pagador.cidade     ?? '')
  const uf         = String(pagador.uf         ?? '')

  if (!nome || nome.trim().length < 2) {
    erros.push('Nome do pagador é obrigatório (mínimo 2 caracteres)')
  }

  // CPF/CNPJ: gera AVISO se inválido, não bloqueia (pode ser cliente sem CPF cadastrado)
  const cpfCnpjDigits = (pagador.cpfCnpj || '').replace(/\D/g, '')
  if (!cpfCnpjDigits || cpfCnpjDigits === '00000000000' || cpfCnpjDigits === '00000000000000') {
    avisos.push('CPF/CNPJ do pagador não informado — boleto emitido sem identificação fiscal')
  } else if (cpfCnpjDigits.length !== 11 && cpfCnpjDigits.length !== 14) {
    avisos.push(`CPF/CNPJ do pagador com tamanho inválido: ${cpfCnpjDigits.length} dígitos`)
  } else if (!validarCpfCnpj(cpfCnpjDigits)) {
    avisos.push(`CPF/CNPJ do pagador com dígito verificador inválido: ${pagador.cpfCnpj} — boleto emitido mesmo assim`)
  }

  // Endereço: avisos apenas (obrigatoriedade bancária mas não bloqueia emissão no sistema)
  if (!logradouro || logradouro.trim().length < 2) {
    avisos.push('Logradouro do pagador não informado')
  }
  if (!bairro || bairro.trim().length < 1) {
    avisos.push('Bairro do pagador não informado')
  }
  if (!cidade || cidade.trim().length < 1) {
    avisos.push('Cidade do pagador não informada')
  }
  if (!uf || uf.trim().length !== 2) {
    avisos.push('UF do pagador não informada')
  }

  const cepDigits = (pagador.cep || '').replace(/\D/g, '')
  if (!cepDigits || cepDigits.length !== 8) {
    avisos.push('CEP do pagador inválido ou não informado')
  }

  return { erros, avisos }
}

/**
 * Valida convênio bancário
 */
export function validarConvenio(convenio: ConvenioBancario): string[] {
  const erros: string[] = []

  if (!convenio) {
    return ['Convênio bancário não encontrado']
  }

  if (convenio.situacao !== 'ativo') {
    erros.push(`Convênio "${convenio.id}" está ${convenio.situacao} — não é possível emitir boletos`)
  }

  // Agência: aceita qualquer número, normaliza para 4 dígitos
  const agNorm = normAgencia(convenio.agencia || '')
  if (!agNorm || agNorm === '0000') {
    erros.push('Agência não informada no convênio')
  }

  // Conta: aceita qualquer número, normaliza para 5 dígitos
  const ccNorm = normConta(convenio.conta || '')
  if (!ccNorm || ccNorm === '00000') {
    erros.push('Conta corrente não informada no convênio')
  }

  if (!convenio.carteira) {
    erros.push('Carteira é obrigatória no convênio')
  } else if (convenio.banco === '341' && !CARTEIRAS_ITAU_VALIDAS.includes(convenio.carteira)) {
    erros.push(`Carteira "${convenio.carteira}" não é válida para o Itaú. Válidas: ${CARTEIRAS_ITAU_VALIDAS.join(', ')}`)
  }

  if (!convenio.convenio || convenio.convenio.replace(/\D/g, '').length < 4) {
    erros.push('Código do beneficiário (convênio) deve ter ao menos 4 dígitos')
  }

  if (!convenio.cedente || convenio.cedente.trim().length < 2) {
    erros.push('Nome do cedente é obrigatório no convênio')
  }

  return erros
}

/**
 * Valida dados do título
 */
export function validarTitulo(input: TituloEmissaoInput): string[] {
  const erros: string[] = []

  // numeroDocumento: gera vazio se não informado, mas não bloqueia
  // (será gerado automaticamente pela API)

  if (!input.valor || input.valor <= 0) {
    erros.push('Valor do boleto deve ser maior que zero')
  }

  if (input.valor > 99999999.99) {
    erros.push('Valor do boleto excede o limite máximo de R$ 99.999.999,99')
  }

  if (!input.dataVencimento) {
    erros.push('Data de vencimento é obrigatória')
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dataVencimento)) {
    erros.push('Data de vencimento deve estar no formato YYYY-MM-DD')
  }

  if (!input.dataDocumento) {
    erros.push('Data do documento é obrigatória')
  }

  if (!input.especie) {
    erros.push('Espécie do documento é obrigatória (REC, NF, DM...)')
  }

  if (!input.descricao || input.descricao.trim().length === 0) {
    erros.push('Descrição/objeto do boleto é obrigatória')
  }

  // Instruções: trunca silenciosamente em vez de bloquear
  // (tratado na API, não precisa bloquear aqui)

  return erros
}

/**
 * Avisos não bloqueantes
 */
export function gerarAvisos(input: TituloEmissaoInput): string[] {
  const avisos: string[] = []

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const venc = new Date(input.dataVencimento + 'T12:00:00Z')
  if (venc < hoje) {
    const diasVencido = Math.floor((hoje.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24))
    avisos.push(`Atenção: Vencimento está ${diasVencido} dia(s) no passado`)
  }

  if (!input.pagador.complemento) {
    avisos.push('Complemento do endereço não informado')
  }

  if (input.desconto > input.valor) {
    avisos.push('Desconto configurado é maior que o valor do documento')
  }

  if (input.percJuros > 3) {
    avisos.push(`Taxa de juros de ${input.percJuros}%/dia está acima do padrão (máx recomendado: 3%/dia)`)
  }

  if (input.percMulta > 10) {
    avisos.push(`Multa de ${input.percMulta}% está elevada (máx legal: 2%)`)
  }

  return avisos
}

/**
 * Validação completa pré-emissão
 */
export function validarEmissao(
  input: TituloEmissaoInput,
  convenio: ConvenioBancario
): ValidationResult {
  const { erros: errosPagador, avisos: avisosPagador } = validarPagador(input.pagador)
  const errosConvenio = validarConvenio(convenio)
  const errosTitulo = validarTitulo(input)
  const avisosTitulo = gerarAvisos(input)

  const erros = [...errosPagador, ...errosConvenio, ...errosTitulo]
  const avisos = [...avisosPagador, ...avisosTitulo]

  return {
    valido: erros.length === 0,
    erros,
    avisos,
  }
}
