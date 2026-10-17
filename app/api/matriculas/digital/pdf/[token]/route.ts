import { NextResponse } from 'next/server'
import {
  buscarContratoPorToken,
  buscarContratoPorProtocolo,
  buscarContratoPorId,
  buscarContratoPorHash,
  obterPdfBytes,
} from '@/lib/server/matriculaDigitalRepository'
import { getAdminClient } from '@/lib/server/supabaseAdminSingleton'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ token: string }>
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Tenta recuperar o PDF diretamente do Supabase Storage ou tabela configuracoes
 * pelo UUID do contrato caso o registro tenha sido substituído/reemitido enquanto a aba estava aberta.
 */
async function recuperarPdfDiretoPorId(
  contratoId: string,
  preferencia: 'original' | 'assinado'
): Promise<Buffer | null> {
  if (!contratoId || !UUID_REGEX.test(contratoId)) return null
  const supabase = getAdminClient()
  const tipos: Array<'original' | 'assinado'> =
    preferencia === 'assinado' ? ['assinado', 'original'] : ['original', 'assinado']

  for (const t of tipos) {
    try {
      const storagePath = `contratos/${contratoId}/${t}.pdf`
      const { data, error } = await supabase.storage.from('documentos').download(storagePath)
      if (!error && data) {
        const ab = await data.arrayBuffer()
        if (ab.byteLength > 100) {
          return Buffer.from(ab)
        }
      }
    } catch {}

    try {
      const cfgKey = `matricula_pdf_${t === 'assinado' ? 'ass' : 'orig'}_${contratoId}`
      const { data: cfgRow } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', cfgKey)
        .maybeSingle()
      if (cfgRow?.valor && typeof cfgRow.valor === 'string') {
        return Buffer.from(cfgRow.valor.replace(/^data:application\/pdf;base64,/, ''), 'base64')
      }
    } catch {}
  }

  return null
}

/**
 * Sanitiza o nome do arquivo para ASCII seguro no header HTTP Content-Disposition (evita ByteString error no Node/Undici)
 */
function buildContentDisposition(disposition: 'inline' | 'attachment', rawFilename: string): string {
  const fallback = rawFilename
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\;]/g, '_')
    .trim() || 'documento.pdf'
  const encoded = encodeURIComponent(rawFilename)
  return `${disposition}; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

/**
 * GET /api/matriculas/digital/pdf/[token]
 * Serve diretamente o binário do PDF do contrato para visualização nativa em todos os navegadores,
 * incluindo Safari no macOS/iOS sem bloqueios de CSP ou problemas de URLs base64 em iframes.
 * Suporta busca por Token de Assinatura, Protocolo, ID ou Hash do documento, além de recuperação direta no Storage.
 */
export async function GET(request: Request, { params }: Props) {
  try {
    const { token } = await params
    const url = new URL(request.url)
    const versao = url.searchParams.get('versao') || url.searchParams.get('v')
    const isDownload = url.searchParams.get('download') === '1'
    const idParam = (url.searchParams.get('id') || '').trim()
    const protocoloParam = (url.searchParams.get('protocolo') || '').trim()
    const hashParam = (url.searchParams.get('h') || url.searchParams.get('hash') || '').trim()

    if (!token && !idParam && !protocoloParam) {
      return new NextResponse('Token de documento não fornecido.', { status: 400 })
    }

    const clean = decodeURIComponent(token || '').trim()
    let contrato = clean ? await buscarContratoPorToken(clean) : null
    if (!contrato && clean && !UUID_REGEX.test(clean)) {
      contrato = await buscarContratoPorProtocolo(clean)
    }
    if (!contrato && clean && clean.length >= 8 && !UUID_REGEX.test(clean)) {
      contrato = await buscarContratoPorHash(clean)
    }

    // Fallbacks adicionais via query params (protocolo, hash)
    if (!contrato && protocoloParam) {
      contrato = await buscarContratoPorProtocolo(protocoloParam)
    }
    if (!contrato && hashParam && hashParam.length >= 8) {
      contrato = await buscarContratoPorHash(hashParam)
    }

    // Busca direta por UUID (sem token/protocolo/hash válido) exige sessão autenticada ou prova de protocolo/hash
    if (!contrato) {
      const hasPublicProof = Boolean(protocoloParam || (hashParam && hashParam.length >= 8))
      let canLookupByUuid = hasPublicProof
      if (!canLookupByUuid) {
        const { requireAuth } = await import('@/lib/server/authGuard')
        const { user } = await requireAuth(request)
        canLookupByUuid = Boolean(user)
      }

      if (canLookupByUuid) {
        if (!contrato && clean && UUID_REGEX.test(clean)) {
          contrato = await buscarContratoPorId(clean)
        }
        if (!contrato && idParam && UUID_REGEX.test(idParam)) {
          contrato = await buscarContratoPorId(idParam)
        }
      }

      if (!contrato && canLookupByUuid) {
        const candidateUuid = UUID_REGEX.test(idParam)
          ? idParam
          : UUID_REGEX.test(clean)
          ? clean
          : ''
        if (candidateUuid) {
          const directBuf = await recuperarPdfDiretoPorId(
            candidateUuid,
            versao === 'assinado' ? 'assinado' : 'original'
          )
          if (directBuf) {
            const disp = isDownload ? 'attachment' : 'inline'
            return new NextResponse(new Uint8Array(directBuf), {
              status: 200,
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': buildContentDisposition(disp, `Documento_${protocoloParam || candidateUuid}.pdf`),
                'Content-Length': String(directBuf.length),
                'Cache-Control': 'private, max-age=30',
                'X-Content-Type-Options': 'nosniff',
              },
            })
          }
        }
      }

      if (!contrato) {
        return new NextResponse('Documento não localizado ou expirado.', { status: 404 })
      }
    }

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

    const docBase = (contrato.titulo_documento || 'documento')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w.-]/gi, '_')
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
        'Content-Disposition': buildContentDisposition(disposition, filename),
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
