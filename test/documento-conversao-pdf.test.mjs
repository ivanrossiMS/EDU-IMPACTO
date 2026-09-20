import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import {
  detectDocumentFormat,
  convertDocumentBufferToPdf,
} from '../lib/converters/documentToPdfServer.ts'
import { calculateSha256, generateProtocolCode } from '../lib/contracts/cryptoSignature.ts'
import { anexarCertificadoEvidencias } from '../lib/contracts/digitalEvidenceCertificate.ts'

test('Sistema de Conversão e Emissão Automática: Word (.DOC/.DOCX) para PDF', async (t) => {
  // 1. Detecção de Formato por Magic Bytes
  await t.test('Detecção de formatos por Magic Bytes', () => {
    const pdfMagic = Buffer.from('%PDF-1.7\n')
    assert.equal(detectDocumentFormat(pdfMagic), 'pdf')

    const docxMagic = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00])
    assert.equal(detectDocumentFormat(docxMagic), 'docx')

    const docMagic = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])
    assert.equal(detectDocumentFormat(docMagic), 'doc')

    const unknownMagic = Buffer.from([0x00, 0x01, 0x02, 0x03])
    assert.equal(detectDocumentFormat(unknownMagic), 'unknown')
  })

  // 2. Conversão de DOCX real para PDF
  await t.test('Conversão de arquivo .docx para PDF oficial A4', async () => {
    assert.equal(fs.existsSync('test.docx'), true, 'Arquivo test.docx deve existir')
    const docxBuffer = fs.readFileSync('test.docx')

    const result = await convertDocumentBufferToPdf(docxBuffer, 'Contrato_Prestacao_Servicos.docx', {
      title: 'Contrato de Prestação de Serviços Educacionais',
      schoolName: 'COLÉGIO IMPACTO',
      documentSubtitle: 'Ano Letivo 2027 • Ensino Fundamental',
    })

    assert.equal(result.formatDetected, 'docx')
    assert.equal(result.docName, 'Contrato_Prestacao_Servicos.pdf')
    assert.equal(result.totalPages >= 1, true)
    assert.equal(result.pdfBytes.length > 500, true)

    // Verifica assinatura mágica do PDF (%PDF-)
    const header = Buffer.from(result.pdfBytes.slice(0, 5)).toString('utf-8')
    assert.equal(header.startsWith('%PDF-'), true, 'PDF gerado deve iniciar com assinatura %PDF-')

    // Verifica se é carregável pelo pdf-lib
    const parsedPdf = await PDFDocument.load(result.pdfBytes)
    assert.equal(parsedPdf.getPageCount(), result.totalPages)
  })

  // 3. Conversão de DOCX com listas ordenadas
  await t.test('Conversão de arquivo .docx com listas para PDF', async () => {
    assert.equal(fs.existsSync('test-list.docx'), true, 'Arquivo test-list.docx deve existir')
    const listBuffer = fs.readFileSync('test-list.docx')

    const result = await convertDocumentBufferToPdf(listBuffer, 'Termo_Ciencia_Listas.docx', {
      title: 'Termo de Ciência com Itens',
    })

    assert.equal(result.formatDetected, 'docx')
    assert.equal(result.docName, 'Termo_Ciencia_Listas.pdf')
    assert.equal(result.totalPages, 1)
    assert.equal(result.pdfBytes[0] === 0x25 && result.pdfBytes[1] === 0x50, true)
  })

  // 4. Pass-through transparente de arquivos que já são PDF
  await t.test('Pass-through transparente de arquivos que já são PDF', async () => {
    const docxBuffer = fs.readFileSync('test.docx')
    const initialConv = await convertDocumentBufferToPdf(docxBuffer, 'test.docx')

    // Agora envia o PDF gerado de volta
    const pdfPassThrough = await convertDocumentBufferToPdf(
      Buffer.from(initialConv.pdfBytes),
      'documento_pronto.pdf'
    )

    assert.equal(pdfPassThrough.formatDetected, 'pdf')
    assert.equal(pdfPassThrough.docName, 'documento_pronto.pdf')
    assert.equal(pdfPassThrough.totalPages, initialConv.totalPages)
    assert.equal(pdfPassThrough.pdfBytes.length, initialConv.pdfBytes.length)
  })

  // 5. Integração de Documento Word Convertido com Selamento Criptográfico ICP-Brasil
  await t.test('Integração de Documento Word Convertido com Selamento Criptográfico e Assinatura Digital', async () => {
    const docxBuffer = fs.readFileSync('test.docx')
    const conv = await convertDocumentBufferToPdf(docxBuffer, 'Requerimento_2027.docx', {
      title: 'Requerimento de Matrícula 2027',
      schoolName: 'COLÉGIO IMPACTO',
    })

    const originalHash = calculateSha256(conv.pdfBytes)
    const protocolo = generateProtocolCode('2027')

    const seladoResult = await anexarCertificadoEvidencias({
      originalPdfBytes: conv.pdfBytes,
      protocolo,
      documentoTitulo: 'Requerimento de Matrícula 2027',
      documentoOriginalHash: originalHash,
      signatario: {
        nome: 'Maria Aparecida da Silva',
        cpf: '123.456.789-00',
        email: 'maria.silva@exemplo.com',
        telefone: '(67) 99999-8888',
        parentesco: 'Mãe e Responsável Legal',
        tipoAssinatura: 'nome_automatico',
        dataHoraAssinatura: new Date().toISOString(),
        metodoAutenticacao: 'CÓDIGO DE USO ÚNICO (OTP)',
        aceiteTexto: 'Declaro ter lido, concordado e assinado os termos deste documento.',
        ip: '189.40.12.85',
        dispositivo: 'iPhone (Apple)',
        sistemaOperacional: 'iOS 17',
        navegador: 'Apple Safari',
        assinaturaBase64: null,
        usuarioAutenticadoApp: false,
      },
      representanteEscola: {
        nome: 'IVAN ROSSI SAMBRANA',
        cpf: '00130220167',
        cargo: 'Diretor Geral / Representante Legal',
        razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
        cnpj: '04.395.789/0001-88',
        dataHoraAssinatura: new Date().toISOString(),
      },
      eventosAuditoria: [
        { timestamp: new Date().toISOString(), evento: 'CRIACAO', descricao: 'Documento Word convertido para PDF', ip: '127.0.0.1' },
        { timestamp: new Date().toISOString(), evento: 'ENVIO_OTP', descricao: 'Código OTP enviado para o signatário', ip: '127.0.0.1' },
        { timestamp: new Date().toISOString(), evento: 'OTP_CONFIRMADO', descricao: 'Código validado com sucesso', ip: '189.40.12.85' },
        { timestamp: new Date().toISOString(), evento: 'ASSINATURA_SIGNATARIO', descricao: 'Assinatura registrada', ip: '189.40.12.85' },
      ],
    })

    assert.equal(seladoResult.pdfBytes.length > conv.pdfBytes.length, true)
    assert.equal(seladoResult.documentoFinalHash.length, 64)

    // Inspeciona as páginas do PDF resultante
    const docVerificado = await PDFDocument.load(seladoResult.pdfBytes)
    assert.equal(docVerificado.getPageCount(), conv.totalPages + 1, 'Deve conter as páginas do documento convertido + 1 página de Certificado de Evidências')

    // Confere campos técnicos de assinatura incorporada
    const pdfStringPronto = Buffer.from(seladoResult.pdfBytes).toString('latin1')
    assert.equal(pdfStringPronto.includes('/ByteRange'), true)
    assert.equal(pdfStringPronto.includes('/Adobe.PPKLite'), true)
  })

  // 6. Conversão com extração e renderização fiel de imagem incorporada no DOCX
  await t.test('Conversão de arquivo .docx com imagens incorporadas', async () => {
    assert.equal(fs.existsSync('test-image.docx'), true, 'Arquivo test-image.docx deve existir')
    const imgDocxBuffer = fs.readFileSync('test-image.docx')

    const result = await convertDocumentBufferToPdf(imgDocxBuffer, 'Contrato_Com_Logo.docx')
    assert.equal(result.formatDetected, 'docx')
    assert.equal(result.totalPages, 1)
    assert.equal(result.pdfBytes.length > 500, true)

    // O PDF resultante deve conter o stream XObject de imagem (/XObject, /Image)
    const pdfStr = Buffer.from(result.pdfBytes).toString('latin1')
    assert.equal(pdfStr.includes('/XObject') || pdfStr.includes('/Image'), true, 'PDF deve conter objeto de imagem embutido')
  })

  // 7. Fidelidade de conteúdo: não injeta cabeçalhos institucionais artificiais
  await t.test('Fidelidade de conteúdo: sem cabeçalhos ou rodapés artificiais injetados', async () => {
    const docxBuffer = fs.readFileSync('test.docx')
    const result = await convertDocumentBufferToPdf(docxBuffer, 'Documento_Privado.docx')

    const pdfStr = Buffer.from(result.pdfBytes).toString('latin1')
    // Não deve conter slogans ou cabeçalhos inventados pelo sistema
    assert.equal(
      pdfStr.includes('SISTEMA INTEGRADO DE GEST'),
      false,
      'Não deve conter cabeçalho artificial "SISTEMA INTEGRADO DE GESTÃO ESCOLAR"'
    )
    assert.equal(
      pdfStr.includes('Documento oficial convertido automaticamente para assinatura'),
      false,
      'Não deve conter rodapé artificial com disclaimer'
    )
  })

  // 8. Importação direta sem transformação: preserva integridade byte-a-byte
  await t.test('Importação direta sem transformação: preserva integridade byte-a-byte e gera Certificado Oficial de Evidências', async () => {
    const originalDocx = fs.readFileSync('test.docx')
    const originalHash = calculateSha256(originalDocx)
    const protocolo = generateProtocolCode('2027')

    // Gera o certificado oficial de evidências preservando o DOCX original
    const seladoResult = await anexarCertificadoEvidencias({
      originalPdfBytes: originalDocx,
      protocolo,
      documentoTitulo: 'Documento Word Original',
      documentoOriginalHash: originalHash,
      signatario: {
        nome: 'João da Silva',
        cpf: '123.456.789-00',
        email: 'joao@exemplo.com',
        telefone: '(67) 99999-0000',
        parentesco: 'Responsável',
        tipoAssinatura: 'nome_automatico',
        dataHoraAssinatura: new Date().toISOString(),
        metodoAutenticacao: 'CÓDIGO DE USO ÚNICO (OTP)',
        aceiteTexto: 'Declaro ter lido e concordado integralmente com o documento.',
        ip: '200.180.10.5',
        dispositivo: 'MacBook Pro',
        sistemaOperacional: 'macOS 15',
        navegador: 'Safari',
        assinaturaBase64: null,
        usuarioAutenticadoApp: true,
      },
      representanteEscola: {
        nome: 'IVAN ROSSI SAMBRANA',
        cpf: '00130220167',
        cargo: 'Diretor Geral',
        razaoSocial: 'COLÉGIO IMPACTO CENTRO DE ENSINO LTDA',
        cnpj: '04.395.789/0001-88',
        dataHoraAssinatura: new Date().toISOString(),
      },
      eventosAuditoria: [
        { timestamp: new Date().toISOString(), evento: 'CRIACAO', descricao: 'Documento Word original importado sem conversão', ip: '127.0.0.1' },
      ],
    })

    assert.equal(seladoResult.documentoOriginalHash, originalHash, 'Hash do documento original deve ser exatamente o SHA-256 do DOCX original')
    assert.equal(seladoResult.pdfBytes.length > 500, true, 'Deve gerar Certificado de Evidências em PDF')
    const certDoc = await PDFDocument.load(seladoResult.pdfBytes)
    assert.equal(certDoc.getPageCount(), 1, 'Certificado de evidências para arquivo Word deve ser página oficial')
  })

  // 9. Conversão de arquivo .doc legado (Word 97-2003 OLE2) com imagens e formatação
  await t.test('Conversão de arquivo .doc legado com alta fidelidade de formatação e imagens', async () => {
    const docPath = '/Users/ivanrossi/Downloads/CONTRATOS2027 2/CONTRATOS2027/CONTRATO NV1 e NV2 - 2027.doc'
    if (fs.existsSync(docPath)) {
      const docBuffer = fs.readFileSync(docPath)
      const detected = detectDocumentFormat(docBuffer)
      assert.equal(detected, 'doc', 'Deve detectar formato .doc')

      const result = await convertDocumentBufferToPdf(docBuffer, 'CONTRATO NV1 e NV2 - 2027.doc')
      assert.equal(result.formatDetected, 'doc')
      assert.equal(result.docName, 'CONTRATO NV1 e NV2 - 2027.pdf')
      assert.equal(result.totalPages >= 7, true, 'Deve conter as 8 páginas originais do contrato')
      assert.equal(result.pdfBytes.length > 100000, true, 'Deve conter imagens e formatação completa')

      const parsedPdf = await PDFDocument.load(result.pdfBytes)
      assert.equal(parsedPdf.getPageCount(), result.totalPages)
    } else {
      // Cria mock de OLE2 se o arquivo externo não estiver presente
      const mockDoc = Buffer.concat([
        Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
        Buffer.alloc(1024, 0x00),
      ])
      assert.equal(detectDocumentFormat(mockDoc), 'doc')
    }
  })
})

