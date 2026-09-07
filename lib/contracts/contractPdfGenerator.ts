/**
 * lib/contracts/contractPdfGenerator.ts
 *
 * Gerador de PDF oficial vetorial em alta resolução para Contratos Educacionais
 * e Requerimentos de Matrícula do Colégio Impacto.
 * Utiliza pdf-lib para criar arquivos compactos, padronizados e 100% compatíveis com ZapSign.
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'
import {
  ContractDataModel,
  getTextoContratoServicos,
  getTextoRequerimentoMatricula,
  formatCurrencyBRL
} from './contractTemplates'

/**
 * Sanitiza texto para compatibilidade com StandardFonts (WinAnsi)
 */
function sanitize(text?: string | null): string {
  if (!text) return ''
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/•/g, '-')
    .replace(/—|–/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
}

/**
 * Quebra linhas de texto respeitando a largura máxima disponível
 */
function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  const sanitized = sanitize(text)
  const paragraphs = sanitized.split('\n')
  const resultLines: string[] = []

  for (const para of paragraphs) {
    if (para.trim() === '') {
      resultLines.push('')
      continue
    }
    const words = para.split(/\s+/)
    let currentLine = ''

    for (const word of words) {
      if (!word) continue
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const width = font.widthOfTextAtSize(testLine, fontSize)
      if (width <= maxWidth) {
        currentLine = testLine
      } else {
        if (currentLine) resultLines.push(currentLine)
        currentLine = word
      }
    }
    if (currentLine) resultLines.push(currentLine)
  }

  return resultLines
}

export interface GeneratedPdfResult {
  pdfBytes: Uint8Array
  base64Pdf: string
  docName: string
}

/**
 * Gera o documento PDF completo para o contrato ou requerimento
 */
export async function gerarContratoPdf(data: ContractDataModel): Promise<GeneratedPdfResult> {
  const pdfDoc = await PDFDocument.create()

  // Fontes padrão de alta fidelidade
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // Cores institucionais do Colégio Impacto
  const colorPrimary = rgb(0.08, 0.20, 0.45) // Azul marinho nobre
  const colorDark = rgb(0.12, 0.15, 0.20)    // Cinza grafite texto
  const colorSubtle = rgb(0.40, 0.45, 0.52)  // Cinza médio
  const colorLightBg = rgb(0.95, 0.97, 1.0)  // Fundo sutil azulado
  const colorBorder = rgb(0.85, 0.88, 0.94)

  const pageWidth = 595.28 // A4 Width
  const pageHeight = 841.89 // A4 Height
  const marginX = 42
  const marginTop = 48
  const marginBottom = 50
  const contentWidth = pageWidth - marginX * 2

  let pageIndex = 0
  const pages: PDFPage[] = []

  const createPage = (): { page: PDFPage; startY: number } => {
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    pages.push(page)
    pageIndex++

    // Cabeçalho institucional (em todas as páginas)
    // Linha decorativa superior
    page.drawRectangle({
      x: marginX,
      y: pageHeight - 24,
      width: contentWidth,
      height: 3,
      color: colorPrimary,
    })

    // Nome da Instituição
    page.drawText(sanitize(data.escolaNome || 'COLÉGIO IMPACTO'), {
      x: marginX,
      y: pageHeight - 40,
      size: 13,
      font: fontBold,
      color: colorPrimary,
    })

    const infoEscola = `${data.escolaRazaoSocial || 'Colégio Impacto Ltda'} • CNPJ: ${data.escolaCnpj || '00.000.000/0001-00'}`
    page.drawText(sanitize(infoEscola), {
      x: marginX,
      y: pageHeight - 51,
      size: 7.5,
      font: fontRegular,
      color: colorSubtle,
    })

    const enderecoEscola = `${data.escolaEndereco || 'Rua Principal, 100'} • ${data.escolaCidadeUf || 'Campo Grande - MS'} • Tel: ${data.escolaTelefone || '(67) 3000-0000'}`
    page.drawText(sanitize(enderecoEscola), {
      x: marginX,
      y: pageHeight - 61,
      size: 7,
      font: fontRegular,
      color: colorSubtle,
    })

    // Linha divisória do cabeçalho
    page.drawLine({
      start: { x: marginX, y: pageHeight - 68 },
      end: { x: pageWidth - marginX, y: pageHeight - 68 },
      thickness: 0.8,
      color: colorBorder,
    })

    return { page, startY: pageHeight - 85 }
  }

  // Inicializa a primeira página
  let { page: currentPage, startY: currentY } = createPage()

  // ── Bloco Título do Documento ──────────────────────────────────────────────
  let tituloDoc = 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS'
  let subTituloDoc = `Ano Letivo ${data.anoLetivo} • Processo de Matrícula Online`

  if (data.tipoDocumento === 'requerimento_matricula') {
    tituloDoc = 'REQUERIMENTO DE MATRÍCULA E REMATRÍCULA'
    subTituloDoc = `Ano Letivo ${data.anoLetivo} • Secretaria Escolar`
  } else if (data.tipoDocumento === 'pacote_completo') {
    tituloDoc = 'INSTRUMENTO CONTRATUAL E REQUERIMENTO DE MATRÍCULA'
    subTituloDoc = `Ano Letivo ${data.anoLetivo} • Prestação de Serviços Educacionais`
  }

  currentPage.drawText(tituloDoc, {
    x: marginX,
    y: currentY,
    size: 11.5,
    font: fontBold,
    color: colorPrimary,
  })
  currentY -= 14

  currentPage.drawText(subTituloDoc, {
    x: marginX,
    y: currentY,
    size: 8.5,
    font: fontRegular,
    color: colorSubtle,
  })
  currentY -= 18

  // ── Quadro Resumo do Aluno e Responsável Financeiro ───────────────────────
  const boxHeight = 62
  currentPage.drawRectangle({
    x: marginX,
    y: currentY - boxHeight,
    width: contentWidth,
    height: boxHeight,
    color: colorLightBg,
    borderColor: colorBorder,
    borderWidth: 0.8,
  })

  // Coluna Esquerda: Dados do Aluno
  currentPage.drawText('ESTUDANTE / BENEFICIÁRIO(A):', {
    x: marginX + 10,
    y: currentY - 14,
    size: 7.5,
    font: fontBold,
    color: colorPrimary,
  })
  currentPage.drawText(sanitize(data.alunoNome || 'Nome do Estudante'), {
    x: marginX + 10,
    y: currentY - 26,
    size: 9.5,
    font: fontBold,
    color: colorDark,
  })
  currentPage.drawText(sanitize(`Série/Turma: ${data.alunoSerie || data.alunoTurma || 'Regular'} • Turno: ${data.alunoTurno || 'Matutino'}`), {
    x: marginX + 10,
    y: currentY - 38,
    size: 8,
    font: fontRegular,
    color: colorDark,
  })
  currentPage.drawText(sanitize(`Matrícula/Cód: ${data.alunoMatricula || 'Pendente'} • CPF: ${data.alunoCpf || 'Não informado'}`), {
    x: marginX + 10,
    y: currentY - 49,
    size: 7.5,
    font: fontRegular,
    color: colorSubtle,
  })

  // Coluna Direita: Responsável Financeiro e Condições
  const colRightX = marginX + (contentWidth / 2) + 5
  currentPage.drawText('RESPONSÁVEL FINANCEIRO / SIGNATÁRIO:', {
    x: colRightX,
    y: currentY - 14,
    size: 7.5,
    font: fontBold,
    color: colorPrimary,
  })
  currentPage.drawText(sanitize(`${data.respNome || 'Nome do Responsável'} (${data.respParentesco || 'Responsável'})`), {
    x: colRightX,
    y: currentY - 26,
    size: 9,
    font: fontBold,
    color: colorDark,
  })
  currentPage.drawText(sanitize(`CPF: ${data.respCpf || '000.000.000-00'} • Tel: ${data.respTelefone || 'WhatsApp'}`), {
    x: colRightX,
    y: currentY - 38,
    size: 8,
    font: fontRegular,
    color: colorDark,
  })
  currentPage.drawText(sanitize(`Anuidade: ${formatCurrencyBRL(data.valorAnuidade)} (${data.numParcelas}x ${formatCurrencyBRL(data.valorMensalidade)})`), {
    x: colRightX,
    y: currentY - 49,
    size: 8,
    font: fontBold,
    color: colorPrimary,
  })

  currentY -= (boxHeight + 20)

  // ── Montagem do Conteúdo Textual ──────────────────────────────────────────
  let textoCorpo = ''
  if (data.tipoDocumento === 'requerimento_matricula') {
    textoCorpo = getTextoRequerimentoMatricula(data)
  } else if (data.tipoDocumento === 'pacote_completo') {
    textoCorpo = `${getTextoContratoServicos(data)}\n\n------------------------------------------------------------\n\n${getTextoRequerimentoMatricula(data)}`
  } else {
    textoCorpo = getTextoContratoServicos(data)
  }

  const lines = wrapText(textoCorpo, contentWidth, fontRegular, 8.5)

  for (const line of lines) {
    // Se a linha passar do limite inferior da página, cria nova página
    if (currentY < marginBottom + 30) {
      const next = createPage()
      currentPage = next.page
      currentY = next.startY
    }

    if (line === '') {
      currentY -= 7
      continue
    }

    // Se for cabeçalho de cláusula ou título interno, usa negrito
    const isHeader = line.startsWith('CLÁUSULA') ||
      line.startsWith('I – DAS PARTES') ||
      line.startsWith('REQUERIMENTO DE MATRÍCULA') ||
      line.startsWith('TERMO DE COMPROMISSO') ||
      line.startsWith('CONTRATO DE PRESTAÇÃO')

    if (isHeader) {
      currentY -= 4
      currentPage.drawText(line, {
        x: marginX,
        y: currentY,
        size: 9,
        font: fontBold,
        color: colorPrimary,
      })
      currentY -= 13
    } else {
      currentPage.drawText(line, {
        x: marginX,
        y: currentY,
        size: 8.5,
        font: fontRegular,
        color: colorDark,
      })
      currentY -= 11.5
    }
  }

  // ── Bloco Final de Assinatura Eletrônica ───────────────────────────────────
  // Garantir que haja espaço para o box de assinatura (precisa de ~110pt)
  if (currentY < marginBottom + 120) {
    const next = createPage()
    currentPage = next.page
    currentY = next.startY
  }

  currentY -= 15

  // Box de Assinatura ZapSign
  const signBoxHeight = 85
  currentPage.drawRectangle({
    x: marginX,
    y: currentY - signBoxHeight,
    width: contentWidth,
    height: signBoxHeight,
    color: rgb(0.97, 0.98, 1.0),
    borderColor: rgb(0.20, 0.40, 0.80),
    borderWidth: 1,
  })

  currentPage.drawText('AUTENTICAÇÃO & ASSINATURA ELETRÔNICA ZAPSIGN', {
    x: marginX + 12,
    y: currentY - 16,
    size: 8,
    font: fontBold,
    color: colorPrimary,
  })

  currentPage.drawText(
    sanitize('Este documento será assinado eletronicamente via plataforma certificada ZapSign, com validade jurídica assegurada pela MP 2.200-2/2001 e Lei Federal nº 14.063/2020.'),
    {
      x: marginX + 12,
      y: currentY - 29,
      size: 7,
      font: fontRegular,
      color: colorSubtle,
    }
  )

  // Linhas para o Signatário e a Escola
  const signWidth = (contentWidth - 40) / 2

  // Signatário (Responsável)
  currentPage.drawLine({
    start: { x: marginX + 12, y: currentY - 60 },
    end: { x: marginX + 12 + signWidth, y: currentY - 60 },
    thickness: 0.8,
    color: colorDark,
  })
  currentPage.drawText(sanitize(`${data.respNome} (CPF: ${data.respCpf})`), {
    x: marginX + 12,
    y: currentY - 70,
    size: 7.5,
    font: fontBold,
    color: colorDark,
  })
  currentPage.drawText('CONTRATANTE / RESPONSÁVEL FINANCEIRO', {
    x: marginX + 12,
    y: currentY - 79,
    size: 6.5,
    font: fontRegular,
    color: colorSubtle,
  })

  // Representante Legal da Escola
  const repX = marginX + 28 + signWidth
  currentPage.drawLine({
    start: { x: repX, y: currentY - 60 },
    end: { x: repX + signWidth, y: currentY - 60 },
    thickness: 0.8,
    color: colorDark,
  })
  currentPage.drawText(sanitize(`${data.escolaRazaoSocial}`), {
    x: repX,
    y: currentY - 70,
    size: 7.5,
    font: fontBold,
    color: colorDark,
  })
  currentPage.drawText('CONTRATADA / DIREÇÃO ESCOLAR', {
    x: repX,
    y: currentY - 79,
    size: 6.5,
    font: fontRegular,
    color: colorSubtle,
  })

  // ── Numeração de Páginas e Rodapé ─────────────────────────────────────────
  const totalPages = pages.length
  for (let i = 0; i < totalPages; i++) {
    const p = pages[i]
    p.drawLine({
      start: { x: marginX, y: marginBottom },
      end: { x: pageWidth - marginX, y: marginBottom },
      thickness: 0.5,
      color: colorBorder,
    })

    const rodapeText = sanitize(`Colégio Impacto • Matrícula Online • Documento Gerado em ${new Date().toLocaleDateString('pt-BR')}`)
    p.drawText(rodapeText, {
      x: marginX,
      y: marginBottom - 12,
      size: 7,
      font: fontRegular,
      color: colorSubtle,
    })

    const paginacaoText = `Página ${i + 1} de ${totalPages}`
    const pagWidth = fontRegular.widthOfTextAtSize(paginacaoText, 7)
    p.drawText(paginacaoText, {
      x: pageWidth - marginX - pagWidth,
      y: marginBottom - 12,
      size: 7,
      font: fontRegular,
      color: colorSubtle,
    })
  }

  // Gera os bytes e o Base64
  const pdfBytes = await pdfDoc.save()
  const base64Pdf = Buffer.from(pdfBytes).toString('base64')

  const docNameSanitized = sanitize(
    `${tituloDoc} - ${data.alunoNome} - ${data.anoLetivo}`
  ).replace(/[^a-zA-Z0-9_\- ]/g, '')

  return {
    pdfBytes,
    base64Pdf,
    docName: docNameSanitized,
  }
}
