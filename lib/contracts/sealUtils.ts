/**
 * lib/contracts/sealUtils.ts
 *
 * Funções utilitárias puras e ultraleves para o Selo de Assinatura Eletrônica.
 * Isentas de dependências pesadas, 100% compatíveis com Client Components ('use client'),
 * Server Components e Edge Runtime.
 */

/**
 * Sanitiza strings para o charset padrão WinAnsi das fontes básicas do PDF (Helvetica / Courier)
 */
export function sanitizeWinAnsi(text?: string | null): string {
  if (!text) return ''
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/•/g, '-')
    .replace(/—|–/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
}

/**
 * Formata o nome do signatário no padrão ultra moderno especificado:
 * Primeiro nome por extenso + iniciais dos demais sobrenomes abreviados com ponto.
 * Preposições ("de", "da", "do", "dos", "das", "e") são ignoradas na abreviação.
 *
 * Exemplos:
 * - "Ivan Rossi Sambrana" -> "Ivan R.S"
 * - "Renata Pereira Ortiz" -> "Renata P.O"
 * - "Anthony Gabriel de Oliveira Santana" -> "Anthony G.O.S"
 * - "Cecília Graziela Marinho Fonseca" -> "Cecília G.M.F"
 * - "Maria da Silva" -> "Maria S."
 * - "Ivan Rossi" -> "Ivan R."
 * - "Ivan" -> "Ivan"
 */
export function formatAbbreviatedSignerName(fullName?: string | null): string {
  if (!fullName || typeof fullName !== 'string') return 'Signatário'
  const clean = fullName.trim().replace(/\s+/g, ' ')
  if (!clean) return 'Signatário'

  const parts = clean.split(' ')
  if (parts.length === 1) {
    const p = parts[0]
    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
  }

  // Primeiro nome formatado em Capitalize (ex: "Ivan")
  const rawFirst = parts[0]
  const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase()

  const prepositions = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'd', 'di'])
  const initials: string[] = []

  for (let i = 1; i < parts.length; i++) {
    const p = parts[i]
    if (prepositions.has(p.toLowerCase())) continue
    const char = p.charAt(0).toUpperCase()
    if (char && /[A-ZÀ-ÖØ-öø-ÿ]/.test(char)) {
      initials.push(char)
    }
  }

  if (initials.length === 0) return firstName
  if (initials.length === 1) {
    return `${firstName} ${initials[0]}.`
  }
  return `${firstName} ${initials.join('.')}`
}

/**
 * Formata data/hora para o carimbo no fuso horário oficial de MS (UTC-4)
 */
export function formatTimestampSelo(isoString?: string | null): string {
  if (!isoString) {
    const now = new Date()
    return now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }
  try {
    const d = new Date(isoString)
    const dataFormatada = d.toLocaleDateString('pt-BR', { timeZone: 'America/Campo_Grande' })
    const horaFormatada = d.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Campo_Grande',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    return `${dataFormatada} ${horaFormatada} MS`
  } catch {
    return isoString
  }
}
