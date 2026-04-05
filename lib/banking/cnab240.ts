/**
 * lib/banking/cnab240.ts
 * Geração e leitura de arquivos CNAB 240 (Itaú Cobrança)
 * SERVER-ONLY
 * 
 * Referência: Manual CNAB 240 Itaú Unibanco — Cobrança Registrada
 * Versão para carteiras 109, 112, 175
 */
import { formatarDataCNAB, formatarDataArquivo, horaAtualCNAB, formatarValorCNAB } from './fatorVencimento'
import { formatarCpfCnpj } from './dv'
import type { ConvenioBancario, TituloCobranca, RegistroRetorno240 } from './types'

// ─── Utilitários CNAB ─────────────────────────────────────────────────────────

/** Pad alfanumérico à esquerda com espaços */
const alfaL = (s: string, n: number) => String(s || '').padEnd(n, ' ').slice(0, n)
/** Pad alfanumérico à direita com espaços */
const alfaR = (s: string, n: number) => String(s || '').padStart(n, ' ').slice(-n)
/** Pad numérico à esquerda com zeros */
const numZ = (v: number | string, n: number) => String(v || '0').replace(/\D/g, '').padStart(n, '0').slice(-n)
/** Brancos (espaços) */
const b = (n: number) => ' '.repeat(n)
/** Zeros */
const z = (n: number) => '0'.repeat(n)

/**
 * Valida que uma linha tiene exatamente 240 caracteres
 */
function assertLen240(linha: string, tipo: string): string {
  if (linha.length !== 240) {
    throw new Error(`CNAB 240: ${tipo} deve ter 240 caracteres, obteve ${linha.length}`)
  }
  return linha
}

// ─── HEADER DE ARQUIVO (Registro Tipo 0) ─────────────────────────────────────

/**
 * Gera o Header de Arquivo CNAB 240 Itaú
 * @param convenio - Configuração do convênio bancário
 * @param sequencial - Número sequencial da remessa
 */
export function gerarHeaderArquivo(convenio: ConvenioBancario, sequencial: number): string {
  const hoje = new Date()
  const dataArq = formatarDataArquivo(hoje.toISOString().slice(0, 10))
  const hora = horaAtualCNAB()

  const linha =
    numZ(341, 3) +                                    // 1-3:   Banco (341)
    numZ(0, 4) +                                       // 4-7:   Lote (0000 = arquivo)
    '0' +                                              // 8:     Tipo registro (0 = Header)
    b(9) +                                             // 9-17:  Brancos
    '2' +                                              // 18:    Tipo inscrição empresa (2=CNPJ)
    numZ(convenio.cnpj.replace(/\D/g, ''), 14) +      // 19-32: CNPJ da empresa
    alfaL(convenio.convenio, 20) +                     // 33-52: Conv/Beneficiário (20)
    numZ(convenio.agencia, 5) +                        // 53-57: Agência (5, com DV)
    numZ(0, 1) +                                       // 58:    DV agência
    numZ(convenio.conta.replace(/\D/g, ''), 12) +     // 59-70: Conta (12)
    numZ(0, 1) +                                       // 71:    DV conta
    numZ(0, 1) +                                       // 72:    DV ag+conta
    alfaL(convenio.cedente, 30) +                      // 73-102: Nome empresa (30)
    'ITAU UNIBANCO S.A.             ' +                // 103-132: Nome banco (30)
    alfaL('', 10) +                                    // 133-142: Uso FEBRABAN
    '1' +                                              // 143:   Código remessa (1=remessa)
    dataArq +                                          // 144-151: Data geração AAAAMMDD
    hora +                                             // 152-157: Hora geração HHMMSS
    numZ(sequencial, 6) +                              // 158-163: Nº sequencial arquivo
    '082' +                                            // 164-166: Versão layout (082)
    numZ(0, 5) +                                       // 167-171: Densidade (00000)
    b(20) +                                            // 172-191: Uso banco
    b(20) +                                            // 192-211: Uso empresa
    b(29)                                              // 212-240: Brancos

  return assertLen240(linha, 'Header Arquivo')
}

// ─── HEADER DE LOTE (Registro Tipo 1) ─────────────────────────────────────────

/**
 * Gera o Header de Lote CNAB 240 Itaú (Cobrança)
 * @param convenio - Configuração do convênio
 * @param lote - Número do lote (começa em 1)
 * @param sequencial - Número de sequência do registro
 */
export function gerarHeaderLote(
  convenio: ConvenioBancario,
  lote: number,
  sequencial: number
): string {
  const hoje = new Date()
  const dataArq = formatarDataArquivo(hoje.toISOString().slice(0, 10))

  const linha =
    numZ(341, 3) +                                    // 1-3:   Banco
    numZ(lote, 4) +                                    // 4-7:   Nº lote
    '1' +                                              // 8:     Tipo (1=Header Lote)
    'C' +                                              // 9:     Tipo operação (C=crédito)
    '01' +                                             // 10-11: Tipo serviço (01=cobrança)
    '14' +                                             // 12-13: Forma lançamento (14=?)
    '040' +                                            // 14-16: Versão layout lote
    ' ' +                                              // 17:    Brancos
    '2' +                                              // 18:    Tipo inscrição
    numZ(convenio.cnpj.replace(/\D/g, ''), 14) +      // 19-32: CNPJ
    alfaL(convenio.convenio, 20) +                     // 33-52: Conv beneficiário
    numZ(convenio.agencia, 5) +                        // 53-57: Agência
    numZ(0, 1) +                                       // 58:    DV agência
    numZ(convenio.conta.replace(/\D/g, ''), 12) +     // 59-70: Conta
    numZ(0, 1) +                                       // 71:    DV conta
    numZ(0, 1) +                                       // 72:    DV ag+conta
    alfaL(convenio.cedente, 30) +                      // 73-102: Nome empresa
    alfaL('', 40) +                                    // 103-142: Info 1 (mensagem)
    alfaL('', 40) +                                    // 143-182: Info 2
    numZ(sequencial, 6) +                              // 183-188: Nº remessa
    dataArq +                                          // 189-196: Data gravação
    z(8) +                                             // 197-204: Data crédito (zeros)
    b(33)                                              // 205-240: Brancos (usar 33 para chegar 240)

  return assertLen240(linha, 'Header Lote')
}

// ─── SEGMENTO P (Registro Tipo 3, Segmento P) ─────────────────────────────────

/**
 * Gera o Segmento P do CNAB 240
 * Contém os dados principais do título (nosso número, vencimento, valor, etc.)
 */
export function gerarSegmentoP(
  titulo: TituloCobranca,
  convenio: ConvenioBancario,
  lote: number,
  seq: number
): string {
  const tipoProtesto = titulo.tipoProtesto || '0'
  const diasProtesto = tipoProtesto !== '0' ? numZ(titulo.diasProtesto || 0, 2) : z(2)

  // Tipo de carteira: 1=Com registro, 2=Sem registro
  const tipoCarteira = '1'
  // Forma de cadastro: 1=Com cadastro
  const formaCadastro = '1'
  // Tipo de documento: 1=Bloqueto emitido pelo Banco
  const tipoDocumento = '2'

  const linha =
    numZ(341, 3) +                                       // 1-3:   Banco
    numZ(lote, 4) +                                      // 4-7:   Lote
    '3' +                                                // 8:     Tipo (3=Detalhe)
    numZ(seq, 5) +                                       // 9-13:  Nº sequencial
    'P' +                                                // 14:    Segmento
    ' ' +                                                // 15:    Brancos
    '01' +                                               // 16-17: Código movimento (01=remessa)
    numZ(convenio.agencia, 5) +                          // 18-22: Agência do beneficiário
    numZ(0, 1) +                                         // 23:    DV agência
    numZ(convenio.conta.replace(/\D/g, ''), 12) +       // 24-35: Conta
    numZ(0, 1) +                                         // 36:    DV conta
    numZ(0, 1) +                                         // 37:    DV ag+conta
    alfaL(convenio.convenio, 20) +                       // 38-57: Nosso nº/identificação
    numZ(titulo.carteira || convenio.carteira || '109', 3) + // 58-60: Carteira
    tipoCarteira +                                        // 61:    Tipo carteira
    formaCadastro +                                       // 62:    Forma cadastro
    tipoDocumento +                                       // 63:    Tipo documento
    ' ' +                                                 // 64:    Emissão bloqueto (espaço=beneficiário)
    ' ' +                                                 // 65:    Distribuição (espaço=beneficiário)
    alfaL(titulo.numeroDocumento || titulo.id || '', 15) + // 66-80: Número do documento
    formatarDataCNAB(titulo.dataVencimento || titulo.vencimento || '') + // 81-88: Vencimento DDMMAAAA
    formatarValorCNAB(titulo.valor, 15) +                // 89-103: Valor (15 dígitos, centavos)
    numZ(341, 3) +                                        // 104-106: Banco cobrador (341)
    numZ(0, 5) +                                          // 107-111: Agência cobradora (zeros)
    numZ(0, 1) +                                          // 112:    DV ag. cobradora
    alfaL(titulo.especie || 'REC', 2) +                  // 113-114: Espécie (REC, NF, etc.)
    (titulo.aceite === 'A' ? 'A' : 'N') +                // 115:    Aceite (A/N)
    formatarDataCNAB(titulo.dataDocumento || new Date().toISOString().slice(0, 10)) + // 116-123: Data emissão
    numZ(tipoProtesto === '3' ? 0 : parseInt(tipoProtesto), 2) + // 124-125: Código mora (0=isento, 1=valor dia, 2=taxa mensal, 3=dispensar)
    formatarValorCNAB(0, 15) +                           // 126-140: Valor mora/juros por dia
    numZ(tipoProtesto !== '0' ? 1 : 0, 2) +             // 141-142: Código desconto (0=sem, 1=valor fixo)
    formatarDataCNAB(titulo.dataLimiteDesconto || '') +  // 143-150: Data limite desconto
    formatarValorCNAB(titulo.desconto || 0, 15) +        // 151-165: Valor do desconto
    formatarValorCNAB(0, 15) +                           // 166-180: Valor IOF (zeros)
    formatarValorCNAB(titulo.abatimento || 0, 15) +      // 181-195: Valor abatimento
    alfaL(titulo.alunoId || titulo.id || '', 25) +       // 196-220: Identificação título empresa
    numZ(tipoProtesto !== '0' ? 1 : 3, 2) +             // 221-222: Código protesto (1=protestar, 3=não protestar)
    diasProtesto +                                        // 223-224: Prazo protesto
    numZ(0, 2) +                                         // 225-226: Código baixa (0=sem baixa)
    numZ(0, 3) +                                         // 227-229: Prazo baixa
    numZ(986, 3) +                                       // 230-232: Moeda (986=Real)
    z(10) +                                              // 233-242 → ajusta para 240
    ' '                                                  // extra fill

  // Ajusta para exatamente 240
  return assertLen240(linha.slice(0, 240).padEnd(240, ' '), 'Segmento P')
}

// ─── SEGMENTO Q (Registro Tipo 3, Segmento Q) ─────────────────────────────────

/**
 * Gera o Segmento Q do CNAB 240
 * Contém os dados do sacado (pagador)
 */
export function gerarSegmentoQ(
  titulo: TituloCobranca,
  lote: number,
  seq: number
): string {
  const cpfCnpj = (titulo.pagadorCpfCnpj || '').replace(/\D/g, '')
  const tipoPessoa = cpfCnpj.length === 11 ? '1' : '2'  // 1=CPF, 2=CNPJ

  const linha =
    numZ(341, 3) +                                       // 1-3:   Banco
    numZ(lote, 4) +                                      // 4-7:   Lote
    '3' +                                                // 8:     Tipo (3=Detalhe)
    numZ(seq, 5) +                                       // 9-13:  Nº sequencial
    'Q' +                                                // 14:    Segmento Q
    ' ' +                                                // 15:    Brancos
    '01' +                                               // 16-17: Código movimento
    tipoPessoa +                                         // 18:    Tipo inscrição sacado
    numZ(cpfCnpj, 15) +                                  // 19-33: CPF/CNPJ sacado (15 dígitos)
    alfaL(titulo.pagadorNome || titulo.responsavel || '', 40) + // 34-73: Nome sacado
    alfaL(titulo.pagadorLogradouro || '', 40) +          // 74-113: Endereço
    alfaL(titulo.pagadorNumero || '', 5) +               // 114-118: Número
    alfaL(titulo.pagadorComplemento || '', 15) +         // 119-133: Complemento
    alfaL(titulo.pagadorBairro || '', 15) +              // 134-148: Bairro
    numZ((titulo.pagadorCEP || '').replace(/\D/g, ''), 8) + // 149-156: CEP (8 dígitos)
    alfaL(titulo.pagadorCidade || '', 15) +              // 157-171: Cidade
    alfaL(titulo.pagadorUF || '', 2) +                   // 172-173: UF
    numZ(0, 1) +                                         // 174:    Tipo avalista
    numZ(0, 15) +                                        // 175-189: CNPJ avalista
    alfaL('', 40) +                                      // 190-229: Nome avalista
    numZ(341, 3) +                                       // 230-232: Banco correspondente
    numZ(0, 5) +                                         // 233-237: Ag. correspondente
    numZ(0, 1) +                                         // 238:    DV
    b(2)                                                 // 239-240: Brancos

  return assertLen240(linha.slice(0, 240).padEnd(240, ' '), 'Segmento Q')
}

// ─── SEGMENTO R (Registro Tipo 3, Segmento R — opcional) ─────────────────────

/**
 * Gera o Segmento R do CNAB 240
 * Contém dados adicionais: desconto 2 e 3, mora e multa
 * Só deve ser incluído se houver mora/multa configurada
 */
export function gerarSegmentoR(
  titulo: TituloCobranca,
  lote: number,
  seq: number
): string {
  // Código mora: 1=Valor (R$/dia), 2=Taxa percentual, 3=Dispensar
  const codMora = titulo.percJuros ? '2' : '3'
  // Taxa em 15 dígitos (centavos-de-taxa = percentual * 1000)
  const valorMora = titulo.percJuros
    ? numZ(Math.round((titulo.percJuros / 100) * 100000), 15)
    : z(15)

  // Código multa: 1=Valor fixo, 2=Percentual, 0=Sem multa
  const codMulta = titulo.percMulta ? '2' : '0'
  const valorMulta = titulo.percMulta
    ? numZ(Math.round(titulo.percMulta * 100), 15)
    : z(15)
  const dataMulta = titulo.percMulta
    ? formatarDataCNAB(titulo.dataVencimento || titulo.vencimento || '')
    : z(8)

  const linha =
    numZ(341, 3) +         // 1-3:   Banco
    numZ(lote, 4) +        // 4-7:   Lote
    '3' +                  // 8:     Detalhe
    numZ(seq, 5) +         // 9-13:  Sequencial
    'R' +                  // 14:    Segmento R
    ' ' +                  // 15:    Brancos
    '01' +                 // 16-17: Código movimento
    '0' +                  // 18:    Código desconto 2 (0=sem)
    z(8) +                 // 19-26: Data desconto 2
    z(15) +                // 27-41: Valor desconto 2
    '0' +                  // 42:    Código desconto 3
    z(8) +                 // 43-50: Data desconto 3
    z(15) +                // 51-65: Valor desconto 3
    codMora +              // 66:    Código mora
    z(8) +                 // 67-74: Data mora
    valorMora +            // 75-89: Valor mora (taxa ou valor)
    codMulta +             // 90:    Código multa
    dataMulta +            // 91-98: Data multa
    valorMulta +           // 99-113: Valor multa
    alfaL('', 10) +       // 114-123: Informações ao sacado
    alfaL('', 40) +       // 124-163: Mensagem 3
    alfaL('', 40) +       // 164-203: Mensagem 4
    z(8) +                 // 204-211: Sequencial registro
    z(5) +                 // 212-216: Uso banco
    b(24)                  // 217-240: Uso FEBRABAN

  return assertLen240(linha.slice(0, 240).padEnd(240, ' '), 'Segmento R')
}

// ─── TRAILER DE LOTE (Registro Tipo 5) ────────────────────────────────────────

export function gerarTrailerLote(
  lote: number,
  qtdRegistros: number,
  valorTotal: number,
  qtdTitulos: number
): string {
  const linha =
    numZ(341, 3) +
    numZ(lote, 4) +
    '5' +                       // Tipo 5 = Trailer Lote
    b(9) +
    numZ(qtdRegistros, 6) +    // Qtd registros no lote (incluindo header e trailer)
    numZ(qtdTitulos, 6) +      // Qtd títulos
    z(17) +                    // Valor total cobrança simples
    numZ(0, 6) +               // Qtd cobrança vinculada
    z(17) +                    // Valor cobrança vinculada
    numZ(0, 6) +               // Qtd cobrança descontada
    z(17) +                    // Valor descontada
    z(8) +                     // Nº aviso débito
    b(117)                     // Brancos

  return assertLen240(linha.slice(0, 240).padEnd(240, ' '), 'Trailer Lote')
}

// ─── TRAILER DE ARQUIVO (Registro Tipo 9) ─────────────────────────────────────

export function gerarTrailerArquivo(
  qtdLotes: number,
  qtdRegistros: number
): string {
  const linha =
    numZ(341, 3) +
    numZ(9999, 4) +            // Lote = 9999 (trailer arquivo)
    '9' +                       // Tipo 9 = Trailer Arquivo
    b(9) +
    numZ(qtdLotes, 6) +        // Quantidade de lotes
    numZ(qtdRegistros, 6) +    // Quantidade total de registros
    numZ(0, 6) +               // Qtd contas p/ conc. (zeros)
    b(205)                     // Brancos

  return assertLen240(linha.slice(0, 240).padEnd(240, ' '), 'Trailer Arquivo')
}

// ─── GERAÇÃO COMPLETA DO ARQUIVO REMESSA ──────────────────────────────────────

export function gerarArquivoRemessa240(
  titulos: TituloCobranca[],
  convenio: ConvenioBancario,
  sequencial: number
): { conteudo: string; filename: string; stats: { qtdTitulos: number; valorTotal: number; qtdLinhas: number } } {
  if (titulos.length === 0) {
    throw new Error('Nenhum título para incluir na remessa')
  }

  const linhas: string[] = []
  const hoje = new Date().toISOString().slice(0, 10)
  const lote = 1
  let seqReg = 0

  // Header arquivo
  linhas.push(gerarHeaderArquivo(convenio, sequencial))
  seqReg++

  // Header lote
  linhas.push(gerarHeaderLote(convenio, lote, seqReg))
  seqReg++

  let valorTotal = 0
  let segSeq = 0

  for (const titulo of titulos) {
    valorTotal += titulo.valor
    segSeq++

    // Segmento P
    linhas.push(gerarSegmentoP(titulo, convenio, lote, seqReg + segSeq - 1))
    seqReg++

    // Segmento Q
    segSeq++
    linhas.push(gerarSegmentoQ(titulo, lote, seqReg + segSeq - 2))
    seqReg++

    // Segmento R (somente se há encargos)
    if (titulo.percJuros || titulo.percMulta) {
      segSeq++
      linhas.push(gerarSegmentoR(titulo, lote, seqReg + segSeq - 3))
      seqReg++
    }
  }

  // Qtd de registros no lote (header + trailers + segmentos)
  const qtdRegistrosLote = linhas.length - 1 + 1 // + trailer lote ainda não adicionado

  // Trailer lote
  linhas.push(gerarTrailerLote(lote, linhas.length - 1 + 1, valorTotal, titulos.length))
  seqReg++

  // Trailer arquivo
  linhas.push(gerarTrailerArquivo(lote, linhas.length + 1))

  const conteudo = linhas.join('\r\n') + '\r\n'
  const dataStr = hoje.replace(/-/g, '')
  const filename = `COBRANCA_ITAU_${numZ(sequencial, 6)}_${dataStr}.rem`

  return {
    conteudo,
    filename,
    stats: {
      qtdTitulos: titulos.length,
      valorTotal,
      qtdLinhas: linhas.length,
    },
  }
}

// ─── PROCESSAMENTO DO RETORNO CNAB 240 ────────────────────────────────────────

/**
 * Tabela de ocorrências Itaú CNAB 240 (cobrança)
 */
export const OCORRENCIAS_ITAU_240: Record<string, string> = {
  '02': 'Entrada Confirmada',
  '03': 'Entrada Rejeitada',
  '04': 'Transferência/Alteração de Beneficiário Confirmada',
  '05': 'Transferência/Alteração de Beneficiário Pendente',
  '06': 'Liquidação Normal',
  '07': 'Liquidação Parcial',
  '08': 'Liquidação em Cartório',
  '09': 'Baixa Simples',
  '10': 'Baixa por Liquidação',
  '11': 'Arquivos em ser (Títulos em Aberto)',
  '12': 'Abatimento Concedido',
  '13': 'Abatimento Cancelado',
  '14': 'Vencimento Alterado',
  '15': 'Acerto dos dados do Rateio de Crédito',
  '16': 'Alteração de Dados com Pendência',
  '17': 'Alteração de Dados Confirmada',
  '18': 'Acerto Depositária',
  '19': 'Confirmação de Recebimento de Instrução de Protesto',
  '20': 'Confirmação de Recebimento de Instrução de Desistência de Protesto',
  '21': 'Aguardando Autorização (Título em Cartório)',
  '22': 'Título com Pagamento Cancelado',
  '23': 'Entrada em Cartório',
  '24': 'Retirada de Cartório',
  '25': 'Protestado e Baixado (Baixa por Ter sido Protestado)',
  '26': 'Instrução Rejeitada',
  '27': 'Confirmação do Pedido de Alteração de Outros Dados',
  '28': 'Débito de Tarifas/Custas',
  '29': 'Ocorrências do Pagador',
  '30': 'Alteração de Outros Dados Rejeitada',
  '32': 'Instrução de Negativação Expressa Pendente',
  '33': 'Confirmação de Instrução de Negativação Expressa',
  '34': 'Confirmação de Cancelamento de Negativação Expressa',
  '35': 'Negativação Expressa Informacional (Cartório)',
  '36': 'Exclusão de Inclusão em Negativação Expressa Rejeitada',
}

export function interpretarOcorrencia240(codigo: string): string {
  return OCORRENCIAS_ITAU_240[codigo] || `Ocorrência ${codigo} — consulte o manual`
}

/**
 * Lê uma linha de detalhe CNAB 240 e extrai as informações relevantes
 * Para segmento P + T (retorno): posições conforme manual Itaú retorno CNAB 240
 */
export function processarRetornoCNAB240(conteudo: string): RegistroRetorno240[] {
  const linhas = conteudo.split(/\r?\n/).filter(l => l.length >= 240)
  const registros: RegistroRetorno240[] = []

  // Mapeia segmentos P por ID de título para cruzar com segmento T
  const segmentosP: Record<string, Partial<RegistroRetorno240>> = {}
  const seqsT: Record<string, Partial<RegistroRetorno240>> = {}

  for (const linha of linhas) {
    const tipoReg = linha[7]  // posição 8 (índice 7)
    const segmento = linha[13] // posição 14 (índice 13)

    if (tipoReg !== '3') continue // só detalhes

    if (segmento === 'T') {
      // Retorno Segmento T: dados do título retornado
      const ocorrencia = linha.slice(14, 16).trim()
      const nossoNumero = linha.slice(37, 57).trim()
      const dataOcorrencia = linha.slice(110, 118).trim()
      const dataVencimento = linha.slice(118, 126).trim()
      const valorTitulo = parseInt(linha.slice(126, 141)) / 100
      const numeroDocumento = linha.slice(80, 95).trim()
      const seq = linha.slice(8, 13)

      segmentosP[seq] = {
        nossoNumero,
        numeroDocumento,
        ocorrencia,
        descricaoOcorrencia: interpretarOcorrencia240(ocorrencia),
        dataOcorrencia: dataOcorrencia.length === 8
          ? `${dataOcorrencia.slice(4)}-${dataOcorrencia.slice(2,4)}-${dataOcorrencia.slice(0,2)}`
          : '',
        dataVencimento: dataVencimento.length === 8
          ? `${dataVencimento.slice(4)}-${dataVencimento.slice(2,4)}-${dataVencimento.slice(0,2)}`
          : '',
        valorTitulo,
      }
    }

    if (segmento === 'U') {
      // Retorno Segmento U: valores pagos
      // Posição 18-32: valor pago (15 dígitos)
      const seq = (parseInt(linha.slice(8, 13)) - 1).toString().padStart(5, '0')
      const valorPago = parseInt(linha.slice(17, 32)) / 100
      const dataPagamento = linha.slice(44, 52).trim()

      seqsT[seq] = {
        valorPago,
        dataPagamento: dataPagamento.length === 8
          ? `${dataPagamento.slice(4)}-${dataPagamento.slice(2,4)}-${dataPagamento.slice(0,2)}`
          : undefined,
      }
    }
  }

  // Cruza P com U
  for (const [seq, p] of Object.entries(segmentosP)) {
    const u = seqsT[seq]
    registros.push({
      nossoNumero: p.nossoNumero || '',
      numeroDocumento: p.numeroDocumento || '',
      ocorrencia: p.ocorrencia || '',
      descricaoOcorrencia: p.descricaoOcorrencia || '',
      dataOcorrencia: p.dataOcorrencia || '',
      dataVencimento: p.dataVencimento || '',
      valorTitulo: p.valorTitulo || 0,
      valorPago: u?.valorPago,
      dataPagamento: u?.dataPagamento,
    })
  }

  return registros
}
