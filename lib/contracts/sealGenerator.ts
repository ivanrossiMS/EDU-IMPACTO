/**
 * lib/contracts/sealGenerator.ts
 *
 * Módulo de Geração e Aposição do Selo de Assinatura Eletrônica Ultra Moderno.
 * Estampa o selo criptográfico com QR Code, nome abreviado inteligente ("Ivan R.S"),
 * chancela "assinado eletronicamente" e metadados de integridade no fim de cada arquivo.
 */

import { PDFDocument, PDFPage, PDFFont, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import QRCode from 'qrcode'
import fs from 'fs'
import path from 'path'
import {
  formatAbbreviatedSignerName,
  formatTimestampSelo,
  sanitizeWinAnsi,
} from './sealUtils'

export {
  formatAbbreviatedSignerName,
  formatTimestampSelo,
  sanitizeWinAnsi,
}

let cachedSignatureFontBytes: Buffer | null = null

/**
 * Carrega e embute a fonte caligráfica de assinatura (Dancing Script TTF) no documento PDF.
 * Possui fallback gracioso para Times-BoldItalic caso o arquivo não esteja acessível.
 */
export async function obterOuCarregarFonteAssinatura(pdfDoc: PDFDocument): Promise<PDFFont> {
  try {
    pdfDoc.registerFontkit(fontkit)
    if (!cachedSignatureFontBytes) {
      const candidatePaths = [
        path.join(process.cwd(), 'lib/contracts/fonts/DancingScript-Bold.ttf'),
        path.join(process.cwd(), 'public/fonts/DancingScript-Bold.ttf'),
        path.join(__dirname, 'fonts/DancingScript-Bold.ttf'),
      ]
      for (const p of candidatePaths) {
        if (fs.existsSync(p)) {
          cachedSignatureFontBytes = fs.readFileSync(p)
          break
        }
      }
    }
    if (cachedSignatureFontBytes) {
      return await pdfDoc.embedFont(cachedSignatureFontBytes)
    }
  } catch (err) {
    console.warn('[sealGenerator] Aviso ao carregar fonte cursiva TTF, usando Times-BoldItalic:', err)
  }
  return await pdfDoc.embedFont('Times-BoldItalic')
}

export interface SeloEletronicoParams {
  pdfDoc: PDFDocument
  targetPage: PDFPage
  signatarioNome: string
  protocolo: string
  dataHoraIso?: string
  validationUrl: string
  rotuloDocumento?: string | null
  fonteRegular: PDFFont
  fonteBold: PDFFont
  fonteMono?: PDFFont
  fonteAssinatura?: PDFFont
  customBottomMargin?: number
  customRightMargin?: number
}

/**
 * Estampa um selo ultra moderno diretamente na página do PDF.
 * Inclui micro QR Code pericial de alta precisão, nome em fonte de assinatura, chancela oficial
 * e metadados de autenticidade protegidos por bordas refinadas.
 *
 * A margem inferior padrão é elevada (76pt) para flutuar harmoniosamente acima de rodapés escolares.
 */
export async function desenharSeloEletronicoNoPdf(
  params: SeloEletronicoParams
): Promise<void> {
  const {
    pdfDoc,
    targetPage,
    signatarioNome,
    protocolo,
    dataHoraIso,
    validationUrl,
    rotuloDocumento,
    fonteRegular,
    fonteBold,
    customBottomMargin = 76, // Elevado para não sobrepor o rodapé do documento
    customRightMargin = 24,
  } = params

  const { width: pageWidth, height: pageHeight } = targetPage.getSize()

  // Dimensões do Selo Ultra Moderno
  const sealWidth = 228
  const sealHeight = 56
  const marginX = Math.max(16, customRightMargin)
  const marginY = Math.max(16, customBottomMargin)

  // Coordenadas ancoradas no canto inferior direito, acima do rodapé
  const sealX = Math.max(16, pageWidth - sealWidth - marginX)
  const sealY = marginY

  // Cores da paleta Ultra Moderna
  const colorCardBg = rgb(0.975, 0.985, 0.995)   // Fundo gelo refinado
  const colorBorder = rgb(0.80, 0.85, 0.92)       // Borda sutil
  const colorAccentBar = rgb(0.06, 0.72, 0.51)   // Barra esmeralda de integridade (#10b981)
  const colorDark = rgb(0.06, 0.12, 0.24)         // Navy profundo (#0f172a)
  const colorEmerald = rgb(0.02, 0.58, 0.38)      // Esmeralda vibrante (#059669)
  const colorSubtle = rgb(0.38, 0.44, 0.52)       // Cinza ardósia (#64748b)
  const colorMicro = rgb(0.52, 0.58, 0.66)        // Cinza micro

  // 1. Fundo do Card
  targetPage.drawRectangle({
    x: sealX,
    y: sealY,
    width: sealWidth,
    height: sealHeight,
    color: colorCardBg,
    borderColor: colorBorder,
    borderWidth: 0.8,
  })

  // 2. Barra vertical esquerda esmeralda de integridade pericial
  targetPage.drawRectangle({
    x: sealX,
    y: sealY,
    width: 3.5,
    height: sealHeight,
    color: colorAccentBar,
  })

  // 3. Geração e estampagem do Micro QR Code Pericial de alta fidelidade
  const qrSize = 44
  const qrX = sealX + 9
  const qrY = sealY + (sealHeight - qrSize) / 2

  try {
    const qrDataUrl = await QRCode.toDataURL(validationUrl, {
      width: 140,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
    const qrCleanBase64 = qrDataUrl.replace(/^data:image\/png;base64,/, '')
    const qrBytes = Buffer.from(qrCleanBase64, 'base64')
    const qrImage = await pdfDoc.embedPng(qrBytes)

    targetPage.drawImage(qrImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    })
  } catch (errQr) {
    console.warn('[sealGenerator] Erro ao desenhar micro QR Code no selo:', errQr)
  }

  // 4. Renderização Tipográfica do Selo
  const textStartX = qrX + qrSize + 8
  const maxTextWidth = sealWidth - (textStartX - sealX) - 8

  // Linha 1: Micro Header Institucional / Criptográfico
  const headerText = sanitizeWinAnsi('CHANCELA DE ASSINATURA ELETRÔNICA')
  targetPage.drawText(headerText, {
    x: textStartX,
    y: sealY + 45,
    size: 5.2,
    font: fonteBold,
    color: colorSubtle,
  })

  // Linha 2: Nome do Signatário com Fonte Caligráfica de Assinatura (ex: Ivan R.)
  const fontAssinatura = params.fonteAssinatura || (await obterOuCarregarFonteAssinatura(pdfDoc))
  const nomeAbreviado = sanitizeWinAnsi(formatAbbreviatedSignerName(signatarioNome))
  let nomeFontSize = 14
  while (fontAssinatura.widthOfTextAtSize(nomeAbreviado, nomeFontSize) > maxTextWidth && nomeFontSize > 9) {
    nomeFontSize -= 0.5
  }

  targetPage.drawText(nomeAbreviado, {
    x: textStartX,
    y: sealY + 33,
    size: nomeFontSize,
    font: fontAssinatura,
    color: colorDark,
  })

  // Linha 3: Rótulo Oficial Requisitado "assinado eletronicamente"
  const rotuloAssinado = sanitizeWinAnsi('assinado eletronicamente')
  targetPage.drawText(rotuloAssinado, {
    x: textStartX,
    y: sealY + 23.5,
    size: 7.2,
    font: fonteBold,
    color: colorEmerald,
  })

  // Linha 4: Data/Hora e Protocolo
  const timestampStr = formatTimestampSelo(dataHoraIso)
  const metaLinha = sanitizeWinAnsi(`${timestampStr} | Prot: ${protocolo}`)
  targetPage.drawText(metaLinha, {
    x: textStartX,
    y: sealY + 14,
    size: 5.4,
    font: fonteRegular,
    color: colorSubtle,
  })

  // Linha 5: Rótulo do Documento ou Validação Pública
  const rotuloLinha5 = rotuloDocumento
    ? sanitizeWinAnsi(`${rotuloDocumento} | Validação via QR Code`)
    : sanitizeWinAnsi('Validação jurídica pericial via QR Code')
  targetPage.drawText(rotuloLinha5, {
    x: textStartX,
    y: sealY + 6,
    size: 4.8,
    font: fonteRegular,
    color: colorMicro,
  })
}
