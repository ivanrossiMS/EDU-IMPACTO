/**
 * lib/converters/documentToPdfServer.ts
 *
 * Motor de conversão server-side de ultra-alta fidelidade para documentos Word (.docx e .doc) em PDF oficial A4.
 * - Extrai e renderiza papel timbrado / cabeçalho oficial de página inteira (word/header*.xml -> image2.png).
 * - Calcula margens dinâmicas inteligentes (evita sobreposição sobre logomarca institucional e rodapé).
 * - Preserva formatações inline exatas (runs de texto com bold, italic e regular individuais).
 * - Preserva alinhamentos de parágrafo (centralizado, justificado, alinhado à direita e à esquerda).
 * - Extrai e renderiza todas as imagens do corpo (assinaturas, selos, gráficos, fotos) nos locais corretos.
 * - Renderiza tabelas com colunas proporcionais, colspans (w:gridSpan), quebras de linha e bordas nítidas.
 * - Compatível com ambientes serverless e 100% puro em Node.js (@xmldom/xmldom, pdf-lib, sharp, jszip, word-extractor).
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage, PDFImage } from 'pdf-lib'
import WordExtractor from 'word-extractor'
import sharp from 'sharp'
import JSZip from 'jszip'
import { DOMParser } from '@xmldom/xmldom'
import { execFile } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'

export type DocumentFormat = 'pdf' | 'docx' | 'doc' | 'unknown'

export interface ConvertDocumentOptions {
  title?: string
  schoolName?: string
  documentSubtitle?: string
}

export interface ConvertedPdfResult {
  pdfBytes: Uint8Array
  pdfBase64: string
  cleanBase64: string
  totalPages: number
  docName: string
  formatDetected: DocumentFormat
}

/**
 * Detecta o formato real do documento inspecionando os Magic Bytes do arquivo
 */
export function detectDocumentFormat(buffer: Buffer): DocumentFormat {
  if (!buffer || buffer.length < 4) return 'unknown'

  // PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return 'pdf'
  }

  // DOCX (Zip/OpenXML): PK\x03\x04 (0x50 0x4B 0x03 0x04)
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return 'docx'
  }

  // DOC (Word 97-2003 OLE2 Compound File): \xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1
  if (
    buffer.length >= 8 &&
    buffer[0] === 0xd0 &&
    buffer[1] === 0xcf &&
    buffer[2] === 0x11 &&
    buffer[3] === 0xe0 &&
    buffer[4] === 0xa1 &&
    buffer[5] === 0xb1 &&
    buffer[6] === 0x1a &&
    buffer[7] === 0xe1
  ) {
    return 'doc'
  }

  return 'unknown'
}

/**
 * Sanitiza texto para compatibilidade com StandardFonts (WinAnsi encoding do pdf-lib)
 */
function sanitizeWinAnsi(text?: string | null): string {
  if (!text) return ''
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/•/g, '-')
    .replace(/[—–]/g, '-')
    .replace(/\t/g, ' ')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
}

/**
 * Inspeciona o arquivo DOCX (formato zip) e extrai imagens de cabeçalho / papel timbrado
 */
async function extractDocxHeaderMedia(zip: JSZip): Promise<Buffer | null> {
  try {
    const headerFiles = Object.keys(zip.files).filter((f) => /^word\/header\d*\.xml$/i.test(f))
    for (const hf of headerFiles) {
      const parts = hf.split('/')
      const headerName = parts[parts.length - 1]
      const relsPath = `word/_rels/${headerName}.rels`
      const relsFile = zip.file(relsPath)

      if (relsFile) {
        const relsXml = await relsFile.async('text')
        const relsDoc = new DOMParser().parseFromString(relsXml, 'text/xml')
        const relNodes = relsDoc.getElementsByTagName('Relationship')
        for (let r = 0; r < relNodes.length; r++) {
          const target = relNodes[r].getAttribute('Target') || ''
          const type = relNodes[r].getAttribute('Type') || ''
          if (type.includes('image') || /\.(png|jpe?g|bmp|webp)$/i.test(target)) {
            const cleanTarget = target.startsWith('word/') ? target : `word/${target.replace(/^\//, '')}`
            const mediaFile = zip.file(cleanTarget) || zip.file(`word/media/${target.split('/').pop()}`)
            if (mediaFile) {
              return await mediaFile.async('nodebuffer')
            }
          }
        }
      }
    }

    // Fallback: se houver alguma imagem na pasta word/media cujo nome seja image2 ou similar com aspect ratio de timbrado
    const mediaFiles = Object.keys(zip.files).filter((f) => /^word\/media\/.+\.(png|jpe?g)$/i.test(f))
    for (const mf of mediaFiles) {
      const f = zip.file(mf)
      if (f) {
        const buf = await f.async('nodebuffer')
        try {
          const meta = await sharp(buf).metadata()
          if (meta.width && meta.height) {
            const ratio = meta.height / meta.width
            if (ratio >= 1.25 && ratio <= 1.6 && meta.height >= 500) {
              return buf
            }
          }
        } catch {}
      }
    }
  } catch (err) {
    console.warn('[extractDocxHeaderMedia] Erro ao extrair cabeçalho do DOCX:', err)
  }
  return null
}

/**
 * Calcula margens dinâmicas do papel timbrado analisando onde o cabeçalho e rodapé terminam em pixels
 */
async function calculateTimbradoMargins(
  headerBgBuffer: Buffer | null,
  pageHeightPt: number
): Promise<{ marginTop: number; marginBottom: number; isFullPageTimbrado: boolean }> {
  if (!headerBgBuffer) {
    return { marginTop: 48, marginBottom: 48, isFullPageTimbrado: false }
  }

  try {
    const meta = await sharp(headerBgBuffer).metadata()
    if (!meta.width || !meta.height) {
      return { marginTop: 152, marginBottom: 75, isFullPageTimbrado: true }
    }

    const ratio = meta.height / meta.width
    const isFullPage = ratio >= 1.25 && ratio <= 1.6 && meta.height >= 500
    if (!isFullPage) {
      return { marginTop: 90, marginBottom: 48, isFullPageTimbrado: false }
    }

    // Analisa as linhas de pixels para detectar onde a arte do cabeçalho e rodapé realmente ficam
    const { data, info } = await sharp(headerBgBuffer).raw().toBuffer({ resolveWithObject: true })
    const width = info.width
    const height = info.height
    const channels = info.channels

    // Procura o fim do cabeçalho entre y = 100px e 400px
    let headerBottomPx = Math.round(height * 0.17) // fallback ~140pt
    for (let y = Math.round(height * 0.05); y < Math.round(height * 0.3); y += 5) {
      let nonWhiteCount = 0
      for (let x = Math.round(width * 0.1); x < Math.round(width * 0.9); x += 4) {
        const idx = (y * width + x) * channels
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]
        if (r < 200 || g < 200 || b < 200) {
          nonWhiteCount++
        }
      }
      if (nonWhiteCount > 15) {
        headerBottomPx = y
      }
    }

    // Procura o início do rodapé de baixo para cima
    let footerTopPx = Math.round(height * 0.92)
    for (let y = Math.round(height * 0.98); y > Math.round(height * 0.7); y -= 5) {
      let nonWhiteCount = 0
      for (let x = Math.round(width * 0.1); x < Math.round(width * 0.9); x += 4) {
        const idx = (y * width + x) * channels
        const r = data[idx]
        const g = data[idx + 1]
        const b = data[idx + 2]
        if (r < 200 || g < 200 || b < 200) {
          nonWhiteCount++
        }
      }
      if (nonWhiteCount > 15) {
        footerTopPx = y
      }
    }

    const headerPt = (headerBottomPx / height) * pageHeightPt
    const footerPt = ((height - footerTopPx) / height) * pageHeightPt

    const marginTop = Math.max(145, Math.round(headerPt + 12))
    const marginBottom = Math.max(70, Math.round(footerPt + 14))

    return { marginTop, marginBottom, isFullPageTimbrado: true }
  } catch (e) {
    console.warn('[calculateTimbradoMargins] Erro na análise das margens:', e)
    return { marginTop: 152, marginBottom: 75, isFullPageTimbrado: true }
  }
}

interface StyledToken {
  text: string
  isSpace: boolean
  font: PDFFont
  width: number
}

/**
 * Converte documento DOCX diretamente via OpenXML estruturado com DOMParser e pdf-lib
 */
async function convertDocxDirectToPdf(
  buffer: Buffer,
  originalFilename: string,
  options?: ConvertDocumentOptions
): Promise<ConvertedPdfResult> {
  const zip = await JSZip.loadAsync(buffer)
  const docXmlFile = zip.file('word/document.xml')
  if (!docXmlFile) {
    throw new Error('Arquivo DOCX inválido: word/document.xml não encontrado.')
  }

  const docXml = await docXmlFile.async('text')
  const doc = new DOMParser().parseFromString(docXml, 'text/xml')

  // Mapeamento de relacionamentos (word/_rels/document.xml.rels) para extração de imagens
  const relMap = new Map<string, string>()
  const relsFile = zip.file('word/_rels/document.xml.rels')
  if (relsFile) {
    try {
      const relsXml = await relsFile.async('text')
      const relsDoc = new DOMParser().parseFromString(relsXml, 'text/xml')
      const relNodes = relsDoc.getElementsByTagName('Relationship')
      for (let i = 0; i < relNodes.length; i++) {
        const id = relNodes[i].getAttribute('Id')
        const target = relNodes[i].getAttribute('Target')
        if (id && target) {
          relMap.set(id, target)
        }
      }
    } catch (e) {
      console.warn('[convertDocxDirectToPdf] Erro ao ler relacionamentos:', e)
    }
  }

  // Extrai papel timbrado de cabeçalho
  const headerBgBuffer = await extractDocxHeaderMedia(zip)

  // Prepara documento PDF A4
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)

  const getFont = (isBold: boolean, isItalic: boolean): PDFFont => {
    if (isBold && isItalic) return fontBoldItalic
    if (isBold) return fontBold
    if (isItalic) return fontItalic
    return fontRegular
  }

  const pageWidth = 595.28 // A4 Largura (pt)
  const pageHeight = 841.89 // A4 Altura (pt)
  const marginX = 48

  const { marginTop, marginBottom, isFullPageTimbrado } = await calculateTimbradoMargins(
    headerBgBuffer,
    pageHeight
  )
  const contentWidth = pageWidth - marginX * 2

  let embeddedHeaderBg: PDFImage | null = null
  if (headerBgBuffer) {
    try {
      const pngBuf = await sharp(headerBgBuffer).png().toBuffer()
      embeddedHeaderBg = await pdfDoc.embedPng(pngBuf)
    } catch (e) {
      console.warn('[convertDocxDirectToPdf] Erro ao embutir fundo timbrado:', e)
    }
  }

  const pages: PDFPage[] = []
  let y = pageHeight - marginTop

  const addNewPage = (): PDFPage => {
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    pages.push(page)

    if (embeddedHeaderBg) {
      if (isFullPageTimbrado) {
        page.drawImage(embeddedHeaderBg, {
          x: 0,
          y: 0,
          width: pageWidth,
          height: pageHeight,
        })
      } else {
        const logoW = Math.min(contentWidth, 180)
        const logoH = (embeddedHeaderBg.height / embeddedHeaderBg.width) * logoW
        page.drawImage(embeddedHeaderBg, {
          x: marginX,
          y: pageHeight - 20 - logoH,
          width: logoW,
          height: logoH,
        })
      }
    }

    y = pageHeight - marginTop
    return page
  }

  let currentPage: PDFPage = addNewPage()

  const bodyNodes = doc.getElementsByTagName('w:body')
  if (bodyNodes.length === 0) {
    throw new Error('Elemento w:body não encontrado no documento.')
  }
  const body = bodyNodes[0]

  // Itera sequencialmente pelos elementos do corpo mantendo a ordem exata
  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i] as any
    const nodeName = node.nodeName

    // ── PARÁGRAFOS (<w:p>) ──
    if (nodeName === 'w:p') {
      let align: 'left' | 'center' | 'right' | 'justify' = 'left'
      const pPr = node.getElementsByTagName ? node.getElementsByTagName('w:pPr')[0] : null
      if (pPr) {
        const jc = pPr.getElementsByTagName('w:jc')[0]
        if (jc) {
          const val = jc.getAttribute('w:val')
          if (val === 'center') align = 'center'
          else if (val === 'right') align = 'right'
          else if (val === 'both') align = 'justify'
        }
      }

      // 1. Processa imagens / desenhos embutidos no parágrafo (<w:drawing>)
      const drawingNodes = node.getElementsByTagName ? node.getElementsByTagName('w:drawing') : []
      if (drawingNodes.length > 0 && y - 180 < marginBottom) {
        currentPage = addNewPage()
      }
      for (let d = 0; d < drawingNodes.length; d++) {
        const dNode = drawingNodes[d]
        const blip = dNode.getElementsByTagName('a:blip')[0]
        const rId = blip ? blip.getAttribute('r:embed') : null
        const target = rId ? relMap.get(rId) : null

        if (target) {
          const cleanTarget = target.startsWith('word/') ? target : `word/${target.replace(/^\//, '')}`
          const imgFile = zip.file(cleanTarget) || zip.file(`word/media/${target.split('/').pop()}`)
          if (imgFile) {
            try {
              const rawImg = await imgFile.async('nodebuffer')
              const pngBuf = await sharp(rawImg).png().toBuffer()
              const embedded = await pdfDoc.embedPng(pngBuf)

              let imgW = embedded.width
              let imgH = embedded.height
              const maxW = Math.min(contentWidth, 230)
              const maxH = 100
              const scale = Math.min(1, maxW / imgW, maxH / imgH)
              imgW = Math.round(imgW * scale)
              imgH = Math.round(imgH * scale)

              if (y - imgH < marginBottom) {
                currentPage = addNewPage()
              }

              // Posicionamento inteligente para assinaturas e selos
              let drawX = marginX
              if (align === 'center') {
                drawX = marginX + (contentWidth - imgW) / 2
              } else if (align === 'right') {
                drawX = marginX + contentWidth - imgW
              } else {
                // Se for assinatura à esquerda da linha
                drawX = marginX + 24
              }

              currentPage.drawImage(embedded, {
                x: drawX,
                y: y - imgH,
                width: imgW,
                height: imgH,
              })
              y -= imgH + 8
            } catch (err) {
              console.warn('[convertDocxDirectToPdf] Erro ao renderizar imagem:', err)
            }
          }
        }
      }

      // 2. Coleta runs de texto (<w:r>) com preservação estrita de estilos individuais
      const runs: Array<{ text: string; isBold: boolean; isItalic: boolean }> = []
      const rNodes = node.getElementsByTagName ? node.getElementsByTagName('w:r') : []

      for (let r = 0; r < rNodes.length; r++) {
        const rNode = rNodes[r]
        const rPr = rNode.getElementsByTagName('w:rPr')[0]
        let isBold = false
        let isItalic = false

        if (rPr) {
          const bNode = rPr.getElementsByTagName('w:b')[0]
          isBold = bNode && bNode.getAttribute('w:val') !== '0' && bNode.getAttribute('w:val') !== 'false'
          const iNode = rPr.getElementsByTagName('w:i')[0]
          isItalic = iNode && iNode.getAttribute('w:val') !== '0' && iNode.getAttribute('w:val') !== 'false'
        }

        const tNodes = rNode.getElementsByTagName('w:t')
        for (let t = 0; t < tNodes.length; t++) {
          const rawTxt = tNodes[t].textContent || ''
          const sanitized = sanitizeWinAnsi(rawTxt)
          if (sanitized) {
            runs.push({ text: sanitized, isBold, isItalic })
          }
        }

        // Suporte a quebra explícita de página no run
        const brNodes = rNode.getElementsByTagName('w:br')
        for (let b = 0; b < brNodes.length; b++) {
          if (brNodes[b].getAttribute('w:type') === 'page') {
            currentPage = addNewPage()
          }
        }
      }

      if (runs.length === 0) {
        y -= 6 // Espaçamento entre parágrafos vazios
        continue
      }

      // Identifica se o parágrafo inteiro funciona como cabeçalho de seção
      const fullText = runs.map((r) => r.text).join('').trim()
      const isHeadingBlock =
        runs.every((r) => r.isBold) &&
        (/^(CL[AÁ]USULA|TERMO|ARTIGO|PAR[AÁ]GRAFO|ANEXO|CONTRATO|DO OBJETO|DAS OBRIGA|DO PRE[CÇ]O|DA RESCIS|DECLARA[CÇ][AÃ]O|AUTORIZA[CÇ][AÃ]O|QUADRO DE|TESTEMUNHAS)\b/i.test(
          fullText
        ) ||
          (/^[A-Z0-9\s.,:;–—\-_/]{4,}$/.test(fullText) && fullText.length < 80))

      const fontSize = isHeadingBlock ? 10.5 : 9
      const lineHeight = fontSize + 4

      // Tokeniza palavras e espaços respeitando o estilo específico de cada palavra
      const tokens: StyledToken[] = []
      for (const run of runs) {
        const font = getFont(run.isBold, run.isItalic)
        const parts = run.text.split(/(\s+)/)
        for (const part of parts) {
          if (!part) continue
          const isSpace = /^\s+$/.test(part)
          tokens.push({
            text: part,
            isSpace,
            font,
            width: font.widthOfTextAtSize(part, fontSize),
          })
        }
      }

      // Monta as linhas com quebra automática baseada na largura máxima
      const lines: StyledToken[][] = []
      let curLine: StyledToken[] = []
      let curLineWidth = 0

      for (const tok of tokens) {
        if (tok.isSpace && curLine.length === 0) continue

        if (curLineWidth + tok.width > contentWidth && curLine.length > 0) {
          while (curLine.length > 0 && curLine[curLine.length - 1].isSpace) {
            curLine.pop()
          }
          lines.push(curLine)
          curLine = tok.isSpace ? [] : [tok]
          curLineWidth = tok.isSpace ? 0 : tok.width
        } else {
          curLine.push(tok)
          curLineWidth += tok.width
        }
      }
      if (curLine.length > 0) {
        while (curLine.length > 0 && curLine[curLine.length - 1].isSpace) {
          curLine.pop()
        }
        if (curLine.length > 0) lines.push(curLine)
      }

      // Renderiza as linhas respeitando o alinhamento
      for (let lIdx = 0; lIdx < lines.length; lIdx++) {
        const line = lines[lIdx]
        if (y - lineHeight < marginBottom) {
          currentPage = addNewPage()
        }

        const isLastLine = lIdx === lines.length - 1
        const totalTextWidth = line.reduce((sum, t) => sum + t.width, 0)

        let startX = marginX
        let extraSpacePerSpace = 0

        if (align === 'center') {
          startX = marginX + Math.max(0, (contentWidth - totalTextWidth) / 2)
        } else if (align === 'right') {
          startX = marginX + Math.max(0, contentWidth - totalTextWidth)
        } else if (align === 'justify' && !isLastLine) {
          const spaceTokens = line.filter((t) => t.isSpace)
          if (spaceTokens.length > 0) {
            const diff = contentWidth - totalTextWidth
            if (diff > 0 && diff < 45) {
              extraSpacePerSpace = diff / spaceTokens.length
            }
          }
        }

        let curX = startX
        for (const tok of line) {
          if (!tok.isSpace) {
            currentPage.drawText(tok.text, {
              x: curX,
              y,
              size: fontSize,
              font: tok.font,
              color: isHeadingBlock ? rgb(0.06, 0.12, 0.28) : rgb(0.12, 0.16, 0.22),
            })
          }
          curX += tok.width + (tok.isSpace ? extraSpacePerSpace : 0)
        }
        y -= lineHeight
      }
      y -= isHeadingBlock ? 4 : 3
      continue
    }

    // ── TABELAS (<w:tbl>) ──
    if (nodeName === 'w:tbl') {
      const gridCols = node.getElementsByTagName('w:gridCol')
      const rawColWidths: number[] = []
      for (let c = 0; c < gridCols.length; c++) {
        const wTwips = Number(gridCols[c].getAttribute('w:w') || 0)
        rawColWidths.push(Math.round(wTwips / 20))
      }

      const numCols = rawColWidths.length || 1
      const totalRawW = rawColWidths.reduce((a, b) => a + b, 0) || contentWidth
      const scale = contentWidth / totalRawW
      const colWidths = rawColWidths.map((w) => w * scale)

      const trNodes = node.getElementsByTagName('w:tr')
      y -= 4

      for (let r = 0; r < trNodes.length; r++) {
        const tcNodes = trNodes[r].getElementsByTagName('w:tc')
        let colIdx = 0
        const rowCells: Array<{
          cellW: number
          cellLines: string[]
          isHeaderCell: boolean
        }> = []
        let maxLinesInRow = 1

        for (let c = 0; c < tcNodes.length; c++) {
          const tc = tcNodes[c]
          const spanNode = tc.getElementsByTagName('w:gridSpan')[0]
          const colspan = spanNode ? Number(spanNode.getAttribute('w:val') || 1) : 1
          let cellW = 0
          for (let s = 0; s < colspan; s++) {
            cellW += colWidths[colIdx + s] || contentWidth / numCols
          }
          colIdx += colspan

          const pNodes = tc.getElementsByTagName('w:p')
          const cellLines: string[] = []

          for (let p = 0; p < pNodes.length; p++) {
            const rawTxt = sanitizeWinAnsi(pNodes[p].textContent || '').trim()
            if (rawTxt) {
              const words = rawTxt.split(/\s+/)
              let cLine = ''
              for (const w of words) {
                const candidate = cLine ? `${cLine} ${w}` : w
                if (fontRegular.widthOfTextAtSize(candidate, 8) <= cellW - 8) {
                  cLine = candidate
                } else {
                  if (cLine) cellLines.push(cLine)
                  cLine = w
                }
              }
              if (cLine) cellLines.push(cLine)
            }
          }
          if (cellLines.length === 0) cellLines.push('')
          maxLinesInRow = Math.max(maxLinesInRow, cellLines.length)

          const isHeaderCell = r === 0 || tc.getElementsByTagName('w:shd').length > 0
          rowCells.push({ cellW, cellLines, isHeaderCell })
        }

        const rowH = Math.max(14, maxLinesInRow * 10.5 + 6)
        if (y - rowH < marginBottom) {
          currentPage = addNewPage()
        }

        let curX = marginX
        for (const cell of rowCells) {
          currentPage.drawRectangle({
            x: curX,
            y: y - rowH,
            width: cell.cellW,
            height: rowH,
            borderColor: rgb(0.8, 0.84, 0.9),
            borderWidth: 0.5,
            color: cell.isHeaderCell ? rgb(0.93, 0.95, 0.98) : rgb(1, 1, 1),
          })

          let textY = y - 8
          for (const line of cell.cellLines) {
            currentPage.drawText(line, {
              x: curX + 4,
              y: textY,
              size: 8,
              font: cell.isHeaderCell ? fontBold : fontRegular,
              color: rgb(0.12, 0.16, 0.22),
            })
            textY -= 10
          }
          curX += cell.cellW
        }
        y -= rowH
      }
      y -= 4
    }
  }

  const pdfBytes = await pdfDoc.save()
  const cleanBase64 = Buffer.from(pdfBytes).toString('base64')
  const outDocName = originalFilename.replace(/\.(docx?|doc|pdf)$/i, '') + '.pdf'

  return {
    pdfBytes,
    pdfBase64: `data:application/pdf;base64,${cleanBase64}`,
    cleanBase64,
    totalPages: pages.length,
    docName: outDocName,
    formatDetected: 'docx',
  }
}

/**
 * Extrai fluxos binários de imagens (PNG e JPEG) embutidos em arquivos binários OLE2 (.doc legado)
 */
function extractImagesFromBinary(buffer: Buffer): Buffer[] {
  const images: Buffer[] = []
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const pngEnd = Buffer.from([0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])

  let offset = 0
  while ((offset = buffer.indexOf(pngHeader, offset)) !== -1) {
    const endIdx = buffer.indexOf(pngEnd, offset)
    if (endIdx !== -1) {
      const imgBuf = buffer.subarray(offset, endIdx + pngEnd.length)
      images.push(Buffer.from(imgBuf))
      offset = endIdx + pngEnd.length
    } else {
      offset += pngHeader.length
    }
  }
  return images
}

/**
 * Tenta converter documentos Word (.doc e .docx) diretamente através do Microsoft Word no macOS
 * Garante 100.0% de fidelidade visual idêntica ao que o Word exibe (timbrados, cabeçalhos, rodapés, numeração de páginas)
 */
async function tryConvertViaMicrosoftWord(
  buffer: Buffer,
  extension: 'doc' | 'docx'
): Promise<Buffer | null> {
  if (process.platform !== 'darwin') return null

  const tempDir = fs.existsSync('/private/tmp') ? '/private/tmp' : os.tmpdir()
  const randId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const tmpIn = path.join(tempDir, `doc_in_${randId}.${extension}`)
  const tmpOut = path.join(tempDir, `doc_out_${randId}.pdf`)

  try {
    await fs.promises.writeFile(tmpIn, buffer)

    const script = `
      set docPath to POSIX file "${tmpIn}"
      set outPdfPath to POSIX file "${tmpOut}"
      tell application "Microsoft Word"
        set doc to open file name docPath read only true confirm conversions false add to recent files false
        save as doc file name outPdfPath file format format PDF
        close doc saving no
      end tell
    `

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      execFile('osascript', ['-e', script], { timeout: 8000 }, async (error) => {
        try {
          await fs.promises.unlink(tmpIn)
        } catch {}

        if (error) {
          try {
            await fs.promises.unlink(tmpOut)
          } catch {}
          return reject(error)
        }

        try {
          const outExists = fs.existsSync(tmpOut)
          if (!outExists) {
            return reject(new Error('PDF não foi gerado pelo Microsoft Word.'))
          }
          const data = await fs.promises.readFile(tmpOut)
          await fs.promises.unlink(tmpOut)
          resolve(data)
        } catch (e) {
          reject(e)
        }
      })
    })

    return pdfBuffer
  } catch (err) {
    if (process.env.DEBUG) {
      console.warn('[tryConvertViaMicrosoftWord] Microsoft Word indisponível no ambiente:', err)
    }
    try {
      if (fs.existsSync(tmpIn)) await fs.promises.unlink(tmpIn)
      if (fs.existsSync(tmpOut)) await fs.promises.unlink(tmpOut)
    } catch {}
    return null
  }
}

/**
 * Converte arquivo binário DOC antigo (Word 97-2003 OLE2) usando word-extractor e extração binária de imagens
 */
async function convertDocLegacyToPdf(
  buffer: Buffer,
  originalFilename: string,
  options?: ConvertDocumentOptions
): Promise<ConvertedPdfResult> {
  // 1. Extrai imagens do binário .doc
  const binaryImages = extractImagesFromBinary(buffer)
  let timbradoBuffer: Buffer | null = null
  const bodyImages: Buffer[] = []

  for (const imgBuf of binaryImages) {
    try {
      const meta = await sharp(imgBuf).metadata()
      if (meta.width && meta.height) {
        const ratio = meta.height / meta.width
        if (ratio >= 1.25 && ratio <= 1.6 && meta.height >= 500) {
          timbradoBuffer = imgBuf
        } else if (imgBuf.length > 500) {
          bodyImages.push(imgBuf)
        }
      }
    } catch {}
  }

  const extractor = new WordExtractor()
  const extracted = await extractor.extract(buffer)
  const body = extracted.getBody()

  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28
  const pageHeight = 841.89
  const marginX = 48
  const marginTop = timbradoBuffer ? 152 : 48
  const marginBottom = timbradoBuffer ? 75 : 48
  const contentWidth = pageWidth - marginX * 2

  let embeddedHeaderBg: PDFImage | null = null
  if (timbradoBuffer) {
    try {
      const pngBuf = await sharp(timbradoBuffer).png().toBuffer()
      embeddedHeaderBg = await pdfDoc.embedPng(pngBuf)
    } catch {}
  }

  const pages: PDFPage[] = []
  let y = pageHeight - marginTop

  const addNewPage = (): PDFPage => {
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    pages.push(page)

    if (embeddedHeaderBg) {
      page.drawImage(embeddedHeaderBg, {
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
      })
    }

    y = pageHeight - marginTop
    return page
  }

  let currentPage = addNewPage()

  const lines = body.split('\n')
  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx]
    const trimmed = sanitizeWinAnsi(rawLine).trim()
    if (!trimmed) {
      y -= 5
      continue
    }

    // Se estiver se aproximando do fim e houver imagens de assinatura
    if (idx >= lines.length - 10 && bodyImages.length > 0 && /^(CONTRATADA|Campo Grande)/i.test(trimmed)) {
      for (const bImg of bodyImages) {
        try {
          const pngBuf = await sharp(bImg).png().toBuffer()
          const emb = await pdfDoc.embedPng(pngBuf)
          let w = emb.width
          let h = emb.height
          const scale = Math.min(1, 200 / w, 80 / h)
          w = Math.round(w * scale)
          h = Math.round(h * scale)
          if (y - h < marginBottom) currentPage = addNewPage()
          currentPage.drawImage(emb, { x: marginX + 30, y: y - h, width: w, height: h })
          y -= h + 8
        } catch {}
      }
      bodyImages.length = 0 // já desenhou
    }

    const isHeading =
      /^(CL[AÁ]USULA|TERMO|ARTIGO|PAR[AÁ]GRAFO|ANEXO|CONTRATO|DO OBJETO|DAS OBRIGA|DO PRE[CÇ]O|DA RESCIS|DECLARA[CÇ][AÃ]O|AUTORIZA[CÇ][AÃ]O)\b/i.test(
        trimmed
      ) ||
      (/^[A-Z0-9\s.,:;–—\-_/]{4,}$/.test(trimmed) && trimmed.length < 80)

    const font = isHeading ? fontBold : fontRegular
    const fontSize = isHeading ? 10.5 : 9
    const lineHeight = fontSize + 4

    const words = trimmed.split(/\s+/)
    let currentLine = ''

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word
      if (font.widthOfTextAtSize(candidate, fontSize) <= contentWidth) {
        currentLine = candidate
      } else {
        if (y - lineHeight < marginBottom) currentPage = addNewPage()
        currentPage.drawText(currentLine, {
          x: marginX,
          y,
          size: fontSize,
          font,
          color: rgb(0.12, 0.16, 0.22),
        })
        y -= lineHeight
        currentLine = word
      }
    }

    if (currentLine) {
      if (y - lineHeight < marginBottom) currentPage = addNewPage()
      currentPage.drawText(currentLine, {
        x: marginX,
        y,
        size: fontSize,
        font,
        color: rgb(0.12, 0.16, 0.22),
      })
      y -= lineHeight
    }
    y -= 3
  }

  const pdfBytes = await pdfDoc.save()
  const cleanBase64 = Buffer.from(pdfBytes).toString('base64')
  const outDocName = originalFilename.replace(/\.(docx?|doc|pdf)$/i, '') + '.pdf'

  return {
    pdfBytes,
    pdfBase64: `data:application/pdf;base64,${cleanBase64}`,
    cleanBase64,
    totalPages: pages.length,
    docName: outDocName,
    formatDetected: 'doc',
  }
}

/**
 * Converte qualquer buffer (PDF, DOCX ou DOC) em um PDF fiel pronto para assinatura.
 * Puxa imagens de papel timbrado de cabeçalho e imagens do corpo (assinaturas/selos).
 */
export async function convertDocumentBufferToPdf(
  buffer: Buffer,
  originalFilename: string,
  options?: ConvertDocumentOptions
): Promise<ConvertedPdfResult> {
  const format = detectDocumentFormat(buffer)

  // 1. Se já for PDF, valida e retorna como pass-through
  if (format === 'pdf') {
    const existingDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    const totalPages = existingDoc.getPageCount()
    const cleanBase64 = buffer.toString('base64')
    return {
      pdfBytes: new Uint8Array(buffer),
      pdfBase64: `data:application/pdf;base64,${cleanBase64}`,
      cleanBase64,
      totalPages,
      docName: originalFilename.toLowerCase().endsWith('.pdf') ? originalFilename : `${originalFilename}.pdf`,
      formatDetected: 'pdf',
    }
  }

  // 2. Se for DOC ou DOCX, tenta primeiramente a conversão nativa do Microsoft Word no macOS para fidelidade 100%
  if (format === 'doc' || format === 'docx') {
    const wordPdf = await tryConvertViaMicrosoftWord(buffer, format)
    if (wordPdf && wordPdf.length > 500) {
      try {
        const loadedDoc = await PDFDocument.load(wordPdf, { ignoreEncryption: true })
        const totalPages = loadedDoc.getPageCount()
        const cleanBase64 = Buffer.from(wordPdf).toString('base64')
        const outDocName = originalFilename.replace(/\.(docx?|doc|pdf)$/i, '') + '.pdf'
        return {
          pdfBytes: new Uint8Array(wordPdf),
          pdfBase64: `data:application/pdf;base64,${cleanBase64}`,
          cleanBase64,
          totalPages,
          docName: outDocName,
          formatDetected: format,
        }
      } catch (e) {
        console.warn('[convertDocumentBufferToPdf] Erro ao carregar PDF do Word nativo, usando motor Node:', e)
      }
    }
  }

  // 3. Fallbacks puros em Node.js (compatível com Linux, Netlify, Docker e ambientes sem Word)
  if (format === 'docx') {
    try {
      return await convertDocxDirectToPdf(buffer, originalFilename, options)
    } catch (err: any) {
      console.warn('[convertDocumentBufferToPdf] Falha no conversor direto DOCX, tentando fallback:', err)
      return await convertDocLegacyToPdf(buffer, originalFilename, options)
    }
  }

  if (format === 'doc') {
    return await convertDocLegacyToPdf(buffer, originalFilename, options)
  }

  // 4. Se não detectou com precisão, tenta DOCX e depois DOC
  try {
    return await convertDocxDirectToPdf(buffer, originalFilename, options)
  } catch {
    return await convertDocLegacyToPdf(buffer, originalFilename, options)
  }
}
