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
 * Higieniza nomes de signatários removendo espaços múltiplos, corrigindo
 * quebras acidentais de digitação (ex: "Franciell i" -> "Francielli") e espaços antes de pontuação.
 */
export function sanitizeSignerName(name?: string | null): string {
  if (!name || typeof name !== 'string') return ''
  let cleaned = name.replace(/\s+/g, ' ').trim()
  // Corrige quebras acidentais de nomes comuns onde a última letra foi separada por espaço
  cleaned = cleaned.replace(/\bFranciell\s+i\b/gi, 'Francielli')
  cleaned = cleaned.replace(/\bGabriell\s+a\b/gi, 'Gabriella')
  cleaned = cleaned.replace(/\bDaniel\s+a\b/gi, 'Daniela')
  cleaned = cleaned.replace(/\s+([.,;:])/g, '$1')
  return cleaned
}

/**
 * Converte nomes para Title Case respeitando preposições brasileiras ("de", "da", "do", "dos", "das", "e")
 */
export function toTitleCase(name?: string | null): string {
  if (!name || typeof name !== 'string') return ''
  const clean = sanitizeSignerName(name)
  const prepositions = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'd', 'di'])
  return clean
    .split(' ')
    .filter(Boolean)
    .map((word, idx) => {
      const lower = word.toLowerCase()
      if (idx > 0 && prepositions.has(lower)) return lower
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

/**
 * Formata o nome do signatário/representante para assinatura caligráfica natural e equilibrada:
 * - Mantém Title Case elegante (ex: "IVAN ROSSI SAMBRANA" -> "Ivan Rossi Sambrana").
 * - Para nomes excessivamente longos (> maxLengthChars), preserva os primeiros nomes e o sobrenome principal
 *   para evitar redução extrema de fonte mantendo o tamanho proeminente e legível.
 *
 * Exemplos:
 * - "IVAN ROSSI SAMBRANA" -> "Ivan Rossi Sambrana"
 * - "Maria Auxiliadora de Araújo Honório Vilela" (se > maxLengthChars) -> "Maria Auxiliadora Vilela"
 * - "Francielli Marinho Brasil" -> "Francielli Marinho Brasil"
 */
export function formatSignatureDisplayName(name?: string | null, maxLengthChars: number = 30): string {
  if (!name || typeof name !== 'string') return 'Assinatura'
  const title = toTitleCase(name)
  if (title.length <= maxLengthChars) return title

  const parts = title.split(' ').filter(Boolean)
  const prepositions = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'd', 'di'])
  const nonPreps = parts.filter(p => !prepositions.has(p.toLowerCase()))

  if (nonPreps.length >= 3) {
    const shortForm = `${nonPreps[0]} ${nonPreps[1]} ${nonPreps[nonPreps.length - 1]}`
    if (shortForm.length <= maxLengthChars) return shortForm
    return `${nonPreps[0]} ${nonPreps[nonPreps.length - 1]}`
  } else if (nonPreps.length === 2) {
    return `${nonPreps[0]} ${nonPreps[1]}`
  }

  return title
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

/**
 * Validação oficial de CPF brasileiro pelo cálculo dos dígitos verificadores (Módulo 11)
 * Verifica formato, sequências inválidas conhecidas e integridade dos dois dígitos verificadores.
 */
export function validarCPF(cpf?: string | null): boolean {
  if (!cpf) return false
  const c = String(cpf).replace(/\D/g, '')
  if (c.length !== 11) return false
  if (/^(\d)\1+$/.test(c)) return false // Elimina sequências com dígitos repetidos (000.000.000-00, 111.111.111-11, etc.)

  let soma = 0
  for (let i = 0; i < 9; i++) {
    soma += parseInt(c[i], 10) * (10 - i)
  }
  let resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  if (resto !== parseInt(c[9], 10)) return false

  soma = 0
  for (let i = 0; i < 10; i++) {
    soma += parseInt(c[i], 10) * (11 - i)
  }
  resto = (soma * 10) % 11
  if (resto === 10 || resto === 11) resto = 0
  return resto === parseInt(c[10], 10)
}

/**
 * Formata CPF no padrão oficial 000.000.000-00
 */
export function formatarCPF(value?: string | null): string {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

/**
 * Estilos caligráficos disponíveis para a chancela de assinatura (2 opções oficiais)
 */
export const ESTILOS_CHANCELA = [
  { id: 'classica', rotulo: 'Cursiva Clássica', font: "'Dancing Script', 'Brush Script MT', 'Caveat', cursive" },
  { id: 'formal', rotulo: 'Rubrica Formal', font: "'Georgia', 'Times New Roman', serif" },
]

/**
 * Carrega dinamicamente as fontes caligráficas do Google Fonts no navegador se ainda não presentes
 */
export function carregarFontesCaligraficas(): void {
  if (typeof document === 'undefined') return
  const id = 'link-fontes-caligraficas-chancela'
  if (document.getElementById(id)) return
  try {
    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&family=Caveat:wght@600&display=swap'
    document.head.appendChild(link)
  } catch {}
}

/**
 * Gera no navegador uma imagem PNG (Base64 Data URL) de assinatura caligráfica autêntica
 */
export function gerarAssinaturaCaligraficaCanvas(
  nome: string,
  estiloId: string = 'classica'
): string {
  if (typeof document === 'undefined') return ''
  try {
    carregarFontesCaligraficas()
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 160
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const estilo = ESTILOS_CHANCELA.find(e => e.id === estiloId || (estiloId === 'rubrica' && e.id === 'formal')) || ESTILOS_CHANCELA[0]
    const nomeLimpo = formatSignatureDisplayName(sanitizeSignerName(nome || 'Representante Legal'), 28)

    // Ajusta o tamanho da fonte proporcionalmente ao comprimento do nome
    let fontSize = 42
    if (nomeLimpo.length > 32) fontSize = 28
    else if (nomeLimpo.length > 24) fontSize = 32
    else if (nomeLimpo.length > 18) fontSize = 36

    ctx.fillStyle = '#0f2757'
    ctx.font = `italic ${fontSize}px ${estilo.font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Desenha o nome caligráfico perfeitamente centralizado, sem linha embaixo
    ctx.fillText(nomeLimpo, canvas.width / 2, canvas.height / 2)

    return canvas.toDataURL('image/png')
  } catch (err) {
    console.warn('[sealUtils] Erro ao gerar assinatura caligráfica:', err)
    return ''
  }
}
