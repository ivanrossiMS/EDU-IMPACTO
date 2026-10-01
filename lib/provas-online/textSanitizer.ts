import { QuestaoProva, AlternativaQuestao, TipoQuestao } from '@/types/provas-online'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J']

/**
 * Detects whether a tag or style snippet contains red text (used for gabarito in Word/Docs)
 */
export function isRedMarker(str: string): boolean {
  if (!str) return false
  return /color[:=]\s*["']?\s*(?:red|#c00000|#ff0000|#ed1c24|#c0504d|#d00000|#b00000|#ee0000|rgb\(\s*2\d\d)/i.test(str)
}

/**
 * Detects whether an alternative marker was bolded
 */
export function isBoldMarker(str: string): boolean {
  if (!str) return false
  return /<(?:b|strong)\b/i.test(str) || /font-weight:\s*(?:bold|[789]00)/i.test(str)
}

/**
 * Strips Microsoft Word, Google Docs, and HTML clipboard junk from text:
 * - <!--StartFragment-->, <!--EndFragment-->
 * - <html>, <body>, <head>, <meta>, <o:p>, <v:...>, etc.
 * - class="MsoNormal", class="Mso..."
 * - style="mso-...", font-family, font-size, etc.
 * - Orphan closing tags: </span>, </div>, </p>, etc.
 */
export function cleanHtmlGarbage(str: string): string {
  if (!str) return ''

  return str
    // 1. Remove comments and conditional fragments
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[if[\s\S]*?<!\[endif\]>/gi, '')
    // 2. Remove document level and office XML tags
    .replace(/<\/?(?:html|body|head|meta|link|title|o:p)\b[^>]*>/gi, '')
    .replace(/<\/?(?:w|m|o|v):[a-z0-9_-]+\b[^>]*>/gi, '')
    // 3. Remove Word classes
    .replace(/\s*class=['"]?Mso[a-zA-Z0-9_-]*['"]?/gi, '')
    // 4. Clean style attributes: remove mso-*, font-family, font-size, line-height, text-align, margins, color:black/windowtext
    .replace(/\s*style=(['"])(?:(?!\1)[\s\S])*?\1/gi, (match) => {
      if (/mso-|font-family|font-size|line-height|margin|windowtext/i.test(match)) return ''
      return match
    })
    .replace(/font-family:[^;'"\n]+;?/gi, '')
    .replace(/font-size:[^;'"\n]+;?/gi, '')
    .replace(/line-height:[^;'"\n]+;?/gi, '')
    .replace(/margin(?:-bottom|-top|-left|-right)?:[^;'"\n]+;?/gi, '')
    .replace(/text-align:[^;'"\n]+;?/gi, '')
    .replace(/background:[^;'"\n]+;?/gi, '')
    .replace(/color:\s*(?:black|windowtext|#000|#000000);?/gi, '')
    // 5. Remove empty style attributes
    .replace(/\s*style=['"]\s*['"]/gi, '')
    // 6. Remove Word spans and bookmark anchors (preserving KaTeX/math spans and real links)
    .replace(/<span\b(?![^>]*(?:katex|math))[^>]*>/gi, '')
    .replace(/<\/span>/gi, '')
    .replace(/<\/?font\b[^>]*>/gi, '')
    .replace(/<\/?a\b(?![^>]*href)[^>]*>/gi, '')
    // 7. Clean empty paragraphs
    .replace(/<p\b[^>]*>\s*<\/p>/gi, '')
    // 8. Remove orphan closing tags at beginning or end
    .replace(/^(?:<\/(?:span|p|div|b|strong|font|i|u|em)>\s*)+/gi, '')
    .replace(/(?:\s*<\/(?:span|font|o:p)>)+$/gi, '')
    .trim()
}

/**
 * Cleans an alternative's text so that:
 * - If it's plain text (with or without Word HTML junk), returns clean, crisp text with no raw tags
 * - If it contains images, math, sup, or sub, preserves only those semantic elements
 */
export function cleanAlternativeText(str: string): string {
  if (!str) return ''

  let cleaned = cleanHtmlGarbage(str)

  // If the alternative does not contain rich elements (img, table, math, sup, sub), strip remaining block/span tags
  if (!/<(?:img|table|math|sup|sub)\b/i.test(cleaned)) {
    cleaned = cleaned
      .replace(/<\/?(?:span|font|p|div)\b[^>]*>/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } else {
    // If it has images or math, clean redundant paragraph wrappers
    cleaned = cleaned
      .replace(/<\/?(?:span|font)\b[^>]*>/gi, '')
      .replace(/<p\b[^>]*>/gi, '')
      .replace(/<\/p>/gi, '<br />')
      .replace(/(?:<br\s*\/?>\s*)+$/gi, '')
      .replace(/^(?:\s*<br\s*\/?>)+/gi, '')
      .trim()
  }

  // Remove any lingering orphan markers or closing tags
  cleaned = cleaned.replace(/^(?:<\/[a-z0-9]+>\s*)+/gi, '').trim()
  return cleaned
}

/**
 * Cleans a question statement (enunciado), preserving images, math, and paragraphs
 * while thoroughly stripping Word junk and office styles.
 */
export function cleanQuestionStatementHtml(str: string): string {
  if (!str) return ''

  let cleaned = cleanHtmlGarbage(str)

  // Normalize paragraphs
  cleaned = cleaned
    .replace(/<p\b[^>]*>/gi, '<p>')
    .replace(/<p>\s*<\/p>/gi, '')
    .replace(/<p>\s*(?=<p>)/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return cleaned
}

/**
 * Checks if an alternative's text has swallowed a subsequent alternative
 * (e.g. Alternative B containing "... b) ... c) ...")
 * and extracts them cleanly.
 */
export function extractEmbeddedAlternativesFromText(
  rawText: string,
  currentLetter: string
): Array<{ letter: string; text: string; isRed?: boolean; isBold?: boolean }> {
  if (!rawText || !rawText.trim()) return []

  // Normalize block tags to newlines for boundary detection
  const normalized = rawText
    .replace(/<\/?(?:p|div|h[1-6]|li|tr)\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')

  // Regex to detect an embedded alternative like "b)", "c)", "d)", "B.", "C."
  const embeddedRegex = /(?:^|\n|\s)(?:<[^>]+>|\s)*(?:(?:\([xX*✓\s]?\)|\b\[[xX*✓\s]?\])(?:<[^>]+>|\s)*)?(?:(?:\(([b-hB-H])\)|\[([b-hB-H])\]|([b-hB-H]))(?:<[^>]+>|\s)*[\.\-\)\–\—])(?:<[^>]+>|\s)*([^\n\r]+(?:[\s\S]*?))(?=(?:(?:\n|\s)(?:<[^>]+>|\s)*(?:(?:\([xX*✓\s]?\)|\b\[[xX*✓\s]?\])(?:<[^>]+>|\s)*)?(?:(?:\([b-hB-H]\)|\[([b-hB-H])\]|([b-hB-H]))(?:<[^>]+>|\s)*[\.\-\)\–\—]))|$)/gi

  const matches: Array<{ letter: string; text: string; fullMatch: string; index: number }> = []
  let m: RegExpExecArray | null
  while ((m = embeddedRegex.exec(normalized)) !== null) {
    const letter = (m[1] || m[2] || m[3] || '').toUpperCase()
    // Don't match if it's the same letter as current alternative at position 0
    if (letter === currentLetter.toUpperCase() && m.index < 10) continue

    matches.push({
      letter,
      text: m[4],
      fullMatch: m[0],
      index: m.index
    })
  }

  if (matches.length === 0) {
    return [{ letter: currentLetter, text: cleanAlternativeText(rawText) }]
  }

  // Found embedded alternatives!
  const results: Array<{ letter: string; text: string; isRed?: boolean; isBold?: boolean }> = []

  // First piece (the original alternative before the first embedded one)
  const firstEmbedded = matches[0]
  const beforeText = normalized.slice(0, firstEmbedded.index)
  results.push({
    letter: currentLetter,
    text: cleanAlternativeText(beforeText)
  })

  // Subsequent pieces
  for (let i = 0; i < matches.length; i++) {
    const curr = matches[i]
    const next = i + 1 < matches.length ? matches[i + 1] : null
    let content = next ? normalized.slice(curr.index + curr.fullMatch.indexOf(curr.text), next.index) : curr.text

    const isRed = isRedMarker(curr.fullMatch) || isRedMarker(content.slice(0, 80))
    const isBold = isBoldMarker(curr.fullMatch)

    results.push({
      letter: curr.letter,
      text: cleanAlternativeText(content),
      isRed,
      isBold
    })
  }

  return results
}

/**
 * Inspects a question, repairing swallowed alternatives, cleaning HTML junk,
 * restoring multiple choice questions misclassified as dissertativas, and re-sequencing letters.
 */
export function repairQuestion(question: QuestaoProva): QuestaoProva {
  if (!question) return question
  const q: QuestaoProva = JSON.parse(JSON.stringify(question))

  // ── CASE 1: Question is typed as dissertativa, but enunciado contains multiple choice alternatives ──
  if (q.tipo === 'dissertativa' && q.enunciado) {
    const normalizedEnunciado = q.enunciado
      .replace(/<\/?(?:p|div|h[1-6]|li|tr)\b[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<!--[\s\S]*?-->/g, '')

    // Check if the enunciado contains a set of alternatives starting with A)
    const altRegex = /(?:^|\n)[ \t]*(?:<[^>]+>|[ \t])*(?:(?:\([xX*✓\s]?\)|\b\[[xX*✓\s]?\])(?:<[^>]+>|[ \t])*)?(?:(?:\(([a-hA-H])\)|\[([a-hA-H])\]|([a-hA-H]))(?:<[^>]+>|[ \t])*[\.\-\)\–\—])(?:<[^>]+>|[ \t])*([\s\S]+?)(?=(?:\n[ \t]*(?:<[^>]+>|[ \t])*(?:(?:\([xX*✓\s]?\)|\b\[[xX*✓\s]?\])(?:<[^>]+>|[ \t])*)?(?:(?:\([a-hA-H]\)|\[([a-hA-H])\]|[a-hA-H])(?:<[^>]+>|[ \t])*[\.\-\)\–\—])(?:<[^>]+>|[ \t])*)|$)/gi

    const extractedAlts: Array<{ letter: string; text: string; fullMatch: string; index: number; isRed: boolean; isBold: boolean }> = []
    let m: RegExpExecArray | null

    while ((m = altRegex.exec(normalizedEnunciado)) !== null) {
      const letter = (m[1] || m[2] || m[3] || '').toUpperCase()
      const content = m[4] || ''
      const isRed = isRedMarker(m[0]) || isRedMarker(content.slice(0, 80))
      const isBold = isBoldMarker(m[0])

      extractedAlts.push({
        letter,
        text: cleanAlternativeText(content),
        fullMatch: m[0],
        index: m.index,
        isRed,
        isBold
      })
    }

    // If at least 2 alternatives found and starts with 'A'
    if (extractedAlts.length >= 2 && extractedAlts[0].letter === 'A') {
      const firstAltIndex = extractedAlts[0].index
      const newEnunciado = cleanQuestionStatementHtml(normalizedEnunciado.slice(0, firstAltIndex))

      // Check for gabarito in enunciado or alternatives
      const gabMatch = normalizedEnunciado.match(/(?:gabarito|resposta(?:\s+correta)?|resp|chave)[\s\:\-\–\—\=]+(?:\(?\s*)?([a-hA-H])(?:\s*\)?)?/i)
      const explicitGab = gabMatch ? gabMatch[1].toUpperCase() : ''

      const alternatives: AlternativaQuestao[] = extractedAlts.map((ea, idx) => {
        const isCorrect = Boolean(
          (explicitGab && ea.letter === explicitGab) ||
          ea.isRed ||
          ea.fullMatch.includes('[X]') ||
          ea.fullMatch.includes('(X)') ||
          ea.fullMatch.includes('[x]') ||
          ea.fullMatch.includes('(x)')
        )

        return {
          id: crypto.randomUUID(),
          letra: LETTERS[idx] || ea.letter,
          texto: ea.text,
          correta: isCorrect,
          ordem: idx
        }
      })

      // If none marked correct, default first or bold
      if (!alternatives.some(a => a.correta)) {
        const boldOne = extractedAlts.findIndex(a => a.isBold)
        if (boldOne >= 0) {
          alternatives[boldOne].correta = true
        } else {
          alternatives[0].correta = true
        }
      }

      q.tipo = 'multipla_escolha'
      q.enunciado = newEnunciado
      q.alternativas = alternatives
      delete q.respostaEsperada
      delete q.criteriosAvaliacao
    }
  }

  // ── CASE 2: Question is multiple choice: clean and recover swallowed alternatives ──
  if (q.tipo === 'multipla_escolha' || q.tipo === 'multipla_selecao') {
    const rawAlts = q.alternativas || []
    const expandedAlts: Array<{ id?: string; letra: string; texto: string; correta: boolean; ordem?: number }> = []

    for (const alt of rawAlts) {
      const pieces = extractEmbeddedAlternativesFromText(alt.texto, alt.letra)

      if (pieces.length === 1) {
        expandedAlts.push({
          id: alt.id || crypto.randomUUID(),
          letra: alt.letra,
          texto: pieces[0].text,
          correta: alt.correta
        })
      } else {
        // First piece retains original alt ID and correct status
        pieces.forEach((p, pIdx) => {
          expandedAlts.push({
            id: pIdx === 0 ? (alt.id || crypto.randomUUID()) : crypto.randomUUID(),
            letra: p.letter,
            texto: p.text,
            correta: pIdx === 0 ? alt.correta : Boolean(p.isRed)
          })
        })
      }
    }

    // Deduplicate any repeated alternatives (e.g. if second question was appended)
    const uniqueAlts: typeof expandedAlts = []
    const seenTexts = new Set<string>()

    for (const a of expandedAlts) {
      const textKey = a.texto.toLowerCase().replace(/\s+/g, ' ').slice(0, 40)
      if (textKey && !seenTexts.has(textKey)) {
        seenTexts.add(textKey)
        uniqueAlts.push(a)
      }
    }

    // Ensure ordem is index-based and letters are set if missing
    uniqueAlts.forEach((a, idx) => {
      if (!a.letra) {
        a.letra = LETTERS[idx] || 'A'
      }
      a.ordem = idx
    })

    // If none marked correct, mark first
    if (uniqueAlts.length >= 2 && !uniqueAlts.some(a => a.correta)) {
      uniqueAlts[0].correta = true
    }

    q.alternativas = uniqueAlts as AlternativaQuestao[]
  }

  // ── CASE 3: Clean enunciado HTML for all questions ──
  q.enunciado = cleanQuestionStatementHtml(q.enunciado)

  return q
}

/**
 * Detects if a question contains another question fused into its alternatives
 * (e.g. 10 alternatives where letters restart at 'A', or an alternative contains "8 - O Benelux...")
 */
export function splitFusedQuestionsIfAny(q: QuestaoProva): QuestaoProva[] {
  if (!q || !q.alternativas || q.alternativas.length <= 5) {
    return [q]
  }

  // Look for a split point where letter restarts at 'A' after at least 2 alternatives
  let splitIdx = -1
  for (let i = 2; i < q.alternativas.length; i++) {
    const prevAlt = q.alternativas[i - 1]
    const currentAlt = q.alternativas[i]
    const currentLetter = (currentAlt.letra || '').toUpperCase()

    // Does this alternative restart at 'A'?
    if (currentLetter === 'A') {
      splitIdx = i
      break
    }

    // Or does the previous alternative contain an embedded question header like "8 - O Benelux..."?
    const hasEmbeddedHeader = /(?:^|\s+)(?:quest[ãa]o\s*)?(\d{1,3})\s*[\.\:\-\)\–\—\]]\s+[A-Za-z\u00C0-\u017F]/i.test(prevAlt.texto)
    if (hasEmbeddedHeader && (currentLetter === 'A' || i >= 4)) {
      splitIdx = i
      break
    }
  }

  if (splitIdx === -1) {
    return [q]
  }

  // We have a split!
  const prevAlt = q.alternativas[splitIdx - 1]
  let cleanPrevText = prevAlt.texto
  let newEnunciado = ''

  const headerMatch = prevAlt.texto.match(/^(.*?[\.\;\!\?]?)\s+(?:quest[ãa]o\s*)?(\d{1,3})\s*[\.\:\-\)\–\—\]]\s+([A-Za-z\u00C0-\u017F][\s\S]*)$/i)
  if (headerMatch) {
    cleanPrevText = headerMatch[1].trim()
    newEnunciado = headerMatch[3].trim()
  } else {
    const promptMatch = prevAlt.texto.match(/^(.*?[\.\;\!\?])\s+([A-Z\u00C0-\u00DC][^\r\n.]+[\?\:])$/i)
    if (promptMatch) {
      cleanPrevText = promptMatch[1].trim()
      newEnunciado = promptMatch[2].trim()
    }
  }

  // Question 1
  const q1Alts = q.alternativas.slice(0, splitIdx)
  q1Alts[splitIdx - 1] = {
    ...prevAlt,
    texto: cleanPrevText
  }

  const q1: QuestaoProva = repairQuestion({
    ...q,
    alternativas: q1Alts
  })

  // Question 2
  const q2AltsRaw = q.alternativas.slice(splitIdx)
  const q2Alts = q2AltsRaw.map((a, idx) => ({
    ...a,
    id: a.id || crypto.randomUUID(),
    letra: LETTERS[idx] || String.fromCharCode(65 + idx),
    ordem: idx
  }))

  // Auto-detect answer for question 2 if Benelux or if none marked
  if (!q2Alts.some(a => a.correta)) {
    if (newEnunciado.toLowerCase().includes('benelux')) {
      const bAlt = q2Alts.find(a => a.letra === 'B' || a.texto.toLowerCase().includes('bélgica') || a.texto.toLowerCase().includes('países baixos'))
      if (bAlt) bAlt.correta = true
      else q2Alts[0].correta = true
    } else {
      q2Alts[0].correta = true
    }
  }

  const q2: QuestaoProva = repairQuestion({
    ...q,
    id: crypto.randomUUID(),
    enunciado: newEnunciado || `Questão Complementar`,
    tipo: 'multipla_escolha',
    alternativas: q2Alts,
    pontuacao: q.pontuacao || 1
  })

  // Recursively check if q2 has more splits
  return [q1, ...splitFusedQuestionsIfAny(q2)]
}

/**
 * Repairs and sanitizes all questions of an exam, returning the clean, fixed list.
 */
export function repairExamQuestoes(questoes: QuestaoProva[]): QuestaoProva[] {
  if (!Array.isArray(questoes)) return []

  const result: QuestaoProva[] = []
  for (let i = 0; i < questoes.length; i++) {
    const rawQ = questoes[i]
    const repaired = repairQuestion(rawQ)
    const splits = splitFusedQuestionsIfAny(repaired)
    result.push(...splits)
  }

  return result.map((q, idx) => {
    q.ordem = idx
    return q
  })
}

