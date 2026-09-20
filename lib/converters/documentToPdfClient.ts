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

/**
 * Formata bytes em string legível (KB ou MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
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
