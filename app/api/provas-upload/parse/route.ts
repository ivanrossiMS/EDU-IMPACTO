import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'

export const dynamic = 'force-dynamic'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface AltMarker {
  pos: number     // position of the letter itself in the block
  end: number     // position right after "a) " marker (where text starts)
  letter: string  // uppercase A-E
}

interface ParsedBlock {
  statement: string
  alternatives: { letter: string; text: string; correct: boolean }[]
}

// ═══════════════════════════════════════════════════════════════════════════
// CORE: parse one question block into statement + alternatives
//
// Strategy: scan the ENTIRE block text for all potential a), b), c)... markers,
// find the best A→B→C→D→E sequence, then slice text at those positions.
// This handles: multi-line, single-line, inline, mixed — any format.
// ═══════════════════════════════════════════════════════════════════════════
function parseBlock(block: string): ParsedBlock {
  // Match: (start | whitespace/punct) + letter(a-e) + ) + whitespace
  // Capture group 1 = optional leading char, group 2 = the letter
  // We use a simpler approach without lookbehind for max compatibility:
  // match includes an optional non-word prefix char and optional formatting tags
  const spaceBlock = block.replace(/\[\[GABARITO\]\]/g, '            ')
  const markerRe = /(^|[\s\n,;:!?\u2013\u2014])(?:<[biu]>)*([a-eA-E])(?:<\/[biu]>)*\s*[\.\-\)](?:<\/[biu]>)*\s+/gm

  const found: AltMarker[] = []
  let m: RegExpExecArray | null

  while ((m = markerRe.exec(spaceBlock)) !== null) {
    const letter = m[2].toUpperCase()
    // m[0] = full match e.g. "\na) "
    // m[1] = prefix char e.g. "\n" (or empty at start)
    // m[2] = the letter
    // letter position = m.index + m[1].length
    const letterPos = m.index + m[1].length
    // end = right after the whole "a) " (where alternative text starts)
    const end = m.index + m[0].length
    found.push({ pos: letterPos, end, letter })
  }

  if (found.length === 0) {
    return { statement: block.trim(), alternatives: [] }
  }

  // ── Find the best valid sequence (must start at A and go up) ──────────
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

  // If we couldn't find a valid A-B-C sequence, try any 2+ letter sequence
  // (for questions with only b) c) d) e) due to PDF extraction artifacts)
  if (bestSeq.length < 2 && found.length >= 2) {
    const seq: AltMarker[] = [found[0]]
    const expectedCode = found[0].letter.charCodeAt(0) + 1

    for (let j = 1; j < found.length; j++) {
      if (found[j].letter.charCodeAt(0) === seq[seq.length - 1].letter.charCodeAt(0) + 1) {
        seq.push(found[j])
      }
    }

    if (seq.length >= 2) bestSeq = seq
  }

  if (bestSeq.length < 2) {
    return { statement: block.trim(), alternatives: [] }
  }

  // ── Extract statement (everything before the first alt marker) ─────────
  const statement = block.slice(0, bestSeq[0].pos).trim()

  // ── Extract each alternative's text ───────────────────────────────────
  const alternatives: { letter: string; text: string; correct: boolean }[] = []
  for (let i = 0; i < bestSeq.length; i++) {
    const start = bestSeq[i].end
    const end = i + 1 < bestSeq.length ? bestSeq[i + 1].pos : block.length
    
    const markerStart = bestSeq[i].pos
    const markerText = block.slice(markerStart, start)
    const textPart = block.slice(start, end)
    
    const fullAltText = markerText + textPart
    const correct = fullAltText.includes('[[GABARITO]]')
    
    let text = textPart
      .replace(/\[\[GABARITO\]\]/g, '')
      .trim()
      .replace(/\s+/g, ' ') // collapse whitespace/newlines within alt text
      
    alternatives.push({ letter: bestSeq[i].letter, text, correct })
  }

  return { statement: statement, alternatives }
}

// ═══════════════════════════════════════════════════════════════════════════
// QUESTION SPLITTER: find question headers and split text into blocks
// ═══════════════════════════════════════════════════════════════════════════
function parseQuestionsFromText(text: string, imageMap: Map<string, any>): any[] {
  const questions: any[] = []

  // Normalize line endings
  const normalized = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')

  // Question headers: number at start of line followed by . or ) and a space.
  // Uses ^[ \t]*(?:<[biu]>)*(\d{1,3}) with multiline to support bold headers and leading spaces.
  const headerRe = /^[ \t]*(?:<[biu]>)*(\d{1,3})(?:<\/[biu]>)*\s*[\.\-\)](?:<\/[biu]>)*\s+/gm
  const headers: { index: number; num: number; end: number }[] = []
  let hm: RegExpExecArray | null

  while ((hm = headerRe.exec(normalized)) !== null) {
    const num = parseInt(hm[1])
    if (num > 0 && num <= 300) {
      headers.push({ index: hm.index, num, end: hm.index + hm[0].length })
    }
  }

  // Deduplicate: keep only first occurrence of each question number
  const seen = new Set<number>()
  const unique = headers.filter(h => {
    if (seen.has(h.num)) return false
    seen.add(h.num)
    return true
  })

  for (let i = 0; i < unique.length; i++) {
    const blockStart = unique[i].end
    const blockEnd = i + 1 < unique.length ? unique[i + 1].index : normalized.length
    let block = normalized.slice(blockStart, blockEnd).trim()

    // ── Extract [[IMAGE:id]] markers from this block ────────────────────
    const imgIds: string[] = []
    block = block.replace(/\[\[IMAGE:(img_\d+)\]\]/g, (_match, id) => {
      imgIds.push(id)
      return `[IMAGEM ${imgIds.length}]` // keep marker with index without extra newlines
    }).trim()

    // ── Parse statement + alternatives ──────────────────────────────────
    const { statement, alternatives } = parseBlock(block)

    // ── Resolve images ───────────────────────────────────────────────────
    const imagens = imgIds
      .map(id => imageMap.get(id))
      .filter(Boolean)
      .map((img: any) => ({ src: img.src, contentType: img.contentType }))

    questions.push({
      numero: unique[i].num,
      enunciado: statement,
      alternativas: alternatives,
      imagens,
      gabarito: alternatives.find(a => a.correct)?.letter || '',
      pontuacao: 1,
    })
  }

  return questions
}

// ═══════════════════════════════════════════════════════════════════════════
// DOCX PARSER via mammoth
// KEY FIX: preserve [[IMAGE:id]] markers BEFORE stripping HTML tags,
// because stripping <img src="[[IMAGE:img_1]]"> would destroy the marker.
// ═══════════════════════════════════════════════════════════════════════════

async function parseDocx(originalBuffer: Buffer): Promise<{ text: string; imageMap: Map<string, any> }> {
  const mammoth = (await import('mammoth')).default

  // Pre-process DOCX to inject list numbering and [[GABARITO]] for red text
  let buffer = originalBuffer
  try {
    const JSZip = (await import('jszip')).default || await import('jszip')
    const zip = await JSZip.loadAsync(buffer)
    
    // 1. Extract numbering formats
    let numIdToFormat: Record<string, string> = {}
    try {
      const numXml = await zip.file('word/numbering.xml')?.async('string')
      if (numXml) {
        const abstractMap: Record<string, string> = {}
        const abstractRe = /<w:abstractNum\s+w:abstractNumId="(\d+)"[\s\S]*?<\/w:abstractNum>/g
        let mAbstract
        while ((mAbstract = abstractRe.exec(numXml)) !== null) {
          const absId = mAbstract[1]
          const absContent = mAbstract[0]
          const lvl0Match = absContent.match(/<w:lvl\s+w:ilvl="0"[\s\S]*?<\/w:lvl>/)
          if (lvl0Match) {
            const numFmtMatch = lvl0Match[0].match(/<w:numFmt\s+w:val="([^"]+)"/)
            if (numFmtMatch) abstractMap[absId] = numFmtMatch[1]
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
    } catch(e) {}

    let docXml = await zip.file('word/document.xml')?.async('string')
    if (docXml) {
      let modified = false
      
      // 2. Inject list numbers as actual text so Mammoth doesn't drop them
      let listCounters: Record<string, number> = {}
      docXml = docXml.replace(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g, (pMatch, pContentInner) => {
        const numPrMatch = pMatch.match(/<w:numPr>[\s\S]*?<\/w:numPr>/)
        if (numPrMatch) {
          const ilvlMatch = numPrMatch[0].match(/<w:ilvl\s+w:val="(\d+)"/)
          const numIdMatch = numPrMatch[0].match(/<w:numId\s+w:val="(\d+)"/)
          if (ilvlMatch && numIdMatch) {
            const ilvl = ilvlMatch[1]
            const numId = numIdMatch[1]
            if (ilvl === "0") {
              const format = numIdToFormat[numId] || 'decimal'
              if (format === 'decimal' || format === 'lowerLetter' || format === 'upperLetter') {
                if (!listCounters[numId]) listCounters[numId] = 0
                listCounters[numId]++
                let numStr = listCounters[numId].toString()
                if (format === 'lowerLetter') numStr = String.fromCharCode(96 + listCounters[numId])
                else if (format === 'upperLetter') numStr = String.fromCharCode(64 + listCounters[numId])
                
                const injectedRun = `<w:r><w:t>${numStr}) </w:t></w:r>`
                const pPrEnd = pMatch.indexOf('</w:pPr>')
                if (pPrEnd !== -1) {
                  modified = true
                  return pMatch.substring(0, pPrEnd + 8) + injectedRun + pMatch.substring(pPrEnd + 8)
                }
              }
            }
          }
        }
        return pMatch
      })

      // 3. Inject [[GABARITO]]
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
            return run.replace(/<w:t( [^>]*)?>([^<]*)<\/w:t>/g, (match, attrs, text) => {
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
    console.error('Error injecting GABARITO:', e)
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
          // mammoth will place this as <img src="[[IMAGE:img_1]]">
          return { src: `[[IMAGE:${id}]]` }
        } catch {
          return { src: '' }
        }
      }),
    }
  )

  // Step 1: preserve our [[IMAGE:...]] markers BEFORE any HTML stripping
  // mammoth creates: <img src="[[IMAGE:img_1]]"> — we extract the marker first
  let html = result.value
  html = html.replace(/<img\b[^>]*?src="(\[\[IMAGE:[^\]]*\]\])"[^>]*\/?>/gi, '\n$1\n')

  // Step 2: convert block elements to newlines
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    // Step 2.5: simplify bold/italic tags
    .replace(/<strong\b[^>]*>/gi, '<b>')
    .replace(/<\/strong>/gi, '</b>')
    .replace(/<em\b[^>]*>/gi, '<i>')
    .replace(/<\/em>/gi, '</i>')
    // Step 3: strip all remaining tags EXCEPT b, i, u
    .replace(/<\/?([a-z0-9]+)[^>]*>/gi, (match, tag) => {
      const t = tag.toLowerCase()
      if (t === 'b' || t === 'i' || t === 'u') return match
      return ''
    })
    // Step 4: decode entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, ' ')
    // Step 5: normalize whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { text, imageMap }
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF PARSER via pdf-parse
// ═══════════════════════════════════════════════════════════════════════════
async function parsePdf(buffer: Buffer): Promise<{ text: string; imageMap: Map<string, any> }> {
  // @ts-ignore
  const pdfParseModule: any = await import('pdf-parse')
  const pdfParse = pdfParseModule.default || pdfParseModule
  const data = await pdfParse(buffer)
  return { text: data.text || '', imageMap: new Map() }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST HANDLER
// ═══════════════════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth()
  if (errorResponse) return errorResponse

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const filename = file.name.toLowerCase()
    
    // DEBUG: Save uploaded file to examine its structure
    try {
      require('fs').writeFileSync('/Users/ivanrossi/Desktop/Documentos-Backup/Área de Trabalho/EDU-IMPACTO/impacto-edu-app/debug.docx', buffer)
    } catch (err) {}

    let text = ''
    let imageMap = new Map<string, any>()

    if (filename.endsWith('.docx') || filename.endsWith('.doc')) {
      try {
        const r = await parseDocx(buffer)
        text = r.text
        imageMap = r.imageMap
      } catch (err: any) {
        if (err.message && err.message.includes('End of data reached')) {
          return NextResponse.json(
            { error: 'O arquivo .DOC enviado é de um formato antigo (Word 97-2003). Por favor, abra-o no Word e salve como .DOCX para importar.' },
            { status: 400 }
          )
        }
        throw err
      }
    } else if (filename.endsWith('.pdf')) {
      const r = await parsePdf(buffer)
      text = r.text
      imageMap = r.imageMap
    } else {
      return NextResponse.json(
        { error: 'Formato não suportado. Use .docx ou .pdf.' },
        { status: 400 }
      )
    }

    if (!text || text.trim().length < 10) {
      return NextResponse.json(
        { error: 'Não foi possível extrair texto. O arquivo pode estar protegido ou corrompido.' },
        { status: 400 }
      )
    }

    const questions = parseQuestionsFromText(text, imageMap)

    return NextResponse.json({
      success: true,
      totalQuestoes: questions.length,
      questoes: questions,
      // Send first 1000 chars of raw text for debugging
      rawText: text.slice(0, 1000) + (text.length > 1000 ? `\n...[+${text.length - 1000} chars]` : ''),
    })
  } catch (e: any) {
    console.error('[ProvasUpload Parse Error]', e)
    return NextResponse.json(
      { error: `Erro ao processar arquivo: ${e.message}` },
      { status: 500 }
    )
  }
}
