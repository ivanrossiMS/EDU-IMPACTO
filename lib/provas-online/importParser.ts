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
 * Detects whether a tag or style snippet contains red/green/highlighted text (used for gabarito in Word/Docs)
 */
export function isRedMarker(str: string): boolean {
  if (!str) return false
  if (/\[\[GABARITO\]\]|data-gabarito=["']true["']/i.test(str)) return true
  if (/color[:=]\s*["']?\s*(?:red|#c00000|#ff0000|#ed1c24|#c0504d|#d00000|#b00000|#ee0000|#e00000|#dc2626|#ef4444|#f00\b|rgb\(\s*2\d\d\s*,\s*[0-8]?\d\s*,\s*[0-8]?\d)/i.test(str)) {
    return true
  }
  if (/color[:=]\s*["']?\s*(?:#00b050|#008000|#10b981|#059669|#16a34a|rgb\(\s*[0-5]?\d\s*,\s*(?:1[2-9]\d|2\d\d)\s*,\s*[0-9]?\d)/i.test(str)) {
    return true
  }
  if (
    /mso-highlight:\s*(?:yellow|brightgreen|green|cyan)/i.test(str) ||
    /background(?:-color)?:\s*["']?\s*(?:yellow|#ffff00|#ff0\b|#fff2cc|#d9ead3|#00ff00|#b6d7a8|rgb\(\s*255\s*,\s*255\s*,\s*0\s*\))/i.test(str) ||
    /<mark\b/i.test(str)
  ) {
    return true
  }
  return false
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
 * Converts HTML <ol> and <ul> lists (from Google Docs, Word Online, Notion, websites)
 * and Word conditional list blocks (<!--[if !supportLists]-->) into explicit numbered/lettered text
 * so that list markers (1., 2., a), b), c)...) are never lost when HTML tags are normalized.
 */
export function convertHtmlListsToExplicitMarkers(html: string): string {
  if (!html) return ''

  // 1. Unwrap Word Desktop conditional list markers BEFORE stripping HTML comments
  let result = html
    .replace(/<!--\s*\[if\s+!supportLists\]\s*-->([\s\S]*?)<!--\s*\[endif\]\s*-->/gi, '$1')
    .replace(/<!\[if\s+!supportLists\]>([\s\S]*?)<!\[endif\]>/gi, '$1')

  // 2. Process innermost <ol> elements iteratively
  const innerOlRegex = /<ol\b([^>]*)>((?:(?!<ol\b)[\s\S])*?)<\/ol>/gi
  let safety = 0
  while (innerOlRegex.test(result) && safety < 25) {
    safety++
    result = result.replace(innerOlRegex, (fullMatch, attrs: string, inner: string, offset: number) => {
      const isAlphaAttr =
        /\btype\s*=\s*["']?[aA]["']?/i.test(attrs) ||
        /list-style-type\s*:\s*(?:lower|upper)-(?:alpha|latin)/i.test(attrs)

      const startMatch = attrs.match(/\bstart\s*=\s*["']?(\d+)["']?/i)
      const startNum = startMatch ? parseInt(startMatch[1], 10) : 1

      // Extract <li> items
      const liItems: Array<{ liAttrs: string; content: string }> = []
      const liRegex = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi
      let m: RegExpExecArray | null
      while ((m = liRegex.exec(inner)) !== null) {
        liItems.push({ liAttrs: m[1] || '', content: m[2] || '' })
      }
      if (liItems.length === 0) return inner

      // Determine whether this <ol> represents alternatives (a, b, c, d, e) or questions (1, 2, 3...)
      // Check if any <li> already contains extracted alternatives (a) ... b) ...)
      const childrenHaveAlternatives = liItems.some(item =>
        /(?:^|\n|>|\s)[a-eA-E][\.\-\)]\s+\S/.test(item.content)
      )

      // Check preceding context (up to 300 chars before this <ol>)
      const beforeSlice = result.slice(Math.max(0, offset - 350), offset)
      const isInsideParentLi = /<li\b[^>]*>(?:(?!<\/li>)[\s\S])*$/i.test(beforeSlice)
      const precededByQuestionPrompt = /(?:quest[ãa]o\s*\d+|\d+\s*[\.\-\)\:]|[\?\:]\s*(?:<\/[^>]+>\s*)*)$/i.test(beforeSlice.trim())

      const treatAsAlternatives =
        isAlphaAttr ||
        (!childrenHaveAlternatives && (isInsideParentLi || (precededByQuestionPrompt && liItems.length >= 2 && liItems.length <= 7)))

      return liItems
        .map((item, idx) => {
          const gabaritoToken = isRedMarker(item.liAttrs) ? '[[GABARITO]]' : ''
          const plainStart = item.content.replace(/^(?:<[^>]+>|\s)+/g, '').trim()

          if (treatAsAlternatives) {
            const letter = LETTERS[idx] || String.fromCharCode(65 + idx)
            const alreadyHasLetter = new RegExp(`^(?:\\(${letter}\\)|\\[${letter}\\]|${letter}[\\.\\-\\)])\\s`, 'i').test(plainStart)
            return `\n<p>${gabaritoToken}${alreadyHasLetter ? '' : `${letter}) `}${item.content}</p>\n`
          } else {
            const num = startNum + idx
            const alreadyHasNum = /^(?:quest[ãa]o\s*)?\d{1,3}[\.\-\)\:]\s/i.test(plainStart)
            return `\n<p>${gabaritoToken}${alreadyHasNum ? '' : `${num}. `}${item.content}</p>\n`
          }
        })
        .join('')
    })
  }

  // 3. Process <ul> elements that act as 4-5 option multiple-choice lists after a question statement
  const innerUlRegex = /<ul\b([^>]*)>((?:(?!<ul\b)[\s\S])*?)<\/ul>/gi
  safety = 0
  while (innerUlRegex.test(result) && safety < 20) {
    safety++
    result = result.replace(innerUlRegex, (_fullMatch, _attrs: string, inner: string, offset: number) => {
      const liItems: Array<{ liAttrs: string; content: string }> = []
      const liRegex = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi
      let m: RegExpExecArray | null
      while ((m = liRegex.exec(inner)) !== null) {
        liItems.push({ liAttrs: m[1] || '', content: m[2] || '' })
      }
      if (liItems.length === 0) return inner

      const beforeSlice = result.slice(Math.max(0, offset - 350), offset)
      const precededByPrompt = /[\?\:]\s*(?:<\/[^>]+>\s*)*$/i.test(beforeSlice.trim()) || /(?:quest[ãa]o|\d+[\.\-\)])/i.test(beforeSlice)
      const alreadyHasLetters = liItems.some(it => /^(?:<[^>]+>|\s)*[a-eA-E][\.\-\)]\s/i.test(it.content))

      if (!alreadyHasLetters && precededByPrompt && liItems.length >= 4 && liItems.length <= 5) {
        return liItems
          .map((item, idx) => {
            const gabaritoToken = isRedMarker(item.liAttrs) ? '[[GABARITO]]' : ''
            const letter = LETTERS[idx] || String.fromCharCode(65 + idx)
            return `\n<p>${gabaritoToken}${letter}) ${item.content}</p>\n`
          })
          .join('')
      }

      return liItems
        .map(item => {
          const gabaritoToken = isRedMarker(item.liAttrs) ? '[[GABARITO]]' : ''
          return `\n<p>${gabaritoToken}${item.content}</p>\n`
        })
        .join('')
    })
  }

  return result
}

/**
 * Normalizes text lines, converting common HTML linebreaks and paragraphs
 * while preserving styling tags like <b>, <i>, <sup>, <sub>, <table>, <img>, .ql-formula
 */
export function normalizeHtmlOrText(input: string): string {
  if (!input) return ''

  let text = input

  // Convert Unicode circled letters (ⓐ..ⓗ, Ⓐ..Ⓗ) into standard a)..h)
  const circledLower = ['ⓐ', 'ⓑ', 'ⓒ', 'ⓓ', 'ⓔ', 'ⓕ', 'ⓖ', 'ⓗ']
  const circledUpper = ['Ⓐ', 'Ⓑ', 'Ⓒ', 'Ⓓ', 'Ⓔ', 'Ⓕ', 'Ⓖ', 'Ⓗ']
  circledLower.forEach((ch, idx) => {
    text = text.replaceAll(ch, `${LETTERS[idx].toLowerCase()}) `)
  })
  circledUpper.forEach((ch, idx) => {
    text = text.replaceAll(ch, `${LETTERS[idx]}) `)
  })

  // Protect tables, formula spans, and images so their internal tags/newlines aren't broken during normalization
  const protectedBlocks: string[] = []
  const protectBlock = (htmlBlock: string): string => {
    const idx = protectedBlocks.length
    protectedBlocks.push(htmlBlock)
    return `[[PROTECTED_BLOCK_${idx}]]`
  }

  // If HTML detected, convert structural block tags into newlines and clean Word fragments
  if (/<(?:p|div|span|br|html|body|table|ol|ul|li|h[1-6]|font|mark|b|strong|i|em|u|o:p|math|mml:math)\b/i.test(text)) {
    // 0. Unwrap Word list conditional comments and convert <ol>/<ul> lists first
    text = convertHtmlListsToExplicitMarkers(text)

    // 1. Inject [[GABARITO]] into any colored/highlighted HTML tag BEFORE block tags are stripped
    text = text.replace(/<(p|div|li|span|font|mark|b|strong|em|u)\b([^>]*)>/gi, (match, tag: string, attrs: string) => {
      if (tag.toLowerCase() === 'mark' || isRedMarker(attrs)) {
        return `${match}[[GABARITO]]`
      }
      return match
    })

    // 2. Protect <table>...</table> blocks (cleaning Word styles inside table while keeping single-line structure)
    text = text.replace(/<table\b[\s\S]*?<\/table>/gi, (tableMatch) => {
      const cleanedTable = cleanHtmlGarbage(tableMatch).replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ')
      return `\n${protectBlock(cleanedTable)}\n`
    })

    // 3. Protect .ql-formula and .tag-mask spans
    text = text.replace(/<span\b[^>]*class=["'][^"']*(?:ql-formula|tag-mask)[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, (spanMatch) => {
      return protectBlock(spanMatch.replace(/\r?\n/g, ' '))
    })

    // 4. Protect <img> tags
    text = text.replace(/<img\b[^>]*>/gi, (imgMatch) => {
      return protectBlock(imgMatch.replace(/\r?\n/g, ' '))
    })

    // 5. Strip comments, conditional blocks, <style>, <xml>, <head>
    const hasBlockHtmlStructure = /<(?:p|div|br|li|html|body)\b/i.test(text)
    text = text
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<!\[if[\s\S]*?<!\[endif\]>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<xml\b[^>]*>[\s\S]*?<\/xml>/gi, '')
      .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')

    // 6. CRITICAL: Only collapse raw \r\n source-code wraps when the input actually uses HTML block tags (<p>, <div>, <br>, <li>)
    if (hasBlockHtmlStructure) {
      text = text.replace(/\r?\n/g, ' ')
    }

    text = text
      // 7. Remove HTML/Office shell tags
      .replace(/<\/?(?:html|body|head|meta|link|title|o:p)\b[^>]*>/gi, '')
      .replace(/<\/?(?:w|m|o|v):[a-z0-9_-]+\b[^>]*>/gi, '')
      // 8. Convert empty paragraphs (e.g. <p class=MsoNormal>&nbsp;</p>) into double newline (blank line)
      .replace(/<p\b[^>]*>(?:\s|&nbsp;|&#160;|<(?:\/?(?:span|font|b|strong|i|em|u)\b[^>]*)>)*<\/p>/gi, '\n\n')
      // 9. Convert structural block tags and <br> into actual line breaks
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:p|div|h[1-6]|li|tr|table|blockquote)>/gi, '\n')
      .replace(/<(?:p|div|h[1-6]|li|tr)\b[^>]*>/gi, '\n')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      // 10. Clean horizontal spaces on each line without collapsing \n
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
  }

  // Restore protected blocks (tables, formulas, images)
  if (protectedBlocks.length > 0) {
    text = text.replace(/\[\[PROTECTED_BLOCK_(\d+)\]\]/g, (_m, idxStr) => {
      return protectedBlocks[Number(idxStr)] || ''
    })
  }

  // Fix hyphenated Portuguese enclitic pronouns split by Word/PDF line wraps (e.g. "Incorporei- me" -> "Incorporei-me")
  text = text.replace(/([a-zA-Z\u00C0-\u017F])-[ \t]+(me|te|se|lhe|lhes|nos|vos|o|a|os|as|lo|la|los|las|no|na)\b/g, '$1-$2')

  // Fix words broken by PDF line-end hyphens (e.g. "desenvol-\nvimento" -> "desenvolvimento")
  text = text.replace(/([a-z\u00E0-\u00FC]{2,})-[ \t]*\n[ \t]*([a-z\u00E0-\u00FC]{2,})/g, '$1$2')

  // Normalize windows/mac line breaks and clean excessive consecutive blank lines
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')

  return text
}

/**
 * Optional utility to heal broken hard-wrapped lines copied from 2-column PDFs
 * while keeping question headers, alternative markers, and paragraph breaks intact.
 */
export function reflowBrokenPdfLines(input: string): string {
  if (!input) return ''
  let text = input
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Rejoin hyphenated word wraps
    .replace(/([a-zA-Z\u00C0-\u017F]{2,})-[ \t]*\n[ \t]*([a-z\u00E0-\u00FC]{2,})/g, '$1$2')

  const lines = text.split('\n')
  const result: string[] = []

  const isStructuralStart = (line: string): boolean => {
    const trimmed = line.replace(/^(?:<[^>]+>|\s)+/g, '').trim()
    if (!trimmed) return true
    // Question header
    if (/^(?:(?:quest[ãa]o|item|exerc[ií]cio|pergunta|q\.?)\s*0*\d{1,3}|\d{1,3}\s*[\.\-\)\:\]]|\(\d{1,3}\)|\[\d{1,3}\])/i.test(trimmed)) return true
    // Alternative marker
    if (/^(?:(?:\([xX*✓✔\s]?\)|\[[xX*✓✔\s]?\])\s*)?(?:\([a-hA-H]\)|\[[a-hA-H]\]|[a-hA-H]\s*[\.\-\)\–\—\:])(?:\s|$)/i.test(trimmed)) return true
    // Roman numerals or V/F
    if (/^(?:[I|V|X]{1,4}\s*[\.\-\)]|\([vVfF\s]\)|\[[vVfF\s]\])/i.test(trimmed)) return true
    // Gabarito line or Texto de apoio header
    if (/^(?:gabarito|resposta|resp\.?|chave|texto\s+)/i.test(trimmed)) return true
    return false
  }

  for (let i = 0; i < lines.length; i++) {
    const curr = lines[i]
    if (result.length === 0) {
      result.push(curr)
      continue
    }
    const prev = result[result.length - 1]
    const prevTrim = prev.trim()
    const currTrim = curr.trim()

    if (!prevTrim || !currTrim || isStructuralStart(currTrim)) {
      result.push(curr)
      continue
    }

    // If previous line does NOT end with sentence-ending punctuation (. ! ? : ;) and current line starts with a lowercase letter or common continuation
    const prevPlain = prevTrim.replace(/<[^>]+>/g, '').trim()
    const currPlain = currTrim.replace(/<[^>]+>/g, '').trim()
    if (
      prevPlain.length > 20 &&
      !/[\.\!\?\:\;\)\]”"']$/.test(prevPlain) &&
      /^[a-z\u00E0-\u00FC,;(\d]/.test(currPlain)
    ) {
      result[result.length - 1] = `${prevTrim} ${currTrim}`
    } else {
      result.push(curr)
    }
  }

  return result.join('\n')
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
  const globalGabSectionRegex = /(?:^|\n)\s*(?:[-=_]{3,}\s*)?(?:gabaritos?\s*(?:geral|oficial|final|das\s+quest[õo]es|da\s+prova|do\s+simulado)?|chave\s+de\s+respostas?|folha\s+de\s+respostas?|respostas?\s+das\s+quest[õo]es)(?:\s*[:\-]|\s*\n)/gi

  let lastMatch: RegExpExecArray | null = null
  let mSec: RegExpExecArray | null
  while ((mSec = globalGabSectionRegex.exec(text)) !== null) {
    lastMatch = mSec
  }

  if (!lastMatch || lastMatch.index === undefined) {
    return { cleanedText: text, gabaritoMap }
  }

  const gabaritoText = text.slice(lastMatch.index)

  // Verify that the trailing section does NOT contain question headers or alternatives (e.g. "QUESTÃO 2", "a) ...", "(A) ...")
  const hasAlternativesOrQuestions =
    /(?:^|\n)\s*(?:(?:\([a-eA-E]\)|\[[a-eA-E]\]|[a-eA-E]\s*[\.\-\)])\s+\S|(?:quest[ãa]o|item|exerc[ií]cio|pergunta)\s*0*\d+)/im.test(gabaritoText)
  if (hasAlternativesOrQuestions) {
    return { cleanedText: text, gabaritoMap }
  }

  // Pattern: "1-A" or "1. A" or "1: A" or "1) A" or "Questão 1: A" or "01 - B"
  const itemRegex = /(?:^|[\n,;|\t\/]|\s{2,})\s*(?:quest[ãa]o\s*)?0*(\d{1,3})\s*[\.\:\-\)\–\—\=]\s*\(?([A-Ha-h])\)?(?=\s|$|[,;|\/])/gi
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
    const mainText = text.slice(0, lastMatch.index).trim()
    return { cleanedText: mainText, gabaritoMap: tempMap }
  }

  return { cleanedText: text, gabaritoMap }
}

interface CandidateAltMarker {
  markerStart: number
  contentStart: number
  letter: string
  isNewlineStart: boolean
  isMarkedCorrect: boolean
  isRedPrefix: boolean
  isBoldPrefix: boolean
  rawPrefix: string
}

/**
 * Finds all valid ascending A -> B -> C -> D (-> E...) alternative sequences inside a block.
 * Supports both multi-line alternatives and inline/same-line alternatives ("a) 10  b) 20  c) 30  d) 40").
 * If a block contains multiple separate A..D/E sequences (e.g. unnumbered pasted questions),
 * returns each sequence so the caller can split them into distinct questions!
 */
function findAlternativeSequencesInBlock(blockText: string): CandidateAltMarker[][] {
  if (!blockText) return []

  const tagPrefix = '(?:<(?:p|div|span|b|strong|font|i|em|u|br|li|td|mark)\\b[^>]*>|<\\/(?:p|div|span|b|strong|font|i|em|u|li|td|mark)>|\\[\\[GABARITO\\]\\]|[ \\t])*'
  // Boundary before an alternative marker:
  // Group 1: boundary characters (start of string, newline, tab, spaces, or punctuation/closing tag)
  const candRegex = new RegExp(
    '(^|\\n|\\t|[ \\t]+|[\\.\\;\\!\\?\\)\\]\\>][ \\t]*)' +
    '(' + tagPrefix +
    '(?:(?:\\(([xX*✓✔\\s]?)\\)|\\[([xX*✓✔\\s]?)\\]|([*✓✔]))' + tagPrefix + ')?' +
    '(?:\\(([a-hA-H])\\)|\\[([a-hA-H])\\]|([a-hA-H])' + tagPrefix + '[\\.\\-\\)\\–\\—\\:])' +
    '(?:<\\/?(?:b|strong|i|em|u|span|font|mark)\\b[^>]*>|\\[\\[GABARITO\\]\\]|[ \\t])*' +
    ')(?=[\\s\\S])',
    'gi'
  )

  const candidates: CandidateAltMarker[] = []
  let m: RegExpExecArray | null
  while ((m = candRegex.exec(blockText)) !== null) {
    const boundary = m[1] || ''
    const markerFull = m[2] || ''
    const check1 = m[3] || ''
    const check2 = m[4] || ''
    const check3 = m[5] || ''
    const letter = (m[6] || m[7] || m[8] || '').toUpperCase()
    if (!letter) continue

    const markerStart = m.index + boundary.length
    const contentStart = m.index + m[0].length
    const isNewlineStart = boundary === '' || boundary.includes('\n')

    // Avoid false positives in middle of sentences (e.g. "item a." or "letra a.") when not on a newline
    if (!isNewlineStart) {
      // Must either have ')' or ']' or be preceded by tab/2+ spaces or another valid alternative
      const hasParenOrBracket = /[\)\]]/.test(markerFull)
      const hasMultiSpaceOrTab = boundary.includes('\t') || boundary.length >= 2
      if (!hasParenOrBracket && !hasMultiSpaceOrTab) continue

      const beforeWord = blockText.slice(Math.max(0, markerStart - 15), markerStart).toLowerCase()
      if (/(?:letra|alternativa|item|op[çc][ãa]o|figura|tabela|reta|ponto)\s+$/i.test(beforeWord)) {
        continue
      }
    }

    // Also check if after marker there is either whitespace, a tag, or a quote/number/letter
    const nextChar = blockText[contentStart] || ''
    const lastMarkerChar = markerFull.trim().slice(-1)
    if (lastMarkerChar === '.' && nextChar && !/[\s<"\“'(\[\d\u00C0-\u017FA-Za-z]/.test(nextChar)) {
      continue
    }

    candidates.push({
      markerStart,
      contentStart,
      letter,
      isNewlineStart,
      isMarkedCorrect: Boolean(check1.trim() || check2.trim() || check3.trim()),
      isRedPrefix: isRedMarker(markerFull),
      isBoldPrefix: isBoldMarker(markerFull),
      rawPrefix: markerFull
    })
  }

  if (candidates.length < 2) return []

  // Group into one or more valid A -> B -> C (-> D -> E...) sequences
  const sequences: CandidateAltMarker[][] = []
  let searchFrom = 0

  while (searchFrom < candidates.length) {
    let bestSeq: CandidateAltMarker[] = []
    let bestNextSearchIdx = candidates.length

    // Look for 'A' candidates starting from searchFrom
    for (let i = searchFrom; i < candidates.length; i++) {
      if (candidates[i].letter !== 'A') continue

      const seq: CandidateAltMarker[] = [candidates[i]]
      let expectedIdx = 1 // 'B'
      let lastUsedJ = i

      for (let j = i + 1; j < candidates.length && expectedIdx < LETTERS.length; j++) {
        const cand = candidates[j]
        // If we encounter another 'A' after already collecting at least A, B, C, D (4 alternatives),
        // check if that 'A' starts a brand new question's alternative set!
        if (cand.letter === 'A' && seq.length >= 4 && cand.isNewlineStart) {
          // Peek ahead: is this new 'A' followed by 'B' and 'C'?
          const hasNextB = candidates.slice(j + 1).some(c => c.letter === 'B')
          const hasNextC = candidates.slice(j + 2).some(c => c.letter === 'C')
          if (hasNextB && hasNextC) {
            break
          }
        }

        if (cand.letter === LETTERS[expectedIdx] && cand.markerStart > seq[seq.length - 1].contentStart) {
          // If there is another candidate with the same letter right after that is on a newline while this one isn't, prefer the newline one
          const nextSameLetterOnNewline =
            !cand.isNewlineStart &&
            candidates.slice(j + 1, j + 3).find(
              c => c.letter === LETTERS[expectedIdx] && c.isNewlineStart &&
              !candidates.slice(j + 1, candidates.indexOf(c)).some(mid => mid.letter === LETTERS[expectedIdx + 1])
            )
          if (nextSameLetterOnNewline) {
            continue
          }
          seq.push(cand)
          expectedIdx++
          lastUsedJ = j
        }
      }

      if (seq.length >= 2) {
        const bestNewlineCount = bestSeq.filter(s => s.isNewlineStart).length
        const currNewlineCount = seq.filter(s => s.isNewlineStart).length
        if (
          seq.length > bestSeq.length ||
          (seq.length === bestSeq.length && currNewlineCount >= bestNewlineCount)
        ) {
          bestSeq = seq
          bestNextSearchIdx = lastUsedJ + 1
          // If this 'A' started on a newline and gave a full 4+ sequence, we don't want a later 'A' from a second unnumbered question to overwrite the first question's sequence!
          if (seq.length >= 4 && seq[0].isNewlineStart) {
            break
          }
        }
      }
    }

    if (bestSeq.length >= 2) {
      sequences.push(bestSeq)
      searchFrom = bestNextSearchIdx
    } else {
      break
    }
  }

  return sequences
}

/**
 * Splits a single block into multiple question blocks if it contains multiple complete
 * alternative sequences (e.g., when a user pastes unnumbered questions).
 */
function expandUnnumberedMultiQuestionBlocks(
  rawBlocks: Array<{ num: number; content: string }>
): Array<{ num: number; content: string }> {
  const expanded: Array<{ num: number; content: string }> = []

  for (const block of rawBlocks) {
    const seqs = findAlternativeSequencesInBlock(block.content)
    if (seqs.length <= 1) {
      expanded.push(block)
      continue
    }

    // Multiple A..D/E sequences found inside one block! Split them cleanly.
    let chunkStart = 0
    for (let sIdx = 0; sIdx < seqs.length; sIdx++) {
      const currSeq = seqs[sIdx]
      if (sIdx + 1 < seqs.length) {
        const nextSeq = seqs[sIdx + 1]
        const lastAltMarker = currSeq[currSeq.length - 1]
        const between = block.content.slice(lastAltMarker.contentStart, nextSeq[0].markerStart)

        // Find where the last alternative of currSeq ends and the next question's statement begins:
        // Usually right after the first line (or after a gabarito line if present)
        const gabMatch = between.match(/(?:^|\n)[ \t]*(?:<[^>]+>)*\s*(?:gabarito|resposta(?:\s+correta)?|alternativa\s+correta|resp\.?|gab\.?|chave)[\s\:\-\–\—\=]+(?:\(?\s*)?(?:letra\s+)?([a-hA-H])(?:\s*\)?)?(?:<\/[^>]+>)*[\s\.\,\;]*(?:\n|$)/i)
        let splitOffsetInBetween = -1
        if (gabMatch && gabMatch.index !== undefined) {
          splitOffsetInBetween = gabMatch.index + gabMatch[0].length
        } else {
          const nlIdx = between.indexOf('\n')
          if (nlIdx > 0) {
            splitOffsetInBetween = nlIdx + 1
          }
        }

        if (splitOffsetInBetween > 0 && splitOffsetInBetween < between.length) {
          const absSplit = lastAltMarker.contentStart + splitOffsetInBetween
          const qContent = block.content.slice(chunkStart, absSplit).trim()
          if (qContent) {
            expanded.push({ num: expanded.length + 1, content: qContent })
          }
          chunkStart = absSplit
        }
      } else {
        const remaining = block.content.slice(chunkStart).trim()
        if (remaining) {
          expanded.push({ num: expanded.length + 1, content: remaining })
        }
      }
    }
  }

  // Ensure sequential numbers
  let counter = 1
  return expanded.map(b => ({
    num: counter++,
    content: b.content
  }))
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
  // Supports:
  // 1) Explicit keyword ("Questão 1", "QUESTÃO 01", "Questão 1 -", "Item 2:", "Exercício 3", "Pergunta 4") — punctuation after number is optional when keyword is present!
  // 2) Numbered header ("1)", "1.", "1 -", "01.", "[1]", "(1)")
  const headerRegex = /(?:^|\n)[ \t]*(?:<(?:b|strong|i|em|u|span)\b[^>]*>|\[\[GABARITO\]\]|\s)*(?:(?:quest[ãa]o|item|exerc[ií]cio|pergunta)\s*0*(\d{1,3})(?:\s*[\.\:\-\)\–\—\]])?(?:<\/(?:b|strong|i|em|u|span)>)*\s*(?=\n|[A-Za-z\u00C0-\u017F"“'(\[<]|\[\[)|(?:q\.?\s*)?(?:\(0*(\d{1,3})\)|\[0*(\d{1,3})\]|0*(\d{1,3})\s*[\.\:\-\)\–\—\]])\s*(?:<\/(?:b|strong|i|em|u|span)>)*\s*(?:\s+|(?=[A-Za-z\u00C0-\u017F"“'(\[<]|\[\[)))/gi

  const headerMatches: Array<{ index: number; num: number; matchLength: number }> = []
  let match: RegExpExecArray | null

  while ((match = headerRegex.exec(cleanedText)) !== null) {
    const rawNum = match[1] || match[2] || match[3] || match[4]
    const num = parseInt(rawNum, 10)
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

  let rawBlocks: Array<{ num: number; content: string }> = []

  if (headerMatches.length === 0) {
    rawBlocks.push({ num: 1, content: cleanedText.trim() })
  } else {
    // Check if there is introductory base text (e.g. "TEXTO PARA A QUESTÃO 1") before the first numbered question
    let preFirstQuestionText = ''
    if (headerMatches[0].index > 0) {
      const candidateIntro = cleanedText.slice(0, headerMatches[0].index).trim()
      if (
        /(?:texto\s+para|texto\s+de\s+apoio|texto\s+base|texto\s+[ivx\d]+|leia\s+o|considere\s+o|<img\b)/i.test(candidateIntro) ||
        candidateIntro.split('\n').length >= 3
      ) {
        preFirstQuestionText = candidateIntro
      }
    }

    for (let i = 0; i < headerMatches.length; i++) {
      const start = headerMatches[i].index + headerMatches[i].matchLength
      const end = i + 1 < headerMatches.length ? headerMatches[i + 1].index : cleanedText.length
      let blockContent = cleanedText.slice(start, end).trim()
      if (i === 0 && preFirstQuestionText) {
        blockContent = `${preFirstQuestionText}\n\n${blockContent}`
      }
      rawBlocks.push({ num: headerMatches[i].num, content: blockContent })
    }
  }

  // Expand any block that contains multiple unnumbered questions
  rawBlocks = expandUnnumberedMultiQuestionBlocks(rawBlocks)

  const parsedQuestions: QuestaoProva[] = []

  for (let bIndex = 0; bIndex < rawBlocks.length; bIndex++) {
    const block = rawBlocks[bIndex]
    const qNum = block.num || (bIndex + 1)
    let blockText = block.content

    // 1. Check for explicit gabarito in this specific question:
    // e.g. "Gabarito: C", "Gabarito: Letra B", "Resposta: B", "Alternativa correta: D", "Resp: A", "GAB: E"
    let localGabarito = gabaritoMap.get(qNum) || ''
    const localGabRegex = /(?:^|\n)[ \t]*(?:<[^>]+>|\[\[GABARITO\]\])*\s*[\(\[]?\s*(?:gabarito(?:\s+oficial)?|resposta(?:\s+correta)?|alternativa\s+correta|resp\.?|gab\.?|chave)[\s\:\-\–\—\=]+(?:\(?\s*|\[\s*)?(?:letra\s+|alternativa\s+)?([a-hA-H])(?:\s*[\)\]\.]?)?(?:<\/[^>]+>|\[\[GABARITO\]\])*[\s\.\,\;]*$/i
    const localGabMatch = blockText.match(localGabRegex)
    if (localGabMatch) {
      if (!localGabarito) {
        localGabarito = localGabMatch[1].toUpperCase()
      }
      blockText = blockText.slice(0, localGabMatch.index).trim()
    }

    // 2. Find alternatives (supports multi-line AND inline/same-line alternatives!)
    const sequences = findAlternativeSequencesInBlock(blockText)
    const activeSeq = sequences.length > 0 ? sequences[0] : []

    const alternatives: AlternativaQuestao[] = []
    let firstAltPos = activeSeq.length >= 2 ? activeSeq[0].markerStart : -1
    const trailingImagesForEnunciado: string[] = []

    if (activeSeq.length >= 2) {
      for (let aIdx = 0; aIdx < activeSeq.length; aIdx++) {
        const cand = activeSeq[aIdx]
        const start = cand.contentStart
        const end = aIdx + 1 < activeSeq.length ? activeSeq[aIdx + 1].markerStart : blockText.length
        let altContent = blockText.slice(start, end).trim()

        // Check for trailing gabarito inside this alternative (e.g. on the last alternative)
        const altTrailingGab = altContent.match(/(?:^|\n|[ \t]{2,})[ \t]*(?:<[^>]+>|\[\[GABARITO\]\])*\s*[\(\[]?\s*(?:gabarito(?:\s+oficial)?|resposta(?:\s+correta)?|alternativa\s+correta|resp\.?|gab\.?|chave)[\s\:\-\–\—\=]+(?:\(?\s*|\[\s*)?(?:letra\s+|alternativa\s+)?([a-hA-H])(?:\s*[\)\]\.]?)?(?:<\/[^>]+>|\[\[GABARITO\]\])*[\s\.\,\;]*$/i)
        if (altTrailingGab && altTrailingGab.index !== undefined) {
          if (!localGabarito) {
            localGabarito = altTrailingGab[1].toUpperCase()
          }
          altContent = altContent.slice(0, altTrailingGab.index).trim()
        }

        // Check for inline suffix gabarito marker on the alternative itself:
        // e.g. "b) Brasília (Correta)", "c) 42 [X]", "d) Mitocôndria (Gabarito)", "a) 15 [CORRETA]"
        let hasInlineCorrectSuffix = false
        const suffixCorrectRegex = /\s*(?:\(\s*(?:correta|correto|gabarito|x|✓|✔|\*)\s*\)|\[\s*(?:correta|correto|gabarito|x|✓|✔|\*)\s*\])\s*(?:<\/[^>]+>)*$/i
        if (suffixCorrectRegex.test(altContent)) {
          hasInlineCorrectSuffix = true
          altContent = altContent.replace(suffixCorrectRegex, '').trim()
        }

        const isRedAlt = cand.isRedPrefix || isRedMarker(altContent)
        const isBoldAltLetter = cand.isBoldPrefix || isBoldMarker(altContent.slice(0, 40))

        // Clean leading and trailing orphan closing tags
        altContent = altContent.replace(/^(?:<\/(?:span|b|strong|font|i|em|u|p|div|a|mark)>\s*)+/gi, '').trim()
        altContent = altContent.replace(/(?:\s*<\/(?:p|div|span|font|b|strong|mark)>)+$/gi, '').trim()

        // Handle images inside alternative:
        // If it's the LAST alternative and the image is separated by a newline after text while previous alternatives had no images,
        // check if it belongs to the question statement or next question
        const isLastAlt = aIdx === activeSeq.length - 1
        const prevAltsHaveImg = alternatives.some(a => /<img\b/i.test(a.texto) || Boolean((a as any).imagemUrl))
        if (isLastAlt && !prevAltsHaveImg) {
          const trailingImgMatch = altContent.match(/(?:\n\s*)(?:<(?:div|p)[^>]*>\s*)?<img\b[^>]*?>[\s\S]*$/i)
          if (trailingImgMatch && trailingImgMatch.index !== undefined && trailingImgMatch.index > 0) {
            const textBeforeImg = altContent.slice(0, trailingImgMatch.index).trim()
            if (textBeforeImg.length > 0) {
              const imgPart = altContent.slice(trailingImgMatch.index).trim()
              trailingImagesForEnunciado.push(imgPart)
              altContent = textBeforeImg
            }
          }
        }

        const rawHasNewline = altContent.includes('\n')
        const rawBeforeClean = altContent

        // Extract standalone image URL if alternative contains an <img>
        let altImgUrl: string | undefined
        const altImgMatch = altContent.match(/<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?>/i)
        if (altImgMatch && altImgMatch[1]) {
          altImgUrl = altImgMatch[1]
        }

        altContent = cleanAlternativeText(altContent)

        const order = alternatives.length
        const expectedLetter = LETTERS[order] || cand.letter

        alternatives.push({
          id: crypto.randomUUID(),
          letra: cand.letter || expectedLetter,
          texto: altContent,
          correta: cand.isMarkedCorrect || hasInlineCorrectSuffix || isRedAlt || (localGabarito === cand.letter),
          ordem: order,
          ...(altImgUrl ? { imagemUrl: altImgUrl } : {}),
          _rawBeforeClean: rawBeforeClean,
          _rawHasNewline: rawHasNewline,
          ...(isBoldAltLetter ? { _isBold: true } : {}),
          ...(isRedAlt || cand.isMarkedCorrect || hasInlineCorrectSuffix ? { _isRed: true } : {})
        } as any)
      }
    }

    // Check if the LAST alternative swallowed a base text / support text intended for the NEXT question
    // (e.g., "e) 4 orações.\n\nTEXTO PARA A QUESTÃO 8:\n(Faap) BAILADO RUSSO...")
    if (alternatives.length >= 2 && bIndex + 1 < rawBlocks.length) {
      const lastAlt: any = alternatives[alternatives.length - 1]
      const rawLast: string = lastAlt._rawBeforeClean || ''
      const nlIdx = rawLast.indexOf('\n')
      if (nlIdx > 0) {
        const firstLine = rawLast.slice(0, nlIdx).trim()
        const restBlock = rawLast.slice(nlIdx + 1).trim()
        const prevAltsSingleLine = alternatives.slice(0, -1).every((a: any) => !a._rawHasNewline)
        const looksLikeNextQuestionSupportText =
          /\n\s*\n/.test(rawLast) ||
          /^(?:<[^>]+>\s*)*(?:texto\s+para|texto\s+base|texto\s+de\s+apoio|texto\s+[ivx\d]+|leia\s+|considere\s+|observe\s+|analise\s+|com\s+base|a\s+partir|instru[çc][õo]es|\([a-zA-Z]{2,}|\[|<img\b)/i.test(restBlock) ||
          (prevAltsSingleLine && restBlock.split('\n').length >= 2)

        if (firstLine && restBlock && looksLikeNextQuestionSupportText) {
          lastAlt.texto = cleanAlternativeText(firstLine)
          rawBlocks[bIndex + 1].content = `${restBlock}\n\n${rawBlocks[bIndex + 1].content}`
        }
      }
    }

    alternatives.forEach((a: any) => {
      delete a._rawBeforeClean
      delete a._rawHasNewline
    })

    // Gabarito detection priority:
    // 1. Explicit text gabarito (e.g. "Gabarito: C" or global map)
    // 2. Red/Green/Highlighted or Checkbox-marked alternative
    // 3. Exactly one bolded alternative
    if (localGabarito && alternatives.length >= 2) {
      alternatives.forEach((a: any) => {
        a.correta = a.letra === localGabarito
      })
    } else if (!localGabarito && alternatives.length >= 2) {
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
    enunciado = enunciado.replace(/^(?:<\/(?:span|b|strong|font|i|em|u|p|div|a|mark)>\s*)+/gi, '').trim()

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
        ordem: aIdx,
        ...(ra.imagem_url ? { imagemUrl: ra.imagem_url } : {})
      } as any
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
  if (!/<(?:p|div|table|ul|ol|blockquote)\b/i.test(cleaned)) {
    const paragraphs = cleaned.split(/\n\s*\n/)
    cleaned = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`).join('')
  }

  return cleaned
}

/**
 * Converts a QuestaoProva object (from parseRawTextOrHtmlToQuestoes) into the exact Questao format
 * required by QuestoesEditor, PaginationEngine, ProvaPreviewModal, and SimuladoPreviewModal:
 * - Extracts inline <img src="..."> from enunciado into `imagens: [{ src: '...#w=350', contentType: 'image/png', posicao }]`
 *   and replaces them with `[IMAGEM 1]`, `[IMAGEM 2]` masks at their exact positions!
 * - Extracts inline <img src="..."> from alternatives into `alt.imagem_url` (`#w=150`)
 * - Populates both `letter`/`letra`, `text`/`texto`, `correct`/`correta`/`eh_correta`, and `gabarito`
 */
export function convertQuestaoProvaToSimuladoQuestao(
  qp: QuestaoProva,
  numero: number,
  meta?: {
    id_requisicao?: string
    id_disciplina?: string
    disciplina_nome?: string
    id_professor?: string
    professor_nome?: string
  }
): any {
  let enunciado = qp.enunciado || ''
  const imagens: Array<{ src: string; contentType: string; posicao?: 'inicio' | 'final' | 'texto' }> = []

  // Extract <img ... src="..."> from enunciado and replace with [IMAGEM N] masks
  const imgTagRegex = /(?:<(?:div|p)\b[^>]*>\s*)?<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?>(?:\s*<\/(?:div|p)>)?/gi
  enunciado = enunciado.replace(imgTagRegex, (_fullMatch, src: string) => {
    if (!src) return ''
    const cleanSrc = src.split('#')[0]
    let existingIdx = imagens.findIndex(item => item.src.split('#')[0] === cleanSrc)
    if (existingIdx === -1) {
      const withWidth = src.includes('#w=') ? src : `${cleanSrc}#w=350`
      imagens.push({
        src: withWidth,
        contentType: cleanSrc.startsWith('data:image/jpeg') || cleanSrc.endsWith('.jpg') ? 'image/jpeg' : 'image/png',
        posicao: 'inicio'
      })
      existingIdx = imagens.length - 1
    }
    return `<p>[IMAGEM ${existingIdx + 1}]</p>`
  })

  // If it was a V/F question without multiple choice alternatives, preserve V/F items inside enunciado so they print on A4
  if (qp.tipo === 'verdadeiro_falso' && Array.isArray(qp.itensVF) && qp.itensVF.length > 0 && (!qp.alternativas || qp.alternativas.length === 0)) {
    const vfLinesHtml = qp.itensVF
      .map(item => `<p>( &nbsp; ) ${item.afirmacao}</p>`)
      .join('')
    enunciado = `${enunciado}${vfLinesHtml}`
  }

  const rawAlts = Array.isArray(qp.alternativas) ? qp.alternativas : []
  const alternativas = rawAlts.map((alt, idx) => {
    const letter = (alt.letra || LETTERS[idx] || String.fromCharCode(65 + idx)).toUpperCase()
    let altText = alt.texto || ''
    let imagemUrl: string | null = (alt as any).imagemUrl || null

    const altImgRegex = /<img\b[^>]*?\bsrc=["']([^"']+)["'][^>]*?>/gi
    const imgMatch = altImgRegex.exec(altText)
    if (imgMatch && imgMatch[1]) {
      if (!imagemUrl) imagemUrl = imgMatch[1]
      altText = altText.replace(/<img\b[^>]*?>/gi, '').trim()
    }
    if (imagemUrl && !imagemUrl.includes('#w=')) {
      imagemUrl = `${imagemUrl.split('#')[0]}#w=150`
    }

    const isCorrect = Boolean(alt.correta)
    return {
      letter,
      letra: letter,
      text: altText,
      texto: altText,
      correct: isCorrect,
      eh_correta: isCorrect,
      correta: isCorrect,
      is_correta: isCorrect,
      isCorrect,
      ...(imagemUrl ? { imagem_url: imagemUrl } : {}),
      linhas: 0
    }
  })

  const isMultipleChoice = alternativas.length >= 2
  const correctAlt = alternativas.find(a => a.correct)
  const gabarito = isMultipleChoice ? (correctAlt?.letter || '') : ''
  const tipoQuestao: 'multipla_escolha' | 'descritiva' | 'texto_apoio' = isMultipleChoice ? 'multipla_escolha' : 'descritiva'

  if (tipoQuestao === 'descritiva' && !/<meta name="linhas_resposta"/i.test(enunciado)) {
    enunciado = `${enunciado}\n<p>[LINHAS_PAUTADAS:5]</p>\n<meta name="linhas_resposta" content="5">\n<meta name="estilo_espaco" content="pautado">`
  }

  return {
    id: qp.id || crypto.randomUUID(),
    numero,
    tipo_questao: tipoQuestao,
    enunciado: enunciado.trim(),
    alternativas: isMultipleChoice ? alternativas : [],
    imagens,
    gabarito,
    pontuacao: qp.pontuacao ?? 1,
    ...(tipoQuestao === 'descritiva' ? { linhas_resposta: 5, estilo_espaco: 'pautado' as const } : {}),
    expandido: true,
    ...(meta?.id_requisicao ? { id_requisicao: meta.id_requisicao } : {}),
    ...(meta?.id_disciplina ? { id_disciplina: meta.id_disciplina, disciplina_id: meta.id_disciplina } : {}),
    ...(meta?.disciplina_nome ? { disciplina_nome: meta.disciplina_nome, disciplina: meta.disciplina_nome } : {}),
    ...(meta?.id_professor ? { id_professor: meta.id_professor } : {}),
    ...(meta?.professor_nome ? { professor_nome: meta.professor_nome } : {})
  }
}

/**
 * High-level helper: parses raw text or rich HTML directly into an array of Simulado/Prova Questao objects
 * ready for QuestoesEditor and PaginationEngine.
 */
export function parseSmartPasteToSimuladoQuestoes(
  rawInput: string,
  meta?: {
    id_requisicao?: string
    id_disciplina?: string
    disciplina_nome?: string
    id_professor?: string
    professor_nome?: string
    startNumber?: number
  }
): any[] {
  const parsedProvas = parseRawTextOrHtmlToQuestoes(rawInput)
  let numCounter = meta?.startNumber ?? 1
  return parsedProvas.map(qp => {
    return convertQuestaoProvaToSimuladoQuestao(qp, numCounter++, meta)
  })
}

/**
 * Applies a bulk gabarito string to a list of questions.
 * Supports both numbered format ("1-A, 2-C, 3-B" or "1:A 2:C") and sequential format ("A C B D E" or "ACBDE").
 */
export function applyBulkGabaritoString(
  questoes: any[],
  gabaritoStr: string
): { updated: any[]; appliedCount: number } {
  if (!gabaritoStr || !gabaritoStr.trim() || !Array.isArray(questoes) || questoes.length === 0) {
    return { updated: questoes, appliedCount: 0 }
  }

  const raw = gabaritoStr.trim()
  const numberedMap = new Map<number, string>()

  // 1. Check for numbered pairs: "1-A", "1. B", "1: C", "01) D", "1 A"
  const pairRegex = /(?:quest[ãa]o\s*)?0*(\d{1,3})\s*[\.\:\-\)\–\—\=\s]\s*\(?([A-Ha-h])\)?(?=\s|$|[,;|\/])/gi
  let m: RegExpExecArray | null
  while ((m = pairRegex.exec(raw)) !== null) {
    const qNum = parseInt(m[1], 10)
    const letter = m[2].toUpperCase()
    if (qNum > 0 && qNum <= 300) {
      numberedMap.set(qNum, letter)
    }
  }

  let appliedCount = 0

  if (numberedMap.size > 0) {
    let qSequentialNum = 0
    const updated = questoes.map((q) => {
      const isApoio = q.tipo_questao === 'texto_apoio' || q.is_texto_apoio || q.isTextoApoio
      if (isApoio) return q
      qSequentialNum++
      const targetLetter = numberedMap.get(q.numero || qSequentialNum) || numberedMap.get(qSequentialNum)
      if (!targetLetter || !Array.isArray(q.alternativas) || q.alternativas.length === 0) return q

      appliedCount++
      const nextAlts = q.alternativas.map((a: any) => {
        const l = (a.letter || a.letra || '').toUpperCase()
        const isMatch = l === targetLetter
        return {
          ...a,
          correct: isMatch,
          eh_correta: isMatch,
          correta: isMatch,
          is_correta: isMatch,
          isCorrect: isMatch
        }
      })
      return { ...q, alternativas: nextAlts, gabarito: targetLetter }
    })
    return { updated, appliedCount }
  }

  // 2. Sequential letters: "A, B, C, D, E" or "A B C D E" or "ABCDE"
  const lettersOnly = (raw.toUpperCase().match(/[A-H]/g) || [])
  if (lettersOnly.length === 0) {
    return { updated: questoes, appliedCount: 0 }
  }

  let letterIdx = 0
  const updated = questoes.map((q) => {
    const isApoio = q.tipo_questao === 'texto_apoio' || q.is_texto_apoio || q.isTextoApoio
    if (isApoio || !Array.isArray(q.alternativas) || q.alternativas.length === 0) return q
    if (letterIdx >= lettersOnly.length) return q

    const targetLetter = lettersOnly[letterIdx++]
    appliedCount++
    const nextAlts = q.alternativas.map((a: any) => {
      const l = (a.letter || a.letra || '').toUpperCase()
      const isMatch = l === targetLetter
      return {
        ...a,
        correct: isMatch,
        eh_correta: isMatch,
        correta: isMatch,
        is_correta: isMatch,
        isCorrect: isMatch
      }
    })
    return { ...q, alternativas: nextAlts, gabarito: targetLetter }
  })

  return { updated, appliedCount }
}
