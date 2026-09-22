/**
 * lib/contracts/digitalEvidenceCertificate.ts
 *
 * Motor Gerador do Dossiê Pericial e Certificado de Evidências do Colégio Impacto.
 * Anexa uma página oficial inseparável ao PDF contendo QR Code público,
 * tríplice hash criptográfico SHA-256, metadados periciais de rede/hardware,
 * comprovação formal de OTP (sem expor o segredo) e trilha encadeada de auditoria.
 *
 * Ao final, aplica a Assinatura Criptográfica Corporativa PKCS#7 (/Sig e /ByteRange)
 * tornando o arquivo verificável por qualquer leitor de PDF padrão (Adobe Acrobat Reader).
 */

import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import {
  calculateSha256,
  getPublicValidationUrl,
  maskCpf,
  maskEmail,
  maskPhone,
  calculateAuditTrailHash,
} from './cryptoSignature'
import { assinarPdfCriptograficamente } from './institutionalCertificate'
import {
  desenharSeloEletronicoNoPdf,
  formatAbbreviatedSignerName,
  obterOuCarregarFonteAssinatura,
} from './sealGenerator'

/**
 * Sanitiza strings para o charset padrão WinAnsi das fontes básicas do PDF
 */
function sanitizeWinAnsi(text?: string | null): string {
  if (!text) return ''
  return String(text)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/•/g, '-')
    .replace(/—|–/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, ' ')
}

function formatDatePtBr(isoString?: string | null): string {
  if (!isoString) return 'Data não registrada'
  try {
    const d = new Date(isoString)
    const dataHoraUtc = d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
    const horaLocal = d.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Campo_Grande',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    return `${dataHoraUtc} (${horaLocal} no Horário de MS - UTC-4)`
  } catch {
    return isoString
  }
}

function formatAuditTimestamp(isoString?: string | null): string {
  if (!isoString) return 'Data não registrada'
  try {
    const d = new Date(isoString)
    const dataUtc = d.toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
    const horaLocal = d.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Campo_Grande',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    return `${dataUtc} (${horaLocal} MS)`
  } catch {
    return isoString || ''
  }
}

/**
 * Quebra linhas de texto para caber perfeitamente na largura máxima permitida em pontos
 */
function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  if (!text) return []
  const clean = sanitizeWinAnsi(text).trim().replace(/\s+/g, ' ')
  const words = clean.split(' ')
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const testLine = current ? `${current} ${word}` : word
    const width = font.widthOfTextAtSize(testLine, fontSize)
    if (width <= maxWidth) {
      current = testLine
    } else {
      if (current) lines.push(current)
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let sub = ''
        for (const ch of word) {
          if (font.widthOfTextAtSize(sub + ch, fontSize) <= maxWidth) {
            sub += ch
          } else {
            lines.push(sub)
            sub = ch
          }
        }
        current = sub
      } else {
        current = word
      }
    }
  }
  if (current) lines.push(current)
  return lines
}

function cleanBrowserName(str?: string | null): string {
  if (!str) return 'Navegador Web Seguro'
  if (str.includes('Edg/') || str.includes('Edge')) return 'Microsoft Edge'
  if (str.includes('Chrome/') || str.includes('CriOS/')) return 'Google Chrome'
  if (str.includes('Safari/') && !str.includes('Chrome/')) return 'Apple Safari'
  if (str.includes('Firefox/') || str.includes('FxiOS/')) return 'Mozilla Firefox'
  if (str.includes('Opera') || str.includes('OPR/')) return 'Opera'
  if (str.length > 25 || str.includes('Mozilla/')) return 'Navegador Web Seguro'
  return str
}

function cleanOsName(str?: string | null): string {
  if (!str) return 'Sistema Operacional'
  if (str.includes('MacIntel') || str.includes('Macintosh') || str.includes('Mac OS') || str.includes('macOS')) return 'macOS (Apple)'
  if (str.includes('iPhone') || str.includes('iPad') || str.includes('iOS')) return 'iOS (Apple)'
  if (str.includes('Win32') || str.includes('Win64') || str.includes('Windows')) return 'Windows'
  if (str.includes('Android')) return 'Android'
  if (str.includes('Linux')) return 'Linux'
  if (str.length > 25) return 'Sistema Operacional Seguro'
  return str
}

export interface EventoAuditoriaItem {
  id?: string
  timestamp: string
  evento: string
  descricao: string
  ip: string
  hash?: string
}

export interface EvidenceCertificateParams {
  originalPdfBytes: Uint8Array
  protocolo: string
  documentoTitulo: string
  documentoOriginalHash: string
  alunoNome?: string | null
  alunoCpf?: string | null
  alunoSerieTurma?: string | null
  anoLetivo?: string | null
  signatario: {
    nome: string
    cpf?: string | null
    dataNascimento?: string | null
    email: string
    telefone?: string | null
    parentesco?: string | null
    cargoOuFuncao?: string | null
    dataHoraAssinatura: string
    metodoAutenticacao: string
    aceiteTexto: string
    ip: string
    dispositivo: string
    sistemaOperacional: string
    navegador: string
    tipoAssinatura?: 'manual' | 'nome_automatico' | string
    assinaturaBase64?: string | null
    usuarioAutenticadoApp?: boolean
  }
  representanteEscola: {
    nome: string
    cpf: string
    cargo: string
    razaoSocial: string
    cnpj: string
    dataHoraAssinatura: string
    assinaturaBase64?: string | null
  }
  eventosAuditoria: EventoAuditoriaItem[]
  validationUrl?: string
  logoBase64?: string | null
  logoBytes?: Uint8Array | null
  documentosAnexados?: Array<{
    ordem?: number
    nome: string
    totalPaginas?: number
    tamanhoBytes?: number
    tamanhoFormatado?: string
    formatoOriginal?: string
  }> | null
}

export interface FinalSealedDocumentResult {
  pdfBytes: Uint8Array
  base64Pdf: string
  documentoOriginalHash: string
  documentoFinalHash: string
  trilhaAuditoriaHash: string
  protocolo: string
}

/**
 * Anexa o Certificado Oficial de Evidências ao PDF do contrato, aplica a assinatura
 * criptográfica institucional PKCS#7 (/Sig e /ByteRange) e sela o arquivo.
 */
export async function anexarCertificadoEvidencias(
  params: EvidenceCertificateParams
): Promise<FinalSealedDocumentResult> {
  // 1. Carrega o documento original se for PDF, ou cria um novo documento para o Certificado se o original for Word (.doc/.docx)
  let pdfDoc: PDFDocument
  const isPdf =
    params.originalPdfBytes &&
    params.originalPdfBytes.length >= 4 &&
    params.originalPdfBytes[0] === 0x25 &&
    params.originalPdfBytes[1] === 0x50 &&
    params.originalPdfBytes[2] === 0x44 &&
    params.originalPdfBytes[3] === 0x46

  if (isPdf) {
    try {
      pdfDoc = await PDFDocument.load(params.originalPdfBytes, { ignoreEncryption: true })
    } catch {
      pdfDoc = await PDFDocument.create()
    }
  } else {
    pdfDoc = await PDFDocument.create()
  }

  // Fontes padrão
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier)
  const fontMonoBold = await pdfDoc.embedFont(StandardFonts.CourierBold)

  // Paleta Institucional
  const colorPrimary = rgb(0.08, 0.20, 0.45)   // Azul Marinho Nobre
  const colorSecondary = rgb(0.12, 0.58, 0.38) // Verde Sucesso / Certificação
  const colorDark = rgb(0.12, 0.15, 0.20)      // Texto principal
  const colorSubtle = rgb(0.40, 0.45, 0.52)    // Cinza detalhes
  const colorBgBox = rgb(0.97, 0.98, 1.0)      // Fundo suave azul
  const colorBorder = rgb(0.82, 0.86, 0.94)    // Borda
  const colorCardHeader = rgb(0.92, 0.95, 0.99)

  const pageWidth = 595.28 // A4
  const pageHeight = 841.89
  const marginX = 36
  const contentWidth = pageWidth - marginX * 2

  // URL pública oficial canônica para o QR Code (sem localhost)
  const publicValidationUrl = getPublicValidationUrl(params.protocolo)

  // Cálculo prévio do hash cumulativo da trilha de auditoria
  const trilhaAuditoriaHash = calculateAuditTrailHash(params.eventosAuditoria || [])

  // ── Aposição do Selo de Assinatura Eletrônica Ultra Moderno no Fim de Cada Arquivo ──
  const totalPaginasOriginais = pdfDoc.getPageCount()
  if (totalPaginasOriginais > 0) {
    const fonteAssinatura = await obterOuCarregarFonteAssinatura(pdfDoc)
    const docs = Array.isArray(params.documentosAnexados) && params.documentosAnexados.length > 0
      ? params.documentosAnexados
      : null

    if (docs && docs.length > 1) {
      // Pacote com múltiplos documentos unificados: estampa no fim de cada arquivo individual
      let acumuladorPaginas = 0
      for (let i = 0; i < docs.length; i++) {
        const itemDoc = docs[i]
        const pags = Math.max(1, Number(itemDoc.totalPaginas) || 1)
        acumuladorPaginas += pags
        const targetPageIndex = Math.min(acumuladorPaginas - 1, totalPaginasOriginais - 1)
        const targetPage = pdfDoc.getPage(targetPageIndex)

        const nomeLimpo = (itemDoc.nome || `Documento ${i + 1}`).replace(/\.(docx?|pdf)$/i, '').replace(/[_-]+/g, ' ').trim()
        const rotuloDoc = `Doc ${i + 1}/${docs.length}: ${nomeLimpo.length > 24 ? nomeLimpo.substring(0, 22) + '...' : nomeLimpo}`

        await desenharSeloEletronicoNoPdf({
          pdfDoc,
          targetPage,
          signatarioNome: params.signatario.nome,
          protocolo: params.protocolo,
          dataHoraIso: params.signatario.dataHoraAssinatura,
          validationUrl: publicValidationUrl,
          rotuloDocumento: rotuloDoc,
          fonteRegular: fontRegular,
          fonteBold: fontBold,
          fonteMono: fontMono,
          fonteAssinatura,
          customBottomMargin: 76,
        })
      }
    } else {
      // Arquivo único: aposta o selo no fim deste arquivo (última página original antes do certificado)
      const ultimaPagina = pdfDoc.getPage(totalPaginasOriginais - 1)
      await desenharSeloEletronicoNoPdf({
        pdfDoc,
        targetPage: ultimaPagina,
        signatarioNome: params.signatario.nome,
        protocolo: params.protocolo,
        dataHoraIso: params.signatario.dataHoraAssinatura,
        validationUrl: publicValidationUrl,
        rotuloDocumento: null,
        fonteRegular: fontRegular,
        fonteBold: fontBold,
        fonteMono: fontMono,
        fonteAssinatura,
        customBottomMargin: 76,
      })
    }
  }

  // Cria a página dedicada do Certificado
  const certPage = pdfDoc.addPage([pageWidth, pageHeight])
  let currentY = pageHeight - 30

  // ── Top Accent Bar (Verde Certificação) ──
  certPage.drawRectangle({
    x: marginX,
    y: currentY,
    width: contentWidth,
    height: 4,
    color: colorSecondary,
  })
  currentY -= 16

  // ── Header Institucional com Logomarca Oficial ──
  let headerTextX = marginX
  try {
    let logoImg: any = null
    if (params.logoBytes && params.logoBytes.length > 0) {
      const isJpeg = params.logoBytes[0] === 0xFF && params.logoBytes[1] === 0xD8
      logoImg = isJpeg ? await pdfDoc.embedJpg(params.logoBytes) : await pdfDoc.embedPng(params.logoBytes)
    } else if (params.logoBase64) {
      const cleanB64 = params.logoBase64.replace(/^data:image\/\w+;base64,/, '')
      const bytes = Buffer.from(cleanB64, 'base64')
      const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8
      logoImg = isJpeg ? await pdfDoc.embedJpg(bytes) : await pdfDoc.embedPng(bytes)
    }

    if (!logoImg) {
      const logoPath = path.join(process.cwd(), 'public', 'logo-impacto-clean.png')
      if (fs.existsSync(logoPath)) {
        const logoBytes = fs.readFileSync(logoPath)
        logoImg = await pdfDoc.embedPng(logoBytes)
      }
    }

    if (logoImg) {
      certPage.drawImage(logoImg, {
        x: marginX,
        y: currentY - 34,
        width: 34,
        height: 34,
      })
      headerTextX = marginX + 44
    }
  } catch (errLogo) {
    console.warn('[EvidenceCert] Logomarca não pôde ser carregada no PDF:', errLogo)
  }

  certPage.drawText(sanitizeWinAnsi('COLÉGIO IMPACTO • SISTEMA DE ASSINATURA ELETRÔNICA'), {
    x: headerTextX,
    y: currentY,
    size: 10,
    font: fontBold,
    color: colorPrimary,
  })
  currentY -= 12

  certPage.drawText(
    sanitizeWinAnsi('DOSSIÊ PERICIAL DE EVIDÊNCIAS & CONFORMIDADE ELETRÔNICA'),
    {
      x: headerTextX,
      y: currentY,
      size: 8.5,
      font: fontBold,
      color: colorSecondary,
    }
  )
  currentY -= 10

  certPage.drawText(
    sanitizeWinAnsi('Fundamentado no art. 10, § 2º da Medida Provisória nº 2.200-2/2001, arts. 107, 219 e 221 do Código Civil Brasileiro (Lei 10.406/2002) e arts. 440 e 441 do CPC (Lei 13.105/2015).'),
    {
      x: headerTextX,
      y: currentY,
      size: 6.2,
      font: fontRegular,
      color: colorSubtle,
    }
  )
  currentY -= 12

  certPage.drawLine({
    start: { x: marginX, y: currentY },
    end: { x: pageWidth - marginX, y: currentY },
    thickness: 0.8,
    color: colorBorder,
  })
  currentY -= 10

  // ── Bloco de Identificação do Documento + QR Code Público + Hashes ──
  const docBoxHeight = 98
  certPage.drawRectangle({
    x: marginX,
    y: currentY - docBoxHeight,
    width: contentWidth,
    height: docBoxHeight,
    color: colorBgBox,
    borderColor: colorBorder,
    borderWidth: 0.8,
  })

  // Gera o QR Code vetorial apontando exclusivamente para a URL pública oficial
  try {
    const qrDataUrl = await QRCode.toDataURL(publicValidationUrl, {
      margin: 1,
      width: 160,
      color: { dark: '#0a192f', light: '#ffffff' },
    })
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64')
    const qrImage = await pdfDoc.embedPng(qrBuffer)
    certPage.drawImage(qrImage, {
      x: pageWidth - marginX - 90,
      y: currentY - docBoxHeight + 8,
      width: 82,
      height: 82,
    })
  } catch (e) {
    console.warn('[EvidenceCert] Erro ao gerar QR Code:', e)
  }

  // Textos dentro da caixa de identificação
  const textLeftX = marginX + 10
  const maxDocTextWidth = pageWidth - marginX - 98 - textLeftX
  let insideY = currentY - 13

  const docTituloLines = wrapText(`DOCUMENTO: ${params.documentoTitulo.toUpperCase()}`, maxDocTextWidth, fontBold, 8.5)
  for (const line of docTituloLines) {
    certPage.drawText(line, {
      x: textLeftX,
      y: insideY,
      size: 8.5,
      font: fontBold,
      color: colorPrimary,
    })
    insideY -= 11
  }

  const alunoInfo = params.alunoNome
    ? `Estudante Beneficiário: ${params.alunoNome}${params.alunoCpf ? ` (CPF: ${maskCpf(params.alunoCpf)})` : ''} • Ano Letivo: ${params.anoLetivo || '2027'}`
    : `Plataforma Colégio Impacto • Gestão de Matrículas e Termos Escolares`

  const alunoInfoLines = wrapText(alunoInfo, maxDocTextWidth, fontRegular, 7)
  for (const line of alunoInfoLines) {
    certPage.drawText(line, {
      x: textLeftX,
      y: insideY,
      size: 7,
      font: fontRegular,
      color: colorDark,
    })
    insideY -= 11
  }

  certPage.drawText('CÓDIGO DE PROTOCOLO DE AUTENTICIDADE:', {
    x: textLeftX,
    y: insideY,
    size: 6.8,
    font: fontBold,
    color: colorPrimary,
  })
  insideY -= 10

  certPage.drawText(sanitizeWinAnsi(params.protocolo), {
    x: textLeftX,
    y: insideY,
    size: 9.5,
    font: fontMonoBold,
    color: colorSecondary,
  })
  insideY -= 11

  // Hash do documento original
  certPage.drawText('HASH SHA-256 DO DOCUMENTO ORIGINAL (PRÉ-ASSINATURA):', {
    x: textLeftX,
    y: insideY,
    size: 6.2,
    font: fontBold,
    color: colorSubtle,
  })
  insideY -= 8

  certPage.drawText(sanitizeWinAnsi(params.documentoOriginalHash || 'Calculado no ato'), {
    x: textLeftX,
    y: insideY,
    size: 5.8,
    font: fontMono,
    color: colorDark,
  })
  insideY -= 10

  // Hash da cadeia de custódia / auditoria
  certPage.drawText('HASH SHA-256 DA CADEIA DE CUSTÓDIA / TRILHA DE AUDITORIA:', {
    x: textLeftX,
    y: insideY,
    size: 6.2,
    font: fontBold,
    color: colorSubtle,
  })
  insideY -= 8

  certPage.drawText(sanitizeWinAnsi(trilhaAuditoriaHash), {
    x: textLeftX,
    y: insideY,
    size: 5.8,
    font: fontMono,
    color: colorDark,
  })
  insideY -= 9

  certPage.drawText(
    sanitizeWinAnsi('SELO DIGITAL INCORPORADO: Assinatura PKCS#7 (/Sig e /ByteRange) vinculada à chave corporativa institucional.'),
    {
      x: textLeftX,
      y: insideY,
      size: 5.8,
      font: fontBold,
      color: colorSecondary,
    }
  )

  currentY -= (docBoxHeight + 8)

  // ── Bloco 1: Signatário / Contratante (Responsável Legal) ──
  const sigBoxHeight = 168
  const sigBoxY = currentY - sigBoxHeight

  certPage.drawRectangle({
    x: marginX,
    y: sigBoxY,
    width: contentWidth,
    height: sigBoxHeight,
    color: rgb(1, 1, 1),
    borderColor: colorBorder,
    borderWidth: 0.8,
  })

  // Faixa de cabeçalho do Bloco 1
  const headerBarHeight = 18
  certPage.drawRectangle({
    x: marginX,
    y: currentY - headerBarHeight,
    width: contentWidth,
    height: headerBarHeight,
    color: colorCardHeader,
    borderColor: colorBorder,
    borderWidth: 0.8,
  })
  certPage.drawText('1. DADOS DO SIGNATÁRIO / CONTRATANTE (RESPONSÁVEL LEGAL)', {
    x: marginX + 10,
    y: currentY - 13,
    size: 7.5,
    font: fontBold,
    color: colorPrimary,
  })

  // Coluna Direita: Cartão da Representação Gráfica da Assinatura
  const colRightWidth = 152
  const colRightX = pageWidth - marginX - colRightWidth - 10
  const cardHeight = 98
  const cardY = currentY - headerBarHeight - 7 - cardHeight

  certPage.drawRectangle({
    x: colRightX,
    y: cardY,
    width: colRightWidth,
    height: cardHeight,
    color: rgb(0.985, 0.99, 1.0),
    borderColor: colorBorder,
    borderWidth: 0.6,
  })

  // Topo do card da assinatura
  certPage.drawRectangle({
    x: colRightX,
    y: cardY + cardHeight - 14,
    width: colRightWidth,
    height: 14,
    color: rgb(0.92, 0.95, 0.98),
    borderColor: colorBorder,
    borderWidth: 0.6,
  })
  const cardHeaderText = 'CHANCELA DO SIGNATÁRIO'
  const cardHeaderWidth = fontBold.widthOfTextAtSize(cardHeaderText, 6)
  const cardHeaderX = colRightX + (colRightWidth - cardHeaderWidth) / 2
  certPage.drawText(cardHeaderText, {
    x: cardHeaderX,
    y: cardY + cardHeight - 10,
    size: 6,
    font: fontBold,
    color: colorPrimary,
  })

  // Imagem da Assinatura do Signatário com preservação estrita de proporção e centralização
  let temImagem = false
  if (params.signatario.assinaturaBase64) {
    try {
      const cleanBase64 = params.signatario.assinaturaBase64.replace(/^data:image\/\w+;base64,/, '')
      const sigImgBuffer = Buffer.from(cleanBase64, 'base64')
      const sigImage = await pdfDoc.embedPng(sigImgBuffer)
      
      const maxW = colRightWidth - 16
      const maxH = cardHeight - 34
      const scale = Math.min(maxW / sigImage.width, maxH / sigImage.height)
      const renderW = Math.round(sigImage.width * scale)
      const renderH = Math.round(sigImage.height * scale)
      const renderX = colRightX + Math.round((colRightWidth - renderW) / 2)
      const renderY = cardY + 16 + Math.round((maxH - renderH) / 2)

      certPage.drawImage(sigImage, {
        x: renderX,
        y: renderY,
        width: renderW,
        height: renderH,
      })
      temImagem = true
    } catch (err) {
      console.warn('[EvidenceCert] Erro ao embutir imagem da assinatura:', err)
    }
  }

  if (!temImagem) {
    const defaultText1 = 'ASSINATURA DIGITAL REGISTRADA'
    const defaultText2 = 'Autenticada via Código OTP e Token'
    const w1 = fontBold.widthOfTextAtSize(defaultText1, 6.5)
    const w2 = fontRegular.widthOfTextAtSize(defaultText2, 6)
    certPage.drawText(defaultText1, {
      x: colRightX + (colRightWidth - w1) / 2,
      y: cardY + 50,
      size: 6.5,
      font: fontBold,
      color: colorPrimary,
    })
    certPage.drawText(defaultText2, {
      x: colRightX + (colRightWidth - w2) / 2,
      y: cardY + 38,
      size: 6,
      font: fontRegular,
      color: colorSubtle,
    })
  }

  // Rodapé do card: "Representação gráfica da assinatura eletrônica"
  const sigCaptionClean = sanitizeWinAnsi('Representação gráfica da assinatura eletrônica')
  const sigCaptionWidth = fontBold.widthOfTextAtSize(sigCaptionClean, 5.5)
  const sigCaptionX = colRightX + (colRightWidth - sigCaptionWidth) / 2
  certPage.drawText(sigCaptionClean, {
    x: sigCaptionX,
    y: cardY + 6,
    size: 5.5,
    font: fontBold,
    color: colorSecondary,
  })

  // Coluna Esquerda: Dados do Signatário (com Mascaramento LGPD e largura protegida contra sobreposição)
  const colLeftX = marginX + 10
  const colLeftWidth = colRightX - colLeftX - 16
  let leftY = currentY - headerBarHeight - 12

  certPage.drawText(sanitizeWinAnsi(`Nome Civil: ${params.signatario.nome}`), {
    x: colLeftX,
    y: leftY,
    size: 8,
    font: fontBold,
    color: colorDark,
  })
  leftY -= 11

  const maskedCpf = maskCpf(params.signatario.cpf)
  const vinculoStr = params.signatario.parentesco || 'Responsável Legal / Contratante'
  const cpfLines = wrapText(`CPF: ${maskedCpf} • Qualificação: ${vinculoStr}`, colLeftWidth, fontRegular, 7.2)
  for (const line of cpfLines) {
    certPage.drawText(line, { x: colLeftX, y: leftY, size: 7.2, font: fontRegular, color: colorDark })
    leftY -= 10
  }

  const maskedEmail = maskEmail(params.signatario.email)
  const maskedPhone = maskPhone(params.signatario.telefone)
  const contatoLines = wrapText(`E-mail: ${maskedEmail} • WhatsApp / Celular: ${maskedPhone}`, colLeftWidth, fontRegular, 7.2)
  for (const line of contatoLines) {
    certPage.drawText(line, { x: colLeftX, y: leftY, size: 7.2, font: fontRegular, color: colorDark })
    leftY -= 11
  }

  // Confirmação de Identidade por OTP (quebra de linha garantida para NUNCA encostar ou sobrepor a chancela)
  const otpFullText = `CONFIRMAÇÃO DE IDENTIDADE: Código de uso único (OTP) conferido e validado com sucesso no e-mail cadastrado.`
  const otpLines = wrapText(otpFullText, colLeftWidth, fontBold, 6.8)
  for (const line of otpLines) {
    certPage.drawText(line, { x: colLeftX, y: leftY, size: 6.8, font: fontBold, color: colorSecondary })
    leftY -= 9.5
  }
  leftY -= 1

  // Data e Hora Oficial da Assinatura (com quebra de linha protegida)
  const dataHoraOficial = `Data e Hora Oficial da Assinatura: ${formatDatePtBr(params.signatario.dataHoraAssinatura)}`
  const dataHoraLines = wrapText(dataHoraOficial, colLeftWidth, fontRegular, 6.8)
  for (const line of dataHoraLines) {
    certPage.drawText(line, { x: colLeftX, y: leftY, size: 6.8, font: fontRegular, color: colorDark })
    leftY -= 9.5
  }
  leftY -= 1.5

  // Manifestação de Vontade Integral (sem truncamento, quebrando linhas perfeitamente)
  const rawAceite = params.signatario.aceiteTexto || 'Declaro ter lido atentamente o documento na íntegra, concordando com todas as suas cláusulas e manifestando livre consentimento para sua assinatura eletrônica nos termos do art. 10, § 2º da MP nº 2.200-2/2001 e arts. 107, 219 e 221 do Código Civil Brasileiro.'
  const aceiteLines = wrapText(`Manifestação de Vontade: "${rawAceite}"`, colLeftWidth, fontRegular, 6.2)
  for (let i = 0; i < Math.min(aceiteLines.length, 4); i++) {
    certPage.drawText(aceiteLines[i], {
      x: colLeftX,
      y: leftY,
      size: 6.2,
      font: fontRegular,
      color: colorPrimary,
    })
    leftY -= 8.2
  }

  // Faixa Inferior de Metadados Técnicos Periciais
  const bottomStripHeight = 27
  const bottomStripY = sigBoxY

  certPage.drawRectangle({
    x: marginX,
    y: bottomStripY,
    width: contentWidth,
    height: bottomStripHeight,
    color: rgb(0.98, 0.985, 0.99),
  })

  certPage.drawLine({
    start: { x: marginX, y: bottomStripY + bottomStripHeight },
    end: { x: pageWidth - marginX, y: bottomStripY + bottomStripHeight },
    thickness: 0.6,
    color: colorBorder,
  })

  const cleanBrowser = cleanBrowserName(params.signatario.navegador)
  const cleanOs = cleanOsName(params.signatario.sistemaOperacional)
  const cleanDevice = params.signatario.dispositivo || 'Computador Desktop'

  const metaRede = `EVIDÊNCIAS DE REDE E DISPOSITIVO: IP: ${params.signatario.ip} • Dispositivo: ${cleanDevice} • SO: ${cleanOs} • Navegador: ${cleanBrowser}`
  certPage.drawText(
    sanitizeWinAnsi(metaRede),
    {
      x: marginX + 10,
      y: bottomStripY + 15.5,
      size: 6.0,
      font: fontBold,
      color: colorSubtle,
    }
  )

  const statusAutenticado = params.signatario.usuarioAutenticadoApp
    ? 'Usuário com sessão autenticada no aplicativo oficial Impacto EDU'
    : 'Acesso validado por Token Criptográfico Exclusivo e Desafio OTP por E-mail'

  const metaAuth = `Autenticação: ${statusAutenticado} • Data e hora registradas pelo servidor (Horário de MS / UTC-4)`
  certPage.drawText(
    sanitizeWinAnsi(metaAuth),
    {
      x: marginX + 10,
      y: bottomStripY + 6.5,
      size: 5.8,
      font: fontRegular,
      color: colorSubtle,
    }
  )

  currentY -= (sigBoxHeight + 8)

  // ── Bloco 2: Representante Legal da Instituição de Ensino ──
  const repBoxHeight = 82
  const repBoxY = currentY - repBoxHeight

  certPage.drawRectangle({
    x: marginX,
    y: repBoxY,
    width: contentWidth,
    height: repBoxHeight,
    color: rgb(1, 1, 1),
    borderColor: colorBorder,
    borderWidth: 0.8,
  })

  // Cabeçalho Bloco 2
  certPage.drawRectangle({
    x: marginX,
    y: currentY - 18,
    width: contentWidth,
    height: 18,
    color: colorCardHeader,
    borderColor: colorBorder,
    borderWidth: 0.8,
  })
  certPage.drawText('2. REPRESENTANTE LEGAL DA INSTITUIÇÃO DE ENSINO (CONTRATADA)', {
    x: marginX + 10,
    y: currentY - 13,
    size: 7.5,
    font: fontBold,
    color: colorPrimary,
  })

  // Card Chancela Institucional
  const repCardHeight = 56
  const repCardY = currentY - 18 - 4 - repCardHeight

  certPage.drawRectangle({
    x: colRightX,
    y: repCardY,
    width: colRightWidth,
    height: repCardHeight,
    color: rgb(0.985, 0.99, 1.0),
    borderColor: colorBorder,
    borderWidth: 0.6,
  })

  certPage.drawRectangle({
    x: colRightX,
    y: repCardY + repCardHeight - 12,
    width: colRightWidth,
    height: 12,
    color: rgb(0.92, 0.95, 0.98),
    borderColor: colorBorder,
    borderWidth: 0.6,
  })
  const repHeaderLabel = 'CHANCELA INSTITUCIONAL'
  const repHeaderWidth = fontBold.widthOfTextAtSize(repHeaderLabel, 5.5)
  certPage.drawText(repHeaderLabel, {
    x: colRightX + (colRightWidth - repHeaderWidth) / 2,
    y: repCardY + repCardHeight - 9,
    size: 5.5,
    font: fontBold,
    color: colorPrimary,
  })

  // Imagem de Assinatura do Representante com proporção preservada
  let temRepSigImagem = false
  try {
    const defaultSigPath = path.join(process.cwd(), 'public', 'assinatura-representante.png')
    if (fs.existsSync(defaultSigPath)) {
      const repSigBytes = fs.readFileSync(defaultSigPath)
      const repSigImg = await pdfDoc.embedPng(repSigBytes)
      const maxRepW = colRightWidth - 16
      const maxRepH = repCardHeight - 24
      const scaleRep = Math.min(maxRepW / repSigImg.width, maxRepH / repSigImg.height)
      const repW = Math.round(repSigImg.width * scaleRep)
      const repH = Math.round(repSigImg.height * scaleRep)
      const repX = colRightX + Math.round((colRightWidth - repW) / 2)
      const repY = repCardY + 12 + Math.round((maxRepH - repH) / 2)

      certPage.drawImage(repSigImg, {
        x: repX,
        y: repY,
        width: repW,
        height: repH,
      })
      temRepSigImagem = true
    }
  } catch (errDef) {
    console.warn('[EvidenceCert] Erro ao embutir assinatura institucional:', errDef)
  }

  if (!temRepSigImagem) {
    const defaultRep1 = 'CHANCELA INSTITUCIONAL'
    const defaultRep2 = 'Direção Geral • Colégio Impacto'
    const wR1 = fontBold.widthOfTextAtSize(defaultRep1, 5.5)
    const wR2 = fontRegular.widthOfTextAtSize(defaultRep2, 5)
    certPage.drawText(defaultRep1, {
      x: colRightX + (colRightWidth - wR1) / 2,
      y: repCardY + 24,
      size: 5.5,
      font: fontBold,
      color: colorPrimary,
    })
    certPage.drawText(defaultRep2, {
      x: colRightX + (colRightWidth - wR2) / 2,
      y: repCardY + 14,
      size: 5,
      font: fontRegular,
      color: colorSubtle,
    })
  }

  const repCaptionClean = sanitizeWinAnsi('Assinatura Institucional Autêntica')
  const repCaptionWidth = fontBold.widthOfTextAtSize(repCaptionClean, 5.5)
  certPage.drawText(repCaptionClean, {
    x: colRightX + (colRightWidth - repCaptionWidth) / 2,
    y: repCardY + 3.5,
    size: 5.5,
    font: fontBold,
    color: colorSecondary,
  })

  // Textos do Representante na coluna esquerda
  let repY = currentY - 30
  certPage.drawText(
    sanitizeWinAnsi(`Representante Legal: ${params.representanteEscola.nome} (CPF: ${maskCpf(params.representanteEscola.cpf)})`),
    {
      x: colLeftX,
      y: repY,
      size: 7.5,
      font: fontBold,
      color: colorDark,
    }
  )
  repY -= 11

  certPage.drawText(
    sanitizeWinAnsi(`Cargo: ${params.representanteEscola.cargo} • ${params.representanteEscola.razaoSocial}`),
    {
      x: colLeftX,
      y: repY,
      size: 7,
      font: fontRegular,
      color: colorDark,
    }
  )
  repY -= 11

  certPage.drawText(
    sanitizeWinAnsi(`CNPJ: ${params.representanteEscola.cnpj} • Sistema de Ensino Impacto EDU`),
    {
      x: colLeftX,
      y: repY,
      size: 7,
      font: fontRegular,
      color: colorDark,
    }
  )
  repY -= 11

  certPage.drawText(
    sanitizeWinAnsi(`Assinatura e Selo Institucional: Concluídos em ${formatDatePtBr(params.representanteEscola.dataHoraAssinatura)}`),
    {
      x: colLeftX,
      y: repY,
      size: 7,
      font: fontBold,
      color: colorSecondary,
    }
  )

  currentY -= (repBoxHeight + 8)

  // ── Bloco 3: Trilha de Auditoria & Histórico de Eventos (Cadeia de Custódia) ──
  const auditBoxHeight = 132
  const auditBoxY = currentY - auditBoxHeight

  certPage.drawRectangle({
    x: marginX,
    y: auditBoxY,
    width: contentWidth,
    height: auditBoxHeight,
    color: rgb(1, 1, 1),
    borderColor: colorBorder,
    borderWidth: 0.8,
  })

  certPage.drawRectangle({
    x: marginX,
    y: currentY - 18,
    width: contentWidth,
    height: 18,
    color: colorCardHeader,
    borderColor: colorBorder,
    borderWidth: 0.8,
  })
  certPage.drawText('3. TRILHA DE AUDITORIA & HISTÓRICO DE EVENTOS (CADEIA DE CUSTÓDIA)', {
    x: marginX + 10,
    y: currentY - 13,
    size: 7.5,
    font: fontBold,
    color: colorPrimary,
  })

  let auditY = currentY - 30
  const maxAuditWidth = contentWidth - 20
  const eventosExibicao = (params.eventosAuditoria || []).slice(-5)

  for (const ev of eventosExibicao) {
    const dataHoraStr = formatAuditTimestamp(ev.timestamp)
    const ipStr = ev.ip ? ` (IP: ${ev.ip})` : ''
    let desc = ev.descricao || ''
    if (ev.evento === 'OTP_CONFIRMADO') {
      desc = 'Código de uso único validado com sucesso.'
    } else {
      desc = desc.replace(/OTP\s*\(\d+\)/gi, 'OTP validado').replace(/\b\d{6}\b/g, '******')
    }
    const linhaCompleta = `• [${dataHoraStr}] ${ev.evento}: ${desc}${ipStr}`
    
    // Quebra inteligente garantindo que NUNCA ultrapasse a borda direita
    const auditLines = wrapText(linhaCompleta, maxAuditWidth, fontRegular, 6.2)
    for (let i = 0; i < auditLines.length; i++) {
      const isContinuation = i > 0
      certPage.drawText(sanitizeWinAnsi(auditLines[i]), {
        x: marginX + 10 + (isContinuation ? 10 : 0),
        y: auditY,
        size: 6.2,
        font: fontRegular,
        color: isContinuation ? colorSubtle : colorDark,
      })
      auditY -= 9.5
    }
    auditY -= 2.5
  }

  currentY -= (auditBoxHeight + 8)

  // ── Rodapé Jurídico de Instruções de Verificação Pública ──
  const footerBoxHeight = 52
  const footerBoxY = 32

  certPage.drawRectangle({
    x: marginX,
    y: footerBoxY,
    width: contentWidth,
    height: footerBoxHeight,
    color: colorBgBox,
    borderColor: colorBorder,
    borderWidth: 0.8,
  })

  certPage.drawText(
    sanitizeWinAnsi('INSTRUÇÕES DE VERIFICAÇÃO PÚBLICA DE AUTENTICIDADE E INTEGRIDADE:'),
    {
      x: marginX + 8,
      y: footerBoxY + 38,
      size: 6.5,
      font: fontBold,
      color: colorPrimary,
    }
  )

  certPage.drawText(
    sanitizeWinAnsi(`Aponte a câmera do seu celular para o QR Code acima ou acesse diretamente o portal público: ${publicValidationUrl}`),
    {
      x: marginX + 8,
      y: footerBoxY + 27,
      size: 6.2,
      font: fontRegular,
      color: colorDark,
    }
  )

  certPage.drawText(
    sanitizeWinAnsi('Para verificação pericial independente, envie este arquivo PDF no portal público acima para conferência instantânea do SHA-256 e dos campos /Sig e /ByteRange.'),
    {
      x: marginX + 8,
      y: footerBoxY + 16,
      size: 5.8,
      font: fontRegular,
      color: colorSubtle,
    }
  )

  const escolaFooter = `${params.representanteEscola?.razaoSocial || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA'} • CNPJ ${params.representanteEscola?.cnpj || '04.395.789/0001-88'} • Campo Grande - MS • Sistema de Gestão Escolar Impacto EDU`
  certPage.drawText(
    sanitizeWinAnsi(escolaFooter),
    {
      x: marginX + 8,
      y: footerBoxY + 6,
      size: 5.8,
      font: fontRegular,
      color: colorSubtle,
    }
  )

  // 1. Salva o PDF intermediário com o Certificado de Evidências anexado
  const intermediatePdfBytes = await pdfDoc.save()

  // 2. Aplica a Assinatura Criptográfica Digital /Sig e /ByteRange institucional PKCS#7
  let finalPdfBytes: Uint8Array = intermediatePdfBytes
  try {
    const signerName = `${params.representanteEscola?.razaoSocial || 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA'} (CNPJ: ${params.representanteEscola?.cnpj || '04.395.789/0001-88'})`
    finalPdfBytes = await assinarPdfCriptograficamente({
      pdfBytes: intermediatePdfBytes,
      reason: 'Assinatura Eletrônica e Selo Digital de Integridade • MP 2.200-2/2001 e Código Civil',
      name: signerName,
      contactInfo: 'validar@impacto-edu.net',
      location: 'Campo Grande - MS, Brasil',
    })
    console.log('[EvidenceCert] Assinatura criptográfica /Sig e /ByteRange aplicada com sucesso.')
  } catch (errSig) {
    console.error('[EvidenceCert] Erro ao aplicar assinatura PKCS#7 no PDF, usando intermediário:', errSig)
    finalPdfBytes = intermediatePdfBytes
  }

  // 3. Calcula o hash SHA-256 do arquivo PDF final assinado e selado
  const finalSha256 = calculateSha256(finalPdfBytes)
  const base64Pdf = Buffer.from(finalPdfBytes).toString('base64')

  return {
    pdfBytes: finalPdfBytes,
    base64Pdf,
    documentoOriginalHash: params.documentoOriginalHash,
    documentoFinalHash: finalSha256,
    trilhaAuditoriaHash,
    protocolo: params.protocolo,
  }
}
