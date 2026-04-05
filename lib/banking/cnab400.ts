/**
 * lib/banking/cnab400.ts
 * Geração e Leitura profissional de arquivos CNAB 400 — Itaú Cobrança
 * SERVER-ONLY
 *
 * Referência: Manual de Cobrança Itaú Unibanco — CNAB 400
 * Válido para carteiras: 109, 112, 175
 *
 * REGRA ABSOLUTA: Cada linha deve ter EXATAMENTE 400 caracteres.
 * Toda posição documentada é 1-indexed conforme o manual bancário.
 */

import {
  calcDvMod10,
  calcDvNossoNumeroItau,
  calcDvAgenciaContaItau,
  formatarCpfCnpj,
} from './dv'
import type { ConvenioBancario, TituloCobranca, RegistroRetorno240 } from './types'

// ─── Interfaces específicas CNAB 400 ─────────────────────────────────────────

export interface RegistroRetorno400 {
  /** Tipo do registro (0=header, 1=detalhe, 9=trailer) */
  tipo: string
  /** [20-25] Agência do sacado (6 chars) */
  agenciaSacado?: string
  /** [26-30] Conta do sacado (5 chars) */
  contaSacado?: string
  /** [31] DV conta sacado */
  dvContaSacado?: string
  /** [38-62] Identificação do título na empresa (25 chars) */
  idEmpresa?: string
  /** [63-70] Nosso número (8 chars) */
  nossoNumero?: string
  /** [71] DV do nosso número */
  dvNossoNumero?: string
  /** [108-109] Código de ocorrência (2 chars) */
  ocorrencia?: string
  /** Descrição da ocorrência */
  descricaoOcorrencia?: string
  /** [110-115] Data da ocorrência DDMMAA */
  dataOcorrencia?: string
  /** [116-121] Data do vencimento DDMMAA */
  dataVencimento?: string
  /** [122-134] Valor do título (13 chars) */
  valorTitulo?: number
  /** [145-147] Banco cobrador */
  bancoCobrador?: string
  /** [148-152] Agência cobradora */
  agenciaCobradora?: string
  /** [153-165] Tarifa */
  valorTarifa?: number
  /** [166-178] Outras despesas */
  outrosCreditosDebitos?: number
  /** [179-184] Data de crédito DDMMAA */
  dataCredito?: string
  /** [185-197] Valor do IOF */
  valorIOF?: number
  /** [198-210] Valor do abatimento */
  valorAbatimento?: number
  /** [211-223] Desconto */
  valorDesconto?: number
  /** [224-236] Valor pago */
  valorPago?: number
  /** [237-249] Juros cobrados */
  valorJuros?: number
  /** [250-262] Outros créditos */
  outrosCreditos?: number
  /** Número sequencial do registro no arquivo */
  sequencial?: number
}

export interface ResultadoRemessa400 {
  conteudo: string
  filename: string
  qtdTitulos: number
  valorTotal: number
  qtdLinhas: number
  sequencialArquivo: number
}

// ─── Tabela de ocorrências Itaú CNAB 400 ─────────────────────────────────────

export const OCORRENCIAS_ITAU_400: Record<string, string> = {
  '02': 'Entrada Confirmada',
  '03': 'Entrada Rejeitada',
  '06': 'Liquidação Normal',
  '07': 'Liquidação por Conta',
  '08': 'Liquidação Garantida',
  '09': 'Baixa Simples',
  '10': 'Baixa por Liquidação',
  '11': 'Títulos em Aberto (Arquivo em Ser)',
  '12': 'Abatimento Concedido',
  '13': 'Abatimento Cancelado',
  '14': 'Vencimento Alterado',
  '15': 'Liquidação em Cartório',
  '16': 'Título Pago em Cheque — Aguardando Compensação',
  '17': 'Liquidação após Baixa ou Título não Registrado',
  '18': 'Acerto de depositária',
  '19': 'Confirmação de Recebimento de Instrução de Protesto',
  '20': 'Confirmação de Recebimento de Instrução de Sustação de Protesto',
  '21': 'Aguardando Autorização para Protesto',
  '22': 'Título com Pagamento Cancelado (Revertido)',
  '23': 'Entrada em Cartório',
  '24': 'Retirada de Cartório e Manutenção em Carteira',
  '25': 'Protestado e Baixado (Baixa por Ter Sido Protestado)',
  '26': 'Instrução Rejeitada',
  '27': 'Confirmação do Pedido de Alteração de Outros Dados',
  '28': 'Débito de Tarifas e Custas',
  '29': 'Ocorrências do Pagador',
  '30': 'Alteração de Outros Dados Rejeitada',
  '32': 'Instrução de Negativação Expressa Pendente',
  '33': 'Confirmação de Instrução de Negativação Expressa',
  '34': 'Confirmação de Cancelamento de Negativação Expressa',
  '35': 'Negativação Expressa Informacional (Cartório)',
  '36': 'Exclusão de Inclusão em Negativação Expressa Rejeitada',
}

export function interpretarOcorrencia400(cod: string): string {
  return OCORRENCIAS_ITAU_400[cod.trim()] || `Ocorrência ${cod} — consulte o manual Itaú CNAB 400`
}

// ─── Tabela de motivos de rejeição Itaú CNAB 400 ─────────────────────────────

export const MOTIVOS_REJEICAO_400: Record<string, string> = {
  '03': 'Agência/Conta Inválida ou Bloqueada',
  '04': 'Nosso Número Inválido (zerado) ou já Registrado',
  '10': 'Carteira Inválida',
  '15': 'Características da Cobrança Incompatíveis',
  '16': 'Data de Vencimento Inválida',
  '18': 'Vencimento Fora do Prazo Permitido pela Carteira',
  '20': 'Valor do Título Inválido (Zerado)',
  '21': 'Espécie do Documento Inválida',
  '22': 'Espécie não Compatível com a Modalidade',
  '24': 'Data de Emissão Inválida',
  '38': 'Prazo de d+ para Liquidação Maior do que o Permitido',
  '44': 'Agência Cedente Inválida',
  '45': 'Nome do Pagador Não Informado',
  '46': 'Logradouro Não Informado',
  '47': 'CEP Inválido',
  '48': 'CEP sem Praça de Cobrança',
  '49': 'CEP Referente a um Banco Correspondente',
  '50': 'CEP Incompatível com a UF',
  '51': 'UF Inválida',
  '52': 'CNPJ/CPF do Pagador Inválido',
}

// ─── Utilitários CNAB 400 ─────────────────────────────────────────────────────

/** Pad alfanumérico à direita com espaços (remove acentos e padroniza para evitar multibytes/offsets) */
const alfaD = (s: string | number | undefined | null, n: number): string => {
  const norm = String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()
  // Replace non-ascii chars to strict Latin-1 spaces
  const asciiOnly = norm.replace(/[^\x20-\x7E]/g, ' ')
  return asciiOnly.padEnd(n, ' ').slice(0, n)
}

/** Pad numérico à esquerda com zeros (trunca se maior) */
const numZ = (v: string | number | undefined | null, n: number): string =>
  String(v ?? '0').replace(/\D/g, '').padStart(n, '0').slice(-n)

/** Data DDMMAA para CNAB */
const dataDDMMAAA = (iso: string | undefined): string => {
  if (!iso) return '000000'
  const [ano, mes, dia] = (iso.slice(0, 10)).split('-')
  if (!ano || !mes || !dia) return '000000'
  return `${dia}${mes}${ano.slice(-2)}`
}

/** Valor em 13 dígitos (centavos) */
const valor13 = (v: number | undefined): string =>
  Math.round((v ?? 0) * 100).toString().padStart(13, '0').slice(-13)

/** Valor em 8 dígitos (centavos/dia — para juros) */
const valor8 = (v: number | undefined): string =>
  Math.round((v ?? 0) * 100).toString().padStart(8, '0').slice(-8)

/** Valida que a linha tem exatamente 400 chars */
function assert400(linha: string, descricao: string): string {
  if (linha.length !== 400) {
    throw new Error(
      `CNAB 400 — ${descricao}: linha deve ter 400 caracteres, obteve ${linha.length}.\n` +
      `Conteúdo: "${linha.slice(0, 50)}..."`
    )
  }
  return linha
}

/** Converte data DDMMAA de retorno CNAB para YYYY-MM-DD */
function parseDateDDMMYY(s: string): string {
  if (!s || s === '000000') return ''
  const dd = s.slice(0, 2)
  const mm = s.slice(2, 4)
  const yy = s.slice(4, 6)
  const ano = parseInt(yy) <= 30 ? `20${yy}` : `19${yy}`
  return `${ano}-${mm}-${dd}`
}

// ─── CÓDIGO DA INSTRUÇÃO DE COBRANÇA ─────────────────────────────────────────
// Itaú CNAB 400: instrução = 2 dígitos para cada campo
const INSTRUCOES_CNAB400: Record<string, [string, string]> = {
  sem_instrucao:     ['00', '00'],
  protestar_05d:     ['06', '05'],
  protestar_10d:     ['06', '10'],
  protestar_15d:     ['06', '15'],
  protestar_20d:     ['06', '20'],
  protestar_30d:     ['06', '30'],
  nao_protestar:     ['07', '00'],
  devolver_30d:      ['09', '30'],
  cobrar_taxa:       ['23', '00'],
  nao_cobrar_taxa:   ['24', '00'],
}

// ─── HEADER DA REMESSA ────────────────────────────────────────────────────────

/**
 * Gera o Header da Remessa CNAB 400 Itaú
 *
 * Layout exato — Manual Itaú Cobrança CNAB 400 (posições 1-indexed):
 * 001     (1)  Tipo Registro = 0
 * 002     (1)  Código Remessa = 1
 * 003-009 (7)  Literal REMESSA
 * 010-011 (2)  Código Serviço = 01
 * 012-026 (15) Literal identificação ex: "COBRANCA       "
 * 027-030 (4)  Agência cedente (sem dígito)
 * 031-032 (2)  Zeros
 * 033-037 (5)  Conta corrente cedente (5 dígitos, sem DV)
 * 038     (1)  DAC = MOD10(agência_4 + conta_5)  ← SEM o digitoConta
 * 039-046 (8)  Brancos
 * 047-076 (30) Nome cedente
 * 077-079 (3)  Código banco = 341
 * 080-094 (15) Nome banco = "BANCO ITAU SA  "
 * 095-100 (6)  Data geração DDMMAA
 * 101-394 (294) Brancos
 * 395-400 (6)  Sequencial do arquivo
 */
function gerarHeaderRemessa400(
  convenio: ConvenioBancario,
  dataGeracao: Date,
  sequencialArquivo: number
): string {
  const hoje = dataDDMMAAA(dataGeracao.toISOString().slice(0, 10))

  // Agência: 4 dígitos, sem DV
  const agNorm = convenio.agencia.replace(/\D/g, '').padStart(4, '0').slice(-4)
  // Conta: 5 dígitos, sem DV
  const contaH = numZ(convenio.conta, 5)
  // DAC = MOD10(agência_4 + conta_5) — SEM o digitoConta (confirmado pelo banco)
  const dacH    = calcDvMod10(agNorm + contaH)
  // DEFENSIVO: garante 1 char (0-9), nunca 'NaN' (que deslocaria pos 077='341' para pos 080)
  const dac     = Number.isFinite(dacH) ? (dacH % 10) : 0

  const h =
    '0'                          +  // [001]     Tipo arquivo (1)              → 1
    '1'                          +  // [002]     Código remessa (1)            → 2
    'REMESSA'                    +  // [003-009] Literal REMESSA (7)           → 9
    '01'                         +  // [010-011] Código serviço cobrança (2)   → 11
    alfaD('COBRANCA', 15)        +  // [012-026] Literal identificação (15)    → 26
    numZ(agNorm, 4)              +  // [027-030] Agência cedente (4)           → 30
    '00'                         +  // [031-032] Zeros (2)                     → 32
    contaH                       +  // [033-037] Conta corrente (5)            → 37
    String(dac)                  +  // [038]     DAC = MOD10(ag4+conta5) (1)  → 38
    ' '.repeat(8)                +  // [039-046] Brancos (8)                   → 46
    alfaD(convenio.cedente, 30)  +  // [047-076] Nome cedente (30)             → 76
    '341'                        +  // [077-079] Código banco Itaú (3)         → 79
    alfaD('BANCO ITAU SA', 15)   +  // [080-094] Nome banco (15)               → 94
    hoje                         +  // [095-100] Data geração DDMMAA (6)       → 100
    ' '.repeat(294)              +  // [101-394] Brancos (294)                 → 394
    numZ(sequencialArquivo, 6)      // [395-400] Sequencial arquivo (6)        → 400

  return assert400(h, 'Header Remessa')
}


// ─── DETALHE DA REMESSA ───────────────────────────────────────────────────────

/**
 * Código de espécie CNAB 400 Itaú
 */
const ESPECIE_CNAB400: Record<string, string> = {
  DM: '01',  // Duplicata Mercantil
  NP: '02',  // Nota Promissória
  NS: '03',  // Nota de Seguro
  CS: '04',  // Cobrança Seriada
  REC: '05', // Recibo
  LC: '06',  // Letra de Câmbio
  ND: '07',  // Nota de Débito
  DS: '08',  // Duplicata de Serviço
  NF: '13',  // Nota Fiscal
  DP: '09',  // Duplicata de Produção Rural
  EC: '10',  // Encargos Condominiais
  CC: '12',  // Conta-Corrente de Produto Rural
  BDP:'15',  // Boleto de Proposta
}

/**
 * Gera um Registro Detalhe CNAB 400 Itaú — Cobrança COM Registro (Carteira 109)
 *
 * Layout exato conforme Manual Itaú CNAB 400 e erros de validação retornados pelo banco:
 *
 * 001     (1)  Tipo = 1
 * 002-003 (2)  Tipo inscrição empresa: 01=CPF 02=CNPJ
 * 004-017 (14) CNPJ/CPF cedente
 * 018-021 (4)  Agência cedente (4 dígitos, zero-padded, SEM DV)
 * 022-023 (2)  Zeros (complemento — NÃO é DV agência no detalhe)
 * 024-028 (5)  Conta corrente cedente (5 dígitos, zero-padded, SEM DV)
 * 029     (1)  DAC = MOD10(agência_4 + conta_5) ← mesmo cálculo do header, SEM digitoConta
 * 030-037 (8)  Zeros (complemento)
 * 038-062 (25) Identificação do título na empresa (matching key)
 * 063-070 (8)  Nosso Número (8 dígitos, sem DV)
 * 071     (1)  DV Nosso Número = MOD10(carteira_3 + nossoNum_8)
 * 072-076 (5)  Zeros
 * 077-079 (3)  Nº banco = "341"
 * 080-107 (28) Zeros (campos internos banco)
 * 108-110 (3)  Código da Carteira = "109" para Itaú Cob. c/ Registro Cart. 109
 * 111-112 (2)  Identificação ocorrência = "01" (entrada/remessa)
 * 113-120 (8)  Zeros
 * 121-126 (6)  Data vencimento DDMMAA
 * 127-139 (13) Valor do título (centavos)
 * 140-142 (3)  Banco cobrador zeros
 * 143-147 (5)  Agência cobrador zeros
 * 148-149 (2)  Espécie do título
 * 150     (1)  Aceite: A ou N
 * 151-156 (6)  Data emissão DDMMAA
 * 157-158 (2)  1ª instrução de cobrança
 * 159-160 (2)  2ª instrução de cobrança
 * 161-173 (13) Mora/juros por dia (centavos)
 * 174-179 (6)  Data limite desconto zeros
 * 180-192 (13) Valor desconto zeros
 * 193-205 (13) IOF zeros
 * 206-218 (13) Abatimento zeros
 * 219-220 (2)  Tipo inscrição sacado: 01=CPF 02=CNPJ
 * 221-234 (14) CPF/CNPJ sacado
 * 235-274 (40) Nome sacado
 * 275-314 (40) Endereço sacado (logradouro + número)
 * 315-326 (12) Bairro sacado
 * 327-334 (8)  CEP sacado (8 dígitos sem traço)
 * 335-349 (15) Cidade sacado
 * 350-351 (2)  UF sacado
 * 352-391 (40) Uso banco (brancos)
 * 392-394 (3)  Brancos (NÃO zeros — campo complemento)
 * 395-400 (6)  Sequencial
 */
function gerarDetalheRemessa400(
  titulo: TituloCobranca,
  convenio: ConvenioBancario,
  sequencial: number
): string {
  // ── Nosso Número: 8 dígitos ──────────────────────────────────────────────────
  const nossoNum = (titulo.nossoNumero || '').replace(/\D/g, '').padStart(8, '0').slice(-8)
  // DEFENSIVO: garante sempre 1 dígito (0-9). Se calcDv retornar NaN → 'NaN' = 3 chars
  // e desloca '341' de pos 77 para pos 80 → banco vê '000'. Fix: % 10 com fallback 0.
  const dvNNRaw  = calcDvNossoNumeroItau(nossoNum, (convenio.carteira || '109'))
  const dvNN     = Number.isFinite(dvNNRaw) ? (dvNNRaw % 10) : 0

  // ── Cedente ──────────────────────────────────────────────────────────────────
  const cnpjCedente = (convenio.cnpj || '').replace(/\D/g, '')
  const tipoCedente = cnpjCedente.length === 11 ? '01' : '02'
  const agNorm = (convenio.agencia || '').replace(/\D/g, '').padStart(4, '0').slice(-4)
  const contaNorm = numZ(convenio.conta, 5)
  // DAC = MOD10(agência_4 + conta_5) — SEM digitoConta (CORRIGIDO)
  // DEFENSIVO: garante sempre 1 dígito (0-9), nunca 'NaN'.
  const dacRaw  = calcDvMod10(agNorm + contaNorm)
  const dac     = Number.isFinite(dacRaw) ? (dacRaw % 10) : 0

  // ── Sacado — garante que CPF/CNPJ e nome nunca ficam em branco ───────────────
  const cpfCnpjRaw = (
    (titulo.pagadorCpfCnpj || '').replace(/\D/g, '') ||
    ((titulo as unknown as Record<string, unknown>).pagador as Record<string,string>|undefined)?.cpfCnpj?.replace(/\D/g,'') ||
    ''
  )
  const cpfCnpj = cpfCnpjRaw.length >= 11 ? cpfCnpjRaw : '00000000000'
  const tipoPagador = cpfCnpj.length === 11 ? '01' : '02'

  const nomeSacado = (
    titulo.pagadorNome ||
    ((titulo as unknown as Record<string, unknown>).pagador as Record<string,string>|undefined)?.nome ||
    titulo.responsavel ||
    titulo.aluno ||
    'A INFORMAR'
  ).trim()

  const cepSacado = (
    (titulo.pagadorCEP || '').replace(/\D/g, '') ||
    ((titulo as unknown as Record<string, unknown>).pagador as Record<string,string>|undefined)?.cep?.replace(/\D/g,'') ||
    ''
  ).padStart(8, '0').slice(-8)
  const cidadeSacado = (
    titulo.pagadorCidade ||
    ((titulo as unknown as Record<string, unknown>).pagador as Record<string,string>|undefined)?.cidade ||
    'A INFORMAR'
  ).trim()
  const ufSacado = (
    titulo.pagadorUF ||
    ((titulo as unknown as Record<string, unknown>).pagador as Record<string,string>|undefined)?.uf ||
    'SP'
  ).trim().slice(0, 2).toUpperCase()
  const logradouroSacado = [
    titulo.pagadorLogradouro ||
    ((titulo as unknown as Record<string, unknown>).pagador as Record<string,string>|undefined)?.logradouro ||
    'A INFORMAR',
    titulo.pagadorNumero ||
    ((titulo as unknown as Record<string, unknown>).pagador as Record<string,string>|undefined)?.numero ||
    'S/N',
  ].filter(Boolean).join(', ')
  const bairroSacado = (
    titulo.pagadorBairro ||
    ((titulo as unknown as Record<string, unknown>).pagador as Record<string,string>|undefined)?.bairro ||
    'A INFORMAR'
  ).trim()

  // ── Instrução de cobrança ────────────────────────────────────────────────────
  const instrKey   = convenio.instrucoes || 'nao_protestar'
  const [instr1, instr2] = INSTRUCOES_CNAB400[instrKey] || ['07', '00']

  // ── Datas ────────────────────────────────────────────────────────────────────
  const dataVenc    = dataDDMMAAA(titulo.dataVencimento || titulo.vencimento)
  const dataEmissao = dataDDMMAAA(titulo.dataDocumento  || new Date().toISOString().slice(0, 10))

  // ── Espécie ──────────────────────────────────────────────────────────────────
  const especieCod = ESPECIE_CNAB400[titulo.especie || 'DM'] || '01'

  // ── Mora por dia (centavos) ──────────────────────────────────────────────────
  const jurosDia = titulo.percJuros
    ? Math.round(((titulo.percJuros / 100) * titulo.valor) * 100).toString().padStart(13, '0').slice(-13)
    : '0'.repeat(13)

  // ── ID empresa: chave de matching para retorno (25 chars) ────────────────────
  const idEmpresa = alfaD(titulo.nossoNumero || titulo.numeroDocumento || titulo.id || '', 25)

  // ── Aceite ───────────────────────────────────────────────────────────────────
  const aceite = titulo.aceite || 'N'

  // ── Carteira: 3 dígitos ex: "109" ─────────────────────────────────────────────
  const carteiraCod = (convenio.carteira || '109').toString().padStart(3, '0').slice(-3)

  /**
   * LAYOUT DETALHE ITAÚ CNAB 400 — REFERÊNCIA: github.com/eduardokum/laravel-boleto
   * Campos auditados byte a byte contra a implementação canônica PHP.
   *
   * ATENÇÃO — Layout real Itaú Carteira 109:
   *   [063-070] Nosso Número (8 dígitos, SEM o DV)
   *   [071-083] TREZE ZEROS (Qtd moeda variável) — pos 077-079 está dentro deste bloco → deve ser '000'
   *   [084-086] Código da Carteira (3) ex: '109'
   *   [087-107] Brancos (21)
   *   [108]     'I'
   *   [109-110] Ocorrência '01'
   *   [111-120] Número do Documento (10 chars, alfanumérico)
   *   [140-142] Código do Banco cobrador = '341' (Itaú)
   */
  const numDocumento = alfaD(titulo.numeroDocumento || titulo.nossoNumero || titulo.id || '', 10)

  const d =
    '1'                                          +  // [001]     Tipo detalhe (1)                    → 1
    tipoCedente                                  +  // [002-003] Tipo inscrição cedente (2)           → 3
    numZ(cnpjCedente, 14)                        +  // [004-017] CNPJ/CPF cedente (14)                → 17
    numZ(agNorm, 4)                              +  // [018-021] Agência cedente (4)                  → 21
    '00'                                         +  // [022-023] Zeros (2)                            → 23
    contaNorm                                    +  // [024-028] Conta corrente (5)                   → 28
    String(dac)                                  +  // [029]     DAC = MOD10(ag4+conta5) (1)          → 29
    ' '.repeat(4)                                +  // [030-033] Brancos (4)                          → 33
    '0000'                                       +  // [034-037] Zeros — Cód. Instrução Cancelada (4) → 37
    idEmpresa                                    +  // [038-062] ID empresa/título (25)               → 62
    nossoNum                                     +  // [063-070] Nosso Número 8 dígitos SEM DV        → 70
    '0'.repeat(13)                               +  // [071-083] 13 zeros (Qtd moeda variável)        → 83
    numZ(convenio.carteira || '109', 3)          +  // [084-086] Código carteira (3) ex: '109'        → 86
    ' '.repeat(21)                               +  // [087-107] Brancos (21)                         → 107
    'I'                                          +  // [108]     Tipo carteira = 'I' (Com Registro)   → 108
    '01'                                         +  // [109-110] Ocorrência = '01' (Remessa)          → 110
    numDocumento                                 +  // [111-120] Número do documento (10)             → 120
    dataVenc                                     +  // [121-126] Data vencimento DDMMAA (6)           → 126
    valor13(titulo.valor)                        +  // [127-139] Valor título centavos (13)           → 139
    '341'                                        +  // [140-142] Banco cobrador = '341' Itaú (3)      → 142
    '00000'                                      +  // [143-147] Agência cobrador zeros (5)            → 147
    numZ(especieCod, 2)                          +  // [148-149] Espécie do título (2)                → 149
    aceite                                       +  // [150]     Aceite A/N (1)                       → 150
    dataEmissao                                  +  // [151-156] Data emissão DDMMAA (6)              → 156
    instr1                                       +  // [157-158] 1ª instrução (2)                     → 158
    instr2                                       +  // [159-160] 2ª instrução (2)                     → 160
    jurosDia                                     +  // [161-173] Mora/dia centavos (13)               → 173
    '000000'                                     +  // [174-179] Data desconto zeros (6)              → 179
    '0'.repeat(13)                               +  // [180-192] Valor desconto zeros (13)            → 192
    '0'.repeat(13)                               +  // [193-205] IOF zeros (13)                       → 205
    '0'.repeat(13)                               +  // [206-218] Abatimento zeros (13)                → 218
    tipoPagador                                  +  // [219-220] Tipo inscrição sacado (2)            → 220
    numZ(cpfCnpj, 14)                            +  // [221-234] CPF/CNPJ sacado (14)                 → 234
    alfaD(nomeSacado, 30)                        +  // [235-264] Nome sacado (30)                     → 264
    ' '.repeat(10)                               +  // [265-274] Brancos (10)                         → 274
    alfaD(logradouroSacado, 40)                  +  // [275-314] Logradouro + Nº (40)                → 314
    alfaD(bairroSacado, 12)                      +  // [315-326] Bairro sacado (12)                   → 326
    cepSacado                                    +  // [327-334] CEP (8 dígitos sem traço)            → 334
    alfaD(cidadeSacado, 15)                      +  // [335-349] Cidade sacado (15)                   → 349
    alfaD(ufSacado, 2)                           +  // [350-351] UF sacado (2)                        → 351
    ' '.repeat(30)                               +  // [352-381] Sacador/Avalista (30)                → 381
    ' '.repeat(4)                                +  // [382-385] Brancos (4)                          → 385
    '000000'                                     +  // [386-391] Data de mora DDMMAA zeros (6)        → 391
    '00'                                         +  // [392-393] Qtd dias protesto zeros (2)          → 393
    ' '                                          +  // [394]     Complemento branco (1)               → 394
    numZ(sequencial, 6)                             // [395-400] Sequencial (6)                       → 400

  // Validação programática obrigatória — garante alinhamento correto
  if (d.substring(76, 79) !== '000') {
    throw new Error(`CNAB400 LAYOUT ERROR: pos 077-079 deve ser '000' (dentro do bloco 13-zeros), obteve '${d.substring(76, 79)}'. Desalinhamento detectado em campo anterior.`)
  }
  if (d.substring(139, 142) !== '341') {
    throw new Error(`CNAB400 LAYOUT ERROR: pos 140-142 (banco cobrador) deve ser '341', obteve '${d.substring(139, 142)}'.`)
  }
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[CNAB400] NN:${nossoNum} | len=${d.length} | pos077-079="${d.substring(76,79)}" | pos084-086="${d.substring(83,86)}" | pos140-142="${d.substring(139,142)}" | pos395-400="${d.substring(394,400)}"`)
  }
  return assert400(d, `Detalhe Remessa NN:${nossoNum}`)

}








// ─── TRAILER DA REMESSA ───────────────────────────────────────────────────────

function gerarTrailerRemessa400(
  qtdTitulos: number,
  valorTotal: number,
  sequencial: number
): string {
  const t =
    '9' +                                // [001]     Tipo trailer
    ' '.repeat(393) +                    // [002-394] Brancos
    numZ(sequencial, 6)                  // [395-400] Sequencial final

  return assert400(t, 'Trailer Remessa')
}

// ─── GERAÇÃO COMPLETA DO ARQUIVO REMESSA CNAB 400 ────────────────────────────

/**
 * Gera o arquivo de remessa CNAB 400 completo
 * Cada linha tem exatamente 400 caracteres
 *
 * @param titulos - Lista de títulos a incluir (devem ter nosso número já gerado)
 * @param convenio - Configuração bancária
 * @param sequencialArquivo - Sequencial da remessa (controle do beneficiário)
 */
export function gerarArquivoRemessa400(
  titulos: TituloCobranca[],
  convenio: ConvenioBancario,
  sequencialArquivo: number = 1
): ResultadoRemessa400 {
  if (titulos.length === 0) {
    throw new Error('CNAB 400: Nenhum título informado para a remessa')
  }

  const hoje = new Date()
  const linhas: string[] = []
  let seqReg = 1

  // Header
  linhas.push(gerarHeaderRemessa400(convenio, hoje, sequencialArquivo))
  seqReg++

  // Detalhes
  for (const titulo of titulos) {
    linhas.push(gerarDetalheRemessa400(titulo, convenio, seqReg))
    seqReg++
  }

  // Trailer
  const valorTotal = titulos.reduce((s, t) => s + t.valor, 0)
  linhas.push(gerarTrailerRemessa400(titulos.length, valorTotal, seqReg))

  // Valida todas as linhas antes de retornar
  const linhasInvalidas = linhas.filter(l => l.length !== 400)
  if (linhasInvalidas.length > 0) {
    throw new Error(
      `CNAB 400: ${linhasInvalidas.length} linha(s) com comprimento inválido. ` +
      `Comprimentos: ${linhasInvalidas.map(l => l.length).join(', ')}`
    )
  }

  const dataStr = hoje.toISOString().slice(0, 10).replace(/-/g, '')
  const filename = `REMESSA_ITAU_${numZ(sequencialArquivo, 6)}_${dataStr}.rem`
  const conteudo = linhas.join('\r\n') + '\r\n'

  return {
    conteudo,
    filename,
    qtdTitulos: titulos.length,
    valorTotal,
    qtdLinhas: linhas.length,
    sequencialArquivo,
  }
}

// ─── PROCESSAMENTO DO RETORNO CNAB 400 ───────────────────────────────────────

/**
 * Processa o arquivo de retorno CNAB 400 do Itaú
 * Extrai todas as ocorrências e dados de pagamento
 */
export function processarRetornoCNAB400(conteudo: string): {
  header: Record<string, string>
  registros: RegistroRetorno400[]
  trailer: Record<string, string>
  resumo: {
    liquidados: number
    valorTotalPago: number
    rejeitados: number
    baixados: number
    totalRegistros: number
  }
} {
  const linhas = conteudo.split(/\r?\n/).filter(l => l.length >= 400)

  let headerData: Record<string, string> = {}
  let trailerData: Record<string, string> = {}
  const registros: RegistroRetorno400[] = []

  for (const linha of linhas) {
    const tipo = linha[0]

    if (tipo === '0') {
      // Header do retorno
      headerData = {
        tipoRemessa: linha[1],              // '2' = retorno
        literal: linha.slice(2, 9).trim(),
        nomeEmpresa: linha.slice(26, 46).trim(),
        codigoBanco: linha.slice(62, 65),
        nomeBanco: linha.slice(65, 75).trim(),
        dataGravacao: parseDateDDMMYY(linha.slice(86, 92)),
        sequencial: linha.slice(394, 400).trim(),
      }
      continue
    }

    if (tipo === '9') {
      // Trailer
      const qtdTitulos = parseInt(linha.slice(394, 400).trim())
      trailerData = {
        quantidadeTitulos: String(qtdTitulos),
        sequencial: linha.slice(394, 400).trim(),
        // Valor total pode estar em posições específicas por banco
      }
      continue
    }

    if (tipo !== '1') continue // Pula registros desconhecidos

    // ─── Detalhe do retorno ───────────────────────────────────────────────
    // Todas as posições são 1-indexed conforme manual; em código usamos 0-indexed (pos-1)
    const ocorrencia = linha.slice(108, 110).trim()

    const registro: RegistroRetorno400 = {
      tipo: '1',
      // [002-005] Agência cedente
      agenciaSacado: linha.slice(1, 5).trim(),
      // [020-044] ID empresa (chave para matching)
      idEmpresa: linha.slice(19, 44).trim(),
      // [045-052] Nosso número (8 chars)
      nossoNumero: linha.slice(44, 52).trim(),
      // [053] DV do nosso número
      dvNossoNumero: linha.slice(52, 53),
      // [067-076] Número do documento
      // [077-082] Vencimento DDMMAA
      dataVencimento: parseDateDDMMYY(linha.slice(76, 82)),
      // [083-095] Valor do título (13 chars, centavos)
      valorTitulo: parseInt(linha.slice(82, 95) || '0') / 100,
      // [108-109] Código de ocorrência
      ocorrencia,
      descricaoOcorrencia: interpretarOcorrencia400(ocorrencia),
      // [110-115] Data da ocorrência/pagamento DDMMAA
      dataOcorrencia: parseDateDDMMYY(linha.slice(109, 115)),
      // [116-121] Data de crédito DDMMAA
      dataCredito: parseDateDDMMYY(linha.slice(115, 121)),
      // [122-134] Valor pago (13 chars)
      valorPago: parseInt(linha.slice(121, 134) || '0') / 100,
      // [135-147] IOF (13 chars)
      valorIOF: parseInt(linha.slice(134, 147) || '0') / 100,
      // [148-160] Abatimento (13 chars)
      valorAbatimento: parseInt(linha.slice(147, 160) || '0') / 100,
      // [161-173] Desconto (13 chars)
      valorDesconto: parseInt(linha.slice(160, 173) || '0') / 100,
      // [174-186] Juros (13 chars)
      valorJuros: parseInt(linha.slice(173, 186) || '0') / 100,
      // [187-199] Outros créditos (13 chars)
      outrosCreditos: parseInt(linha.slice(186, 199) || '0') / 100,
      // [395-400] Sequencial
      sequencial: parseInt(linha.slice(394, 400)) || 0,
    }

    registros.push(registro)
  }

  // Resumo dos registros
  const liquidados = registros.filter(r => ['06','07','08','10','15','16','17'].includes(r.ocorrencia || '')).length
  const rejeitados = registros.filter(r => ['03','26','30'].includes(r.ocorrencia || '')).length
  const baixados   = registros.filter(r => ['09','25'].includes(r.ocorrencia || '')).length
  const valorTotalPago = registros
    .filter(r => ['06','07','08','10','15','16','17'].includes(r.ocorrencia || ''))
    .reduce((s, r) => s + (r.valorPago || 0), 0)

  return {
    header: headerData,
    registros,
    trailer: trailerData,
    resumo: {
      liquidados,
      valorTotalPago,
      rejeitados,
      baixados,
      totalRegistros: registros.length,
    },
  }
}

// ─── GERAÇÃO DE RETORNO SIMULADO (sandbox/homologação) ───────────────────────

/**
 * Gera um arquivo de retorno CNAB 400 simulado para testes
 * Útil para homologação antes de ter acesso ao banco em produção
 *
 * @param titulos - Títulos da remessa original
 * @param convenio - Configuração bancária
 * @param ocorrencia - Ocorrência a simular ('06'=liquidado, '03'=rejeitado, etc.)
 */
export function gerarRetornoSimulado400(
  titulos: TituloCobranca[],
  convenio: ConvenioBancario,
  ocorrencia: string = '06'
): { conteudo: string; filename: string } {
  const hoje = new Date()
  const linhas: string[] = []
  let seqReg = 1

  // Header retorno
  const header =
    '0' +
    '2' +                                     // retorno
    'RETORNO' +
    '01' +
    alfaD('COBRANCA', 15) +
    numZ(convenio.agencia, 4) +
    (convenio.digitoAgencia || '0')[0] +
    numZ(convenio.conta, 5) +
    (convenio.digitoConta || '0')[0] +
    '0' +
    alfaD(convenio.cedente, 30) +
    '341' +
    alfaD('BANCO ITAU SA', 15) +
    dataDDMMAAA(hoje.toISOString().slice(0, 10)) +
    ' '.repeat(294) +
    numZ(convenio.convenio, 7) +
    ' ' +
    numZ(seqReg, 6)

  linhas.push(assert400(header, 'Header Retorno Simulado'))
  seqReg++

  const dataOcorrencia = dataDDMMAAA(hoje.toISOString().slice(0, 10))

  for (const titulo of titulos) {
    const nossoNum = (titulo.nossoNumero || '').padStart(8, '0')
    // dvNN sempre recalculado — não confia no valor persistido
    const dvNN = calcDvNossoNumeroItau(nossoNum, convenio.carteira)
    // idEmpresa must match what was sent in the remessa (titulo.id)
    const idEmpresa = alfaD(titulo.id || titulo.nossoNumero || titulo.numeroDocumento || '', 25)
    const dataVenc = dataDDMMAAA(titulo.dataVencimento || titulo.vencimento)


    // Detalhe de RETORNO Itaú CNAB 400 — posições fixas, EXATAMENTE 400 chars
    // Referência: Manual de Cobrança Itaú CNAB 400 — Registro Tipo 1 Retorno
    const det =
      '1' +                                        // [001]     Tipo registro (1 char) = 1
      numZ(convenio.agencia, 4) +                  // [002-005] Agência cedente (4) = 5
      (convenio.digitoAgencia || '0')[0] +         // [006]     DV agência (1) = 6
      numZ(convenio.conta, 5) +                    // [007-011] Conta cedente (5) = 11
      (convenio.digitoConta || '0')[0] +           // [012]     DV conta (1) = 12
      '0' +                                        // [013]     Complemento (1) = 13
      ' '.repeat(6) +                              // [014-019] Uso banco brancos (6) = 19
      idEmpresa +                                  // [020-044] Identificação empresa (25) = 44
      nossoNum +                                   // [045-052] Nosso número (8) = 52
      dvNN.toString() +                            // [053]     DV nosso número (1) = 53
      ' '.repeat(20) +                             // [054-073] Uso banco brancos (20) = 73
      alfaD(titulo.numeroDocumento || '', 10) +    // [074-083] Nº documento (10) = 83
      ' '.repeat(20) +                             // [084-103] Uso banco (20) = 103
      ' '.repeat(4) +                              // [104-107] Uso banco (4) = 107
      ocorrencia.padStart(2, '0') +                // [108-109] Código ocorrência (2) = 109
      dataOcorrencia +                             // [110-115] Data ocorrência DDMMAA (6) = 115
      dataVenc +                                   // [116-121] Data vencimento DDMMAA (6) = 121
      valor13(titulo.valor) +                      // [122-134] Valor título (13) = 134
      '341' +                                      // [135-137] Banco cobrador (3) = 137
      numZ(0, 5) +                                 // [138-142] Agência cobradora (5) = 142
      '00' +                                       // [143-144] 1ª instrução (2) = 144
      '00' +                                       // [145-146] 2ª instrução (2) = 146
      '00000000' +                                 // [147-154] Mora/dia (8) = 154
      dataOcorrencia +                             // [155-160] Data crédito DDMMAA (6) = 160
      valor13(titulo.valor) +                      // [161-173] Valor pago (13) = 173
      valor13(0) +                                 // [174-186] Desconto (13) = 186
      valor13(0) +                                 // [187-199] Abatimento (13) = 199
      '01' +                                       // [200-201] Tipo pagador (2) = 201
      numZ(0, 14) +                                // [202-215] CPF/CNPJ (14) = 215
      alfaD(titulo.pagadorNome || titulo.responsavel || '', 30) + // [216-245] Nome (30) = 245
      ' '.repeat(10) +                             // [246-255] Uso banco (10) = 255
      alfaD('', 40) +                              // [256-295] Endereço (40) = 295
      alfaD(titulo.pagadorBairro || '', 12) +      // [296-307] Bairro (12) = 307
      numZ(0, 8) +                                 // [308-315] CEP (8) = 315
      alfaD(titulo.pagadorCidade || '', 15) +      // [316-330] Cidade (15) = 330
      alfaD(titulo.pagadorUF || 'SP', 2) +         // [331-332] UF (2) = 332
      valor13(0) +                                 // [333-345] IOF (13) = 345
      valor13(0) +                                 // [346-358] Outros (13) = 358
      ' '.repeat(36) +                             // [359-394] Uso banco brancos (36) = 394
      numZ(seqReg, 6)                              // [395-400] Sequencial (6) = 400

    linhas.push(assert400(det, `Detalhe Retorno Simulado ${titulo.id}`))
    seqReg++
  }


  // Trailer
  const trailer =
    '9' +
    ' '.repeat(393) +
    numZ(seqReg, 6)

  linhas.push(assert400(trailer, 'Trailer Retorno Simulado'))

  const dateStr = hoje.toISOString().slice(0, 10).replace(/-/g, '')
  const filename = `RETORNO_SIMULADO_${dateStr}_${ocorrencia}.ret`

  return {
    conteudo: linhas.join('\r\n') + '\r\n',
    filename,
  }
}

// ─── Mapeamento de ocorrência → statusBancario ────────────────────────────────

export const OCORRENCIA_STATUS_400: Record<string, string> = {
  '02': 'registrado',
  '03': 'rejeitado',
  '06': 'liquidado',
  '07': 'liquidado',
  '08': 'liquidado',
  '09': 'baixado',
  '10': 'baixado',
  '15': 'liquidado',
  '16': 'liquidado',
  '17': 'liquidado',
  '25': 'baixado',
}
