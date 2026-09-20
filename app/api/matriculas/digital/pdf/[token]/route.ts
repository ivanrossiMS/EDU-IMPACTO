import { NextResponse } from 'next/server'
import {
  buscarContratoPorToken,
  buscarContratoPorProtocolo,
  buscarContratoPorId,
  obterPdfBytes,
} from '@/lib/server/matriculaDigitalRepository'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

/**
 * GET /api/matriculas/digital/pdf/[token]
 * Serve diretamente o binário do PDF do contrato para visualização nativa em todos os navegadores,
 * incluindo Safari no macOS/iOS sem bloqueios de CSP ou problemas de URLs base64 em iframes.
 * Suporta busca por Token de Assinatura, Protocolo ou ID do documento.
 */
export async function GET(request: Request, { params }: Props) {
  try {
    const { token } = await params

    if (!token) {
      return new NextResponse('Token de documento não fornecido.', { status: 400 })
    }

    const clean = decodeURIComponent(token).trim()
    let contrato = await buscarContratoPorToken(clean)
    if (!contrato) {
      contrato = await buscarContratoPorProtocolo(clean)
    }
    if (!contrato) {
      contrato = await buscarContratoPorId(clean)
    }

    if (!contrato) {
      return new NextResponse('Documento não localizado ou expirado.', { status: 404 })
    }

    const url = new URL(request.url)
    const versao = url.searchParams.get('versao') || url.searchParams.get('v')
    const isDownload = url.searchParams.get('download') === '1'

    const tipoDesejado: 'original' | 'assinado' =
      versao === 'original'
        ? 'original'
        : versao === 'assinado'
        ? 'assinado'
        : contrato.status === 'assinado'
        ? 'assinado'
        : 'original'

    let pdfBuffer = await obterPdfBytes(contrato, tipoDesejado)
    // Se pediu assinado mas não encontrou, tenta o original
    if (!pdfBuffer && tipoDesejado === 'assinado') {
      pdfBuffer = await obterPdfBytes(contrato, 'original')
    }

    if (!pdfBuffer) {
      return new NextResponse('Arquivo PDF não disponível para este documento.', { status: 404 })
    }

    const docBase = (contrato.titulo_documento || 'documento').replace(/[^\w.-]/gi, '_')
    let contentType = 'application/pdf'
    let filename = ''
    let disposition: 'inline' | 'attachment' = isDownload ? 'attachment' : 'inline'

    const isDocx =
      pdfBuffer.length >= 4 &&
      pdfBuffer[0] === 0x50 &&
      pdfBuffer[1] === 0x4b &&
      pdfBuffer[2] === 0x03 &&
      pdfBuffer[3] === 0x04
    const isDoc =
      pdfBuffer.length >= 8 &&
      pdfBuffer[0] === 0xd0 &&
      pdfBuffer[1] === 0xcf &&
      pdfBuffer[2] === 0x11 &&
      pdfBuffer[3] === 0xe0

    // Se o buffer armazenado for Word e a requisição for para visualização inline, converte on-the-fly para PDF
    if ((isDocx || isDoc) && !isDownload) {
      try {
        const { convertDocumentBufferToPdf } = await import('@/lib/converters/documentToPdfServer')
        const conv = await convertDocumentBufferToPdf(
          pdfBuffer,
          contrato.evidencias?.arquivoOriginalNome || `${docBase}.docx`
        )
        pdfBuffer = Buffer.from(conv.pdfBytes)
      } catch (err) {
        console.warn('[PDF Route] Erro na conversão on-the-fly de Word para PDF:', err)
      }
    }

    if (tipoDesejado === 'assinado') {
      contentType = 'application/pdf'
      filename = `${docBase}_Certificado_Assinado_${contrato.protocolo || contrato.id}.pdf`
      disposition = isDownload ? 'attachment' : 'inline'
    } else if (isDownload && isDocx) {
      contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      filename = contrato.evidencias?.arquivoOriginalNome || `${docBase}.docx`
      disposition = 'attachment'
    } else if (isDownload && isDoc) {
      contentType = 'application/msword'
      filename = contrato.evidencias?.arquivoOriginalNome || `${docBase}.doc`
      disposition = 'attachment'
    } else {
      contentType = 'application/pdf'
      filename = (contrato.evidencias?.arquivoOriginalNome || `${docBase}.pdf`).replace(/\.(docx?|doc)$/i, '.pdf')
      disposition = isDownload ? 'attachment' : 'inline'
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error: any) {
    console.error('[PDF Route] Erro ao servir PDF:', error)
    return new NextResponse('Erro interno ao processar visualização do documento.', { status: 500 })
  }
}
