import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument, rgb } from 'pdf-lib'
import {
  mesclarMultiplosDocumentosPdf,
  uint8ArrayToBase64,
  formatBytes,
} from '../lib/converters/documentToPdfClient.ts'
import { calculateSha256 } from '../lib/contracts/cryptoSignature.ts'

// Cria um PDF de teste com N páginas e texto
async function criarPdfTeste(totalPaginas = 1, titulo = 'Documento Teste') {
  const doc = await PDFDocument.create()
  for (let i = 0; i < totalPaginas; i++) {
    const page = doc.addPage([595, 842])
    page.drawText(`${titulo} - Página ${i + 1} de ${totalPaginas}`, {
      x: 50,
      y: 780,
      size: 16,
      color: rgb(0.1, 0.3, 0.8),
    })
  }
  const bytes = await doc.save()
  const cleanBase64 = uint8ArrayToBase64(bytes)
  const pdfBase64 = `data:application/pdf;base64,${cleanBase64}`
  return {
    bytes,
    cleanBase64,
    pdfBase64,
    totalPaginas,
    tamanhoBytes: bytes.byteLength,
    tamanhoFormatado: formatBytes(bytes.byteLength),
  }
}

test('Multi-Documentos Digitais - Mesclagem, Envelopes e Emissão Múltipla', async (t) => {
  // 1. Teste de Mesclagem de Múltiplos Documentos PDF
  await t.test('Mesclagem de 3 documentos distintos em um único PDF sequencial consolidado', async () => {
    const pdf1 = await criarPdfTeste(2, 'Contrato de Prestação de Serviços 2027')
    const pdf2 = await criarPdfTeste(1, 'Termo de Autorização de Uso de Imagem')
    const pdf3 = await criarPdfTeste(3, 'Regimento Escolar e Normas Internas')

    const listaDocs = [
      {
        id: 'doc-1',
        nome: 'Contrato_Prestacao_2027.pdf',
        tamanhoBytes: pdf1.tamanhoBytes,
        tamanhoFormatado: pdf1.tamanhoFormatado,
        formatoOriginal: 'pdf',
        pdfBase64: pdf1.pdfBase64,
        cleanBase64: pdf1.cleanBase64,
        totalPaginas: pdf1.totalPaginas,
        metodoConversao: 'direto',
      },
      {
        id: 'doc-2',
        nome: 'Termo_Imagem.pdf',
        tamanhoBytes: pdf2.tamanhoBytes,
        tamanhoFormatado: pdf2.tamanhoFormatado,
        formatoOriginal: 'pdf',
        pdfBase64: pdf2.pdfBase64,
        cleanBase64: pdf2.cleanBase64,
        totalPaginas: pdf2.totalPaginas,
        metodoConversao: 'direto',
      },
      {
        id: 'doc-3',
        nome: 'Regimento_Escolar.pdf',
        tamanhoBytes: pdf3.tamanhoBytes,
        tamanhoFormatado: pdf3.tamanhoFormatado,
        formatoOriginal: 'pdf',
        pdfBase64: pdf3.pdfBase64,
        cleanBase64: pdf3.cleanBase64,
        totalPaginas: pdf3.totalPaginas,
        metodoConversao: 'direto',
      },
    ]

    const resultadoMesclado = await mesclarMultiplosDocumentosPdf(listaDocs)

    assert.ok(resultadoMesclado.pdfBase64.startsWith('data:application/pdf;base64,'))
    assert.equal(resultadoMesclado.totalPaginas, 6, 'Total de páginas deve ser exatamente a soma: 2 + 1 + 3 = 6')
    assert.equal(resultadoMesclado.formatoOriginal, 'pdf')
    assert.ok(resultadoMesclado.nomeArquivoPdf.includes('Pacote_3_Docs'))

    // Valida carregando o PDF gerado diretamente pelo pdf-lib
    const bytesDecodificados = Buffer.from(resultadoMesclado.cleanBase64, 'base64')
    const pdfVerificacao = await PDFDocument.load(bytesDecodificados)
    assert.equal(pdfVerificacao.getPageCount(), 6, 'PDF Document carregado deve ter 6 páginas')

    // Hashes individuais dos documentos originais
    const hash1 = calculateSha256(pdf1.bytes)
    const hash2 = calculateSha256(pdf2.bytes)
    const hash3 = calculateSha256(pdf3.bytes)
    const hashMesclado = calculateSha256(bytesDecodificados)

    assert.notEqual(hash1, hashMesclado)
    assert.notEqual(hash2, hashMesclado)
    assert.notEqual(hash3, hashMesclado)
  })

  // 2. Teste de caso borda: 1 único documento
  await t.test('Mesclagem com apenas 1 documento retorna o documento original sem alteração', async () => {
    const pdf1 = await criarPdfTeste(4, 'Documento Único')
    const lista = [
      {
        id: 'doc-solo',
        nome: 'Arquivo_Solo.pdf',
        tamanhoBytes: pdf1.tamanhoBytes,
        tamanhoFormatado: pdf1.tamanhoFormatado,
        formatoOriginal: 'pdf',
        pdfBase64: pdf1.pdfBase64,
        cleanBase64: pdf1.cleanBase64,
        totalPaginas: pdf1.totalPaginas,
        metodoConversao: 'direto',
      },
    ]

    const res = await mesclarMultiplosDocumentosPdf(lista)
    assert.equal(res.totalPaginas, 4)
    assert.equal(res.cleanBase64, pdf1.cleanBase64)
    assert.equal(res.nomeArquivoPdf, 'Arquivo_Solo.pdf')
  })

  // 3. Teste de erro: lista vazia
  await t.test('Mesclagem com lista vazia lança erro explicativo', async () => {
    await assert.rejects(
      async () => {
        await mesclarMultiplosDocumentosPdf([])
      },
      /Nenhum documento fornecido para mesclagem/
    )
  })
})
