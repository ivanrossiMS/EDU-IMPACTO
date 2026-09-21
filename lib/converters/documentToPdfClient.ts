/**
 * lib/converters/documentToPdfClient.ts
 *
 * Módulo client-side para processamento e conversão de documentos (.pdf, .docx, .doc).
 * - Arquivos .docx e .doc são convertidos no servidor com alta fidelidade (papel timbrado, imagens, formatação).
 * - Arquivos .pdf são validados e carregados diretamente.
 */

import { PDFDocument } from 'pdf-lib'

export interface ClientConversionResult {
  pdfBase64: string
  cleanBase64: string
  nomeArquivoPdf: string
  tamanhoFormatado: string
  totalPaginas: number
  formatoOriginal: 'pdf' | 'docx' | 'doc'
  metodoConversao: 'direto' | 'servidor'
}

export interface DocumentoUploadItem {
  id: string
  nome: string
  nomeArquivoPdf?: string
  tamanhoBytes: number
  tamanhoFormatado: string
  formatoOriginal: 'pdf' | 'docx' | 'doc'
  pdfBase64: string
  cleanBase64: string
  totalPaginas: number
  metodoConversao: 'direto' | 'servidor'
  status?: 'pronto' | 'convertendo' | 'erro'
  erroMsg?: string
  hashSha256?: string
}

/**
 * Formata bytes em string legível (KB ou MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Converte Uint8Array para Base64 de forma eficiente sem estouro de pilha
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  const chunkSize = 8192
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len))
    binary += String.fromCharCode.apply(null, chunk as any)
  }
  return btoa(binary)
}

/**
 * Converte arquivo Word (.docx ou .doc) via API server-side
 */
async function converterViaApi(
  file: File,
  formatoOriginal: 'docx' | 'doc',
  options?: { titulo?: string; onProgress?: (msg: string) => void }
): Promise<ClientConversionResult> {
  options?.onProgress?.('Processando documento Word e extraindo imagens e papel timbrado...')

  const formData = new FormData()
  formData.append('file', file)
  if (options?.titulo) {
    formData.append('titulo', options.titulo)
  }

  const response = await fetch('/api/matriculas/digital/converter-documento', {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(
      errorData.error ||
        `Falha ao converter o documento Word (Status ${response.status}). Verifique se o arquivo não está corrompido.`
    )
  }

  const data = await response.json()
  if (!data.success || !data.pdf_base64) {
    throw new Error(data.error || 'A conversão do documento não retornou um PDF válido.')
  }

  const cleanBase64 = data.pdf_base64.replace(/^data:[^;]+;base64,/, '')

  return {
    pdfBase64: data.pdf_base64,
    cleanBase64,
    nomeArquivoPdf: data.nome_arquivo_pdf || file.name.replace(/\.(docx?|doc)$/i, '.pdf'),
    tamanhoFormatado: data.tamanho_formatado || formatBytes(file.size),
    totalPaginas: Number(data.total_paginas) || 1,
    formatoOriginal,
    metodoConversao: 'servidor',
  }
}

/**
 * Processa o documento selecionado (.pdf, .docx ou .doc)
 */
export async function processarDocumentoParaPdf(
  file: File,
  options?: { titulo?: string; onProgress?: (msg: string) => void }
): Promise<ClientConversionResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const formatoOriginal: 'pdf' | 'docx' | 'doc' =
    ext === 'docx' ? 'docx' : ext === 'doc' ? 'doc' : 'pdf'

  // Se for DOCX ou DOC, envia para a API server-side para renderização com timbrado e imagens
  if (formatoOriginal === 'docx' || formatoOriginal === 'doc') {
    return converterViaApi(file, formatoOriginal, options)
  }

  // Se for PDF nativo, carrega e valida páginas
  options?.onProgress?.('Validando arquivo PDF...')

  const arrayBuffer = await file.arrayBuffer()
  let totalPaginas = 1

  try {
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true })
    totalPaginas = pdfDoc.getPageCount()
  } catch (err) {
    console.warn('[processarDocumentoParaPdf] Aviso ao ler total de páginas do PDF:', err)
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo PDF selecionado.'))
    reader.onload = () => {
      const dataUrl = reader.result as string
      const cleanBase64 = dataUrl.replace(/^data:[^;]+;base64,/, '')
      resolve({
        pdfBase64: dataUrl,
        cleanBase64,
        nomeArquivoPdf: file.name,
        tamanhoFormatado: formatBytes(file.size),
        totalPaginas,
        formatoOriginal: 'pdf',
        metodoConversao: 'direto',
      })
    }
    reader.readAsDataURL(file)
  })
}

/**
 * Mescla múltiplos documentos PDF em um único arquivo PDF consolidado com todas as páginas
 */
export async function mesclarMultiplosDocumentosPdf(
  documentos: DocumentoUploadItem[],
  nomeArquivoFinal?: string
): Promise<ClientConversionResult> {
  if (!documentos || documentos.length === 0) {
    throw new Error('Nenhum documento fornecido para mesclagem.')
  }

  if (documentos.length === 1) {
    const unico = documentos[0]
    return {
      pdfBase64: unico.pdfBase64,
      cleanBase64: unico.cleanBase64,
      nomeArquivoPdf: nomeArquivoFinal || unico.nome,
      tamanhoFormatado: unico.tamanhoFormatado,
      totalPaginas: unico.totalPaginas,
      formatoOriginal: unico.formatoOriginal,
      metodoConversao: unico.metodoConversao,
    }
  }

  const mergedPdf = await PDFDocument.create()
  let totalPaginasAcumuladas = 0

  for (const doc of documentos) {
    if (!doc.cleanBase64 && !doc.pdfBase64) continue
    const cleanB64 = doc.cleanBase64 || doc.pdfBase64.replace(/^data:[^;]+;base64,/, '')
    const binaryStr = atob(cleanB64)
    const len = binaryStr.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }

    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const pageIndices = pdfDoc.getPageIndices()
    const copiedPages = await mergedPdf.copyPages(pdfDoc, pageIndices)
    copiedPages.forEach((page) => mergedPdf.addPage(page))
    totalPaginasAcumuladas += copiedPages.length
  }

  const mergedPdfBytes = await mergedPdf.save()
  const cleanBase64 = uint8ArrayToBase64(mergedPdfBytes)
  const pdfBase64 = `data:application/pdf;base64,${cleanBase64}`

  const baseNameDoc1 = documentos[0].nome.replace(/\.(docx?|pdf)$/i, '')
  const nomeFinal =
    nomeArquivoFinal ||
    `Pacote_${documentos.length}_Docs_${baseNameDoc1}.pdf`

  return {
    pdfBase64,
    cleanBase64,
    nomeArquivoPdf: nomeFinal,
    tamanhoFormatado: formatBytes(mergedPdfBytes.byteLength),
    totalPaginas: totalPaginasAcumuladas,
    formatoOriginal: 'pdf',
    metodoConversao: 'direto',
  }
}

/**
 * Processa múltiplos arquivos (PDF ou Word) em lote com controle de progresso individual
 */
export async function processarArquivosEmLote(
  files: File[],
  options?: {
    onProgress?: (info: { index: number; total: number; filename: string; etapa: string }) => void
  }
): Promise<DocumentoUploadItem[]> {
  const resultados: DocumentoUploadItem[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    options?.onProgress?.({
      index: i + 1,
      total: files.length,
      filename: file.name,
      etapa: `Processando arquivo ${i + 1} de ${files.length}: ${file.name}...`,
    })

    const conv = await processarDocumentoParaPdf(file, {
      onProgress: (msg) => {
        options?.onProgress?.({
          index: i + 1,
          total: files.length,
          filename: file.name,
          etapa: `[${i + 1}/${files.length}] ${msg}`,
        })
      },
    })

    resultados.push({
      id: `doc_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`,
      nome: file.name,
      nomeArquivoPdf: `${file.name.replace(/\.(docx?|pdf)$/i, '')}.pdf`,
      tamanhoBytes: file.size,
      tamanhoFormatado: conv.tamanhoFormatado,
      formatoOriginal: conv.formatoOriginal,
      pdfBase64: conv.pdfBase64,
      cleanBase64: conv.cleanBase64,
      totalPaginas: conv.totalPaginas,
      metodoConversao: conv.metodoConversao,
      status: 'pronto',
    })
  }

  return resultados
}

