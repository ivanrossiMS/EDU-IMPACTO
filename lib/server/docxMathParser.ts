import mammoth from 'mammoth'
import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'

// ═══════════════════════════════════════════════════════════════════════════
// OMML (Office Math Markup Language) to LaTeX Converter
// ISO/IEC 29500-1 Math Spec Implementation
// ═══════════════════════════════════════════════════════════════════════════

const MATH_SYMBOL_MAP: Record<string, string> = {
  // Operadores e Relações
  '±': '\\pm',
  '∓': '\\mp',
  '×': '\\times',
  '÷': '\\div',
  '·': '\\cdot',
  '≤': '\\le',
  '≥': '\\ge',
  '≠': '\\ne',
  '≈': '\\approx',
  '≡': '\\equiv',
  '≅': '\\cong',
  '∼': '\\sim',
  '∝': '\\propto',
  '∞': '\\infty',
  '√': '\\sqrt',
  '∛': '\\sqrt[3]',
  '∜': '\\sqrt[4]',
  '∠': '\\angle',
  '°': '^\\circ',
  '′': "'",
  '″': "''",
  '∂': '\\partial',
  '∇': '\\nabla',
  '⊥': '\\perp',
  '∥': '\\parallel',
  '∦': '\\nparallel',

  // Conjuntos e Lógica
  '∈': '\\in',
  '∉': '\\notin',
  '⊂': '\\subset',
  '⊆': '\\subseteq',
  '⊃': '\\supset',
  '⊇': '\\supseteq',
  '∪': '\\cup',
  '∩': '\\cap',
  '∅': '\\emptyset',
  '∀': '\\forall',
  '∃': '\\exists',
  '∄': '\\nexists',
  '¬': '\\neg',
  '∧': '\\land',
  '∨': '\\lor',

  // Letras Gregas Minúsculas
  'α': '\\alpha',
  'β': '\\beta',
  'γ': '\\gamma',
  'δ': '\\delta',
  'ε': '\\epsilon',
  'ϵ': '\\varepsilon',
  'ζ': '\\zeta',
  'η': '\\eta',
  'θ': '\\theta',
  'ϑ': '\\vartheta',
  'ι': '\\iota',
  'κ': '\\kappa',
  'λ': '\\lambda',
  'μ': '\\mu',
  'ν': '\\nu',
  'ξ': '\\xi',
  'π': '\\pi',
  'ϖ': '\\varpi',
  'ρ': '\\rho',
  'ϱ': '\\varrho',
  'σ': '\\sigma',
  'ς': '\\varsigma',
  'τ': '\\tau',
  'υ': '\\upsilon',
  'φ': '\\phi',
  'ϕ': '\\varphi',
  'χ': '\\chi',
  'ψ': '\\psi',
  'ω': '\\omega',

  // Letras Gregas Maiúsculas
  'Γ': '\\Gamma',
  'Δ': '\\Delta',
  'Θ': '\\Theta',
  'Λ': '\\Lambda',
  'Ξ': '\\Xi',
  'Π': '\\Pi',
  'Σ': '\\Sigma',
  'Υ': '\\Upsilon',
  'Φ': '\\Phi',
  'Ψ': '\\Psi',
  'Ω': '\\Omega',

  // Setas e Química
  '→': '\\to',
  '←': '\\leftarrow',
  '↔': '\\leftrightarrow',
  '⇒': '\\Rightarrow',
  '⇐': '\\Leftarrow',
  '⇔': '\\Leftrightarrow',
  '↑': '\\uparrow',
  '↓': '\\downarrow',
  '↦': '\\mapsto',
  '⇄': '\\rightleftarrows',
  '⇌': '\\rightleftharpoons',

  // N-Ary
  '∫': '\\int',
  '∬': '\\iint',
  '∭': '\\iiint',
  '∮': '\\oint',
  '∑': '\\sum',
  '∏': '\\prod',
  '∐': '\\coprod',
  '⋃': '\\bigcup',
  '⋂': '\\bigcap',
}

function cleanMathText(text: string): string {
  if (!text) return ''
  let result = ''
  for (const char of text) {
    if (MATH_SYMBOL_MAP[char]) {
      result += ' ' + MATH_SYMBOL_MAP[char] + ' '
    } else {
      result += char
    }
  }
  return result
}

function getChildByTag(node: any, tagName: string): any {
  if (!node || !node.childNodes) return null
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i]
    const name = (child.localName || child.nodeName || '').replace(/^m:|^w:/, '')
    if (name === tagName) return child
  }
  return null
}

function getChildrenByTag(node: any, tagName: string): any[] {
  const list: any[] = []
  if (!node || !node.childNodes) return list
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i]
    const name = (child.localName || child.nodeName || '').replace(/^m:|^w:/, '')
    if (name === tagName) list.push(child)
  }
  return list
}

export function parseOMMLToLatex(xmlString: string): string {
  try {
    const doc = new DOMParser().parseFromString(
      `<root xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${xmlString}</root>`,
      'text/xml'
    )

    function walk(node: any): string {
      if (!node) return ''
      if (node.nodeType === 3) {
        return cleanMathText(node.nodeValue || '')
      }

      const tag = (node.localName || node.nodeName || '').replace(/^m:|^w:/, '')

      switch (tag) {
        case 'root':
        case 'oMath':
        case 'oMathPara':
        case 'e':
        case 'body':
        case 'p':
        case 'r':
          return Array.from(node.childNodes || []).map(walk).join('')

        case 't':
          return cleanMathText(node.textContent || '')

        case 'sSup': {
          const baseNode = getChildByTag(node, 'e')
          const supNode = getChildByTag(node, 'sup')
          const base = baseNode ? walk(baseNode).trim() : ''
          const sup = supNode ? walk(supNode).trim() : ''
          return `{${base}}^{${sup}}`
        }

        case 'sSub': {
          const baseNode = getChildByTag(node, 'e')
          const subNode = getChildByTag(node, 'sub')
          const base = baseNode ? walk(baseNode).trim() : ''
          const sub = subNode ? walk(subNode).trim() : ''
          return `{${base}}_{${sub}}`
        }

        case 'sSubSup': {
          const baseNode = getChildByTag(node, 'e')
          const subNode = getChildByTag(node, 'sub')
          const supNode = getChildByTag(node, 'sup')
          const base = baseNode ? walk(baseNode).trim() : ''
          const sub = subNode ? walk(subNode).trim() : ''
          const sup = supNode ? walk(supNode).trim() : ''
          return `{${base}}_{${sub}}^{${sup}}`
        }

        case 'sPre': {
          const baseNode = getChildByTag(node, 'e')
          const subNode = getChildByTag(node, 'sub')
          const supNode = getChildByTag(node, 'sup')
          const base = baseNode ? walk(baseNode).trim() : ''
          const sub = subNode ? walk(subNode).trim() : ''
          const sup = supNode ? walk(supNode).trim() : ''
          return `{}_{${sub}}^{${sup}}{${base}}`
        }

        case 'f': {
          const fPr = getChildByTag(node, 'fPr')
          const typeNode = fPr ? getChildByTag(fPr, 'type') : null
          const typeVal = typeNode ? (typeNode.getAttribute('m:val') || typeNode.getAttribute('val')) : ''

          const numNode = getChildByTag(node, 'num')
          const denNode = getChildByTag(node, 'den')
          const num = numNode ? walk(numNode).trim() : ''
          const den = denNode ? walk(denNode).trim() : ''

          if (typeVal === 'noBar') {
            return `\\binom{${num}}{${den}}`
          }
          return `\\frac{${num}}{${den}}`
        }

        case 'rad': {
          const degNode = getChildByTag(node, 'deg')
          const eNode = getChildByTag(node, 'e')
          const deg = degNode ? walk(degNode).trim() : ''
          const radicand = eNode ? walk(eNode).trim() : ''
          if (deg) {
            return `\\sqrt[${deg}]{${radicand}}`
          }
          return `\\sqrt{${radicand}}`
        }

        case 'd': {
          const dPr = getChildByTag(node, 'dPr')
          let begChr = '('
          let endChr = ')'
          let sepChr = ''
          if (dPr) {
            const begNode = getChildByTag(dPr, 'begChr')
            const endNode = getChildByTag(dPr, 'endChr')
            const sepNode = getChildByTag(dPr, 'sepChr')
            if (begNode) begChr = begNode.getAttribute('m:val') || begNode.getAttribute('val') || ''
            if (endNode) endChr = endNode.getAttribute('m:val') || endNode.getAttribute('val') || ''
            if (sepNode) sepChr = sepNode.getAttribute('m:val') || sepNode.getAttribute('val') || ''
          }

          const eNodes = getChildrenByTag(node, 'e')
          const contents = eNodes.map(walk)
          const joined = contents.join(sepChr || ', ')

          const begMap: Record<string, string> = {
            '(': '\\left(',
            '[': '\\left[',
            '{': '\\left\\{',
            '|': '\\left|',
            '‖': '\\left\\|',
            '⟨': '\\left\\langle',
          }
          const endMap: Record<string, string> = {
            ')': '\\right)',
            ']': '\\right]',
            '}': '\\right\\}',
            '|': '\\right|',
            '‖': '\\right\\|',
            '⟩': '\\right\\rangle',
          }

          const left = begMap[begChr] || (begChr ? `\\left${begChr}` : '\\left.')
          const right = endMap[endChr] || (endChr ? `\\right${endChr}` : '\\right.')
          return `${left} ${joined} ${right}`
        }

        case 'func': {
          const fNameNode = getChildByTag(node, 'fName')
          const eNode = getChildByTag(node, 'e')
          const fName = fNameNode ? walk(fNameNode).trim() : ''
          const arg = eNode ? walk(eNode).trim() : ''
          const KNOWN_FUNCS = [
            'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
            'arcsin', 'arccos', 'arctan',
            'sinh', 'cosh', 'tanh',
            'log', 'ln', 'lg', 'lim', 'max', 'min', 'det', 'exp', 'deg', 'gcd'
          ]
          if (KNOWN_FUNCS.includes(fName.toLowerCase())) {
            return `\\${fName.toLowerCase()} ${arg}`
          }
          return `${fName} ${arg}`
        }

        case 'limLow': {
          const eNode = getChildByTag(node, 'e')
          const limNode = getChildByTag(node, 'lim')
          const base = eNode ? walk(eNode).trim() : ''
          const lim = limNode ? walk(limNode).trim() : ''
          return `${base}_{${lim}}`
        }

        case 'limUpp': {
          const eNode = getChildByTag(node, 'e')
          const limNode = getChildByTag(node, 'lim')
          const base = eNode ? walk(eNode).trim() : ''
          const lim = limNode ? walk(limNode).trim() : ''
          return `${base}^{${lim}}`
        }

        case 'nary': {
          const naryPr = getChildByTag(node, 'naryPr')
          let chr = '∑'
          if (naryPr) {
            const chrNode = getChildByTag(naryPr, 'chr')
            if (chrNode) chr = chrNode.getAttribute('m:val') || chrNode.getAttribute('val') || '∑'
          }
          const subNode = getChildByTag(node, 'sub')
          const supNode = getChildByTag(node, 'sup')
          const eNode = getChildByTag(node, 'e')
          const sub = subNode ? walk(subNode).trim() : ''
          const sup = supNode ? walk(supNode).trim() : ''
          const body = eNode ? walk(eNode).trim() : ''

          const NARY_MAP: Record<string, string> = {
            '∑': '\\sum',
            '∏': '\\prod',
            '∐': '\\coprod',
            '∫': '\\int',
            '∬': '\\iint',
            '∭': '\\iiint',
            '∮': '\\oint',
            '⋃': '\\bigcup',
            '⋂': '\\bigcap',
          }
          const op = NARY_MAP[chr] || (MATH_SYMBOL_MAP[chr] || chr)
          let res = op
          if (sub) res += `_{${sub}}`
          if (sup) res += `^{${sup}}`
          return `${res} ${body}`
        }

        case 'm': {
          const rows = getChildrenByTag(node, 'mr')
          const rowStrings = rows.map((r: any) => {
            const cells = getChildrenByTag(r, 'e')
            return cells.map(walk).join(' & ')
          })
          return `\\begin{matrix} ${rowStrings.join(' \\\\ ')} \\end{matrix}`
        }

        case 'eqArr': {
          const rows = getChildrenByTag(node, 'e')
          const rowStrings = rows.map(walk)
          return `\\begin{aligned} ${rowStrings.join(' \\\\ ')} \\end{aligned}`
        }

        case 'bar': {
          const eNode = getChildByTag(node, 'e')
          const barPr = getChildByTag(node, 'barPr')
          let pos = 'top'
          if (barPr) {
            const posNode = getChildByTag(barPr, 'pos')
            if (posNode) pos = posNode.getAttribute('m:val') || posNode.getAttribute('val') || 'top'
          }
          const inner = eNode ? walk(eNode).trim() : ''
          if (pos === 'bot') return `\\underline{${inner}}`
          return `\\overline{${inner}}`
        }

        case 'acc': {
          const accPr = getChildByTag(node, 'accPr')
          let chr = '̂'
          if (accPr) {
            const chrNode = getChildByTag(accPr, 'chr')
            if (chrNode) chr = chrNode.getAttribute('m:val') || chrNode.getAttribute('val') || '̂'
          }
          const eNode = getChildByTag(node, 'e')
          const inner = eNode ? walk(eNode).trim() : ''

          const ACC_MAP: Record<string, string> = {
            '→': '\\vec',
            '\u20D7': '\\vec',
            '̂': '\\hat',
            '^': '\\hat',
            '̇': '\\dot',
            '.': '\\dot',
            '̈': '\\ddot',
            '..': '\\ddot',
            '̄': '\\bar',
            '¯': '\\bar',
            '̃': '\\tilde',
            '~': '\\tilde',
          }
          const cmd = ACC_MAP[chr] || '\\hat'
          return `${cmd}{${inner}}`
        }

        case 'box':
        case 'borderBox': {
          const eNode = getChildByTag(node, 'e')
          return `\\boxed{${eNode ? walk(eNode).trim() : ''}}`
        }

        default:
          return Array.from(node.childNodes || []).map(walk).join('')
      }
    }

    return walk(doc.documentElement).trim()
  } catch (err) {
    console.error('Error parsing OMML to LaTeX:', err)
    return ''
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES & CLEANING UTILS
// ═══════════════════════════════════════════════════════════════════════════

export interface AltMarker {
  pos: number
  end: number
  letter: string
}

export interface ParsedBlock {
  statement: string
  alternatives: { letter: string; text: string; correct: boolean }[]
  detectedGabarito?: string
}

export interface ParsedQuestion {
  numero: number
  enunciado: string
  alternativas: { letter: string; text: string; correct: boolean }[]
  imagens: { src: string; contentType?: string }[]
  gabarito: string
  pontuacao: number
}

export function cleanEnunciadoHtml(html: string): string {
  if (!html) return ''
  const metaTags: string[] = []
  let cleaned = html.replace(/^(?:\s*<meta[^>]+>)+/gi, (match) => {
    metaTags.push(match)
    return ''
  })
  let prev = ''
  while (cleaned !== prev) {
    prev = cleaned
    cleaned = cleaned
      .replace(/^[\s\r\n\t]+/, '')
      .replace(/^(?:<br\s*\/?>|&nbsp;)+/gi, '')
      .replace(/^<p\b[^>]*>(?:\s|<br\s*\/?>|&nbsp;)*<\/p>/gi, '')
      .replace(/^<div\b[^>]*>(?:\s|<br\s*\/?>|&nbsp;)*<\/div>/gi, '')
      .replace(/^<p\b[^>]*>(?:\s|<br\s*\/?>|&nbsp;)+/gi, '<p>')
      .replace(/^<div\b[^>]*>(?:\s|<br\s*\/?>|&nbsp;)+/gi, '<div>')
  }
  prev = ''
  while (cleaned !== prev) {
    prev = cleaned
    cleaned = cleaned
      .replace(/[\s\r\n\t]+$/, '')
      .replace(/(?:<br\s*\/?>|&nbsp;)+$/gi, '')
      .replace(/<p\b[^>]*>(?:\s|<br\s*\/?>|&nbsp;)*<\/p>$/gi, '')
      .replace(/<div\b[^>]*>(?:\s|<br\s*\/?>|&nbsp;)*<\/div>$/gi, '')
      .replace(/(?:\s|<br\s*\/?>|&nbsp;)+<\/p>$/gi, '</p>')
      .replace(/(?:\s|<br\s*\/?>|&nbsp;)+<\/div>$/gi, '</div>')
  }
  const prefix = metaTags.length > 0 ? metaTags.join('\n') + '\n' : ''
  return prefix + cleaned
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE: parse one question block into statement + alternatives
// ═══════════════════════════════════════════════════════════════════════════

export function parseBlock(block: string): ParsedBlock {
  let explicitGabaritoLetter = ''

  // 1. Check for trailing gabarito at the very end of the block (e.g. "Gabarito: c", "gabarito b", "Resposta: A", "Resp. D")
  const trailingGabRe = /(?:[\n\r\s,;.\-\–\—]|^)(?:\(?\s*(?:gabarito|resposta(?:\s+correta)?|resp|chave)[\s\:\-\–\—\=]+(?:\(?\s*)?([a-eA-E])(?:\s*\)?)?[\s\.\,\;]*\s*)$/i
  const gabMatch = block.match(trailingGabRe)
  if (gabMatch) {
    explicitGabaritoLetter = gabMatch[1].toUpperCase()
    block = block.slice(0, gabMatch.index).trim()
  }

  // Mask GABARITO markers so they don't break regex position indices
  const spaceBlock = block.replace(/\[\[GABARITO\]\]/g, '            ')
  const markerRe = /(^|[\s\n,;:!?\u2013\u2014])(?:<[^>]+>)*([a-eA-E])(?:<[^>]+>)*\s*[\.\-\)](?:<[^>]+>)*\s+/gm

  const found: AltMarker[] = []
  let m: RegExpExecArray | null

  while ((m = markerRe.exec(spaceBlock)) !== null) {
    const letter = m[2].toUpperCase()
    const letterPos = m.index + m[1].length
    const end = m.index + m[0].length
    found.push({ pos: letterPos, end, letter })
  }

  if (found.length === 0) {
    return {
      statement: cleanEnunciadoHtml(block.trim()),
      alternatives: [],
      detectedGabarito: explicitGabaritoLetter || undefined,
    }
  }

  // Find the best valid sequence (must start at A and go up)
  const LETTERS = 'ABCDE'
  let bestSeq: AltMarker[] = []

  for (let i = 0; i < found.length; i++) {
    if (found[i].letter !== 'A') continue

    const seq: AltMarker[] = [found[i]]
    let next = 1

    for (let j = i + 1; j < found.length && next < LETTERS.length; j++) {
      if (found[j].letter === LETTERS[next] && found[j].pos > seq[seq.length - 1].pos) {
        seq.push(found[j])
        next++
      }
    }

    if (seq.length >= 2 && seq.length > bestSeq.length) {
      bestSeq = seq
    }
  }

  if (bestSeq.length < 2 && found.length >= 2) {
    const seq: AltMarker[] = [found[0]]
    for (let j = 1; j < found.length; j++) {
      if (found[j].letter.charCodeAt(0) === seq[seq.length - 1].letter.charCodeAt(0) + 1) {
        seq.push(found[j])
      }
    }
    if (seq.length >= 2) bestSeq = seq
  }

  if (bestSeq.length < 2) {
    return {
      statement: cleanEnunciadoHtml(block.trim()),
      alternatives: [],
      detectedGabarito: explicitGabaritoLetter || undefined,
    }
  }

  // Extract statement
  const statement = cleanEnunciadoHtml(block.slice(0, bestSeq[0].pos).trim())

  // Extract each alternative's text
  const alternatives: { letter: string; text: string; correct: boolean }[] = []
  for (let i = 0; i < bestSeq.length; i++) {
    const start = bestSeq[i].end
    const end = i + 1 < bestSeq.length ? bestSeq[i + 1].pos : block.length

    const markerStart = bestSeq[i].pos
    const markerText = block.slice(markerStart, start)
    const textPart = block.slice(start, end)

    const fullAltText = markerText + textPart
    let isCorrect = fullAltText.includes('[[GABARITO]]') || (explicitGabaritoLetter === bestSeq[i].letter)

    let text = textPart
      .replace(/\[\[GABARITO\]\]/g, '')
      .trim()

    // If this is the last alternative and no explicit gabarito was found yet, check inside the text
    if (i === bestSeq.length - 1 && !explicitGabaritoLetter) {
      const altGabMatch = text.match(/(?:[\n\r\s,;.\-\–\—]|^)(?:\(?\s*(?:gabarito|resposta(?:\s+correta)?|resp|chave)[\s\:\-\–\—\=]+(?:\(?\s*)?([a-eA-E])(?:\s*\)?)?[\s\.\,\;]*\s*)$/i)
      if (altGabMatch) {
        explicitGabaritoLetter = altGabMatch[1].toUpperCase()
        text = text.slice(0, altGabMatch.index).trim()
      }
    }

    alternatives.push({ letter: bestSeq[i].letter, text, correct: isCorrect })
  }

  // If explicit gabarito was found, update the alternatives' correct flag
  if (explicitGabaritoLetter) {
    alternatives.forEach((alt) => {
      alt.correct = (alt.letter === explicitGabaritoLetter)
    })
  }

  return {
    statement,
    alternatives,
    detectedGabarito: explicitGabaritoLetter || alternatives.find(a => a.correct)?.letter || undefined,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// QUESTION SPLITTER
// ═══════════════════════════════════════════════════════════════════════════

export function parseQuestionsFromText(text: string, imageMap: Map<string, any>): ParsedQuestion[] {
  const questions: ParsedQuestion[] = []

  // Normalize line endings
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')

  // Header regex: e.g. "1)", "1.", "1 -", "<b>1)</b>", "<strong>1.</strong>"
  const headerRe = /^[ \t]*(?:<(?:b|strong|i|em|u|span\b[^>]*?)>)*(\d{1,3})(?:<\/(?:b|strong|i|em|u|span)>)*\s*[\.\-\)](?:<\/(?:b|strong|i|em|u|span)>)*\s+/gm
  const headers: { index: number; num: number; end: number }[] = []
  let hm: RegExpExecArray | null

  while ((hm = headerRe.exec(normalized)) !== null) {
    const num = parseInt(hm[1])
    if (num > 0 && num <= 300) {
      headers.push({ index: hm.index, num, end: hm.index + hm[0].length })
    }
  }

  // Handle duplicate or restart question numbers
  let lastNum = 0
  const unique = headers.map((h) => {
    if (h.num <= lastNum) {
      h.num = lastNum + 1
    }
    lastNum = h.num
    return h
  })

  // If no numbered headers are found, treat the whole document as question 1 or text of support
  if (unique.length === 0 && normalized.trim().length > 0) {
    const { statement, alternatives, detectedGabarito } = parseBlock(normalized.trim())
    const imgIds: string[] = []
    const cleanStmt = statement.replace(/\[\[IMAGE:(img_\d+)\]\]/g, (_match, id) => {
      imgIds.push(id)
      return `[IMAGEM ${imgIds.length}]`
    }).trim()

    const imagens = imgIds
      .map((id) => imageMap.get(id))
      .filter(Boolean)
      .map((img: any) => ({ src: img.src, contentType: img.contentType }))

    questions.push({
      numero: 1,
      enunciado: cleanStmt,
      alternativas: alternatives,
      imagens,
      gabarito: detectedGabarito || alternatives.find((a) => a.correct)?.letter || '',
      pontuacao: 1,
    })
    return questions
  }

  for (let i = 0; i < unique.length; i++) {
    const blockStart = unique[i].end
    const blockEnd = i + 1 < unique.length ? unique[i + 1].index : normalized.length
    let block = normalized.slice(blockStart, blockEnd).trim()

    // Extract [[IMAGE:id]] markers from this block
    const imgIds: string[] = []
    block = block.replace(/\[\[IMAGE:(img_\d+)\]\]/g, (_match, id) => {
      imgIds.push(id)
      return `[IMAGEM ${imgIds.length}]`
    }).trim()

    // Parse statement + alternatives
    const { statement, alternatives, detectedGabarito } = parseBlock(block)

    // Resolve images
    const imagens = imgIds
      .map((id) => imageMap.get(id))
      .filter(Boolean)
      .map((img: any) => ({ src: img.src, contentType: img.contentType }))

    questions.push({
      numero: unique[i].num,
      enunciado: statement,
      alternativas: alternatives,
      imagens,
      gabarito: detectedGabarito || alternatives.find((a) => a.correct)?.letter || '',
      pontuacao: 1,
    })
  }

  return questions
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCX PARSER WITH FULL MATH & FORMATTING SUPPORT
// ═══════════════════════════════════════════════════════════════════════════

export async function parseDocx(originalBuffer: Buffer): Promise<{ text: string; imageMap: Map<string, any> }> {
  let buffer = originalBuffer
  const formulaMap = new Map<string, string>()
  let formulaIndex = 0

  try {
    const zip = await JSZip.loadAsync(buffer)

    // 1. Extract numbering formats
    const numIdToFormat: Record<string, Record<string, string>> = {}
    try {
      const numXml = await zip.file('word/numbering.xml')?.async('string')
      if (numXml) {
        const abstractMap: Record<string, Record<string, string>> = {}
        const abstractRe = /<w:abstractNum\s+w:abstractNumId="(\d+)"[\s\S]*?<\/w:abstractNum>/g
        let mAbstract
        while ((mAbstract = abstractRe.exec(numXml)) !== null) {
          const absId = mAbstract[1]
          const absContent = mAbstract[0]
          abstractMap[absId] = {}
          const lvlRe = /<w:lvl\s+w:ilvl="(\d+)"[\s\S]*?<\/w:lvl>/g
          let mLvl
          while ((mLvl = lvlRe.exec(absContent)) !== null) {
            const ilvl = mLvl[1]
            const numFmtMatch = mLvl[0].match(/<w:numFmt\s+w:val="([^"]+)"/)
            if (numFmtMatch) abstractMap[absId][ilvl] = numFmtMatch[1]
          }
        }
        const numRe = /<w:num\s+w:numId="(\d+)"[\s\S]*?<\/w:num>/g
        let mNum
        while ((mNum = numRe.exec(numXml)) !== null) {
          const numId = mNum[1]
          const numContent = mNum[0]
          const absIdMatch = numContent.match(/<w:abstractNumId\s+w:val="(\d+)"/)
          if (absIdMatch && abstractMap[absIdMatch[1]]) {
            numIdToFormat[numId] = abstractMap[absIdMatch[1]]
          }
        }
      }
    } catch (e) {
      console.warn('[docxMathParser] Error reading numbering.xml:', e)
    }

    let docXml = await zip.file('word/document.xml')?.async('string')
    if (docXml) {
      let modified = false

      // 2. Convert OMML Math blocks (<m:oMathPara> and <m:oMath>) to tokenized LaTeX markers
      docXml = docXml.replace(/<m:oMathPara\b[\s\S]*?<\/m:oMathPara>|<m:oMath\b[\s\S]*?<\/m:oMath>/g, (match) => {
        const latex = parseOMMLToLatex(match)
        if (!latex || !latex.trim()) return ''
        const fid = `formula_${++formulaIndex}`
        formulaMap.set(fid, latex)
        modified = true
        return `<w:r><w:t>[[MATH:${fid}]]</w:t></w:r>`
      })

      // 3. Inject list numbers as actual text so Mammoth doesn't drop them
      const listCounters: Record<string, number> = {}
      docXml = docXml.replace(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g, (pMatch) => {
        const numPrMatch = pMatch.match(/<w:numPr>[\s\S]*?<\/w:numPr>/)
        if (numPrMatch) {
          const ilvlMatch = numPrMatch[0].match(/<w:ilvl\s+w:val="(\d+)"/)
          const numIdMatch = numPrMatch[0].match(/<w:numId\s+w:val="(\d+)"/)
          if (ilvlMatch && numIdMatch) {
            const ilvl = ilvlMatch[1]
            const numId = numIdMatch[1]
            const format = numIdToFormat[numId]?.[ilvl] || (ilvl === '0' ? 'decimal' : 'lowerLetter')

            if (format === 'decimal' || format === 'lowerLetter' || format === 'upperLetter') {
              const counterKey = `${numId}_${ilvl}`

              Object.keys(listCounters).forEach((k) => {
                if (k.startsWith(`${numId}_`) && parseInt(k.split('_')[1]) > parseInt(ilvl)) {
                  listCounters[k] = 0
                }
              })

              if (!listCounters[counterKey]) listCounters[counterKey] = 0
              listCounters[counterKey]++
              let numStr = listCounters[counterKey].toString()
              if (format === 'lowerLetter') numStr = String.fromCharCode(96 + listCounters[counterKey])
              else if (format === 'upperLetter') numStr = String.fromCharCode(64 + listCounters[counterKey])

              const injectedRun = `<w:r><w:t>${numStr}) </w:t></w:r>`
              const pPrEnd = pMatch.indexOf('</w:pPr>')
              if (pPrEnd !== -1) {
                modified = true
                return pMatch.substring(0, pPrEnd + 8) + injectedRun + pMatch.substring(pPrEnd + 8)
              }
            }
          }
        }
        return pMatch
      })

      // 4. Inject [[GABARITO]] for red text runs
      docXml = docXml.replace(/<w:r\b[^>]*>.*?<\/w:r>/g, (run) => {
        const colorMatch = run.match(/<w:color\s+w:val="([^"]+)"/)
        if (colorMatch) {
          const hex = colorMatch[1]
          let isRed = false
          if (hex && hex.length === 6 && hex.toUpperCase() !== 'AUTO') {
            const r = parseInt(hex.substring(0, 2), 16)
            const g = parseInt(hex.substring(2, 4), 16)
            const b = parseInt(hex.substring(4, 6), 16)
            if (r > 150 && g < 100 && b < 100) isRed = true
          }
          if (isRed) {
            modified = true
            return run.replace(/<w:t( [^>]*)?>([^<]*)<\/w:t>/g, (_match, attrs, text) => {
              return `<w:t${attrs || ''}>${text}[[GABARITO]]</w:t>`
            })
          }
        }
        return run
      })

      if (modified) {
        zip.file('word/document.xml', docXml)
        const newBuf = await zip.generateAsync({ type: 'nodebuffer' })
        buffer = newBuf as Buffer
      }
    }
  } catch (e) {
    console.error('[docxMathParser] Preprocessing error:', e)
  }

  const imageMap = new Map<string, any>()
  let imgIndex = 0

  const result = await mammoth.convertToHtml(
    { buffer },
    {
      convertImage: mammoth.images.imgElement(async (img: any) => {
        try {
          const imgBuffer = await img.read()
          const base64 = imgBuffer.toString('base64')
          const src = `data:${img.contentType};base64,${base64}`
          const id = `img_${++imgIndex}`
          imageMap.set(id, { id, src, contentType: img.contentType })
          return { src: `[[IMAGE:${id}]]` }
        } catch {
          return { src: '' }
        }
      }),
    }
  )

  let html = result.value

  // Preserve image markers
  html = html.replace(/<img\b[^>]*?src="(\[\[IMAGE:[^\]]*\]\])"[^>]*\/?>/gi, '\n$1\n')

  // Replace [[MATH:...]] tokens with full formula spans
  html = html.replace(/\[\[MATH:(formula_\d+)\]\]/g, (_m, fid) => {
    const latex = formulaMap.get(fid) || ''
    const safeDataValue = latex.replace(/"/g, '&quot;')
    return `<span class="ql-formula" data-value="${safeDataValue}">${latex}</span>`
  })

  // Normalize block elements to newlines
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    // Normalize bold and italic tags
    .replace(/<strong\b[^>]*>/gi, '<b>')
    .replace(/<\/strong>/gi, '</b>')
    .replace(/<em\b[^>]*>/gi, '<i>')
    .replace(/<\/em>/gi, '</i>')
    // Strip ONLY unwanted tags, PRESERVING b, i, u, sup, sub, span, table, thead, tbody, tr, td, th
    .replace(/<\/?([a-z0-9]+)(?:\s+[^>]*)?>/gi, (match, tag) => {
      const t = tag.toLowerCase()
      const ALLOWED = ['b', 'i', 'u', 'sup', 'sub', 'span', 'table', 'thead', 'tbody', 'tr', 'td', 'th']
      if (ALLOWED.includes(t)) {
        return match
      }
      return ''
    })
    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Normalize spaces
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { text, imageMap }
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF PARSER via pdf-parse
// ═══════════════════════════════════════════════════════════════════════════

export async function parsePdf(buffer: Buffer): Promise<{ text: string; imageMap: Map<string, any> }> {
  // @ts-ignore
  const pdfParseModule: any = await import('pdf-parse')
  const pdfParse = pdfParseModule.default || pdfParseModule
  const data = await pdfParse(buffer)
  return { text: data.text || '', imageMap: new Map() }
}
