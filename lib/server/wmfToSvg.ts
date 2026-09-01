/**
 * Pure TypeScript WMF (Windows Metafile) & EMF (Enhanced Metafile) to SVG Converter
 * Enables modern web browsers to render Word embedded equations, MathType, and vector graphics.
 */

import { parseMtefToLatex } from './mtefParser'

// ═══════════════════════════════════════════════════════════════════════════
// WMF CONSTANTS & GDI RECORD FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════
const WMF_RECORD = {
  EOF: 0x0000,
  SAVEDC: 0x001e,
  SETBKCOLOR: 0x0201,
  SETBKMODE: 0x0102,
  SETMAPMODE: 0x0103,
  SETROP2: 0x0104,
  SETRELABS: 0x0105,
  SETPOLYFILLMODE: 0x0106,
  SETTEXTCOLOR: 0x0209,
  SETWINDOWORG: 0x020b,
  SETWINDOWEXT: 0x020c,
  SETVIEWPORTORG: 0x020d,
  SETVIEWPORTEXT: 0x020e,
  OFFSETWINDOWORG: 0x020f,
  SCALEWINDOWEXT: 0x0410,
  OFFSETVIEWPORTORG: 0x0211,
  SCALEVIEWPORTEXT: 0x0412,
  LINETO: 0x0213,
  MOVETO: 0x0214,
  EXCLUDECLIPRECT: 0x0415,
  INTERSECTCLIPRECT: 0x0416,
  ARC: 0x0817,
  ELLIPSE: 0x0418,
  FLOODFILL: 0x0419,
  PIE: 0x081a,
  RECTANGLE: 0x041b,
  ROUNDRECT: 0x061c,
  PATBLT: 0x061d,
  RESTOREDC: 0x0127,
  SELECTOBJECT: 0x012d,
  SETTEXTALIGN: 0x012e,
  POLYPOLYGON: 0x0538,
  CREATEPENINDIRECT: 0x02fa,
  CREATEFONTINDIRECT: 0x02fb,
  CREATEBRUSHINDIRECT: 0x02fc,
  DELETEOBJECT: 0x01f0,
  BITBLT: 0x0922,
  STRETCHBLT: 0x0b23,
  POLYGON: 0x0324,
  POLYLINE: 0x0325,
  ESCAPE: 0x0626,
  TEXTOUT: 0x0521,
  EXTTEXTOUT: 0x0a32,
  DIBBITBLT: 0x0940,
  DIBSTRETCHBLT: 0x0b41,
  STRETCHDIB: 0x0f43,
}

// ═══════════════════════════════════════════════════════════════════════════
// EMF CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════
const EMF_RECORD = {
  HEADER: 1,
  POLYBEZIER: 2,
  POLYGON: 3,
  POLYLINE: 4,
  POLYBEZIERTO: 5,
  POLYLINETO: 6,
  POLYPOLYLINE: 7,
  POLYPOLYGON: 8,
  SETWINDOWEXTEX: 9,
  SETWINDOWORGEX: 10,
  SETVIEWPORTEXTEX: 11,
  SETVIEWPORTORGEX: 12,
  EOF: 14,
  SETPIXELV: 15,
  SETMAPMODE: 17,
  SETBKMODE: 18,
  SETPOLYFILLMODE: 19,
  SETROP2: 20,
  SETTEXTCOLOR: 24,
  SETBKCOLOR: 25,
  OFFSETCLIPRGN: 26,
  MOVETOEX: 27,
  SAVEDC: 33,
  RESTOREDC: 34,
  SETWORLDTRANSFORM: 35,
  MODIFYWORLDTRANSFORM: 36,
  SELECTOBJECT: 37,
  CREATEPEN: 38,
  CREATEBRUSHINDIRECT: 39,
  DELETEOBJECT: 40,
  ELLIPSE: 42,
  RECTANGLE: 43,
  ROUNDRECT: 44,
  ARC: 45,
  CHORD: 46,
  PIE: 47,
  LINETO: 54,
  POLYBEZIER16: 85,
  POLYGON16: 86,
  POLYLINE16: 87,
  POLYBEZIERTO16: 88,
  POLYLINETO16: 89,
  POLYPOLYLINE16: 90,
  POLYPOLYGON16: 91,
  EXTCREATEFONTINDIRECTW: 82,
  EXTTEXTOUTA: 83,
  EXTTEXTOUTW: 84,
  BITBLT: 76,
  STRETCHBLT: 77,
  STRETCHDIBITS: 81,
}

// Math/Symbol font character map to Unicode
const SYMBOL_CHAR_MAP: Record<number, string> = {
  0x20: ' ',
  0x21: '!',
  0x22: '∀',
  0x23: '#',
  0x24: '∃',
  0x25: '%',
  0x26: '&',
  0x27: '∍',
  0x28: '(',
  0x29: ')',
  0x2a: '∗',
  0x2b: '+',
  0x2c: ',',
  0x2d: '−',
  0x2e: '.',
  0x2f: '/',
  0x3a: ':',
  0x3b: ';',
  0x3c: '<',
  0x3d: '=',
  0x3e: '>',
  0x3f: '?',
  0x40: '≅',
  0x41: 'Α',
  0x42: 'Β',
  0x43: 'Χ',
  0x44: 'Δ',
  0x45: 'Ε',
  0x46: 'Φ',
  0x47: 'Γ',
  0x48: 'Η',
  0x49: 'Ι',
  0x4a: 'ϑ',
  0x4b: 'Κ',
  0x4c: 'Λ',
  0x4d: 'Μ',
  0x4e: 'Ν',
  0x4f: 'Ο',
  0x50: 'Π',
  0x51: 'Θ',
  0x52: 'Ρ',
  0x53: 'Σ',
  0x54: 'Τ',
  0x55: 'Υ',
  0x56: 'ς',
  0x57: 'Ω',
  0x58: 'Ξ',
  0x59: 'Ψ',
  0x5a: 'Ζ',
  0x5b: '[',
  0x5c: '∴',
  0x5d: ']',
  0x5e: '⊥',
  0x5f: '_',
  0x60: '‾',
  0x61: 'α',
  0x62: 'β',
  0x63: 'χ',
  0x64: 'δ',
  0x65: 'ε',
  0x66: 'φ',
  0x67: 'γ',
  0x68: 'η',
  0x69: 'ι',
  0x6a: 'ϕ',
  0x6b: 'κ',
  0x6c: 'λ',
  0x6d: 'μ',
  0x6e: 'ν',
  0x6f: 'ο',
  0x70: 'π',
  0x71: 'θ',
  0x72: 'ρ',
  0x73: 'σ',
  0x74: 'τ',
  0x75: 'υ',
  0x76: 'ϖ',
  0x77: 'ω',
  0x78: 'ξ',
  0x79: 'ψ',
  0x7a: 'ζ',
  0x7b: '{',
  0x7c: '|',
  0x7d: '}',
  0x7e: '~',
  0xb1: '±',
  0xb2: '≤',
  0xb3: '≥',
  0xb4: '×',
  0xb5: '∝',
  0xb6: '∂',
  0xb7: '•',
  0xb8: '÷',
  0xb9: '≠',
  0xba: '≡',
  0xbb: '≈',
  0xbc: '…',
  0xbd: '│',
  0xbe: '─',
  0xbf: '↵',
  0xc0: 'ℵ',
  0xc1: 'ℑ',
  0xc2: 'ℜ',
  0xc3: '℘',
  0xc4: '⊗',
  0xc5: '⊕',
  0xc6: '∅',
  0xc7: '∩',
  0xc8: '∪',
  0xc9: '⊃',
  0xca: '⊇',
  0xcb: '⊄',
  0xcc: '⊂',
  0xcd: '⊆',
  0xce: '∈',
  0xcf: '∉',
  0xd0: '∠',
  0xd1: '∇',
  0xd5: '∏',
  0xd6: '√',
  0xd7: '⋅',
  0xd8: '¬',
  0xd9: '∧',
  0xda: '∨',
  0xdb: '⇔',
  0xdc: '⇐',
  0xdd: '⇑',
  0xde: '⇒',
  0xdf: '⇓',
  0xe0: '◇',
  0xe1: '⟨',
  0xe5: '∑',
  0xe6: '(',
  0xe7: '│',
  0xe8: '[',
  0xe9: '{',
  0xea: '⌊',
  0xeb: '⌈',
  0xf1: '⟩',
  0xf2: '∫',
  0xf3: '⌠',
  0xf6: ')',
  0xf7: '│',
  0xf8: ']',
  0xf9: '}',
  0xfa: '⌋',
  0xfb: '⌉',
}

export function isWmf(buf: Buffer): boolean {
  if (!buf || buf.length < 22) return false
  // Aldus placeable header key 0x9AC6CDD7 (little endian: D7 CD C6 9A)
  if (buf[0] === 0xd7 && buf[1] === 0xcd && buf[2] === 0xc6 && buf[3] === 0x9a) return true
  // Standard WMF header: FileType 1 or 2, HeaderSize = 9 (0x0009)
  if (buf.length >= 18 && (buf[0] === 1 || buf[0] === 2) && buf[1] === 0 && buf[2] === 9 && buf[3] === 0) {
    return true
  }
  return false
}

export function isEmf(buf: Buffer): boolean {
  if (!buf || buf.length < 44) return false
  // RecordType == 1 (EMR_HEADER) and dSignature == 0x464D4520 (' EMF') at offset 40
  const type = buf.readUInt32LE(0)
  if (type === 1 && buf.length >= 44) {
    const sig = buf.readUInt32LE(40)
    if (sig === 0x464d4520) return true
  }
  return false
}

export function isWmfOrEmf(buf: Buffer): boolean {
  return isWmf(buf) || isEmf(buf)
}

function colorRefToRgb(colorRef: number): string {
  const r = colorRef & 0xff
  const g = (colorRef >> 8) & 0xff
  const b = (colorRef >> 16) & 0xff
  return `rgb(${r},${g},${b})`
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function decodeGdiString(buf: Buffer, offset: number, count: number, fontName: string): string {
  const isSymbol = /symbol|mt extra|euclid|wingdings/i.test(fontName)
  let out = ''
  for (let i = 0; i < count; i++) {
    const code = buf[offset + i]
    if (isSymbol && SYMBOL_CHAR_MAP[code]) {
      out += SYMBOL_CHAR_MAP[code]
    } else if (code >= 32 && code <= 126) {
      out += String.fromCharCode(code)
    } else if (SYMBOL_CHAR_MAP[code]) {
      out += SYMBOL_CHAR_MAP[code]
    } else if (code > 127) {
      out += String.fromCharCode(code)
    }
  }
  return out
}

// ═══════════════════════════════════════════════════════════════════════════
// WMF TO SVG CONVERTER
// ═══════════════════════════════════════════════════════════════════════════
export function convertWmfToSvg(buf: Buffer): string | null {
  try {
    let offset = 0
    let width = 0
    let height = 0
    let minX = 0
    let minY = 0
    let inch = 1440

    // Check for Aldus Placeable Header
    if (buf.readUInt32LE(0) === 0x9ac6cdd7) {
      minX = buf.readInt16LE(6)
      minY = buf.readInt16LE(8)
      const maxX = buf.readInt16LE(10)
      const maxY = buf.readInt16LE(12)
      inch = buf.readUInt16LE(14) || 1440
      width = maxX - minX
      height = maxY - minY
      offset = 22
    }

    if (offset + 18 > buf.length) return null

    // Standard WMF Header
    const fileType = buf.readUInt16LE(offset)
    const headerSize = buf.readUInt16LE(offset + 2)
    offset += headerSize * 2

    let windowOrgX = 0
    let windowOrgY = 0
    let windowExtX = width || 300
    let windowExtY = height || 150

    let curX = 0
    let curY = 0
    let curPenColor = '#000000'
    let curPenWidth = 1.5
    let curPenStyle = 0 // 0 = solid, 5 = null
    let curBrushColor = '#000000'
    let curBrushStyle = 0 // 0 = solid, 1 = transparent
    let curTextColor = '#000000'
    let curFont = { height: 16, name: 'Times New Roman', weight: 400, italic: false }

    const objects: any[] = []
    const elements: string[] = []

    // Dynamic bounding box tracking
    let bMinX = Infinity
    let bMinY = Infinity
    let bMaxX = -Infinity
    let bMaxY = -Infinity

    const trackPoint = (x: number, y: number) => {
      if (Number.isNaN(x) || Number.isNaN(y)) return
      if (x < bMinX) bMinX = x
      if (y < bMinY) bMinY = y
      if (x > bMaxX) bMaxX = x
      if (y > bMaxY) bMaxY = y
    }

    while (offset + 6 <= buf.length) {
      const sizeWords = buf.readUInt32LE(offset)
      const func = buf.readUInt16LE(offset + 4)
      const recParamsOffset = offset + 6
      const recSize = sizeWords * 2
      if (recSize <= 0) break

      switch (func) {
        case WMF_RECORD.EOF:
          offset = buf.length
          break

        case WMF_RECORD.SETWINDOWORG:
          windowOrgY = buf.readInt16LE(recParamsOffset)
          windowOrgX = buf.readInt16LE(recParamsOffset + 2)
          break

        case WMF_RECORD.SETWINDOWEXT:
          windowExtY = Math.abs(buf.readInt16LE(recParamsOffset))
          windowExtX = Math.abs(buf.readInt16LE(recParamsOffset + 2))
          break

        case WMF_RECORD.SETTEXTCOLOR:
          curTextColor = colorRefToRgb(buf.readUInt32LE(recParamsOffset))
          break

        case WMF_RECORD.MOVETO:
          curY = buf.readInt16LE(recParamsOffset)
          curX = buf.readInt16LE(recParamsOffset + 2)
          trackPoint(curX, curY)
          break

        case WMF_RECORD.LINETO: {
          const y = buf.readInt16LE(recParamsOffset)
          const x = buf.readInt16LE(recParamsOffset + 2)
          trackPoint(x, y)
          elements.push(
            `<line x1="${curX}" y1="${curY}" x2="${x}" y2="${y}" stroke="${curPenColor || '#000000'}" stroke-width="${curPenWidth || 1.5}" stroke-linecap="round"/>`
          )
          curX = x
          curY = y
          break
        }

        case WMF_RECORD.PATBLT: {
          // Fraction bars and radical overbars in MathType are drawn with PATBLT
          const h = buf.readInt16LE(recParamsOffset + 4)
          const w = buf.readInt16LE(recParamsOffset + 6)
          const y = buf.readInt16LE(recParamsOffset + 8)
          const x = buf.readInt16LE(recParamsOffset + 10)
          const absW = Math.max(1, Math.abs(w))
          const absH = Math.max(1, Math.abs(h))
          const minPX = Math.min(x, x + w)
          const minPY = Math.min(y, y + h)
          trackPoint(minPX, minPY)
          trackPoint(minPX + absW, minPY + absH)
          elements.push(
            `<rect x="${minPX}" y="${minPY}" width="${absW}" height="${absH}" fill="${curBrushColor || '#000000'}" stroke="none"/>`
          )
          break
        }

        case WMF_RECORD.POLYPOLYGON: {
          const numPolys = buf.readInt16LE(recParamsOffset)
          let ptOffset = recParamsOffset + 2 + numPolys * 2
          for (let p = 0; p < numPolys; p++) {
            const numPts = buf.readInt16LE(recParamsOffset + 2 + p * 2)
            const pts: string[] = []
            for (let pt = 0; pt < numPts; pt++) {
              if (ptOffset + 4 <= offset + recSize) {
                const px = buf.readInt16LE(ptOffset)
                const py = buf.readInt16LE(ptOffset + 2)
                pts.push(`${px},${py}`)
                trackPoint(px, py)
                ptOffset += 4
              }
            }
            if (pts.length > 0) {
              elements.push(
                `<polygon points="${pts.join(' ')}" fill="${curBrushColor || '#000000'}" stroke="${curPenColor || '#000000'}" stroke-width="${curPenWidth || 1}"/>`
              )
            }
          }
          break
        }

        case WMF_RECORD.POLYLINE: {
          const count = buf.readInt16LE(recParamsOffset)
          const pts: string[] = []
          for (let i = 0; i < count; i++) {
            const px = buf.readInt16LE(recParamsOffset + 2 + i * 4)
            const py = buf.readInt16LE(recParamsOffset + 4 + i * 4)
            pts.push(`${px},${py}`)
            trackPoint(px, py)
          }
          if (pts.length > 0) {
            elements.push(
              `<polyline points="${pts.join(' ')}" fill="none" stroke="${curPenColor || '#000000'}" stroke-width="${curPenWidth || 1.5}" stroke-linecap="round" stroke-linejoin="round"/>`
            )
          }
          break
        }

        case WMF_RECORD.POLYGON: {
          const count = buf.readInt16LE(recParamsOffset)
          const pts: string[] = []
          for (let i = 0; i < count; i++) {
            const px = buf.readInt16LE(recParamsOffset + 2 + i * 4)
            const py = buf.readInt16LE(recParamsOffset + 4 + i * 4)
            pts.push(`${px},${py}`)
            trackPoint(px, py)
          }
          if (pts.length > 0) {
            const fill = curBrushStyle === 1 ? 'none' : (curBrushColor || '#000000')
            const stroke = curPenStyle === 5 ? 'none' : (curPenColor || '#000000')
            elements.push(
              `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${curPenWidth || 1}"/>`
            )
          }
          break
        }

        case WMF_RECORD.RECTANGLE: {
          const b = buf.readInt16LE(recParamsOffset)
          const r = buf.readInt16LE(recParamsOffset + 2)
          const t = buf.readInt16LE(recParamsOffset + 4)
          const l = buf.readInt16LE(recParamsOffset + 6)
          trackPoint(l, t)
          trackPoint(r, b)
          const fill = curBrushStyle === 1 ? 'none' : curBrushColor
          const stroke = curPenStyle === 5 ? 'none' : curPenColor
          elements.push(
            `<rect x="${Math.min(l, r)}" y="${Math.min(t, b)}" width="${Math.abs(r - l)}" height="${Math.abs(b - t)}" fill="${fill}" stroke="${stroke}" stroke-width="${curPenWidth || 1}"/>`
          )
          break
        }

        case WMF_RECORD.ELLIPSE: {
          const b = buf.readInt16LE(recParamsOffset)
          const r = buf.readInt16LE(recParamsOffset + 2)
          const t = buf.readInt16LE(recParamsOffset + 4)
          const l = buf.readInt16LE(recParamsOffset + 6)
          trackPoint(l, t)
          trackPoint(r, b)
          const cx = (l + r) / 2
          const cy = (t + b) / 2
          const rx = Math.abs(r - l) / 2
          const ry = Math.abs(b - t) / 2
          const fill = curBrushStyle === 1 ? 'none' : curBrushColor
          const stroke = curPenStyle === 5 ? 'none' : curPenColor
          elements.push(
            `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${curPenWidth || 1}"/>`
          )
          break
        }

        case WMF_RECORD.TEXTOUT: {
          const count = buf.readInt16LE(recParamsOffset)
          const decoded = decodeGdiString(buf, recParamsOffset + 2, count, curFont.name)
          const textEnd = recParamsOffset + 2 + count + (count % 2)
          const y = buf.readInt16LE(textEnd)
          const x = buf.readInt16LE(textEnd + 2)
          const fontSize = Math.abs(curFont.height) || 16
          trackPoint(x, y - fontSize)
          trackPoint(x + count * fontSize * 0.7, y + fontSize * 0.3)
          elements.push(
            `<text x="${x}" y="${y}" fill="${curTextColor || '#000000'}" font-family="'Cambria Math', 'STIX Two Math', 'Times New Roman', serif" font-size="${fontSize}" ${curFont.italic ? 'font-style="italic"' : ''} ${curFont.weight >= 700 ? 'font-weight="bold"' : ''}>${escapeXml(decoded)}</text>`
          )
          break
        }

        case WMF_RECORD.EXTTEXTOUT: {
          const y = buf.readInt16LE(recParamsOffset)
          const x = buf.readInt16LE(recParamsOffset + 2)
          const count = buf.readInt16LE(recParamsOffset + 4)
          const options = buf.readUInt16LE(recParamsOffset + 6)
          let strOffset = recParamsOffset + 8
          if (options & 0x0006) strOffset += 8 // skip rectangle if present
          const decoded = decodeGdiString(buf, strOffset, count, curFont.name)
          const fontSize = Math.abs(curFont.height) || 16
          trackPoint(x, y - fontSize)
          trackPoint(x + count * fontSize * 0.7, y + fontSize * 0.3)
          elements.push(
            `<text x="${x}" y="${y}" fill="${curTextColor || '#000000'}" font-family="'Cambria Math', 'STIX Two Math', 'Times New Roman', serif" font-size="${fontSize}" ${curFont.italic ? 'font-style="italic"' : ''} ${curFont.weight >= 700 ? 'font-weight="bold"' : ''}>${escapeXml(decoded)}</text>`
          )
          break
        }

        case WMF_RECORD.CREATEPENINDIRECT: {
          const style = buf.readUInt16LE(recParamsOffset)
          const penW = buf.readInt16LE(recParamsOffset + 2)
          const color = colorRefToRgb(buf.readUInt32LE(recParamsOffset + 6))
          objects.push({ type: 'pen', style, width: Math.max(1.5, penW), color })
          break
        }

        case WMF_RECORD.CREATEBRUSHINDIRECT: {
          const style = buf.readUInt16LE(recParamsOffset)
          const color = colorRefToRgb(buf.readUInt32LE(recParamsOffset + 2))
          objects.push({ type: 'brush', style, color })
          break
        }

        case WMF_RECORD.CREATEFONTINDIRECT: {
          const fH = buf.readInt16LE(recParamsOffset)
          const weight = buf.readUInt16LE(recParamsOffset + 8)
          const italic = buf[recParamsOffset + 10] !== 0
          let fName = ''
          for (let i = 0; i < 32; i++) {
            const ch = buf[recParamsOffset + 14 + i]
            if (ch === 0) break
            fName += String.fromCharCode(ch)
          }
          objects.push({ type: 'font', height: fH, weight, italic, name: fName || 'Times New Roman' })
          break
        }

        case WMF_RECORD.SELECTOBJECT: {
          const objIdx = buf.readUInt16LE(recParamsOffset)
          const obj = objects[objIdx]
          if (obj) {
            if (obj.type === 'pen') {
              curPenColor = obj.color
              curPenWidth = obj.width
              curPenStyle = obj.style
            } else if (obj.type === 'brush') {
              curBrushColor = obj.color
              curBrushStyle = obj.style
            } else if (obj.type === 'font') {
              curFont = obj
            }
          }
          break
        }

        case WMF_RECORD.DELETEOBJECT: {
          const objIdx = buf.readUInt16LE(recParamsOffset)
          if (objects[objIdx]) objects[objIdx] = null
          break
        }

        case WMF_RECORD.STRETCHDIB:
        case WMF_RECORD.DIBSTRETCHBLT:
        case WMF_RECORD.DIBBITBLT: {
          try {
            const dibOffset = recParamsOffset + (func === WMF_RECORD.STRETCHDIB ? 22 : 18)
            if (dibOffset < offset + recSize) {
              const dibBuf = buf.subarray(dibOffset, offset + recSize)
              if (dibBuf.length > 40) {
                const dibHeaderSize = dibBuf.readUInt32LE(0)
                if (dibHeaderSize === 40 || dibHeaderSize === 108 || dibHeaderSize === 124) {
                  const bmpWidth = dibBuf.readInt32LE(4)
                  const bmpHeight = Math.abs(dibBuf.readInt32LE(8))
                  trackPoint(0, 0)
                  trackPoint(bmpWidth, bmpHeight)
                  const bmpFileHeader = Buffer.alloc(14)
                  bmpFileHeader.write('BM', 0)
                  const totalFileSize = 14 + dibBuf.length
                  bmpFileHeader.writeUInt32LE(totalFileSize, 2)
                  const bpp = dibBuf.readUInt16LE(14)
                  let paletteSize = 0
                  if (bpp <= 8) {
                    const colorsUsed = dibBuf.readUInt32LE(32)
                    paletteSize = (colorsUsed || 1 << bpp) * 4
                  }
                  const dataOffset = 14 + dibHeaderSize + paletteSize
                  bmpFileHeader.writeUInt32LE(dataOffset, 10)
                  const fullBmp = Buffer.concat([bmpFileHeader, dibBuf])
                  const base64Bmp = fullBmp.toString('base64')
                  elements.push(
                    `<image href="data:image/bmp;base64,${base64Bmp}" x="0" y="0" width="${bmpWidth || windowExtX}" height="${bmpHeight || windowExtY}"/>`
                  )
                }
              }
            }
          } catch {}
          break
        }
      }

      offset += recSize
    }

    let vMinX = minX || windowOrgX || 0
    let vMinY = minY || windowOrgY || 0
    let viewBoxW = Math.max(50, windowExtX || width || 300)
    let viewBoxH = Math.max(20, windowExtY || height || 100)

    if (bMinX !== Infinity && bMaxX !== -Infinity && (bMaxX > bMinX)) {
      const padX = 10
      const padY = 10
      vMinX = bMinX - padX
      vMinY = bMinY - padY
      viewBoxW = Math.max(40, bMaxX - bMinX + padX * 2)
      viewBoxH = Math.max(20, bMaxY - bMinY + padY * 2)
    }

    // Scale twips to natural pixel display dimensions (1440 twips = 1 inch = 96px)
    const dpiScale = (inch && inch > 100) ? (96 / inch) : (viewBoxW > 500 ? (96 / 1440) : 1)
    const dispW = Math.round(viewBoxW * dpiScale * 1.25)
    const dispH = Math.round(viewBoxH * dpiScale * 1.25)

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vMinX} ${vMinY} ${viewBoxW} ${viewBoxH}" width="${dispW}" height="${dispH}" style="max-height:80px;max-width:100%;height:auto;width:auto;display:inline-block;vertical-align:middle;background:transparent;color:#000000;">
${elements.join('\n')}
</svg>`
  } catch (err) {
    console.error('[wmfToSvg] Error converting WMF:', err)
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EMF TO SVG CONVERTER
// ═══════════════════════════════════════════════════════════════════════════
export function convertEmfToSvg(buf: Buffer): string | null {
  try {
    if (buf.length < 88) return null
    let offset = 0

    const headerType = buf.readUInt32LE(0)
    const headerSize = buf.readUInt32LE(4)
    if (headerType !== EMF_RECORD.HEADER) return null

    const boundsLeft = buf.readInt32LE(8)
    const boundsTop = buf.readInt32LE(12)
    const boundsRight = buf.readInt32LE(16)
    const boundsBottom = buf.readInt32LE(20)

    const frameLeft = buf.readInt32LE(24)
    const frameTop = buf.readInt32LE(28)
    const frameRight = buf.readInt32LE(32)
    const frameBottom = buf.readInt32LE(36)

    const width = Math.max(1, boundsRight - boundsLeft || Math.round((frameRight - frameLeft) / 25.4) || 300)
    const height = Math.max(1, boundsBottom - boundsTop || Math.round((frameBottom - frameTop) / 25.4) || 150)

    offset = headerSize

    let curX = 0
    let curY = 0
    let curPenColor = '#000000'
    let curPenWidth = 1.5
    let curBrushColor = '#000000'
    let curBrushStyle = 0 // 0 = solid, 1 = transparent
    let curTextColor = '#000000'
    let curFont = { height: 16, name: 'Times New Roman', weight: 400, italic: false }

    const objects: any[] = []
    const elements: string[] = []

    while (offset + 8 <= buf.length) {
      const type = buf.readUInt32LE(offset)
      const size = buf.readUInt32LE(offset + 4)
      if (size <= 0) break

      const recParamsOffset = offset + 8

      switch (type) {
        case EMF_RECORD.EOF:
          offset = buf.length
          break

        case EMF_RECORD.SETTEXTCOLOR:
          curTextColor = colorRefToRgb(buf.readUInt32LE(recParamsOffset))
          break

        case EMF_RECORD.MOVETOEX:
          curX = buf.readInt32LE(recParamsOffset)
          curY = buf.readInt32LE(recParamsOffset + 4)
          break

        case EMF_RECORD.LINETO: {
          const x = buf.readInt32LE(recParamsOffset)
          const y = buf.readInt32LE(recParamsOffset + 4)
          elements.push(
            `<line x1="${curX}" y1="${curY}" x2="${x}" y2="${y}" stroke="${curPenColor || '#000000'}" stroke-width="${curPenWidth || 1.5}" stroke-linecap="round"/>`
          )
          curX = x
          curY = y
          break
        }

        case EMF_RECORD.POLYLINE:
        case EMF_RECORD.POLYLINE16: {
          const is16 = type === EMF_RECORD.POLYLINE16
          const count = buf.readUInt32LE(recParamsOffset + 16)
          const ptsOffset = recParamsOffset + 20
          const pts: string[] = []
          for (let i = 0; i < count; i++) {
            const px = is16 ? buf.readInt16LE(ptsOffset + i * 4) : buf.readInt32LE(ptsOffset + i * 8)
            const py = is16 ? buf.readInt16LE(ptsOffset + i * 4 + 2) : buf.readInt32LE(ptsOffset + i * 8 + 4)
            pts.push(`${px},${py}`)
          }
          if (pts.length > 0) {
            elements.push(
              `<polyline points="${pts.join(' ')}" fill="none" stroke="${curPenColor || '#000000'}" stroke-width="${curPenWidth || 1.5}" stroke-linecap="round" stroke-linejoin="round"/>`
            )
          }
          break
        }

        case EMF_RECORD.POLYGON:
        case EMF_RECORD.POLYGON16: {
          const is16 = type === EMF_RECORD.POLYGON16
          const count = buf.readUInt32LE(recParamsOffset + 16)
          const ptsOffset = recParamsOffset + 20
          const pts: string[] = []
          for (let i = 0; i < count; i++) {
            const px = is16 ? buf.readInt16LE(ptsOffset + i * 4) : buf.readInt32LE(ptsOffset + i * 8)
            const py = is16 ? buf.readInt16LE(ptsOffset + i * 4 + 2) : buf.readInt32LE(ptsOffset + i * 8 + 4)
            pts.push(`${px},${py}`)
          }
          if (pts.length > 0) {
            const fill = curBrushStyle === 1 ? 'none' : (curBrushColor || '#000000')
            elements.push(
              `<polygon points="${pts.join(' ')}" fill="${fill}" stroke="${curPenColor || '#000000'}" stroke-width="${curPenWidth || 1}"/>`
            )
          }
          break
        }

        case EMF_RECORD.RECTANGLE: {
          const l = buf.readInt32LE(recParamsOffset)
          const t = buf.readInt32LE(recParamsOffset + 4)
          const r = buf.readInt32LE(recParamsOffset + 8)
          const b = buf.readInt32LE(recParamsOffset + 12)
          const fill = curBrushStyle === 1 ? 'none' : curBrushColor
          elements.push(
            `<rect x="${Math.min(l, r)}" y="${Math.min(t, b)}" width="${Math.abs(r - l)}" height="${Math.abs(b - t)}" fill="${fill}" stroke="${curPenColor || '#000000'}" stroke-width="${curPenWidth || 1}"/>`
          )
          break
        }

        case EMF_RECORD.ELLIPSE: {
          const l = buf.readInt32LE(recParamsOffset)
          const t = buf.readInt32LE(recParamsOffset + 4)
          const r = buf.readInt32LE(recParamsOffset + 8)
          const b = buf.readInt32LE(recParamsOffset + 12)
          const cx = (l + r) / 2
          const cy = (t + b) / 2
          const rx = Math.abs(r - l) / 2
          const ry = Math.abs(b - t) / 2
          const fill = curBrushStyle === 1 ? 'none' : curBrushColor
          elements.push(
            `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${curPenColor || '#000000'}" stroke-width="${curPenWidth || 1}"/>`
          )
          break
        }

        case EMF_RECORD.EXTTEXTOUTW: {
          const charsCount = buf.readUInt32LE(recParamsOffset + 24)
          const offString = buf.readUInt32LE(recParamsOffset + 28)
          const x = buf.readInt32LE(recParamsOffset + 16)
          const y = buf.readInt32LE(recParamsOffset + 20)
          let str = ''
          const strStart = offset + offString
          for (let i = 0; i < charsCount && strStart + i * 2 + 1 < buf.length; i++) {
            const charCode = buf.readUInt16LE(strStart + i * 2)
            str += String.fromCharCode(charCode)
          }
          const fontSize = Math.abs(curFont.height) || 16
          elements.push(
            `<text x="${x}" y="${y}" fill="${curTextColor || '#000000'}" font-family="'Cambria Math', 'STIX Two Math', 'Times New Roman', serif" font-size="${fontSize}" ${curFont.italic ? 'font-style="italic"' : ''} ${curFont.weight >= 700 ? 'font-weight="bold"' : ''}>${escapeXml(str)}</text>`
          )
          break
        }

        case EMF_RECORD.EXTTEXTOUTA: {
          const charsCount = buf.readUInt32LE(recParamsOffset + 24)
          const offString = buf.readUInt32LE(recParamsOffset + 28)
          const x = buf.readInt32LE(recParamsOffset + 16)
          const y = buf.readInt32LE(recParamsOffset + 20)
          const strStart = offset + offString
          const decoded = decodeGdiString(buf, strStart, charsCount, curFont.name)
          const fontSize = Math.abs(curFont.height) || 16
          elements.push(
            `<text x="${x}" y="${y}" fill="${curTextColor || '#000000'}" font-family="'Cambria Math', 'STIX Two Math', 'Times New Roman', serif" font-size="${fontSize}" ${curFont.italic ? 'font-style="italic"' : ''} ${curFont.weight >= 700 ? 'font-weight="bold"' : ''}>${escapeXml(decoded)}</text>`
          )
          break
        }

        case EMF_RECORD.CREATEPEN: {
          const ihPen = buf.readUInt32LE(recParamsOffset)
          const style = buf.readUInt32LE(recParamsOffset + 4)
          const penW = buf.readUInt32LE(recParamsOffset + 8)
          const color = colorRefToRgb(buf.readUInt32LE(recParamsOffset + 16))
          objects[ihPen] = { type: 'pen', style, width: Math.max(1.5, penW), color }
          break
        }

        case EMF_RECORD.CREATEBRUSHINDIRECT: {
          const ihBrush = buf.readUInt32LE(recParamsOffset)
          const style = buf.readUInt32LE(recParamsOffset + 4)
          const color = colorRefToRgb(buf.readUInt32LE(recParamsOffset + 8))
          objects[ihBrush] = { type: 'brush', style, color }
          break
        }

        case EMF_RECORD.EXTCREATEFONTINDIRECTW: {
          const ihFont = buf.readUInt32LE(recParamsOffset)
          const fH = buf.readInt32LE(recParamsOffset + 4)
          const weight = buf.readUInt32LE(recParamsOffset + 20)
          const italic = buf[recParamsOffset + 24] !== 0
          let fName = ''
          const nameStart = recParamsOffset + 32
          for (let i = 0; i < 32 && nameStart + i * 2 + 1 < buf.length; i++) {
            const cc = buf.readUInt16LE(nameStart + i * 2)
            if (cc === 0) break
            fName += String.fromCharCode(cc)
          }
          objects[ihFont] = { type: 'font', height: fH, weight, italic, name: fName || 'Times New Roman' }
          break
        }

        case EMF_RECORD.SELECTOBJECT: {
          const ihObj = buf.readUInt32LE(recParamsOffset)
          const obj = objects[ihObj]
          if (obj) {
            if (obj.type === 'pen') {
              curPenColor = obj.color
              curPenWidth = obj.width
            } else if (obj.type === 'brush') {
              curBrushColor = obj.color
              curBrushStyle = obj.style
            } else if (obj.type === 'font') {
              curFont = obj
            }
          }
          break
        }

        case EMF_RECORD.DELETEOBJECT: {
          const ihObj = buf.readUInt32LE(recParamsOffset)
          if (objects[ihObj]) objects[ihObj] = null
          break
        }

        case EMF_RECORD.STRETCHDIBITS:
        case EMF_RECORD.BITBLT:
        case EMF_RECORD.STRETCHBLT: {
          try {
            const offBmiSrc = buf.readUInt32LE(recParamsOffset + (type === EMF_RECORD.STRETCHDIBITS ? 40 : 32))
            const cbBmiSrc = buf.readUInt32LE(recParamsOffset + (type === EMF_RECORD.STRETCHDIBITS ? 44 : 36))
            const offBitsSrc = buf.readUInt32LE(recParamsOffset + (type === EMF_RECORD.STRETCHDIBITS ? 48 : 40))
            const cbBitsSrc = buf.readUInt32LE(recParamsOffset + (type === EMF_RECORD.STRETCHDIBITS ? 52 : 44))

            if (offBmiSrc && offBitsSrc && offset + offBmiSrc < buf.length) {
              const bmiBuf = buf.subarray(offset + offBmiSrc, offset + offBmiSrc + cbBmiSrc)
              const bitsBuf = buf.subarray(offset + offBitsSrc, offset + offBitsSrc + cbBitsSrc)
              const dibBuf = Buffer.concat([bmiBuf, bitsBuf])
              const bmpWidth = bmiBuf.readInt32LE(4)
              const bmpHeight = Math.abs(bmiBuf.readInt32LE(8))

              const bmpFileHeader = Buffer.alloc(14)
              bmpFileHeader.write('BM', 0)
              bmpFileHeader.writeUInt32LE(14 + dibBuf.length, 2)
              bmpFileHeader.writeUInt32LE(14 + bmiBuf.length, 10)
              const fullBmp = Buffer.concat([bmpFileHeader, dibBuf])
              const base64Bmp = fullBmp.toString('base64')
              elements.push(
                `<image href="data:image/bmp;base64,${base64Bmp}" x="0" y="0" width="${bmpWidth || width}" height="${bmpHeight || height}"/>`
              )
            }
          } catch {}
          break
        }
      }

      offset += size
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="max-width:100%;height:auto;display:inline-block;vertical-align:middle;background:white;color:#000000;">
${elements.join('\n')}
</svg>`
  } catch (err) {
    console.error('[wmfToSvg] Error converting EMF:', err)
    return null
  }
}

export function convertMetafileToSvg(buf: Buffer): string | null {
  if (!buf || buf.length < 18) return null
  if (isEmf(buf)) {
    const svg = convertEmfToSvg(buf)
    if (svg) return svg
  }
  if (isWmf(buf)) {
    const svg = convertWmfToSvg(buf)
    if (svg) return svg
  }
  return null
}
