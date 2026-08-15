/**
 * app/agenda-digital/components/declaracaoPdfGenerator.ts
 *
 * Gerador de PDF vetorial nativo em alta resolução para a Declaração de IRPF /
 * Quitação Anual de Mensalidades do Colégio Impacto.
 *
 * Utiliza pdf-lib para gerar um documento A4 de padrão institucional oficial,
 * totalmente compatível com navegadores móveis (iOS Safari, Android Chrome),
 * WebViews (Capacitor/Cordova) e Desktop.
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'

export interface DeclaracaoIrpfData {
  escola: {
    razaoSocial: string
    nomeFantasia: string
    cnpj: string
    endereco: string
    cidadeUf: string
    cep: string
    telefone: string
    email: string
    site: string
    segmento: string
  }
  responsavel: {
    nome: string
    cpf: string
    email: string
    telefone: string
  }
  aluno: {
    id: string
    nome: string
    cpf: string
    matricula: string
    turma: string
    segmento: string
  }
  anoCalendario: string
  exercicio: string
  mensalidades: Array<{
    index: number
    id: string
    descricao: string
    competencia: string
    vencimento: string
    dataPagamento: string
    valorBase: string
    valorPago: string
    valorNumerico: number
    tipo: string
    alunoNome: string
  }>
  quantidadeMensalidades: number
  totalPago: number
  totalPagoFormatado: string
  totalPagoPorExtenso: string
  codigoAutenticidade: string
  dataEmissao: string
  dataEmissaoExtenso: string
  cidadeDataEmissao: string
}

/**
 * Remove ou substitui caracteres fora da codificação WinAnsi do Helvetica
 */
function sanitize(text?: string | null): string {
  if (!text) return ''
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/•/g, '-')
    .replace(/—|–/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
}

/**
 * Utilitário para quebra de linha de textos longos mantendo largura máxima
 */
function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const words = sanitize(text).split(/\s+/)
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (!word) continue
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const width = font.widthOfTextAtSize(testLine, fontSize)
    if (width <= maxWidth) {
      currentLine = testLine
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}

/**
 * Tenta carregar a imagem do logo da escola em ArrayBuffer
 */
async function fetchLogoBytes(): Promise<ArrayBuffer | null> {
  if (typeof window === 'undefined') return null
  try {
    const res = await fetch('/logo-impacto.png')
    if (res.ok) {
      return await res.arrayBuffer()
    }
  } catch (err) {
    console.warn('[PDF Gen] Não foi possível carregar logo-impacto.png, usando cabeçalho tipográfico:', err)
  }
  return null
}

/**
 * Desenha a assinatura vetorizada cursiva de Ivan Rossi
 */
function drawIvanRossiSignature(page: PDFPage, startX: number, startY: number, scale = 0.55) {
  const sigColor = rgb(0.11, 0.31, 0.85) // #1d4ed8
  const borderWidth = 1.2

  // SVG Paths da assinatura de Ivan Rossi
  const paths = [
    'M20 45 C28 20, 38 8, 42 28 C45 42, 38 52, 32 40 C28 28, 38 18, 54 34 L62 44',
    'M62 40 L68 30 L74 42 L80 32 C84 30, 88 30, 92 36 L92 44 C95 34, 102 30, 108 42 L114 42',
    'M126 48 C124 30, 128 12, 136 10 C146 8, 160 12, 154 26 C150 36, 138 36, 130 36 C138 36, 150 40, 158 48',
    'M160 38 C164 32, 172 32, 170 40 C168 46, 160 46, 164 38 C168 32, 178 34, 182 42 C186 34, 192 34, 194 42 C196 32, 202 34, 206 42',
    'M115 52 C145 46, 195 45, 235 48',
  ]

  for (const p of paths) {
    try {
      page.drawSvgPath(p, {
        x: startX,
        y: startY,
        scale,
        borderColor: sigColor,
        borderWidth,
      })
    } catch (e) {
      // Fallback gracioso caso o parser SVG falhe em algum ambiente
      page.drawLine({
        start: { x: startX, y: startY },
        end: { x: startX + 100, y: startY },
        thickness: 1,
        color: sigColor,
      })
    }
  }

  // Pingos nos i's
  try {
    page.drawCircle({
      x: startX + 30 * scale,
      y: startY - 14 * scale + 30,
      size: 1.5,
      color: sigColor,
    })
    page.drawCircle({
      x: startX + 206 * scale,
      y: startY - 24 * scale + 30,
      size: 1.4,
      color: sigColor,
    })
  } catch {
    // ignore
  }
}

/**
 * Gera o documento PDF completo da declaração de IRPF
 */
export async function generateDeclaracaoPdf(data: DeclaracaoIrpfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()

  // Fontes padrão Helvetica e Courier
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
  const fontCourierBold = await pdfDoc.embedFont(StandardFonts.CourierBold)

  // Dimensões A4 Portrait (Pontos tipográficos: 1 pt = 1/72 polegada)
  const pageWidth = 595.28
  const pageHeight = 841.89
  const marginLeft = 36
  const marginRight = 36
  const contentWidth = pageWidth - marginLeft - marginRight // 523.28 pt

  let page = pdfDoc.addPage([pageWidth, pageHeight])

  // Paleta de Cores Institucionais
  const colorDark = rgb(0.06, 0.09, 0.16) // #0f172a
  const colorSlate = rgb(0.20, 0.27, 0.38) // #334155
  const colorMuted = rgb(0.39, 0.45, 0.55) // #64748b
  const colorPrimary = rgb(0.31, 0.27, 0.90) // #4f46e5
  const colorPrimaryDark = rgb(0.26, 0.22, 0.79) // #4338ca
  const colorSuccess = rgb(0.02, 0.59, 0.41) // #059669
  const colorBorder = rgb(0.89, 0.91, 0.94) // #e2e8f0
  const colorBgLight = rgb(0.97, 0.98, 0.99) // #f8fafc
  const colorWhite = rgb(1, 1, 1)

  // Tenta embutir o logo
  const logoBytes = await fetchLogoBytes()
  let embeddedLogo: any = null
  if (logoBytes) {
    try {
      embeddedLogo = await pdfDoc.embedPng(logoBytes)
    } catch {
      embeddedLogo = null
    }
  }

  let y = pageHeight - 34 // Começa em ~807 pt do topo

  // ── 1. CABEÇALHO INSTITUCIONAL ─────────────────────────────────────────────
  const headerTopY = y

  // Logo ou Insígnia à esquerda
  if (embeddedLogo) {
    const logoHeight = 36
    const logoWidth = logoHeight * (embeddedLogo.width / embeddedLogo.height)
    page.drawImage(embeddedLogo, {
      x: marginLeft,
      y: y - logoHeight + 4,
      width: logoWidth,
      height: logoHeight,
    })

    // Divisor vertical
    page.drawLine({
      start: { x: marginLeft + logoWidth + 10, y: y + 2 },
      end: { x: marginLeft + logoWidth + 10, y: y - logoHeight + 4 },
      thickness: 1.2,
      color: colorBorder,
    })

    // Slogan Institucional
    const textLeftX = marginLeft + logoWidth + 18
    page.drawText('Formando valores.', {
      x: textLeftX,
      y: y - 10,
      size: 11,
      font: fontBold,
      color: colorDark,
    })
    page.drawText('Inspirando futuros.', {
      x: textLeftX,
      y: y - 21,
      size: 11,
      font: fontBold,
      color: colorPrimary,
    })
    page.drawText('Educacao Infantil - Ensino Fundamental - Ensino Medio', {
      x: textLeftX,
      y: y - 30,
      size: 7,
      font: fontBold,
      color: colorMuted,
    })
  } else {
    // Cabeçalho tipográfico se imagem não carregar
    page.drawText('COLEGIO IMPACTO', {
      x: marginLeft,
      y: y - 10,
      size: 14,
      font: fontBold,
      color: colorDark,
    })
    page.drawText('Formando valores. Inspirando futuros.', {
      x: marginLeft,
      y: y - 22,
      size: 9.5,
      font: fontBold,
      color: colorPrimary,
    })
    page.drawText('Educacao Infantil - Ensino Fundamental - Ensino Medio', {
      x: marginLeft,
      y: y - 31,
      size: 7,
      font: fontRegular,
      color: colorMuted,
    })
  }

  // Lado Direito do Cabeçalho: Dados Fiscais da Escola
  const badgeText = 'DOCUMENTO FISCAL OFICIAL'
  const badgeWidth = fontBold.widthOfTextAtSize(badgeText, 6.5) + 10
  const badgeX = pageWidth - marginRight - badgeWidth

  // Retângulo do Badge Fiscal
  page.drawRectangle({
    x: badgeX,
    y: y - 6,
    width: badgeWidth,
    height: 11,
    color: rgb(0.93, 0.95, 1.0),
    borderColor: rgb(0.78, 0.82, 1.0),
    borderWidth: 0.8,
  })
  page.drawText(badgeText, {
    x: badgeX + 5,
    y: y - 3.5,
    size: 6.5,
    font: fontBold,
    color: colorPrimaryDark,
  })

  // Razão Social & CNPJ
  const rzText = sanitize(data.escola.razaoSocial)
  const rzWidth = fontBold.widthOfTextAtSize(rzText, 8.5)
  page.drawText(rzText, {
    x: pageWidth - marginRight - rzWidth,
    y: y - 17,
    size: 8.5,
    font: fontBold,
    color: colorDark,
  })

  const cnpjText = `CNPJ: ${sanitize(data.escola.cnpj)}`
  const cnpjWidth = fontRegular.widthOfTextAtSize(cnpjText, 7.5)
  page.drawText(cnpjText, {
    x: pageWidth - marginRight - cnpjWidth,
    y: y - 26,
    size: 7.5,
    font: fontBold,
    color: colorSlate,
  })

  const endText = `${sanitize(data.escola.endereco)} - ${sanitize(data.escola.cidadeUf)}`
  const endWidth = fontRegular.widthOfTextAtSize(endText, 6.8)
  page.drawText(endText, {
    x: pageWidth - marginRight - endWidth,
    y: y - 34,
    size: 6.8,
    font: fontRegular,
    color: colorMuted,
  })

  y = headerTopY - 42

  // Linha Divisória de Alta Precisão (Barra Indigo)
  page.drawRectangle({
    x: marginLeft,
    y: y,
    width: contentWidth,
    height: 2,
    color: colorPrimary,
  })

  y -= 14

  // ── 2. TÍTULO DO DOCUMENTO E EXERCÍCIO FISCAL ─────────────────────────────
  const title1 = 'DECLARACAO DE PAGAMENTOS EFETUADOS PARA IRPF'
  const title1Width = fontBold.widthOfTextAtSize(title1, 11)
  page.drawText(title1, {
    x: marginLeft + (contentWidth - title1Width) / 2,
    y,
    size: 11,
    font: fontBold,
    color: colorDark,
  })

  y -= 14
  // Pílula com Ano-Calendário e Exercício
  const pillText = `Ano-Calendario: ${data.anoCalendario}   |   Exercicio Fiscal: ${data.exercicio}`
  const pillTextWidth = fontBold.widthOfTextAtSize(pillText, 7.5)
  const pillBoxWidth = pillTextWidth + 18
  const pillBoxX = marginLeft + (contentWidth - pillBoxWidth) / 2

  page.drawRectangle({
    x: pillBoxX,
    y: y - 2,
    width: pillBoxWidth,
    height: 13,
    color: colorBgLight,
    borderColor: colorBorder,
    borderWidth: 1,
  })
  page.drawText(pillText, {
    x: pillBoxX + 9,
    y: y + 2,
    size: 7.5,
    font: fontBold,
    color: colorSlate,
  })

  y -= 10
  const legalSub = '(Em cumprimento a Lei Federal no 12.007/2009 e normativas da Receita Federal do Brasil)'
  const legalSubWidth = fontOblique.widthOfTextAtSize(legalSub, 6.8)
  page.drawText(legalSub, {
    x: marginLeft + (contentWidth - legalSubWidth) / 2,
    y,
    size: 6.8,
    font: fontOblique,
    color: colorMuted,
  })

  y -= 14

  // ── 3. CARDS DE IDENTIFICAÇÃO FORMAL ──────────────────────────────────────
  const cardGap = 8
  const cardWidth = (contentWidth - cardGap) / 2
  const cardHeight = 44

  // Card 1: Instituição de Ensino
  page.drawRectangle({
    x: marginLeft,
    y: y - cardHeight,
    width: cardWidth,
    height: cardHeight,
    color: colorBgLight,
    borderColor: colorBorder,
    borderWidth: 1,
  })
  page.drawText('1. INSTITUICAO DE ENSINO / CREDORA', {
    x: marginLeft + 8,
    y: y - 10,
    size: 6.8,
    font: fontBold,
    color: colorPrimary,
  })
  page.drawText(sanitize(data.escola.razaoSocial), {
    x: marginLeft + 8,
    y: y - 20,
    size: 8,
    font: fontBold,
    color: colorDark,
  })
  page.drawText(`CNPJ: ${sanitize(data.escola.cnpj)}`, {
    x: marginLeft + 8,
    y: y - 30,
    size: 7.2,
    font: fontBold,
    color: colorSlate,
  })
  page.drawText(`${sanitize(data.escola.endereco)} - ${sanitize(data.escola.cidadeUf)}`, {
    x: marginLeft + 8,
    y: y - 39,
    size: 6.5,
    font: fontRegular,
    color: colorMuted,
  })

  // Card 2: Responsável Financeiro
  const card2X = marginLeft + cardWidth + cardGap
  page.drawRectangle({
    x: card2X,
    y: y - cardHeight,
    width: cardWidth,
    height: cardHeight,
    color: colorBgLight,
    borderColor: colorBorder,
    borderWidth: 1,
  })
  page.drawText('2. CONTRIBUINTE / RESPONSAVEL FINANCEIRO', {
    x: card2X + 8,
    y: y - 10,
    size: 6.8,
    font: fontBold,
    color: colorPrimary,
  })
  page.drawText(sanitize(data.responsavel.nome), {
    x: card2X + 8,
    y: y - 20,
    size: 8,
    font: fontBold,
    color: colorDark,
  })
  page.drawText(`CPF: ${sanitize(data.responsavel.cpf)}`, {
    x: card2X + 8,
    y: y - 30,
    size: 7.2,
    font: fontBold,
    color: colorSlate,
  })
  page.drawText(`Beneficiario(a): ${sanitize(data.aluno.nome)}`, {
    x: card2X + 8,
    y: y - 39,
    size: 6.5,
    font: fontRegular,
    color: colorMuted,
  })

  y = y - cardHeight - 6

  // Faixa do Aluno (Banner Branco)
  const studentBarHeight = 18
  page.drawRectangle({
    x: marginLeft,
    y: y - studentBarHeight,
    width: contentWidth,
    height: studentBarHeight,
    color: colorWhite,
    borderColor: colorBorder,
    borderWidth: 1,
  })

  const col1X = marginLeft + 8
  page.drawText('ALUNO(A): ', { x: col1X, y: y - 12, size: 7.2, font: fontBold, color: colorPrimary })
  const alNomeX = col1X + fontBold.widthOfTextAtSize('ALUNO(A): ', 7.2)
  page.drawText(sanitize(data.aluno.nome), { x: alNomeX, y: y - 12, size: 7.5, font: fontBold, color: colorDark })

  const col2X = marginLeft + 230
  page.drawText('MATRICULA: ', { x: col2X, y: y - 12, size: 7, font: fontBold, color: colorMuted })
  const matX = col2X + fontBold.widthOfTextAtSize('MATRICULA: ', 7)
  page.drawText(sanitize(data.aluno.matricula), { x: matX, y: y - 12, size: 7.5, font: fontCourierBold, color: colorDark })

  const col3X = marginLeft + 330
  page.drawText('TURMA/SERIE: ', { x: col3X, y: y - 12, size: 7, font: fontBold, color: colorMuted })
  const turX = col3X + fontBold.widthOfTextAtSize('TURMA/SERIE: ', 7)
  page.drawText(sanitize(data.aluno.turma), { x: turX, y: y - 12, size: 7.5, font: fontBold, color: colorDark })

  y = y - studentBarHeight - 10

  // ── 4. TEXTO DECLARATÓRIO FORMAL ──────────────────────────────────────────
  const declaracaoTexto = `Declaramos, para os devidos fins de comprovacao de despesas com instrucao junto a Secretaria Especial da Receita Federal do Brasil (Declaracao de Ajuste Anual de IRPF) e em cumprimento aos termos da Lei Federal no 12.007, de 29 de julho de 2009, que o(a) responsavel financeiro acima qualificado(a) efetuou a quitacao das mensalidades escolares relacionadas abaixo dos servicos educacionais prestados ao(a) aluno(a) durante o ano-calendario de ${data.anoCalendario}, conforme discriminado a seguir:`

  const textoLines = wrapText(declaracaoTexto, contentWidth - 4, fontRegular, 7.8)
  for (const line of textoLines) {
    page.drawText(line, {
      x: marginLeft + 2,
      y,
      size: 7.8,
      font: fontRegular,
      color: colorSlate,
    })
    y -= 10.5
  }

  y -= 4

  // ── 5. TABELA DE MENSALIDADES PAGAS ───────────────────────────────────────
  const colDef = [
    { label: '#', x: marginLeft, width: 22, align: 'center' },
    { label: 'COMPETENCIA', x: marginLeft + 22, width: 85, align: 'left' },
    { label: 'DESCRICAO DO SERVICO', x: marginLeft + 107, width: 195, align: 'left' },
    { label: 'VENCIMENTO', x: marginLeft + 302, width: 68, align: 'center' },
    { label: 'DATA PAGTO', x: marginLeft + 370, width: 68, align: 'center' },
    { label: 'VALOR PAGO', x: marginLeft + 438, width: contentWidth - 438, align: 'right' },
  ]

  // Cabeçalho da Tabela
  const tableHeaderHeight = 14
  page.drawRectangle({
    x: marginLeft,
    y: y - tableHeaderHeight,
    width: contentWidth,
    height: tableHeaderHeight,
    color: colorDark,
    borderColor: colorDark,
    borderWidth: 1,
  })

  for (const col of colDef) {
    const textWidth = fontBold.widthOfTextAtSize(col.label, 7)
    let textX = col.x + 4
    if (col.align === 'center') {
      textX = col.x + (col.width - textWidth) / 2
    } else if (col.align === 'right') {
      textX = col.x + col.width - textWidth - 4
    }

    page.drawText(col.label, {
      x: textX,
      y: y - 10,
      size: 7,
      font: fontBold,
      color: colorWhite,
    })
  }

  y -= tableHeaderHeight

  // Linhas da Tabela
  const rowHeight = 12.5
  if (data.quantidadeMensalidades > 0) {
    data.mensalidades.forEach((m, idx) => {
      const rowBg = idx % 2 === 0 ? colorWhite : colorBgLight

      page.drawRectangle({
        x: marginLeft,
        y: y - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: rowBg,
        borderColor: colorBorder,
        borderWidth: 0.8,
      })

      // #
      const idxText = String(m.index)
      const idxW = fontRegular.widthOfTextAtSize(idxText, 7)
      page.drawText(idxText, {
        x: colDef[0].x + (colDef[0].width - idxW) / 2,
        y: y - 9,
        size: 7,
        font: fontBold,
        color: colorMuted,
      })

      // Competência
      page.drawText(sanitize(m.competencia), {
        x: colDef[1].x + 4,
        y: y - 9,
        size: 7.2,
        font: fontBold,
        color: colorDark,
      })

      // Descrição (truncada se necessário)
      let descText = sanitize(m.descricao)
      if (fontRegular.widthOfTextAtSize(descText, 7) > colDef[2].width - 8) {
        while (fontRegular.widthOfTextAtSize(descText + '...', 7) > colDef[2].width - 8 && descText.length > 0) {
          descText = descText.slice(0, -1)
        }
        descText += '...'
      }
      page.drawText(descText, {
        x: colDef[2].x + 4,
        y: y - 9,
        size: 7,
        font: fontRegular,
        color: colorSlate,
      })

      // Vencimento
      const vctText = sanitize(m.vencimento)
      const vctW = fontCourierBold.widthOfTextAtSize(vctText, 7)
      page.drawText(vctText, {
        x: colDef[3].x + (colDef[3].width - vctW) / 2,
        y: y - 9,
        size: 7,
        font: fontCourierBold,
        color: colorMuted,
      })

      // Data Pagamento
      const pagText = sanitize(m.dataPagamento)
      const pagW = fontCourierBold.widthOfTextAtSize(pagText, 7)
      page.drawText(pagText, {
        x: colDef[4].x + (colDef[4].width - pagW) / 2,
        y: y - 9,
        size: 7,
        font: fontCourierBold,
        color: colorSuccess,
      })

      // Valor Pago
      const valText = sanitize(m.valorPago)
      const valW = fontCourierBold.widthOfTextAtSize(valText, 7.5)
      page.drawText(valText, {
        x: colDef[5].x + colDef[5].width - valW - 4,
        y: y - 9,
        size: 7.5,
        font: fontCourierBold,
        color: colorDark,
      })

      y -= rowHeight
    })

    // Linha de Total Geral
    const totalRowHeight = 14
    page.drawRectangle({
      x: marginLeft,
      y: y - totalRowHeight,
      width: contentWidth,
      height: totalRowHeight,
      color: rgb(0.94, 0.96, 0.98),
      borderColor: colorDark,
      borderWidth: 1,
    })

    const totalLabel = `Total de mensalidades pagas em ${data.anoCalendario}:`
    const totalLabelW = fontBold.widthOfTextAtSize(totalLabel, 7.5)
    page.drawText(totalLabel, {
      x: colDef[5].x - totalLabelW - 8,
      y: y - 10,
      size: 7.5,
      font: fontBold,
      color: colorDark,
    })

    const totalValText = sanitize(data.totalPagoFormatado)
    const totalValW = fontCourierBold.widthOfTextAtSize(totalValText, 9)
    page.drawText(totalValText, {
      x: colDef[5].x + colDef[5].width - totalValW - 4,
      y: y - 10.5,
      size: 9,
      font: fontCourierBold,
      color: colorPrimary,
    })

    y -= totalRowHeight
  } else {
    // Mensagem de ausência de pagamentos
    const emptyRowHeight = 24
    page.drawRectangle({
      x: marginLeft,
      y: y - emptyRowHeight,
      width: contentWidth,
      height: emptyRowHeight,
      color: colorBgLight,
      borderColor: colorBorder,
      borderWidth: 1,
    })
    const noRecords = `Nao constam registros de mensalidades escolares pagas para este aluno no ano-calendario de ${data.anoCalendario}.`
    const noRecW = fontRegular.widthOfTextAtSize(noRecords, 7.5)
    page.drawText(noRecords, {
      x: marginLeft + (contentWidth - noRecW) / 2,
      y: y - 15,
      size: 7.5,
      font: fontRegular,
      color: colorMuted,
    })
    y -= emptyRowHeight
  }

  y -= 6

  // ── 6. VALOR POR EXTENSO & INDICAÇÃO LEGAL ────────────────────────────────
  if (data.quantidadeMensalidades > 0) {
    const extensoBoxHeight = 14
    page.drawRectangle({
      x: marginLeft,
      y: y - extensoBoxHeight,
      width: contentWidth,
      height: extensoBoxHeight,
      color: colorBgLight,
      borderColor: colorBorder,
      borderWidth: 1,
    })

    const extensoPrefix = 'Valor Total por Extenso: '
    page.drawText(extensoPrefix, {
      x: marginLeft + 8,
      y: y - 10,
      size: 7.2,
      font: fontBold,
      color: colorSlate,
    })
    const extW = fontBold.widthOfTextAtSize(extensoPrefix, 7.2)
    page.drawText(`${sanitize(data.totalPagoPorExtenso)}.`, {
      x: marginLeft + 8 + extW,
      y: y - 10,
      size: 7.2,
      font: fontRegular,
      color: colorSlate,
    })

    y -= extensoBoxHeight + 4
  }

  // Indicação de não quitação integral
  const disclaimerText = '* Este documento nao representa quitacao integral do contrato.'
  page.drawText(disclaimerText, {
    x: marginLeft + 2,
    y: y - 2,
    size: 7.0,
    font: fontBold,
    color: colorMuted,
  })

  y -= 10

  // ── 7. FECHAMENTO & DATA ──────────────────────────────────────────────────
  const closingText = 'Por ser a expressao da verdade e para que produza seus regulares efeitos legais e fiscais, firmamos a presente declaracao.'
  page.drawText(closingText, {
    x: marginLeft + 2,
    y,
    size: 7.5,
    font: fontRegular,
    color: colorSlate,
  })

  y -= 12
  const dateText = sanitize(data.cidadeDataEmissao)
  const dateW = fontBold.widthOfTextAtSize(dateText, 7.8)
  page.drawText(dateText, {
    x: pageWidth - marginRight - dateW,
    y,
    size: 7.8,
    font: fontBold,
    color: colorSlate,
  })

  y -= 14

  // ── 8. ASSINATURA & AUTENTICIDADE ─────────────────────────────────────────
  const authBoxWidth = 230
  const authBoxHeight = 44

  // Box de Autenticidade à Esquerda
  page.drawRectangle({
    x: marginLeft,
    y: y - authBoxHeight,
    width: authBoxWidth,
    height: authBoxHeight,
    color: colorBgLight,
    borderColor: colorBorder,
    borderWidth: 1,
  })
  page.drawText('AUTENTICIDADE E CONTROLE FISCAL', {
    x: marginLeft + 8,
    y: y - 10,
    size: 6.8,
    font: fontBold,
    color: colorPrimary,
  })
  page.drawText(`Codigo: ${sanitize(data.codigoAutenticidade)}`, {
    x: marginLeft + 8,
    y: y - 22,
    size: 7.5,
    font: fontCourierBold,
    color: colorDark,
  })
  page.drawText('Emitido eletronicamente via Sistema Impacto EDU.', {
    x: marginLeft + 8,
    y: y - 34,
    size: 6.5,
    font: fontRegular,
    color: colorMuted,
  })

  // Assinatura e Dados à Direita
  const sigCenterX = pageWidth - marginRight - 100

  // Desenha a assinatura vetorizada manual de Ivan Rossi
  drawIvanRossiSignature(page, sigCenterX - 65, y + 15, 0.55)

  // Linha de assinatura
  const sigLineWidth = 180
  const sigLineX = sigCenterX - sigLineWidth / 2
  page.drawLine({
    start: { x: sigLineX, y: y - 14 },
    end: { x: sigLineX + sigLineWidth, y: y - 14 },
    thickness: 1.2,
    color: colorDark,
  })

  const nameText = 'Ivan Rossi'
  const nameW = fontBold.widthOfTextAtSize(nameText, 8.5)
  page.drawText(nameText, {
    x: sigCenterX - nameW / 2,
    y: y - 23,
    size: 8.5,
    font: fontBold,
    color: colorDark,
  })

  const cargoText = 'Direcao Geral e Controladoria'
  const cargoW = fontBold.widthOfTextAtSize(cargoText, 7.2)
  page.drawText(cargoText, {
    x: sigCenterX - cargoW / 2,
    y: y - 31,
    size: 7.2,
    font: fontBold,
    color: colorSlate,
  })

  const escRzText = sanitize(data.escola.razaoSocial)
  const escRzW = fontRegular.widthOfTextAtSize(escRzText, 6.5)
  page.drawText(escRzText, {
    x: sigCenterX - escRzW / 2,
    y: y - 39,
    size: 6.5,
    font: fontRegular,
    color: colorMuted,
  })

  // ── 9. RODAPÉ INSTITUCIONAL ───────────────────────────────────────────────
  const footerY = 28
  page.drawLine({
    start: { x: marginLeft, y: footerY + 14 },
    end: { x: pageWidth - marginRight, y: footerY + 14 },
    thickness: 1,
    color: colorBorder,
  })

  const footer1 = `${sanitize(data.escola.nomeFantasia)} - ${sanitize(data.escola.segmento)}`
  const footer1W = fontBold.widthOfTextAtSize(footer1, 7.2)
  page.drawText(footer1, {
    x: marginLeft + (contentWidth - footer1W) / 2,
    y: footerY + 5,
    size: 7.2,
    font: fontBold,
    color: colorSlate,
  })

  const footer2 = 'Rua Alagoas, 1081 - Jardim dos Estados, Campo Grande/MS - Tel: (67) 3025-5585 - impacto@colegioimpacto.net - www.colegioimpacto.net'
  const footer2W = fontRegular.widthOfTextAtSize(footer2, 6.2)
  page.drawText(footer2, {
    x: marginLeft + (contentWidth - footer2W) / 2,
    y: footerY - 4,
    size: 6.2,
    font: fontRegular,
    color: colorMuted,
  })

  return await pdfDoc.save()
}
