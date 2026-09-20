/**
 * app/api/matriculas/digital/converter-documento/route.ts
 *
 * Endpoint POST para conversão server-side de arquivos Word (.doc e .docx) em PDF.
 * Suporta envio via multipart/form-data ou JSON com base64.
 */

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/authGuard'
import { convertDocumentBufferToPdf } from '@/lib/converters/documentToPdfServer'

export const dynamic = 'force-dynamic'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export async function POST(request: Request) {
  const { user, errorResponse } = await requireAuth(request)
  if (errorResponse) return errorResponse

  try {
    const contentType = request.headers.get('content-type') || ''
    let buffer: Buffer | null = null
    let filename = 'documento.docx'
    let titulo: string | undefined

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      titulo = (formData.get('titulo') as string) || undefined

      if (!file) {
        return NextResponse.json(
          { error: 'Nenhum arquivo enviado para conversão.' },
          { status: 400 }
        )
      }

      filename = file.name
      const arrayBuffer = await file.arrayBuffer()
      buffer = Buffer.from(arrayBuffer)
    } else if (contentType.includes('application/json')) {
      const body = await request.json()
      if (!body.arquivo_base64) {
        return NextResponse.json(
          { error: 'O campo "arquivo_base64" é obrigatório.' },
          { status: 400 }
        )
      }

      const cleanB64 = body.arquivo_base64.replace(/^data:[^;]+;base64,/, '')
      buffer = Buffer.from(cleanB64, 'base64')
      filename = body.arquivo_nome || 'documento.docx'
      titulo = body.titulo || undefined
    } else {
      return NextResponse.json(
        { error: 'Content-Type inválido. Utilize multipart/form-data ou application/json.' },
        { status: 400 }
      )
    }

    if (!buffer || buffer.length < 10) {
      return NextResponse.json(
        { error: 'O arquivo enviado parece vazio ou corrompido.' },
        { status: 400 }
      )
    }

    // Executa a conversão do buffer (DOCX, DOC ou validação de PDF)
    const result = await convertDocumentBufferToPdf(buffer, filename, {
      title: titulo,
      schoolName: 'COLÉGIO IMPACTO',
    })

    return NextResponse.json({
      success: true,
      pdf_base64: result.pdfBase64,
      nome_arquivo_pdf: result.docName,
      tamanho_formatado: formatBytes(result.pdfBytes.length),
      total_paginas: result.totalPages,
      formato_original: result.formatDetected,
    })
  } catch (err: any) {
    console.error('[API Converter Documento] Erro:', err)
    return NextResponse.json(
      {
        error:
          err.message ||
          'Não foi possível converter o documento. Verifique se o arquivo Word não está corrompido.',
      },
      { status: 500 }
    )
  }
}
