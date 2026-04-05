// lib/cnab400.ts
// Gerador/Parser de arquivos CNAB 400 para Itaú (Carteiras 109, 112, 175)

import type { ConfigConvenio, Titulo } from './dataContext'

// ─── Utilitários de formatação ────────────────────────────────────
const padL = (s: string | number, n: number, c = '0') =>
  String(s).slice(0, n).padStart(n, c)

const padR = (s: string | number, n: number, c = ' ') =>
  String(s).slice(0, n).padEnd(n, c)

const onlyNum = (s: string) => s.replace(/\D/g, '')

export const fmtDateCNAB = (d: Date): string => {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}${mm}${yy}`
}

export const fmtValorCNAB = (v: number): string =>
  Math.round(v * 100).toString().padStart(13, '0')

export const parseDateCNAB = (s: string): string => {
  // DDMMAA → YYYY-MM-DD
  if (!s || s === '000000') return ''
  const dd = s.slice(0, 2)
  const mm = s.slice(2, 4)
  const yy = s.slice(4, 6)
  const year = parseInt(yy) >= 0 ? `20${yy}` : `19${yy}`
  return `${year}-${mm}-${dd}`
}

export const parseValorCNAB = (s: string): number =>
  parseInt(s || '0', 10) / 100

// Instrução de cobrança → código CNAB
const INSTRUCOES: Record<string, [string, string]> = {
  protestar_10:  ['06', '10'],
  protestar_15:  ['06', '15'],
  nao_protestar: ['00', '00'],
  devolver_30:   ['09', '30'],
}

// ─── Geração da Remessa ───────────────────────────────────────────

function headerRemessa(conv: ConfigConvenio, seq: number, today: Date): string {
  let h = ''
  h += '0'                                  // [1]     tipo header
  h += '1'                                  // [2]     remessa
  h += 'REMESSA'                            // [3-9]   literal
  h += '01'                                 // [10-11] serviço cobrança
  h += padR(conv.cedente, 15)               // [12-26] nome empresa (15)
  h += padL(onlyNum(conv.agencia), 4)       // [27-30] agência (4)
  h += ' '                                  // [31]    espaço
  h += padL(onlyNum(conv.conta), 5)         // [32-36] conta (5)
  h += (conv.digitoConta || '0')[0]         // [37]    DV conta
  h += padR(conv.cedente, 25)               // [38-62] nome cedente (25)
  h += '341'                                // [63-65] banco Itaú
  h += padR('BANCO ITAU', 10)               // [66-75] nome banco (10)
  h += fmtDateCNAB(today)                   // [76-81] data geração DDMMAA (6)
  h += ' '.repeat(313)                      // [82-394] brancos (313)
  h += padL(seq, 6)                         // [395-400] sequencial (6)
  return h.slice(0, 400).padEnd(400)
}

function detalheRemessa(
  t: Titulo & { codigo?: string },
  conv: ConfigConvenio,
  seq: number,
  nossoNum: number,
  today: Date
): string {
  const [instr1, instr2] = INSTRUCOES[conv.instrucoes] || ['00', '00']
  const venc = new Date(t.vencimento + 'T12:00')
  const idEmpresa = ((t as any).codigo || t.id).padEnd(25).slice(0, 25) // usado no retorno

  let d = ''
  // Bloco 1 — Cedente
  d += '1'                                          // [1]
  d += padL(onlyNum(conv.agencia), 4)               // [2-5]   agência
  d += (conv.digitoAgencia || '0')[0]               // [6]     DV agência
  d += padL(onlyNum(conv.conta), 5)                 // [7-11]  conta
  d += (conv.digitoConta || '0')[0]                 // [12]    DV conta
  d += '0'                                          // [13]    DV ag/cta
  d += ' '.repeat(6)                                // [14-19] brancos
  // Bloco 2 — Identificação
  d += idEmpresa                                    // [20-44] ID empresa (25) ← chave para retorno
  d += padL(nossoNum, 8)                            // [45-52] nosso número (8)
  d += ' '.repeat(13)                               // [53-65] uso banco
  // Bloco 3 — Cobrança
  d += padR(conv.carteira, 3)                       // [66-68] carteira (3)
  d += ' '.repeat(10)                               // [69-78] brancos
  d += '0'.repeat(13)                               // [79-91] taxa desconto
  d += '000000'                                     // [92-97] data desconto
  d += '0'.repeat(13)                               // [98-110] IOF
  d += '0'.repeat(13)                               // [111-123] abatimento
  // Bloco 4 — Sacado
  d += '01'                                         // [124-125] tipo (CPF)
  d += '0'.repeat(14)                               // [126-139] inscrição
  d += padR(t.responsavel || t.aluno, 30)           // [140-169] nome sacado
  d += padR('A INFORMAR', 40)                       // [170-209] endereço
  d += padR('', 12)                                 // [210-221] bairro
  d += '0'.repeat(8)                                // [222-229] CEP
  d += padR('', 15)                                 // [230-244] cidade
  d += 'SP'                                         // [245-246] UF
  // Bloco 5 — Valores
  d += fmtDateCNAB(venc)                            // [247-252] vencimento DDMMAA
  d += fmtValorCNAB(t.valor)                        // [253-265] valor (13)
  d += '000'                                        // [266-268] banco cobrador
  d += '0000'                                       // [269-272] ag cobradora
  d += instr1                                       // [273-274] instrução 1
  d += instr2                                       // [275-276] instrução 2
  d += '0'.repeat(13)                               // [277-289] mora/dia
  d += '000000'                                     // [290-295] data desconto
  d += '0'.repeat(13)                               // [296-308] val desconto
  d += fmtDateCNAB(today)                           // [309-314] data emissão DDMMAA
  d += 'N'                                          // [315]     aceite
  d += '06'                                         // [316-317] moeda BRL
  d += '0'.repeat(13)                               // [318-330] valor cobrado
  d += 'H'                                          // [331]     tipo pagador
  d += ' '.repeat(63)                               // [332-394] brancos
  d += padL(seq, 6)                                 // [395-400] sequencial
  return d.slice(0, 400).padEnd(400)
}

function trailerRemessa(seq: number, qtd: number, total: number): string {
  let t = ''
  t += '9'                   // [1]     tipo trailer
  t += ' '.repeat(374)       // [2-375] brancos
  t += padL(qtd, 6)          // [376-381] qtd títulos
  t += fmtValorCNAB(total)   // [382-394] valor total (13)
  t += padL(seq, 6)          // [395-400] sequencial
  return t.slice(0, 400).padEnd(400)
}

// ─── Arquivo de Remessa completo ──────────────────────────────────
export interface RemessaResult {
  content: string
  filename: string
  qtdTitulos: number
  valorTotal: number
  lines: string[]
}

export function gerarRemessaCNAB400(
  titulos: (Titulo & { codigo?: string })[],
  conv: ConfigConvenio
): RemessaResult {
  const today = new Date()
  const lines: string[] = []
  let seq = 1

  lines.push(headerRemessa(conv, seq++, today))

  let nossoNum = conv.nossoNumeroInicial
  for (const t of titulos) {
    lines.push(detalheRemessa(t, conv, seq++, nossoNum++, today))
  }

  const valorTotal = titulos.reduce((s, t) => s + t.valor, 0)
  lines.push(trailerRemessa(seq, titulos.length, valorTotal))

  const dateStr = fmtDateCNAB(today)
  return {
    content: lines.join('\r\n') + '\r\n',
    filename: `REM_ITAU_${dateStr}_${String(titulos.length).padStart(4, '0')}.txt`,
    qtdTitulos: titulos.length,
    valorTotal,
    lines,
  }
}

// ─── Retorno Simulado ─────────────────────────────────────────────
// Ocorrência "06" = Liquidado (pago pelo sacado)
// Posição da ocorrência no detalhe: [108-109] (1-indexed)
// Posição da data pagamento: [110-115]
// Posição do valor pago: [116-128]
// Posição do ID empresa: [20-44] (mesmo da remessa, chave de matching)

function headerRetorno(conv: ConfigConvenio, seq: number, today: Date): string {
  let h = ''
  h += '0'                                  // [1]
  h += '2'                                  // [2]  retorno (≠ remessa "1")
  h += 'RETORNO'                            // [3-9]
  h += '01'                                 // [10-11]
  h += padR(conv.cedente, 15)               // [12-26]
  h += padL(onlyNum(conv.agencia), 4)       // [27-30]
  h += ' '                                  // [31]
  h += padL(onlyNum(conv.conta), 5)         // [32-36]
  h += (conv.digitoConta || '0')[0]         // [37]
  h += padR(conv.cedente, 25)               // [38-62]
  h += '341'                                // [63-65]
  h += padR('BANCO ITAU', 10)               // [66-75]
  h += fmtDateCNAB(today)                   // [76-81]
  h += ' '.repeat(313)                      // [82-394]
  h += padL(seq, 6)                         // [395-400]
  return h.slice(0, 400).padEnd(400)
}

function detalheRetorno(
  t: Titulo & { codigo?: string },
  conv: ConfigConvenio,
  seq: number,
  nossoNum: number,
  today: Date,
  ocorrencia = '06'
): string {
  const idEmpresa = ((t as any).codigo || t.id).padEnd(25).slice(0, 25)
  let d = ''
  // [1-19] — identificação cedente (igual remessa)
  d += '1'
  d += padL(onlyNum(conv.agencia), 4)
  d += (conv.digitoAgencia || '0')[0]
  d += padL(onlyNum(conv.conta), 5)
  d += (conv.digitoConta || '0')[0]
  d += '0'
  d += ' '.repeat(6)
  // [20-44] ID empresa (chave de matching)
  d += idEmpresa
  // [45-52] nosso número
  d += padL(nossoNum, 8)
  // [53-107] uso banco / dados cobrança (brancos/zeros)
  d += ' '.repeat(55)
  // [108-109] código ocorrência ← CHAVE DO RETORNO
  d += ocorrencia.padStart(2, '0').slice(0, 2)
  // [110-115] data da ocorrência/pagamento DDMMAA
  d += fmtDateCNAB(today)
  // [116-128] valor pago (13 chars)
  d += fmtValorCNAB(t.valor)
  // [129-394] complementos (brancos/zeros)
  d += ' '.repeat(266)
  // [395-400] sequencial
  d += padL(seq, 6)
  return d.slice(0, 400).padEnd(400)
}

export interface RetornoResult {
  content: string
  filename: string
  qtdTitulos: number
}

export function gerarRetornoSimuladoCNAB400(
  titulos: (Titulo & { codigo?: string })[],
  conv: ConfigConvenio,
  ocorrencia = '06'
): RetornoResult {
  const today = new Date()
  const lines: string[] = []
  let seq = 1

  lines.push(headerRetorno(conv, seq++, today))

  let nossoNum = conv.nossoNumeroInicial
  for (const t of titulos) {
    lines.push(detalheRetorno(t, conv, seq++, nossoNum++, today, ocorrencia))
  }
  lines.push(trailerRemessa(seq, titulos.length, titulos.reduce((s, t) => s + t.valor, 0)))

  const dateStr = fmtDateCNAB(today)
  return {
    content: lines.join('\r\n') + '\r\n',
    filename: `RET_ITAU_${dateStr}_SIMULADO.ret`,
    qtdTitulos: titulos.length,
  }
}

// ─── Parser de Retorno ────────────────────────────────────────────
export interface RetornoRegistro {
  idEmpresa: string        // [20-44] para matching com títulos
  nossoNumero: string      // [45-52]
  ocorrencia: string       // [108-109]  06=liquidado
  dataPagamento: string    // [110-115]  DDMMAA → YYYY-MM-DD
  valorPago: number        // [116-128]
}

export function processarRetornoCNAB400(content: string): RetornoRegistro[] {
  const registros: RetornoRegistro[] = []
  const lines = content.split(/\r?\n/).filter(l => l.length >= 400)

  for (const line of lines) {
    const tipo = line[0]
    if (tipo !== '1') continue // só detalhes

    const idEmpresa  = line.slice(19, 44).trim()   // pos 20-44 (0-indexed: 19-43)
    const nossoNum   = line.slice(44, 52).trim()   // pos 45-52
    const ocorrencia = line.slice(107, 109).trim() // pos 108-109
    const dataCNAB   = line.slice(109, 115)        // pos 110-115
    const valorStr   = line.slice(115, 128)        // pos 116-128

    registros.push({
      idEmpresa,
      nossoNumero: nossoNum,
      ocorrencia,
      dataPagamento: parseDateCNAB(dataCNAB),
      valorPago: parseValorCNAB(valorStr),
    })
  }

  return registros
}

// ─── Download helper ──────────────────────────────────────────────
export function downloadTxt(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=iso-8859-1' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
