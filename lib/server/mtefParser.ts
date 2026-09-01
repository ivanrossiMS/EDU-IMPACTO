/**
 * Pure TypeScript MTEF (MathType Equation Format v2-v5) Binary Parser to LaTeX
 * Decodes equation structures from Microsoft Equation 3.0 / MathType OLE objects and WMF comment streams.
 */

// MTEF Record Types
const MTEF_RECORD = {
  END: 0,
  LINE: 1,
  CHAR: 2,
  TMPL: 3,
  PILE: 4,
  MATRIX: 5,
  EMBED: 6,
  RULER: 7,
  FONT_STYLE_DEF: 8,
  SIZE: 9,
  FULL: 10,
  SUB: 11,
  SUB2: 12,
  SYM: 13,
  SUBSYM: 14,
  COLOR: 15,
  COLOR_DEF: 16,
  FONT_DEF: 17,
  EQN_PREFS: 18,
  ENCODING_DEF: 19,
  FUTURE: 100,
}

// MathType Template Selectors (tag in TMPL record)
const TMPL_TYPE = {
  TM_ANGLE: 0,
  TM_PAREN: 1,      // ( )
  TM_BRACK: 2,      // [ ]
  TM_BRACE: 3,      // { }
  TM_BAR: 5,        // | |
  TM_DBAR: 6,       // || ||
  TM_ROOT: 7,       // sqrt or root[n]
  TM_FRACT: 8,      // fraction (num/den)
  TM_UBAR: 9,       // underline
  TM_OBAR: 10,      // overline
  TM_ARROW: 11,     // vector arrow
  TM_INTEG: 12,     // integral
  TM_SUM: 13,       // sum
  TM_PROD: 14,      // product
  TM_COPROD: 15,
  TM_UNION: 16,
  TM_INTER: 17,
  TM_SUP: 20,       // superscript
  TM_SUB: 21,       // subscript
  TM_SUBSUP: 22,    // sub and sup
  TM_DIRAC: 23,
  TM_VEC: 24,       // vec
  TM_TILDE: 25,
  TM_HAT: 26,
  TM_ARC: 27,
  TM_BOX: 30,
  TM_LIM: 33,       // limit
}

// Common Symbol Font Character Maps to LaTeX
const SYMBOL_MAP: Record<number, string> = {
  0x20: ' ',
  0x21: '!',
  0x22: '\\forall',
  0x23: '\\#',
  0x24: '\\exists',
  0x25: '%',
  0x26: '\\&',
  0x27: '\\ni',
  0x28: '(',
  0x29: ')',
  0x2a: '\\ast',
  0x2b: '+',
  0x2c: ',',
  0x2d: '-',
  0x2e: '.',
  0x2f: '/',
  0x3a: ':',
  0x3b: ';',
  0x3c: '<',
  0x3d: '=',
  0x3e: '>',
  0x3f: '?',
  0x40: '\\cong',
  0x41: 'A',
  0x42: 'B',
  0x43: '\\chi',
  0x44: '\\Delta',
  0x45: 'E',
  0x46: '\\Phi',
  0x47: '\\Gamma',
  0x48: 'H',
  0x49: 'I',
  0x4a: '\\vartheta',
  0x4b: 'K',
  0x4c: '\\Lambda',
  0x4d: 'M',
  0x4e: 'N',
  0x4f: 'O',
  0x50: '\\Pi',
  0x51: '\\Theta',
  0x52: 'P',
  0x53: '\\Sigma',
  0x54: 'T',
  0x55: '\\Upsilon',
  0x56: '\\varsigma',
  0x57: '\\Omega',
  0x58: '\\Xi',
  0x59: '\\Psi',
  0x5a: 'Z',
  0x5b: '[',
  0x5c: '\\therefore',
  0x5d: ']',
  0x5e: '\\perp',
  0x5f: '\\_',
  0x60: '\\overline',
  0x61: '\\alpha',
  0x62: '\\beta',
  0x63: '\\chi',
  0x64: '\\delta',
  0x65: '\\epsilon',
  0x66: '\\phi',
  0x67: '\\gamma',
  0x68: '\\eta',
  0x69: '\\iota',
  0x6a: '\\varphi',
  0x6b: '\\kappa',
  0x6c: '\\lambda',
  0x6d: '\\mu',
  0x6e: '\\nu',
  0x6f: 'o',
  0x70: '\\pi',
  0x71: '\\theta',
  0x72: '\\rho',
  0x73: '\\sigma',
  0x74: '\\tau',
  0x75: '\\upsilon',
  0x76: '\\varpi',
  0x77: '\\omega',
  0x78: '\\xi',
  0x79: '\\psi',
  0x7a: '\\zeta',
  0x7b: '\\{',
  0x7c: '|',
  0x7d: '\\}',
  0x7e: '\\sim',
  0xb1: '\\pm',
  0xb2: '\\le',
  0xb3: '\\ge',
  0xb4: '\\times',
  0xb5: '\\propto',
  0xb6: '\\partial',
  0xb7: '\\bullet',
  0xb8: '\\div',
  0xb9: '\\ne',
  0xba: '\\equiv',
  0xbb: '\\approx',
  0xbc: '\\dots',
  0xbd: '|',
  0xbe: '-',
  0xbf: '\\leftarrow',
  0xc0: '\\aleph',
  0xc1: '\\Im',
  0xc2: '\\Re',
  0xc3: '\\wp',
  0xc4: '\\otimes',
  0xc5: '\\oplus',
  0xc6: '\\emptyset',
  0xc7: '\\cap',
  0xc8: '\\cup',
  0xc9: '\\supset',
  0xca: '\\supseteq',
  0xcb: '\\not\\subset',
  0xcc: '\\subset',
  0xcd: '\\subseteq',
  0xce: '\\in',
  0xcf: '\\notin',
  0xd0: '\\angle',
  0xd1: '\\nabla',
  0xd2: '\\text{®}',
  0xd3: '\\text{©}',
  0xd4: '\\text{™}',
  0xd5: '\\prod',
  0xd6: '\\sqrt',
  0xd7: '\\cdot',
  0xd8: '\\neg',
  0xd9: '\\land',
  0xda: '\\lor',
  0xdb: '\\Leftrightarrow',
  0xdc: '\\Leftarrow',
  0xdd: '\\Uparrow',
  0xde: '\\Rightarrow',
  0xdf: '\\Downarrow',
  0xe0: '\\diamond',
  0xe1: '\\langle',
  0xe2: '®',
  0xe3: '©',
  0xe4: '™',
  0xe5: '\\sum',
  0xe6: '\\left(',
  0xe7: '\\left|',
  0xe8: '\\left[',
  0xe9: '\\left\\{',
  0xea: '\\lfloor',
  0xeb: '\\lceil',
  0xf1: '\\rangle',
  0xf2: '\\int',
  0xf3: '\\int',
  0xf6: '\\right)',
  0xf7: '\\right|',
  0xf8: '\\right]',
  0xf9: '\\right\\}',
  0xfa: '\\rfloor',
  0xfb: '\\rceil',
}

export class MtefDecoder {
  private buf: Buffer
  private pos: number = 0
  private version: number = 0

  constructor(buffer: Buffer) {
    this.buf = buffer
  }

  public toLatex(): string | null {
    try {
      this.findMtefHeader()
      if (this.pos >= this.buf.length) return null

      // Read MTEF header: version, platform, product, product_version, product_subversion
      this.version = this.buf.readUInt8(this.pos++)
      if (this.version < 2 || this.version > 5) return null

      // Skip 4 bytes header info (platform, product, version)
      this.pos += 4

      // Parse root object (usually a LINE or PILE)
      const result = this.parseObject()
      return result ? result.trim() : null
    } catch (e) {
      return null
    }
  }

  private findMtefHeader(): void {
    // Look for MTEF header signature:
    // WMF META_ESCAPE contains 'MathType' or starts after 28-byte OLE stream header
    for (let i = 0; i < this.buf.length - 8; i++) {
      // Direct MTEF header: version 0x03 or 0x05, platform 0x00 or 0x01
      if ((this.buf[i] === 3 || this.buf[i] === 5) && (this.buf[i + 1] === 0 || this.buf[i + 1] === 1)) {
        // Lookahead check if next byte is product code (0 or 1)
        if (this.buf[i + 2] <= 2) {
          this.pos = i
          return
        }
      }
      // 'MathType' comment header
      if (this.buf.toString('ascii', i, i + 8) === 'MathType') {
        this.pos = i + 8
        // Skip possible whitespace or null bytes
        while (this.pos < this.buf.length && (this.buf[this.pos] === 0 || this.buf[this.pos] === 0x0a || this.buf[this.pos] === 0x0d)) {
          this.pos++
        }
        return
      }
    }
    this.pos = this.buf.length
  }

  private parseObject(): string {
    if (this.pos >= this.buf.length) return ''
    const recordType = this.buf.readUInt8(this.pos++)

    switch (recordType) {
      case MTEF_RECORD.END:
        return ''

      case MTEF_RECORD.LINE:
        return this.parseLine()

      case MTEF_RECORD.CHAR:
        return this.parseChar()

      case MTEF_RECORD.TMPL:
        return this.parseTemplate()

      case MTEF_RECORD.PILE:
        return this.parsePile()

      case MTEF_RECORD.MATRIX:
        return this.parseMatrix()

      case MTEF_RECORD.FONT_STYLE_DEF:
      case MTEF_RECORD.FONT_DEF:
      case MTEF_RECORD.SIZE:
      case MTEF_RECORD.FULL:
      case MTEF_RECORD.SUB:
      case MTEF_RECORD.SUB2:
      case MTEF_RECORD.SYM:
      case MTEF_RECORD.SUBSYM:
      case MTEF_RECORD.COLOR:
      case MTEF_RECORD.COLOR_DEF:
      case MTEF_RECORD.EQN_PREFS:
      case MTEF_RECORD.ENCODING_DEF:
        this.skipRecord(recordType)
        return this.parseObject()

      default:
        // Unknown record, try to skip
        return ''
    }
  }

  private parseLine(): string {
    // Line options byte
    if (this.pos < this.buf.length) {
      const options = this.buf.readUInt8(this.pos++)
      // If line has ruler or null, handle
    }

    let out = ''
    while (this.pos < this.buf.length) {
      if (this.buf[this.pos] === MTEF_RECORD.END) {
        this.pos++
        break
      }
      out += this.parseObject()
    }
    return out
  }

  private parseChar(): string {
    if (this.pos >= this.buf.length) return ''
    const options = this.buf.readUInt8(this.pos++)
    let charCode = 0

    if (this.version >= 4) {
      // 16-bit unicode character
      if (this.pos + 1 < this.buf.length) {
        charCode = this.buf.readUInt16LE(this.pos)
        this.pos += 2
      }
    } else {
      // 8-bit character
      charCode = this.buf.readUInt8(this.pos++)
    }

    // Font def index if specified in options (bit 0x01)
    if (options & 0x01) {
      this.pos++ // skip font index
    }

    // Check symbol font or unicode
    if (SYMBOL_MAP[charCode]) {
      return SYMBOL_MAP[charCode]
    }

    if (charCode >= 32 && charCode <= 126) {
      const ch = String.fromCharCode(charCode)
      if (ch === '{') return '\\{'
      if (ch === '}') return '\\}'
      if (ch === '^') return '\\hat{}'
      if (ch === '_') return '\\_'
      return ch
    }

    return String.fromCharCode(charCode)
  }

  private parseTemplate(): string {
    if (this.pos + 2 > this.buf.length) return ''
    const tmplType = this.buf.readUInt8(this.pos++)
    const variation = this.buf.readUInt8(this.pos++)
    const options = this.buf.readUInt8(this.pos++)

    // Read template arguments (sub-lines / slots)
    const args: string[] = []
    while (this.pos < this.buf.length) {
      if (this.buf[this.pos] === MTEF_RECORD.END) {
        this.pos++
        break
      }
      args.push(this.parseObject())
    }

    switch (tmplType) {
      case TMPL_TYPE.TM_PAREN:
        return `\\left( ${args.join('')} \\right)`

      case TMPL_TYPE.TM_BRACK:
        return `\\left[ ${args.join('')} \\right]`

      case TMPL_TYPE.TM_BRACE:
        return `\\left\\{ ${args.join('')} \\right\\}`

      case TMPL_TYPE.TM_BAR:
        return `\\left| ${args.join('')} \\right|`

      case TMPL_TYPE.TM_DBAR:
        return `\\left\\| ${args.join('')} \\right\\|`

      case TMPL_TYPE.TM_FRACT: {
        const num = args[0] || ''
        const den = args[1] || ''
        return `\\frac{${num}}{${den}}`
      }

      case TMPL_TYPE.TM_ROOT: {
        if (args.length >= 2 && args[0]) {
          const deg = args[0]
          const rad = args[1] || ''
          return `\\sqrt[${deg}]{${rad}}`
        }
        return `\\sqrt{${args[0] || ''}}`
      }

      case TMPL_TYPE.TM_SUP:
        return `^{${args.join('')}}`

      case TMPL_TYPE.TM_SUB:
        return `_{${args.join('')}}`

      case TMPL_TYPE.TM_SUBSUP:
        return `_{${args[0] || ''}}^{${args[1] || ''}}`

      case TMPL_TYPE.TM_SUM: {
        const sub = args[0] || ''
        const sup = args[1] || ''
        const body = args[2] || ''
        return `\\sum_{${sub}}^{${sup}} ${body}`
      }

      case TMPL_TYPE.TM_INTEG: {
        const sub = args[0] || ''
        const sup = args[1] || ''
        const body = args[2] || ''
        return `\\int_{${sub}}^{${sup}} ${body}`
      }

      case TMPL_TYPE.TM_PROD: {
        const sub = args[0] || ''
        const sup = args[1] || ''
        return `\\prod_{${sub}}^{${sup}}`
      }

      case TMPL_TYPE.TM_LIM: {
        const under = args[0] || ''
        const body = args[1] || ''
        return `\\lim_{${under}} ${body}`
      }

      case TMPL_TYPE.TM_ARROW:
      case TMPL_TYPE.TM_VEC:
        return `\\vec{${args.join('')}}`

      case TMPL_TYPE.TM_OBAR:
        return `\\overline{${args.join('')}}`

      case TMPL_TYPE.TM_UBAR:
        return `\\underline{${args.join('')}}`

      case TMPL_TYPE.TM_HAT:
        return `\\hat{${args.join('')}}`

      case TMPL_TYPE.TM_TILDE:
        return `\\tilde{${args.join('')}}`

      case TMPL_TYPE.TM_BOX:
        return `\\boxed{${args.join('')}}`

      default:
        return args.join('')
    }
  }

  private parsePile(): string {
    // Pile options
    if (this.pos < this.buf.length) this.pos++
    const lines: string[] = []
    while (this.pos < this.buf.length) {
      if (this.buf[this.pos] === MTEF_RECORD.END) {
        this.pos++
        break
      }
      lines.push(this.parseObject())
    }
    return lines.join(' \\\\ ')
  }

  private parseMatrix(): string {
    if (this.pos + 4 > this.buf.length) return ''
    const rows = this.buf.readUInt8(this.pos++)
    const cols = this.buf.readUInt8(this.pos++)
    this.pos += 2 // skip matrix options

    const cells: string[] = []
    while (this.pos < this.buf.length) {
      if (this.buf[this.pos] === MTEF_RECORD.END) {
        this.pos++
        break
      }
      cells.push(this.parseObject())
    }

    const rowStrings: string[] = []
    for (let r = 0; r < rows; r++) {
      const rowCells: string[] = []
      for (let c = 0; c < cols; c++) {
        rowCells.push(cells[r * cols + c] || '')
      }
      rowStrings.push(rowCells.join(' & '))
    }

    return `\\begin{matrix} ${rowStrings.join(' \\\\ ')} \\end{matrix}`
  }

  private skipRecord(type: number): void {
    if (this.pos >= this.buf.length) return
    // Skip string or fixed size depending on type
    if (type === MTEF_RECORD.FONT_DEF || type === MTEF_RECORD.FONT_STYLE_DEF) {
      // Null-terminated font name
      while (this.pos < this.buf.length && this.buf[this.pos] !== 0) {
        this.pos++
      }
      if (this.pos < this.buf.length) this.pos++ // skip null
    } else {
      // Skip 1-4 bytes
      this.pos++
    }
  }
}

/**
 * Parses raw buffer (from .bin OLE stream or WMF comment) into LaTeX
 */
export function parseMtefToLatex(buf: Buffer): string | null {
  if (!buf || buf.length < 5) return null
  const decoder = new MtefDecoder(buf)
  return decoder.toLatex()
}
