import { QuestaoProva, TipoQuestao, AlternativaQuestao, ItemVerdadeiroFalso } from '@/types/provas-online'
import {
  cleanHtmlGarbage,
  cleanAlternativeText,
  cleanQuestionStatementHtml,
  repairQuestion,
  repairExamQuestoes
} from './textSanitizer'

export interface ParsedRawQuestion {
  numero?: number
  enunciado: string
  tipo: TipoQuestao
  alternativas: Array<{
    letra: string
    texto: string
    correta: boolean
    imagemUrl?: string
  }>
  itensVF?: Array<{
    afirmacao: string
    correta: boolean
  }>
  respostaEsperada?: string
  gabaritoDetectado?: string
  imagens?: string[]
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

/**
 * Detects whether a tag or style snippet contains red text (used for gabarito in Word/Docs)
 */
export function isRedMarker(str: string): boolean {
  if (!str) return false
  return /color[:=]\s*["']?\s*(?:red|#c00000|#ff0000|#ed1c24|#c0504d|#d00000|#b00000|rgb\(\s*2\d\d)/i.test(str)
}

/**
 * Detects whether an alternative marker was bolded
 */
export function isBoldMarker(str: string): boolean {
  if (!str) return false
  return /<(?:b|strong)\b/i.test(str) || /font-weight:\s*(?:bold|[789]00)/i.test(str)
}

/**
 * Converts a hex string into a base64 encoded string using pure JS (works in browser and Node)
 */
export function hexToBase64(hex: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(hex, 'hex').toString('base64')
  }
  const cleanHex = hex.length % 2 !== 0 ? hex.slice(0, -1) : hex
  const len = cleanHex.length / 2
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(cleanHex.substring(i * 2, i * 2 + 2), 16)
  }

  let binary = ''
  const chunkSize = 16384
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binary += String.fromCharCode.apply(null, chunk as unknown as number[])
  }

  if (typeof btoa === 'function') {
    return btoa(binary)
  }
  return ''
}

/**
 * Safely strips an entire RTF group (e.g. \\nonshppict) by tracking balanced braces { and },
 * including any nested sub-groups.
 */
export function stripRtfGroup(rtf: string, keyword: string): string {
  if (!rtf || !rtf.includes(keyword)) return rtf
  let searchIdx = 0
  while (true) {
    const idx = rtf.indexOf(keyword, searchIdx)
    if (idx === -1) break

    // Find the opening brace of this group
    let openIdx = idx - 1
    while (openIdx >= 0 && rtf[openIdx] !== '{' && rtf[openIdx] !== '}') {
      openIdx--
    }
    if (openIdx < 0 || rtf[openIdx] !== '{') {
      searchIdx = idx + keyword.length
      continue
    }

    // Find the matching closing brace
    let depth = 1
    let closeIdx = openIdx + 1
    while (closeIdx < rtf.length && depth > 0) {
      if (rtf[closeIdx] === '\\') {
        closeIdx += 2
        continue
      }
      if (rtf[closeIdx] === '{') depth++
      else if (rtf[closeIdx] === '}') depth--
      closeIdx++
    }

    if (depth === 0) {
      rtf = rtf.slice(0, openIdx) + rtf.slice(closeIdx)
      searchIdx = openIdx
    } else {
      searchIdx = idx + keyword.length
    }
  }
  return rtf
}

/**
 * Extracts all embedded images from Rich Text Format (RTF) clipboard data
 * with exact magic byte alignment, blipuid removal, and balanced brace group parsing.
 */
export function extractImagesFromRtf(rtf: string): Array<{ name: string; src: string; mime: string }> {
  if (!rtf) return []

  // 1. If modern \\shppict blocks exist, strip legacy \\nonshppict fallback blocks
  // to prevent duplicate or corrupt metafile fallback images from being extracted
  let cleanedRtf = rtf
  if (/\\shppict/i.test(cleanedRtf)) {
    cleanedRtf = stripRtfGroup(cleanedRtf, '\\nonshppict')
  }

  const images: Array<{ name: string; src: string; mime: string }> = []
  let searchIdx = 0

  while (true) {
    const pictIdx = cleanedRtf.indexOf('\\pict', searchIdx)
    if (pictIdx === -1) break

    // Find the opening brace of this \\pict group
    let openBrace = pictIdx - 1
    while (openBrace >= 0 && cleanedRtf[openBrace] !== '{' && cleanedRtf[openBrace] !== '}') {
      openBrace--
    }
    if (openBrace < 0 || cleanedRtf[openBrace] !== '{') {
      searchIdx = pictIdx + 5
      continue
    }

    // Match closing brace
    let depth = 1
    let closeBrace = openBrace + 1
    while (closeBrace < cleanedRtf.length && depth > 0) {
      if (cleanedRtf[closeBrace] === '\\') {
        closeBrace += 2
        continue
      }
      if (cleanedRtf[closeBrace] === '{') depth++
      else if (cleanedRtf[closeBrace] === '}') depth--
      closeBrace++
    }

    if (depth !== 0) {
      searchIdx = pictIdx + 5
      continue
    }

    const pictContent = cleanedRtf.slice(openBrace, closeBrace)
    searchIdx = closeBrace

    // Determine format from RTF control words
    let format = 'png'
    if (/\\jpegblip\b/i.test(pictContent)) format = 'jpeg'
    else if (/\\pngblip\b/i.test(pictContent)) format = 'png'
    else if (/\\emfblip\b/i.test(pictContent)) format = 'emf'
    else if (/\\wmetafile\d*\b/i.test(pictContent)) format = 'wmf'
    else if (/\\dibitmap\b/i.test(pictContent)) format = 'dib'
    else if (/\\wbitmap\b/i.test(pictContent)) format = 'bmp'

    // Strip nested property blocks and Word RTF headers
    const body = pictContent
      // Remove blipuid and its 32 hex chars (critical: Word 2007+ puts 32-hex GUID after \\blipuid)
      .replace(/\\blipuid\s+[0-9a-fA-F]{32}/gi, '')
      .replace(/\\blipuid[0-9a-fA-F]{32}/gi, '')
      .replace(/\\bliptag-?\d+/gi, '')
      .replace(/\\blipupi\s*\d+/gi, '')
      // Remove nested picprop groups
      .replace(/\{\\\*\\picprop[\s\S]*?\}/gi, '')
      // Remove all RTF control words like \\picw1000, \\pich1000, \\pngblip, etc.
      .replace(/\\[a-zA-Z]+-?\d*[\s]?/g, '')
      // Remove any leftover symbols like {\\* ...}
      .replace(/[{}\\\*]/g, '')
      // Remove whitespace and newlines
      .replace(/[\s\r\n\t]/g, '')

    // Align to true magic byte signatures to guarantee 100% valid images
    let cleanHex = ''
    let mime = 'image/png'
    let ext = 'png'

    const pngIdx = body.toLowerCase().indexOf('89504e470d0a1a0a')
    const jpgIdx = body.toLowerCase().indexOf('ffd8ff')
    const gifIdx = body.toLowerCase().indexOf('47494638')
    const riffIdx = body.toLowerCase().indexOf('52494646')

    if (pngIdx !== -1 && (format === 'png' || (jpgIdx === -1 && gifIdx === -1))) {
      mime = 'image/png'
      ext = 'png'
      const start = pngIdx
      const iendIdx = body.toLowerCase().indexOf('49454e44ae426082', start)
      if (iendIdx !== -1) {
        cleanHex = body.slice(start, iendIdx + 16)
      } else {
        cleanHex = body.slice(start)
      }
    } else if (jpgIdx !== -1 && (format === 'jpeg' || pngIdx === -1)) {
      mime = 'image/jpeg'
      ext = 'jpg'
      const start = jpgIdx
      const eoiIdx = body.toLowerCase().lastIndexOf('ffd9')
      if (eoiIdx !== -1 && eoiIdx > start) {
        cleanHex = body.slice(start, eoiIdx + 4)
      } else {
        cleanHex = body.slice(start)
      }
    } else if (gifIdx !== -1) {
      mime = 'image/gif'
      ext = 'gif'
      cleanHex = body.slice(gifIdx)
    } else if (riffIdx !== -1) {
      mime = 'image/webp'
      ext = 'webp'
      cleanHex = body.slice(riffIdx)
    } else {
      // Fallback: look for a continuous hex string
      const match = body.match(/[0-9a-fA-F]{30,}/)
      if (match) {
        cleanHex = match[0]
        if (cleanHex.toLowerCase().startsWith('89504e47')) {
          mime = 'image/png'
          ext = 'png'
        } else if (cleanHex.toLowerCase().startsWith('ffd8')) {
          mime = 'image/jpeg'
          ext = 'jpg'
        } else if (format === 'jpeg') {
          mime = 'image/jpeg'
          ext = 'jpg'
        }
      }
    }

    if (!cleanHex || cleanHex.length < 32) continue

    const base64 = hexToBase64(cleanHex)
    if (!base64) continue

    images.push({
      name: `imagem_${images.length + 1}.${ext}`,
      src: `data:${mime};base64,${base64}`,
      mime
    })
  }

  return images
}

/**
 * Injects extracted RTF images into their corresponding <img> locations in Word HTML
 */
export function injectRtfImagesIntoHtml(
  html: string,
  rtfImages: Array<{ name: string; src: string }>
): { injectedHtml: string; unassignedImages: Array<{ name: string; src: string }> } {
  if (!html || !rtfImages || rtfImages.length === 0) {
    return { injectedHtml: html || '', unassignedImages: rtfImages || [] }
  }

  // 1. Unwrap non-vml conditional comments (both commented and non-commented syntax)
  let cleaned = html
    .replace(/<!--\s*\[if\s+!vml\]?>([\s\S]*?)<!\[endif\]\s*-->/gi, '$1')
    .replace(/<!\[if\s+!vml\]>([\s\S]*?)<!\[endif\]>/gi, '$1')
    .replace(/<!\[if\s+supportFields\]>[\s\S]*?<!\[endif\]>/gi, '')
    .replace(/<!\[if[\s\S]*?<!\[endif\]>/gi, '')

  // 2. Remove pure VML blocks (<!--[if gte vml 1]>...<![endif]-->)
  cleaned = cleaned.replace(/<!--\s*\[if\s+gte\s+vml[\s\S]*?<!\[endif\]-->/gi, '')

  // 3. For any <v:shape ...>...</v:shape>, preserve <img> or convert <v:imagedata>
  cleaned = cleaned.replace(/<v:shape\b[^>]*>([\s\S]*?)<\/v:shape>/gi, (_match, inner) => {
    if (/<img\b/i.test(inner)) {
      return inner.replace(/<v:imagedata\b[^>]*>/gi, '')
    }
    const m = inner.match(/<v:imagedata\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?>/i)
    if (m) {
      return `<img src="${m[1]}" />`
    }
    return inner
  })

  // 4. Remove any remaining standalone <v:...> tags, shapetypes, and o:p
  cleaned = cleaned
    .replace(/<v:shapetype\b[\s\S]*?<\/v:shapetype>/gi, '')
    .replace(/<v:imagedata\b[^>]*>/gi, '')
    .replace(/<\/?v:[a-z0-9_-]+\b[^>]*>/gi, '')
    .replace(/<o:p\b[^>]*>[\s\S]*?<\/o:p>/gi, '')

  let imgIdx = 0
  const imgRegex = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?>/gi

  const injectedHtml = cleaned.replace(imgRegex, (match, src) => {
    const originalSrc = src || ''
    // If the image already has a valid data: URL or public remote URL (not file:// or relative or localhost), preserve it
    if (
      (originalSrc.startsWith('data:image/') && originalSrc.length > 50) ||
      (originalSrc.startsWith('http') && !originalSrc.includes('localhost') && !originalSrc.includes('127.0.0.1'))
    ) {
      return match
    }

    if (imgIdx < rtfImages.length) {
      const rtfImg = rtfImages[imgIdx++]
      return `<div class="my-3 text-center"><img src="${rtfImg.src}" alt="${rtfImg.name || 'Imagem da Questão'}" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: inline-block;" /></div>`
    }
    return match
  })

  const unassignedImages = rtfImages.slice(imgIdx)
  return { injectedHtml, unassignedImages }
}

/**
 * Extracts and cleans images from HTML strings
 */
export function extractImagesFromHtml(html: string): { cleanedHtml: string; images: string[] } {
  if (!html) return { cleanedHtml: '', images: [] }
  const images: string[] = []

  const imgRegex = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?>/gi
  let match: RegExpExecArray | null
  while ((match = imgRegex.exec(html)) !== null) {
    if (match[1]) {
      images.push(match[1])
    }
  }

  return { cleanedHtml: html, images }
}

/**
 * Normalizes text lines, converting common HTML linebreaks and paragraphs
 * while preserving styling tags like <b>, <i>, <sup>, <sub>, <table>, <img>
 */
export function normalizeHtmlOrText(input: string): string {
  if (!input) return ''

  let text = input

  // If HTML detected, convert structural block tags into newlines and clean Word fragments
  if (/<[a-z][\s\S]*>/i.test(text)) {
    // Strip comments, conditional blocks, and HTML/body shells
    text = text
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<!\[if[\s\S]*?<!\[endif\]>/gi, '')
      .replace(/<\/?(?:html|body|head|meta|link|title|o:p)\b[^>]*>/gi, '')
      .replace(/<\/?(?:w|m|o|v):[a-z0-9_-]+\b[^>]*>/gi, '')
      // Preserve line breaks for paragraphs, divs, headings, list items and table rows (both opening and closing)
      .replace(/<\/?(p|div|h[1-6]|li|tr)\b[^>]*>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
  }

  // Normalize windows/mac line breaks and clean excessive consecutive blank lines
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')

  return text
}

/**
 * Extracts a global answer key (gabarito geral) if present at the end of the text
 * Examples:
 * "Gabarito: 1-A, 2-C, 3-D"
 * "Gabarito Oficial:\n1. A\n2. B\n3. C"
 * "Chave de respostas: 1:B | 2:D"
 */
export function extractGlobalGabaritoMap(text: string): { cleanedText: string; gabaritoMap: Map<number, string> } {
  const gabaritoMap = new Map<number, string>()
  if (!text) return { cleanedText: '', gabaritoMap }

  // Regex to detect start of global answer key section
  const globalGabSectionRegex = /(?:^|\n)\s*(?:[-=]{3,}\s*)?(?:gabarito\s+(?:geral|oficial|final|das\s+questões)|chave\s+de\s+respostas?|folha\s+de\s+respostas?)(?:\s*:|\s*\n)/i
  const sectionMatch = text.match(globalGabSectionRegex)

  if (!sectionMatch || sectionMatch.index === undefined) {
    return { cleanedText: text, gabaritoMap }
  }

  const gabaritoText = text.slice(sectionMatch.index)

  // Verify that the trailing section does NOT contain question alternatives (e.g. "a) ... b) ...")
  const hasAlternatives = /(?:^|\n)\s*[a-eA-E]\s*[\.\-\)]\s+[^\n]{4,}/m.test(gabaritoText)
  if (hasAlternatives) {
    return { cleanedText: text, gabaritoMap }
  }

  // Pattern: "1-A" or "1. A" or "1: A" or "1) A" or "Questão 1: A"
  const itemRegex = /(?:quest[ãa]o\s*)?(\d{1,3})\s*[\.\:\-\)\–\—\s]+\(?([A-Ha-h])\)?/gi
  let m: RegExpExecArray | null
  const tempMap = new Map<number, string>()
  while ((m = itemRegex.exec(gabaritoText)) !== null) {
    const qNum = parseInt(m[1], 10)
    const letter = m[2].toUpperCase()
    if (qNum > 0 && qNum <= 300) {
      tempMap.set(qNum, letter)
    }
  }

  // Only consider it a global gabarito table if at least 2 numbered items are present
  if (tempMap.size >= 2) {
    const mainText = text.slice(0, sectionMatch.index).trim()
    return { cleanedText: mainText, gabaritoMap: tempMap }
  }

  return { cleanedText: text, gabaritoMap }
}

/**
 * Parses raw text or pasted HTML into structured QuestaoProva list
 */
export function parseRawTextOrHtmlToQuestoes(
  rawInput: string,
  options?: { defaultPoints?: number; totalExamPoints?: number }
): QuestaoProva[] {
  if (!rawInput || !rawInput.trim()) return []

  const normalized = normalizeHtmlOrText(rawInput)
  const { cleanedText, gabaritoMap } = extractGlobalGabaritoMap(normalized)

  // Regex for question header:
  // "Questão 1 -", "QUESTÃO 01:", "1)", "1.", "1 -", "[1]", "(1)"
  // Supports questions without space after punctuation: e.g. "9-Oficialmente", "10.Texto"
  const headerRegex = /(?:^|\n)[ \t]*(?:<[^>]+>)*\s*(?:(?:quest[ãa]o|item|exerc[ií]cio|q\.?)\s*)?(\d{1,3})\s*[\.\:\-\)\–\—\]]\s*(?:<\/[^>]+>)*\s*(?:\s+|(?=[A-Za-z\u00C0-\u017F"“'(\[<]|<img))/gi

  const headerMatches: Array<{ index: number; num: number; matchLength: number }> = []
  let match: RegExpExecArray | null

  while ((match = headerRegex.exec(cleanedText)) !== null) {
    const num = parseInt(match[1], 10)
    if (num > 0 && num <= 300) {
      headerMatches.push({
        index: match.index + (match[0].startsWith('\n') ? 1 : 0),
        num,
        matchLength: match[0].length - (match[0].startsWith('\n') ? 1 : 0)
      })
    }
  }

  // Handle duplicate or restart question numbers across sections
  let lastHNum = 0
  headerMatches.forEach((h) => {
    if (h.num <= lastHNum) {
      h.num = lastHNum + 1
    }
    lastHNum = h.num
  })

  const rawBlocks: Array<{ num: number; content: string }> = []

  if (headerMatches.length === 0) {
    // If no numbered headers found, treat as a single question
    rawBlocks.push({ num: 1, content: cleanedText.trim() })
  } else {
    for (let i = 0; i < headerMatches.length; i++) {
      const start = headerMatches[i].index + headerMatches[i].matchLength
      const end = i + 1 < headerMatches.length ? headerMatches[i + 1].index : cleanedText.length
      const blockContent = cleanedText.slice(start, end).trim()
      rawBlocks.push({ num: headerMatches[i].num, content: blockContent })
    }
  }

  const parsedQuestions: QuestaoProva[] = []

  for (let bIndex = 0; bIndex < rawBlocks.length; bIndex++) {
    const block = rawBlocks[bIndex]
    const qNum = block.num || (bIndex + 1)
    let blockText = block.content

    // 1. Check for trailing gabarito in this specific question:
    // e.g. "Gabarito: C", "Resposta: B", "Resp: A", "<p>Gabarito: B</p>"
    let localGabarito = gabaritoMap.get(qNum) || ''
    const localGabRegex = /(?:^|\n)[ \t]*(?:<[^>]+>)*\s*(?:gabarito|resposta(?:\s+correta)?|resp\.?|chave)[\s\:\-\–\—\=]+(?:\(?\s*)?([a-hA-H])(?:\s*\)?)?(?:<\/[^>]+>)*[\s\.\,\;]*$/i
    const localGabMatch = blockText.match(localGabRegex)
    if (localGabMatch) {
      if (!localGabarito) {
        localGabarito = localGabMatch[1].toUpperCase()
      }
      blockText = blockText.slice(0, localGabMatch.index).trim()
    }

    // 2. Extract alternatives:
    // Patterns: "A)", "a)", "A.", "a.", "A -", "(A)", "[A]", "<b>A)</b>", "<p class="MsoNormal">a)"
    // Robust tag prefix handles opening and closing tags and whitespace seamlessly
    const tagPrefix = '(?:<(?:p|div|span|b|strong|font|i|em|u|br|li|td)\\b[^>]*>|<\\/(?:p|div|span|b|strong|font|i|em|u|li|td)>|[ \\t])*'
    const altRegex = new RegExp(
      '(?:^|\\n)[ \\t]*' + tagPrefix +
      '(?:(?:\\(([xX*✓\\s]?)\\)|\\[([xX*✓\\s]?)\\])' + tagPrefix + ')?' +
      '(?:\\(([a-hA-H])\\)|\\[([a-hA-H])\\]|([a-hA-H])' + tagPrefix + '[\\.\\-\\)\\–\\—])' +
      '(?:<[^>]+>|[ \\t])*([\\s\\S]+?)' +
      '(?=(?:\\n[ \\t]*' + tagPrefix +
      '(?:(?:\\([xX*✓\\s]?\\)|\\[[xX*✓\\s]?\\])' + tagPrefix + ')?' +
      '(?:\\([a-hA-H]\\)|\\[[a-hA-H]\\]|[a-hA-H]' + tagPrefix + '[\\.\\-\\)\\–\\—])(?:<[^>]+>|[ \\t])*)|$)',
      'gi'
    )

    const alternatives: AlternativaQuestao[] = []
    let altMatch: RegExpExecArray | null
    let firstAltPos = -1
    const trailingImagesForEnunciado: string[] = []

    while ((altMatch = altRegex.exec(blockText)) !== null) {
      if (firstAltPos === -1) {
        firstAltPos = altMatch.index + (altMatch[0].startsWith('\n') ? 1 : 0)
      }

      const isMarkedCorrect = Boolean((altMatch[1] && altMatch[1].trim()) || (altMatch[2] && altMatch[2].trim()))
      const letter = (altMatch[3] || altMatch[4] || altMatch[5] || '').toUpperCase()
      let altContent = (altMatch[6] || '').trim()

      const altPrefixAndLetter = altMatch[0].slice(0, Math.max(0, altMatch[0].length - altContent.length))
      const isRedAlt = isRedMarker(altPrefixAndLetter) || isRedMarker(altContent.slice(0, 80))
      const isBoldAltLetter = isBoldMarker(altPrefixAndLetter)

      // Clean leading and trailing orphan closing tags
      altContent = altContent.replace(/^(?:<\/(?:span|b|strong|font|i|em|u|p|div|a)>\s*)+/gi, '').trim()
      altContent = altContent.replace(/(?:\s*<\/(?:p|div|span|font|b|strong)>)+$/gi, '').trim()

      // If the alternative contains a trailing gabarito like "<p>Gabarito: B"
      const altTrailingGab = altContent.match(/(?:^|\n)[ \t]*(?:<[^>]+>)*\s*(?:gabarito|resposta|resp|chave)[\s\:\-\–\—\=]+(?:\(?\s*)?([a-hA-H])(?:\s*\)?)?(?:<\/[^>]+>)*[\s\.\,\;]*$/i)
      if (altTrailingGab) {
        if (!localGabarito) {
          localGabarito = altTrailingGab[1].toUpperCase()
        }
        altContent = altContent.slice(0, altTrailingGab.index).trim()
      }

      // Check if the alternative text contains trailing images that don't belong to the alternative text
      // e.g. An image appended at the bottom of the question block
      const trailingImgMatch = altContent.match(/(?:^|\n\s*)(?:<(?:div|p)[^>]*>\s*)?<img\b[^>]*?>[\s\S]*$/i)
      if (trailingImgMatch && trailingImgMatch.index !== undefined && trailingImgMatch.index > 0) {
        const imgPart = altContent.slice(trailingImgMatch.index).trim()
        trailingImagesForEnunciado.push(imgPart)
        altContent = altContent.slice(0, trailingImgMatch.index).trim()
      }

      // Thoroughly clean Word HTML garbage from the alternative content
      altContent = cleanAlternativeText(altContent)

      const order = alternatives.length
      const expectedLetter = LETTERS[order] || letter

      alternatives.push({
        id: crypto.randomUUID(),
        letra: letter || expectedLetter,
        texto: altContent,
        correta: isMarkedCorrect || isRedAlt || (localGabarito === letter),
        ordem: order,
        ...(isBoldAltLetter ? { _isBold: true } : {}),
        ...(isRedAlt ? { _isRed: true } : {})
      } as any)
    }

    // Gabarito detection priority:
    // 1. Explicit text gabarito (e.g. "Gabarito: C" or global map)
    // 2. Red highlighted alternative (standard in Word exams)
    // 3. Checked checkbox ([X] or (X))
    // 4. Exactly one bolded alternative
    if (!localGabarito && alternatives.length >= 2) {
      const redAlts = alternatives.filter((a: any) => a._isRed)
      if (redAlts.length >= 1) {
        alternatives.forEach((a: any) => { a.correta = false })
        redAlts.forEach((a: any) => { a.correta = true })
      } else {
        const boldAlts = alternatives.filter((a: any) => a._isBold)
        if (boldAlts.length === 1) {
          alternatives.forEach((a: any) => { a.correta = false })
          boldAlts[0].correta = true
        }
      }
    }
    alternatives.forEach((a: any) => {
      delete (a as any)._isBold
      delete (a as any)._isRed
    })

    // A valid set of alternatives MUST have at least 2 options AND start with 'A'
    const isValidMultipleChoice = alternatives.length >= 2 && alternatives[0].letra === 'A'
    if (!isValidMultipleChoice) {
      alternatives.length = 0
      firstAltPos = -1
    }

    // Check for True/False (V/F) items if no regular alternatives found
    const vfItems: ItemVerdadeiroFalso[] = []
    if (alternatives.length === 0) {
      const vfRegex = /(?:^|\n)[ \t]*(?:<[^>]+>)*\s*(?:\(\s*([vVfF]?)\s*\)|\[\s*([vVfF]?)\s*\])\s*([\s\S]+?)(?=(?:\n[ \t]*(?:<[^>]+>)*\s*(?:\([vVfF]?\)|\[[vVfF]?\])\s*)|$)/gi
      let vfMatch: RegExpExecArray | null
      let firstVfPos = -1

      while ((vfMatch = vfRegex.exec(blockText)) !== null) {
        if (firstVfPos === -1) {
          firstVfPos = vfMatch.index + (vfMatch[0].startsWith('\n') ? 1 : 0)
        }
        const mark = (vfMatch[1] || vfMatch[2] || '').toUpperCase()
        const afirmacao = (vfMatch[3] || '').trim()
        vfItems.push({
          id: crypto.randomUUID(),
          afirmacao,
          correta: mark !== 'F', // default true if marked V or unmarked
          ordem: vfItems.length
        })
      }

      if (vfItems.length >= 2 && firstVfPos >= 0) {
        blockText = blockText.slice(0, firstVfPos).trim()
      } else {
        vfItems.length = 0
      }
    }

    // Determine statement (enunciado)
    let enunciado = blockText
    if (alternatives.length > 0 && firstAltPos >= 0) {
      enunciado = blockText.slice(0, firstAltPos).trim()
    }

    if (trailingImagesForEnunciado.length > 0) {
      enunciado = `${enunciado}\n\n${trailingImagesForEnunciado.join('\n\n')}`
    }

    // Clean leading orphan closing tags from enunciado
    enunciado = enunciado.replace(/^(?:<\/(?:span|b|strong|font|i|em|u|p|div|a)>\s*)+/gi, '').trim()

    // Clean enunciado HTML & ensure paragraphs/breaks
    enunciado = formatEnunciadoHtml(enunciado)

    // Determine question type
    let tipo: TipoQuestao = 'dissertativa'
    if (alternatives.length >= 2) {
      const correctCount = alternatives.filter(a => a.correta).length
      tipo = correctCount > 1 ? 'multipla_selecao' : 'multipla_escolha'

      // If no alternative marked correct but localGabarito exists, assign it
      if (correctCount === 0 && localGabarito) {
        const found = alternatives.find(a => a.letra === localGabarito)
        if (found) {
          found.correta = true
        }
      }
      // If still none marked correct, default first alternative as correct for single choice
      if (alternatives.filter(a => a.correta).length === 0 && tipo === 'multipla_escolha') {
        alternatives[0].correta = true
      }
    } else if (vfItems.length >= 2) {
      tipo = 'verdadeiro_falso'
    } else {
      tipo = 'dissertativa'
    }

    const rawQ: QuestaoProva = {
      id: crypto.randomUUID(),
      ordem: bIndex,
      tipo,
      enunciado,
      pontuacao: options?.defaultPoints ?? 1.0,
      alternativas: (tipo === 'multipla_escolha' || tipo === 'multipla_selecao') ? alternatives : undefined,
      itensVF: tipo === 'verdadeiro_falso' ? vfItems : undefined,
      respostaEsperada: tipo === 'dissertativa' ? 'Critério a ser avaliado pelo professor conforme diretrizes pedagógicas.' : undefined,
      criteriosAvaliacao: tipo === 'dissertativa' ? [
        { id: crypto.randomUUID(), descricao: 'Domínio do conteúdo e clareza argumentativa', pontosMaximos: 1.0 }
      ] : undefined
    }

    parsedQuestions.push(repairQuestion(rawQ))
  }

  // Adjust points if totalExamPoints was requested
  if (options?.totalExamPoints && parsedQuestions.length > 0) {
    const rawVal = options.totalExamPoints / parsedQuestions.length
    const rounded = Math.round(rawVal * 10) / 10
    parsedQuestions.forEach(q => {
      q.pontuacao = rounded
    })
  }

  return repairExamQuestoes(parsedQuestions)
}

/**
 * Converts server-parsed questions (from /api/provas-upload/parse or docxMathParser)
 * into high-fidelity QuestaoProva objects with inline images properly embedded.
 */
export function convertServerParsedToQuestoes(
  serverQuestoes: any[],
  options?: { defaultPoints?: number; totalExamPoints?: number }
): QuestaoProva[] {
  if (!Array.isArray(serverQuestoes) || serverQuestoes.length === 0) return []

  const result: QuestaoProva[] = serverQuestoes.map((sq, index) => {
    let enunciado = sq.enunciado || ''
    const imagens = Array.isArray(sq.imagens) ? sq.imagens : []

    // 1. Replace [IMAGEM N] placeholders with clean responsive img tags
    imagens.forEach((img: any, i: number) => {
      const placeholderRegex = new RegExp(`\\[IMAGEM\\s*${i + 1}\\]`, 'gi')
      const imgTag = `<div class="my-3 text-center"><img src="${img.src}" alt="Imagem ${i + 1}" style="max-width: 100%; height: auto; border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: inline-block;" /></div>`
      if (placeholderRegex.test(enunciado)) {
        enunciado = enunciado.replace(new RegExp(`\\[IMAGEM\\s*${i + 1}\\]`, 'gi'), imgTag)
      } else {
        // If image wasn't referenced in text, append it
        enunciado += `\n${imgTag}`
      }
    })

    enunciado = formatEnunciadoHtml(enunciado)

    const rawAlts = Array.isArray(sq.alternativas) ? sq.alternativas : []
    const gabarito = (sq.gabarito || '').trim().toUpperCase()

    const alternativas: AlternativaQuestao[] = rawAlts.map((ra: any, aIdx: number) => {
      const letter = (ra.letter || ra.letra || LETTERS[aIdx] || '').toUpperCase()
      let altText = cleanAlternativeText(ra.text || ra.texto || '')
      if (ra.imagem_url) {
        altText = `<img src="${ra.imagem_url}" style="max-height: 120px; border-radius: 6px; margin: 4px 0; display: block;" /> ${altText}`
      }

      const isCorrect = Boolean(ra.correct || ra.correta || (gabarito && letter === gabarito))

      return {
        id: crypto.randomUUID(),
        letra: letter,
        texto: altText,
        correta: isCorrect,
        ordem: aIdx
      }
    })

    let tipo: TipoQuestao = 'multipla_escolha'
    if (alternativas.length >= 2) {
      const correctCount = alternativas.filter((a: AlternativaQuestao) => a.correta).length
      tipo = correctCount > 1 ? 'multipla_selecao' : 'multipla_escolha'
      if (correctCount === 0) {
        alternativas[0].correta = true
      }
    } else {
      tipo = 'dissertativa'
    }

    return {
      id: crypto.randomUUID(),
      ordem: index,
      tipo,
      enunciado,
      pontuacao: options?.defaultPoints ?? Number(sq.pontuacao || 1.0),
      alternativas: tipo !== 'dissertativa' ? alternativas : undefined,
      respostaEsperada: tipo === 'dissertativa' ? 'Critério a ser avaliado pelo professor.' : undefined
    }
  })

  if (options?.totalExamPoints && result.length > 0) {
    const rawVal = options.totalExamPoints / result.length
    const rounded = Math.round(rawVal * 10) / 10
    result.forEach(q => {
      q.pontuacao = rounded
    })
  }

  return repairExamQuestoes(result)
}

function formatEnunciadoHtml(str: string): string {
  if (!str) return ''
  let cleaned = cleanQuestionStatementHtml(str)

  // If plain text with newlines and no p/div tags, wrap lines in <p>
  if (!/<[a-z][\s\S]*>/i.test(cleaned)) {
    const paragraphs = cleaned.split(/\n\s*\n/)
    cleaned = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`).join('')
  }

  return cleaned
}
