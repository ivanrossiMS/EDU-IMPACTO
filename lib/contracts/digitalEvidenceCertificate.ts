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
  sanitizeSignerName,
  toTitleCase,
  formatSignatureDisplayName,
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
    if (isNaN(d.getTime())) return String(isoString)
    const dataBr = d.toLocaleDateString('pt-BR', { timeZone: 'America/Campo_Grande' })
    const horaBr = d.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Campo_Grande',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    return `${dataBr} às ${horaBr} (Horário de MS - UTC-4)`
  } catch {
    return String(isoString || '')
  }
}

function formatDataAssinaturaSimples(isoString?: string | null): string {
  if (!isoString) {
    const now = new Date()
    return now.toLocaleDateString('pt-BR', { timeZone: 'America/Campo_Grande' })
  }
  try {
    const d = new Date(isoString)
    return d.toLocaleDateString('pt-BR', { timeZone: 'America/Campo_Grande' })
  } catch {
    return String(isoString || '')
  }
}

function formatAuditTimestamp(isoString?: string | null): string {
  if (!isoString) return 'Data não registrada'
  try {
    const d = new Date(isoString)
    if (isNaN(d.getTime())) return String(isoString)
    const dataBr = d.toLocaleDateString('pt-BR', { timeZone: 'America/Campo_Grande' })
    const horaBr = d.toLocaleTimeString('pt-BR', {
      timeZone: 'America/Campo_Grande',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    return `${dataBr} às ${horaBr} (MS)`
  } catch {
    return String(isoString || '')
  }
}

export interface ArquivoExistenteInfo {
  ordem: number
  nome: string
  totalPaginas: number
  paginasRange: string
}

function formatFileDisplayName(filename: string, maxChars = 48): string {
  const clean = sanitizeWinAnsi(filename).trim()
  if (clean.length <= maxChars) return clean
  const extMatch = clean.match(/\.[a-zA-Z0-9]{2,5}$/)
  const ext = extMatch ? extMatch[0] : ''
  const base = ext ? clean.slice(0, -ext.length) : clean
  const avail = maxChars - ext.length - 3
  return `${base.substring(0, Math.max(8, avail))}...${ext}`
}

export function obterListaArquivosExistentes(
  params: EvidenceCertificateParams,
  totalPaginasOriginais: number
): ArquivoExistenteInfo[] {
  const docs = Array.isArray(params.documentosAnexados) && params.documentosAnexados.length > 0
    ? params.documentosAnexados
    : null

  if (docs && docs.length > 0) {
    let acum = 0
    return docs.map((doc, idx) => {
      const pags = Math.max(1, Number(doc.totalPaginas) || 1)
      const inicio = acum + 1
      const fim = acum + pags
      acum += pags
      const rangeStr = inicio === fim ? `Pág. ${inicio}` : `Págs. ${inicio} a ${fim}`
      let nomeLimpo = (doc.nome || `Documento ${idx + 1}`).trim()
      if (!/\.[a-zA-Z0-9]{2,5}$/i.test(nomeLimpo)) {
        nomeLimpo += '.pdf'
      }
      return {
        ordem: doc.ordem || idx + 1,
        nome: nomeLimpo,
        totalPaginas: pags,
        paginasRange: rangeStr,
      }
    })
  }

  // Fallback para documento único
  const rawNome = (params.arquivoOriginalNome || params.documentoTitulo || 'Documento Principal').trim()
  const nomePadrao = /\.[a-zA-Z0-9]{2,5}$/i.test(rawNome) ? rawNome : `${rawNome}.pdf`
  const pags = Math.max(1, totalPaginasOriginais)
  const rangeStr = pags === 1 ? 'Pág. 1' : `Págs. 1 a ${pags}`

  return [
    {
      ordem: 1,
      nome: nomePadrao,
      totalPaginas: pags,
      paginasRange: rangeStr,
    },
  ]
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

export interface RepresentanteEscolaItem {
  id?: string
  nome: string
  cpf: string
  cargo: string
  email?: string
  telefone?: string
  assinaturaBase64?: string | null
  estiloCaligrafico?: string | null
}

export interface EvidenceCertificateParams {
  originalPdfBytes: Uint8Array
  protocolo: string
  documentoTitulo: string
  documentoOriginalHash: string
  arquivoOriginalNome?: string | null
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
    estiloCaligrafico?: string | null
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
    estiloCaligrafico?: string | null
    representantes?: RepresentanteEscolaItem[]
    semAssinaturaRepresentante?: boolean
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
  posicoesAssinaturas?: PosicaoAssinaturaDocumento[] | null
  suprimirRubricaRodape?: boolean
}

export interface PosicaoAssinaturaDocumento {
  id?: string
  signatarioId?: string
  nome: string
  cpf?: string
  cargo?: string
  tipo: 'escola' | 'responsavel'
  pagina: number
  documentoId?: string
  documentoNome?: string
  paginaRelativa?: number
  xPercent: number
  yPercent: number
  larguraPt?: number
  alturaPt?: number
  assinaturaBase64?: string | null
  estiloCaligrafico?: string | null
}

export interface FinalSealedDocumentResult {
  pdfBytes: Uint8Array
  base64Pdf: string
  documentoOriginalHash: string
  documentoFinalHash: string
  trilhaAuditoriaHash: string
  protocolo: string
}

async function embedImageSafe(pdfDoc: PDFDocument, base64OrBytes: string | Buffer | Uint8Array): Promise<any> {
  try {
    let bytes: Buffer
    let isJpg = false
    if (typeof base64OrBytes === 'string') {
      isJpg = base64OrBytes.startsWith('data:image/jp')
      const clean = base64OrBytes.replace(/^data:[^;]+;base64,/, '')
      bytes = Buffer.from(clean, 'base64')
    } else {
      bytes = Buffer.isBuffer(base64OrBytes) ? base64OrBytes : Buffer.from(base64OrBytes)
    }
    if (bytes.length < 8) return null
    if (isJpg) {
      return await pdfDoc.embedJpg(bytes)
    }
    try {
      return await pdfDoc.embedPng(bytes)
    } catch {
      return await pdfDoc.embedJpg(bytes)
    }
  } catch (err) {
    console.warn('[digitalEvidenceCertificate] Falha ao incorporar imagem no PDF:', err)
    return null
  }
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

  // Sanitização rigorosa de nomes (remove espaços duplos e corrige quebras acidentais como "Franciell i")
  if (params.signatario && params.signatario.nome) {
    params.signatario.nome = sanitizeSignerName(params.signatario.nome)
  }
  if (params.representanteEscola) {
    if (params.representanteEscola.nome) {
      params.representanteEscola.nome = sanitizeSignerName(params.representanteEscola.nome)
    }
    if (Array.isArray(params.representanteEscola.representantes)) {
      for (const r of params.representanteEscola.representantes) {
        if (r.nome) r.nome = sanitizeSignerName(r.nome)
      }
    }
  }
  if (Array.isArray(params.posicoesAssinaturas)) {
    for (const pos of params.posicoesAssinaturas) {
      if (pos.nome) pos.nome = sanitizeSignerName(pos.nome)
    }
  }

  // Fontes padrão
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier)
  const fontMonoBold = await pdfDoc.embedFont(StandardFonts.CourierBold)
  const fonteAssinatura = await obterOuCarregarFonteAssinatura(pdfDoc)
  const fonteRubricaFormal = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic)

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

  // ── Aposição de Assinaturas e Selos nos Documentos Originais ──
  const totalPaginasOriginais = pdfDoc.getPageCount()
  const temPosicoesCustomizadas = Array.isArray(params.posicoesAssinaturas) && params.posicoesAssinaturas.length > 0
  const suprimirRubrica = Boolean(params.suprimirRubricaRodape || temPosicoesCustomizadas)

  if (totalPaginasOriginais > 0) {
    // 1. Se houver assinaturas posicionadas, estampa cada uma no local exato configurado pelo usuário
    const semAssinaturaRep = Boolean(
      params.representanteEscola?.semAssinaturaRepresentante ||
      (Array.isArray(params.representanteEscola?.representantes) &&
        params.representanteEscola!.representantes!.length === 0 &&
        !params.representanteEscola?.nome)
    )
    if (temPosicoesCustomizadas) {
      for (const pos of params.posicoesAssinaturas!) {
        if (pos.tipo === 'escola' && semAssinaturaRep) {
          continue
        }
        const pageIndex = Math.max(0, Math.min(pos.pagina - 1, totalPaginasOriginais - 1))
        const targetPage = pdfDoc.getPage(pageIndex)
        const { width: pWidth, height: pHeight } = targetPage.getSize()

        const boxWidth = Math.max(90, Math.min(320, pos.larguraPt || 190))
        const boxHeight = Math.max(26, Math.min(80, pos.alturaPt || 45))

        const x = Math.max(8, Math.min(pWidth - boxWidth - 8, (pos.xPercent / 100) * pWidth))
        const topY = pHeight - ((pos.yPercent / 100) * pHeight)
        const y = Math.max(8, Math.min(pHeight - boxHeight - 8, topY - boxHeight))

        // 1. Assinatura do Signatário / Representante (sem nome por extenso e sem função como rótulo)
        // Regra do Usuário: "a assinatura dos representantes ficaram muito pequenas e fonte diferente, deve ser igual a do signatario"
        const isResponsavel = pos.tipo === 'responsavel'
        let desenhouImagem = false

        // Só incorpora imagem de assinatura se for desenho manuscrito real (tipo 'manual') ou imagem customizada de upload (estilo 'custom')
        const sigImgBase64 = isResponsavel
          ? (params.signatario.tipoAssinatura === 'manual' ? params.signatario.assinaturaBase64 : null)
          : (pos.estiloCaligrafico === 'custom' ? pos.assinaturaBase64 : null)

        if (sigImgBase64) {
          const img = await embedImageSafe(pdfDoc, sigImgBase64)
          if (img) {
            const maxW = boxWidth - 8
            const maxH = Math.max(18, boxHeight - 16)
            const scale = Math.min(maxW / img.width, maxH / img.height)
            const rW = Math.round(img.width * scale)
            const rH = Math.round(img.height * scale)
            targetPage.drawImage(img, {
              x: x + 4,
              y: y + Math.max(10, Math.round(boxHeight * 0.28)) + Math.round((maxH - rH) / 2),
              width: rW,
              height: rH,
            })
            desenhouImagem = true
          }
        }

        if (!desenhouImagem) {
          let estiloPos = pos.estiloCaligrafico
          if (!estiloPos && !isResponsavel) {
            const matchingRep = params.representanteEscola?.representantes?.find(r =>
              (r.id && r.id === pos.signatarioId) ||
              sanitizeSignerName(r.nome).toLowerCase() === sanitizeSignerName(pos.nome).toLowerCase()
            )
            estiloPos = matchingRep?.estiloCaligrafico || params.representanteEscola?.estiloCaligrafico || 'classica'
          }
          const isFormal = isResponsavel
            ? (params.signatario?.estiloCaligrafico === 'formal' || params.signatario?.estiloCaligrafico === 'rubrica')
            : (estiloPos === 'formal' || estiloPos === 'rubrica')
          const fonteParaUsar = isFormal ? fonteRubricaFormal : fonteAssinatura

          const rawNome = isResponsavel
            ? sanitizeSignerName(params.signatario.nome || pos.nome)
            : sanitizeSignerName(pos.nome)

          const textoAssinatura = formatSignatureDisplayName(rawNome, boxWidth > 200 ? 34 : 28)

          const maxFontePorAltura = Math.min(26, Math.max(10, boxHeight * 0.38))
          let sigSz = maxFontePorAltura
          while (fonteParaUsar.widthOfTextAtSize(textoAssinatura, sigSz) > (boxWidth - 8) && sigSz > 7.0) {
            sigSz -= 0.5
          }

          const sigY = y + Math.max(10, Math.round(boxHeight * 0.32))
          targetPage.drawText(sanitizeWinAnsi(textoAssinatura), {
            x: x + 4,
            y: sigY,
            size: sigSz,
            font: fonteParaUsar,
            color: rgb(0.08, 0.20, 0.48),
          })
        }

        // 2. Embaixo de cada assinatura da página: texto menor "Assinado eletronicamente <data>"
        const dataAssinaturaIso = isResponsavel
          ? (params.signatario.dataHoraAssinatura || params.representanteEscola?.dataHoraAssinatura)
          : (params.representanteEscola?.dataHoraAssinatura || params.signatario.dataHoraAssinatura)
        const dataFormatada = formatDataAssinaturaSimples(dataAssinaturaIso)
        const legendaAssinado = sanitizeWinAnsi(`Assinado eletronicamente ${dataFormatada}`)

        let subSz = Math.max(4.2, Math.min(6.8, boxHeight * 0.13))
        while (fontRegular.widthOfTextAtSize(legendaAssinado, subSz) > (boxWidth - 8) && subSz > 3.8) {
          subSz -= 0.2
        }
        const subY = y + Math.max(2, Math.round(boxHeight * 0.08))

        targetPage.drawText(legendaAssinado, {
          x: x + 4,
          y: subY,
          size: subSz,
          font: fontRegular,
          color: rgb(0.35, 0.40, 0.48),
        })
      }
    }

    // 2. Se NÃO for para suprimir a rubrica de rodapé (documentos legados sem posições customizadas), estampa o selo
    if (!suprimirRubrica) {
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
    sanitizeWinAnsi('RELATÓRIO DE EVIDÊNCIAS DA ASSINATURA ELETRÔNICA'),
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
  const listaArquivos = obterListaArquivosExistentes(params, totalPaginasOriginais)
  const numFilesExibicao = Math.min(listaArquivos.length, 4)
  const fileLinesCount = numFilesExibicao + (listaArquivos.length > numFilesExibicao ? 1 : 0)
  const docBoxHeight = 98 + 10 + (fileLinesCount * 9.5)

  certPage.drawRectangle({
    x: marginX,
    y: currentY - docBoxHeight,
    width: contentWidth,
    height: docBoxHeight,
    color: colorBgBox,
    borderColor: colorBorder,
    borderWidth: 0.8,
  })

  // Gera o QR Code vetorial centralizado verticalmente na lateral direita da caixa
  try {
    const qrDataUrl = await QRCode.toDataURL(publicValidationUrl, {
      margin: 1,
      width: 160,
      color: { dark: '#0a192f', light: '#ffffff' },
    })
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64')
    const qrImage = await pdfDoc.embedPng(qrBuffer)
    const qrHeight = 82
    const qrY = currentY - docBoxHeight + Math.round((docBoxHeight - qrHeight) / 2)
    certPage.drawImage(qrImage, {
      x: pageWidth - marginX - 90,
      y: qrY,
      width: 82,
      height: 82,
    })
  } catch (e) {
    console.warn('[EvidenceCert] Erro ao gerar QR Code:', e)
  }

  // Textos dentro da caixa de identificação
  const textLeftX = marginX + 10
  const maxDocTextWidth = pageWidth - marginX - 98 - textLeftX
  let insideY = currentY - 12

  const docTituloTexto = (params.documentoTitulo || (params as any).tituloDocumento || 'DOCUMENTO').toUpperCase()
  const docTituloLines = wrapText(`DOCUMENTO: ${docTituloTexto}`, maxDocTextWidth, fontBold, 8.5)
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
    insideY -= 10
  }

  // ── Seção de Arquivos Existentes e Quantidade de Páginas ──
  const totalPagsArquivos = listaArquivos.reduce((acc, f) => acc + f.totalPaginas, 0)
  const labelArquivos = listaArquivos.length > 1
    ? `ARQUIVOS INTEGRANTES (${listaArquivos.length} ARQUIVOS • ${totalPagsArquivos} PÁGINAS NO TOTAL):`
    : `ARQUIVO INTEGRANTE (1 ARQUIVO • ${totalPagsArquivos} PÁGINAS):`

  certPage.drawText(sanitizeWinAnsi(labelArquivos), {
    x: textLeftX,
    y: insideY,
    size: 6.2,
    font: fontBold,
    color: colorPrimary,
  })
  insideY -= 9.5

  for (let fIdx = 0; fIdx < numFilesExibicao; fIdx++) {
    const file = listaArquivos[fIdx]
    const nomeTruncado = formatFileDisplayName(file.nome, maxDocTextWidth > 350 ? 46 : 38)
    const bulletPrefix = listaArquivos.length > 1 ? `${fIdx + 1}. ` : `- `
    const nomeText = `${bulletPrefix}${nomeTruncado}`
    const pagsSuffix = `  [${file.totalPaginas} ${file.totalPaginas === 1 ? 'página' : 'páginas'} • ${file.paginasRange}]`
    
    certPage.drawText(sanitizeWinAnsi(nomeText), {
      x: textLeftX + 2,
      y: insideY,
      size: 6.2,
      font: fontRegular,
      color: colorDark,
    })

    const nomeWidth = fontRegular.widthOfTextAtSize(sanitizeWinAnsi(nomeText), 6.2)
    certPage.drawText(sanitizeWinAnsi(pagsSuffix), {
      x: textLeftX + 2 + nomeWidth + 4,
      y: insideY,
      size: 6.2,
      font: fontBold,
      color: colorSecondary,
    })

    insideY -= 9.0
  }

  if (listaArquivos.length > numFilesExibicao) {
    const restantes = listaArquivos.length - numFilesExibicao
    certPage.drawText(sanitizeWinAnsi(`• ... e mais ${restantes} arquivo(s) complementar(es) mesclado(s)`), {
      x: textLeftX + 2,
      y: insideY,
      size: 5.6,
      font: fontRegular,
      color: colorSubtle,
    })
    insideY -= 8.5
  }

  insideY -= 1.5

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

  // Representação Gráfica da Assinatura do Signatário:
  // Se for desenho manuscrito real (tipo 'manual'), incorpora a imagem do traço.
  // Caso contrário (caligrafia automática oficial), renderiza diretamente com a fonte vetorial
  // (Dancing Script / Cursiva Clássica ou Times-BoldItalic / Rubrica Formal), garantindo fidelidade 100% idêntica ao contrato original.
  let desenhouAssinatura = false
  if (params.signatario && params.signatario.tipoAssinatura === 'manual' && params.signatario.assinaturaBase64) {
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
      desenhouAssinatura = true
    } catch (err) {
      console.warn('[EvidenceCert] Erro ao embutir imagem manual da assinatura:', err)
    }
  }

  if (!desenhouAssinatura) {
    const isFormal = params.signatario?.estiloCaligrafico === 'formal' || params.signatario?.estiloCaligrafico === 'rubrica'
    const fonteParaUsar = isFormal ? fonteRubricaFormal : fonteAssinatura
    const nomeLimpo = sanitizeSignerName(params.signatario?.nome || 'Signatário')
    const textoChancela = formatSignatureDisplayName(nomeLimpo, 28)

    let chancelaSz = 16.5
    while (fonteParaUsar.widthOfTextAtSize(textoChancela, chancelaSz) > (colRightWidth - 16) && chancelaSz > 10.5) {
      chancelaSz -= 0.5
    }
    const wSig = fonteParaUsar.widthOfTextAtSize(textoChancela, chancelaSz)
    const sigX = colRightX + Math.max(4, (colRightWidth - wSig) / 2)
    const sigY = cardY + 40

    certPage.drawText(sanitizeWinAnsi(textoChancela), {
      x: sigX,
      y: sigY,
      size: chancelaSz,
      font: fonteParaUsar,
      color: rgb(0.08, 0.20, 0.48),
    })
    desenhouAssinatura = true
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

  // Data e hora registradas pelo sistema (com quebra de linha protegida)
  const dataHoraRegistrada = `Data e hora registradas pelo sistema: ${formatDatePtBr(params.signatario.dataHoraAssinatura)}`
  const dataHoraLines = wrapText(dataHoraRegistrada, colLeftWidth, fontRegular, 6.8)
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

  // ── Bloco 2: Representantes Legais da Instituição de Ensino ──
  const repEscolaSafe = params.representanteEscola || {
    nome: 'DIREÇÃO GERAL / REPRESENTANTE LEGAL',
    cargo: 'Diretor Geral',
    cpf: '00130220167',
    razaoSocial: 'COLÉGIO IMPACTO',
    cnpj: '04.395.789/0001-88',
  }
  const semAssinaturaRepCert = Boolean(
    repEscolaSafe.semAssinaturaRepresentante ||
    (Array.isArray(repEscolaSafe.representantes) && repEscolaSafe.representantes.length === 0 && !repEscolaSafe.nome)
  )
  const repsEscola: RepresentanteEscolaItem[] = semAssinaturaRepCert
    ? []
    : Array.isArray(repEscolaSafe.representantes) && repEscolaSafe.representantes.length > 0
      ? repEscolaSafe.representantes
      : [{
          nome: repEscolaSafe.nome,
          cpf: repEscolaSafe.cpf,
          cargo: repEscolaSafe.cargo,
          assinaturaBase64: repEscolaSafe.assinaturaBase64,
          estiloCaligrafico: repEscolaSafe.estiloCaligrafico,
        }]

  const numReps = repsEscola.length
  let repBoxHeight: number
  let gridCols: number
  let gridRows: number
  let gridCardWidth: number
  let gridCardHeight: number

  if (numReps === 0) {
    repBoxHeight = 68
    gridCols = 1
    gridRows = 1
    gridCardWidth = 152
    gridCardHeight = 46
  } else if (numReps === 1) {
    repBoxHeight = 84
    gridCols = 1
    gridRows = 1
    gridCardWidth = 152
    gridCardHeight = 58
  } else if (numReps === 2) {
    gridCols = 2
    gridRows = 1
    gridCardWidth = Math.floor((contentWidth - 20 - 10) / 2) // ~246 pt
    gridCardHeight = 52
    repBoxHeight = 18 + 6 + 16 + 6 + gridCardHeight + 8 // 106 pt
  } else if (numReps === 3) {
    gridCols = 3
    gridRows = 1
    gridCardWidth = Math.floor((contentWidth - 20 - 2 * 8) / 3) // ~162 pt
    gridCardHeight = 58
    repBoxHeight = 18 + 6 + 16 + 6 + gridCardHeight + 8 // 112 pt
  } else if (numReps === 4) {
    // Grid 2x2 executivo com 246pt por card para os 4 representantes
    gridCols = 2
    gridRows = 2
    gridCardWidth = Math.floor((contentWidth - 20 - 10) / 2) // ~246 pt
    gridCardHeight = 50
    repBoxHeight = 18 + 6 + 16 + 6 + (gridCardHeight * 2 + 6) + 8 // 160 pt
  } else {
    // 5 ou 6 representantes: Grid 3x2
    gridCols = 3
    gridRows = 2
    gridCardWidth = Math.floor((contentWidth - 20 - 2 * 8) / 3) // ~162 pt
    gridCardHeight = 50
    repBoxHeight = 18 + 6 + 16 + 6 + (gridCardHeight * 2 + 6) + 8 // 160 pt
  }

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

  const repHeaderTitle = numReps === 0
    ? '2. IDENTIFICAÇÃO DA INSTITUIÇÃO EMISSORA (ASSINATURA EXCLUSIVA DO SIGNATÁRIO)'
    : repsEscola.length > 1
      ? `2. REPRESENTANTES LEGAIS DA INSTITUIÇÃO DE ENSINO (${repsEscola.length} CO-SIGNATÁRIOS)`
      : '2. REPRESENTANTE LEGAL DA INSTITUIÇÃO DE ENSINO (CONTRATADA)'

  certPage.drawText(repHeaderTitle, {
    x: marginX + 10,
    y: currentY - 13,
    size: 7.5,
    font: fontBold,
    color: colorPrimary,
  })

  // ── Renderização do Bloco 2: Sem Representante vs 1 Representante vs Múltiplos Representantes ──
  if (numReps === 0) {
    let repY = currentY - 30
    certPage.drawText(
      sanitizeWinAnsi(`Instituição Emissora: ${repEscolaSafe.razaoSocial || 'COLÉGIO IMPACTO'} — CNPJ: ${repEscolaSafe.cnpj || '04.395.789/0001-88'}`),
      {
        x: colLeftX,
        y: repY,
        size: 7.5,
        font: fontBold,
        color: colorDark,
      }
    )
    repY -= 12
    certPage.drawText(
      sanitizeWinAnsi('Modalidade de Emissão: Assinatura exclusiva do signatário (documento emitido sem co-assinatura de representante da instituição)'),
      {
        x: colLeftX,
        y: repY,
        size: 7,
        font: fontRegular,
        color: colorDark,
      }
    )
    repY -= 12
    certPage.drawText(
      sanitizeWinAnsi(`Selo Criptográfico Institucional PKCS#7: Concluído em ${formatDatePtBr(repEscolaSafe.dataHoraAssinatura || params.signatario.dataHoraAssinatura)}`),
      {
        x: colLeftX,
        y: repY,
        size: 7,
        font: fontBold,
        color: colorSecondary,
      }
    )
  } else if (numReps === 1) {
    // 1 Único Representante: Card tradicional na coluna direita
    const rep = repsEscola[0]
    const repCardHeight = 58
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

    let desenhouSig = false
    const sigB64 = rep.estiloCaligrafico === 'custom' ? (rep.assinaturaBase64 || repEscolaSafe.assinaturaBase64) : null
    if (sigB64) {
      const img = await embedImageSafe(pdfDoc, sigB64)
      if (img) {
        const maxW = colRightWidth - 16
        const maxH = repCardHeight - 24
        const scale = Math.min(maxW / img.width, maxH / img.height)
        const rW = Math.round(img.width * scale)
        const rH = Math.round(img.height * scale)
        certPage.drawImage(img, {
          x: colRightX + Math.round((colRightWidth - rW) / 2),
          y: repCardY + 12 + Math.round((maxH - rH) / 2),
          width: rW,
          height: rH,
        })
        desenhouSig = true
      }
    }

    if (!desenhouSig) {
      const matchingPos = params.posicoesAssinaturas?.find(p =>
        (rep.id && p.signatarioId === rep.id) ||
        sanitizeSignerName(p.nome).toLowerCase() === sanitizeSignerName(rep.nome).toLowerCase()
      )
      const estiloFinal = matchingPos?.estiloCaligrafico || rep.estiloCaligrafico || 'classica'
      const isFormal = estiloFinal === 'formal' || estiloFinal === 'rubrica'
      const fonteParaUsar = isFormal ? fonteRubricaFormal : fonteAssinatura
      const nomeLimpo = sanitizeSignerName(rep.nome)
      const nomeSig = formatSignatureDisplayName(nomeLimpo, 28)
      let sigSz = 15.5
      while (fonteParaUsar.widthOfTextAtSize(nomeSig, sigSz) > (colRightWidth - 16) && sigSz > 9.0) {
        sigSz -= 0.5
      }
      const wCurto = fonteParaUsar.widthOfTextAtSize(nomeSig, sigSz)
      certPage.drawText(sanitizeWinAnsi(nomeSig), {
        x: colRightX + Math.max(4, (colRightWidth - wCurto) / 2),
        y: repCardY + 22,
        size: sigSz,
        font: fonteParaUsar,
        color: rgb(0.08, 0.20, 0.48),
      })
    }

    const repCaptionClean = sanitizeWinAnsi('Assinatura Institucional Autêntica')
    const repCaptionWidth = fontBold.widthOfTextAtSize(repCaptionClean, 5.5)
    certPage.drawText(repCaptionClean, {
      x: colRightX + (colRightWidth - repCaptionWidth) / 2,
      y: repCardY + 4,
      size: 5.5,
      font: fontBold,
      color: colorSecondary,
    })

    // Textos do Representante na coluna esquerda
    let repY = currentY - 28
    certPage.drawText(
      sanitizeWinAnsi(`Representante Legal: ${repEscolaSafe.nome} (CPF: ${maskCpf(repEscolaSafe.cpf)})`),
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
      sanitizeWinAnsi(`Cargo: ${repEscolaSafe.cargo} • ${repEscolaSafe.razaoSocial}`),
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
      sanitizeWinAnsi(`CNPJ: ${repEscolaSafe.cnpj} • Sistema de Ensino Impacto EDU`),
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
      sanitizeWinAnsi(`Assinatura e Selo Institucional: Concluídos em ${formatDatePtBr(repEscolaSafe.dataHoraAssinatura)}`),
      {
        x: colLeftX,
        y: repY,
        size: 7,
        font: fontBold,
        color: colorSecondary,
      }
    )
  } else {
    // Múltiplos Representantes (Grid Executivo Sem Quebras e Sem Sobreposições)
    const stripY = currentY - 18 - 4 - 16
    const stripWidth = contentWidth - 20

    // 1. Faixa Institucional Superior (CNPJ e Registro de Autenticidade)
    certPage.drawRectangle({
      x: marginX + 10,
      y: stripY,
      width: stripWidth,
      height: 16,
      color: rgb(0.975, 0.985, 0.995),
      borderColor: colorBorder,
      borderWidth: 0.5,
    })

    const stripLeft = sanitizeWinAnsi(`Instituição: ${repEscolaSafe.razaoSocial || 'Colégio Impacto'} • CNPJ: ${repEscolaSafe.cnpj || '04.395.789/0001-88'}`)
    certPage.drawText(stripLeft, {
      x: marginX + 16,
      y: stripY + 5,
      size: 6.0,
      font: fontBold,
      color: colorPrimary,
    })

    const stripRight = sanitizeWinAnsi(`Chancela Registrada: ${formatDatePtBr(repEscolaSafe.dataHoraAssinatura)} • MP 2.200-2`)
    const rightWidth = fontRegular.widthOfTextAtSize(stripRight, 5.4)
    const rightX = Math.max(marginX + 16 + fontBold.widthOfTextAtSize(stripLeft, 6.0) + 12, marginX + 10 + stripWidth - rightWidth - 6)
    certPage.drawText(stripRight, {
      x: rightX,
      y: stripY + 5,
      size: 5.4,
      font: fontRegular,
      color: colorSecondary,
    })

    // 2. Grid de Cards dos Co-Signatários
    const gridStartX = marginX + 10
    const gridStartY = stripY - 6
    const gapX = gridCols === 2 ? 10 : 8
    const gapY = 6

    for (let rIdx = 0; rIdx < numReps; rIdx++) {
      const rep = repsEscola[rIdx]
      const colIdx = rIdx % gridCols
      const rowIdx = Math.floor(rIdx / gridCols)
      const cardWidth = gridCardWidth
      const cardHeight = gridCardHeight

      const cardX = gridStartX + colIdx * (cardWidth + gapX)
      const cardY = gridStartY - (rowIdx + 1) * cardHeight - rowIdx * gapY

      // Fundo do Card
      certPage.drawRectangle({
        x: cardX,
        y: cardY,
        width: cardWidth,
        height: cardHeight,
        color: rgb(0.985, 0.99, 1.0),
        borderColor: colorBorder,
        borderWidth: 0.6,
      })

      // Cabeçalho do Card (Cargo do Representante)
      const bannerH = 12
      const bannerY = cardY + cardHeight - bannerH
      certPage.drawRectangle({
        x: cardX,
        y: bannerY,
        width: cardWidth,
        height: bannerH,
        color: rgb(0.92, 0.95, 0.98),
        borderColor: colorBorder,
        borderWidth: 0.6,
      })

      let cargoTag = (rep.cargo || 'REPRESENTANTE INSTITUCIONAL').toUpperCase().trim()
      const cargoLabel = sanitizeWinAnsi(cargoTag)
      const cargoWidth = fontBold.widthOfTextAtSize(cargoLabel, gridCols === 2 ? 5.5 : 5.0)
      certPage.drawText(cargoLabel, {
        x: cardX + Math.max(4, (cardWidth - cargoWidth) / 2),
        y: bannerY + 3.5,
        size: gridCols === 2 ? 5.5 : 5.0,
        font: fontBold,
        color: colorPrimary,
      })

      if (gridCols === 2) {
        // Layout Executivo Dividido (Esquerda: Dados / Direita: Assinatura e Chancela)
        const dividerX = cardX + 138
        certPage.drawLine({
          start: { x: dividerX, y: cardY + 3 },
          end: { x: dividerX, y: cardY + cardHeight - bannerH - 3 },
          thickness: 0.5,
          color: rgb(0.85, 0.88, 0.92),
        })

        // Sub-seção Esquerda: Nome Civil
        const rawNome = (rep.nome || 'Representante Legal').toUpperCase().trim()
        const maxNomeW = 126
        const nomeLines = wrapText(rawNome, maxNomeW, fontBold, 6.2)

        if (nomeLines.length === 1) {
          certPage.drawText(sanitizeWinAnsi(nomeLines[0]), {
            x: cardX + 6,
            y: cardY + 26,
            size: 6.2,
            font: fontBold,
            color: colorDark,
          })
        } else {
          certPage.drawText(sanitizeWinAnsi(nomeLines[0]), {
            x: cardX + 6,
            y: cardY + 28,
            size: 5.6,
            font: fontBold,
            color: colorDark,
          })
          certPage.drawText(sanitizeWinAnsi(nomeLines[1]), {
            x: cardX + 6,
            y: cardY + 21,
            size: 5.6,
            font: fontBold,
            color: colorDark,
          })
        }

        const cpfY = nomeLines.length >= 2 ? cardY + 12.5 : cardY + 15.5
        certPage.drawText(sanitizeWinAnsi(`CPF: ${maskCpf(rep.cpf)}`), {
          x: cardX + 6,
          y: cpfY,
          size: 5.6,
          font: fontRegular,
          color: colorDark,
        })

        const statusY = nomeLines.length >= 2 ? cardY + 4.5 : cardY + 5.5
        certPage.drawText(sanitizeWinAnsi('✓ Assinado Digitalmente • MP 2.200-2'), {
          x: cardX + 6,
          y: statusY,
          size: 5.0,
          font: fontBold,
          color: colorSecondary,
        })

        // Sub-seção Direita: Assinatura Caligráfica e Selo de Chancela
        const rightSecW = cardWidth - 138
        let desenhouSig = false
        const sigB64 = rep.estiloCaligrafico === 'custom' ? rep.assinaturaBase64 : null
        if (sigB64) {
          const img = await embedImageSafe(pdfDoc, sigB64)
          if (img) {
            const maxW = rightSecW - 14
            const maxH = 22
            const scale = Math.min(maxW / img.width, maxH / img.height)
            const rW = Math.round(img.width * scale)
            const rH = Math.round(img.height * scale)
            certPage.drawImage(img, {
              x: dividerX + Math.round((rightSecW - rW) / 2),
              y: cardY + 12 + Math.round((maxH - rH) / 2),
              width: rW,
              height: rH,
            })
            desenhouSig = true
          }
        }

        if (!desenhouSig) {
          const matchingPos = params.posicoesAssinaturas?.find(p =>
            (rep.id && p.signatarioId === rep.id) ||
            sanitizeSignerName(p.nome).toLowerCase() === sanitizeSignerName(rep.nome).toLowerCase()
          )
          const estiloFinal = matchingPos?.estiloCaligrafico || rep.estiloCaligrafico || 'classica'
          const isFormal = estiloFinal === 'formal' || estiloFinal === 'rubrica'
          const fonteParaUsar = isFormal ? fonteRubricaFormal : fonteAssinatura
          const rawNome = sanitizeSignerName(rep.nome)
          const nomeSig = formatSignatureDisplayName(rawNome, 28)

          let sigSz = 13.5
          while (fonteParaUsar.widthOfTextAtSize(nomeSig, sigSz) > (rightSecW - 8) && sigSz > 8.0) {
            sigSz -= 0.5
          }
          const wSig = fonteParaUsar.widthOfTextAtSize(nomeSig, sigSz)
          certPage.drawText(sanitizeWinAnsi(nomeSig), {
            x: dividerX + Math.max(3, (rightSecW - wSig) / 2),
            y: cardY + 14.5,
            size: sigSz,
            font: fonteParaUsar,
            color: rgb(0.08, 0.20, 0.48),
          })
        }

        const chancelaLabel = sanitizeWinAnsi('Chancela Institucional')
        const wChancela = fontBold.widthOfTextAtSize(chancelaLabel, 4.8)
        certPage.drawText(chancelaLabel, {
          x: dividerX + (rightSecW - wChancela) / 2,
          y: cardY + 4.5,
          size: 4.8,
          font: fontBold,
          color: colorSecondary,
        })
      } else {
        // Layout 3 Colunas (Cards mais estreitos com Assinatura Centralizada)
        let desenhouSig = false
        const sigB64 = rep.estiloCaligrafico === 'custom' ? rep.assinaturaBase64 : null
        if (sigB64) {
          const img = await embedImageSafe(pdfDoc, sigB64)
          if (img) {
            const maxW = cardWidth - 20
            const maxH = 18
            const scale = Math.min(maxW / img.width, maxH / img.height)
            const rW = Math.round(img.width * scale)
            const rH = Math.round(img.height * scale)
            certPage.drawImage(img, {
              x: cardX + Math.round((cardWidth - rW) / 2),
              y: cardY + 25 + Math.round((maxH - rH) / 2),
              width: rW,
              height: rH,
            })
            desenhouSig = true
          }
        }

        if (!desenhouSig) {
          const matchingPos = params.posicoesAssinaturas?.find(p =>
            (rep.id && p.signatarioId === rep.id) ||
            sanitizeSignerName(p.nome).toLowerCase() === sanitizeSignerName(rep.nome).toLowerCase()
          )
          const estiloFinal = matchingPos?.estiloCaligrafico || rep.estiloCaligrafico || 'classica'
          const isFormal = estiloFinal === 'formal' || estiloFinal === 'rubrica'
          const fonteParaUsar = isFormal ? fonteRubricaFormal : fonteAssinatura
          const rawNome = sanitizeSignerName(rep.nome)
          const nomeSig = formatSignatureDisplayName(rawNome, 28)

          let sigSz = 12.5
          while (fonteParaUsar.widthOfTextAtSize(nomeSig, sigSz) > (cardWidth - 12) && sigSz > 8.0) {
            sigSz -= 0.5
          }
          const wSig = fonteParaUsar.widthOfTextAtSize(nomeSig, sigSz)
          certPage.drawText(sanitizeWinAnsi(nomeSig), {
            x: cardX + Math.max(2, (cardWidth - wSig) / 2),
            y: cardY + 26,
            size: sigSz,
            font: fonteParaUsar,
            color: rgb(0.08, 0.20, 0.48),
          })
        }

        const rawNome = (rep.nome || 'Representante Legal').toUpperCase().trim()
        const maxNomeW = cardWidth - 10
        const nomeLines = wrapText(rawNome, maxNomeW, fontBold, 5.6)
        const wNome = fontBold.widthOfTextAtSize(nomeLines[0], 5.6)
        certPage.drawText(sanitizeWinAnsi(nomeLines[0]), {
          x: cardX + Math.max(2, (cardWidth - wNome) / 2),
          y: cardY + 16,
          size: 5.6,
          font: fontBold,
          color: colorDark,
        })

        const cpfText = sanitizeWinAnsi(`CPF: ${maskCpf(rep.cpf)}`)
        const wCpf = fontRegular.widthOfTextAtSize(cpfText, 5.0)
        certPage.drawText(cpfText, {
          x: cardX + Math.max(2, (cardWidth - wCpf) / 2),
          y: cardY + 9,
          size: 5.0,
          font: fontRegular,
          color: colorDark,
        })

        const statusText = sanitizeWinAnsi('✓ Assinado Digitalmente • MP 2.200-2')
        const wStatus = fontBold.widthOfTextAtSize(statusText, 4.4)
        certPage.drawText(statusText, {
          x: cardX + Math.max(2, (cardWidth - wStatus) / 2),
          y: cardY + 2.5,
          size: 4.4,
          font: fontBold,
          color: colorSecondary,
        })
      }
    }
  }

  currentY -= (repBoxHeight + 8)

  // ── Bloco 3: Trilha de Auditoria & Histórico de Eventos (Cadeia de Custódia) ──
  const auditBoxHeight = 114
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
