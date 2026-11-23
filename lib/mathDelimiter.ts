export interface MathSegment {
  type: 'text' | 'math'
  content: string
  displayMode?: boolean
}

const ACCENTED_CHAR_RE = /[áàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ]/
const LATEX_COMMAND_RE = /\\[a-zA-Z]+/
const MATH_SYNTAX_RE = /[=<>+*^_{}\[\]|]/
const CURRENCY_PREFIX_CHAR_RE = /[A-Za-zÀ-ÿ0-9]/
const MULTI_LETTER_WORD_RE = /[A-Za-zÀ-ÿ]{2,}/g

/**
 * Checks whether a single `$` at `openIdx` is allowed to open an inline math span.
 * Rejects currency prefixes (`R$`, `US$`, `100$`), escaped `\$`, and `$ ` followed by whitespace.
 */
function isValidOpeningDollar(text: string, openIdx: number): boolean {
  if (openIdx > 0 && text[openIdx - 1] === '\\') return false
  if (openIdx > 0 && CURRENCY_PREFIX_CHAR_RE.test(text[openIdx - 1])) return false
  const nextChar = text[openIdx + 1]
  if (!nextChar || /\s/.test(nextChar) || nextChar === '$') return false
  return true
}

/**
 * Checks whether a single `$` at `closeIdx` is allowed to close an inline math span.
 * Rejects escaped `\$`, whitespace right before `$`, and `$` immediately followed by a digit (e.g. `$200`).
 */
function isValidClosingDollar(text: string, closeIdx: number): boolean {
  if (closeIdx > 0 && text[closeIdx - 1] === '\\') return false
  const prevChar = text[closeIdx - 1]
  if (!prevChar || /\s/.test(prevChar)) return false
  const nextChar = text[closeIdx + 1]
  if (nextChar && (/\d/.test(nextChar) || nextChar === '$')) return false
  return true
}

/**
 * Determines whether the inner text between single `$ ... $` delimiters represents
 * real LaTeX math rather than natural-language prose or currency values.
 */
export function isValidInlineDollarContent(inner: string): boolean {
  const trimmed = inner.trim()
  if (!trimmed) return false
  if (inner.includes('\n')) return false

  // Explicit LaTeX command (e.g. \frac, \sqrt, \Delta, \text{...})
  if (LATEX_COMMAND_RE.test(trimmed)) return true

  // Strip accented-char / prose false positives when there are no LaTeX commands
  if (ACCENTED_CHAR_RE.test(trimmed)) return false

  // Reject currency-like leading amounts followed by words (e.g. "100,00 e")
  if (/^\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\s+[A-Za-z]{2,}/.test(trimmed)) {
    return false
  }

  const words = trimmed.match(MULTI_LETTER_WORD_RE) || []
  const hasMathSyntax = MATH_SYNTAX_RE.test(trimmed)

  // Three or more multi-letter words without LaTeX commands is natural-language prose
  if (words.length >= 3) return false

  // Two multi-letter words without math operators is likely prose (e.g. "primeiro mes")
  if (words.length >= 2 && !hasMathSyntax) return false

  return true
}

/**
 * Detects a `.ql-formula` payload that was previously corrupted from currency `$...$`
 * into a KaTeX span (e.g. "800.000 no primeiro mês, e, a cada mês, houve um aumento de R").
 */
export function isCorruptedCurrencyFormula(formula: string): boolean {
  if (!formula) return false
  const trimmed = formula.trim()
  if (!trimmed) return false
  if (LATEX_COMMAND_RE.test(trimmed)) return false
  if (MATH_SYNTAX_RE.test(trimmed)) return false

  const words = trimmed.match(MULTI_LETTER_WORD_RE) || []
  if (ACCENTED_CHAR_RE.test(trimmed) && (words.length >= 1 || /\s/.test(trimmed))) {
    return true
  }
  if (words.length >= 3) {
    return true
  }
  if (/^\d[\d.,]*\s+[A-Za-zÀ-ÿ]/.test(trimmed) && words.length >= 2) {
    return true
  }
  return false
}

/**
 * Finds the matching closing `$` on the same line for an inline `$ ... $` span,
 * skipping escaped `\$`.
 */
function findClosingSingleDollar(text: string, fromIdx: number): number {
  for (let i = fromIdx; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\n' || ch === '\r') return -1
    if (ch === '\\') {
      i++ // skip escaped character
      continue
    }
    if (ch === '$') {
      return i
    }
  }
  return -1
}

/**
 * Splits plain text into alternating `'text'` and `'math'` segments, supporting:
 * - `\[ ... \]` (display)
 * - `\( ... \)` (inline)
 * - `$$ ... $$` (display)
 * - `$ ... $` (inline, only when not currency or natural-language prose)
 */
export function splitMathSegments(text: string): MathSegment[] {
  if (!text) return []

  const segments: MathSegment[] = []
  let textBuf = ''
  let i = 0

  const flushText = () => {
    if (textBuf) {
      segments.push({ type: 'text', content: textBuf })
      textBuf = ''
    }
  }

  while (i < text.length) {
    // 1. Escaped dollar `\$` -> literal `$` (or keep text when not inside delimiters)
    if (text[i] === '\\' && text[i + 1] === '$') {
      textBuf += '\\$'
      i += 2
      continue
    }

    // 2. Display math `\[ ... \]`
    if (text[i] === '\\' && text[i + 1] === '[') {
      const endIdx = text.indexOf('\\]', i + 2)
      if (endIdx !== -1) {
        const inner = text.slice(i + 2, endIdx).trim()
        if (inner) {
          flushText()
          segments.push({ type: 'math', content: inner, displayMode: true })
          i = endIdx + 2
          continue
        }
      }
    }

    // 3. Inline math `\( ... \)`
    if (text[i] === '\\' && text[i + 1] === '(') {
      const endIdx = text.indexOf('\\)', i + 2)
      if (endIdx !== -1) {
        const inner = text.slice(i + 2, endIdx).trim()
        if (inner) {
          flushText()
          segments.push({ type: 'math', content: inner, displayMode: false })
          i = endIdx + 2
          continue
        }
      }
    }

    // 4. Display math `$$ ... $$`
    if (text[i] === '$' && text[i + 1] === '$') {
      const endIdx = text.indexOf('$$', i + 2)
      if (endIdx !== -1) {
        const inner = text.slice(i + 2, endIdx).trim()
        if (inner) {
          flushText()
          segments.push({ type: 'math', content: inner, displayMode: true })
          i = endIdx + 2
          continue
        }
      }
      textBuf += '$$'
      i += 2
      continue
    }

    // 5. Inline math `$ ... $` (strictly guarded against currency like R$ ... R$)
    if (text[i] === '$') {
      if (isValidOpeningDollar(text, i)) {
        const closeIdx = findClosingSingleDollar(text, i + 1)
        if (closeIdx !== -1 && isValidClosingDollar(text, closeIdx)) {
          const inner = text.slice(i + 1, closeIdx)
          if (isValidInlineDollarContent(inner)) {
            flushText()
            segments.push({ type: 'math', content: inner.trim(), displayMode: false })
            i = closeIdx + 1
            continue
          }
        }
      }
      textBuf += '$'
      i += 1
      continue
    }

    textBuf += text[i]
    i += 1
  }

  flushText()
  return segments
}

/**
 * Replaces runs of non-breaking spaces (`\u00A0`) between non-whitespace words
 * when imported/pasted text uses `\u00A0` as normal word separators (preventing line wrapping).
 */
export function sanitizeNonBreakingSpaces(text: string): string {
  if (!text || !text.includes('\u00A0')) return text
  const nbspBetweenWords = text.match(/\S\u00A0+\S/g)
  if (nbspBetweenWords && nbspBetweenWords.length >= 3) {
    return text.replace(/(\S)\u00A0+(?=\S)/g, '$1 ')
  }
  return text
}
